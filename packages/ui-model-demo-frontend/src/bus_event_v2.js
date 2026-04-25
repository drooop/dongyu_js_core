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

function mtPayloadRecord(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function isCellCoord(value) {
  return value
    && typeof value === 'object'
    && Number.isInteger(value.p)
    && Number.isInteger(value.r)
    && Number.isInteger(value.c);
}

function payloadLabel(payload, key) {
  return Array.isArray(payload)
    ? payload.find((record) => record && record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === key) || null
    : null;
}

function isTemporaryPayloadRecordArray(value) {
  return Array.isArray(value) && value.every((record) =>
    record
    && typeof record === 'object'
    && Number.isInteger(record.id)
    && Number.isInteger(record.p)
    && Number.isInteger(record.r)
    && Number.isInteger(record.c)
    && typeof record.k === 'string'
    && record.k.length > 0
    && typeof record.t === 'string'
    && record.t.length > 0
  );
}

export function isValidBusEventV2PayloadArray(value) {
  if (!isTemporaryPayloadRecordArray(value)) return false;
  const kind = payloadLabel(value, '__mt_payload_kind');
  if (kind && kind.t === 'str' && kind.v === 'write_label.v1') {
    const targetCell = payloadLabel(value, '__mt_target_cell');
    if (!targetCell || targetCell.t !== 'json' || !isCellCoord(targetCell.v)) return false;
  }
  return true;
}

export function buildWriteLabelPayloadValue({
  targetCell,
  targetPin,
  value,
  requestId,
  fromCell = { p: 0, r: 0, c: 0 },
}) {
  if (!isCellCoord(targetCell) || !isCellCoord(fromCell) || typeof targetPin !== 'string' || !targetPin.trim()) {
    return null;
  }
  return [
    mtPayloadRecord('__mt_payload_kind', 'str', 'write_label.v1'),
    mtPayloadRecord('__mt_request_id', 'str', requestId || `bus_v2_${Date.now()}_${Math.random().toString(16).slice(2)}`),
    mtPayloadRecord('__mt_from_cell', 'json', {
      p: fromCell.p,
      r: fromCell.r,
      c: fromCell.c,
    }),
    mtPayloadRecord('__mt_target_cell', 'json', {
      p: targetCell.p,
      r: targetCell.r,
      c: targetCell.c,
    }),
    mtPayloadRecord(targetPin.trim(), 'pin.in', value ?? null),
  ];
}

export function normalizeBusEventV2ValueToPinPayload(value, meta = null) {
  void meta;
  if (Array.isArray(value)) return isValidBusEventV2PayloadArray(value) ? value : { error: 'invalid_bus_payload' };
  return { error: 'invalid_bus_payload' };
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
