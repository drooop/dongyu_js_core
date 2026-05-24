const MODEL_ROUTE_KEYS = [
  'mgmt_bus_console_send_route',
  'mgmt_bus_console_refresh_route',
];

const BUS_ROUTE_METADATA_ROWS = [
  {
    route: 'message.endpoint',
    status: 'configured',
    target: 'endpoint_worker_id / endpoint_model_id / endpoint_pin records',
  },
  {
    route: 'message.reply_target',
    status: 'configured',
    target: 'reply_target_worker_id / reply_target_model_id / reply_target_pin records',
  },
];

const SENSITIVE_KEY_RE = /(^|[_\-.])(access_token|refresh_token|matrix_token|matrix_passwd|token|secret|passwd|password|credential|credentials|authorization|auth)([_\-.]|$)/iu;
const SENSITIVE_VALUE_RE = /(syt_[A-Za-z0-9._=-]+|ChangeMeLocal2026|SECRET_SHOULD_NOT_RENDER)/gu;
const VALID_DIRECTIONS = new Set(['inbound', 'outbound', 'internal', 'error']);
const VALID_SOURCES = new Set(['matrix', 'model0', 'mbr', 'remote-worker', 'ui', 'runtime']);
const VALID_STATUSES = new Set(['queued', 'sent', 'received', 'applied', 'rejected', 'error', 'unknown']);
const VALID_SUBJECT_STATUSES = new Set(['selected', 'available', 'joined', 'empty', 'error', 'ready', 'monitoring', 'unavailable']);

function sanitizeString(value, fallback = '') {
  const text = value === undefined || value === null ? fallback : String(value);
  return text.replace(SENSITIVE_VALUE_RE, '[redacted]');
}

function sanitizeEnum(value, allowed, fallback) {
  const text = sanitizeString(value).trim();
  return allowed.has(text) ? text : fallback;
}

function sanitizeObjectForDisplay(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeObjectForDisplay(entry))
      .filter((entry) => entry !== undefined);
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      if (SENSITIVE_KEY_RE.test(key)) continue;
      const next = sanitizeObjectForDisplay(entry);
      if (next !== undefined) out[sanitizeString(key)] = next;
    }
    return out;
  }
  return sanitizeString(value);
}

function findModelTableRecord(records, key) {
  return (Array.isArray(records) ? records : []).find((record) => (
    record
    && record.id === 0
    && record.p === 0
    && record.r === 0
    && record.c === 0
    && record.k === key
  )) || null;
}

function previewFromBusinessRecords(records) {
  for (const key of ['reply_text', 'message_text', 'draft', 'text']) {
    const record = findModelTableRecord(records, key);
    if (record && typeof record.v === 'string' && record.v.trim()) return record.v;
  }
  const target = findModelTableRecord(records, 'target_user_id');
  return target && typeof target.v === 'string' ? target.v : '';
}

function previewFromPinPayloadPacket(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  if (value.version !== 'v1' || value.type !== 'pin_payload') return '';
  const nestedPayload = findModelTableRecord(value.payload, 'payload')?.v;
  return previewFromBusinessRecords(nestedPayload);
}

