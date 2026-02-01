import { computed, h, onBeforeUnmount, onMounted, ref, resolveComponent } from 'vue';
import { createRenderer } from '@ui-renderer/index.mjs';
import { buildGalleryAst } from './gallery_model.js';
import {
  ROUTE_GALLERY,
  ROUTE_HOME,
  ROUTE_DOCS,
  ROUTE_PIN,
  ROUTE_STATIC,
  ROUTE_TEST,
  getHashPath,
  isDocsPath,
  isGalleryPath,
  isHomePath,
  isPinPath,
  isStaticPath,
  isTestPath,
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
    dispatchAddLabel: (label) => {
      store.dispatchAddLabel(label);
      scheduleConsumeOnce();
    },
    dispatchRmLabel: (labelRef) => {
      store.dispatchRmLabel(labelRef);
      scheduleConsumeOnce();
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

export function createAppShell({ mainStore, galleryStore }) {
  const HomeRoot = createDemoRoot(mainStore);
  const GalleryRoot = createDemoRoot(galleryStore);
  const GalleryRemoteRoot = createDemoRoot({
    ...mainStore,
    getUiAst: () => buildGalleryAst(),
  });
  const PinRoot = createDemoRoot(mainStore);
  const TestRoot = createDemoRoot(mainStore);

  return {
    name: 'AppShell',
    setup() {
      const ElButton = resolveComponent('ElButton');
      const ElDivider = resolveComponent('ElDivider');
      const ElSpace = resolveComponent('ElSpace');
      const path = ref(getHashPath());
      let unsubscribe = null;

      function normalizeIfUnknown(p) {
        if (isHomePath(p) || isGalleryPath(p) || isDocsPath(p) || isStaticPath(p) || isPinPath(p) || isTestPath(p)) return;
        setHashPath(ROUTE_HOME, { replace: true });
      }

      function syncPageLabel(routePath) {
        const page = isDocsPath(routePath)
          ? 'docs'
          : (isStaticPath(routePath)
            ? 'static'
            : (isHomePath(routePath)
              ? 'home'
              : (isPinPath(routePath)
                ? 'pin'
                : 'test')));
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

      onMounted(() => {
        normalizeIfUnknown(path.value);
        syncPageLabel(path.value);
        unsubscribe = subscribeHashPath((next) => {
          path.value = next;
          normalizeIfUnknown(next);
          syncPageLabel(next);
        });
      });

      onBeforeUnmount(() => {
        if (unsubscribe) unsubscribe();
      });

      const isGallery = computed(() => isGalleryPath(path.value));
      const isDocs = computed(() => isDocsPath(path.value));
      const isStatic = computed(() => isStaticPath(path.value));
      const isPin = computed(() => isPinPath(path.value));
      const isTest = computed(() => isTestPath(path.value));

      function Header() {
        return h('div', { style: { padding: '12px 16px', borderBottom: '1px solid #e5e7eb' } }, [
          h(ElSpace, { wrap: true }, {
            default: () => [
              h(ElButton, { type: isHomePath(path.value) ? 'primary' : 'default', onClick: () => setHashPath(ROUTE_HOME) }, { default: () => '首页' }),
              h('span', { style: { display: 'inline-block', width: '24px' } }, ''),
              h(ElButton, { type: isGalleryPath(path.value) ? 'primary' : 'default', onClick: () => setHashPath(ROUTE_GALLERY) }, { default: () => 'Gallery' }),
              h(ElButton, { type: isDocsPath(path.value) ? 'primary' : 'default', onClick: () => setHashPath(ROUTE_DOCS) }, { default: () => 'Docs' }),
              h(ElButton, { type: isStaticPath(path.value) ? 'primary' : 'default', onClick: () => setHashPath(ROUTE_STATIC) }, { default: () => 'Static' }),
              h(ElButton, { type: isPinPath(path.value) ? 'primary' : 'default', onClick: () => setHashPath(ROUTE_PIN) }, { default: () => 'PIN' }),
              h(ElButton, { type: isTestPath(path.value) ? 'primary' : 'default', onClick: () => setHashPath(ROUTE_TEST) }, { default: () => 'Test' }),
            ],
          }),
        ]);
      }

      return () => {
        if (isGallery.value) {
          // In remote mode, galleryStore uses its own local runtime and would diverge.
          // Render Gallery AST on top of the mainStore snapshot so edits to model -102 reflect.
          const isRemoteMode = !mainStore || !Object.prototype.hasOwnProperty.call(mainStore, 'runtime');
          return h('div', [h(Header), h(isRemoteMode ? GalleryRemoteRoot : GalleryRoot)]);
        }
        if (isDocs.value || isStatic.value) {
          return h('div', [h(Header), h(HomeRoot)]);
        }
        if (isPin.value) {
          return h('div', [h(Header), h(PinRoot)]);
        }
        if (isTest.value) {
          return h('div', [h(Header), h(TestRoot)]);
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
