import { projectDePinFlowPacket } from './de_pin_flow_evidence.mjs';

function emitSafely(emitEvidence, onEvidenceError, stage, packet) {
  try {
    return emitEvidence(stage, packet);
  } catch (_) {
    try {
      onEvidenceError(Object.freeze({ code: 'pin_flow_evidence_rejected', stage }));
    } catch (_) {
      // Evidence reporting must remain redacted and must not replace the business result.
    }
    return null;
  }
}

function emitAfterSuccess(result, emit) {
  if (result && typeof result.then === 'function') {
    return result.then((value) => {
      emit();
      return value;
    });
  }
  emit();
  return result;
}

export function createR1PinFlowEvidenceWiring({ runtime, emitEvidence, onEvidenceError }) {
  if (!runtime || typeof runtime.mqttIncoming !== 'function'
    || !runtime.eventLog || typeof runtime.eventLog.setObserver !== 'function') {
    throw new TypeError('runtime with mqttIncoming and eventLog is required');
  }
  if (typeof emitEvidence !== 'function') throw new TypeError('emitEvidence must be a function');
  if (typeof onEvidenceError !== 'function') throw new TypeError('onEvidenceError must be a function');

  const runtimeMqttIncoming = runtime.mqttIncoming.bind(runtime);
  let activeIngress = null;
  const observeRuntimeEvent = (entry) => {
    if (!activeIngress
      || !entry
      || entry.op !== 'add_label'
      || entry.result !== 'applied'
      || !entry.cell
      || !entry.label
      || !Number.isInteger(entry.cell.model_id)
      || entry.cell.model_id <= 0
      || entry.cell.p !== 0
      || entry.cell.r !== 0
      || entry.cell.c !== 0
      || entry.label.t !== 'pin.in') return;
    const packet = { version: 'v1', type: 'pin_payload', payload: entry.label.v };
    let projected;
    try {
      projected = projectDePinFlowPacket(packet);
    } catch (_) {
      return;
    }
    if (projected.message_role !== 'request'
      || !activeIngress.projected
      || projected.request_id !== activeIngress.projected.request_id
      || projected.op_id !== activeIngress.projected.op_id
      || projected.endpoint.model_id !== entry.cell.model_id
      || projected.endpoint.pin !== entry.label.k) return;
    activeIngress.dispatched.push(packet);
  };
  runtime.eventLog.setObserver(observeRuntimeEvent);

  const mqttIncoming = (topic, packet) => {
    let projected = null;
    try {
      projected = projectDePinFlowPacket(packet);
    } catch (_) {
      // The runtime remains the transport authority; malformed evidence stays fail-closed.
    }
    const ingress = { dispatched: [], projected };
    activeIngress = ingress;
    let handled;
    try {
      handled = runtimeMqttIncoming(topic, packet);
    } finally {
      activeIngress = null;
    }
    if (handled === true) {
      const accepted = emitSafely(emitEvidence, onEvidenceError, 'control_ingress', packet);
      if (accepted) {
        for (const dispatchedPacket of ingress.dispatched) {
          emitSafely(emitEvidence, onEvidenceError, 'model_dispatch', dispatchedPacket);
        }
      }
    }
    return handled;
  };

  const publishControlResponse = (publish, topic, packet, ...args) => {
    if (typeof publish !== 'function') throw new TypeError('publish must be a function');
    const result = publish(topic, packet, ...args);
    return emitAfterSuccess(
      result,
      () => emitSafely(emitEvidence, onEvidenceError, 'control_response', packet),
    );
  };

  return Object.freeze({ mqttIncoming, observeRuntimeEvent, publishControlResponse });
}

export function createMbrPinFlowEvidenceWiring({ emitEvidence, onEvidenceError }) {
  if (typeof emitEvidence !== 'function') throw new TypeError('emitEvidence must be a function');
  if (typeof onEvidenceError !== 'function') throw new TypeError('onEvidenceError must be a function');

  const recordAcceptedIngress = (stage, packet, writeIngress) => {
    if (typeof writeIngress !== 'function') throw new TypeError('writeIngress must be a function');
    const result = writeIngress();
    if (result && result.applied === true) {
      emitSafely(emitEvidence, onEvidenceError, stage, packet);
    }
    return result;
  };

  const recordManagementIngress = (packet, writeIngress) => (
    recordAcceptedIngress('management_ingress', packet, writeIngress)
  );
  const recordControlResponseIngress = (packet, writeIngress) => (
    recordAcceptedIngress('control_response_ingress', packet, writeIngress)
  );
  const recordControlForward = (packet, publishResult) => emitAfterSuccess(
    publishResult,
    () => emitSafely(emitEvidence, onEvidenceError, 'control_forward', packet),
  );
  const publishManagementResponse = (publish, packet, ...args) => {
    if (typeof publish !== 'function') throw new TypeError('publish must be a function');
    const result = publish(packet, ...args);
    return emitAfterSuccess(
      result,
      () => emitSafely(emitEvidence, onEvidenceError, 'management_response_forward', packet),
    );
  };

  return Object.freeze({
    publishManagementResponse,
    recordControlForward,
    recordControlResponseIngress,
    recordManagementIngress,
  });
}
