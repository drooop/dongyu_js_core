function serializePayload(payload) {
  if (typeof payload === 'string'
    || (typeof Buffer !== 'undefined' && Buffer.isBuffer(payload))) return payload;
  return JSON.stringify(payload);
}

export function publishMqttWithAck(client, topic, payload) {
  if (!client || typeof client.publish !== 'function') {
    return Promise.reject(new TypeError('mqtt client with publish is required'));
  }
  if (typeof topic !== 'string' || !topic) {
    return Promise.reject(new TypeError('mqtt publish topic is required'));
  }
  let body;
  try {
    body = serializePayload(payload);
  } catch (error) {
    return Promise.reject(error);
  }
  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    const settle = (error, acknowledgement) => {
      if (settled) return;
      settled = true;
      if (error) rejectPromise(error);
      else resolvePromise(acknowledgement);
    };
    try {
      client.publish(topic, body, (error, acknowledgement) => settle(error, acknowledgement));
    } catch (error) {
      settle(error);
    }
  });
}
