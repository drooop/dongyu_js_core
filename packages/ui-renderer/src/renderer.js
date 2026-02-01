let eventCounter = 0;
let editorEventCounter = 0;

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

function getModel(snapshot, modelId) {
  if (!snapshot) return null;
  if (snapshot.models) {
    const id = modelId === undefined ? 0 : modelId;
    return snapshot.models[id] || snapshot.models[String(id)] || null;
  }
  if (snapshot.cells) {
    return snapshot;
  }
  return null;
}

function getLabelValue(snapshot, ref) {
  const model = getModel(snapshot, ref && typeof ref.model_id === 'number' ? ref.model_id : undefined);
  if (!model || !model.cells) return undefined;
  const key = `${ref.p},${ref.r},${ref.c}`;
  const cell = model.cells[key];
  if (!cell || !cell.labels) return undefined;
  const label = cell.labels[ref.k];
  if (!label) return undefined;
  return label.v;
}

function getMailboxValue(snapshot) {
  const model = getModel(snapshot, -1);
  if (!model || !model.cells) return undefined;
  const cell = model.cells['0,0,1'];
  if (!cell || !cell.labels) return undefined;
  const label = cell.labels.ui_event;
  return label ? label.v : undefined;
}

function nextEventId() {
  eventCounter += 1;
  return `evt_${Date.now()}_${eventCounter}`;
}

