let eventCounter = 0;

function ensureHostAdapter(host) {
  if (!host || typeof host.getSnapshot !== 'function') {
    throw new Error('Host adapter must provide getSnapshot()');
  }
  if (typeof host.dispatchAddLabel !== 'function') {
    throw new Error('Host adapter must provide dispatchAddLabel(label)');
  }
  if (typeof host.dispatchRmLabel !== 'function') {
    throw new Error('Host adapter must provide dispatchRmLabel(labelRef)');
  }
}

function getModel(snapshot) {
  if (!snapshot) return null;
  if (snapshot.models) {
    return snapshot.models[0] || snapshot.models['0'] || null;
  }
  if (snapshot.cells) {
    return snapshot;
  }
  return null;
}

function getLabelValue(snapshot, ref) {
  const model = getModel(snapshot);
  if (!model || !model.cells) return undefined;
  const key = `${ref.p},${ref.r},${ref.c}`;
  const cell = model.cells[key];
  if (!cell || !cell.labels) return undefined;
  const label = cell.labels[ref.k];
  if (!label) return undefined;
  return label.v;
}

function nextEventId() {
  eventCounter += 1;
  return `evt_${Date.now()}_${eventCounter}`;
}

function normalizeEvent(node, target, payload, overrideType) {
  const type = overrideType || target.event_type || 'event';
  return {
    event_id: nextEventId(),
    type,
    payload: payload === undefined ? null : payload,
    source: { node_id: node.id, node_type: node.type },
    ts: Date.now(),
  };
}

function buildEventLabel(target, envelope) {
  return {
    p: target.target.p,
    r: target.target.r,
    c: target.target.c,
    k: target.target.k,
    t: 'event',
    v: envelope,
  };
}

function renderTreeNode(node, snapshot) {
  const base = {
    id: node.id,
    type: node.type,
    props: node.props || {},
    children: [],
  };

  if (node.type === 'Root' || node.type === 'Container') {
    base.children = (node.children || []).map((child) => renderTreeNode(child, snapshot));
    return base;
  }

  if (node.type === 'Card') {
    base.title = (node.props && node.props.title) || '';
    base.children = (node.children || []).map((child) => renderTreeNode(child, snapshot));
    return base;
  }

  if (node.type === 'Text') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    base.text = value !== undefined ? String(value) : (node.props && node.props.text) || '';
    return base;
  }

  if (node.type === 'CodeBlock') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    base.text = value !== undefined ? String(value) : (node.props && node.props.text) || '';
    return base;
  }

  if (node.type === 'Input') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    base.value = value !== undefined ? value : '';
    return base;
  }

  if (node.type === 'Button') {
    base.label = (node.props && node.props.label) || '';
    return base;
  }

  return base;
}

function buildVueNode(node, snapshot, vue, host) {
  const h = vue.h;
  const resolve = vue.resolveComponent || ((name) => name);
  const children = (node.children || []).map((child) => buildVueNode(child, snapshot, vue, host));
  const props = { ...(node.props || {}) };

  if (node.type === 'Text') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    const text = value !== undefined ? String(value) : (node.props && node.props.text) || '';
    return h(resolve('ElText'), props, { default: () => text });
  }

  if (node.type === 'CodeBlock') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    const text = value !== undefined ? String(value) : (node.props && node.props.text) || '';
    return h('pre', props, text);
  }

  if (node.type === 'Input') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    props.modelValue = value !== undefined ? value : '';
    props.onInput = (ev) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      const payload = { value: ev && ev.target ? ev.target.value : ev };
      dispatchEvent(node, target, payload, host);
    };
    return h(resolve('ElInput'), props);
  }

  if (node.type === 'Button') {
    props.onClick = () => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      dispatchEvent(node, target, { click: true }, host);
    };
    return h(resolve('ElButton'), props, { default: () => (node.props && node.props.label) || '' });
  }

  if (node.type === 'Card') {
    const title = (node.props && node.props.title) || '';
    const cardProps = { ...props };
    delete cardProps.title;
    return h(resolve('ElCard'), cardProps, {
      header: () => title,
      default: () => children,
    });
  }

  if (node.type === 'Container') {
    const layout = (node.props && node.props.layout) || 'column';
    props.direction = layout === 'row' ? 'horizontal' : 'vertical';
    return h(resolve('ElSpace'), props, { default: () => children });
  }

  return h('div', props, children);
}

function dispatchEvent(node, target, payload, host, overrideType) {
  const envelope = normalizeEvent(node, target, payload, overrideType);
  const label = buildEventLabel(target, envelope);

  if (target.policy === 'clear_then_add') {
    host.dispatchRmLabel({
      p: target.target.p,
      r: target.target.r,
      c: target.target.c,
      k: target.target.k,
    });
  }

  host.dispatchAddLabel(label);
  return label;
}

function createRenderer(options) {
  const host = options && options.host;
  const vue = options && options.vue;
  ensureHostAdapter(host);

  return {
    renderTree(ast) {
      const snapshot = host.getSnapshot();
      return renderTreeNode(ast, snapshot);
    },
    renderVNode(ast) {
      if (!vue || typeof vue.h !== 'function') {
        throw new Error('Vue bridge not provided');
      }
      const snapshot = host.getSnapshot();
      return buildVueNode(ast, snapshot, vue, host);
    },
    dispatchEvent(node, payload, overrideType) {
      const target = node.bind && node.bind.write;
      if (!target) {
        return { skipped: true };
      }
      return dispatchEvent(node, target, payload, host, overrideType);
    },
  };
}

export { createRenderer };
