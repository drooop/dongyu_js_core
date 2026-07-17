export const ACTOR_ATTESTATION_MARKER = 'DE_ACTOR_ATTESTATION';

function rootCell(runtime) {
  const model0 = runtime && typeof runtime.getModel === 'function' ? runtime.getModel(0) : null;
  return model0 && model0.cells && typeof model0.cells.get === 'function'
    ? model0.cells.get('0,0,0') || null
    : null;
}

function labelValue(cell, key) {
  return cell && cell.labels && typeof cell.labels.get === 'function'
    ? cell.labels.get(key)?.v ?? null
    : null;
}

function mountedModelId(value) {
  if (Number.isInteger(value)) return value;
  if (value && typeof value === 'object' && Number.isInteger(value.model_id)) return value.model_id;
  return null;
}

export function buildDeActorAttestation({ runtime, sourceFiles = [] } = {}) {
  const root = rootCell(runtime);
  const rootForm = root?.labels?.get('model_type') || null;
  const busPins = root && root.labels
    ? [...root.labels.values()]
      .filter((label) => label && typeof label.t === 'string' && label.t.startsWith('pin.bus.'))
      .map((label) => ({ key: label.k, type: label.t }))
      .sort((left, right) => left.key.localeCompare(right.key))
    : [];
  const mountedModels = new Set();
  if (runtime && runtime.models && typeof runtime.models.values === 'function') {
    for (const model of runtime.models.values()) {
      if (!model || !model.cells || typeof model.cells.values !== 'function') continue;
      for (const cell of model.cells.values()) {
        if (!cell || !cell.labels || typeof cell.labels.values !== 'function') continue;
        for (const label of cell.labels.values()) {
          if (!label || label.t !== 'model.submtconnection') continue;
          const modelId = mountedModelId(label.v);
          if (Number.isInteger(modelId)) mountedModels.add(modelId);
        }
      }
    }
  }

  return {
    worker_id: labelValue(root, 'sys_worker_id'),
    worker_role: labelValue(root, 'sys_worker_role'),
    worker_alias: labelValue(root, 'mqtt_worker_id') ?? labelValue(root, 'workspace_manager_worker_id'),
    topic_base: labelValue(root, 'mqtt_topic_base'),
    root_form: rootForm ? { key: rootForm.k, type: rootForm.t, value: rootForm.v } : null,
    bus_pins: busPins,
    mounted_models: [...mountedModels].sort((left, right) => left - right),
    source_files: Array.isArray(sourceFiles) ? sourceFiles.map((sourceFile) => String(sourceFile)) : [],
  };
}

export function formatDeActorAttestationLine(attestation) {
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)) {
    throw new TypeError('attestation must be an object');
  }
  return `${ACTOR_ATTESTATION_MARKER} ${JSON.stringify(attestation)}`;
}

export function createDeActorAttestationHeartbeat({
  attestation,
  writeLine,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  heartbeatIntervalMs = 10000,
}) {
  if (typeof writeLine !== 'function') throw new TypeError('writeLine must be a function');
  if (typeof setTimeoutFn !== 'function' || typeof clearTimeoutFn !== 'function') {
    throw new TypeError('timer functions are required');
  }
  if (!Number.isFinite(heartbeatIntervalMs) || heartbeatIntervalMs <= 0) {
    throw new TypeError('heartbeatIntervalMs must be positive');
  }
  const line = formatDeActorAttestationLine(attestation);
  const emit = () => {
    writeLine(line);
    return line;
  };
  let stopped = false;
  let timer = null;
  const schedule = () => {
    if (stopped) return;
    timer = setTimeoutFn(() => {
      if (stopped) return;
      emit();
      schedule();
    }, heartbeatIntervalMs);
    if (timer && typeof timer.unref === 'function') timer.unref();
  };
  schedule();
  return {
    emit,
    stop() {
      if (stopped) return;
      stopped = true;
      if (timer !== null) clearTimeoutFn(timer);
      timer = null;
    },
  };
}
