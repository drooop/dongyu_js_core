import { createHash } from 'node:crypto';

export const DE_PIN_FLOW_EVIDENCE_MARKER = 'DE_PIN_FLOW_EVIDENCE';

const SCHEMA = 'de_pin_flow_evidence.v1';
const HASH_RE = /^[a-f0-9]{64}$/u;
const SAFE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SAFE_SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const SAFE_TABLE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/u;
const EVIDENCE_KEYS = Object.freeze([
  'schema',
  'ts',
  'producer',
  'stage',
  'request_id',
  'op_id',
  'message_role',
  'bus',
  'route_kind',
  'endpoint',
  'reply_target',
  'payload_sha256',
]);
const ENDPOINT_KEYS = Object.freeze(['table_id', 'model_id', 'pin']);
const PRODUCER_STAGES = Object.freeze({
  'ui-server': new Set([
    'control_outbound_attempt',
    'management_outbound_attempt',
    'validated_response_materialized',
  ]),
  mbr: new Set([
    'management_ingress',
    'control_forward',
    'control_response_ingress',
    'management_response_forward',
  ]),
  r1: new Set([
    'control_ingress',
    'model_dispatch',
    'control_response',
  ]),
});
const STAGE_ROLES = Object.freeze({
  control_outbound_attempt: 'request',
  management_outbound_attempt: 'request',
  validated_response_materialized: 'response',
  management_ingress: 'request',
  control_forward: 'request',
  control_response_ingress: 'response',
  management_response_forward: 'response',
  control_ingress: 'request',
  model_dispatch: 'request',
  control_response: 'response',
});

function canonicalJson(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new TypeError('invalid_pin_flow_packet');
    return encoded;
  }
  if (seen.has(value)) throw new TypeError('invalid_pin_flow_packet');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => canonicalJson(entry, seen)).join(',')}]`;
    }
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key], seen)}`)
      .join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

