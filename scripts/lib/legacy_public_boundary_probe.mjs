import { createHash } from 'node:crypto';

// Acceptance evidence helper; public Feishu parsing remains inside ModelTable runtime semantics.

const PUBLIC_TOPIC = 'UIPUT/ws/dam/pic/de/R1/3200/resource';
const REMOVED_REASON = 'legacy_feishu_message_api_v1_removed';
const HASH_RE = /^[0-9a-f]{64}$/u;
const PROBE_MARKER_RE = /^[a-z][a-z0-9_-]{0,63}$/u;

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function mt(k, t, v, id = '0', p = 0, r = 0, c = 0) {
  return { id, p, r, c, k, t, v };
}

function responseTopicFor(marker) {
  return `UIPUT/ws/dam/pic/de/U1/3200/legacy_probe_${marker}`;
}

function assertProbeMarker(marker) {
  if (typeof marker !== 'string' || !PROBE_MARKER_RE.test(marker)) {
    throw new TypeError('probe marker must match ^[a-z][a-z0-9_-]{0,63}$');
  }
  return marker;
}

function removedLegacyRecords(marker, responseTopic) {
  return [
    mt('model_type', 'model.subtable', 'Data'),
    mt('model_type', 'model.single', 'Data.Single', '0', 0, 0, 1),
    mt('__mt_payload_kind', 'str', 'pin_payload.v1', '0', 0, 0, 1),
    mt('is_need_response', 'bool', true, '0', 0, 0, 1),
    mt('model_type', 'model.matrix', 'Data', '0', 0, 1, 0),
    mt('model_size', 'model.matrix.size', {
      min_p: 0,
      min_r: 1,
      min_c: 0,
      max_p: 0,
      max_r: 1,
      max_c: 2,
    }, '0', 0, 1, 0),
    mt('route_kind', 'str', 'control', '0', 0, 1, 0),
    mt('origin_pin', 'str', responseTopic, '0', 0, 1, 0),
    mt('endpoint_pin', 'str', PUBLIC_TOPIC, '0', 0, 1, 0),
    mt('response_pin', 'str', responseTopic, '0', 0, 1, 0),
    mt('model_type', 'model.single', 'Data.Single', '0', 0, 1, 1),
    mt('message_server', 'str', 'local', '0', 0, 1, 1),
    mt('between', 'str', 'DEM_V1N', '0', 0, 1, 1),
    mt('model_type', 'model.subtableconnection', 1, '0', 0, 2, 0),
    mt('model_type', 'model.subtable', 'Data', '0.1'),
    mt('model_name', 'model.name', 'payload', '0.1'),
    mt('sys_msg_type', 'str', 'resource.report', '0.1'),
    mt('type', 'str', 'UI', '0.1', 0, 0, 1),
    mt('resource', 'list', [`UI.legacy_probe_${marker}`], '0.1', 0, 0, 1),
  ];
}

export function buildLegacyPublicBoundaryProbe({ marker = 'probe' } = {}) {
  const safeMarker = assertProbeMarker(marker);
  const responseTopic = responseTopicFor(safeMarker);
  const packet = {
    version: 'v1',
    type: 'pin_payload',
    payload: removedLegacyRecords(safeMarker, responseTopic),
  };
  return {
    topic: PUBLIC_TOPIC,
    response_topic: responseTopic,
    packet,
    outer_packet_sha256: sha256(packet),
  };
}

function diagnosticSchemaIsValid(value) {
  return Boolean(value && typeof value === 'object'
    && value.schema === 'de_runtime_diagnostic.v1');
}

function diagnosticHashesAreValid(value) {
  return HASH_RE.test(value?.model3200_sha256 || '')
    && HASH_RE.test(value?.model3200_result_sha256 || '');
}

function rejectionMatches(error, { topic, publishedAt }) {
  return Boolean(error
    && error.code === REMOVED_REASON
    && error.topic === topic
    && error.pin === 'resource'
    && error.ingress_pin === 'r1_cb_in'
    && Number.isFinite(error.ts)
    && error.ts >= publishedAt);
}

function traceMatches(entry, input, type) {
  const payload = entry?.payload;
  return Boolean(entry
    && entry.type === type
    && Number.isFinite(entry.ts)
    && entry.ts >= input.publishedAt
    && payload
    && payload.topic === input.topic
    && payload.pin === 'resource'
    && payload.ingress_pin === 'r1_cb_in'
    && payload.probe_marker === input.marker
    && payload.response_topic === input.responseTopic
    && payload.outer_packet_sha256 === input.outerPacketSha256);
}