function compactPreview(value) {
  const pinPayloadPreview = previewFromPinPayloadPacket(value);
  if (pinPayloadPreview) {
    const normalized = sanitizeString(pinPayloadPreview).replace(/\s+/gu, ' ').trim();
    return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
  }
  const sanitized = sanitizeObjectForDisplay(value);
  let text = '';
  if (typeof sanitized === 'string') {
    text = sanitized;
  } else if (sanitized && typeof sanitized === 'object') {
    if (!Array.isArray(sanitized) && typeof sanitized.body === 'string') {
      text = sanitized.body;
    } else if (!Array.isArray(sanitized) && typeof sanitized.message === 'string') {
      text = sanitized.message;
    } else if (!Array.isArray(sanitized) && typeof sanitized.text === 'string') {
      text = sanitized.text;
    } else {
      text = JSON.stringify(sanitized);
    }
  } else if (sanitized !== undefined && sanitized !== null) {
    text = String(sanitized);
  }
  const normalized = sanitizeString(text).replace(/\s+/gu, ' ').trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

function safeInt(value, fallback = 0) {
  return Number.isSafeInteger(value) ? value : fallback;
}

function describeModelRoute(routeKey, value) {
  const route = Array.isArray(value) ? value[0] : null;
  const from = Array.isArray(route?.from) ? route.from : [];
  const to = Array.isArray(route?.to) ? route.to : [];
  return {
    route: String(from[1] || routeKey),
    status: to.length > 0 ? 'configured' : 'missing',
    target: to.map((entry) => (
      Array.isArray(entry) ? `${entry[0]}.${entry[1]}` : String(entry)
    )).join(', '),
  };
}

function normalizeEventRow(event, index, fallbackTsMs = 0) {
  const source = event && typeof event === 'object' ? event : {};
  const payloadPreview = source.preview !== undefined
    ? source.preview
    : (source.payload !== undefined ? source.payload : (source.body !== undefined ? source.body : source.value));
  const row = {
    event_id: sanitizeString(source.event_id || source.id || `mgmt-bus-event-${index + 1}`),
    ts_ms: safeInt(source.ts_ms, fallbackTsMs),
    direction: sanitizeEnum(source.direction, VALID_DIRECTIONS, 'internal'),
    source: sanitizeEnum(source.source, VALID_SOURCES, 'runtime'),
    subject_id: sanitizeString(source.subject_id || source.room_id || source.route_key || 'runtime'),
    subject_label: sanitizeString(source.subject_label || source.subject || source.room_name || source.source || 'Runtime'),
    route_key: sanitizeString(source.route_key || ''),
    pin: sanitizeString(source.pin || ''),
    kind: sanitizeString(source.kind || source.payload_kind || ''),
    status: sanitizeEnum(source.status, VALID_STATUSES, 'unknown'),
    preview: compactPreview(payloadPreview),
    op_id: sanitizeString(source.op_id || ''),
  };
  if (Number.isSafeInteger(source.model_id)) row.model_id = source.model_id;
  if (Number.isSafeInteger(source.target_model_id)) row.target_model_id = source.target_model_id;
  if (source.error_code !== undefined) row.error_code = sanitizeString(source.error_code);
  if (Number.isSafeInteger(source.latency_ms)) row.latency_ms = source.latency_ms;
  if (source.payload_ref !== undefined) row.payload_ref = sanitizeString(source.payload_ref);
  return row;
}

function buildFallbackEventRows(source, routeRows, routeStatus) {
  const readiness = sanitizeString(source.readinessText || '').trim();
  const traceSummary = sanitizeString(source.traceSummaryText || '').trim();
  const configuredRoutes = routeRows.filter((row) => row.status === 'configured').length;
  const rows = [
    normalizeEventRow({
      event_id: 'runtime-readiness',
      ts_ms: 0,
      direction: 'internal',
      source: 'runtime',
      subject_id: 'runtime',
      subject_label: 'Runtime',
      kind: 'mgmt_bus_console.readiness.v1',
      status: readiness ? 'applied' : 'unknown',
      preview: readiness || 'Runtime projection is available',
    }, 0),
    normalizeEventRow({
      event_id: 'model0-route-status',
      ts_ms: 0,
      direction: routeStatus === 'live' ? 'internal' : 'error',
      source: 'model0',
      subject_id: 'model0',
      subject_label: 'Model 0 bus',
      route_key: 'mgmt_bus_console',
      pin: 'pin.bus.mb.in',
      kind: 'mgmt_bus_console.route_status.v1',
      status: routeStatus === 'live' ? 'applied' : 'error',
      preview: `routes=${configuredRoutes}/${routeRows.length} status=${routeStatus}`,
    }, 1),
  ];
  if (traceSummary) {
    rows.push(normalizeEventRow({
      event_id: 'matrix-trace-summary',
      ts_ms: 0,
      direction: 'inbound',
      source: 'matrix',
      subject_id: 'trace',
      subject_label: 'Trace Buffer',
      kind: 'mgmt_bus_console.trace_summary.v1',
      status: 'received',
      preview: traceSummary,
    }, 2));
  }
  return rows;
}

function buildEventInspectorRows(row, missingEventId = '') {
  if (!row || typeof row !== 'object') {
    return [{
      field: 'state',
      value: missingEventId ? `event not found: ${sanitizeString(missingEventId)}` : 'no selected event',
    }];
  }
  const fields = [
    'event_id',
    'ts_ms',
    'direction',
    'source',
    'subject_id',
    'subject_label',
    'route_key',
    'pin',
    'kind',
    'status',
    'preview',
    'op_id',
    'model_id',
    'target_model_id',
    'error_code',
    'latency_ms',
    'payload_ref',
  ];
  return fields
    .filter((field) => row[field] !== undefined && row[field] !== '')
    .map((field) => ({ field, value: sanitizeString(row[field]) }));
}

function buildComposerActions() {
  return [
    { action: 'refresh', payload_kind: 'mgmt_bus_console.refresh.v1', status: 'enabled' },
    { action: 'send', payload_kind: 'mgmt_bus_console.send.v1', status: 'enabled' },
    { action: 'inspect', payload_kind: 'mgmt_bus_console.inspect.v1', status: 'local_projection' },
  ];
}

function buildMessageTranscript(eventRows) {
  const rows = (Array.isArray(eventRows) ? eventRows : [])
    .filter((row) => {
      const kind = sanitizeString(row?.kind || '');
      const opId = sanitizeString(row?.op_id || row?.event_id || '');
      const preview = sanitizeString(row?.preview || '');
      return kind.startsWith('mgmt_bus_console.')
        || opId.startsWith('mgmt_bus_console_')
        || opId.startsWith('mbr_ack_')
        || preview.includes('@mbr:');
    })
    .slice(0, 12);
  if (rows.length === 0) return 'No messages sent yet.';
  return rows.map((row) => {
    const direction = row.direction === 'inbound'
      ? 'received'
      : (row.direction === 'outbound' ? 'sent' : 'event');
    const status = row.status ? ` ${row.status}` : '';
    const preview = sanitizeString(row.preview || row.kind || row.event_id || '');
    return `[${direction}${status}] ${preview}`;
  }).join('\n');
}

function firstDisplayString(...values) {
  for (const value of values) {
    const text = sanitizeString(value || '').trim();
    if (text) return text;
  }
  return '';
}

export function buildMgmtBusConsoleSubjectsFromJoinedRooms(rooms, selected = '') {
  const selectedValue = sanitizeString(selected || '').trim();
  return (Array.isArray(rooms) ? rooms : [])
    .map((entry) => {
      const source = entry && typeof entry === 'object' ? entry : {};
      const roomId = typeof entry === 'string'
        ? firstDisplayString(entry)
        : firstDisplayString(source.room_id, source.roomId, source.id, source.value);
      if (!roomId) return null;
      const alias = firstDisplayString(source.canonical_alias, source.canonicalAlias, source.alias);
      return {
        label: firstDisplayString(source.name, source.room_name, source.roomName, alias, roomId),
        value: roomId,
        status: roomId === selectedValue ? 'selected' : 'joined',
        room_id: roomId,
        alias,
        source: 'matrix.joined_room',
      };
    })
    .filter(Boolean);
}

export function deriveMgmtBusConsoleProjection({ matrixProjection, readRootLabel } = {}) {
  const readLabel = typeof readRootLabel === 'function' ? readRootLabel : () => undefined;
  const source = matrixProjection && typeof matrixProjection === 'object' ? matrixProjection : {};
  const selected = String(source.selected || 'trace');
  const hasSourceSubjects = Array.isArray(source.subjects);
  const subjects = hasSourceSubjects
    ? source.subjects.map((entry) => {
      const value = sanitizeString(entry?.value || '');
      const status = sanitizeString(entry?.status || '').trim();
      return {
        label: sanitizeString(entry?.label || value),
        value,
        status: VALID_SUBJECT_STATUSES.has(status)
          ? status
          : (value === sanitizeString(selected) ? 'selected' : 'available'),
      };
    })
    : buildMgmtBusConsoleSubjectsFromJoinedRooms(source.joinedRooms, selected);
  const modelRoutes = MODEL_ROUTE_KEYS.map((routeKey) => (
    describeModelRoute(routeKey, readLabel(0, routeKey))
  ));
  const routeRows = [...modelRoutes, ...BUS_ROUTE_METADATA_ROWS];
  const configuredRoutes = routeRows.filter((row) => row.status === 'configured').length;
  const routeStatus = routeRows.length > 0 && configuredRoutes === routeRows.length ? 'live' : 'route_missing';
  const sourceEvents = Array.isArray(source.events) ? source.events : [];
  const fallbackEventRows = buildFallbackEventRows(source, routeRows, routeStatus);
  const selectedEventId = sanitizeString(source.selectedEventId || source.selected_event_id || '');
  const normalizedSourceEvents = sourceEvents.map((event, index) => normalizeEventRow(event, index));
  const needsFallbackSelection = selectedEventId
    && normalizedSourceEvents.length > 0
    && !normalizedSourceEvents.some((row) => row.event_id === selectedEventId);
  const eventRows = normalizedSourceEvents.length > 0
    ? (needsFallbackSelection ? [...normalizedSourceEvents, ...fallbackEventRows] : normalizedSourceEvents)
    : fallbackEventRows;
  const selectedEvent = selectedEventId
    ? eventRows.find((row) => row.event_id === selectedEventId) || null
    : eventRows[0] || null;
  const eventInspectorRows = buildEventInspectorRows(selectedEvent, selectedEventId);
  const eventInspectorText = eventInspectorRows
    .map((row) => `${row.field}=${row.value}`)
    .join('\n');
  const composerActions = buildComposerActions();
  const timelineText = [
    'Mgmt Bus Console live projection',
    String(source.readinessText || ''),
    String(source.traceSummaryText || ''),
  ].filter(Boolean).join('\n');
  const inspectorText = [
    `selected=${selected}`,
    String(source.subjectSummaryText || ''),
    `routes=${configuredRoutes}/${routeRows.length}`,
  ].filter(Boolean).join('\n');
  const messageTranscript = buildMessageTranscript(eventRows);

  return {
    subjects,
    timelineText,
    inspectorText,
    eventRows,
    eventInspectorRows,
    eventInspectorText,
    composerActions,
    routeRows,
    routeStatus,
    messageTranscript,
  };
}