function nextEditorEventId() {
  editorEventCounter += 1;
  return editorEventCounter;
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

function normalizeEditorEvent(payload) {
  const event_id = nextEditorEventId();
  const op_id = `op_${event_id}`;
  const body = { action: payload.action };
  if (payload.target !== undefined) {
    body.target = payload.target;
  }
  if (payload.value !== undefined) {
    body.value = payload.value;
  }
  body.meta = { op_id };
  return {
    event_id,
    type: payload.action,
    payload: body,
    source: 'ui_renderer',
    ts: 0,
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

function buildMailboxEventLabel(envelope) {
  return {
    p: 0,
    r: 0,
    c: 1,
    k: 'ui_event',
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

  if (
    node.type === 'Root'
    || node.type === 'Container'
    || node.type === 'Table'
    || node.type === 'TableColumn'
    || node.type === 'Tree'
    || node.type === 'Form'
    || node.type === 'FormItem'
    || node.type === 'TabPane'
  ) {
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

  if (node.type === 'DatePicker' || node.type === 'TimePicker') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    base.value = value !== undefined ? value : '';
    return base;
  }

  if (node.type === 'Tabs') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    base.value = value !== undefined ? value : '';
    base.children = (node.children || []).map((child) => renderTreeNode(child, snapshot));
    return base;
  }

  if (node.type === 'Dialog') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    base.value = value !== undefined ? Boolean(value) : false;
    base.children = (node.children || []).map((child) => renderTreeNode(child, snapshot));
    return base;
  }

  if (node.type === 'Pagination') {
    const models = node.bind && node.bind.models;
    const currentRead = models && models.currentPage && models.currentPage.read;
    const sizeRead = models && models.pageSize && models.pageSize.read;
    const currentValue = currentRead ? getLabelValue(snapshot, currentRead) : undefined;
    const sizeValue = sizeRead ? getLabelValue(snapshot, sizeRead) : undefined;
    if (currentValue !== undefined) base.currentPage = currentValue;
    if (sizeValue !== undefined) base.pageSize = sizeValue;
    return base;
  }

  if (node.type === 'Include') {
    // Keep tree node shallow; included fragment is resolved at render time.
    return base;
  }

  if (node.type === 'Select' || node.type === 'NumberInput' || node.type === 'Switch') {
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

  if (node.type === 'Include') {
    const ref = node.props && node.props.ref;
    const fallbackText = node.props && Object.prototype.hasOwnProperty.call(node.props, 'fallbackText')
      ? String(node.props.fallbackText)
      : 'Missing include';
    if (!ref || typeof ref !== 'object') {
      return h('div', fallbackText);
    }
    const fragment = getLabelValue(snapshot, ref);
    if (!fragment || typeof fragment !== 'object') {
      return h('div', fallbackText);
    }
    return buildVueNode(fragment, snapshot, vue, host);
  }

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
    props['onUpdate:modelValue'] = (ev) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      const payload = { value: ev && ev.target ? ev.target.value : ev };
      dispatchEvent(node, target, payload, host);
    };
    return h(resolve('ElInput'), props);
  }

  if (node.type === 'DatePicker') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    props.modelValue = value !== undefined ? value : '';
    const onValue = (v) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      dispatchEvent(node, target, { value: v }, host);
    };
    props['onUpdate:modelValue'] = onValue;
    const changeTarget = node.bind && node.bind.change;
    if (changeTarget) {
      props.onChange = (v) => {
        dispatchEvent(node, changeTarget, { value: v }, host, 'change');
      };
    }
    return h(resolve('ElDatePicker'), props);
  }

  if (node.type === 'TimePicker') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    props.modelValue = value !== undefined ? value : '';
    const onValue = (v) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      dispatchEvent(node, target, { value: v }, host);
    };
    props['onUpdate:modelValue'] = onValue;
    const changeTarget = node.bind && node.bind.change;
    if (changeTarget) {
      props.onChange = (v) => {
        dispatchEvent(node, changeTarget, { value: v }, host, 'change');
      };
    }
    return h(resolve('ElTimePicker'), props);
  }

  if (node.type === 'Select') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    const options = Array.isArray(props.options) ? props.options : [];
    delete props.options;
    props.modelValue = value !== undefined ? value : '';
    const onValue = (v) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      dispatchEvent(node, target, { value: v }, host);
    };
    props['onUpdate:modelValue'] = onValue;
    const optionNodes = options.map((opt, idx) => h(resolve('ElOption'), {
      key: opt && Object.prototype.hasOwnProperty.call(opt, 'value') ? opt.value : idx,
      label: opt && Object.prototype.hasOwnProperty.call(opt, 'label') ? opt.label : '',
      value: opt && Object.prototype.hasOwnProperty.call(opt, 'value') ? opt.value : undefined,
    }));
    return h(resolve('ElSelect'), props, { default: () => optionNodes.concat(children) });
  }

  if (node.type === 'NumberInput') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    props.modelValue = value !== undefined ? value : null;
    const onValue = (v) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      dispatchEvent(node, target, { value: v }, host);
    };
    props['onUpdate:modelValue'] = onValue;
    return h(resolve('ElInputNumber'), props);
  }

  if (node.type === 'Switch') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    if (value === true || value === false) {
      props.modelValue = value;
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === 'true') props.modelValue = true;
      else if (trimmed === 'false') props.modelValue = false;
      else props.modelValue = Boolean(value);
    } else {
      props.modelValue = value !== undefined ? Boolean(value) : false;
    }
    const onValue = (v) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      dispatchEvent(node, target, { value: v }, host);
    };
    props['onUpdate:modelValue'] = onValue;
    return h(resolve('ElSwitch'), props);
  }

  if (node.type === 'Tabs') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    props.modelValue = value !== undefined ? value : '';
    const onValue = (v) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      dispatchEvent(node, target, { value: v }, host);
    };
    props['onUpdate:modelValue'] = onValue;
    const changeTarget = node.bind && node.bind.change;
    if (changeTarget) {
      props.onTabChange = (v) => {
        dispatchEvent(node, changeTarget, { value: v }, host, 'change');
      };
    }
    return h(resolve('ElTabs'), props, { default: () => children });
  }

  if (node.type === 'TabPane') {
    return h(resolve('ElTabPane'), props, { default: () => children });
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

  if (node.type === 'Table') {
    return h(resolve('ElTable'), props, { default: () => children });
  }

  if (node.type === 'TableColumn') {
    return h(resolve('ElTableColumn'), props, children.length > 0 ? { default: () => children } : undefined);
  }

  if (node.type === 'Tree') {
    const changeTarget = node.bind && node.bind.change;
    if (changeTarget) {
      props.onNodeClick = (data) => {
        const path = data && Object.prototype.hasOwnProperty.call(data, 'path') ? data.path : undefined;
        dispatchEvent(node, changeTarget, { value: path }, host, 'change');
      };
    }
    return h(resolve('ElTree'), props);
  }

  if (node.type === 'Html') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    const html = value !== undefined
      ? String(value)
      : (node.props && Object.prototype.hasOwnProperty.call(node.props, 'html') ? String(node.props.html) : '');
    const divProps = { ...props };
    delete divProps.html;
    divProps.innerHTML = html;
    return h('div', divProps);
  }

  if (node.type === 'Link') {
    const href = Object.prototype.hasOwnProperty.call(props, 'href') ? props.href : '';
    const text = Object.prototype.hasOwnProperty.call(props, 'text') ? props.text : '';
    const aProps = { ...props, href: href || '', target: props.target || '_blank', rel: props.rel || 'noopener noreferrer' };
    delete aProps.text;
    return h('a', aProps, String(text || href || ''));
  }

  if (node.type === 'FileInput') {
    const accept = node.props && Object.prototype.hasOwnProperty.call(node.props, 'accept') ? node.props.accept : undefined;
    const multiple = Boolean(node.props && Object.prototype.hasOwnProperty.call(node.props, 'multiple') ? node.props.multiple : false);
    const directory = Boolean(node.props && Object.prototype.hasOwnProperty.call(node.props, 'directory') ? node.props.directory : false);
    const labelText = node.props && Object.prototype.hasOwnProperty.call(node.props, 'label') ? String(node.props.label) : '';
    const wrapStyle = node.props && node.props.style ? node.props.style : undefined;
    const multiAttr = multiple || directory;
    const onChange = (e) => {
      const input = e && e.target ? e.target : null;
      const files = input && input.files ? input.files : null;
      const target = node.bind && node.bind.write;
      if (!target) return;
      if (!files || files.length === 0) return;

      const readOne = (file) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (!(result instanceof ArrayBuffer)) {
            resolve(null);
            return;
          }
          const bytes = new Uint8Array(result);
          let binary = '';
          for (let i = 0; i < bytes.length; i += 1) {
            binary += String.fromCharCode(bytes[i]);
          }
          const b64 = btoa(binary);
          resolve(b64);
        };
        reader.onerror = () => resolve(null);
        reader.readAsArrayBuffer(file);
      });

      const shouldMulti = multiple || directory || files.length > 1;
      if (!shouldMulti) {
        const file = files[0];
        void readOne(file).then((b64) => {
          if (typeof b64 !== 'string' || b64.length === 0) return;
          dispatchEvent(node, target, { value: b64 }, host);
        });
        return;
      }

      const list = Array.from(files);
      void (async () => {
        const out = [];
        for (const f of list) {
          const b64 = await readOne(f);
          if (typeof b64 !== 'string' || b64.length === 0) continue;
          const relPath = String((f && Object.prototype.hasOwnProperty.call(f, 'webkitRelativePath') ? f.webkitRelativePath : '') || f.name || '').replace(/\\/g, '/');
          out.push({ path: relPath, b64 });
        }
        dispatchEvent(node, target, { value: out }, host);
      })();
    };
    return h('div', { style: wrapStyle }, [
      labelText ? h('div', { style: { marginBottom: '6px', fontSize: '12px', color: '#374151' } }, labelText) : null,
      h('input', { type: 'file', accept, multiple: multiAttr, webkitdirectory: directory, directory, onChange }),
    ].filter(Boolean));
  }

  if (node.type === 'Dialog') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    props.modelValue = value === true;
    props['onUpdate:modelValue'] = (v) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      dispatchEvent(node, target, { value: Boolean(v) }, host);
    };
    return h(resolve('ElDialog'), props, { default: () => children });
  }

  if (node.type === 'Pagination') {
    const models = node.bind && node.bind.models;
    const currentRead = models && models.currentPage && models.currentPage.read;
    const sizeRead = models && models.pageSize && models.pageSize.read;
    const currentValue = currentRead ? getLabelValue(snapshot, currentRead) : undefined;
    const sizeValue = sizeRead ? getLabelValue(snapshot, sizeRead) : undefined;
    if (currentValue !== undefined) {
      props.currentPage = currentValue;
    }
    if (sizeValue !== undefined) {
      props.pageSize = sizeValue;
    }
    const currentWrite = models && models.currentPage && models.currentPage.write;
    const sizeWrite = models && models.pageSize && models.pageSize.write;
    if (currentWrite) {
      const onCurrent = (v) => {
        dispatchEvent(node, currentWrite, { value: v }, host);
      };
      props['onUpdate:currentPage'] = onCurrent;
      props['onUpdate:current-page'] = onCurrent;
      const changeTarget = node.bind && node.bind.change;
      if (changeTarget) {
        props.onCurrentChange = (v) => {
          dispatchEvent(node, changeTarget, { value: v }, host, 'change');
        };
      }
    }
    if (sizeWrite) {
      const onSize = (v) => {
        dispatchEvent(node, sizeWrite, { value: v }, host);
      };
      props['onUpdate:pageSize'] = onSize;
      props['onUpdate:page-size'] = onSize;
      const changeTarget = node.bind && node.bind.change;
      if (changeTarget) {
        props.onSizeChange = (v) => {
          dispatchEvent(node, changeTarget, { value: v }, host, 'change');
        };
      }
    }
    return h(resolve('ElPagination'), props);
  }

  if (node.type === 'Form') {
    return h(resolve('ElForm'), props, { default: () => children });
  }

  if (node.type === 'FormItem') {
    return h(resolve('ElFormItem'), props, { default: () => children });
  }

  return h('div', props, children);
}

