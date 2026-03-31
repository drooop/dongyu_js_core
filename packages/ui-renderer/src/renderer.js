const registryModule = require('./component_registry_v1.js');

let eventCounter = 0;
let editorEventCounter = 0;
const DEFAULT_REGISTRY = registryModule && registryModule.components
  ? registryModule
  : (registryModule && registryModule.default && registryModule.default.components ? registryModule.default : { version: 'ui.component_registry.v1', components: {} });

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

function normalizeSelectModelValue(value, options) {
  if (!Array.isArray(options) || options.length === 0 || value === undefined) return value;
  if (options.some((opt) => opt && Object.prototype.hasOwnProperty.call(opt, 'value') && Object.is(opt.value, value))) {
    return value;
  }
  if (typeof value !== 'string' && typeof value !== 'number') return value;
  const normalizedValue = String(value);
  for (const opt of options) {
    if (!opt || !Object.prototype.hasOwnProperty.call(opt, 'value')) continue;
    const optionValue = opt.value;
    if ((typeof optionValue === 'string' || typeof optionValue === 'number') && String(optionValue) === normalizedValue) {
      return optionValue;
    }
  }
  return value;
}

function getEffectiveLabelValue(snapshot, ref, host) {
  if (host && typeof host.getEffectiveLabelValue === 'function') {
    const value = host.getEffectiveLabelValue(ref);
    if (value !== undefined) return value;
  }
  return getLabelValue(snapshot, ref);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringifyForCodeBlock(value) {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (_) {
    return String(value);
  }
}

function resolveRefValue(ref, ctx) {
  if (!ctx || typeof ref !== 'string') return undefined;
  if (ref === '$index') return ctx.$index;
  if (ref === 'row') return ctx.row;
  if (ref.startsWith('row.')) {
    let cur = ctx.row;
    const parts = ref.slice('row.'.length).split('.');
    for (const p of parts) {
      if (!cur || (typeof cur !== 'object' && typeof cur !== 'function')) return undefined;
      cur = cur[p];
    }
    return cur;
  }
  return undefined;
}

function resolveRefsDeep(value, ctx, snapshot) {
  if (!value) return value;
  if (isPlainObject(value) && Object.keys(value).length === 1 && Object.prototype.hasOwnProperty.call(value, '$label')) {
    const ref = resolveRefsDeep(value.$label, ctx, snapshot);
    return snapshot ? getLabelValue(snapshot, ref) : undefined;
  }
  if (isPlainObject(value) && typeof value.$ref === 'string' && Object.keys(value).length === 1) {
    if (!ctx) return value;
    return resolveRefValue(value.$ref, ctx);
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveRefsDeep(v, ctx, snapshot));
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveRefsDeep(v, ctx, snapshot);
    }
    return out;
  }
  return value;
}

function readPropValueFromSnapshot(snapshot, props, valueKey, refKey) {
  if (!isPlainObject(props)) return undefined;
  if (Object.prototype.hasOwnProperty.call(props, valueKey)) {
    return props[valueKey];
  }
  const ref = props[refKey];
  if (isPlainObject(ref)) {
    return getLabelValue(snapshot, ref);
  }
  return undefined;
}

function inferThreeSceneModelId(props) {
  if (!isPlainObject(props)) return null;
  if (Number.isInteger(props.sceneModelId)) return props.sceneModelId;
  const refKeys = ['sceneGraphRef', 'cameraStateRef', 'selectedEntityIdRef', 'sceneStatusRef', 'auditLogRef'];
  for (const key of refKeys) {
    const ref = props[key];
    if (isPlainObject(ref) && Number.isInteger(ref.model_id)) {
      return ref.model_id;
    }
  }
  return null;
}

function normalizeThreeSceneHostProps(snapshot, props) {
  const sceneGraph = readPropValueFromSnapshot(snapshot, props, 'sceneGraph', 'sceneGraphRef');
  const cameraState = readPropValueFromSnapshot(snapshot, props, 'cameraState', 'cameraStateRef');
  const selectedEntityId = readPropValueFromSnapshot(snapshot, props, 'selectedEntityId', 'selectedEntityIdRef');
  const sceneStatus = readPropValueFromSnapshot(snapshot, props, 'sceneStatus', 'sceneStatusRef');
  const auditLog = readPropValueFromSnapshot(snapshot, props, 'auditLog', 'auditLogRef');
  const nextProps = {
    ...props,
    sceneModelId: inferThreeSceneModelId(props),
    sceneGraph: isPlainObject(sceneGraph) ? sceneGraph : { entities: [] },
    cameraState: isPlainObject(cameraState) ? cameraState : {},
    selectedEntityId: selectedEntityId == null ? '' : String(selectedEntityId),
    sceneStatus: sceneStatus == null ? '' : String(sceneStatus),
    auditLog: auditLog == null ? '' : String(auditLog),
  };
  if (!isPlainObject(nextProps.actions)) {
    nextProps.actions = {};
  }
  return nextProps;
}

function ensureSingleFlightStore(host) {
  if (!host) return null;
  if (!host.__dySingleFlightStore || !(host.__dySingleFlightStore instanceof Map)) {
    host.__dySingleFlightStore = new Map();
  }
  return host.__dySingleFlightStore;
}

