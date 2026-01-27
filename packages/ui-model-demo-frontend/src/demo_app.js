import { computed, h, resolveComponent } from 'vue';
import { createRenderer } from '@ui-renderer/index.mjs';

export function createDemoRoot(store) {
  const host = {
    getSnapshot: () => store.snapshot,
    dispatchAddLabel: store.dispatchAddLabel,
    dispatchRmLabel: store.dispatchRmLabel,
  };
  const renderer = createRenderer({ host, vue: { h, resolveComponent } });

  return {
    name: 'DemoRoot',
    setup() {
      const ast = computed(() => store.getUiAst());
      return () => {
        if (!ast.value) {
          return h('div', 'No UI AST');
        }
        return renderer.renderVNode(ast.value);
      };
    },
  };
}
