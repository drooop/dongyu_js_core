import { createHash } from 'node:crypto';

export const DE_RUNTIME_DIAGNOSTIC_MARKER = 'DE_RUNTIME_DIAGNOSTIC';
export const DE_RUNTIME_TRACE_MARKER = 'DE_RUNTIME_TRACE';

const DIAGNOSTIC_SCHEMA = 'de_runtime_diagnostic.v1';
const TRACE_SCHEMA = 'de_runtime_trace.v1';
const LEGACY_REJECTION_CODE = 'legacy_feishu_message_api_v1_removed';
const LEGACY_PUBLIC_TOPIC = 'UIPUT/ws/dam/pic/de/R1/3200/resource';
const LEGACY_RESPONSE_TOPIC_PREFIX = 'UIPUT/ws/dam/pic/de/U1/3200/legacy_probe_';
const PROBE_MARKER_RE = /^[a-z][a-z0-9_-]{0,63}$/u;

function stableJson(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new TypeError('value is not JSON serializable');
    return encoded;
  }
  if (seen.has(value)) throw new TypeError('value contains a cycle');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => stableJson(entry, seen)).join(',')}]`;
    }
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key], seen)}`)
      .join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

export function stableSha256(value) {
  const input = typeof value === 'string' ? value : stableJson(value);
  return createHash('sha256').update(input).digest('hex');
}

function rootLabelValue(runtime, modelId, key) {
  const model = runtime?.getModel?.(modelId);
  if (!model) return null;
  const cell = runtime?.getCell?.(model, 0, 0, 0);
  return cell?.labels?.get?.(key)?.v ?? null;
}

function projectInboundError(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const projected = {
    code: value.code,
    topic: value.topic,
    pin: value.pin,
    ingress_pin: value.ingress_pin,
    ts: value.ts,
  };
  if (typeof projected.code !== 'string'
    || typeof projected.topic !== 'string'
    || typeof projected.pin !== 'string'
    || typeof projected.ingress_pin !== 'string'
    || !Number.isFinite(projected.ts)) return null;
  return projected;
}

export function buildDeRuntimeDiagnostic({ runtime, reason }) {
  if (!runtime || typeof runtime.snapshot !== 'function') {
    throw new TypeError('runtime.snapshot is required');
  }
  const snapshot = runtime.snapshot();
  const model3200 = snapshot?.models?.['3200'] ?? null;
  if (model3200 === null) throw new Error('model3200 snapshot is required');
  const result = model3200?.cells?.['0,0,0']?.labels?.result ?? null;
  if (result === null) throw new Error('model3200 result is required');
  return {
    schema: DIAGNOSTIC_SCHEMA,
    reason: String(reason ?? ''),
    mqtt_inbound_error: projectInboundError(rootLabelValue(runtime, 0, 'mqtt_inbound_error')),
    model3200_sha256: stableSha256(model3200),
    model3200_result_sha256: stableSha256(result),
  };
}

function outerPayloadRecords(packet) {
  return packet && typeof packet === 'object' && !Array.isArray(packet) && Array.isArray(packet.payload)
    ? packet.payload
    : [];
}

function recordStringValue(records, key) {
  const record = records.find((entry) => entry
    && typeof entry === 'object'
    && entry.k === key
    && entry.t === 'str'
    && typeof entry.v === 'string');
  return record ? record.v : '';
}

function exactProbeCorrelation(records) {
  const responseTopic = recordStringValue(records, 'response_pin');
  if (!responseTopic.startsWith(LEGACY_RESPONSE_TOPIC_PREFIX)) return null;
  const marker = responseTopic.slice(LEGACY_RESPONSE_TOPIC_PREFIX.length);
  if (!PROBE_MARKER_RE.test(marker) || responseTopic !== `${LEGACY_RESPONSE_TOPIC_PREFIX}${marker}`) return null;
  if (recordStringValue(records, 'origin_pin') !== responseTopic) return null;
  const resourceRecord = records.find((entry) => entry
    && entry.k === 'resource'
    && Array.isArray(entry.v));
  if (!resourceRecord || resourceRecord.v.length !== 1
    || resourceRecord.v[0] !== `UI.legacy_probe_${marker}`) return null;
  return { marker, responseTopic };
}

