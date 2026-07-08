const DOCUMENTED_SYS_MSG_TYPES = new Set([
  'resource.report',
  'resource.request',
  'resource.result',
  'data.save_modeltable',
  'data.load_modeltable',
  'data.save_flow',
  'data.load_flow',
  'ui.update_data',
  'ui.tmp_data',
  'ui.form_data',
  'ui.refresh_data',
  'task_data',
]);

const DOCUMENTED_TASK_PINS = new Set([
  'add_task',
  'add_task_return',
  'edit_task',
  'delete_task',
  'receive_task',
  'finish_task',
  'archive_task',
]);

const MESSAGE_SERVERS = new Set(['local', 'global']);
const BETWEEN_KINDS = new Set(['WSM_DEM', 'DEM_V1N']);

function recordId(record) {
  return record && Object.prototype.hasOwnProperty.call(record, 'id')
    ? String(record.id)
    : '';
}

function isRecord(record) {
  return record
    && typeof record === 'object'
    && (typeof record.id === 'string' || Number.isInteger(record.id))
    && Number.isInteger(record.p)
    && Number.isInteger(record.r)
    && Number.isInteger(record.c)
    && typeof record.k === 'string'
    && record.k
    && typeof record.t === 'string'
    && record.t
    && Object.prototype.hasOwnProperty.call(record, 'v');
}

function findLabel(records, id, p, r, c, key) {
  const targetId = String(id);
  return records.find((record) => (
    recordId(record) === targetId
    && record.p === p
    && record.r === r
    && record.c === c
    && record.k === key
  )) || null;
}

function labelValue(records, id, p, r, c, key) {
  const label = findLabel(records, id, p, r, c, key);
  return label ? label.v : undefined;
}

function labelValueFromCells(records, id, cells, key) {
  for (const cell of cells) {
    const value = labelValue(records, id, cell.p, cell.r, cell.c, key);
    if (value !== undefined) return value;
  }
  return undefined;
}

function isNonBlankString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function endpointPinName(value) {
  if (!isNonBlankString(value)) return '';
  const parts = value.split('/').map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : value.trim();
}

function findLabelAnyCell(records, id, key) {
  const targetId = String(id);
  return records.find((record) => recordId(record) === targetId && record.k === key) || null;
}

function payloadFields(records, id) {
  const targetId = String(id);
  const skipKeys = new Set(['model_type', 'model_name', 'sys_msg_type']);
  const fields = {};
  for (const record of records) {
    if (recordId(record) !== targetId || skipKeys.has(record.k)) continue;
    fields[record.k] = record.v;
  }
  return fields;
}

function hasRequiredField(records, id, field) {
  const label = findLabelAnyCell(records, id, field.key);
  if (!label) return false;
  if (field.type === 'str') return label.t === 'str' && isNonBlankString(label.v);
  if (field.type === 'int') return label.t === 'int' && Number.isInteger(label.v);
  if (field.type === 'bool') return label.t === 'bool' && typeof label.v === 'boolean';
  return true;
}

function validateTaskPayloadFields(records, payloadTableId, taskPin) {
  const requirements = {
    add_task: [
      { key: 'title', type: 'str' },
      { key: 'body', type: 'str' },
      { key: 'publisher', type: 'str' },
      { key: 'publish_time', type: 'str' },
    ],
    add_task_return: [
      { key: 'id', type: 'int' },
      { key: 'title', type: 'str' },
      { key: 'body', type: 'str' },
      { key: 'publisher', type: 'str' },
      { key: 'publish_time', type: 'str' },
    ],
    edit_task: [
      { key: 'id', type: 'int' },
    ],
    delete_task: [
      { key: 'id', type: 'int' },
    ],
    receive_task: [
      { key: 'id', type: 'int' },
      { key: 'receive_time', type: 'str' },
      { key: 'receiver', type: 'str' },
    ],
    finish_task: [
      { key: 'id', type: 'int' },
      { key: 'end_time', type: 'str' },
      { key: 'is_success', type: 'bool' },
    ],
    archive_task: [
      { key: 'id', type: 'int' },
      { key: 'archive_time', type: 'str' },
      { key: 'review', type: 'str' },
    ],
  };
  for (const field of requirements[taskPin] || []) {
    if (!hasRequiredField(records, payloadTableId, field)) {
      return fail(`missing_task_field:${field.key}`);
    }
  }
  return { ok: true };
}

function fail(code, detail = {}) {
  return { ok: false, code, ...detail };
}

export function isDocumentedFeishuSysMsgType(value) {
  return typeof value === 'string' && DOCUMENTED_SYS_MSG_TYPES.has(value);
}

export function documentedFeishuSysMsgTypes() {
  return [...DOCUMENTED_SYS_MSG_TYPES];
}

export function isDocumentedFeishuTaskPin(value) {
  return typeof value === 'string' && DOCUMENTED_TASK_PINS.has(value);
}

export function documentedFeishuTaskPins() {
  return [...DOCUMENTED_TASK_PINS];
}

export function feishuEndpointPinName(value) {
  return endpointPinName(value);
}

