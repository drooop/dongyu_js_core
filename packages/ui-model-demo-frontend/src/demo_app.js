import { computed, h, onBeforeUnmount, onMounted, ref, resolveComponent, watch } from 'vue';
import { createRenderer } from '@ui-renderer/index.mjs';
import { readAppShellRouteSyncState, resolveNavigableRoutePath } from './app_shell_route_sync.js';
import { dispatchAppShellStateUpdate } from './app_shell_state_dispatch.js';
import { buildFocusedWorkspaceAppContentAst } from './desktop_focused_app_content.js';
import { buildForegroundShellAst } from './desktop_foreground_shell_ast.js';
import { findPageEntryByPath, readPageCatalog } from './page_asset_resolver.js';
import { getForegroundModelLoadState } from './foreground_app_load_state.js';
import {
  DESKTOP_FOREGROUND_APP_LABEL,
  DESKTOP_TASK_STACK_LABEL,
  DESKTOP_TASK_SWITCHER_OPEN_LABEL,
  readAvailableDesktopForegroundApp,
  readAvailableDesktopTaskStack,
  readDesktopTaskSwitcherOpen,
  desktopTaskKey,
  removeDesktopTaskFromStack,
} from './desktop_app_state.js';
import { MATRIX_CHAT_APP_MODEL_ID } from './model_ids.js';

import {
  ROUTE_HOME,
  getHashPath,
  setHashPath,
  subscribeHashPath,
} from './router.js';

