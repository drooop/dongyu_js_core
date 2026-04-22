import { computed, h, onBeforeUnmount, onMounted, ref, resolveComponent, watch } from 'vue';
import { createRenderer } from '@ui-renderer/index.mjs';
import { readAppShellRouteSyncState, resolveNavigableRoutePath } from './app_shell_route_sync.js';
import { findPageEntryByPath, readPageCatalog } from './page_asset_resolver.js';

import {
  ROUTE_HOME,
  ROUTE_MODEL100,
  ROUTE_WORKSPACE,
  getHashPath,
  isModel100Path,
  setHashPath,
  subscribeHashPath,
} from './router.js';
import { buildBusDispatchLabel, buildBusEventV2 } from './bus_event_v2.js';

export function createDemoRoot(store) {
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
        return store.getUiAst();
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
        return renderer.renderVNode(ast.value);
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
        if (!mainStore || typeof mainStore.dispatchAddLabel !== 'function') return;
        mainStore.dispatchAddLabel(buildBusDispatchLabel(buildBusEventV2({
          busInKey: 'ui_edit',
          value: {
            action: 'label_update',
            target: { model_id: -2, p: 0, r: 0, c: 0, k: 'ws_app_selected' },
            value: { t: 'int', v: modelId },
          },
        })));
      }

      function syncPageLabel(routePath) {
        const page = findRouteEntry(routePath)?.page || 'home';
        try {
          if (!mainStore || typeof mainStore.dispatchAddLabel !== 'function') return;
          const opId = `route_${Date.now()}_${Math.random().toString(16).slice(2)}`;
          const envelope = {
            action: 'label_update',
            meta: { op_id: opId },
            target: { model_id: -2, p: 0, r: 0, c: 0, k: 'ui_page' },
            value: { t: 'str', v: page },
          };
          mainStore.dispatchAddLabel(buildBusDispatchLabel(buildBusEventV2({
            busInKey: 'ui_edit',
            value: envelope,
            opId,
          })));
          if (typeof mainStore.consumeOnce === 'function') {
            queueMicrotask(() => mainStore.consumeOnce());
          }
        } catch (_) {
          // ignore
        }
      }

      function syncWorkspaceSelection(routePath) {
        const page = findRouteEntry(routePath)?.page || 'home';
        if (page !== 'workspace') return;
        queueMicrotask(() => {
          selectWorkspaceModel(resolveWorkspaceModelId());
        });
      }

      function syncGalleryRoute(routePath) {
        if (galleryStore && typeof galleryStore.setRoutePath === 'function') {
          galleryStore.setRoutePath(routePath);
        }
      }

      function clearGalleryNavTarget() {
        if (!mainStore || typeof mainStore.dispatchAddLabel !== 'function') return;
        const opId = `gallery_nav_clear_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const envelope = {
          action: 'label_update',
          meta: { op_id: opId },
          target: { model_id: -102, p: 0, r: 0, c: 0, k: 'nav_to' },
          value: { t: 'str', v: '' },
        };
        mainStore.dispatchAddLabel(buildBusDispatchLabel(buildBusEventV2({
          busInKey: 'ui_edit',
          value: envelope,
          opId,
        })));
        if (typeof mainStore.consumeOnce === 'function') {
          queueMicrotask(() => mainStore.consumeOnce());
        }
      }

      onMounted(() => {
        normalizeIfUnknown(path.value);
        if (mainStore && typeof mainStore.setRoutePath === 'function') {
          mainStore.setRoutePath(path.value);
        }
        syncGalleryRoute(path.value);
        syncPageLabel(path.value);
        syncWorkspaceSelection(path.value);
        unsubscribe = subscribeHashPath((next) => {
          path.value = next;
          normalizeIfUnknown(next);
          if (mainStore && typeof mainStore.setRoutePath === 'function') {
            mainStore.setRoutePath(path.value);
          }
          syncGalleryRoute(next);
          syncPageLabel(next);
          syncWorkspaceSelection(next);
        });
      });

      onBeforeUnmount(() => {
        if (unsubscribe) unsubscribe();
      });

      const currentRouteEntry = computed(() => findRouteEntry(path.value));
      const routeSyncState = computed(() => readAppShellRouteSyncState(mainStore?.snapshot ?? {}, path.value));
      const galleryNavTarget = computed(() => {
        const labels = mainStore?.snapshot?.models?.['-102']?.cells?.['0,0,0']?.labels ?? {};
        const raw = labels.nav_to?.v;
        return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : '';
      });

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
        if (currentRouteEntry.value?.page === 'gallery') {
          return h('div', [h(Header), h(GalleryRoot)]);
        }
        if (routeSyncState.value.pending) {
          return h('div', [
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
          ]);
        }
        if (currentRouteEntry.value && currentRouteEntry.value.page !== 'gallery') {
          return h('div', [h(Header), h(HomeRoot)]);
        }
        return h('div', [
          h(Header),
          h(ElDivider, { style: { margin: '12px 0' } }),
          h(HomeRoot),
        ]);
      };
    },
  };
}