export function evaluateLegacyPublicBoundaryEvidence(input = {}) {
  const { before, after } = input;
  if (!diagnosticSchemaIsValid(before) || !diagnosticSchemaIsValid(after)) {
    return { ok: false, code: 'invalid_diagnostic_schema' };
  }
  if (!diagnosticHashesAreValid(before) || !diagnosticHashesAreValid(after)) {
    return { ok: false, code: 'invalid_diagnostic_hash' };
  }
  const nullHash = sha256(null);
  if (before.model3200_sha256 === nullHash
    || before.model3200_result_sha256 === nullHash
    || after.model3200_sha256 === nullHash
    || after.model3200_result_sha256 === nullHash) {
    return { ok: false, code: 'missing_model3200_evidence' };
  }
  if (before.model3200_sha256 !== after.model3200_sha256) {
    return { ok: false, code: 'model3200_snapshot_changed' };
  }
  if (before.model3200_result_sha256 !== after.model3200_result_sha256) {
    return { ok: false, code: 'model3200_result_changed' };
  }
  if (!rejectionMatches(after.mqtt_inbound_error, input)) {
    const rejection = after.mqtt_inbound_error;
    if (rejection
      && rejection.code === REMOVED_REASON
      && rejection.topic === input.topic
      && rejection.pin === 'resource'
      && rejection.ingress_pin === 'r1_cb_in'
      && Number.isFinite(rejection.ts)
      && rejection.ts < input.publishedAt) {
      return { ok: false, code: 'stale_legacy_rejection' };
    }
    return { ok: false, code: 'missing_exact_legacy_rejection' };
  }
  const beforeError = before.mqtt_inbound_error;
  if (beforeError && rejectionMatches(beforeError, input)
    && beforeError.ts === after.mqtt_inbound_error.ts) {
    return { ok: false, code: 'stale_legacy_rejection' };
  }
  if (input.traceSince !== input.startedAt) {
    return { ok: false, code: 'invalid_trace_window' };
  }
  const traceDelta = Array.isArray(input.traceDelta) ? input.traceDelta : [];
  if (traceDelta.some((entry) => traceMatches(entry, input, 'inbound'))) {
    return { ok: false, code: 'legacy_packet_reached_ingress' };
  }
  const rejectionTrace = traceDelta.find((entry) => (
    traceMatches(entry, input, 'inbound_rejected')
    && entry.payload.reason === REMOVED_REASON
  ));
  if (!rejectionTrace) return { ok: false, code: 'missing_rejection_trace' };
  if (Array.isArray(input.responseMessages) && input.responseMessages.length > 0) {
    return { ok: false, code: 'legacy_response_emitted' };
  }
  return { ok: true, code: 'verified' };
}

function markerPayloads(logText, marker) {
  const prefix = `${marker} `;
  const values = [];
  for (const line of String(logText || '').split(/\r?\n/u)) {
    if (!line.startsWith(prefix)) continue;
    try {
      values.push(JSON.parse(line.slice(prefix.length)));
    } catch {
      // Diagnostic and trace logs are cumulative operational logs. A torn line
      // is ignored here; the strict fail-closed rule belongs to network-boundary markers.
    }
  }
  return values;
}

export function parseR1DiagnosticLog(logText, {
  phase = 'after',
  notBefore = null,
} = {}) {
  const diagnostics = markerPayloads(logText, 'DE_RUNTIME_DIAGNOSTIC')
    .filter((entry) => diagnosticSchemaIsValid(entry) && diagnosticHashesAreValid(entry));
  if (phase === 'before') {
    return diagnostics.at(-1) || null;
  }
  const minimum = Number.isFinite(notBefore) ? notBefore : -Infinity;
  return diagnostics
    .filter((entry) => Number.isFinite(entry?.mqtt_inbound_error?.ts)
      && entry.mqtt_inbound_error.ts >= minimum)
    .sort((left, right) => left.mqtt_inbound_error.ts - right.mqtt_inbound_error.ts)
    .at(-1) || null;
}

function traceIdentity(entry) {
  const payload = entry.payload || {};
  return [
    entry.type,
    payload.topic,
    payload.pin,
    payload.ingress_pin,
    payload.reason || '',
    payload.probe_marker,
    payload.response_topic,
    payload.outer_packet_sha256,
  ].join('|');
}

export function parseR1TraceDeltaLog(logText, input = {}) {
  const minimum = Math.max(
    Number.isFinite(input.since) ? input.since : -Infinity,
    Number.isFinite(input.notBefore) ? input.notBefore : -Infinity,
  );
  const newest = new Map();
  for (const envelope of markerPayloads(logText, 'DE_RUNTIME_TRACE')) {
    if (!envelope || envelope.schema !== 'de_runtime_trace.v1' || !Array.isArray(envelope.entries)) continue;
    for (const entry of envelope.entries) {
      if (!entry || !Number.isFinite(entry.ts) || entry.ts < minimum) continue;
      if (!traceMatches(entry, {
        ...input,
        publishedAt: minimum,
      }, entry.type)) continue;
      const identity = traceIdentity(entry);
      const previous = newest.get(identity);
      if (!previous || previous.ts < entry.ts) newest.set(identity, entry);
    }
  }
  return [...newest.values()].sort((left, right) => left.ts - right.ts);
}