function sha256(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isRecord(value) {
  return exactKeys(value, ['id', 'p', 'r', 'c', 'k', 't', 'v'])
    && Number.isInteger(value.id)
    && Number.isInteger(value.p)
    && Number.isInteger(value.r)
    && Number.isInteger(value.c)
    && typeof value.k === 'string'
    && value.k.length > 0
    && typeof value.t === 'string'
    && value.t.length > 0;
}

function metadataRecord(records, key) {
  const matches = records.filter((record) => record.id === 0
    && record.p === 0
    && record.r === 0
    && record.c === 0
    && record.k === key);
  return matches.length === 1 ? matches[0] : null;
}

function metadataString(records, key) {
  const record = metadataRecord(records, key);
  return record && record.t === 'str' && typeof record.v === 'string' ? record.v : '';
}

function metadataInt(records, key) {
  const record = metadataRecord(records, key);
  return record && record.t === 'int' && Number.isInteger(record.v) ? record.v : null;
}

function endpointFrom(records, prefix) {
  const tableId = metadataString(records, `${prefix}_table_id`);
  const modelId = metadataInt(records, `${prefix}_model_id`);
  const pin = metadataString(records, `${prefix}_pin`);
  if (!SAFE_TABLE_ID_RE.test(tableId) || !SAFE_SEGMENT_RE.test(pin)) return null;
  if (!Number.isInteger(modelId) || (tableId === 'host' ? modelId <= 0 : modelId < 0)) return null;
  return { table_id: tableId, model_id: modelId, pin };
}

function projectPacket(packet) {
  if (!exactKeys(packet, ['version', 'type', 'payload'])
    || packet.version !== 'v1'
    || packet.type !== 'pin_payload'
    || !Array.isArray(packet.payload)
    || packet.payload.length === 0
    || !packet.payload.every(isRecord)) {
    throw new TypeError('invalid_pin_flow_packet');
  }
  const records = packet.payload;
  if (metadataString(records, '__mt_payload_kind') !== 'pin_payload.v2') {
    throw new TypeError('invalid_pin_flow_packet');
  }
  const requestId = metadataString(records, '__mt_request_id');
  const opId = metadataString(records, 'op_id');
  const messageRole = metadataString(records, 'message_role');
  const bus = metadataString(records, 'bus');
  const routeKind = metadataString(records, 'route_kind');
  const timestamp = metadataInt(records, 'timestamp');
  const endpoint = endpointFrom(records, 'endpoint');
  const replyTarget = endpointFrom(records, 'reply_target');
  if (!SAFE_ID_RE.test(requestId)
    || !SAFE_ID_RE.test(opId)
    || (messageRole !== 'request' && messageRole !== 'response')
    || (bus !== 'control' && bus !== 'management')
    || (routeKind !== 'control' && routeKind !== 'management')
    || !Number.isInteger(timestamp)
    || !endpoint
    || !replyTarget) {
    throw new TypeError('invalid_pin_flow_packet');
  }
  return {
    requestId,
    opId,
    messageRole,
    bus,
    routeKind,
    endpoint,
    replyTarget,
  };
}

export function projectDePinFlowPacket(packet) {
  const projected = projectPacket(packet);
  return {
    request_id: projected.requestId,
    op_id: projected.opId,
    message_role: projected.messageRole,
    bus: projected.bus,
    route_kind: projected.routeKind,
    endpoint: { ...projected.endpoint },
    reply_target: { ...projected.replyTarget },
    payload_sha256: sha256(packet),
  };
}

function isEndpoint(value) {
  return exactKeys(value, ENDPOINT_KEYS)
    && SAFE_TABLE_ID_RE.test(value.table_id)
    && Number.isInteger(value.model_id)
    && (value.table_id === 'host' ? value.model_id > 0 : value.model_id >= 0)
    && SAFE_SEGMENT_RE.test(value.pin);
}

function endpointsEqual(left, right) {
  return Boolean(left && right
    && left.table_id === right.table_id
    && left.model_id === right.model_id
    && left.pin === right.pin);
}

function isEvidence(value) {
  return exactKeys(value, EVIDENCE_KEYS)
    && value.schema === SCHEMA
    && Number.isFinite(value.ts)
    && value.ts >= 0
    && typeof value.producer === 'string'
    && PRODUCER_STAGES[value.producer]?.has(value.stage)
    && STAGE_ROLES[value.stage] === value.message_role
    && SAFE_ID_RE.test(value.request_id)
    && SAFE_ID_RE.test(value.op_id)
    && (value.bus === 'control' || value.bus === 'management')
    && (value.route_kind === 'control' || value.route_kind === 'management')
    && isEndpoint(value.endpoint)
    && isEndpoint(value.reply_target)
    && HASH_RE.test(value.payload_sha256);
}

export function buildDePinFlowEvidence({ producer, stage, packet, ts }) {
  if (!PRODUCER_STAGES[producer]?.has(stage)) throw new TypeError('invalid_pin_flow_stage');
  if (!Number.isFinite(ts) || ts < 0) throw new TypeError('invalid_pin_flow_timestamp');
  const projected = projectPacket(packet);
  if (STAGE_ROLES[stage] !== projected.messageRole) throw new TypeError('invalid_pin_flow_stage_role');
  return {
    schema: SCHEMA,
    ts,
    producer,
    stage,
    request_id: projected.requestId,
    op_id: projected.opId,
    message_role: projected.messageRole,
    bus: projected.bus,
    route_kind: projected.routeKind,
    endpoint: projected.endpoint,
    reply_target: projected.replyTarget,
    payload_sha256: sha256(packet),
  };
}

export function formatDePinFlowEvidenceLine(evidence) {
  if (!isEvidence(evidence)) throw new TypeError('invalid_pin_flow_evidence');
  const canonical = Object.fromEntries(EVIDENCE_KEYS.map((key) => [key, evidence[key]]));
  return `${DE_PIN_FLOW_EVIDENCE_MARKER} ${JSON.stringify(canonical)}`;
}

export function parseDePinFlowEvidenceLines(logText, { since = 0 } = {}) {
  if (typeof logText !== 'string') throw new TypeError('logText must be a string');
  if (!Number.isFinite(since)) throw new TypeError('since must be a finite timestamp');
  const evidence = [];
  for (const line of logText.split(/\r?\n/u)) {
    if (!line.startsWith(`${DE_PIN_FLOW_EVIDENCE_MARKER} `)) continue;
    let parsed;
    try {
      parsed = JSON.parse(line.slice(DE_PIN_FLOW_EVIDENCE_MARKER.length + 1));
    } catch {
      throw new Error('invalid_pin_flow_evidence');
    }
    if (!isEvidence(parsed)) throw new Error('invalid_pin_flow_evidence');
    if (parsed.ts >= since) evidence.push(parsed);
  }
  return evidence;
}

export function evaluateDePinFlowEvidence(evidence, {
  since = 0,
  now = Number.POSITIVE_INFINITY,
  maxAgeMs = Number.POSITIVE_INFINITY,
  requestId = '',
  opId = '',
  replyTarget = null,
  endpoint = null,
  producer = '',
  stage = '',
  messageRole = '',
} = {}) {
  if (!isEvidence(evidence)) return { ok: false, code: 'invalid_pin_flow_evidence' };
  if (!Number.isFinite(since)
    || !(Number.isFinite(now) || now === Number.POSITIVE_INFINITY)
    || !(Number.isFinite(maxAgeMs) || maxAgeMs === Number.POSITIVE_INFINITY)
    || maxAgeMs < 0) {
    return { ok: false, code: 'invalid_pin_flow_window' };
  }
  if (evidence.ts < since || (Number.isFinite(now) && now - evidence.ts > maxAgeMs)) {
    return { ok: false, code: 'stale_pin_flow_evidence' };
  }
  if (Number.isFinite(now) && evidence.ts > now + 5000) {
    return { ok: false, code: 'future_pin_flow_evidence' };
  }
  if ((requestId && evidence.request_id !== requestId) || (opId && evidence.op_id !== opId)) {
    return { ok: false, code: 'pin_flow_correlation_mismatch' };
  }
  if (replyTarget && !endpointsEqual(evidence.reply_target, replyTarget)) {
    return { ok: false, code: 'pin_flow_reply_target_mismatch' };
  }
  if (endpoint && !endpointsEqual(evidence.endpoint, endpoint)) {
    return { ok: false, code: 'pin_flow_endpoint_mismatch' };
  }
  if ((producer && evidence.producer !== producer) || (stage && evidence.stage !== stage)) {
    return { ok: false, code: 'pin_flow_stage_mismatch' };
  }
  if (messageRole && evidence.message_role !== messageRole) {
    return { ok: false, code: 'pin_flow_message_role_mismatch' };
  }
  return { ok: true, code: 'pin_flow_evidence_valid' };
}

export function evaluateDePinFlowEvidenceSequence(evidence, {
  since = 0,
  now = Number.POSITIVE_INFINITY,
  maxAgeMs = Number.POSITIVE_INFINITY,
  requestId = '',
  opId = '',
  replyTarget = null,
  requiredStages = [],
} = {}) {
  if (!Array.isArray(evidence) || !Array.isArray(requiredStages)) {
    return { ok: false, code: 'invalid_pin_flow_sequence' };
  }
  const correlated = evidence.filter((entry) => (!requestId || entry?.request_id === requestId)
    && (!opId || entry?.op_id === opId));
  if (correlated.length === 0) return { ok: false, code: 'pin_flow_correlation_missing' };
  for (const entry of correlated) {
    const evaluated = evaluateDePinFlowEvidence(entry, {
      since,
      now,
      maxAgeMs,
      requestId,
      opId,
      replyTarget,
    });
    if (!evaluated.ok) return evaluated;
  }
  for (const required of requiredStages) {
    if (!required || typeof required !== 'object'
      || !PRODUCER_STAGES[required.producer]?.has(required.stage)) {
      return { ok: false, code: 'invalid_pin_flow_sequence' };
    }
  }
  const actualOrder = correlated
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => left.entry.ts - right.entry.ts || left.index - right.index);
  let cursor = 0;
  for (const required of requiredStages) {
    const matches = ({ entry }) => entry.producer === required.producer
      && entry.stage === required.stage
      && (!required.message_role || entry.message_role === required.message_role);
    const relativeIndex = actualOrder.slice(cursor).findIndex(matches);
    if (relativeIndex < 0) {
      if (actualOrder.some(matches)) {
        return {
          ok: false,
          code: 'pin_flow_stage_order_mismatch',
          producer: required.producer,
          stage: required.stage,
        };
      }
      return {
        ok: false,
        code: 'pin_flow_stage_missing',
        producer: required.producer,
        stage: required.stage,
      };
    }
    cursor += relativeIndex + 1;
  }
  return { ok: true, code: 'pin_flow_sequence_complete' };
}

export function createDePinFlowEvidenceEmitter({ producer, writeLine, now = Date.now }) {
  if (!PRODUCER_STAGES[producer]) throw new TypeError('invalid_pin_flow_producer');
  if (typeof writeLine !== 'function') throw new TypeError('writeLine must be a function');
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  return function emitDePinFlowEvidence(stage, packet) {
    const evidence = buildDePinFlowEvidence({ producer, stage, packet, ts: now() });
    writeLine(formatDePinFlowEvidenceLine(evidence));
    return evidence;
  };
}