function singleFlightValueKey(value) {
  if (value === null || value === undefined) return '__nil__';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
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
    source: { node_id: node.id, node_type: node.origin_type || node.type },
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

function normalizeRegistry(registry) {
  if (!registry || !isPlainObject(registry) || !isPlainObject(registry.components)) {
    return DEFAULT_REGISTRY;
  }
  return registry;
}

function normalizeCommitPolicy(target) {
  const raw = target && typeof target.commit_policy === 'string'
    ? target.commit_policy.trim()
    : '';
  if (raw === 'on_change' || raw === 'on_blur' || raw === 'on_submit' || raw === 'immediate') {
    return raw;
  }
  return 'immediate';
}

function shouldUseOverlay(host, node, target) {
  if (!host || typeof host.stageOverlayValue !== 'function') return false;
  const readRef = node && node.bind && node.bind.read;
  if (!readRef || !isPlainObject(readRef) || !Number.isInteger(readRef.model_id)) return false;
  if (readRef.model_id === 0 || readRef.model_id === -1) return false;
  return normalizeCommitPolicy(target) !== 'immediate';
}

function stageOverlay(node, target, value, host) {
  if (!host || typeof host.stageOverlayValue !== 'function') return;
  const readRef = node && node.bind && node.bind.read;
  host.stageOverlayValue({ ref: readRef, value, writeTarget: target });
}

function commitOverlay(node, target, value, host) {
  if (!host || typeof host.commitOverlayValue !== 'function') return;
  const readRef = node && node.bind && node.bind.read;
  host.commitOverlayValue({ ref: readRef, value, writeTarget: target });
}

function resolveComponentSpec(registry, type) {
  const normalized = normalizeRegistry(registry);
  const spec = normalized.components && normalized.components[type];
  if (!spec || !isPlainObject(spec)) {
    throw new Error(`Unknown component type: ${type}`);
  }
  return spec;
}

function adaptNodeType(node, kindField, spec) {
  const kind = spec && typeof spec[kindField] === 'string' && spec[kindField].trim().length > 0
    ? spec[kindField]
    : node.type;
  if (kind === node.type) return node;
  return { ...node, type: kind, origin_type: node.type };
}

function renderTreeNode(node, snapshot, registry) {
  const spec = resolveComponentSpec(registry, node.type);
  const runtimeNode = adaptNodeType(node, 'tree_kind', spec);
  const base = {
    id: runtimeNode.id,
    type: node.type,
    props: runtimeNode.props || {},
    children: [],
  };

  if (
    runtimeNode.type === 'Root'
    || runtimeNode.type === 'Container'
    || runtimeNode.type === 'Table'
    || runtimeNode.type === 'TableColumn'
    || runtimeNode.type === 'Tree'
    || runtimeNode.type === 'Form'
    || runtimeNode.type === 'FormItem'
    || runtimeNode.type === 'TabPane'
  ) {
    base.children = (runtimeNode.children || []).map((child) => renderTreeNode(child, snapshot, registry));
    return base;
  }

  if (runtimeNode.type === 'Card') {
    const title = runtimeNode.props && Object.prototype.hasOwnProperty.call(runtimeNode.props, 'title')
      ? resolveRefsDeep(runtimeNode.props.title, null, snapshot)
      : '';
    base.title = title === undefined ? '' : title;
    base.children = (runtimeNode.children || []).map((child) => renderTreeNode(child, snapshot, registry));
    return base;
  }

  if (runtimeNode.type === 'Text') {
    const bind = runtimeNode.bind && runtimeNode.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    base.text = value !== undefined ? String(value) : (runtimeNode.props && runtimeNode.props.text) || '';
    return base;
  }

  if (runtimeNode.type === 'CodeBlock') {
    const bind = runtimeNode.bind && runtimeNode.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    base.text = value !== undefined ? stringifyForCodeBlock(value) : (runtimeNode.props && runtimeNode.props.text) || '';
    return base;
  }

  if (runtimeNode.type === 'Input') {
    const bind = runtimeNode.bind && runtimeNode.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    base.value = value !== undefined ? value : '';
    return base;
  }

  if (runtimeNode.type === 'DatePicker' || runtimeNode.type === 'TimePicker') {
    const bind = runtimeNode.bind && runtimeNode.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    base.value = value !== undefined ? value : '';
    return base;
  }

  if (runtimeNode.type === 'Tabs') {
    const bind = runtimeNode.bind && runtimeNode.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    base.value = value !== undefined ? value : '';
    base.children = (runtimeNode.children || []).map((child) => renderTreeNode(child, snapshot, registry));
    return base;
  }

  if (runtimeNode.type === 'Dialog') {
    const bind = runtimeNode.bind && runtimeNode.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    base.value = value !== undefined ? Boolean(value) : false;
    base.children = (runtimeNode.children || []).map((child) => renderTreeNode(child, snapshot, registry));
    return base;
  }

  if (runtimeNode.type === 'Pagination') {
    const models = runtimeNode.bind && runtimeNode.bind.models;
    const currentRead = models && models.currentPage && models.currentPage.read;
    const sizeRead = models && models.pageSize && models.pageSize.read;
    const currentValue = currentRead ? getLabelValue(snapshot, currentRead) : undefined;
    const sizeValue = sizeRead ? getLabelValue(snapshot, sizeRead) : undefined;
    if (currentValue !== undefined) base.currentPage = currentValue;
    if (sizeValue !== undefined) base.pageSize = sizeValue;
    return base;
  }

  if (
    runtimeNode.type === 'Select'
    || runtimeNode.type === 'NumberInput'
    || runtimeNode.type === 'Switch'
    || runtimeNode.type === 'Checkbox'
    || runtimeNode.type === 'RadioGroup'
    || runtimeNode.type === 'Radio'
    || runtimeNode.type === 'Slider'
  ) {
    const bind = runtimeNode.bind && runtimeNode.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    base.value = value !== undefined ? value : '';
    return base;
  }

  if (runtimeNode.type === 'Button') {
    base.label = (runtimeNode.props && runtimeNode.props.label) || '';
    return base;
  }

  if (runtimeNode.type === 'ThreeScene') {
    base.props = normalizeThreeSceneHostProps(snapshot, runtimeNode.props || {});
    return base;
  }

  if (runtimeNode.type === 'ProgressBar') {
    const bind = runtimeNode.bind && runtimeNode.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    base.percentage = value !== undefined ? Number(value) : (runtimeNode.props && runtimeNode.props.percentage) || 0;
    return base;
  }

  if (runtimeNode.type === 'Divider' || runtimeNode.type === 'Breadcrumb') {
    return base;
  }

  return base;
}

function buildVueNode(node, snapshot, vue, host, registry) {
  const ctx = arguments.length > 5 ? arguments[5] : null;
  const spec = resolveComponentSpec(registry, node.type);
  node = adaptNodeType(node, 'vnode_kind', spec);
  const h = vue.h;
  const resolve = vue.resolveComponent || ((name) => name);
  const children = (node.children || []).map((child) => buildVueNode(child, snapshot, vue, host, registry, ctx));
  const props = resolveRefsDeep({ ...(node.props || {}) }, ctx, snapshot);

  if (node.type === 'Include') {
    const ref = props && Object.prototype.hasOwnProperty.call(props, 'ref') ? props.ref : null;
    const fallbackText = props && Object.prototype.hasOwnProperty.call(props, 'fallbackText') ? String(props.fallbackText) : 'Missing include';
    if (!ref || typeof ref !== 'object') {
      return h('div', fallbackText);
    }
    const fragment = getLabelValue(snapshot, ref);
    if (!fragment || typeof fragment !== 'object') {
      return h('div', fallbackText);
    }
    return buildVueNode(fragment, snapshot, vue, host, registry, ctx);
  }

  if (node.type === 'Text') {
    const bind = node.bind && node.bind.read;
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const value = bind ? (direct !== undefined ? direct : getLabelValue(snapshot, bind)) : undefined;
    const text = value !== undefined ? String(value) : (props && Object.prototype.hasOwnProperty.call(props, 'text') ? props.text : '');

    // Size variants mapping
    const sizeMap = {
      xs: '12px', sm: '13px', md: '14px', lg: '16px', xl: '20px', xxl: '24px', stat: '36px',
    };
    // Weight variants mapping
    const weightMap = {
      normal: '400', medium: '500', semibold: '600', bold: '700',
    };
    // Color variants mapping (from design system)
    const colorMap = {
      primary: '#1E293B', secondary: '#64748B', muted: '#94A3B8',
      success: '#22C55E', warning: '#F59E0B', error: '#EF4444', info: '#3B82F6',
    };

    const textStyle = { ...(props.style || {}) };
    if (props.size && sizeMap[props.size]) {
      textStyle.fontSize = sizeMap[props.size];
    }
    if (props.weight && weightMap[props.weight]) {
      textStyle.fontWeight = weightMap[props.weight];
    }
    if (props.color && colorMap[props.color]) {
      textStyle.color = colorMap[props.color];
    }

    const textProps = { ...props };
    delete textProps.size;
    delete textProps.weight;
    delete textProps.color;
    delete textProps.text;
    if (Object.keys(textStyle).length > 0) {
      textProps.style = textStyle;
    }

    return h(resolve('ElText'), textProps, { default: () => text });
  }

  if (node.type === 'CodeBlock') {
    const bind = node.bind && node.bind.read;
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const value = bind ? (direct !== undefined ? direct : getLabelValue(snapshot, bind)) : undefined;
    const text = value !== undefined ? stringifyForCodeBlock(value) : (props && Object.prototype.hasOwnProperty.call(props, 'text') ? props.text : '');
    return h('pre', props, text);
  }

  if (node.type === 'Input') {
    const bind = node.bind && node.bind.read;
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const value = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host)) : undefined;
    props.modelValue = value !== undefined ? value : '';
    let lastEmittedValue = props.modelValue;
    const emitValue = (ev) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      let nextValue = ev && ev.target ? ev.target.value : ev;
      if (typeof document !== 'undefined') {
        const active = document.activeElement;
        if (active && Object.prototype.hasOwnProperty.call(active, 'value')) {
          const activeValue = active.value;
          if (nextValue === undefined || (typeof activeValue === 'string' && typeof nextValue === 'string' && activeValue.length >= nextValue.length)) {
            nextValue = activeValue;
          }
        }
      }
      if (nextValue === lastEmittedValue) return;
      lastEmittedValue = nextValue;
      if (shouldUseOverlay(host, node, target)) {
        stageOverlay(node, target, nextValue, host);
        return;
      }
      const payload = { value: nextValue };
      dispatchEvent(node, target, payload, host, undefined, ctx);
    };
    props['onUpdate:modelValue'] = emitValue;
    props.onInput = emitValue;
    const commitPolicy = normalizeCommitPolicy(node.bind && node.bind.write);
    if (commitPolicy === 'on_blur') {
      props.onBlur = () => {
        const target = node.bind && node.bind.write;
        if (!target) return;
        commitOverlay(node, target, undefined, host);
      };
    } else if (commitPolicy === 'on_change') {
      props.onChange = (v) => {
        const target = node.bind && node.bind.write;
        if (!target) return;
        commitOverlay(node, target, v, host);
      };
    }
    return h(resolve('ElInput'), props);
  }

  if (node.type === 'DatePicker') {
    const bind = node.bind && node.bind.read;
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const value = bind ? (direct !== undefined ? direct : getLabelValue(snapshot, bind)) : undefined;
    props.modelValue = value !== undefined ? value : '';
    const onValue = (v) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      dispatchEvent(node, target, { value: v }, host, undefined, ctx);
    };
    props['onUpdate:modelValue'] = onValue;
    const changeTarget = node.bind && node.bind.change;
    if (changeTarget) {
      props.onChange = (v) => {
        dispatchEvent(node, changeTarget, { value: v }, host, 'change', ctx);
      };
    }
    return h(resolve('ElDatePicker'), props);
  }

  if (node.type === 'TimePicker') {
    const bind = node.bind && node.bind.read;
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const value = bind ? (direct !== undefined ? direct : getLabelValue(snapshot, bind)) : undefined;
    props.modelValue = value !== undefined ? value : '';
    const onValue = (v) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      dispatchEvent(node, target, { value: v }, host, undefined, ctx);
    };
    props['onUpdate:modelValue'] = onValue;
    const changeTarget = node.bind && node.bind.change;
    if (changeTarget) {
      props.onChange = (v) => {
        dispatchEvent(node, changeTarget, { value: v }, host, 'change', ctx);
      };
    }
    return h(resolve('ElTimePicker'), props);
  }

  if (node.type === 'Select') {
    const bind = node.bind && node.bind.read;
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const value = bind ? (direct !== undefined ? direct : getLabelValue(snapshot, bind)) : undefined;
    const options = Array.isArray(props.options) ? props.options : [];
    delete props.options;
    props.modelValue = value !== undefined ? normalizeSelectModelValue(value, options) : '';
    const onValue = (v) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      dispatchEvent(node, target, { value: v }, host, undefined, ctx);
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
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const value = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host)) : undefined;
    props.modelValue = value !== undefined ? value : null;
    const onValue = (v) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      if (shouldUseOverlay(host, node, target)) {
        stageOverlay(node, target, v, host);
        return;
      }
      dispatchEvent(node, target, { value: v }, host, undefined, ctx);
    };
    props['onUpdate:modelValue'] = onValue;
    if (normalizeCommitPolicy(node.bind && node.bind.write) === 'on_change') {
      props.onChange = (v) => {
        const target = node.bind && node.bind.write;
        if (!target) return;
        commitOverlay(node, target, v, host);
      };
    }
    return h(resolve('ElInputNumber'), props);
  }

  if (node.type === 'Switch') {
    const bind = node.bind && node.bind.read;
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const value = bind ? (direct !== undefined ? direct : getLabelValue(snapshot, bind)) : undefined;
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
      dispatchEvent(node, target, { value: v }, host, undefined, ctx);
    };
    props['onUpdate:modelValue'] = onValue;
    return h(resolve('ElSwitch'), props);
  }

  if (node.type === 'Checkbox') {
    const bind = node.bind && node.bind.read;
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const value = bind ? (direct !== undefined ? direct : getLabelValue(snapshot, bind)) : undefined;
    if (Array.isArray(value)) {
      props.modelValue = value;
    } else if (value === true || value === false) {
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
      dispatchEvent(node, target, { value: v }, host, undefined, ctx);
    };
    props['onUpdate:modelValue'] = onValue;
    const changeTarget = node.bind && node.bind.change;
    if (changeTarget) {
      props.onChange = (v) => {
        dispatchEvent(node, changeTarget, { value: v }, host, 'change', ctx);
      };
    }
    const labelText = Object.prototype.hasOwnProperty.call(props, 'text') ? props.text : '';
    if (Object.prototype.hasOwnProperty.call(props, 'text')) {
      delete props.text;
    }
    return h(resolve('ElCheckbox'), props, {
      default: () => (children.length > 0 ? children : labelText),
    });
  }

  if (node.type === 'RadioGroup') {
    const bind = node.bind && node.bind.read;
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const value = bind ? (direct !== undefined ? direct : getLabelValue(snapshot, bind)) : undefined;
    const options = Array.isArray(props.options) ? props.options : [];
    delete props.options;
    props.modelValue = value !== undefined ? value : '';
    const onValue = (v) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      dispatchEvent(node, target, { value: v }, host, undefined, ctx);
    };
    props['onUpdate:modelValue'] = onValue;
    const changeTarget = node.bind && node.bind.change;
    if (changeTarget) {
      props.onChange = (v) => {
        dispatchEvent(node, changeTarget, { value: v }, host, 'change', ctx);
      };
    }
    const optionNodes = options.map((opt, idx) => h(resolve('ElRadio'), {
      key: opt && Object.prototype.hasOwnProperty.call(opt, 'value') ? opt.value : idx,
      label: opt && Object.prototype.hasOwnProperty.call(opt, 'value') ? opt.value : undefined,
      disabled: opt && Object.prototype.hasOwnProperty.call(opt, 'disabled') ? opt.disabled : undefined,
    }, {
      default: () => (opt && Object.prototype.hasOwnProperty.call(opt, 'label') ? opt.label : ''),
    }));
    return h(resolve('ElRadioGroup'), props, { default: () => optionNodes.concat(children) });
  }

  if (node.type === 'Radio') {
    const labelText = Object.prototype.hasOwnProperty.call(props, 'text') ? props.text : '';
    if (Object.prototype.hasOwnProperty.call(props, 'text')) {
      delete props.text;
    }
    if (!Object.prototype.hasOwnProperty.call(props, 'label') && Object.prototype.hasOwnProperty.call(props, 'value')) {
      props.label = props.value;
    }
    return h(resolve('ElRadio'), props, {
      default: () => (children.length > 0 ? children : labelText),
    });
  }

  if (node.type === 'Slider') {
    const bind = node.bind && node.bind.read;
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const value = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host)) : undefined;
    props.modelValue = value !== undefined ? value : 0;
    const onValue = (v) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      if (shouldUseOverlay(host, node, target)) {
        stageOverlay(node, target, v, host);
        return;
      }
      dispatchEvent(node, target, { value: v }, host, undefined, ctx);
    };
    props['onUpdate:modelValue'] = onValue;
    const changeTarget = node.bind && node.bind.change;
    if (changeTarget) {
      props.onChange = (v) => {
        const target = node.bind && node.bind.write;
        if (target && normalizeCommitPolicy(target) === 'on_change') {
          commitOverlay(node, target, v, host);
        }
        dispatchEvent(node, changeTarget, { value: v }, host, 'change', ctx);
      };
    } else if (normalizeCommitPolicy(node.bind && node.bind.write) === 'on_change') {
      props.onChange = (v) => {
        const target = node.bind && node.bind.write;
        if (!target) return;
        commitOverlay(node, target, v, host);
      };
    }
    return h(resolve('ElSlider'), props);
  }

  if (node.type === 'Tabs') {
    const bind = node.bind && node.bind.read;
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const value = bind ? (direct !== undefined ? direct : getLabelValue(snapshot, bind)) : undefined;
    props.modelValue = value !== undefined ? value : '';
    const onValue = (v) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      dispatchEvent(node, target, { value: v }, host, undefined, ctx);
    };
    props['onUpdate:modelValue'] = onValue;
    const changeTarget = node.bind && node.bind.change;
    if (changeTarget) {
      props.onTabChange = (v) => {
        dispatchEvent(node, changeTarget, { value: v }, host, 'change', ctx);
      };
    }
    return h(resolve('ElTabs'), props, { default: () => children });
  }

  if (node.type === 'TabPane') {
    return h(resolve('ElTabPane'), props, { default: () => children });
  }

  if (node.type === 'Button') {
    const bind = node.bind && node.bind.read;
    if (bind) {
      const value = getLabelValue(snapshot, bind);
      if (value === false) {
        props.disabled = true;
      } else if (value === true) {
        props.disabled = false;
      }
    }
    const singleFlight = node.props && node.props.singleFlight;
    const singleFlightEnabled = Boolean(singleFlight);
    const singleFlightStore = singleFlightEnabled ? ensureSingleFlightStore(host) : null;
    const singleFlightKey = singleFlightEnabled
      ? (singleFlight.key || node.id || `${node.type}`)
      : null;
    const releaseRef = singleFlightEnabled ? (singleFlight.releaseRef || singleFlight.release_ref || null) : null;
    const releaseVal = releaseRef ? getLabelValue(snapshot, releaseRef) : null;
    const releaseKey = singleFlightValueKey(releaseVal);
    const releaseWhenValue = singleFlightEnabled && Object.prototype.hasOwnProperty.call(singleFlight, 'releaseWhen')
      ? singleFlight.releaseWhen
      : undefined;
    const releaseWhenKey = singleFlightEnabled && releaseWhenValue !== undefined
      ? singleFlightValueKey(releaseWhenValue)
      : null;

    let flightState = singleFlightEnabled && singleFlightStore ? singleFlightStore.get(singleFlightKey) : null;
    if (singleFlightEnabled && !flightState) {
      flightState = { pending: false, releaseKey };
      singleFlightStore.set(singleFlightKey, flightState);
    }
    if (singleFlightEnabled && flightState && flightState.pending && releaseRef) {
      const shouldRelease = releaseWhenKey !== null
        ? releaseKey === releaseWhenKey
        : releaseKey !== flightState.releaseKey;
      if (shouldRelease) {
        flightState.pending = false;
        flightState.releaseKey = releaseKey;
        singleFlightStore.set(singleFlightKey, flightState);
      }
    }
    const pendingLocal = Boolean(singleFlightEnabled && flightState && flightState.pending);
    const schemaLoading = Object.prototype.hasOwnProperty.call(props, 'loading') ? Boolean(props.loading) : false;
    props.loading = pendingLocal || schemaLoading;
    if (pendingLocal) {
      props.disabled = true;
    }

    props.onClick = () => {
      if (singleFlightEnabled && flightState && flightState.pending) {
        return;
      }

      if (singleFlightEnabled && singleFlightStore) {
        const nextState = {
          pending: true,
          releaseKey,
        };
        flightState = nextState;
        singleFlightStore.set(singleFlightKey, nextState);
      }

      const target = node.bind && node.bind.write;
      if (!target) return;
      const result = dispatchEvent(node, target, { click: true }, host, undefined, ctx);
      if (singleFlightEnabled && singleFlightStore && result && result.skipped) {
        const recoverState = {
          pending: false,
          releaseKey,
        };
        flightState = recoverState;
        singleFlightStore.set(singleFlightKey, recoverState);
      }
    };

    // Variant support: pill (capsule button), text, link
    const variant = node.props && node.props.variant;
    if (variant === 'pill') {
      props.round = true;
      props.style = { borderRadius: '9999px', paddingLeft: '24px', paddingRight: '24px', ...(props.style || {}) };
    } else if (variant === 'text') {
      props.text = true;
    } else if (variant === 'link') {
      props.link = true;
    }

    // Icon support
    const icon = node.props && node.props.icon;
    const iconPosition = (node.props && node.props.iconPosition) || 'left';
    const label = (node.props && node.props.label) || '';

    // Clean up custom props from ElButton
    const buttonProps = { ...props };
    delete buttonProps.variant;
    delete buttonProps.icon;
    delete buttonProps.iconPosition;
    delete buttonProps.label;
    delete buttonProps.singleFlight;

    // Icon mapping (simple emoji/symbol icons for now)
    const iconMap = {
      refresh: '↻', close: '✕', check: '✓', plus: '+', minus: '−',
      search: '🔍', download: '⬇', upload: '⬆', copy: '📋', trash: '🗑',
      edit: '✎', clock: '🕐', settings: '⚙', user: '👤', star: '★',
    };
    const iconChar = icon && iconMap[icon] ? iconMap[icon] : (icon || '');

    if (iconChar) {
      const iconSpan = h('span', { style: { marginRight: iconPosition === 'left' && label ? '6px' : '0', marginLeft: iconPosition === 'right' && label ? '6px' : '0' } }, iconChar);
      const content = iconPosition === 'left' ? [iconSpan, label] : [label, iconSpan];
      return h(resolve('ElButton'), buttonProps, { default: () => content });
    }

    return h(resolve('ElButton'), buttonProps, { default: () => label });
  }

  if (node.type === 'Drawer') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    props.modelValue = value === true;
    props['onUpdate:modelValue'] = (v) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      dispatchEvent(node, target, { value: Boolean(v) }, host, undefined, ctx);
    };
    return h(resolve('ElDrawer'), props, { default: () => children });
  }

  if (node.type === 'Dialog') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    props.modelValue = value === true;
    props['onUpdate:modelValue'] = (v) => {
      const target = node.bind && node.bind.write;
      if (!target) return;
      dispatchEvent(node, target, { value: Boolean(v) }, host, undefined, ctx);
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
        dispatchEvent(node, currentWrite, { value: v }, host, undefined, ctx);
      };
      props['onUpdate:currentPage'] = onCurrent;
      props['onUpdate:current-page'] = onCurrent;
      const changeTarget = node.bind && node.bind.change;
      if (changeTarget) {
        props.onCurrentChange = (v) => {
          dispatchEvent(node, changeTarget, { value: v }, host, 'change', ctx);
        };
      }
    }
    if (sizeWrite) {
      const onSize = (v) => {
        dispatchEvent(node, sizeWrite, { value: v }, host, undefined, ctx);
      };
      props['onUpdate:pageSize'] = onSize;
      props['onUpdate:page-size'] = onSize;
      const changeTarget = node.bind && node.bind.change;
      if (changeTarget) {
        props.onSizeChange = (v) => {
          dispatchEvent(node, changeTarget, { value: v }, host, 'change', ctx);
        };
      }
    }
    return h(resolve('ElPagination'), props);
  }

  if (node.type === 'Card') {
    const title = props && Object.prototype.hasOwnProperty.call(props, 'title')
      ? props.title
      : '';
    const cardProps = { ...props };
    delete cardProps.title;
    return h(resolve('ElCard'), cardProps, {
      header: () => title,
      default: () => children,
    });
  }

  if (node.type === 'Container') {
    const layout = (node.props && node.props.layout) || 'column';
    const gap = node.props && node.props.gap;
    const justify = node.props && node.props.justify;
    const align = node.props && node.props.align;
    const wrap = node.props && node.props.wrap;

    // Build flexbox style
    const flexStyle = {
      display: 'flex',
      flexDirection: (
        layout === 'row' || layout === 'row-reverse' || layout === 'column-reverse'
          ? layout
          : 'column'
      ),
      ...(gap !== undefined && { gap: typeof gap === 'number' ? `${gap}px` : gap }),
      ...(justify && { justifyContent: justify }),
      ...(align && { alignItems: align }),
      ...(wrap && { flexWrap: 'wrap' }),
      ...(props.style || {}),
    };
    const containerProps = { ...props, style: flexStyle };
    delete containerProps.layout;
    delete containerProps.gap;
    delete containerProps.justify;
    delete containerProps.align;
    delete containerProps.wrap;
    return h('div', containerProps, children);
  }

  if (node.type === 'ColorBox') {
    const bind = node.bind && node.bind.read;
    const colorValue = bind ? getLabelValue(snapshot, bind) : undefined;
    const bgColor = typeof colorValue === 'string' && colorValue.startsWith('#') ? colorValue : '#FFFFFF';
    const boxStyle = {
      backgroundColor: bgColor,
      width: (node.props && node.props.width) || '100px',
      height: (node.props && node.props.height) || '60px',
      borderRadius: (node.props && node.props.borderRadius) || '8px',
      border: '2px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background-color 0.3s ease',
      ...(node.props && node.props.style),
    };
    return h('div', { style: boxStyle }, children);
  }

  if (node.type === 'Table') {
    return h(resolve('ElTable'), props, { default: () => children });
  }

  if (node.type === 'TableColumn') {
    if (children.length === 0) {
      return h(resolve('ElTableColumn'), props);
    }
    return h(resolve('ElTableColumn'), props, {
      default: (scope) => {
        const scopedCtx = {
          row: scope && scope.row ? scope.row : undefined,
          $index: scope && Object.prototype.hasOwnProperty.call(scope, '$index') ? scope.$index : undefined,
        };
        return (node.children || []).map((child) => buildVueNode(child, snapshot, vue, host, registry, scopedCtx));
      },
    });
  }

  if (node.type === 'Tree') {
    const changeTarget = node.bind && node.bind.change;
    if (changeTarget) {
      props.onNodeClick = (data) => {
        const path = data && Object.prototype.hasOwnProperty.call(data, 'path') ? data.path : undefined;
        dispatchEvent(node, changeTarget, { value: path }, host, 'change', ctx);
      };
    }
    return h(resolve('ElTree'), props);
  }

  if (node.type === 'Html') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getLabelValue(snapshot, bind) : undefined;
    const html = value !== undefined ? String(value) : (node.props && Object.prototype.hasOwnProperty.call(node.props, 'html') ? String(node.props.html) : '');
    const divProps = { ...props };
    delete divProps.html;
    divProps.innerHTML = html;
    return h('div', divProps);
  }

  if (node.type === 'ThreeSceneHost') {
    return h(resolve('ThreeSceneHost'), normalizeThreeSceneHostProps(snapshot, props));
  }

  if (node.type === 'Link') {
    const href = Object.prototype.hasOwnProperty.call(props, 'href') ? props.href : '';
    const text = Object.prototype.hasOwnProperty.call(props, 'text') ? props.text : '';
    const aProps = { ...props, href: href || '', target: props.target || '_blank', rel: props.rel || 'noopener noreferrer' };
    delete aProps.text;
    return h('a', aProps, (text || href || '').toString());
  }

  if (node.type === 'FileInput') {
    const accept = node.props && Object.prototype.hasOwnProperty.call(node.props, 'accept') ? node.props.accept : undefined;
    const multiple = Boolean(node.props && Object.prototype.hasOwnProperty.call(node.props, 'multiple') ? node.props.multiple : false);
    const directory = Boolean(node.props && Object.prototype.hasOwnProperty.call(node.props, 'directory') ? node.props.directory : false);
    const labelText = node.props && Object.prototype.hasOwnProperty.call(node.props, 'label') ? String(node.props.label) : '';
    const wrapStyle = node.props && node.props.style ? node.props.style : undefined;
    const multiAttr = multiple || directory;
    const onChange = async (e) => {
      const input = e && e.target ? e.target : null;
      const files = input && input.files ? input.files : null;
      const target = (node.bind && node.bind.write) || (node.props && node.props.valueRef
        ? { action: 'label_update', target_ref: node.props.valueRef }
        : null);
      if (!files || files.length === 0) return;
      if (!target) return;
      if (typeof host.uploadMedia !== 'function') {
        dispatchEvent(node, target, { value: '' }, host, undefined, ctx);
        return;
      }
      try {
        const list = Array.from(files);
        const uploaded = [];
        for (const file of list) {
          const result = await host.uploadMedia({
            file,
            filename: file && file.name ? String(file.name) : 'upload.bin',
            contentType: file && file.type ? String(file.type) : 'application/octet-stream',
            meta: {
              node_id: node.id,
              node_type: node.origin_type || node.type,
            },
          });
          const uri = result && typeof result.uri === 'string' ? result.uri : '';
          if (!uri) continue;
          uploaded.push({
            uri,
            name: result && typeof result.name === 'string' ? result.name : (file && file.name ? String(file.name) : ''),
          });
        }
        if (uploaded.length === 0) return;
        if (multiple || directory || uploaded.length > 1) {
          dispatchEvent(node, target, { value: uploaded }, host, undefined, ctx);
          return;
        }
        dispatchEvent(node, target, { value: uploaded[0].uri }, host, undefined, ctx);
      } catch (_) {
        // upload error is surfaced by state handlers when target consumer validates empty value
      }
    };
    return h('div', { style: wrapStyle }, [
      labelText ? h('div', { style: { marginBottom: '6px', fontSize: '12px', color: '#374151' } }, labelText) : null,
      h('input', {
        type: 'file',
        accept,
        multiple: multiAttr,
        webkitdirectory: directory,
        directory,
        onChange,
      }),
    ].filter(Boolean));
  }

  if (node.type === 'Form') {
    return h(resolve('ElForm'), props, { default: () => children });
  }

  if (node.type === 'FormItem') {
    return h(resolve('ElFormItem'), props, { default: () => children });
  }

  if (node.type === 'Box') {
    const writeTarget = node.bind && node.bind.write;
    if (writeTarget) {
      props.onClick = () => {
        dispatchEvent(node, writeTarget, { click: true }, host, undefined, ctx);
      };
    }
    return h('div', props, children);
  }

  // =====================================================
  // NEW COMPONENTS: StatCard, StatusBadge, Terminal, Icon
  // =====================================================

  if (node.type === 'Icon') {
    const iconMap = {
      refresh: '↻', close: '✕', check: '✓', plus: '+', minus: '−',
      search: '🔍', download: '⬇', upload: '⬆', copy: '📋', trash: '🗑',
      edit: '✎', clock: '🕐', settings: '⚙', user: '👤', star: '★',
      activity: '📊', zap: '⚡', alert: '⚠', info: 'ℹ', terminal: '💻',
      arrow_down: '↓', arrow_up: '↑', arrow_right: '→',
      filter: '⊟', export: '📤', link: '🔗', globe: '🌐',
      play: '▶', pause: '⏸', stop: '⏹', chart: '📈',
    };
    const name = (node.props && node.props.name) || '';
    const size = (node.props && node.props.size) || 16;
    const color = (node.props && node.props.color) || 'inherit';
    const iconChar = iconMap[name] || name;
    const iconStyle = {
      fontSize: typeof size === 'number' ? `${size}px` : size,
      color,
      lineHeight: 1,
      ...(props.style || {}),
    };
    return h('span', { ...props, style: iconStyle }, iconChar);
  }

  if (node.type === 'StatCard') {
    const bind = node.bind && node.bind.read;
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const boundValue = bind ? (direct !== undefined ? direct : getLabelValue(snapshot, bind)) : undefined;

    const label = (node.props && node.props.label) || '';
    const value = boundValue !== undefined ? boundValue : (node.props && node.props.value) || '—';
    const unit = (node.props && node.props.unit) || '';
    const variant = (node.props && node.props.variant) || 'default';

    const variantColors = {
      default: '#1E293B', success: '#22C55E', warning: '#F59E0B', error: '#EF4444', info: '#3B82F6',
    };
    const valueColor = variantColors[variant] || variantColors.default;

    const cardStyle = {
      backgroundColor: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: '12px',
      padding: '16px 20px',
      minWidth: '140px',
      ...(props.style || {}),
    };

    const trend = (node.props && node.props.trend) || '';
    const trendDirection = (node.props && node.props.trendDirection) || 'neutral';
    const trendColors = {
      up: '#EF4444', down: '#22C55E', neutral: '#3B82F6', positive: '#22C55E', negative: '#EF4444',
    };
    const trendColor = trendColors[trendDirection] || trendColors.neutral;

    const cardChildren = [
      h('div', { style: { fontSize: '12px', color: '#94A3B8', marginBottom: '8px', fontWeight: '500' } }, label),
      h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px' } }, [
        h('span', { style: { fontSize: '36px', fontWeight: '700', color: valueColor, lineHeight: '1.1' } }, String(value)),
        unit ? h('span', { style: { fontSize: '14px', color: '#64748B' } }, unit) : null,
      ].filter(Boolean)),
    ];

    if (trend) {
      cardChildren.push(
        h('div', { style: { marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' } }, [
          h('span', { style: { color: trendColor, fontSize: '13px', fontWeight: '500' } }, trend),
        ])
      );
    }

    return h('div', { ...props, style: cardStyle }, cardChildren);
  }

  if (node.type === 'StatusBadge') {
    const bind = node.bind && node.bind.read;
    const boundStatus = bind ? getLabelValue(snapshot, bind) : undefined;

    const label = (node.props && node.props.label) || 'STATUS';
    const status = boundStatus !== undefined ? boundStatus : (node.props && node.props.status) || 'idle';
    const text = (node.props && node.props.text) || status;

    const statusColors = {
      monitoring: '#22C55E', online: '#22C55E', success: '#22C55E',
      warning: '#F59E0B', pending: '#F59E0B',
      error: '#EF4444', offline: '#EF4444',
      idle: '#94A3B8',
    };
    const dotColor = statusColors[status] || statusColors.idle;

    const badgeStyle = {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 16px',
      backgroundColor: '#F8FAFC',
      borderRadius: '8px',
      border: '1px solid #E2E8F0',
      ...(props.style || {}),
    };

    return h('div', { ...props, style: badgeStyle }, [
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' } }, [
        h('span', { style: { fontSize: '10px', color: '#94A3B8', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' } }, label),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' } }, [
          h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: dotColor } }),
          h('span', { style: { fontSize: '14px', color: '#1E293B', fontWeight: '600' } }, text),
        ]),
      ]),
    ]);
  }

  if (node.type === 'Terminal') {
    const bind = node.bind && node.bind.read;
    const boundContent = bind ? getLabelValue(snapshot, bind) : undefined;

    const title = (node.props && node.props.title) || 'terminal';
    const content = boundContent !== undefined ? String(boundContent) : (node.props && node.props.content) || '';
    const showMacButtons = node.props && node.props.showMacButtons !== false;
    const showToolbar = node.props && node.props.showToolbar !== false;
    const maxHeight = (node.props && node.props.maxHeight) || '400px';

    const containerStyle = {
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid #334155',
      ...(props.style || {}),
    };

    // Title bar with macOS-style buttons
    const titleBarStyle = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      backgroundColor: '#334155',
    };

    const macButtons = showMacButtons ? h('div', { style: { display: 'flex', gap: '8px' } }, [
      h('span', { style: { width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#EF4444' } }),
      h('span', { style: { width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#F59E0B' } }),
      h('span', { style: { width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#22C55E' } }),
    ]) : null;

    const titleText = h('span', { style: { fontSize: '13px', color: '#94A3B8', flex: 1, textAlign: 'center' } }, title);

    const toolbarButtons = showToolbar ? h('div', { style: { display: 'flex', gap: '8px' } }, [
      h('span', { style: { cursor: 'pointer', color: '#94A3B8', fontSize: '14px' }, title: '下载' }, '⬇'),
      h('span', { style: { cursor: 'pointer', color: '#94A3B8', fontSize: '14px' }, title: '复制' }, '📋'),
    ]) : h('div', { style: { width: '52px' } }); // placeholder for alignment

    // Content area
    const contentStyle = {
      backgroundColor: '#1E293B',
      padding: '16px',
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      fontSize: '13px',
      lineHeight: '1.6',
      color: '#E2E8F0',
      maxHeight,
      overflowY: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    };

    // Parse lines: support \x01 separator for hover detail (displayText\x01hoverDetail)
    const highlightedContent = content.split('\n').map((line, idx) => {
      if (!line) return h('div', { key: idx, style: { minHeight: '4px' } });
      let displayText = line;
      let hoverDetail = null;
      const sepIdx = line.indexOf('\x01');
      if (sepIdx !== -1) {
        displayText = line.slice(0, sepIdx);
        hoverDetail = line.slice(sepIdx + 1);
      }

      // Color-code segments separated by |
      const segments = displayText.split(' | ');
      const segmentNodes = segments.map((seg, si) => {
        let color = '#E2E8F0'; // default
        if (/^\[[\d:]+\]/.test(seg)) color = '#94A3B8';        // timestamp
        else if (/#\d+/.test(seg)) color = '#94A3B8';           // has seq
        else if (/→/.test(seg)) color = '#60A5FA';              // hop
        else if (/^(inbound|outbound|internal)/.test(seg)) color = '#4ADE80'; // direction
        else if (/^(action=|type=)/.test(seg)) color = '#FBBF24'; // summary
        else if (/^model:/.test(seg)) color = '#A78BFA';        // model_id
        else if (/^❌/.test(seg)) color = '#EF4444';            // error
        else if (/^\{/.test(seg) || /^\[/.test(seg)) color = '#64748B'; // payload preview
        const sepSpan = si > 0 ? h('span', { style: { color: '#475569' } }, ' | ') : null;
        return [sepSpan, h('span', { key: si, style: { color } }, seg)];
      }).flat().filter(Boolean);

      const lineStyle = {
        minHeight: '22px', padding: '2px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        cursor: hoverDetail ? 'help' : 'default',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      };

      // Pretty-print compact JSON for readable tooltip
      let titleText = undefined;
      if (hoverDetail) {
        try { titleText = JSON.stringify(JSON.parse(hoverDetail), null, 2); } catch (_) { titleText = hoverDetail; }
      }
      return h('div', { key: idx, style: lineStyle, title: titleText }, segmentNodes);
    });

    return h('div', { ...props, style: containerStyle }, [
      h('div', { style: titleBarStyle }, [macButtons, titleText, toolbarButtons].filter(Boolean)),
      h('div', { style: contentStyle }, highlightedContent),
    ]);
  }

  // NEW COMPONENTS: ProgressBar, Divider, Breadcrumb
  // ================================================

  if (node.type === 'ProgressBar') {
    const bind = node.bind && node.bind.read;
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const boundValue = bind ? (direct !== undefined ? direct : getLabelValue(snapshot, bind)) : undefined;

    const percentage = boundValue !== undefined ? Number(boundValue) : (node.props && node.props.percentage) || 0;
    const label = (node.props && node.props.label) || '';
    const strokeWidth = (node.props && node.props.strokeWidth) || 8;
    const variant = (node.props && node.props.variant) || 'default';

    const variantColorMap = {
      default: '#409EFF', success: '#22C55E', warning: '#F59E0B', error: '#EF4444', info: '#3B82F6',
    };
    const color = (node.props && node.props.color) || variantColorMap[variant] || variantColorMap.default;
    const clampedPct = Math.min(100, Math.max(0, percentage));

    const progressProps = { percentage: clampedPct, color, strokeWidth, showText: false };

    if (label) {
      return h('div', { ...props, style: { display: 'flex', flexDirection: 'column', gap: '4px', ...(props.style || {}) } }, [
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
          h('span', { style: { fontSize: '14px', color: '#64748B' } }, label),
          h('span', { style: { fontSize: '14px', fontWeight: '600', color: '#1E293B' } }, `${clampedPct}%`),
        ]),
        h(resolve('ElProgress'), progressProps),
      ]);
    }
    return h(resolve('ElProgress'), { ...props, ...progressProps });
  }

  if (node.type === 'Divider') {
    const direction = (node.props && node.props.direction) || 'horizontal';
    const contentPosition = (node.props && node.props.contentPosition) || 'center';
    const text = (node.props && node.props.text) || '';
    const dividerProps = { ...props, direction, contentPosition };
    if (text) {
      return h(resolve('ElDivider'), dividerProps, { default: () => text });
    }
    return h(resolve('ElDivider'), dividerProps);
  }

  if (node.type === 'Breadcrumb') {
    const items = (node.props && Array.isArray(node.props.items)) ? node.props.items : [];
    const separator = (node.props && node.props.separator) || '/';
    const bcItems = items.map((item, idx) => {
      const lbl = typeof item === 'string' ? item : (item.label || '');
      return h(resolve('ElBreadcrumbItem'), { key: idx }, { default: () => lbl });
    });
    return h(resolve('ElBreadcrumb'), { ...props, separator }, { default: () => bcItems });
  }

  return h('div', props, children);
}

function dispatchEvent(node, target, payload, host, overrideType) {
  const ctx = arguments.length > 5 ? arguments[5] : null;
  if (target && Object.prototype.hasOwnProperty.call(target, 'action')) {
    const snapshot = host.getSnapshot();
    const action = target.action;
    const out = { action };
    if (action !== 'submodel_create') {
      out.target = resolveRefsDeep(target.target_ref, ctx, snapshot);
    }

    if (action === 'label_add' || action === 'label_update' || action === 'ui_owner_label_update') {
      if (target.value_ref !== undefined) {
        out.value = resolveRefsDeep(target.value_ref, ctx, snapshot);
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
      out.value = resolveRefsDeep(target.value_ref, ctx, snapshot);
    } else if (target.value_ref !== undefined) {
      out.value = resolveRefsDeep(target.value_ref, ctx, snapshot);
    }

    if (target.meta_ref !== undefined) {
      out.meta = resolveRefsDeep(target.meta_ref, ctx, snapshot);
    } else if (target.meta !== undefined) {
      out.meta = resolveRefsDeep(target.meta, ctx, snapshot);
    }

    const envelope = normalizeEditorEvent(out);
    if (out.meta && typeof out.meta === 'object' && !Array.isArray(out.meta)) {
      envelope.payload.meta = {
        ...(envelope.payload.meta && typeof envelope.payload.meta === 'object' ? envelope.payload.meta : {}),
        ...out.meta,
      };
    }
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
  const registry = normalizeRegistry(options && options.registry);
  ensureHostAdapter(host);

  return {
    renderTree(ast) {
      const snapshot = host.getSnapshot();
      return renderTreeNode(ast, snapshot, registry);
    },
    renderVNode(ast) {
      if (!vue || typeof vue.h !== 'function') {
        throw new Error('Vue bridge not provided');
      }
      const snapshot = host.getSnapshot();
      return buildVueNode(ast, snapshot, vue, host, registry);
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
