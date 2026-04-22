export function buildBusEventV2({ busInKey, value, opId, source = 'ui_renderer' }) {
  return {
    type: 'bus_event_v2',
    bus_in_key: busInKey,
    value,
    meta: {
      op_id: opId || `bus_v2_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      source,
    },
  };
}

export function buildBusDispatchLabel(envelope) {
  return {
    p: 0,
    r: 0,
    c: 0,
    k: 'bus_in_event',
    t: 'event',
    v: envelope,
  };
}
