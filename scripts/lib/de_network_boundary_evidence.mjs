export const DE_NETWORK_BOUNDARY_MARKER = 'DE_NETWORK_BOUNDARY';

const NETWORK_BOUNDARY_SCHEMA = 'de_network_boundary_evidence.v1';
const ALLOWED_KINDS = new Set(['effective_config', 'outbound_attempt']);
const ACTOR_SERVICES = new Set(['remote-worker', 'workspace-manager', 'mbr-worker', 'ui-server']);
const ALL_SERVICES = new Set([...ACTOR_SERVICES, 'synapse', 'mosquitto']);
const EVIDENCE_KEYS = Object.freeze([
  'schema',
  'kind',
  'service',
  'ts',
  'protocol',
  'hostname',
  'port',
]);

function destinationParts(destination) {
  if (typeof destination !== 'string' || destination.length === 0) {
    throw new TypeError('destination must be a non-empty URL');
  }
  let parsed;
  try {
    parsed = new URL(destination);
  } catch (error) {
    throw new TypeError(`destination must be a valid URL: ${error && error.message ? error.message : error}`);
  }
  const defaultPort = parsed.protocol === 'https:' ? 443
    : parsed.protocol === 'http:' ? 80
      : parsed.protocol === 'mqtt:' ? 1883
        : parsed.protocol === 'mqtts:' ? 8883
          : 0;
  const port = parsed.port ? Number(parsed.port) : defaultPort;
  if (!parsed.hostname || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TypeError('destination must include a valid hostname and port');
  }
  return {
    protocol: parsed.protocol.toLowerCase(),
    hostname: parsed.hostname.toLowerCase(),
    port,
  };
}

function isExactEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.length !== EVIDENCE_KEYS.length
    || keys.some((key, index) => key !== [...EVIDENCE_KEYS].sort()[index])) return false;
  return value.schema === NETWORK_BOUNDARY_SCHEMA
    && ALLOWED_KINDS.has(value.kind)
    && typeof value.service === 'string'
    && ALL_SERVICES.has(value.service)
    && Number.isFinite(value.ts)
    && typeof value.protocol === 'string'
    && typeof value.hostname === 'string'
    && value.hostname === value.hostname.toLowerCase()
    && Number.isInteger(value.port)
    && value.port >= 1
    && value.port <= 65535;
}

export function buildDeNetworkBoundaryEvidence({ kind, service, destination, ts }) {
  if (!ALLOWED_KINDS.has(kind)) throw new TypeError('kind must be effective_config or outbound_attempt');
  if (typeof service !== 'string' || service.length === 0) throw new TypeError('service must identify an actor or local service');
  if (!Number.isFinite(ts)) throw new TypeError('ts must be a finite timestamp');
  const { protocol, hostname, port } = destinationParts(destination);
  return {
    schema: NETWORK_BOUNDARY_SCHEMA,
    kind,
    service,
    ts,
    protocol,
    hostname,
    port,
  };
}

export function formatDeNetworkBoundaryEvidenceLine(evidence) {
  const canonical = Object.fromEntries(EVIDENCE_KEYS.map((key) => [key, evidence[key]]));
  if (!isExactEvidence(canonical)) throw new TypeError('invalid_network_boundary_evidence');
  return `${DE_NETWORK_BOUNDARY_MARKER} ${JSON.stringify(canonical)}`;
}

export function parseDeNetworkBoundaryEvidenceLines(logText, { since = 0 } = {}) {
  if (typeof logText !== 'string') throw new TypeError('logText must be a string');
  if (!Number.isFinite(since)) throw new TypeError('since must be a finite timestamp');
  const parsed = [];
  for (const line of logText.split(/\r?\n/u)) {
    if (!line.startsWith(`${DE_NETWORK_BOUNDARY_MARKER} `)) continue;
    let evidence;
    try {
      evidence = JSON.parse(line.slice(DE_NETWORK_BOUNDARY_MARKER.length + 1));
    } catch {
      throw new Error('invalid_network_boundary_evidence');
    }
    if (!isExactEvidence(evidence)) throw new Error('invalid_network_boundary_evidence');
    if (evidence.ts >= since) parsed.push(evidence);
  }
  return parsed;
}

