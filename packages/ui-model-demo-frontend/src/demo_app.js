import { computed, h, onBeforeUnmount, onMounted, ref, resolveComponent } from 'vue';
import { createRenderer } from '@ui-renderer/index.mjs';
import { buildGalleryAst } from './gallery_model.js';
import { readAppShellRouteSyncState } from './app_shell_route_sync.js';

import {
  ROUTE_GALLERY,
  ROUTE_HOME,
  ROUTE_DOCS,
  ROUTE_MODEL100,
  ROUTE_PROMPT,
  ROUTE_STATIC,
  ROUTE_WORKSPACE,
  getHashPath,
  isDocsPath,
  isGalleryPath,
  isHomePath,
  isModel100Path,
  isPromptPath,
  isStaticPath,
  isWorkspacePath,
  setHashPath,
  subscribeHashPath,
} from './router.js';

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
  const GalleryRemoteRoot = createDemoRoot({
    ...mainStore,
    getUiAst: () => buildGalleryAst(),
  });

  return {
    name: 'AppShell',
    setup() {
      const ElButton = resolveComponent('ElButton');
      const ElDivider = resolveComponent('ElDivider');
      const ElSpace = resolveComponent('ElSpace');
      const path = ref(getHashPath());
      let unsubscribe = null;

      function normalizeIfUnknown(p) {
        if (isModel100Path(p)) {
          setHashPath(ROUTE_WORKSPACE, { replace: true });
          path.value = ROUTE_WORKSPACE;
          return;
        }
        if (isHomePath(p) || isGalleryPath(p) || isDocsPath(p) || isStaticPath(p) || isWorkspacePath(p) || isPromptPath(p)) return;
        setHashPath(ROUTE_HOME, { replace: true });
        path.value = ROUTE_HOME;
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
        const opId = `ws_sel_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        mainStore.dispatchAddLabel({
          p: 0, r: 0, c: 1, k: 'ui_event', t: 'event',
          v: {
            event_id: Date.now(), type: 'label_update', source: 'ui_renderer', ts: 0,
            payload: {
              action: 'label_update',
              meta: { op_id: opId },
              target: { model_id: -2, p: 0, r: 0, c: 0, k: 'ws_app_selected' },
              value: { t: 'int', v: modelId },
            },
          },
        });
      }

      function syncPageLabel(routePath) {
        let page = 'home';
        if (isDocsPath(routePath)) page = 'docs';
        else if (isStaticPath(routePath)) page = 'static';
        else if (isWorkspacePath(routePath)) page = 'workspace';
        else if (isPromptPath(routePath)) page = 'prompt';
        try {
          if (!mainStore || typeof mainStore.dispatchAddLabel !== 'function') return;
          const opId = `route_${Date.now()}_${Math.random().toString(16).slice(2)}`;
          const envelope = {
            event_id: Date.now(),
            type: 'label_update',
            source: 'ui_renderer',
            ts: 0,
            payload: {
              action: 'label_update',
              meta: { op_id: opId },
              target: { model_id: -2, p: 0, r: 0, c: 0, k: 'ui_page' },
              value: { t: 'str', v: page },
            },
          };
          mainStore.dispatchAddLabel({ p: 0, r: 0, c: 1, k: 'ui_event', t: 'event', v: envelope });
          if (typeof mainStore.consumeOnce === 'function') {
            queueMicrotask(() => mainStore.consumeOnce());
          }
        } catch (_) {
          // ignore
        }
      }

      function syncWorkspaceSelection(routePath) {
        if (!isWorkspacePath(routePath)) return;
        queueMicrotask(() => {
          selectWorkspaceModel(resolveWorkspaceModelId());
        });
      }

      onMounted(() => {
        normalizeIfUnknown(path.value);
        syncPageLabel(path.value);
        syncWorkspaceSelection(path.value);
        unsubscribe = subscribeHashPath((next) => {
          path.value = next;
          normalizeIfUnknown(next);
          syncPageLabel(next);
          syncWorkspaceSelection(next);
        });
      });

      onBeforeUnmount(() => {
        if (unsubscribe) unsubscribe();
      });

      const isGallery = computed(() => isGalleryPath(path.value));

      const isDocs = computed(() => isDocsPath(path.value));
      const isStatic = computed(() => isStaticPath(path.value));
      const isWorkspace = computed(() => isWorkspacePath(path.value));
      const isPrompt = computed(() => isPromptPath(path.value));
      const routeSyncState = computed(() => readAppShellRouteSyncState(mainStore?.snapshot ?? {}, path.value));

      function Header() {
        const navButtons = [
          h(ElButton, { type: isHomePath(path.value) ? 'primary' : 'default', onClick: () => setHashPath(ROUTE_HOME) }, { default: () => '首页' }),
          h('span', { style: { display: 'inline-block', width: '24px' } }, ''),
          h(ElButton, { type: isGalleryPath(path.value) ? 'primary' : 'default', onClick: () => setHashPath(ROUTE_GALLERY) }, { default: () => 'Gallery' }),
          h(ElButton, { type: isDocsPath(path.value) ? 'primary' : 'default', onClick: () => setHashPath(ROUTE_DOCS) }, { default: () => 'Docs' }),
          h(ElButton, { type: isStaticPath(path.value) ? 'primary' : 'default', onClick: () => setHashPath(ROUTE_STATIC) }, { default: () => 'Static' }),
          h(ElButton, { type: isWorkspacePath(path.value) ? 'primary' : 'default', onClick: () => setHashPath(ROUTE_WORKSPACE) }, { default: () => 'Workspace' }),
          h(ElButton, { type: isPromptPath(path.value) ? 'primary' : 'default', onClick: () => setHashPath(ROUTE_PROMPT) }, { default: () => 'Prompt' }),
        ];

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
        if (isGallery.value) {
          const isRemoteMode = !mainStore || !Object.prototype.hasOwnProperty.call(mainStore, 'runtime');
          return h('div', [h(Header), h(isRemoteMode ? GalleryRemoteRoot : GalleryRoot)]);
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
        if (isDocs.value || isStatic.value || isWorkspace.value || isPrompt.value) {
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