const MATRIX_CHAT_BUS_KEY = 'matrix_chat_1083_bus_event';
const MATRIX_CHAT_REFRESH_PAYLOAD = Object.freeze([
  Object.freeze({ id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' }),
  Object.freeze({ id: 0, p: 0, r: 0, c: 0, k: 'action', t: 'str', v: 'refresh_rooms' }),
]);

export function createDemoRoot(store, options = {}) {
  let consumeScheduled = false;
  function scheduleConsumeOnce() {
    if (consumeScheduled) return;
    consumeScheduled = true;
    queueMicrotask(() => {
      consumeScheduled = false;
      store.consumeOnce();
    });
  }

  const host = {
    getSnapshot: () => store.snapshot,
    getEffectiveLabelValue: (ref) => {
      if (store && typeof store.getEffectiveLabelValue === 'function') {
        return store.getEffectiveLabelValue(ref);
      }
      return undefined;
    },
    stageOverlayValue: (payload) => {
      if (store && typeof store.stageOverlayValue === 'function') {
        const result = store.stageOverlayValue(payload);
        scheduleConsumeOnce();
        return result;
      }
      return undefined;
    },
    commitOverlayValue: (payload) => {
      if (store && typeof store.commitOverlayValue === 'function') {
        return store.commitOverlayValue(payload);
      }
      return undefined;
    },
    dispatchAddLabel: (label) => {
      store.dispatchAddLabel(label);
      scheduleConsumeOnce();
    },
    dispatchRmLabel: (labelRef) => {
      store.dispatchRmLabel(labelRef);
      scheduleConsumeOnce();
    },
    uploadMedia: async (input) => {
      if (store && typeof store.uploadMedia === 'function') {
        return store.uploadMedia(input);
      }
      throw new Error('upload_media_not_supported');
    },
  };
  const renderer = createRenderer({ host, vue: { h, resolveComponent } });

  return {
    name: 'DemoRoot',
    setup() {
      const ast = computed(() => {
        const { models, v1nConfig } = store.snapshot;
        void models;
        void v1nConfig;
        const routePath = typeof options.routePath === 'function' ? options.routePath() : options.routePath;
        return store.getUiAst(routePath);
      });
      return () => {
        if (!ast.value || typeof ast.value !== 'object') {
          const hasSnapshotModels = store?.snapshot?.models && Object.keys(store.snapshot.models).length > 0;
          const workspaceStatus = store?.workspaceStatus || null;
          const authState = store?.authState || null;
          let fallbackText = hasSnapshotModels ? '页面暂不可用' : '加载中';
          if (authState && authState.sessionChecked !== true) {
            fallbackText = '正在确认登录';
          } else if (workspaceStatus && workspaceStatus.status === 'initializing') {
            fallbackText = '正在准备工作区';
          } else if (authState && authState.authenticated === true && workspaceStatus && workspaceStatus.status === 'idle') {
            fallbackText = '正在准备工作区';
          } else if (workspaceStatus && workspaceStatus.status === 'failed') {
            fallbackText = `工作区准备失败${workspaceStatus.message ? `：${workspaceStatus.message}` : ''}`;
          } else if (workspaceStatus && workspaceStatus.status === 'auth_failure') {
            fallbackText = '登录状态不可用，请重新登录';
          }
          return h('div', {
            'data-testid': 'workspace-status-fallback',
            style: {
              padding: '24px 16px',
              color: '#64748b',
              fontSize: '14px',
            },
          }, fallbackText);
        }
        const slots = typeof options.slots === 'function' ? options.slots() : options.slots;
        return renderer.renderVNode(ast.value, slots && typeof slots === 'object' ? { slots } : undefined);
      };
    },
  };
}

export async function ensureForegroundAppVisibleModelLoaded(mainStore, app) {
  if (!mainStore || !app || app.page !== 'workspace' || !Number.isInteger(app.model_id)) return false;
  const modelRef = typeof app.table_id === 'string' && app.table_id.trim()
    ? { table_id: app.table_id.trim(), model_id: app.model_id }
    : app.model_id;
  if (typeof mainStore.ensureVisibleModelLoaded !== 'function') {
    return typeof mainStore.hasSnapshotModel === 'function' && mainStore.hasSnapshotModel(modelRef);
  }
  try {
    return await mainStore.ensureVisibleModelLoaded(modelRef);
  } catch (err) {
    console.warn('foreground visible model lazy load failed', { err, model_id: app.model_id });
    return false;
  }
}

export function createAppShell({ mainStore, galleryStore, authStore }) {
  const HomeRoot = createDemoRoot(mainStore);
  const GalleryRoot = createDemoRoot(galleryStore);

  return {
    name: 'AppShell',
    setup() {
      const ElButton = resolveComponent('ElButton');
      const ElDivider = resolveComponent('ElDivider');
      const ElDropdown = resolveComponent('ElDropdown');
      const ElDropdownMenu = resolveComponent('ElDropdownMenu');
      const ElDropdownItem = resolveComponent('ElDropdownItem');
      const ElSpace = resolveComponent('ElSpace');
      const ElTag = resolveComponent('ElTag');
      const shellRenderer = createRenderer({
        host: {
          getSnapshot: () => mainStore?.snapshot ?? { models: {} },
          getEffectiveLabelValue: (ref) => {
            if (mainStore && typeof mainStore.getEffectiveLabelValue === 'function') {
              return mainStore.getEffectiveLabelValue(ref);
            }
            return undefined;
          },
          dispatchAddLabel: (label) => {
            if (mainStore && typeof mainStore.dispatchAddLabel === 'function') {
              mainStore.dispatchAddLabel(label);
            }
            if (mainStore && typeof mainStore.consumeOnce === 'function') {
              queueMicrotask(() => mainStore.consumeOnce());
            }
          },
          dispatchRmLabel: (labelRef) => {
            if (mainStore && typeof mainStore.dispatchRmLabel === 'function') {
              mainStore.dispatchRmLabel(labelRef);
            }
            if (mainStore && typeof mainStore.consumeOnce === 'function') {
              queueMicrotask(() => mainStore.consumeOnce());
            }
          },
          stageOverlayValue: (payload) => {
            if (mainStore && typeof mainStore.stageOverlayValue === 'function') {
              const result = mainStore.stageOverlayValue(payload);
              if (mainStore && typeof mainStore.consumeOnce === 'function') {
                queueMicrotask(() => mainStore.consumeOnce());
              }
              return result;
            }
            return undefined;
          },
          commitOverlayValue: (payload) => {
            if (mainStore && typeof mainStore.commitOverlayValue === 'function') {
              return mainStore.commitOverlayValue(payload);
            }
            return undefined;
          },
          uploadMedia: async (input) => {
            if (mainStore && typeof mainStore.uploadMedia === 'function') {
              return mainStore.uploadMedia(input);
            }
            throw new Error('upload_media_not_supported');
          },
        },
        vue: { h, resolveComponent },
      });
      const path = ref(getHashPath());
      let unsubscribe = null;

      if (mainStore && typeof mainStore.setRoutePath === 'function') {
        mainStore.setRoutePath(path.value);
      }

      function readCatalog() {
        return readPageCatalog(mainStore?.snapshot ?? {});
      }

      function findRouteEntry(routePath) {
        return findPageEntryByPath(mainStore?.snapshot ?? {}, routePath);
      }

      function normalizeIfUnknown(p) {
        const nextPath = resolveNavigableRoutePath(mainStore?.snapshot ?? {}, p);
        if (nextPath === p) return;
        setHashPath(nextPath, { replace: true });
        path.value = nextPath;
        if (mainStore && typeof mainStore.setRoutePath === 'function') {
          mainStore.setRoutePath(path.value);
        }
      }

      function resolveWorkspaceModelId() {
        const labels = mainStore?.snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels ?? {};
        const raw = labels.ws_app_selected?.v;
        if (typeof raw === 'number' && Number.isInteger(raw) && raw !== 0) return raw;
        if (typeof raw === 'string' && /^-?\d+$/.test(raw.trim())) {
          const parsed = Number.parseInt(raw.trim(), 10);
          if (Number.isInteger(parsed) && parsed !== 0) return parsed;
        }
        return 100;
      }

      function selectWorkspaceModel(modelId) {
        dispatchAppShellStateUpdate(mainStore, {
          target: { model_id: -2, p: 0, r: 0, c: 0, k: 'ws_app_selected' },
          value: { t: 'int', v: modelId },
        });
      }

      function syncPageLabel(routePath) {
        const page = findRouteEntry(routePath)?.page || 'home';
        try {
          dispatchAppShellStateUpdate(mainStore, {
            target: { model_id: -2, p: 0, r: 0, c: 0, k: 'ui_page' },
            value: { t: 'str', v: page },
          });
        } catch (_) {
          // ignore
        }
      }

      function syncWorkspaceSelection(routePath) {
        const page = findRouteEntry(routePath)?.page || 'home';
        if (page !== 'workspace') return;
        selectWorkspaceModel(resolveWorkspaceModelId());
      }

      function syncGalleryRoute(routePath) {
        if (galleryStore && typeof galleryStore.setRoutePath === 'function') {
          galleryStore.setRoutePath(routePath);
        }
      }

      function clearGalleryNavTarget() {
        dispatchAppShellStateUpdate(mainStore, {
          target: { model_id: -102, p: 0, r: 0, c: 0, k: 'nav_to' },
          value: { t: 'str', v: '' },
        });
      }

      onMounted(() => {
        normalizeIfUnknown(path.value);
        if (mainStore && typeof mainStore.setRoutePath === 'function') {
          mainStore.setRoutePath(path.value);
        }
        syncGalleryRoute(path.value);
        syncPageLabel(path.value);
        syncWorkspaceSelection(path.value);
        syncDesktopForeground(desktopForegroundApp.value);
        unsubscribe = subscribeHashPath((next) => {
          path.value = next;
          normalizeIfUnknown(next);
          if (mainStore && typeof mainStore.setRoutePath === 'function') {
            mainStore.setRoutePath(path.value);
          }
          syncGalleryRoute(next);
          syncPageLabel(next);
          syncWorkspaceSelection(next);
          if (next === ROUTE_HOME) {
            syncDesktopForeground(desktopForegroundApp.value);
          }
        });
      });

      onBeforeUnmount(() => {
        if (unsubscribe) unsubscribe();
      });

      const currentRouteEntry = computed(() => findRouteEntry(path.value));
      const routeSyncState = computed(() => readAppShellRouteSyncState(mainStore?.snapshot ?? {}, path.value));
      const authIssue = computed(() => (authStore && authStore.state ? authStore.state.authIssue : null));
      const desktopForegroundApp = computed(() => readAvailableDesktopForegroundApp(mainStore?.snapshot ?? {}));
      const foregroundVisibleLoadTick = ref(0);
      const ForegroundRouteRoot = createDemoRoot(mainStore, {
        routePath: () => desktopForegroundApp.value?.path || '/',
      });
      const desktopForegroundKey = computed(() => JSON.stringify(desktopForegroundApp.value || null));
      const desktopTasks = computed(() => readAvailableDesktopTaskStack(mainStore?.snapshot ?? {}));
      const desktopTaskSwitcherOpen = computed(() => readDesktopTaskSwitcherOpen(mainStore?.snapshot ?? {}));
      const matrixChatAutoRefreshKeys = new Set();
      const galleryNavTarget = computed(() => {
        const labels = mainStore?.snapshot?.models?.['-102']?.cells?.['0,0,0']?.labels ?? {};
        const raw = labels.nav_to?.v;
        return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : '';
      });
      const matrixChatAutoRefreshKey = computed(() => {
        if (path.value !== ROUTE_HOME) return '';
        if (!isMatrixChatForeground()) return '';
        const state = authStore && authStore.state ? authStore.state : null;
        if (!state || state.authenticated !== true || state.matrixConnected !== true) return '';
        const capabilities = Array.isArray(state.capabilities) ? state.capabilities : [];
        if (!capabilities.includes('matrix:connect')) return '';
        return [
          state.subject || state.userId || '',
          state.matrixUserId || '',
          state.homeserverUrl || '',
          MATRIX_CHAT_APP_MODEL_ID,
        ].join('|');
      });

      function syncDesktopForeground(app) {
        if (!app) {
          if (mainStore && typeof mainStore.setRoutePath === 'function') {
            mainStore.setRoutePath(path.value);
          }
          syncGalleryRoute(path.value);
          syncPageLabel(path.value);
          syncWorkspaceSelection(path.value);
          return;
        }
        if (mainStore && typeof mainStore.setRoutePath === 'function') {
          mainStore.setRoutePath(app.path);
        }
        syncGalleryRoute(app.path);
        syncPageLabel(app.path);
        if (app.page === 'workspace' && Number.isInteger(app.model_id)) {
          void ensureForegroundAppVisibleModelLoaded(mainStore, app).then((loaded) => {
            if (loaded) foregroundVisibleLoadTick.value += 1;
          });
          selectWorkspaceModel(app.model_id);
        } else {
          syncWorkspaceSelection(app.path);
        }
      }

      function clearDesktopForeground() {
        dispatchAppShellStateUpdate(mainStore, {
          target: { model_id: -2, p: 0, r: 0, c: 0, k: DESKTOP_FOREGROUND_APP_LABEL },
          value: { t: 'json', v: null },
        });
        syncDesktopForeground(null);
      }

      function setTaskSwitcherOpen(open) {
        dispatchAppShellStateUpdate(mainStore, {
          target: { model_id: -2, p: 0, r: 0, c: 0, k: DESKTOP_TASK_SWITCHER_OPEN_LABEL },
          value: { t: 'bool', v: Boolean(open) },
        });
      }

      function activateDesktopTask(task) {
        if (!task || typeof task !== 'object') return;
        dispatchAppShellStateUpdate(mainStore, {
          target: { model_id: -2, p: 0, r: 0, c: 0, k: DESKTOP_FOREGROUND_APP_LABEL },
          value: { t: 'json', v: task },
        });
        setTaskSwitcherOpen(false);
        syncDesktopForeground(task);
        if (path.value !== ROUTE_HOME) {
          setHashPath(ROUTE_HOME);
          path.value = ROUTE_HOME;
        }
      }

      function closeDesktopTask(task) {
        if (!task || typeof task.id !== 'string' || !task.id.trim()) return;
        const nextStack = removeDesktopTaskFromStack(desktopTasks.value, task);
        dispatchAppShellStateUpdate(mainStore, {
          target: { model_id: -2, p: 0, r: 0, c: 0, k: DESKTOP_TASK_STACK_LABEL },
          value: { t: 'json', v: nextStack },
        });
        if (desktopTaskKey(desktopForegroundApp.value) === desktopTaskKey(task)) {
          clearDesktopForeground();
          setTaskSwitcherOpen(false);
        }
      }

      watch(galleryNavTarget, (next) => {
        if (!next) return;
        setHashPath(next);
        path.value = next;
        if (mainStore && typeof mainStore.setRoutePath === 'function') {
          mainStore.setRoutePath(path.value);
        }
        syncGalleryRoute(path.value);
        syncPageLabel(path.value);
        syncWorkspaceSelection(path.value);
        clearGalleryNavTarget();
      });

      watch(desktopForegroundKey, () => {
        syncDesktopForeground(desktopForegroundApp.value);
        if (desktopForegroundApp.value && path.value !== ROUTE_HOME) {
          setHashPath(ROUTE_HOME);
          path.value = ROUTE_HOME;
        }
      });

      function dispatchMatrixChatAutoRefresh(key) {
        if (!key || matrixChatAutoRefreshKeys.has(key)) return;
        if (!mainStore
          || typeof mainStore.buildUiEventV2 !== 'function'
          || typeof mainStore.buildDispatchLabel !== 'function'
          || typeof mainStore.dispatchAddLabel !== 'function') {
          return;
        }
        matrixChatAutoRefreshKeys.add(key);
        const envelope = mainStore.buildUiEventV2({
          busInKey: MATRIX_CHAT_BUS_KEY,
          value: MATRIX_CHAT_REFRESH_PAYLOAD.map((record) => ({ ...record })),
          opId: `matrix_chat_auto_refresh_${Date.now()}`,
          source: 'app_shell_auto_refresh',
        });
        const label = mainStore.buildDispatchLabel(envelope);
        try {
          const result = mainStore.dispatchAddLabel(label);
          if (result && typeof result.catch === 'function') result.catch(() => {});
        } catch (_) {
          // AuthIssuePanel and Matrix status text cover visible failures.
        }
        if (typeof mainStore.consumeOnce === 'function') {
          queueMicrotask(() => mainStore.consumeOnce());
        }
      }

      watch(matrixChatAutoRefreshKey, (key) => {
        dispatchMatrixChatAutoRefresh(key);
      }, { immediate: true });

      if (authStore && authStore.state) {
        watch(() => authStore.state.matrixConnected, (connected) => {
          if (connected === false) matrixChatAutoRefreshKeys.clear();
        });
      }

      function localLabelUpdate(key, t, v) {
        return {
          action: 'label_update',
          target_ref: { model_id: -2, p: 0, r: 0, c: 0, k: key },
          value_ref: { t, v },
        };
      }

      function buildTaskSwitcherShellAst() {
        return {
          id: 'desktop_task_switcher_shell_model',
          type: 'Container',
          props: {
            'data-testid': 'desktop-task-switcher-panel',
            style: {
              width: 'min(560px, 94vw)',
              height: '100%',
              background: 'rgba(248, 250, 252, 0.92)',
              borderLeft: '1px solid rgba(148, 163, 184, 0.36)',
              boxShadow: '-24px 0 62px rgba(15, 23, 42, 0.18)',
              padding: '22px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              backdropFilter: 'blur(18px)',
            },
          },
          children: [
            {
              id: 'desktop_task_switcher_header',
              type: 'Container',
              props: { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
              children: [
                { id: 'desktop_task_switcher_title', type: 'Heading', props: { level: 2, text: '最近任务', style: { fontSize: '18px', fontWeight: 850 } } },
                {
                  id: 'desktop_task_switcher_close_model',
                  type: 'Button',
                  props: { label: '关闭', size: 'small', round: true, 'data-testid': 'desktop-task-switcher-close' },
                  bind: { write: localLabelUpdate(DESKTOP_TASK_SWITCHER_OPEN_LABEL, 'bool', false) },
                },
              ],
            },
            {
              id: 'desktop_task_switcher_grid_model',
              type: 'AppSwitcher',
              children: [{ id: 'desktop_task_cards_slot', type: 'HostSlot', props: { name: 'taskCards' } }],
            },
          ],
        };
      }

      function ForegroundPlayer() {
        const app = desktopForegroundApp.value;
        if (!app) return null;
        const visibleLoadTick = foregroundVisibleLoadTick.value;
        void visibleLoadTick;
        const {
          waitingForVisibleModel,
        } = getForegroundModelLoadState(mainStore, app);
        if (waitingForVisibleModel) {
          const loading = h('div', {
            id: 'foreground_visible_model_loading',
            'data-testid': 'foreground-visible-model-loading',
            style: {
              minHeight: '320px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              fontSize: '15px',
              fontWeight: 700,
            },
          }, '正在加载滑动 APP...');
          return shellRenderer.renderVNode(buildForegroundShellAst(app, mainStore?.snapshot), {
            slots: {
              appContent: () => loading,
            },
          });
        }
        const focusedAppContentAst = buildFocusedWorkspaceAppContentAst(app, mainStore?.snapshot);
        const content = app.page === 'gallery'
          ? h(GalleryRoot)
          : (
            focusedAppContentAst
              ? shellRenderer.renderVNode(focusedAppContentAst)
              : h(ForegroundRouteRoot)
          );
        return shellRenderer.renderVNode(buildForegroundShellAst(app, mainStore?.snapshot), {
          slots: {
            appContent: () => content,
          },
        });
      }

      function renderTaskCard(task) {
        return h('article', {
          key: task.id,
          style: {
            minHeight: '124px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '14px',
            borderRadius: '24px',
            border: '1px solid rgba(148, 163, 184, 0.34)',
            background: '#ffffff',
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.10)',
          },
        }, [
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
            h('div', { style: { fontSize: '15px', fontWeight: 850, color: '#102033' } }, task.title || task.id),
            h('div', { style: { fontSize: '12px', color: '#64748b' } }, task.kind === 'workspace' && Number.isInteger(task.model_id) ? `Workspace · model ${task.model_id}` : 'System app'),
          ]),
          h('div', { style: { display: 'flex', gap: '8px' } }, [
            h(ElButton, {
              'data-testid': `desktop-task-${task.id}`,
              round: true,
              onClick: () => activateDesktopTask(task),
            }, { default: () => '打开' }),
            h(ElButton, {
              'data-testid': `desktop-task-close-${task.id}`,
              size: 'small',
              round: true,
              onClick: (event) => {
                event.stopPropagation();
                closeDesktopTask(task);
              },
            }, { default: () => '关闭' }),
          ]),
        ]);
      }

      function TaskSwitcherOverlay() {
        if (!desktopTaskSwitcherOpen.value) return null;
        const tasks = desktopTasks.value;
        return h('div', {
          'data-testid': 'desktop-task-switcher',
          style: {
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(15, 23, 42, 0.22)',
            display: 'flex',
            justifyContent: 'flex-end',
          },
          onClick: () => setTaskSwitcherOpen(false),
        }, [
          h('div', {
            onClick: (event) => event.stopPropagation(),
          }, shellRenderer.renderVNode(buildTaskSwitcherShellAst(), {
            slots: {
              taskCards: () => (tasks.length === 0
                ? h('div', { style: { color: '#64748b', lineHeight: '1.6' } }, '暂无后台任务')
                : tasks.map((task) => renderTaskCard(task))),
            },
          })),
        ]);
      }

      function withTaskSwitcher(content) {
        return h('div', [
          content,
          h(TaskSwitcherOverlay),
        ]);
      }

      function currentReturnTo() {
        if (typeof window === 'undefined' || !window.location) return '/';
        return `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`;
      }

      function capabilityLabel(capability) {
        const labels = {
          'app:read': '只读',
          'app:write': '编辑',
          'workspace:read': '工作区只读',
          'workspace:write': '工作区编辑',
          'slide_app:use': '滑动 App',
          'matrix:connect': 'Matrix',
          'management_bus:use': '管理总线',
        };
        return labels[capability] || capability;
      }

      function authDisplayName() {
        const state = authStore && authStore.state ? authStore.state : {};
        return state.displayName || state.username || state.email || state.userId || 'Dongyu User';
      }

      function startSso(returnTo = currentReturnTo()) {
        if (authStore && typeof authStore.loginWithSso === 'function') {
          authStore.loginWithSso({ returnTo });
        }
      }

      function startMatrixSso() {
        if (authStore && typeof authStore.connectMatrix === 'function') {
          authStore.connectMatrix({ returnTo: currentReturnTo() });
        }
      }

      function disconnectMatrixSession() {
        if (authStore && typeof authStore.disconnectMatrix === 'function') {
          authStore.disconnectMatrix();
        }
      }

      function isMatrixChatForeground() {
        return Number(desktopForegroundApp.value?.model_id) === MATRIX_CHAT_APP_MODEL_ID;
      }

      function MatrixConnectionPanel() {
        if (path.value !== ROUTE_HOME) return null;
        if (!authStore || !authStore.state || !authStore.state.authenticated || !isMatrixChatForeground()) return null;
        const capabilities = Array.isArray(authStore.state.capabilities) ? authStore.state.capabilities : [];
        if (authStore.state.matrixConnected) return null;
        if (!capabilities.includes('matrix:connect')) return null;
        return h('div', {
          'data-testid': 'auth-matrix-required-panel',
          style: {
            margin: '0 16px 12px',
            border: '1px solid #bfdbfe',
            background: '#eff6ff',
            borderRadius: '14px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            color: '#1e3a8a',
          },
        }, [
          h('div', { style: { minWidth: 0 } }, [
            h('div', { style: { fontSize: '14px', fontWeight: 850 } }, 'Matrix 尚未连接'),
            h('div', {
              style: {
                marginTop: '3px',
                fontSize: '13px',
                lineHeight: 1.45,
                color: '#1d4ed8',
              },
            }, '当前列表是本地初始视图；连接 Matrix 后可刷新为你的远端会话。'),
          ]),
          h(ElButton, {
            'data-testid': 'auth-matrix-connect-primary',
            type: 'primary',
            size: 'small',
            onClick: startMatrixSso,
            style: { flexShrink: 0 },
          }, { default: () => '连接 Matrix' }),
        ]);
      }

      function AuthIssuePanel() {
        const issue = authIssue.value;
        if (!issue) return null;
        const isLogin = issue.kind === 'login_required';
        const title = isLogin ? '需要登录' : '权限不足';
        const detail = isLogin
          ? '登录后可以继续当前操作。'
          : `当前账号不能使用该操作${issue.requiredCapability ? `：${capabilityLabel(issue.requiredCapability)}` : ''}`;
        return h('div', {
          'data-testid': 'auth-permission-panel',
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            padding: '12px 16px',
            borderBottom: '1px solid #fecaca',
            background: '#fff7ed',
            color: '#7c2d12',
          },
        }, [
          h('div', { style: { minWidth: 0 } }, [
            h('div', { style: { fontSize: '14px', fontWeight: 800 } }, title),
            h('div', { style: { marginTop: '2px', fontSize: '13px', color: '#9a3412' } }, detail),
          ]),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 } }, [
            h(ElButton, {
              size: 'small',
              type: 'primary',
              onClick: () => startSso(issue.returnTo || currentReturnTo()),
            }, { default: () => (isLogin ? '登录' : '重新登录') }),
            h(ElButton, {
              size: 'small',
              text: true,
              onClick: () => {
                if (authStore && typeof authStore.clearAuthIssue === 'function') authStore.clearAuthIssue();
              },
            }, { default: () => '关闭' }),
          ]),
        ]);
      }

      function appLayout(content, options = {}) {
        const children = [h(Header), h(AuthIssuePanel), h(MatrixConnectionPanel)];
        if (options.divider) children.push(h(ElDivider, { style: { margin: '12px 0' } }));
        const isForeground = options.foreground === true;
        const contentOverflow = options.contentOverflow || (isForeground ? 'hidden' : 'auto');
        children.push(h('div', {
          'data-testid': isForeground ? 'foreground-content-slot' : 'app-content-slot',
          style: {
            flex: 1,
            minHeight: 0,
            overflow: contentOverflow,
          },
        }, content));
        return h('div', {
          'data-testid': isForeground ? 'foreground-app-layout' : 'app-layout',
          style: {
            height: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }, children);
      }

      function Header() {
        const catalog = readCatalog().filter((entry) => entry && entry.nav_visible === true && typeof entry.path === 'string');
        const navButtons = catalog.map((entry) => h(
          ElButton,
          {
            type: currentRouteEntry.value?.page === entry.page ? 'primary' : 'default',
            onClick: () => setHashPath(entry.path),
          },
          { default: () => entry.label || entry.page || entry.path },
        ));

        const userSection = [];
        if (authStore && authStore.state && authStore.state.sessionChecked !== true) {
          userSection.push(
            h(ElTag, {
              'data-testid': 'auth-session-checking-badge',
              effect: 'plain',
              type: 'info',
              round: true,
            }, { default: () => '确认登录中' }),
          );
        } else if (authStore && authStore.state && !authStore.state.authenticated) {
          userSection.push(
            h(ElTag, {
              'data-testid': 'auth-readonly-badge',
              effect: 'plain',
              type: 'info',
              round: true,
            }, { default: () => '访客只读' }),
            h(ElButton, {
              'data-testid': 'auth-login-button',
              type: 'primary',
              size: 'small',
              onClick: () => startSso(),
            }, { default: () => '登录' }),
          );
        } else if (authStore && authStore.state && authStore.state.authenticated) {
          const capabilities = Array.isArray(authStore.state.capabilities) ? authStore.state.capabilities : [];
          const roles = Array.isArray(authStore.state.roles) ? authStore.state.roles : [];
          const canUseMatrix = capabilities.includes('matrix:connect');
          const matrixStatusText = authStore.state.matrixConnected
            ? `Matrix：已连接${authStore.state.matrixUserId ? ` · ${authStore.state.matrixUserId}` : ''}`
            : 'Matrix：未连接';
          const matrixActions = [];
          if (canUseMatrix && !authStore.state.matrixConnected) {
            matrixActions.push(h(ElDropdownItem, {
              'data-testid': 'auth-matrix-connect-button',
              divided: true,
              onClick: startMatrixSso,
            }, { default: () => '连接 Matrix' }));
          }
          if (canUseMatrix && authStore.state.matrixConnected) {
            matrixActions.push(h(ElDropdownItem, {
              'data-testid': 'auth-matrix-disconnect-button',
              divided: true,
              onClick: disconnectMatrixSession,
            }, { default: () => '断开 Matrix' }));
          }
          userSection.push(
            h(ElDropdown, {
              trigger: 'click',
              placement: 'bottom-end',
            }, {
              default: () => h(ElButton, {
                'data-testid': 'auth-user-menu',
                size: 'small',
                round: true,
                title: authDisplayName(),
                style: {
                  maxWidth: '220px',
                  minWidth: '0',
                  overflow: 'hidden',
                },
              }, {
                default: () => h('span', {
                  style: {
                    display: 'block',
                    maxWidth: '180px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                }, authDisplayName()),
              }),
              dropdown: () => h(ElDropdownMenu, null, {
                default: () => [
                  h(ElDropdownItem, { disabled: true }, {
                    default: () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '220px' } }, [
                      h('strong', { style: { color: '#111827' } }, authDisplayName()),
                      h('span', { style: { color: '#64748b', fontSize: '12px' } }, authStore.state.email || authStore.state.userId || authStore.state.subject || ''),
                    ]),
                  }),
                  h(ElDropdownItem, { disabled: true, divided: true }, {
                    default: () => `权限：${capabilities.length > 0 ? capabilities.slice(0, 4).map(capabilityLabel).join(' / ') : '只读'}`,
                  }),
                  h(ElDropdownItem, { disabled: true }, {
                    default: () => `角色：${roles.length > 0 ? roles.slice(0, 3).join(' / ') : '未声明'}`,
                  }),
                  h(ElDropdownItem, { disabled: true }, {
                    default: () => matrixStatusText,
                  }),
                  ...matrixActions,
                  h(ElDropdownItem, {
                    'data-testid': 'auth-logout-button',
                    divided: matrixActions.length === 0,
                    onClick: () => {
                      authStore.logout().then((result) => {
                        if (result && result.logoutUrl) return null;
                        if (mainStore && typeof mainStore.refreshSnapshot === 'function') {
                          return mainStore.refreshSnapshot('logout');
                        }
                        if (mainStore && typeof mainStore.setRoutePath === 'function') {
                          mainStore.setRoutePath(path.value);
                        }
                        return null;
                      });
                    },
                  }, { default: () => '退出登录' }),
                ],
              }),
            }),
          );
        }

        if (navButtons.length === 0 && userSection.length === 0 && !authStore) {
          return null;
        }

        return h('div', {
          style: {
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          },
        }, [
          h(ElSpace, { wrap: true }, { default: () => navButtons }),
          userSection.length > 0
            ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' } }, userSection)
            : null,
        ]);
      }

      return () => {
        if (desktopForegroundApp.value && path.value === ROUTE_HOME) {
          return withTaskSwitcher(appLayout(h(ForegroundPlayer), { foreground: true }));
        }
        if (currentRouteEntry.value?.page === 'gallery') {
          return withTaskSwitcher(appLayout(h(GalleryRoot)));
        }
        if (routeSyncState.value.pending) {
          return withTaskSwitcher(appLayout(h('div', {
              style: {
                padding: '24px 16px',
              },
            }, [
              h('div', {
                style: {
                  maxWidth: '960px',
                  margin: '0 auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '24px',
                  background: '#fff',
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
                },
              }, [
                h('div', { style: { fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' } }, '页面同步中'),
                h('div', { style: { color: '#475569', lineHeight: '1.6' } }, `正在切换到 ${routeSyncState.value.targetPage}，等待本地表状态完成同步。`),
              ]),
            ]),
          ));
        }
        if (currentRouteEntry.value && currentRouteEntry.value.page !== 'gallery') {
          return withTaskSwitcher(appLayout(h(HomeRoot)));
        }
        return withTaskSwitcher(appLayout(h(HomeRoot), { divider: true }));
      };
    },
  };
}
