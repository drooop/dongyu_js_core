const { assertMgmtBusEventV0 } = require('./adapter.js');

function createLoopbackAdapter() {
  const listeners = new Set();
  const trace = [];

  function publish(event) {
    assertMgmtBusEventV0(event);
    trace.push({ type: 'publish', event });
    for (const fn of listeners) {
      fn(event);
    }
    return { ok: true };
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') {
      throw new Error('invalid_subscriber');
    }
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function list() {
    return trace.slice();
  }

  return {
    kind: 'loopback',
    publish,
    subscribe,
    trace: { list },
  };
}

module.exports = {
  createLoopbackAdapter,
};