function projectTraceEntry(entry, runtime) {
  if (!entry || (entry.type !== 'inbound' && entry.type !== 'inbound_rejected')) return null;
  const payload = entry.payload;
  if (!payload || typeof payload !== 'object') return null;
  if (entry.type === 'inbound' && payload.ingress_pin !== 'r1_cb_in') return null;
  if (entry.type === 'inbound_rejected' && payload.reason !== LEGACY_REJECTION_CODE) return null;
  const topic = typeof payload.topic === 'string' ? payload.topic : '';
  const packet = payload.payload;
  const records = outerPayloadRecords(packet);
  if (topic !== LEGACY_PUBLIC_TOPIC || !packet || records.length === 0) return null;
  const correlation = exactProbeCorrelation(records);
  if (!correlation) return null;
  const runtimeError = projectInboundError(rootLabelValue(runtime, 0, 'mqtt_inbound_error'));
  const ts = Number.isFinite(entry.ts)
    ? entry.ts
    : entry.type === 'inbound_rejected'
      && runtimeError?.code === LEGACY_REJECTION_CODE
      && runtimeError?.topic === topic
      ? runtimeError.ts
      : Date.now();
  if (!Number.isFinite(ts)) return null;
  const projectedPayload = {
    topic,
    pin: 'resource',
    ingress_pin: 'r1_cb_in',
    probe_marker: correlation.marker,
    response_topic: correlation.responseTopic,
    outer_packet_sha256: stableSha256(packet),
  };
  if (entry.type === 'inbound_rejected') projectedPayload.reason = LEGACY_REJECTION_CODE;
  return {
    type: entry.type,
    ts,
    payload: projectedPayload,
  };
}

export function buildDeRuntimeTraceEvidence({ runtime, reason, traceEntries = [] }) {
  if (!Array.isArray(traceEntries)) throw new TypeError('traceEntries must be an array');
  return {
    schema: TRACE_SCHEMA,
    reason: String(reason ?? ''),
    entries: traceEntries.map((entry) => projectTraceEntry(entry, runtime)).filter(Boolean),
  };
}

export function formatDeRuntimeDiagnosticLogLines({ runtime, reason, traceEntries = [] }) {
  const diagnostic = buildDeRuntimeDiagnostic({ runtime, reason });
  const trace = buildDeRuntimeTraceEvidence({ runtime, reason, traceEntries });
  return [
    `${DE_RUNTIME_DIAGNOSTIC_MARKER} ${JSON.stringify(diagnostic)}`,
    `${DE_RUNTIME_TRACE_MARKER} ${JSON.stringify(trace)}`,
  ];
}

export function emitDeRuntimeDiagnosticLogLines({ runtime, reason, traceEntries = [], writeLine }) {
  if (typeof writeLine !== 'function') throw new TypeError('writeLine must be a function');
  const lines = formatDeRuntimeDiagnosticLogLines({ runtime, reason, traceEntries });
  for (const line of lines) writeLine(line);
  return lines;
}

export function createDeRuntimeDiagnosticEmitter({ runtime, writeLine }) {
  if (!runtime?.mqttTrace || typeof runtime.mqttTrace.list !== 'function') {
    throw new TypeError('runtime.mqttTrace.list is required');
  }
  if (typeof writeLine !== 'function') throw new TypeError('writeLine must be a function');
  let cursor = 0;
  return function emit(reason) {
    const trace = runtime.mqttTrace.list();
    if (!Array.isArray(trace)) throw new TypeError('runtime.mqttTrace.list must return an array');
    const nextCursor = trace.length;
    const traceEntries = trace.slice(cursor);
    const lines = emitDeRuntimeDiagnosticLogLines({ runtime, reason, traceEntries, writeLine });
    cursor = nextCursor;
    return lines;
  };
}

export function createRoleScopedDeRuntimeDiagnosticHeartbeat({
  workerScope,
  runtime,
  writeLine,
  beforeEmit = () => {},
  diagnosticFactory = createDeRuntimeDiagnosticEmitter,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  heartbeatIntervalMs = 10000,
}) {
  if (typeof workerScope !== 'string' || workerScope.length === 0) {
    throw new TypeError('workerScope must be a non-empty string');
  }
  if (workerScope !== 'remote-worker') {
    return Object.freeze({
      enabled: false,
      start() { return []; },
      stop() {},
    });
  }
  if (typeof diagnosticFactory !== 'function') throw new TypeError('diagnosticFactory must be a function');
  if (typeof beforeEmit !== 'function') throw new TypeError('beforeEmit must be a function');
  if (typeof setIntervalFn !== 'function' || typeof clearIntervalFn !== 'function') {
    throw new TypeError('timer functions are required');
  }
  if (!Number.isFinite(heartbeatIntervalMs) || heartbeatIntervalMs <= 0) {
    throw new TypeError('heartbeatIntervalMs must be positive');
  }
  const emit = diagnosticFactory({ runtime, writeLine });
  if (typeof emit !== 'function') throw new TypeError('diagnosticFactory must return an emitter');
  let timer = null;
  let started = false;
  let stopped = false;
  const emitWithContext = (reason) => {
    beforeEmit(reason);
    return emit(reason);
  };
  return Object.freeze({
    enabled: true,
    start() {
      if (started || stopped) return [];
      const lines = emitWithContext('after_start');
      timer = setIntervalFn(() => emitWithContext('interval'), heartbeatIntervalMs);
      if (timer && typeof timer.unref === 'function') timer.unref();
      started = true;
      return lines;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (timer !== null) clearIntervalFn(timer);
      timer = null;
    },
  });
}
