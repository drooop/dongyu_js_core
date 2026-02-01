function isMgmtBusEventV0(event) {
  if (!event || typeof event !== 'object') return false;
  if (event.version !== 'v0') return false;
  if (typeof event.type !== 'string' || event.type.length === 0) return false;
  if (typeof event.op_id !== 'string' || event.op_id.length === 0) return false;
  if (event.payload === undefined) return false;
  return true;
}

function assertMgmtBusEventV0(event) {
  if (!isMgmtBusEventV0(event)) {
    throw new Error('invalid_mgmt_bus_event_v0');
  }
}

module.exports = {
  isMgmtBusEventV0,
  assertMgmtBusEventV0,
};
