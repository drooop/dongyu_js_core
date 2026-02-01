function createMbrBridge({ mgmtAdapter, mqttAdapter, topicPrefix = '' }) {
  if (!mgmtAdapter || typeof mgmtAdapter.subscribe !== 'function' || typeof mgmtAdapter.publish !== 'function') {
    throw new Error('invalid_mgmt_adapter');
  }
  if (!mqttAdapter || typeof mqttAdapter.subscribe !== 'function' || typeof mqttAdapter.publish !== 'function') {
    throw new Error('invalid_mqtt_adapter');
  }

  const seen = new Set();

  function topicFor(pin) {
    const prefix = topicPrefix ? `${topicPrefix}/` : '';
    return `${prefix}${pin}`;
  }

  function publishError(opId, code, detail) {
    const event = {
      version: 'v0',
      type: 'error',
      op_id: opId || 'op-unknown',
      payload: { code, detail },
    };
    mgmtAdapter.publish(event);
  }

  function handleMgmtEvent(event) {
    if (!event || event.type !== 'ui_event') return false;
    const opId = event.op_id;
    if (seen.has(opId)) {
      return false;
    }
    seen.add(opId);

    const pin = event.payload?.meta?.pin || null;
    if (!pin) {
      publishError(opId, 'missing_pin', 'payload.meta.pin required');
      return false;
    }

    const payload = {
      pin,
      t: 'IN',
      value: event.payload,
      op_id: opId,
    };
    mqttAdapter.publish(topicFor(pin), payload);
    return true;
  }

  function handleMqttMessage(topic, payload) {
    if (!topic || typeof topic !== 'string') return false;
    if (!payload || typeof payload !== 'object') return false;
    if (payload.t !== 'OUT') return false;
    const pin = payload.pin;
    if (!pin) return false;

    const opId = payload.op_id || payload.value?.op_id || 'op-unknown';
    const event = {
      version: 'v0',
      type: 'pin_out',
      op_id: opId,
      payload,
    };
    mgmtAdapter.publish(event);
    return true;
  }

  const unsubscribeMgmt = mgmtAdapter.subscribe(handleMgmtEvent);
  const unsubscribeMqtt = mqttAdapter.subscribe(({ topic, payload }) => handleMqttMessage(topic, payload));

  function close() {
    if (typeof unsubscribeMgmt === 'function') unsubscribeMgmt();
    if (typeof unsubscribeMqtt === 'function') unsubscribeMqtt();
  }

  return {
    handleMgmtEvent,
    handleMqttMessage,
    close,
  };
}

module.exports = {
  createMbrBridge,
};
