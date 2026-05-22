import { computed, h, onBeforeUnmount, onMounted, ref, resolveComponent, watch } from 'vue';
import { createRenderer } from '@ui-renderer/index.mjs';
import { readAppShellRouteSyncState, resolveNavigableRoutePath } from './app_shell_route_sync.js';
import { dispatchAppShellStateUpdate } from './app_shell_state_dispatch.js';
import { buildFocusedWorkspaceAppContentAst } from './desktop_focused_app_content.js';
import { buildForegroundShellAst } from './desktop_foreground_shell_ast.js';
import { findPageEntryByPath, readPageCatalog } from './page_asset_resolver.js';
import {
  DESKTOP_FOREGROUND_APP_LABEL,
  DESKTOP_TASK_STACK_LABEL,
  DESKTOP_TASK_SWITCHER_OPEN_LABEL,
  readDesktopForegroundApp,
  readDesktopTaskStack,
  readDesktopTaskSwitcherOpen,
  removeDesktopTaskFromStack,
} from './desktop_app_state.js';

import {
  ROUTE_HOME,
  getHashPath,
  setHashPath,
  subscribeHashPath,
} from './router.js';

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
        return store.stageOverlayValue(payload);
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
          const hint = [
            'No UI AST.',
            'If you are using Vite (5173) with remote server (9000), start the backend with CORS enabled:',
            '  CORS_ORIGIN=http://127.0.0.1:5173 bun packages/ui-model-demo-server/server.mjs',
            'Or open the backend-served UI directly:',
            '  http://127.0.0.1:9000/#/',
          ].join('\n');
          return h('pre', { style: { padding: '12px', whiteSpace: 'pre-wrap' } }, hint);
        }
        const slots = typeof options.slots === 'function' ? options.slots() : options.slots;
        return renderer.renderVNode(ast.value, slots && typeof slots === 'object' ? { slots } : undefined);
      };
    },
  };
}

export function createAppShell({ mainStore, galleryStore, authStore }) {
  const HomeRoot = createDemoRoot(mainStore);
  const GalleryRoot = createDemoRoot(galleryStore);

  return {
    name: 'AppShell',
    setup() {
      const ElButton = resolveComponent('ElButton');
      const ElDivider = resolveComponent('ElDivider');
      const ElSpace = resolveComponent('ElSpace');
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
              return mainStore.stageOverlayValue(payload);
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
      const desktopForegroundApp = computed(() => readDesktopForegroundApp(mainStore?.snapshot ?? {}));
      const ForegroundRouteRoot = createDemoRoot(mainStore, {
        routePath: () => desktopForegroundApp.value?.path || '/',
      });
      const desktopForegroundKey = computed(() => JSON.stringify(desktopForegroundApp.value || null));
      const desktopTasks = computed(() => readDesktopTaskStack(mainStore?.snapshot ?? {}));
      const desktopTaskSwitcherOpen = computed(() => readDesktopTaskSwitcherOpen(mainStore?.snapshot ?? {}));
      const galleryNavTarget = computed(() => {
        const labels = mainStore?.snapshot?.models?.['-102']?.cells?.['0,0,0']?.labels ?? {};
        const raw = labels.nav_to?.v;
        return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : '';
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
        const nextStack = removeDesktopTaskFromStack(desktopTasks.value, task.id);
        dispatchAppShellStateUpdate(mainStore, {
          target: { model_id: -2, p: 0, r: 0, c: 0, k: DESKTOP_TASK_STACK_LABEL },
          value: { t: 'json', v: nextStack },
        });
        if (desktopForegroundApp.value?.id === task.id) {
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
        if (authStore && authStore.state && authStore.state.authenticated) {
          userSection.push(
            h('span', { style: { fontSize: '13px', color: '#606266' } }, authStore.state.userId),
            h(ElButton, {
              size: 'small',
              onClick: () => {
                authStore.logout().then(() => { window.location.reload(); });
              },
            }, { default: () => 'Logout' }),
          );
        }

        if (navButtons.length === 0 && userSection.length === 0) {
          return null;
        }

        return h('div', {
          style: {
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
        }, [
          h(ElSpace, { wrap: true }, { default: () => navButtons }),
          userSection.length > 0
            ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, userSection)
            : null,
        ]);
      }

      return () => {
        if (desktopForegroundApp.value && path.value === ROUTE_HOME) {
          return withTaskSwitcher(h(ForegroundPlayer));
        }
        if (currentRouteEntry.value?.page === 'gallery') {
          return withTaskSwitcher(h('div', [h(Header), h(GalleryRoot)]));
        }
        if (routeSyncState.value.pending) {
          return withTaskSwitcher(h('div', [
            h(Header),
            h('div', {
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
          ]));
        }
        if (currentRouteEntry.value && currentRouteEntry.value.page !== 'gallery') {
          return withTaskSwitcher(h('div', [h(Header), h(HomeRoot)]));
        }
        return withTaskSwitcher(h('div', [
          h(Header),
          h(ElDivider, { style: { margin: '12px 0' } }),
          h(HomeRoot),
        ]));
      };
    },
  };
}