export function parseFeishuPinPayloadV1(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return fail('invalid_records');
  }
  if (!records.every(isRecord)) {
    return fail('invalid_record_shape');
  }

  const messageRoot = findLabel(records, '0', 0, 0, 0, 'model_type');
  if (!messageRoot || messageRoot.t !== 'model.subtable') {
    return fail('invalid_message_root');
  }

  const versionCell = findLabel(records, '0', 0, 0, 1, 'model_type');
  if (!versionCell || versionCell.t !== 'model.single') {
    return fail('invalid_message_version_cell');
  }

  const kind = findLabel(records, '0', 0, 0, 1, '__mt_payload_kind');
  if (!kind || kind.t !== 'str' || kind.v !== 'pin_payload.v1') {
    return fail('invalid_payload_kind');
  }

  const responseFlag = findLabel(records, '0', 0, 0, 1, 'is_need_response');
  if (!responseFlag || responseFlag.t !== 'bool' || typeof responseFlag.v !== 'boolean') {
    return fail('invalid_is_need_response');
  }

  const routeKind = labelValue(records, '0', 0, 1, 0, 'route_kind');
  if (routeKind !== 'control' && routeKind !== 'manage') {
    return fail('invalid_route_kind');
  }

  const busCell = findLabel(records, '0', 0, 1, 0, 'model_type');
  if (!busCell || busCell.t !== 'model.matrix') {
    return fail('invalid_bus_cell');
  }

  const originPin = labelValue(records, '0', 0, 1, 0, 'origin_pin');
  const endpointPin = labelValue(records, '0', 0, 1, 0, 'endpoint_pin');
  const responsePin = labelValue(records, '0', 0, 1, 0, 'response_pin');
  if (typeof originPin !== 'string' || !originPin.trim()) return fail('invalid_origin_pin');
  if (typeof endpointPin !== 'string' || !endpointPin.trim()) return fail('invalid_endpoint_pin');
  if (responseFlag.v === true && (typeof responsePin !== 'string' || !responsePin.trim())) {
    return fail('invalid_response_pin');
  }

  const messageServer = labelValue(records, '0', 0, 1, 1, 'message_server');
  if (messageServer !== undefined && !MESSAGE_SERVERS.has(messageServer)) {
    return fail('invalid_message_server', { messageServer });
  }
  const between = labelValue(records, '0', 0, 1, 1, 'between');
  if (between !== undefined && !BETWEEN_KINDS.has(between)) {
    return fail('invalid_between', { between });
  }
  const userCells = [
    { p: 0, r: 1, c: 2 },
    { p: 0, r: 1, c: 1 },
  ];
  const sendUser = labelValueFromCells(records, '0', userCells, 'send_user');
  const receiveUser = labelValueFromCells(records, '0', userCells, 'receive_user');
  if (routeKind === 'manage') {
    if (!isNonBlankString(sendUser)) return fail('invalid_send_user');
    if (!isNonBlankString(receiveUser)) return fail('invalid_receive_user');
  }

  const subtableConnection = findLabel(records, '0', 0, 2, 0, 'model_type');
  if (
    !subtableConnection
    || subtableConnection.t !== 'model.subtableconnection'
    || !Number.isInteger(subtableConnection.v)
    || subtableConnection.v <= 0
  ) {
    return fail('invalid_payload_subtableconnection');
  }

  const payloadTableId = `0.${subtableConnection.v}`;
  const payloadRecords = records.filter((record) => recordId(record) === payloadTableId);
  if (payloadRecords.length === 0) {
    return fail('missing_payload_records', { payloadTableId });
  }

  const payloadRoot = findLabel(records, payloadTableId, 0, 0, 0, 'model_type');
  if (!payloadRoot || payloadRoot.t !== 'model.subtable') {
    return fail('invalid_payload_root', { payloadTableId });
  }

  const sysMsgType = labelValue(records, payloadTableId, 0, 0, 0, 'sys_msg_type');
  if (sysMsgType !== undefined && !isDocumentedFeishuSysMsgType(sysMsgType)) {
    return fail('unknown_sys_msg_type', { sysMsgType });
  }
  const taskPin = sysMsgType === 'task_data' ? endpointPinName(endpointPin) : '';
  if (sysMsgType === 'task_data' && !isDocumentedFeishuTaskPin(taskPin)) {
    return fail('unknown_task_pin', { taskPin });
  }
  if (sysMsgType === 'task_data') {
    const taskFields = validateTaskPayloadFields(records, payloadTableId, taskPin);
    if (!taskFields.ok) return taskFields;
  }

  return {
    ok: true,
    kind: 'pin_payload.v1',
    isNeedResponse: responseFlag.v,
    routeKind,
    originPin,
    endpointPin,
    endpointPinName: endpointPinName(endpointPin),
    responsePin: responsePin || '',
    messageServer: messageServer || '',
    between: between || '',
    sendUser: sendUser || '',
    receiveUser: receiveUser || '',
    payloadTableId,
    payloadRecords,
    payloadFields: payloadFields(records, payloadTableId),
    sysMsgType: sysMsgType || '',
    taskPin,
  };
}
