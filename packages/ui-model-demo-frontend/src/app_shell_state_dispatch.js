function nextAppShellOpId() {
  return `shell_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function buildAppShellStateUpdateLabel(input) {
  const target = input && input.target;
  const value = input && input.value;
  const opId = (input && typeof input.opId === 'string' && input.opId.trim())
    ? input.opId.trim()
    : nextAppShellOpId();
  return {
    p: 0,
    r: 0,
    c: 1,
    k: 'ui_event',
    t: 'event',
    v: {
      event_id: Date.now(),
      type: 'label_update',
      source: 'ui_renderer',
      ts: 0,
      payload: {
        action: 'label_update',
        target,
        value,
        meta: { op_id: opId },
      },
    },
  };
}

export function dispatchAppShellStateUpdate(store, input) {
  if (!store || typeof store.dispatchAddLabel !== 'function') return null;
  const label = buildAppShellStateUpdateLabel(input);
  store.dispatchAddLabel(label);
  if (typeof store.consumeOnce === 'function') {
    return store.consumeOnce();
  }
  return null;
}
