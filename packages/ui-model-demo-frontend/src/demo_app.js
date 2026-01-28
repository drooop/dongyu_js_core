import { computed, h, resolveComponent } from 'vue';
import { createRenderer } from '@ui-renderer/index.mjs';

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
        if (!ast.value) {
          return h('div', 'No UI AST');
        }
        return renderer.renderVNode(ast.value);
      };
    },
  };
}