function dispatchEvent(node, target, payload, host, overrideType) {
  if (target && Object.prototype.hasOwnProperty.call(target, 'action')) {
    const snapshot = host.getSnapshot();
    const mailboxValue = getMailboxValue(snapshot);
    if (mailboxValue !== undefined && mailboxValue !== null) {
      return { skipped: true, reason: 'mailbox_full' };
    }

    const action = target.action;
    const out = { action };
    if (action !== 'submodel_create') {
      out.target = target.target_ref;
    }

    if (action === 'label_add' || action === 'label_update') {
      if (target.value_ref !== undefined) {
        out.value = target.value_ref;
      } else {
        const raw = payload && payload.value !== undefined ? payload.value : '';
        let t = 'str';
        if (typeof raw === 'boolean') {
          t = 'bool';
        } else if (typeof raw === 'number' && Number.isSafeInteger(raw)) {
          t = 'int';
        } else if (raw && typeof raw === 'object') {
          t = 'json';
        }
        out.value = { t, v: raw };
      }
    } else if (action === 'submodel_create') {
      out.value = target.value_ref;
    }

    const envelope = normalizeEditorEvent(out);
    const label = buildMailboxEventLabel(envelope);
    host.dispatchAddLabel(label);
    return label;
  }

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

module.exports = {
  createRenderer,
};
