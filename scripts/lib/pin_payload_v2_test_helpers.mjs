export const DEFAULT_TOPIC_BASE = 'UIPUT/ws/dam/pic/de';

export function mt(k, t, v, id = 0) {
  return { id, p: 0, r: 0, c: 0, k, t, v };
}

export function tableMt(k, t, v, payloadModelId = 1) {
  return mt(k, t, v, payloadModelId);
}

export function pinPayloadV2Records({
  opId = `pin_payload_v2_${Date.now()}`,
  messageRole = 'request',
  endpointWorkerId = 'R1',
  endpointModelId = 100,
  endpointPin = 'submit',
  topic = `${DEFAULT_TOPIC_BASE}/${endpointWorkerId}/${endpointModelId}/${endpointPin}`,
  responseTopic = null,
  routeKind = 'control',
  originWorkerId = 'ui-server-test',
  endpointTableId = 'host',
  originModelId = endpointModelId,
  originPin = endpointPin,
  originTableId = 'host',
  replyTargetWorkerId = 'ui-server-test',
  replyTargetModelId = endpointModelId,
  replyTargetPin = 'result',
  replyTargetTableId = 'host',
  replyTargetPrincipalKey = '',
  payloadModelId = 1,
  payloadRecords = [],
  extraRecords = [],
  timestamp = 1700000000000,
} = {}) {
  const actualResponseTopic = responseTopic || `${DEFAULT_TOPIC_BASE}/${replyTargetWorkerId}/${replyTargetModelId}/${replyTargetPin}`;
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v2'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', messageRole),
    mt('topic', 'str', topic),
    mt('response_topic', 'str', actualResponseTopic),
    mt('route_kind', 'str', routeKind),
    mt('bus', 'str', routeKind),
    mt('endpoint_worker_id', 'str', endpointWorkerId),
    mt('endpoint_table_id', 'str', endpointTableId),
    mt('endpoint_model_id', 'int', endpointModelId),
    mt('endpoint_pin', 'str', endpointPin),
    mt('origin_worker_id', 'str', originWorkerId),
    mt('origin_table_id', 'str', originTableId),
    mt('origin_model_id', 'int', originModelId),
    mt('origin_pin', 'str', originPin),
    mt('reply_target_worker_id', 'str', replyTargetWorkerId),
    mt('reply_target_table_id', 'str', replyTargetTableId),
    mt('reply_target_model_id', 'int', replyTargetModelId),
    mt('reply_target_pin', 'str', replyTargetPin),
    ...(replyTargetPrincipalKey ? [mt('reply_target_principal_key', 'str', replyTargetPrincipalKey)] : []),
    mt('payload_model_id', 'int', payloadModelId),
    mt('timestamp', 'int', timestamp),
    ...payloadRecords.map((record) => ({ ...record, id: payloadModelId })),
    ...extraRecords,
  ];
}

export function externalPacket(records) {
  return { version: 'v1', type: 'pin_payload', payload: records };
}

export function payloadValue(records, key, id = 0) {
  return Array.isArray(records)
    ? records.find((record) => record && record.id === id && record.k === key)?.v
    : undefined;
}

export function payloadRecords(records) {
  const payloadModelId = payloadValue(records, 'payload_model_id');
  return Number.isInteger(payloadModelId)
    ? records.filter((record) => record && record.id === payloadModelId)
    : [];
}