function allowedDestination(evidence) {
  const endpoint = `${evidence.protocol}//${evidence.hostname}:${evidence.port}`;
  if (evidence.service === 'remote-worker') {
    return endpoint === 'mqtt://mosquitto.dongyu.svc.cluster.local:1883'
      || endpoint === 'https://open.feishu.cn:443';
  }
  if (evidence.service === 'workspace-manager') {
    return endpoint === 'mqtt://mosquitto.dongyu.svc.cluster.local:1883';
  }
  if (evidence.service === 'mbr-worker') {
    return endpoint === 'mqtt://mosquitto.dongyu.svc.cluster.local:1883'
      || endpoint === 'http://synapse.dongyu.svc.cluster.local:8008'
      || endpoint === 'https://open.feishu.cn:443';
  }
  if (evidence.service === 'ui-server') {
    return endpoint === 'mqtt://mosquitto.dongyu.svc.cluster.local:1883'
      || endpoint === 'http://synapse.dongyu.svc.cluster.local:8008';
  }
  if (evidence.service === 'synapse') {
    return evidence.kind === 'effective_config' && endpoint === 'http://0.0.0.0:8008';
  }
  if (evidence.service === 'mosquitto') {
    return evidence.kind === 'effective_config' && endpoint === 'mqtt://0.0.0.0:1883';
  }
  return false;
}

export function evaluateDeNetworkBoundaryEvidence(evidence, { since = 0 } = {}) {
  if (!Number.isFinite(since)) return { ok: false, code: 'invalid_network_boundary_window' };
  if (!isExactEvidence(evidence)) return { ok: false, code: 'invalid_network_boundary_evidence' };
  if (evidence.ts < since) return { ok: false, code: 'stale_network_boundary_evidence' };
  if (!allowedDestination(evidence)) return { ok: false, code: 'network_boundary_violation' };
  return { ok: true, code: 'network_boundary_allowed' };
}

export function createDeNetworkBoundaryObservability({
  service,
  effectiveDestinations,
  writeLine,
  now = Date.now,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  heartbeatIntervalMs = 10000,
}) {
  if (!ACTOR_SERVICES.has(service)) throw new TypeError('service must identify a DE actor');
  if (!Array.isArray(effectiveDestinations) || effectiveDestinations.length === 0) {
    throw new TypeError('effectiveDestinations must be a non-empty array');
  }
  if (effectiveDestinations.some((destination) => typeof destination !== 'string' || destination.length === 0)) {
    throw new TypeError('effectiveDestinations must contain non-empty URLs');
  }
  if (typeof writeLine !== 'function') throw new TypeError('writeLine must be a function');
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  if (typeof setIntervalFn !== 'function' || typeof clearIntervalFn !== 'function') {
    throw new TypeError('timer functions are required');
  }
  if (!Number.isFinite(heartbeatIntervalMs) || heartbeatIntervalMs <= 0) {
    throw new TypeError('heartbeatIntervalMs must be positive');
  }

  const emit = (kind, destination) => {
    const evidence = buildDeNetworkBoundaryEvidence({
      kind,
      service,
      destination,
      ts: now(),
    });
    writeLine(formatDeNetworkBoundaryEvidenceLine(evidence));
    return evidence;
  };
  const emitEffectiveConfig = () => {
    for (const destination of effectiveDestinations) emit('effective_config', destination);
  };

  emitEffectiveConfig();
  const heartbeatTimer = setIntervalFn(emitEffectiveConfig, heartbeatIntervalMs);
  if (heartbeatTimer && typeof heartbeatTimer.unref === 'function') heartbeatTimer.unref();
  let stopped = false;
  return {
    recordOutbound(destination) {
      if (stopped) throw new Error('network_boundary_observability_stopped');
      return emit('outbound_attempt', destination);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearIntervalFn(heartbeatTimer);
    },
  };
}
