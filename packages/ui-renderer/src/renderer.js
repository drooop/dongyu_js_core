const registryModule = require('./component_registry_v1.js');

let eventCounter = 0;
let editorEventCounter = 0;
let editorOpNonce = 0;
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

function currentModelIdForNode(node) {
  const modelId = node && node.cell_ref && Number.isInteger(node.cell_ref.model_id)
    ? node.cell_ref.model_id
    : null;
  return modelId;
}

function resolveRefForNode(ref, node) {
  if (!isPlainObject(ref)) return ref;
  if (Object.prototype.hasOwnProperty.call(ref, 'model_id')) return ref;
  if (!Number.isInteger(ref.p) || !Number.isInteger(ref.r) || !Number.isInteger(ref.c)) return ref;
  if (Object.prototype.hasOwnProperty.call(ref, 'k') && typeof ref.k !== 'string') return ref;
  const modelId = currentModelIdForNode(node);
  if (!Number.isInteger(modelId)) return ref;
  return { ...ref, model_id: modelId };
}

function resolveWriteTargetForNode(target, node) {
  if (!isPlainObject(target)) return target;
  const next = { ...target };
  if (isPlainObject(next.target_ref)) {
    next.target_ref = resolveRefForNode(next.target_ref, node);
  }
  if (isPlainObject(next.commit_target_ref)) {
    next.commit_target_ref = resolveRefForNode(next.commit_target_ref, node);
  }
  return next;
}

function toCssLength(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}px`;
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
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

function getEffectiveLabelValue(snapshot, ref, host, node = null) {
  const resolvedRef = resolveRefForNode(ref, node);
  if (host && typeof host.getEffectiveLabelValue === 'function') {
    const value = host.getEffectiveLabelValue(resolvedRef);
    if (value !== undefined) return value;
  }
  return getLabelValue(snapshot, resolvedRef);
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

function readMarkdownText(node, snapshot, host, ctx) {
  const bind = node.bind && node.bind.read;
  const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
  const value = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host, node)) : undefined;
  if (value !== undefined) return String(value);
  const props = node.props || {};
  if (Object.prototype.hasOwnProperty.call(props, 'markdown')) return String(props.markdown ?? '');
  if (Object.prototype.hasOwnProperty.call(props, 'text')) return String(props.text ?? '');
  return '';
}

const SHELL_TEXT = {
  ink: '#102033',
  muted: '#64748b',
  soft: '#94a3b8',
  line: 'rgba(148, 163, 184, 0.34)',
  glass: 'rgba(255, 255, 255, 0.72)',
  glassStrong: 'rgba(255, 255, 255, 0.88)',
};

function mergeShellStyle(base, props) {
  return {
    ...base,
    ...((props && props.style) || {}),
  };
}

function cleanShellProps(props, extraKeys = []) {
  const next = { ...(props || {}) };
  delete next.style;
  for (const key of extraKeys) delete next[key];
  return next;
}

function renderInlineMarkdown(text, h, keyPrefix) {
  const input = String(text ?? '');
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const out = [];
  let last = 0;
  let idx = 0;
  for (const match of input.matchAll(pattern)) {
    if (match.index > last) out.push(input.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      out.push(h('strong', { key: `${keyPrefix}_strong_${idx}` }, token.slice(2, -2)));
    } else if (token.startsWith('`') && token.endsWith('`')) {
      out.push(h('code', {
        key: `${keyPrefix}_code_${idx}`,
        style: {
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          borderRadius: '4px',
          padding: '1px 5px',
          fontSize: '0.92em',
        },
      }, token.slice(1, -1)));
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        out.push(h('a', {
          key: `${keyPrefix}_link_${idx}`,
          href: linkMatch[2],
          target: '_blank',
          rel: 'noopener noreferrer',
        }, linkMatch[1]));
      } else {
        out.push(token);
      }
    }
    last = match.index + token.length;
    idx += 1;
  }
  if (last < input.length) out.push(input.slice(last));
  return out;
}

function splitMarkdownTableRow(line) {
  const trimmed = String(line || '').trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((part) => part.trim());
}

function isMarkdownTableDivider(line) {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function renderCodeToken(token, lang, h, key) {
  const jsKeywords = new Set(['const', 'let', 'var', 'function', 'return', 'if', 'else', 'true', 'false', 'null', 'import', 'export', 'from', 'async', 'await']);
  const isJsonish = lang === 'json' || lang === 'js' || lang === 'javascript' || lang === 'ts' || lang === 'typescript';
  if (!isJsonish) return token;
  if (/^"[^"]*"$/.test(token) || /^'[^']*'$/.test(token)) {
    return h('span', { key, style: { color: '#0f766e' } }, token);
  }
  if (/^-?\d+(\.\d+)?$/.test(token)) {
    return h('span', { key, style: { color: '#7c3aed' } }, token);
  }
  if (jsKeywords.has(token)) {
    return h('span', { key, style: { color: '#2563eb', fontWeight: 600 } }, token);
  }
  return token;
}

function renderCodeLine(line, lang, h, lineKey) {
  const tokens = String(line ?? '').split(/(\s+|[{}[\]():,.;])/);
  return tokens.map((token, idx) => renderCodeToken(token, lang, h, `${lineKey}_${idx}`));
}

function renderMarkdownBlocks(markdown, h) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const nodes = [];
  let i = 0;
  let blockIndex = 0;

  const pushParagraph = (buffer) => {
    const text = buffer.join(' ').trim();
    if (!text) return;
    nodes.push(h('p', {
      key: `md_p_${blockIndex}`,
      style: { margin: '0 0 12px 0', lineHeight: '1.75', color: '#334155' },
    }, renderInlineMarkdown(text, h, `md_p_${blockIndex}`)));
    blockIndex += 1;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const fence = line.match(/^```([a-zA-Z0-9_-]*)\s*$/);
    if (fence) {
      const lang = String(fence[1] || '').toLowerCase();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      if (lang === 'mermaid') {
        nodes.push(h('div', {
          key: `md_mermaid_${blockIndex}`,
          class: 'markdown-mermaid',
          style: {
            border: '1px solid #cbd5e1',
            background: '#f8fafc',
            borderRadius: '10px',
            padding: '12px',
            margin: '0 0 14px 0',
          },
        }, [
          h('div', { style: { fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' } }, 'Mermaid source preview'),
          h('pre', { style: { margin: 0, whiteSpace: 'pre-wrap', color: '#334155' } }, codeLines.join('\n')),
        ]));
      } else {
        nodes.push(h('pre', {
          key: `md_code_${blockIndex}`,
          class: lang ? `language-${lang}` : 'language-text',
          style: {
            margin: '0 0 14px 0',
            padding: '14px',
            borderRadius: '10px',
            background: '#0f172a',
            color: '#e2e8f0',
            overflowX: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: '13px',
            lineHeight: '1.65',
          },
        }, codeLines.map((codeLine, idx) => h('div', { key: `md_code_${blockIndex}_${idx}` }, renderCodeLine(codeLine, lang, h, `md_code_${blockIndex}_${idx}`)))));
      }
      blockIndex += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const tag = `h${level}`;
      const size = ['28px', '24px', '20px', '17px'][level - 1] || '17px';
      nodes.push(h(tag, {
        key: `md_h_${blockIndex}`,
        style: {
          margin: blockIndex === 0 ? '0 0 12px 0' : '22px 0 10px 0',
          color: '#0f172a',
          fontWeight: 700,
          fontSize: size,
          lineHeight: '1.25',
        },
      }, renderInlineMarkdown(heading[2], h, `md_h_${blockIndex}`)));
      i += 1;
      blockIndex += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      nodes.push(h('ul', {
        key: `md_ul_${blockIndex}`,
        style: { margin: '0 0 14px 0', paddingLeft: '1.25rem', color: '#334155', lineHeight: '1.7' },
      }, items.map((item, idx) => h('li', { key: `md_ul_${blockIndex}_${idx}` }, renderInlineMarkdown(item, h, `md_ul_${blockIndex}_${idx}`)))));
      blockIndex += 1;
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && isMarkdownTableDivider(lines[i + 1])) {
      const headers = splitMarkdownTableRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitMarkdownTableRow(lines[i]));
        i += 1;
      }
      const thStyle = { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #cbd5e1', background: '#f8fafc' };
      const tdStyle = { padding: '8px 10px', borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' };
      nodes.push(h('table', {
        key: `md_table_${blockIndex}`,
        style: { width: '100%', borderCollapse: 'collapse', margin: '0 0 16px 0', fontSize: '14px' },
      }, [
        h('thead', headers.map((header, idx) => h('th', { key: `md_th_${blockIndex}_${idx}`, style: thStyle }, renderInlineMarkdown(header, h, `md_th_${blockIndex}_${idx}`)))),
        h('tbody', rows.map((row, rowIdx) => h('tr', { key: `md_tr_${blockIndex}_${rowIdx}` }, headers.map((_, colIdx) => h('td', { key: `md_td_${blockIndex}_${rowIdx}_${colIdx}`, style: tdStyle }, renderInlineMarkdown(row[colIdx] || '', h, `md_td_${blockIndex}_${rowIdx}_${colIdx}`)))))),
      ]));
      blockIndex += 1;
      continue;
    }

    const paragraph = [];
    while (
      i < lines.length
      && lines[i].trim()
      && !/^```/.test(lines[i])
      && !/^(#{1,4})\s+/.test(lines[i])
      && !/^\s*[-*]\s+/.test(lines[i])
      && !(lines[i].includes('|') && i + 1 < lines.length && isMarkdownTableDivider(lines[i + 1]))
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    pushParagraph(paragraph);
  }

  return nodes;
}

function resolveRefValue(ref, ctx) {
  if (!ctx || typeof ref !== 'string') return undefined;
  if (ref === '$index') return ctx.$index;
  if (ref === 'value') return ctx.value;
  if (ref === 'payload') return ctx.payload;
  if (ref.startsWith('payload.')) {
    let cur = ctx.payload;
    const parts = ref.slice('payload.'.length).split('.');
    for (const p of parts) {
      if (!cur || (typeof cur !== 'object' && typeof cur !== 'function')) return undefined;
      cur = cur[p];
    }
    return cur;
  }
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

function resolveRefsDeep(value, ctx, snapshot, host, node = null) {
  if (!value) return value;
  if (isPlainObject(value) && Object.keys(value).length === 1 && Object.prototype.hasOwnProperty.call(value, '$label')) {
    const ref = resolveRefForNode(resolveRefsDeep(value.$label, ctx, snapshot, host, node), node);
    return snapshot ? getEffectiveLabelValue(snapshot, ref, host, node) : undefined;
  }
  if (isPlainObject(value) && typeof value.$ref === 'string' && Object.keys(value).length === 1) {
    if (!ctx) return value;
    return resolveRefValue(value.$ref, ctx);
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveRefsDeep(v, ctx, snapshot, host, node));
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveRefsDeep(v, ctx, snapshot, host, node);
    }
    return out;
  }
  return value;
}

function readPropValueFromSnapshot(snapshot, props, valueKey, refKey, node = null) {
  if (!isPlainObject(props)) return undefined;
  if (Object.prototype.hasOwnProperty.call(props, valueKey)) {
    return props[valueKey];
  }
  const ref = props[refKey];
  if (isPlainObject(ref)) {
    return getLabelValue(snapshot, resolveRefForNode(ref, node));
  }
  return undefined;
}

function readComponentValue(snapshot, props, valueKey, refKey, host, node = null) {
  if (!isPlainObject(props)) return undefined;
  if (Object.prototype.hasOwnProperty.call(props, valueKey)) {
    return props[valueKey];
  }
  const ref = props[refKey];
  if (isPlainObject(ref)) {
    return getEffectiveLabelValue(snapshot, ref, host, node);
  }
  return undefined;
}

function normalizeArrayValue(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

const TODO_STATUS_DEFS = Object.freeze([
  { value: 'todo', label: '还未开始', tone: '#2563eb', bg: '#eff6ff' },
  { value: 'doing', label: '正在进行', tone: '#d97706', bg: '#fffbeb' },
  { value: 'done', label: '已完成', tone: '#16a34a', bg: '#f0fdf4' },
  { value: 'archived', label: '已归档', tone: '#64748b', bg: '#f8fafc' },
]);

function normalizeTodoColumns(value) {
  const raw = Array.isArray(value) && value.length > 0 ? value : TODO_STATUS_DEFS;
  return raw
    .map((column, index) => {
      if (!column || typeof column !== 'object') return null;
      const fallback = TODO_STATUS_DEFS[index] || TODO_STATUS_DEFS[0];
      const statusValue = typeof column.value === 'string' && column.value.trim() ? column.value.trim() : fallback.value;
      return {
        value: statusValue,
        label: typeof column.label === 'string' && column.label.trim() ? column.label.trim() : statusValue,
        tone: typeof column.tone === 'string' && column.tone.trim() ? column.tone.trim() : fallback.tone,
        bg: typeof column.bg === 'string' && column.bg.trim() ? column.bg.trim() : fallback.bg,
      };
    })
    .filter(Boolean);
}

function normalizeTodoTasks(value) {
  let source = value;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch (_) {
      source = [];
    }
  }
  return normalizeArrayValue(source)
    .map((task, index) => {
      const status = typeof task.status === 'string' && task.status.trim() ? task.status.trim() : 'todo';
      const id = typeof task.id === 'string' && task.id.trim() ? task.id.trim() : `task_${index + 1}`;
      return {
        ...task,
        id,
        status,
        title: typeof task.title === 'string' && task.title.trim() ? task.title.trim() : 'Untitled task',
        body: typeof task.body === 'string' ? task.body : '',
      };
    });
}

function readTodoTasks(node, snapshot, props, host) {
  const direct = readComponentValue(snapshot, props, 'tasks', 'tasksRef', host, node);
  if (direct !== undefined) return normalizeTodoTasks(direct);
  const bind = node.bind && node.bind.read;
  if (bind) return normalizeTodoTasks(getEffectiveLabelValue(snapshot, bind, host, node));
  return [];
}

function todoRecord(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function todoActionPayload(action, extras = {}) {
  const records = [
    todoRecord('__mt_payload_kind', 'str', 'ui_event.v1'),
    todoRecord('todo_action', 'str', action),
  ];
  for (const [key, value] of Object.entries(extras || {})) {
    if (value === undefined || value === null) continue;
    let type = 'str';
    if (typeof value === 'boolean') type = 'bool';
    else if (typeof value === 'number' && Number.isSafeInteger(value)) type = 'int';
    else if (typeof value === 'object') type = 'json';
    records.push(todoRecord(key, type, value));
  }
  return records;
}

function dispatchTodoAction(node, host, target, action, extras, ctx) {
  const writeTarget = target || (node.bind && node.bind.write);
  if (!writeTarget) return null;
  return dispatchEvent(node, writeTarget, { value: todoActionPayload(action, extras) }, host, undefined, ctx);
}

function todoStatusMeta(columns, status) {
  return columns.find((column) => column.value === status) || { value: status, label: status, tone: '#64748b', bg: '#f8fafc' };
}

function truncateText(text, limit) {
  const source = String(text || '').trim();
  if (source.length <= limit) return source;
  return `${source.slice(0, Math.max(0, limit - 1))}…`;
}

function fieldText(item, field, fallback = '') {
  if (!item || typeof item !== 'object') return fallback;
  if (typeof field === 'string' && field) {
    const value = item[field];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return fallback;
}

function extensionKind(name, uri = '') {
  const target = `${String(name || '')} ${String(uri || '')}`.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|\s|$)/u.test(target)) return 'image';
  if (/\.(mp3|wav|ogg|m4a|aac|flac|opus)(\?|#|\s|$)/u.test(target)) return 'audio';
  if (/\.(mp4|webm|mov|m4v)(\?|#|\s|$)/u.test(target)) return 'video';
  return 'file';
}

function messageCardKind(event) {
  const explicit = fieldText(event, 'card_kind', '');
  if (['text', 'file', 'image', 'audio', 'video'].includes(explicit)) return explicit;
  const msgtype = fieldText(event, 'msgtype', fieldText(event, 'type', 'm.text')).toLowerCase();
  const mime = fieldText(event, 'mime_type', fieldText(event, 'mimetype', '')).toLowerCase();
  const fileName = fieldText(event, 'file_name', fieldText(event, 'filename', fieldText(event, 'body', '')));
  const mediaUri = fieldText(event, 'media_uri', fieldText(event, 'url', ''));
  if (msgtype === 'm.image' || mime.startsWith('image/')) return 'image';
  if (msgtype === 'm.audio' || mime.startsWith('audio/')) return 'audio';
  if (msgtype === 'm.file') return extensionKind(fileName, mediaUri);
  return 'text';
}

function normalizeMessageTimelineEvents(events) {
  return normalizeArrayValue(events).map((event) => {
    const fileName = fieldText(event, 'file_name', fieldText(event, 'filename', fieldText(event, 'body', '')));
    const mediaUri = fieldText(event, 'media_uri', fieldText(event, 'url', ''));
    const downloadUrl = fieldText(event, 'download_url', '');
    const thumbnailUrl = fieldText(event, 'thumbnail_url', '');
    const kind = messageCardKind(event);
    const actions = kind === 'text' ? [] : [
      {
        kind: kind === 'image' ? 'open' : 'download',
        label: kind === 'image' ? 'Open image' : (kind === 'audio' ? 'Download audio' : 'Download file'),
        href: downloadUrl,
      },
    ].filter((action) => action.href);
    return {
      ...event,
      file_name: fileName,
      media_uri: mediaUri,
      card_kind: kind,
      download_url: downloadUrl,
      thumbnail_url: thumbnailUrl,
      actions,
    };
  });
}

function chooseAudioMimeType() {
  const recorder = typeof globalThis !== 'undefined' ? globalThis.MediaRecorder : null;
  const candidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/ogg'];
  if (recorder && typeof recorder.isTypeSupported === 'function') {
    const supported = candidates.find((candidate) => recorder.isTypeSupported(candidate));
    if (supported) return supported;
  }
  return 'audio/webm';
}

function audioFilenameExtension(mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}

function waitForMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function recordAudioUpload(host, props) {
  if (!host || typeof host.uploadMedia !== 'function') {
    throw new Error('upload_media_unavailable');
  }
  const nav = typeof globalThis !== 'undefined' ? globalThis.navigator : null;
  const mediaDevices = nav && nav.mediaDevices;
  if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
    throw new Error('browser_audio_capture_unavailable');
  }
  const Recorder = typeof globalThis !== 'undefined' ? globalThis.MediaRecorder : null;
  if (typeof Recorder !== 'function') {
    throw new Error('media_recorder_unavailable');
  }
  const stream = await mediaDevices.getUserMedia({ audio: true });
  try {
    const mimeType = chooseAudioMimeType();
    const chunks = [];
    const recorder = new Recorder(stream, { mimeType });
    recorder.ondataavailable = (event) => {
      if (event && event.data && Number(event.data.size || 0) !== 0) chunks.push(event.data);
    };
    const stopped = new Promise((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.start();
    const recordMs = Number.isFinite(Number(props.audioRecordMs))
      ? Math.max(200, Number(props.audioRecordMs))
      : 1200;
    await waitForMs(recordMs);
    if (recorder.state !== 'inactive') recorder.stop();
    await stopped;
    if (chunks.length === 0) {
      throw new Error('empty_audio_recording');
    }
    const uploadType = recorder.mimeType || mimeType;
    const blob = new Blob(chunks, { type: uploadType });
    const prefix = String(props.audioFilenamePrefix || 'voice-message').replace(/[^a-z0-9_-]+/giu, '-').replace(/^-+|-+$/gu, '') || 'voice-message';
    const filename = `${prefix}-${Date.now()}.${audioFilenameExtension(uploadType)}`;
    const result = await host.uploadMedia({
      file: blob,
      filename,
      contentType: uploadType,
      meta: { media_action: 'record_audio' },
    });
    const uri = result && typeof result.uri === 'string' ? result.uri : '';
    if (!uri) throw new Error('audio_upload_failed');
    return {
      media_uri: uri,
      file_name: result && typeof result.name === 'string' && result.name ? result.name : filename,
      mime_type: uploadType,
    };
  } finally {
    for (const track of typeof stream.getTracks === 'function' ? stream.getTracks() : []) {
      if (track && typeof track.stop === 'function') track.stop();
    }
  }
}

function cleanComponentProps(props, extraKeys = []) {
  const next = { ...(props || {}) };
  delete next.items;
  delete next.itemsRef;
  delete next.events;
  delete next.eventsRef;
  delete next.uri;
  delete next.uriRef;
  delete next.name;
  delete next.nameRef;
  delete next.activeId;
  delete next.activeIdRef;
  for (const key of extraKeys) delete next[key];
  return next;
}

function visibilityValueIsOn(value) {
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '' && value.trim() !== 'false';
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  return true;
}

function shouldRenderVisibleNode(props, snapshot, host, node = null) {
  if (!props || typeof props !== 'object') return true;
  if (props.visibleRef && typeof props.visibleRef === 'object') {
    const visibleValue = getEffectiveLabelValue(snapshot, props.visibleRef, host, node);
    if (!visibilityValueIsOn(visibleValue)) return false;
  }
  if (props.hiddenRef && typeof props.hiddenRef === 'object') {
    const hiddenValue = getEffectiveLabelValue(snapshot, props.hiddenRef, host, node);
    if (visibilityValueIsOn(hiddenValue)) return false;
  }
  return true;
}

function stripVisibilityProps(props) {
  if (!props || typeof props !== 'object') return props;
  delete props.visibleRef;
  delete props.hiddenRef;
  return props;
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

function normalizeThreeSceneHostProps(snapshot, props, node = null) {
  const sceneGraph = readPropValueFromSnapshot(snapshot, props, 'sceneGraph', 'sceneGraphRef', node);
  const cameraState = readPropValueFromSnapshot(snapshot, props, 'cameraState', 'cameraStateRef', node);
  const selectedEntityId = readPropValueFromSnapshot(snapshot, props, 'selectedEntityId', 'selectedEntityIdRef', node);
  const sceneStatus = readPropValueFromSnapshot(snapshot, props, 'sceneStatus', 'sceneStatusRef', node);
  const auditLog = readPropValueFromSnapshot(snapshot, props, 'auditLog', 'auditLogRef', node);
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

function ensureAudioRecorderStore(host) {
  if (!host) return null;
  if (!host.__dyAudioRecorderStore || !(host.__dyAudioRecorderStore instanceof Map)) {
    host.__dyAudioRecorderStore = new Map();
  }
  return host.__dyAudioRecorderStore;
}

function audioRecorderKey(node, props) {
  return String((props && (props.recorderKey || props.recorder_key)) || (node && node.id) || 'audio-recorder');
}

function dispatchOwnerLabelUpdate(node, host, ref, value) {
  if (!ref || typeof ref !== 'object') return null;
  return dispatchEvent(node, { action: 'ui_owner_label_update', target_ref: ref }, {
    value,
  }, host);
}

function audioRecorderMaxMs(props) {
  const value = Number(props && (props.maxRecordMs ?? props.max_record_ms));
  if (!Number.isFinite(value) || value <= 0) return 60000;
  return Math.min(60000, Math.max(1, value));
}

function isEditableKeyTarget(target) {
  const tag = String(target && target.tagName ? target.tagName : '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return Boolean(target && target.isContentEditable);
}

function cleanupAudioRecorderSession(session) {
  if (!session) return;
  if (session.timeoutId) clearTimeout(session.timeoutId);
  if (session.intervalId) clearInterval(session.intervalId);
  if (session.keydownHandler && typeof globalThis !== 'undefined' && typeof globalThis.removeEventListener === 'function') {
    globalThis.removeEventListener('keydown', session.keydownHandler);
  }
  const tracks = session.stream && typeof session.stream.getTracks === 'function' ? session.stream.getTracks() : [];
  for (const track of tracks) {
    if (track && typeof track.stop === 'function') track.stop();
  }
}

async function startManualAudioRecording(node, props, host) {
  const store = ensureAudioRecorderStore(host);
  if (!store) throw new Error('audio_recorder_store_unavailable');
  const key = audioRecorderKey(node, props);
  const existing = store.get(key);
  if (existing && existing.state === 'pending_start' && existing.startPromise) return existing.startPromise;
  if (existing && (existing.state === 'recording' || existing.state === 'uploading')) return existing;
  if (!host || typeof host.uploadMedia !== 'function') {
    throw new Error('upload_media_unavailable');
  }
  const nav = typeof globalThis !== 'undefined' ? globalThis.navigator : null;
  const mediaDevices = nav && nav.mediaDevices;
  if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
    throw new Error('browser_audio_capture_unavailable');
  }
  const Recorder = typeof globalThis !== 'undefined' ? globalThis.MediaRecorder : null;
  if (typeof Recorder !== 'function') {
    throw new Error('media_recorder_unavailable');
  }
  const pending = { key, state: 'pending_start', startPromise: null };
  store.set(key, pending);
  dispatchOwnerLabelUpdate(node, host, props.statusTargetRef || props.statusRef, 'starting');
  const startPromise = (async () => {
    const stream = await mediaDevices.getUserMedia({ audio: true });
    if (pending.cancelled || store.get(key) !== pending) {
      const tracks = stream && typeof stream.getTracks === 'function' ? stream.getTracks() : [];
      for (const track of tracks) {
        if (track && typeof track.stop === 'function') track.stop();
      }
      return null;
    }
  try {
    const mimeType = chooseAudioMimeType();
    const chunks = [];
    const recorder = new Recorder(stream, { mimeType });
    const session = {
      key,
      state: 'recording',
      stream,
      recorder,
      chunks,
      startedAt: Date.now(),
      mimeType,
      finishing: false,
    };
    recorder.ondataavailable = (event) => {
      if (event && event.data && Number(event.data.size || 0) !== 0) chunks.push(event.data);
    };
    session.stopped = new Promise((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.start();
    store.set(key, session);
    dispatchOwnerLabelUpdate(node, host, props.statusTargetRef || props.statusRef, 'recording');
    dispatchOwnerLabelUpdate(node, host, props.errorTargetRef || props.errorRef, '');
    dispatchOwnerLabelUpdate(node, host, props.elapsedTargetRef || props.elapsedRef, 0);
    const maxMs = audioRecorderMaxMs(props);
    session.intervalId = setInterval(() => {
      const elapsed = Math.min(maxMs, Date.now() - session.startedAt);
      dispatchOwnerLabelUpdate(node, host, props.elapsedTargetRef || props.elapsedRef, Math.round(elapsed));
    }, 1000);
    session.timeoutId = setTimeout(() => {
      void finishManualAudioRecording(node, props, host);
    }, maxMs);
    if (props.finishOnEnter !== false && typeof globalThis !== 'undefined' && typeof globalThis.addEventListener === 'function') {
      session.keydownHandler = (event) => {
        if (!event || event.key !== 'Enter' || isEditableKeyTarget(event.target)) return;
        if (typeof event.preventDefault === 'function') event.preventDefault();
        void finishManualAudioRecording(node, props, host);
      };
      globalThis.addEventListener('keydown', session.keydownHandler);
    }
    return session;
  } catch (err) {
    const tracks = stream && typeof stream.getTracks === 'function' ? stream.getTracks() : [];
    for (const track of tracks) {
      if (track && typeof track.stop === 'function') track.stop();
    }
    throw err;
  }
  })();
  pending.startPromise = startPromise;
  try {
    return await startPromise;
  } catch (err) {
    if (store.get(key) === pending) store.delete(key);
    dispatchOwnerLabelUpdate(node, host, props.statusTargetRef || props.statusRef, 'error');
    dispatchOwnerLabelUpdate(node, host, props.errorTargetRef || props.errorRef, err && err.message ? err.message : String(err));
    throw err;
  }
}

async function finishManualAudioRecording(node, props, host) {
  const store = ensureAudioRecorderStore(host);
  const key = audioRecorderKey(node, props);
  const session = store && store.get(key);
  if (!session || session.finishing) return null;
  session.finishing = true;
  session.state = 'uploading';
  dispatchOwnerLabelUpdate(node, host, props.statusTargetRef || props.statusRef, 'uploading');
  try {
    const recorder = session.recorder;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    if (session.stopped) await session.stopped;
    if (!session.chunks || session.chunks.length === 0) {
      throw new Error('empty_audio_recording');
    }
    const uploadType = (recorder && recorder.mimeType) || session.mimeType || chooseAudioMimeType();
    const blob = new Blob(session.chunks, { type: uploadType });
    const prefix = String(props.audioFilenamePrefix || 'voice-message').replace(/[^a-z0-9_-]+/giu, '-').replace(/^-+|-+$/gu, '') || 'voice-message';
    const filename = `${prefix}-${Date.now()}.${audioFilenameExtension(uploadType)}`;
    const result = await host.uploadMedia({
      file: blob,
      filename,
      contentType: uploadType,
      meta: { media_action: 'record_audio', recorder_key: key },
    });
    const uri = result && typeof result.uri === 'string' ? result.uri : '';
    if (!uri) throw new Error('audio_upload_failed');
    const payload = {
      media_uri: uri,
      file_name: result && typeof result.name === 'string' && result.name ? result.name : filename,
      mime_type: uploadType,
      media_error: '',
    };
    const target = node.bind && node.bind.write;
    if (target) dispatchEvent(node, target, payload, host);
    dispatchOwnerLabelUpdate(node, host, props.statusTargetRef || props.statusRef, 'idle');
    dispatchOwnerLabelUpdate(node, host, props.elapsedTargetRef || props.elapsedRef, 0);
    return payload;
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    dispatchOwnerLabelUpdate(node, host, props.statusTargetRef || props.statusRef, 'error');
    dispatchOwnerLabelUpdate(node, host, props.errorTargetRef || props.errorRef, message);
    const target = node.bind && node.bind.write;
    if (target) {
      dispatchEvent(node, target, {
        media_uri: '',
        file_name: '',
        mime_type: '',
        media_error: message,
      }, host);
    }
    return null;
  } finally {
    cleanupAudioRecorderSession(session);
    if (store) store.delete(key);
  }
}

async function cancelManualAudioRecording(node, props, host) {
  const store = ensureAudioRecorderStore(host);
  const key = audioRecorderKey(node, props);
  const session = store && store.get(key);
  if (session) {
    session.cancelled = true;
    cleanupAudioRecorderSession(session);
    store.delete(key);
  }
  dispatchOwnerLabelUpdate(node, host, props.statusTargetRef || props.statusRef, 'idle');
  dispatchOwnerLabelUpdate(node, host, props.elapsedTargetRef || props.elapsedRef, 0);
  dispatchOwnerLabelUpdate(node, host, props.errorTargetRef || props.errorRef, '');
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

function closeAppContextMenu() {
  if (typeof document === 'undefined' || !document.body) return;
  for (const menu of Array.from(document.querySelectorAll('.dy-app-context-menu'))) {
    if (typeof menu.__dyContextMenuCleanup === 'function') menu.__dyContextMenuCleanup();
    menu.remove();
  }
}

function openAppContextMenu(event, options) {
  if (typeof document === 'undefined' || !document.body) return;
  if (!event || !options || typeof options.dispatchDelete !== 'function') return;
  if (typeof event.preventDefault === 'function') event.preventDefault();
  if (typeof event.stopPropagation === 'function') event.stopPropagation();
  closeAppContextMenu();
  const x = Number.isFinite(event.clientX) ? event.clientX : 24;
  const y = Number.isFinite(event.clientY) ? event.clientY : 24;
  const width = typeof window !== 'undefined' && Number.isFinite(window.innerWidth) ? window.innerWidth : 1024;
  const height = typeof window !== 'undefined' && Number.isFinite(window.innerHeight) ? window.innerHeight : 768;
  const menu = document.createElement('div');
  menu.className = 'dy-app-context-menu';
  menu.setAttribute('role', 'menu');
  menu.style.cssText = [
    'position:fixed',
    `left:${Math.max(12, Math.min(x, width - 188))}px`,
    `top:${Math.max(12, Math.min(y, height - 64))}px`,
    'z-index:2147483647',
    'min-width:176px',
    'padding:8px',
    'border-radius:18px',
    'background:rgba(255,255,255,0.96)',
    'border:1px solid rgba(148,163,184,0.28)',
    'box-shadow:0 22px 60px rgba(15,23,42,0.18)',
    'backdrop-filter:blur(18px)',
    'font-family:inherit',
  ].join(';');
  const item = document.createElement('button');
  item.type = 'button';
  item.setAttribute('role', 'menuitem');
  item.setAttribute('aria-label', `删除 ${options.title || 'App'}`);
  item.style.cssText = [
    'width:100%',
    'display:flex',
    'align-items:center',
    'gap:10px',
    'border:0',
    'border-radius:12px',
    'padding:10px 12px',
    'background:transparent',
    'color:#b91c1c',
    'font-size:14px',
    'font-weight:750',
    'text-align:left',
    'cursor:pointer',
  ].join(';');
  item.innerHTML = '<span aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:18px;font-weight:900;line-height:1">−</span><span>删除</span>';
  item.addEventListener('mouseenter', () => { item.style.background = '#fef2f2'; });
  item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
  const activate = (clickEvent) => {
    if (clickEvent && typeof clickEvent.preventDefault === 'function') clickEvent.preventDefault();
    if (clickEvent && typeof clickEvent.stopPropagation === 'function') clickEvent.stopPropagation();
    closeAppContextMenu();
    cleanupDocumentListeners();
    options.dispatchDelete();
  };
  item.addEventListener('click', activate);
  menu.appendChild(item);
  document.body.appendChild(menu);
  const cleanupDocumentListeners = () => {
    document.removeEventListener('keydown', onKeydown, true);
    document.removeEventListener('click', onDocumentClick);
    if (typeof window !== 'undefined') window.removeEventListener('blur', onWindowBlur, true);
    menu.__dyContextMenuCleanup = null;
  };
  const onKeydown = (keyEvent) => {
    if (keyEvent && keyEvent.key !== 'Escape') return;
    closeAppContextMenu();
    cleanupDocumentListeners();
  };
  const onDocumentClick = (clickEvent) => {
    const path = clickEvent && typeof clickEvent.composedPath === 'function' ? clickEvent.composedPath() : [];
    if ((path && path.includes(menu)) || (clickEvent && menu.contains(clickEvent.target))) return;
    closeAppContextMenu();
    cleanupDocumentListeners();
  };
  const onWindowBlur = () => {
    closeAppContextMenu();
    cleanupDocumentListeners();
  };
  document.addEventListener('keydown', onKeydown, true);
  document.addEventListener('click', onDocumentClick);
  if (typeof window !== 'undefined') window.addEventListener('blur', onWindowBlur, true);
  menu.__dyContextMenuCleanup = cleanupDocumentListeners;
}

function nextEventId() {
  eventCounter += 1;
  return `evt_${Date.now()}_${eventCounter}`;
}

function nextEditorEventId() {
  editorEventCounter += 1;
  return editorEventCounter;
}

function nextEditorOpId() {
  editorOpNonce += 1;
  return `op_${Date.now()}_${editorOpNonce}_${Math.random().toString(16).slice(2, 8)}`;
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
  const op_id = nextEditorOpId();
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

function normalizeEditorPinEvent(payload) {
  const event_id = nextEditorEventId();
  const op_id = nextEditorOpId();
  const body = {
    target: payload.target,
    pin: payload.pin,
    meta: { op_id },
  };
  if (payload.value !== undefined) {
    body.value = payload.value;
  }
  return {
    event_id,
    type: payload.pin,
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

function buildBusDispatchLabel(envelope) {
  return {
    p: 0,
    r: 0,
    c: 0,
    k: 'bus_in_event',
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
  const readRef = resolveRefForNode(node && node.bind && node.bind.read, node);
  if (!readRef || !isPlainObject(readRef) || !Number.isInteger(readRef.model_id)) return false;
  if (readRef.model_id === 0 || readRef.model_id === -1) return false;
  return normalizeCommitPolicy(target) !== 'immediate';
}

function stageOverlay(node, target, value, host) {
  if (!host || typeof host.stageOverlayValue !== 'function') return;
  const readRef = resolveRefForNode(node && node.bind && node.bind.read, node);
  host.stageOverlayValue({ ref: readRef, value, writeTarget: resolveWriteTargetForNode(target, node) });
}

function commitOverlay(node, target, value, host) {
  if (!host || typeof host.commitOverlayValue !== 'function') return;
  const readRef = resolveRefForNode(node && node.bind && node.bind.read, node);
  host.commitOverlayValue({ ref: readRef, value, writeTarget: resolveWriteTargetForNode(target, node) });
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
    || runtimeNode.type === 'StatusBar'
    || runtimeNode.type === 'Taskbar'
    || runtimeNode.type === 'NavigationRail'
    || runtimeNode.type === 'DesktopGrid'
    || runtimeNode.type === 'WidgetPanel'
    || runtimeNode.type === 'QuickSettingsPanel'
    || runtimeNode.type === 'AppWindow'
    || runtimeNode.type === 'SplitPaneWindow'
    || runtimeNode.type === 'AppSwitcher'
    || runtimeNode.type === 'Drawer'
  ) {
    base.children = (runtimeNode.children || []).map((child) => renderTreeNode(child, snapshot, registry));
    return base;
  }

  if (runtimeNode.type === 'AppCard') {
    base.title = (runtimeNode.props && (runtimeNode.props.title || runtimeNode.props.label)) || '';
    base.summary = (runtimeNode.props && runtimeNode.props.summary) || '';
    base.children = (runtimeNode.children || []).map((child) => renderTreeNode(child, snapshot, registry));
    return base;
  }

  if (runtimeNode.type === 'Card') {
    const title = runtimeNode.props && Object.prototype.hasOwnProperty.call(runtimeNode.props, 'title')
      ? resolveRefsDeep(runtimeNode.props.title, null, snapshot, null, runtimeNode)
      : '';
    base.title = title === undefined ? '' : title;
    base.children = (runtimeNode.children || []).map((child) => renderTreeNode(child, snapshot, registry));
    return base;
  }

  if (runtimeNode.type === 'Text') {
    const bind = runtimeNode.bind && runtimeNode.bind.read;
    const value = bind ? getEffectiveLabelValue(snapshot, bind, null, runtimeNode) : undefined;
    base.text = value !== undefined ? String(value) : (runtimeNode.props && runtimeNode.props.text) || '';
    return base;
  }

  if (runtimeNode.type === 'CodeBlock') {
    const bind = runtimeNode.bind && runtimeNode.bind.read;
    const value = bind ? getEffectiveLabelValue(snapshot, bind, null, runtimeNode) : undefined;
    base.text = value !== undefined ? stringifyForCodeBlock(value) : (runtimeNode.props && runtimeNode.props.text) || '';
    return base;
  }

  if (runtimeNode.type === 'Markdown') {
    base.text = readMarkdownText(runtimeNode, snapshot);
    return base;
  }

  if (runtimeNode.type === 'Input') {
    const bind = runtimeNode.bind && runtimeNode.bind.read;
    const value = bind ? getEffectiveLabelValue(snapshot, bind, null, runtimeNode) : undefined;
    base.value = value !== undefined ? value : '';
    return base;
  }

  if (runtimeNode.type === 'DatePicker' || runtimeNode.type === 'TimePicker') {
    const bind = runtimeNode.bind && runtimeNode.bind.read;
    const value = bind ? getEffectiveLabelValue(snapshot, bind, null, runtimeNode) : undefined;
    base.value = value !== undefined ? value : '';
    return base;
  }

  if (runtimeNode.type === 'Tabs') {
    const bind = runtimeNode.bind && runtimeNode.bind.read;
    const value = bind ? getEffectiveLabelValue(snapshot, bind, null, runtimeNode) : undefined;
    base.value = value !== undefined ? value : '';
    base.children = (runtimeNode.children || []).map((child) => renderTreeNode(child, snapshot, registry));
    return base;
  }

  if (runtimeNode.type === 'Dialog') {
    const bind = runtimeNode.bind && runtimeNode.bind.read;
    const value = bind ? getEffectiveLabelValue(snapshot, bind, null, runtimeNode) : undefined;
    base.value = value !== undefined ? Boolean(value) : false;
    base.children = (runtimeNode.children || []).map((child) => renderTreeNode(child, snapshot, registry));
    return base;
  }

  if (runtimeNode.type === 'ConversationList') {
    const conversationProps = runtimeNode.props || {};
    const rawItems = normalizeArrayValue(readComponentValue(snapshot, conversationProps, 'items', 'itemsRef', null, runtimeNode));
    const filterValue = String(readComponentValue(snapshot, conversationProps, 'filter', 'filterRef', null, runtimeNode) || '').trim();
    const filterAllValue = String(conversationProps.filterAllValue || 'all');
    const filterField = String(conversationProps.filterField || 'kind');
    base.items = filterValue && filterValue !== filterAllValue
      ? rawItems.filter((item) => String(item && item[filterField] != null ? item[filterField] : '') === filterValue)
      : rawItems;
    base.activeId = readComponentValue(snapshot, runtimeNode.props || {}, 'activeId', 'activeIdRef', null, runtimeNode) || '';
    return base;
  }

  if (runtimeNode.type === 'MessageTimeline') {
    base.events = normalizeMessageTimelineEvents(readComponentValue(snapshot, runtimeNode.props || {}, 'events', 'eventsRef', null, runtimeNode));
    base.activeRoomId = readComponentValue(snapshot, runtimeNode.props || {}, 'activeRoomId', 'activeRoomIdRef', null, runtimeNode) || '';
    return base;
  }

  if (runtimeNode.type === 'AttachmentPreview') {
    base.uri = readComponentValue(snapshot, runtimeNode.props || {}, 'uri', 'uriRef', null, runtimeNode) || '';
    base.name = readComponentValue(snapshot, runtimeNode.props || {}, 'name', 'nameRef', null, runtimeNode) || '';
    return base;
  }

  if (runtimeNode.type === 'Pagination') {
    const models = runtimeNode.bind && runtimeNode.bind.models;
    const currentRead = models && models.currentPage && models.currentPage.read;
    const sizeRead = models && models.pageSize && models.pageSize.read;
    const currentValue = currentRead ? getEffectiveLabelValue(snapshot, currentRead, null, runtimeNode) : undefined;
    const sizeValue = sizeRead ? getEffectiveLabelValue(snapshot, sizeRead, null, runtimeNode) : undefined;
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
    const value = bind ? getEffectiveLabelValue(snapshot, bind, null, runtimeNode) : undefined;
    base.value = value !== undefined ? value : '';
    return base;
  }

  if (runtimeNode.type === 'Button') {
    base.label = (runtimeNode.props && runtimeNode.props.label) || '';
    return base;
  }

  if (runtimeNode.type === 'AudioRecorder') {
    const recorderProps = runtimeNode.props || {};
    const status = readComponentValue(snapshot, recorderProps, 'status', 'statusRef', null, runtimeNode) || 'idle';
    const elapsed = readComponentValue(snapshot, recorderProps, 'elapsed', 'elapsedRef', null, runtimeNode) || 0;
    const error = readComponentValue(snapshot, recorderProps, 'error', 'errorRef', null, runtimeNode) || '';
    base.status = status;
    base.elapsed = elapsed;
    base.error = error;
    base.maxRecordMs = audioRecorderMaxMs(recorderProps);
    return base;
  }

  if (runtimeNode.type === 'ThreeScene') {
    base.props = normalizeThreeSceneHostProps(snapshot, runtimeNode.props || {}, runtimeNode);
    return base;
  }

  if (runtimeNode.type === 'ProgressBar') {
    const bind = runtimeNode.bind && runtimeNode.bind.read;
    const value = bind ? getEffectiveLabelValue(snapshot, bind, null, runtimeNode) : undefined;
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
  const props = resolveRefsDeep({ ...(node.props || {}) }, ctx, snapshot, host, node);
  if (!shouldRenderVisibleNode(props, snapshot, host, node)) return null;
  stripVisibilityProps(props);
  const children = (node.children || []).map((child) => buildVueNode(child, snapshot, vue, host, registry, ctx));

  if (node.type === 'Include') {
    const ref = props && Object.prototype.hasOwnProperty.call(props, 'ref') ? props.ref : null;
    const fallbackText = props && Object.prototype.hasOwnProperty.call(props, 'fallbackText') ? String(props.fallbackText) : 'Missing include';
    if (!ref || typeof ref !== 'object') {
      return h('div', fallbackText);
    }
    const fragment = getEffectiveLabelValue(snapshot, ref, host, node);
    if (!fragment || typeof fragment !== 'object') {
      return h('div', fallbackText);
    }
    return buildVueNode(fragment, snapshot, vue, host, registry, ctx);
  }

  if (node.type === 'HostSlot') {
    const slotName = props && typeof props.name === 'string' ? props.name : '';
    const slots = ctx && ctx.slots && typeof ctx.slots === 'object' ? ctx.slots : {};
    const slot = slotName ? slots[slotName] : null;
    if (typeof slot === 'function') return slot();
    return slot || null;
  }

  if (node.type === 'Text') {
    const bind = node.bind && node.bind.read;
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const value = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host, node)) : undefined;
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
    const value = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host, node)) : undefined;
    const text = value !== undefined ? stringifyForCodeBlock(value) : (props && Object.prototype.hasOwnProperty.call(props, 'text') ? props.text : '');
    return h('pre', props, text);
  }

  if (node.type === 'Markdown') {
    const markdown = readMarkdownText(node, snapshot, host, ctx);
    const markdownProps = {
      ...props,
      class: ['dy-markdown', props.class].filter(Boolean).join(' '),
      style: {
        color: '#334155',
        fontSize: '15px',
        lineHeight: '1.7',
        ...(props.style || {}),
      },
    };
    delete markdownProps.markdown;
    delete markdownProps.text;
    return h('article', markdownProps, renderMarkdownBlocks(markdown, h));
  }

  if (node.type === 'Heading') {
    const tag = `h${Math.min(4, Math.max(1, Number(props.level) || 1))}`;
    const text = Object.prototype.hasOwnProperty.call(props, 'text') ? String(props.text) : '';
    const headingProps = { ...props, style: { margin: '0', color: '#0f172a', ...(props.style || {}) } };
    delete headingProps.level;
    delete headingProps.text;
    return h(tag, headingProps, text);
  }

  if (node.type === 'Paragraph') {
    const text = Object.prototype.hasOwnProperty.call(props, 'text') ? String(props.text) : '';
    const lines = text.split('\n');
    const paragraphProps = { ...props, style: { margin: '0', color: '#334155', lineHeight: '1.7', ...(props.style || {}) } };
    delete paragraphProps.text;
    return h('p', paragraphProps, lines.flatMap((line, idx) => (
      idx === 0 ? [line] : [h('br'), line]
    )));
  }

  if (node.type === 'List') {
    const listTag = props.listType === 'ordered' ? 'ol' : 'ul';
    const listProps = { ...props, style: { margin: '0', paddingLeft: '1.25rem', color: '#334155', ...(props.style || {}) } };
    delete listProps.listType;
    return h(listTag, listProps, children);
  }

  if (node.type === 'ListItem') {
    const text = Object.prototype.hasOwnProperty.call(props, 'text') ? String(props.text) : '';
    const itemProps = { ...props, style: { margin: '0 0 4px 0', ...(props.style || {}) } };
    delete itemProps.text;
    return h('li', itemProps, children.length > 0 ? children : text);
  }

  if (node.type === 'Callout') {
    const palette = {
      tip: { border: '#16a34a', bg: '#f0fdf4', title: '#166534' },
      info: { border: '#2563eb', bg: '#eff6ff', title: '#1d4ed8' },
      warning: { border: '#d97706', bg: '#fef3c7', title: '#b45309' },
      danger: { border: '#dc2626', bg: '#fef2f2', title: '#b91c1c' },
    };
    const calloutType = typeof props.calloutType === 'string' ? props.calloutType : 'info';
    const colors = palette[calloutType] || palette.info;
    const title = typeof props.title === 'string' ? props.title : '';
    const text = Object.prototype.hasOwnProperty.call(props, 'text') ? String(props.text) : '';
    const calloutProps = {
      ...props,
      style: {
        borderLeft: `4px solid ${colors.border}`,
        background: colors.bg,
        borderRadius: '8px',
        padding: '12px 14px',
        color: '#334155',
        ...(props.style || {}),
      },
    };
    delete calloutProps.calloutType;
    delete calloutProps.title;
    delete calloutProps.text;
    return h('div', calloutProps, [
      title ? h('div', { style: { fontWeight: 600, color: colors.title, marginBottom: text || children.length > 0 ? '6px' : '0' } }, title) : null,
      text ? h('div', text) : null,
      ...children,
    ].filter(Boolean));
  }

  if (node.type === 'Image') {
    const imageProps = {
      ...props,
      src: typeof props.src === 'string' ? props.src : '',
      alt: typeof props.alt === 'string' ? props.alt : '',
      style: { maxWidth: '100%', height: 'auto', display: 'block', ...(props.style || {}) },
    };
    return h('img', imageProps);
  }

  if (node.type === 'MermaidDiagram') {
    const code = Object.prototype.hasOwnProperty.call(props, 'code') ? String(props.code) : '';
    const mermaidProps = {
      ...props,
      class: 'mermaid-placeholder',
      style: {
        background: '#f1f5f9',
        padding: '12px',
        borderRadius: '8px',
        overflowX: 'auto',
        color: '#334155',
        margin: '0',
        ...(props.style || {}),
      },
    };
    delete mermaidProps.code;
    return h('pre', mermaidProps, code);
  }

  if (node.type === 'Section') {
    const title = typeof props.title === 'string' ? props.title : '';
    const sectionNumber = Number.isFinite(props.sectionNumber) ? Number(props.sectionNumber) : null;
    const variant = typeof props.variant === 'string'
      ? props.variant
      : (typeof props.type === 'string' ? props.type : 'default');
    const isHero = variant === 'hero';
    const sectionProps = {
      ...props,
      style: {
        border: isHero ? 'none' : '1px solid #e2e8f0',
        background: isHero ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : '#ffffff',
        color: isHero ? '#f8fafc' : '#0f172a',
        borderRadius: '14px',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: isHero ? '0 12px 32px rgba(15,23,42,0.18)' : '0 1px 2px rgba(15,23,42,0.06)',
        ...(props.style || {}),
      },
    };
    delete sectionProps.title;
    delete sectionProps.sectionNumber;
    delete sectionProps.variant;
    delete sectionProps.type;
    return h('section', sectionProps, [
      title ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
        sectionNumber !== null
          ? h('span', {
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '28px',
              height: '28px',
              borderRadius: '999px',
              background: isHero ? 'rgba(255,255,255,0.14)' : '#e2e8f0',
              color: isHero ? '#f8fafc' : '#334155',
              fontSize: '13px',
              fontWeight: 700,
            },
          }, String(sectionNumber))
          : null,
        h('div', { style: { fontSize: isHero ? '20px' : '18px', fontWeight: 700 } }, title),
      ].filter(Boolean)) : null,
      ...children,
    ].filter(Boolean));
  }

  if (node.type === 'Input') {
    const bind = node.bind && node.bind.read;
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const value = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host, node)) : undefined;
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
    const value = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host, node)) : undefined;
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
    const value = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host, node)) : undefined;
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
    const value = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host, node)) : undefined;
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
    const value = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host, node)) : undefined;
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
    const value = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host, node)) : undefined;
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
    const value = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host, node)) : undefined;
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
    const value = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host, node)) : undefined;
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
      value: opt && Object.prototype.hasOwnProperty.call(opt, 'value') ? opt.value : undefined,
      label: opt && Object.prototype.hasOwnProperty.call(opt, 'label') ? opt.label : undefined,
      disabled: opt && Object.prototype.hasOwnProperty.call(opt, 'disabled') ? opt.disabled : undefined,
    }, {
      default: () => (opt && Object.prototype.hasOwnProperty.call(opt, 'label') ? opt.label : ''),
    }));
    return h(resolve('ElRadioGroup'), props, { default: () => optionNodes.concat(children) });
  }

  if (node.type === 'Radio') {
    const labelText = Object.prototype.hasOwnProperty.call(props, 'text')
      ? props.text
      : (Object.prototype.hasOwnProperty.call(props, 'label') ? props.label : '');
    if (Object.prototype.hasOwnProperty.call(props, 'text')) {
      delete props.text;
    }
    if (!Object.prototype.hasOwnProperty.call(props, 'value') && Object.prototype.hasOwnProperty.call(props, 'label')) {
      props.value = props.label;
    }
    return h(resolve('ElRadio'), props, {
      default: () => (children.length > 0 ? children : labelText),
    });
  }

  if (node.type === 'Slider') {
    const bind = node.bind && node.bind.read;
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const value = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host, node)) : undefined;
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
    const value = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host, node)) : undefined;
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

  if (node.type === 'AudioRecorder') {
    const store = ensureAudioRecorderStore(host);
    const key = audioRecorderKey(node, props);
    const session = store ? store.get(key) : null;
    const rawStatus = String(readComponentValue(snapshot, props, 'status', 'statusRef', host, node) || 'idle');
    const status = session && session.state ? session.state : rawStatus;
    const maxMs = audioRecorderMaxMs(props);
    const elapsedValue = session && session.startedAt
      ? Math.min(maxMs, Date.now() - session.startedAt)
      : Number(readComponentValue(snapshot, props, 'elapsed', 'elapsedRef', host, node) || 0);
    const errorText = String(readComponentValue(snapshot, props, 'error', 'errorRef', host, node) || '');
    const startLabel = String(props.startLabel || props.label || 'Voice');
    const finishLabel = String(props.finishLabel || 'Finish');
    const cancelLabel = String(props.cancelLabel || 'Cancel');
    const recordingTitle = String(props.recordingTitle || 'Recording voice message');
    const recordingHint = String(props.recordingHint || 'Speak now. Click Finish or press Enter to send.');
    const maxLabel = `${Math.ceil(maxMs / 1000)}s max`;
    const elapsedLabel = `${Math.max(0, Math.floor(Number(elapsedValue || 0) / 1000))}s`;
    const rootProps = cleanComponentProps(props, [
      'status',
      'statusRef',
      'statusTargetRef',
      'elapsed',
      'elapsedRef',
      'elapsedTargetRef',
      'error',
      'errorRef',
      'errorTargetRef',
      'startLabel',
      'finishLabel',
      'cancelLabel',
      'recordingTitle',
      'recordingHint',
      'maxRecordMs',
      'max_record_ms',
      'finishOnEnter',
      'audioFilenamePrefix',
      'recorderKey',
      'recorder_key',
      'label',
    ]);
    const start = async () => {
      try {
        await startManualAudioRecording(node, props, host);
      } catch (err) {
        dispatchOwnerLabelUpdate(node, host, props.statusTargetRef || props.statusRef, 'error');
        dispatchOwnerLabelUpdate(node, host, props.errorTargetRef || props.errorRef, err && err.message ? err.message : String(err));
      }
    };
    const finish = async () => {
      await finishManualAudioRecording(node, props, host);
    };
    const cancel = async () => {
      await cancelManualAudioRecording(node, props, host);
    };
    const isStartingState = status === 'starting' || status === 'pending_start';
    const onKeydown = async (event) => {
      if (!event || event.key !== 'Enter' || isEditableKeyTarget(event.target)) return;
      if (isStartingState) return;
      if (typeof event.preventDefault === 'function') event.preventDefault();
      await finish();
    };
    const baseStyle = {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flexWrap: 'wrap',
      ...(props.style || {}),
    };
    if (isStartingState || status === 'recording' || status === 'uploading') {
      const uploading = status === 'uploading';
      const starting = isStartingState;
      return h('div', {
        ...rootProps,
        role: 'region',
        'aria-label': recordingTitle,
        tabindex: 0,
        onKeydown,
        style: {
          ...baseStyle,
          width: '100%',
          padding: '10px 12px',
          border: '1px solid rgba(239,68,68,0.32)',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(254,242,242,0.96), rgba(255,247,237,0.94))',
        },
      }, [
        h('span', {
          style: {
            width: '10px',
            height: '10px',
            borderRadius: '999px',
            background: uploading || starting ? '#f97316' : '#ef4444',
            boxShadow: uploading || starting ? '0 0 0 6px rgba(249,115,22,0.12)' : '0 0 0 6px rgba(239,68,68,0.12)',
          },
        }),
        h('span', { style: { minWidth: 0, flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: '2px' } }, [
          h('strong', { style: { color: '#111827', fontSize: '14px' } }, uploading ? 'Uploading voice message' : (starting ? 'Starting voice recording' : recordingTitle)),
          h('span', { style: { color: '#64748b', fontSize: '12px' } }, uploading ? 'Preparing Matrix audio message...' : (starting ? 'Waiting for microphone permission...' : `${recordingHint} · ${elapsedLabel} / ${maxLabel}`)),
        ]),
        h('button', {
          type: 'button',
          disabled: uploading || starting,
          onClick: finish,
          style: {
            border: '0',
            borderRadius: '999px',
            padding: '8px 16px',
            background: uploading || starting ? '#cbd5e1' : '#16a34a',
            color: '#ffffff',
            fontWeight: 800,
            cursor: uploading || starting ? 'not-allowed' : 'pointer',
          },
        }, finishLabel),
        h('button', {
          type: 'button',
          disabled: uploading,
          onClick: cancel,
          style: {
            border: '1px solid #fecaca',
            borderRadius: '999px',
            padding: '8px 14px',
            background: '#ffffff',
            color: '#dc2626',
            fontWeight: 700,
            cursor: uploading ? 'not-allowed' : 'pointer',
          },
        }, cancelLabel),
      ]);
    }
    return h('div', {
      ...rootProps,
      style: baseStyle,
    }, [
      h('button', {
        type: 'button',
        onClick: start,
        style: {
          border: '1px solid #d0d7de',
          borderRadius: '999px',
          padding: '8px 16px',
          background: '#ffffff',
          color: '#111827',
          fontWeight: 750,
          cursor: 'pointer',
        },
      }, startLabel),
      status === 'error' && errorText ? h('span', { style: { color: '#dc2626', fontSize: '12px' } }, errorText) : null,
    ].filter(Boolean));
  }

  if (node.type === 'Button') {
    const bind = node.bind && node.bind.read;
    if (bind) {
      const value = getEffectiveLabelValue(snapshot, bind, host, node);
      if (value === false) {
        props.disabled = true;
      } else if (value === true) {
        props.disabled = false;
      }
    }
    if (props.enabledRef && typeof props.enabledRef === 'object') {
      const enabledValue = getEffectiveLabelValue(snapshot, props.enabledRef, host, node);
      if (enabledValue === false || enabledValue == null || String(enabledValue).trim() === '') {
        props.disabled = true;
      }
    }
    if (props.disabledRef && typeof props.disabledRef === 'object') {
      const disabledValue = getEffectiveLabelValue(snapshot, props.disabledRef, host, node);
      if (disabledValue === true || (typeof disabledValue === 'string' && disabledValue.trim() !== '')) {
        props.disabled = true;
      }
    }
    const singleFlight = node.props && node.props.singleFlight;
    const singleFlightEnabled = Boolean(singleFlight);
    const singleFlightStore = singleFlightEnabled ? ensureSingleFlightStore(host) : null;
    const singleFlightKey = singleFlightEnabled
      ? (singleFlight.key || node.id || `${node.type}`)
      : null;
    const releaseRef = singleFlightEnabled ? (singleFlight.releaseRef || singleFlight.release_ref || null) : null;
    const releaseVal = releaseRef ? getEffectiveLabelValue(snapshot, releaseRef, host, node) : null;
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

    props.onClick = async () => {
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
      let clickPayload = { click: true };
      if (props.mediaAction === 'record_audio') {
        clickPayload = { ...clickPayload, media_uri: '', file_name: '', mime_type: '', media_error: '' };
        try {
          clickPayload = { ...clickPayload, ...(await recordAudioUpload(host, props)) };
        } catch (err) {
          clickPayload = {
            ...clickPayload,
            media_error: err && err.message ? err.message : String(err),
          };
        }
      }
      const result = dispatchEvent(node, target, clickPayload, host, undefined, ctx);
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
    delete buttonProps.enabledRef;
    delete buttonProps.disabledRef;

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
    const value = bind ? getEffectiveLabelValue(snapshot, bind, host, node) : undefined;
    props.modelValue = value === true;
    props['onUpdate:modelValue'] = (v) => {
      if (Boolean(v) === props.modelValue) return;
      const target = node.bind && node.bind.write;
      if (!target) return;
      dispatchEvent(node, target, { value: Boolean(v) }, host, undefined, ctx);
    };
    return h(resolve('ElDrawer'), props, { default: () => children });
  }

  if (node.type === 'Dialog') {
    const bind = node.bind && node.bind.read;
    const value = bind ? getEffectiveLabelValue(snapshot, bind, host, node) : undefined;
    props.modelValue = value === true;
    props['onUpdate:modelValue'] = (v) => {
      if (Boolean(v) === props.modelValue) return;
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
    const currentValue = currentRead ? getEffectiveLabelValue(snapshot, currentRead, host, node) : undefined;
    const sizeValue = sizeRead ? getEffectiveLabelValue(snapshot, sizeRead, host, node) : undefined;
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
    const colorValue = bind ? getEffectiveLabelValue(snapshot, bind, host, node) : undefined;
    const bgColor = typeof colorValue === 'string' && colorValue.startsWith('#') ? colorValue : '#FFFFFF';
    const boxStyle = {
      backgroundColor: bgColor,
      width: toCssLength(node.props && node.props.width, '100px'),
      height: toCssLength(node.props && node.props.height, '60px'),
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
    const value = bind ? getEffectiveLabelValue(snapshot, bind, host, node) : undefined;
    const html = value !== undefined ? String(value) : (node.props && Object.prototype.hasOwnProperty.call(node.props, 'html') ? String(node.props.html) : '');
    const divProps = { ...props };
    delete divProps.html;
    divProps.innerHTML = html;
    return h('div', divProps);
  }

  if (node.type === 'ThreeSceneHost') {
    return h(resolve('ThreeSceneHost'), normalizeThreeSceneHostProps(snapshot, props, node));
  }

  if (node.type === 'Link') {
    const href = Object.prototype.hasOwnProperty.call(props, 'href') ? props.href : '';
    const text = Object.prototype.hasOwnProperty.call(props, 'text') ? props.text : '';
    const aProps = { ...props, href: href || '', target: props.target || '_blank', rel: props.rel || 'noopener noreferrer' };
    delete aProps.text;
    return h('a', aProps, (text || href || '').toString());
  }

  if (node.type === 'FileInput') {
    const accept = Object.prototype.hasOwnProperty.call(props, 'accept') ? props.accept : undefined;
    const multiple = Boolean(Object.prototype.hasOwnProperty.call(props, 'multiple') ? props.multiple : false);
    const directory = Boolean(Object.prototype.hasOwnProperty.call(props, 'directory') ? props.directory : false);
    const labelText = Object.prototype.hasOwnProperty.call(props, 'label') ? String(props.label) : '';
    const wrapStyle = props && props.style ? props.style : undefined;
    const triggerLabel = Object.prototype.hasOwnProperty.call(props, 'buttonLabel')
      ? String(props.buttonLabel)
      : '选择文件';
    const emptyText = Object.prototype.hasOwnProperty.call(props, 'emptyText')
      ? String(props.emptyText)
      : '未选择任何文件';
    const selectedText = Object.prototype.hasOwnProperty.call(props, 'selectedText') ? props.selectedText : '';
    const multiAttr = multiple || directory;
    let inputEl = null;
    let selectedTextEl = null;
    const setSelectedText = (value) => {
      if (!selectedTextEl) return;
      if (typeof value === 'string') {
        selectedTextEl.textContent = value.trim() ? value : emptyText;
        return;
      }
      if (Array.isArray(value)) {
        const merged = value.filter((item) => typeof item === 'string' && item.trim()).join(', ');
        selectedTextEl.textContent = merged || emptyText;
        return;
      }
      selectedTextEl.textContent = emptyText;
    };
    const syncInputRef = (el) => {
      inputEl = el;
    };
    const syncSelectedTextRef = (el) => {
      selectedTextEl = el;
      setSelectedText(selectedText);
    };
    const openPicker = () => {
      if (inputEl && typeof inputEl.click === 'function') {
        inputEl.click();
      }
    };
    const onChange = async (e) => {
      const input = e && e.target ? e.target : null;
      const files = input && input.files ? input.files : null;
      const target = (node.bind && node.bind.write) || (node.props && node.props.valueRef
        ? { action: 'label_update', target_ref: node.props.valueRef }
        : null);
      if (!files || files.length === 0) return;
      if (!target) return;
      const chosenNames = Array.from(files).map((file) => (file && file.name ? String(file.name) : ''));
      setSelectedText(chosenNames.filter(Boolean).join(', '));
      if (typeof host.uploadMedia !== 'function') {
        dispatchEvent(node, target, { value: '' }, host, undefined, ctx);
        return;
      }
      try {
        const list = Array.from(files);
        const uploaded = [];
        const uploadPurpose = target && target.bus_in_key === 'slide_import_media_uri_update'
          ? 'slide-import'
          : '';
        for (const file of list) {
          const result = await host.uploadMedia({
            file,
            filename: file && file.name ? String(file.name) : 'upload.bin',
            contentType: file && file.type ? String(file.type) : 'application/octet-stream',
            meta: {
              node_id: node.id,
              node_type: node.origin_type || node.type,
              upload_purpose: uploadPurpose,
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
        const nameTargetRef = isPlainObject(props.nameTargetRef) ? props.nameTargetRef : null;
        if (nameTargetRef) {
          dispatchEvent(node, { action: 'ui_owner_label_update', target_ref: nameTargetRef }, {
            value: uploaded.map((item) => item.name).filter(Boolean).join(', '),
          }, host, undefined, ctx);
        }
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
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } }, [
        h('button', {
          type: 'button',
          onClick: openPicker,
          style: {
            border: '1px solid #d0d7de',
            background: '#ffffff',
            color: '#111827',
            borderRadius: '8px',
            padding: '8px 14px',
            cursor: 'pointer',
            fontSize: '14px',
          },
        }, triggerLabel),
        h('span', {
          ref: syncSelectedTextRef,
          style: { color: '#475569', fontSize: '14px' },
        }, selectedText && String(selectedText).trim() ? String(selectedText) : emptyText),
        h('input', {
          type: 'file',
          accept,
          multiple: multiAttr,
          webkitdirectory: directory,
          directory,
          onChange,
          ref: syncInputRef,
          style: { display: 'none' },
        }),
      ]),
    ].filter(Boolean));
  }

  if (node.type === 'ConversationList') {
    const rawItems = normalizeArrayValue(readComponentValue(snapshot, props, 'items', 'itemsRef', host, node));
    const filterValue = String(readComponentValue(snapshot, props, 'filter', 'filterRef', host, node) || '').trim();
    const filterAllValue = String(props.filterAllValue || 'all');
    const filterField = String(props.filterField || 'kind');
    const items = filterValue && filterValue !== filterAllValue
      ? rawItems.filter((item) => String(item && item[filterField] != null ? item[filterField] : '') === filterValue)
      : rawItems;
    const activeId = String(readComponentValue(snapshot, props, 'activeId', 'activeIdRef', host, node) || '');
    const idField = props.idField || 'id';
    const primaryField = props.primaryField || 'name';
    const secondaryField = props.secondaryField || 'last_message';
    const badgeField = props.badgeField || 'unread';
    const fallbackLabel = props.fallbackLabel || 'Unnamed room';
    const showId = props.showId === true;
    const target = node.bind && node.bind.write;
    const listProps = cleanComponentProps(props, ['idField', 'primaryField', 'secondaryField', 'badgeField', 'fallbackLabel', 'showId', 'emptyText', 'filter', 'filterRef', 'filterField', 'filterAllValue', 'itemsRef', 'activeIdRef']);
    const emptyText = props.emptyText || 'No conversations yet';
    return h('div', {
      ...listProps,
      role: 'listbox',
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
        ...(props.style || {}),
      },
    }, items.length > 0 ? items.map((item, index) => {
      const id = fieldText(item, idField, `item-${index}`);
      const primary = fieldText(item, primaryField, '') || fieldText(item, 'name', fallbackLabel);
      const secondary = fieldText(item, secondaryField, '');
      const unread = Number(item && item[badgeField] ? item[badgeField] : 0);
      const selected = id === activeId;
      const rowPayload = { value: id, row: item, item };
      return h('button', {
        key: id,
        type: 'button',
        role: 'option',
        'aria-selected': selected,
        title: showId ? primary : `room id: ${id}`,
        onClick: () => {
          if (!target) return;
          dispatchEvent(node, target, rowPayload, host, undefined, { value: id, row: item, payload: rowPayload });
        },
        style: {
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '44px minmax(0,1fr) auto',
          alignItems: 'center',
          gap: '10px',
          border: '0',
          borderRadius: '16px',
          padding: '10px',
          textAlign: 'left',
          cursor: 'pointer',
          background: selected ? 'rgba(20,184,166,0.14)' : 'transparent',
          color: '#111827',
          transition: 'background 120ms ease, transform 120ms ease',
        },
      }, [
        h('span', {
          style: {
            width: '40px',
            height: '40px',
            borderRadius: '999px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            background: selected ? '#0f766e' : '#d9f99d',
            color: selected ? '#ffffff' : '#134e4a',
            flexShrink: 0,
          },
        }, fieldText(item, 'avatar', primary.slice(0, 2).toUpperCase())),
        h('span', { style: { minWidth: 0, display: 'grid', gap: '3px' } }, [
          h('strong', { style: { fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, primary),
          secondary ? h('span', { style: { fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, secondary) : null,
        ]),
        unread > 0 ? h('span', {
          style: {
            minWidth: '22px',
            height: '22px',
            borderRadius: '999px',
            background: '#0f766e',
            color: '#ffffff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 800,
          },
        }, String(unread)) : null,
      ].filter(Boolean));
    }) : [h('div', { style: { padding: '12px', color: '#94a3b8', fontSize: '13px' } }, emptyText)]);
  }

  if (node.type === 'MessageTimeline') {
    const events = normalizeMessageTimelineEvents(readComponentValue(snapshot, props, 'events', 'eventsRef', host, node));
    const activeRoomId = String(readComponentValue(snapshot, props, 'activeRoomId', 'activeRoomIdRef', host, node) || '');
    const currentUser = String(props.currentUser || 'You');
    const filtered = events.filter((event) => !activeRoomId || String(event.room_id || event.roomId || '') === activeRoomId);
    const timelineProps = cleanComponentProps(props, ['activeRoomIdRef', 'currentUser', 'emptyText']);
    const emptyText = props.emptyText || 'No messages yet';
    return h('section', {
      ...timelineProps,
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflowY: 'auto',
        padding: '18px 20px',
        minHeight: 0,
        ...(props.style || {}),
      },
    }, filtered.length > 0 ? filtered.map((event, index) => {
      const sender = fieldText(event, 'sender', 'system');
      const mine = event.mine === true || sender === currentUser || sender === 'You';
      const body = fieldText(event, 'body', '');
      const fileName = fieldText(event, 'file_name', fieldText(event, 'filename', body));
      const mediaUri = fieldText(event, 'media_uri', fieldText(event, 'url', ''));
      const kind = messageCardKind(event);
      const downloadUrl = fieldText(event, 'download_url', '');
      const thumbnailUrl = fieldText(event, 'thumbnail_url', '');
      const metaParts = [
        fieldText(event, 'mime_type', ''),
        fieldText(event, 'size', '') ? `${Math.round(Number(event.size) / 1024)} KB` : '',
      ].filter(Boolean);
      const actionLink = downloadUrl
        ? h('a', {
          href: downloadUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
          download: fileName || undefined,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '9px',
            minHeight: '30px',
            padding: '0 10px',
            borderRadius: '999px',
            background: mine ? 'rgba(255,255,255,0.22)' : '#e0f2fe',
            color: mine ? '#ffffff' : '#075985',
            textDecoration: 'none',
            fontSize: '12px',
            fontWeight: 850,
          },
        }, kind === 'image' ? 'Open / download' : (kind === 'audio' ? 'Download audio' : 'Download file'))
        : null;
      const bubbleBg = mine ? '#2563eb' : '#ffffff';
      const bubbleColor = mine ? '#ffffff' : '#0f172a';
      const bubbleBorder = mine ? '1px solid rgba(37,99,235,0.10)' : '1px solid #e2e8f0';
      const attachment = kind !== 'text'
        ? h('div', {
          style: {
            marginTop: body && body !== fileName ? '8px' : '0',
            border: mine ? '1px solid rgba(255,255,255,0.28)' : '1px solid #dbe4ef',
            borderRadius: '14px',
            padding: kind === 'image' ? '8px' : '10px 12px',
            background: mine ? 'rgba(255,255,255,0.12)' : '#f8fafc',
          },
        }, kind === 'image'
          ? [
            thumbnailUrl
              ? h('img', {
                src: thumbnailUrl,
                alt: fileName || body || 'image',
                style: { width: '240px', maxWidth: '100%', aspectRatio: '16/10', objectFit: 'cover', borderRadius: '10px', display: 'block', background: '#e2e8f0' },
              })
              : h('div', { style: { width: '220px', maxWidth: '100%', aspectRatio: '16/10', borderRadius: '10px', background: 'linear-gradient(135deg,#dbeafe,#ccfbf1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: mine ? '#ffffff' : '#0f766e', fontWeight: 800 } }, 'Image'),
            h('div', { style: { marginTop: '7px', fontSize: '12px', color: mine ? 'rgba(255,255,255,0.82)' : '#475569' } }, fileName || mediaUri || 'image'),
            metaParts.length ? h('div', { style: { marginTop: '2px', fontSize: '11px', color: mine ? 'rgba(255,255,255,0.70)' : '#64748b' } }, metaParts.join(' · ')) : null,
            actionLink,
          ]
          : [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
              h('span', { style: { width: '36px', height: '36px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', background: mine ? 'rgba(255,255,255,0.18)' : '#dbeafe', color: mine ? '#ffffff' : '#1d4ed8', fontSize: '11px', fontWeight: 900 } }, kind === 'audio' ? 'AUD' : 'FILE'),
              h('span', { style: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' } }, [
                h('span', { style: { fontWeight: 850, color: mine ? '#ffffff' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, kind === 'audio' ? 'Audio message' : 'File'),
                h('span', { style: { fontSize: '12px', color: mine ? 'rgba(255,255,255,0.82)' : '#475569', wordBreak: 'break-word' } }, fileName || mediaUri || 'attachment'),
                metaParts.length ? h('span', { style: { fontSize: '11px', color: mine ? 'rgba(255,255,255,0.70)' : '#64748b' } }, metaParts.join(' · ')) : null,
              ].filter(Boolean)),
            ]),
            kind === 'audio' && downloadUrl ? h('audio', { controls: true, preload: 'metadata', src: downloadUrl, style: { width: '260px', maxWidth: '100%', marginTop: '9px' } }) : null,
            actionLink,
          ].filter(Boolean))
        : null;
      return h('article', {
        key: event.event_id || event.id || `${index}`,
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: mine ? 'flex-end' : 'flex-start',
          gap: '4px',
        },
      }, [
        h('div', { style: { fontSize: '11px', color: '#94a3b8', padding: mine ? '0 8px 0 0' : '0 0 0 8px' } }, `${sender} · ${event.ts || ''}${event.edited ? ' · edited' : ''}`),
        h('div', {
          style: {
            maxWidth: 'min(680px, 78%)',
            borderRadius: mine ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
            background: bubbleBg,
            color: bubbleColor,
            border: bubbleBorder,
            boxShadow: mine ? '0 16px 36px rgba(37, 99, 235, 0.18)' : '0 14px 30px rgba(15, 23, 42, 0.06)',
            padding: '12px 14px',
            lineHeight: 1.55,
            wordBreak: 'break-word',
          },
        }, [
          body && kind === 'text' ? h('div', body) : null,
          body && kind !== 'text' && body !== fileName ? h('div', body) : null,
          attachment,
        ].filter(Boolean)),
      ]);
    }) : [
      h('div', {
        style: {
          margin: 'auto',
          color: '#64748b',
          border: '1px dashed #cbd5e1',
          borderRadius: '18px',
          padding: '24px',
          textAlign: 'center',
          background: '#f8fafc',
        },
      }, emptyText),
    ]);
  }

  if (node.type === 'AttachmentPreview') {
    const uri = String(readComponentValue(snapshot, props, 'uri', 'uriRef', host, node) || '').trim();
    const name = String(readComponentValue(snapshot, props, 'name', 'nameRef', host, node) || '').trim();
    const previewProps = cleanComponentProps(props, ['emptyText']);
    if (!uri && !name) {
      return h('div', { ...previewProps, style: { display: 'none', ...(props.style || {}) } });
    }
    const kind = extensionKind(name, uri);
    return h('div', {
      ...previewProps,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        border: '1px solid #dbe4ef',
        background: '#f8fafc',
        borderRadius: '16px',
        padding: '10px 12px',
        color: '#0f172a',
        ...(props.style || {}),
      },
    }, [
      h('span', {
        style: {
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: kind === 'image' ? 'linear-gradient(135deg,#bfdbfe,#99f6e4)' : '#e2e8f0',
          color: '#0f172a',
          fontWeight: 900,
        },
      }, kind === 'image' ? 'IMG' : (kind === 'audio' ? 'AUD' : 'FILE')),
      h('span', { style: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' } }, [
        h('span', { style: { fontSize: '13px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, name || 'Selected file'),
        h('span', { style: { fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, uri),
      ]),
    ]);
  }

  if (node.type === 'TodoBoard') {
    const tasks = readTodoTasks(node, snapshot, props, host);
    const columns = normalizeTodoColumns(props.columns);
    const writeTarget = node.bind && node.bind.write;
    const boardProps = cleanComponentProps(props, ['tasks', 'tasksRef', 'columns', 'emptyText']);
    const emptyText = typeof props.emptyText === 'string' ? props.emptyText : '没有任务';
    const actionButton = (task, action, status, label, tone) => h('button', {
      type: 'button',
      onClick: (event) => {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        dispatchTodoAction(node, host, writeTarget, action, { task_id: task.id, status }, ctx);
      },
      style: {
        border: `1px solid ${tone}22`,
        borderRadius: '999px',
        background: `${tone}12`,
        color: tone,
        padding: '5px 9px',
        fontSize: '12px',
        fontWeight: 800,
        cursor: 'pointer',
      },
    }, label);
    const renderTask = (task) => {
      const current = todoStatusMeta(columns, task.status);
      return h('article', {
        key: task.id,
        draggable: true,
        onDragstart: (event) => {
          if (event && event.dataTransfer && typeof event.dataTransfer.setData === 'function') {
            event.dataTransfer.setData('text/plain', task.id);
          }
        },
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '13px',
          borderRadius: '18px',
          background: '#ffffff',
          border: '1px solid rgba(148,163,184,0.24)',
          boxShadow: '0 14px 34px rgba(15,23,42,0.08)',
          cursor: 'grab',
        },
      }, [
        h('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' } }, [
          h('strong', { style: { color: '#0f172a', fontSize: '15px', lineHeight: '1.28' } }, truncateText(task.title, 64)),
          h('button', {
            type: 'button',
            onClick: (event) => {
              if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
              dispatchTodoAction(node, host, writeTarget, 'open_edit', { task_id: task.id }, ctx);
            },
            style: {
              border: '0',
              borderRadius: '999px',
              background: '#f1f5f9',
              color: '#334155',
              padding: '5px 8px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
            },
          }, '编辑'),
        ]),
        task.body ? h('p', { style: { margin: 0, color: '#64748b', fontSize: '13px', lineHeight: '1.52' } }, truncateText(task.body, 118)) : null,
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' } }, [
          h('span', {
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: '999px',
              padding: '5px 9px',
              color: current.tone,
              background: current.bg,
              fontSize: '11px',
              fontWeight: 900,
            },
          }, current.label),
          h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, [
            task.status !== 'doing' ? actionButton(task, 'move_status', 'doing', '开始', '#d97706') : null,
            task.status !== 'done' ? actionButton(task, 'move_status', 'done', '完成', '#16a34a') : null,
            task.status !== 'archived' ? actionButton(task, 'move_status', 'archived', '归档', '#64748b') : null,
          ].filter(Boolean)),
        ]),
      ].filter(Boolean));
    };
    const columnNodes = columns.map((column) => {
      const columnTasks = tasks.filter((task) => task.status === column.value);
      return h('section', {
        key: column.value,
        'data-status': column.value,
        onDragover: (event) => {
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
        },
        onDrop: (event) => {
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          const taskId = event && event.dataTransfer && typeof event.dataTransfer.getData === 'function'
            ? event.dataTransfer.getData('text/plain')
            : '';
          if (!taskId) return;
          dispatchTodoAction(node, host, writeTarget, 'move_status', { task_id: taskId, status: column.value }, ctx);
        },
        style: {
          minWidth: '230px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          borderRadius: '24px',
          padding: '14px',
          background: `linear-gradient(180deg, ${column.bg}, rgba(255,255,255,0.84))`,
          border: '1px solid rgba(148,163,184,0.28)',
          boxSizing: 'border-box',
        },
      }, [
        h('header', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } }, [
          h('span', { style: { color: '#0f172a', fontSize: '14px', fontWeight: 900 } }, column.label),
          h('span', { style: { minWidth: '26px', height: '24px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', color: column.tone, fontSize: '12px', fontWeight: 900 } }, String(columnTasks.length)),
        ]),
        columnTasks.length
          ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, columnTasks.map(renderTask))
          : h('div', { style: { border: '1px dashed rgba(148,163,184,0.44)', borderRadius: '16px', color: '#94a3b8', padding: '16px', fontSize: '13px', textAlign: 'center' } }, emptyText),
      ]);
    });
    return h('section', {
      ...boardProps,
      style: {
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(230px, 1fr))`,
        gap: '14px',
        width: '100%',
        overflowX: 'auto',
        paddingBottom: '4px',
        ...(props.style || {}),
      },
    }, columnNodes);
  }

  if (node.type === 'TodoFocusList') {
    const tasks = readTodoTasks(node, snapshot, props, host);
    const columns = normalizeTodoColumns(props.columns);
    const writeTarget = node.bind && node.bind.write;
    const filterText = String(readComponentValue(snapshot, props, 'filterText', 'filterRef', host, node) || '').trim().toLowerCase();
    const listProps = cleanComponentProps(props, ['tasks', 'tasksRef', 'columns', 'filterText', 'filterRef', 'emptyText']);
    const visibleTasks = tasks
      .filter((task) => task.status !== 'done' && task.status !== 'archived')
      .filter((task) => {
        if (!filterText) return true;
        return `${task.title} ${task.body}`.toLowerCase().includes(filterText);
      });
    const emptyText = typeof props.emptyText === 'string' ? props.emptyText : '没有匹配的未完成任务';
    return h('section', {
      ...listProps,
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        ...(props.style || {}),
      },
    }, visibleTasks.length ? visibleTasks.map((task) => {
      const current = todoStatusMeta(columns, task.status);
      return h('article', {
        key: task.id,
        style: {
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: '16px',
          alignItems: 'start',
          padding: '16px',
          borderRadius: '22px',
          background: '#ffffff',
          border: '1px solid rgba(148,163,184,0.24)',
          boxShadow: '0 16px 38px rgba(15,23,42,0.08)',
        },
      }, [
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 } }, [
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } }, [
            h('span', { style: { color: '#0f172a', fontSize: '17px', fontWeight: 900, lineHeight: '1.25' } }, task.title),
            h('span', { style: { borderRadius: '999px', padding: '4px 8px', color: current.tone, background: current.bg, fontSize: '11px', fontWeight: 900 } }, current.label),
          ]),
          task.body ? h('p', { style: { margin: 0, color: '#475569', fontSize: '14px', lineHeight: '1.62' } }, task.body) : null,
        ]),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, [
          h('button', {
            type: 'button',
            onClick: () => dispatchTodoAction(node, host, writeTarget, 'open_edit', { task_id: task.id }, ctx),
            style: { border: '0', borderRadius: '999px', background: '#f1f5f9', color: '#334155', padding: '8px 12px', fontSize: '13px', fontWeight: 850, cursor: 'pointer' },
          }, '编辑'),
          h('button', {
            type: 'button',
            onClick: () => dispatchTodoAction(node, host, writeTarget, 'move_status', { task_id: task.id, status: 'done' }, ctx),
            style: { border: '0', borderRadius: '999px', background: '#dcfce7', color: '#15803d', padding: '8px 12px', fontSize: '13px', fontWeight: 850, cursor: 'pointer' },
          }, '完成'),
        ]),
      ].filter(Boolean));
    }) : [
      h('div', { style: { border: '1px dashed rgba(148,163,184,0.44)', borderRadius: '18px', color: '#94a3b8', padding: '24px', fontSize: '14px', textAlign: 'center', background: '#f8fafc' } }, emptyText),
    ]);
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
    const boundValue = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host, node)) : undefined;

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
    const boundStatus = bind ? getEffectiveLabelValue(snapshot, bind, host, node) : undefined;

    const label = props.label || 'STATUS';
    const status = boundStatus !== undefined ? boundStatus : props.status || 'idle';
    const text = props.text || status;

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
    const boundContent = bind ? getEffectiveLabelValue(snapshot, bind, host, node) : undefined;

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

  if (node.type === 'StatusBar') {
    const title = typeof props.title === 'string' ? props.title : 'Dongyu OS';
    const subtitle = typeof props.subtitle === 'string' ? props.subtitle : '';
    const time = typeof props.time === 'string' ? props.time : '';
    const status = typeof props.status === 'string' ? props.status : 'online';
    const statusBarProps = cleanShellProps(props, ['title', 'subtitle', 'time', 'status']);
    return h('header', { ...statusBarProps, style: mergeShellStyle({
      minHeight: '52px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      padding: '10px 18px',
      border: `1px solid ${SHELL_TEXT.line}`,
      borderRadius: '24px',
      background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(223,244,238,0.72))',
      boxShadow: '0 18px 44px rgba(15, 23, 42, 0.10)',
      backdropFilter: 'blur(18px)',
      boxSizing: 'border-box',
    }, props) }, [
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 } }, [
        h('div', { style: { color: SHELL_TEXT.ink, fontSize: '16px', fontWeight: 800, letterSpacing: '-0.02em' } }, title),
        subtitle ? h('div', { style: { color: SHELL_TEXT.muted, fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, subtitle) : null,
      ].filter(Boolean)),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', color: SHELL_TEXT.muted, fontSize: '12px', fontWeight: 700 } }, [
        h('span', { style: { display: 'inline-flex', width: '8px', height: '8px', borderRadius: '999px', background: status === 'online' ? '#10b981' : '#f59e0b', boxShadow: '0 0 0 4px rgba(16,185,129,0.12)' } }),
        h('span', status),
        time ? h('span', { style: { color: SHELL_TEXT.ink } }, time) : null,
        ...children,
      ].filter(Boolean)),
    ]);
  }

  if (node.type === 'Taskbar') {
    const taskbarProps = cleanShellProps(props);
    return h('nav', { ...taskbarProps, style: mergeShellStyle({
      minHeight: '72px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      padding: '12px 18px',
      border: `1px solid ${SHELL_TEXT.line}`,
      borderRadius: '28px',
      background: 'rgba(248, 250, 252, 0.78)',
      boxShadow: '0 22px 60px rgba(15, 23, 42, 0.14)',
      backdropFilter: 'blur(20px)',
      boxSizing: 'border-box',
    }, props) }, children);
  }

  if (node.type === 'NavigationRail') {
    const railProps = cleanShellProps(props);
    return h('aside', { ...railProps, style: mergeShellStyle({
      width: '88px',
      minWidth: '88px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '14px',
      padding: '18px 12px',
      border: `1px solid ${SHELL_TEXT.line}`,
      borderRadius: '32px',
      background: 'rgba(255, 255, 255, 0.7)',
      boxShadow: '0 20px 48px rgba(15, 23, 42, 0.10)',
      backdropFilter: 'blur(18px)',
      boxSizing: 'border-box',
    }, props) }, children);
  }

  if (node.type === 'DesktopGrid') {
    const minColumnWidth = props.minColumnWidth || '176px';
    const variant = props.variant === 'list' ? 'list' : 'grid';
    const gridProps = cleanShellProps(props, ['minColumnWidth', 'variant']);
    if (variant === 'list') {
      return h('section', { ...gridProps, style: mergeShellStyle({
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'stretch',
        width: '100%',
      }, props) }, children);
    }
    return h('section', { ...gridProps, style: mergeShellStyle({
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${minColumnWidth}, 1fr))`,
      gap: '16px',
      alignItems: 'stretch',
      width: '100%',
    }, props) }, children);
  }

  if (node.type === 'AppCard') {
    const title = typeof props.title === 'string' && props.title.trim() ? props.title.trim() : (typeof props.label === 'string' ? props.label : 'App');
    const summary = typeof props.summary === 'string' ? props.summary : '';
    const appOrigin = typeof props.appOrigin === 'string' ? props.appOrigin : '';
    const sourceDE = typeof props.sourceDE === 'string' && props.sourceDE.trim() ? props.sourceDE.trim() : '';
    const sourceText = appOrigin === 'slid_in' ? `From ${sourceDE || 'source unknown'}` : (appOrigin === 'builtin' ? 'Built-in' : '');
    const accent = typeof props.accent === 'string' && props.accent.trim() ? props.accent : '#14b8a6';
    const mark = typeof props.mark === 'string' && props.mark.trim() ? props.mark.trim().slice(0, 2) : title.trim().slice(0, 2).toUpperCase();
    const target = node.bind && node.bind.write;
    const displayMode = props.displayMode === 'list' ? 'list' : 'cards';
    const compact = props.density === 'compact';
    const manageMode = props.manageMode === true;
    const deletable = props.deletable === true;
    const deleteTarget = node.bind && node.bind.delete ? (node.bind.delete.write || node.bind.delete) : null;
    const contextMenuTarget = node.bind && node.bind.contextmenu ? (node.bind.contextmenu.write || node.bind.contextmenu) : deleteTarget;
    let suppressNextClick = false;
    const dispatchDelete = () => {
      if (!deleteTarget) return;
      dispatchEvent(node, deleteTarget, { delete: true, value: { model_id: props.modelId, title } }, host, undefined, ctx);
    };
    const openContextMenu = (event) => {
      if (!deletable || !contextMenuTarget) return;
      openAppContextMenu(event, {
        title,
        dispatchDelete: () => {
          dispatchEvent(node, contextMenuTarget, { delete: true, value: { model_id: props.modelId, title } }, host, undefined, ctx);
        },
      });
    };
    const appCardProps = cleanShellProps(props, ['title', 'label', 'summary', 'accent', 'mark', 'appOrigin', 'sourceDE', 'displayMode', 'density', 'sourcePlacement', 'manageMode', 'deletable']);
    if (target) {
      appCardProps.role = 'button';
      appCardProps.tabindex = 0;
      appCardProps.onClick = (event) => {
        const eventTarget = event && event.currentTarget ? event.currentTarget : null;
        if (suppressNextClick || (eventTarget && eventTarget.__dyAppCardContextMenuFired === true)) {
          suppressNextClick = false;
          if (eventTarget) eventTarget.__dyAppCardContextMenuFired = false;
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
          return;
        }
        dispatchEvent(node, target, { click: true }, host, undefined, ctx);
      };
      appCardProps.onKeydown = (event) => {
        if (!event || (event.key !== 'Enter' && event.key !== ' ')) return;
        if (typeof event.preventDefault === 'function') event.preventDefault();
        dispatchEvent(node, target, { click: true }, host, undefined, ctx);
      };
    }
    if (deletable && contextMenuTarget) {
      appCardProps.onContextmenu = openContextMenu;
      appCardProps.onContextMenu = openContextMenu;
      appCardProps.ref = (el) => {
        if (!el || typeof el.addEventListener !== 'function') return;
        if (typeof el.__dyAppCardContextMenuCleanup === 'function') {
          el.__dyAppCardContextMenuCleanup();
        }
        const nativeContextMenu = (event) => {
          suppressNextClick = true;
          el.__dyAppCardContextMenuFired = true;
          openContextMenu(event);
        };
        el.addEventListener('contextmenu', nativeContextMenu);
        el.__dyAppCardContextMenuCleanup = () => {
          el.removeEventListener('contextmenu', nativeContextMenu);
        };
      };
    }
    const badge = sourceText ? h('div', { style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px 8px',
      borderRadius: '999px',
      color: appOrigin === 'slid_in' ? '#0f766e' : '#475569',
      background: appOrigin === 'slid_in' ? 'rgba(20,184,166,0.12)' : 'rgba(148,163,184,0.16)',
      fontSize: '10px',
      fontWeight: 900,
      letterSpacing: '0.03em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    } }, sourceText) : null;
    const deleteButton = manageMode && deletable && deleteTarget ? h('button', {
      type: 'button',
      title: '删除',
      'aria-label': `删除 ${title}`,
      onClick: (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        dispatchDelete();
      },
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: displayMode === 'list' ? '30px' : '26px',
        height: displayMode === 'list' ? '30px' : '26px',
        border: '1px solid rgba(239,68,68,0.28)',
        borderRadius: '999px',
        color: '#ffffff',
        background: 'linear-gradient(180deg, #fb7185 0%, #ef4444 100%)',
        boxShadow: '0 10px 22px rgba(239,68,68,0.20)',
        fontSize: '20px',
        fontWeight: 900,
        lineHeight: 1,
        cursor: 'pointer',
      },
    }, '−') : null;
    if (displayMode === 'list') {
      return h('article', { ...appCardProps, style: mergeShellStyle({
        minHeight: '72px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto auto',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        border: `1px solid ${SHELL_TEXT.line}`,
        borderRadius: '20px',
        background: 'rgba(255,255,255,0.82)',
        boxShadow: '0 14px 34px rgba(15, 23, 42, 0.08)',
        cursor: target ? 'pointer' : 'default',
        textAlign: 'left',
        boxSizing: 'border-box',
        transition: 'transform 160ms ease, box-shadow 160ms ease',
      }, props) }, [
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 } }, [
          h('div', { style: { color: SHELL_TEXT.ink, fontSize: '16px', fontWeight: 900, lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, title),
          summary ? h('div', { style: { color: SHELL_TEXT.muted, fontSize: '12px', lineHeight: '1.35', overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 } }, summary) : null,
        ].filter(Boolean)),
        badge,
        deleteButton,
        ...children,
      ].filter(Boolean));
    }
    return h('article', { ...appCardProps, style: mergeShellStyle({
      minHeight: compact ? '108px' : '140px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      gap: compact ? '8px' : '12px',
      padding: compact ? '14px' : '18px',
      border: `1px solid ${SHELL_TEXT.line}`,
      borderRadius: compact ? '22px' : '28px',
      position: 'relative',
      background: 'linear-gradient(145deg, rgba(255,255,255,0.88), rgba(241,245,249,0.72))',
      boxShadow: '0 20px 46px rgba(15, 23, 42, 0.10)',
      cursor: target ? 'pointer' : 'default',
      textAlign: 'left',
      boxSizing: 'border-box',
      transition: 'transform 160ms ease, box-shadow 160ms ease',
    }, props) }, [
      badge ? h('div', { style: { position: 'absolute', top: '10px', right: deleteButton ? '44px' : '10px' } }, badge) : null,
      deleteButton ? h('div', { style: { position: 'absolute', top: '10px', right: '10px' } }, deleteButton) : null,
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '7px', minWidth: 0 } }, [
        h('div', { style: { color: SHELL_TEXT.ink, fontSize: compact ? '18px' : '20px', fontWeight: 900, lineHeight: '1.15', paddingRight: deleteButton ? (sourceText ? '118px' : '38px') : (sourceText ? '74px' : 0) } }, title),
        summary ? h('div', { style: { color: SHELL_TEXT.muted, fontSize: '12px', lineHeight: '1.45', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: compact ? 3 : 4, overflow: 'hidden' } }, summary) : null,
      ].filter(Boolean)),
      ...children,
    ]);
  }

  if (node.type === 'WidgetPanel') {
    const title = typeof props.title === 'string' ? props.title : '';
    const panelProps = cleanShellProps(props, ['title']);
    return h('section', { ...panelProps, style: mergeShellStyle({
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '18px',
      border: `1px solid ${SHELL_TEXT.line}`,
      borderRadius: '30px',
      background: 'rgba(255, 255, 255, 0.70)',
      boxShadow: '0 20px 48px rgba(15, 23, 42, 0.10)',
      backdropFilter: 'blur(18px)',
      boxSizing: 'border-box',
    }, props) }, [
      title ? h('div', { style: { color: SHELL_TEXT.ink, fontSize: '15px', fontWeight: 850 } }, title) : null,
      ...children,
    ].filter(Boolean));
  }

  if (node.type === 'QuickSettingsPanel') {
    const title = typeof props.title === 'string' ? props.title : 'Quick Settings';
    const panelProps = cleanShellProps(props, ['title']);
    return h('section', { ...panelProps, style: mergeShellStyle({
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '16px',
      border: `1px solid ${SHELL_TEXT.line}`,
      borderRadius: '28px',
      background: 'linear-gradient(160deg, rgba(15,23,42,0.88), rgba(14,116,144,0.78))',
      color: '#f8fafc',
      boxShadow: '0 26px 70px rgba(15, 23, 42, 0.22)',
      backdropFilter: 'blur(18px)',
      boxSizing: 'border-box',
    }, props) }, [
      h('div', { style: { fontSize: '14px', fontWeight: 850 } }, title),
      ...children,
    ]);
  }

  if (node.type === 'AppWindow') {
    const title = typeof props.title === 'string' ? props.title : '';
    const contentOverflow = typeof props.contentOverflow === 'string' ? props.contentOverflow : 'auto';
    const windowProps = cleanShellProps(props, ['title', 'contentOverflow']);
    return h('section', { ...windowProps, style: mergeShellStyle({
      display: 'flex',
      flexDirection: 'column',
      minHeight: '0',
      border: `1px solid ${SHELL_TEXT.line}`,
      borderRadius: '30px',
      overflow: 'hidden',
      background: '#ffffff',
      boxShadow: '0 28px 70px rgba(15, 23, 42, 0.14)',
    }, props) }, [
      title ? h('div', { style: { minHeight: '48px', display: 'flex', alignItems: 'center', padding: '0 18px', borderBottom: `1px solid ${SHELL_TEXT.line}`, color: SHELL_TEXT.ink, fontWeight: 850 } }, title) : null,
      h('div', { style: { minHeight: 0, flex: 1, overflow: contentOverflow } }, children),
    ].filter(Boolean));
  }

  if (node.type === 'SplitPaneWindow') {
    const splitProps = cleanShellProps(props, ['columns']);
    return h('section', { ...splitProps, style: mergeShellStyle({
      display: 'grid',
      gridTemplateColumns: props.columns || 'minmax(0, 1fr) minmax(240px, 34%)',
      gap: '14px',
      minHeight: '0',
      width: '100%',
    }, props) }, children);
  }

  if (node.type === 'AppSwitcher') {
    const switcherProps = cleanShellProps(props);
    return h('section', { ...switcherProps, style: mergeShellStyle({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: '12px',
      width: '100%',
    }, props) }, children);
  }

  // NEW COMPONENTS: ProgressBar, Divider, Breadcrumb
  // ================================================

  if (node.type === 'ProgressBar') {
    const bind = node.bind && node.bind.read;
    const direct = bind && isPlainObject(bind) && typeof bind.$ref === 'string' ? resolveRefValue(bind.$ref, ctx) : undefined;
    const boundValue = bind ? (direct !== undefined ? direct : getEffectiveLabelValue(snapshot, bind, host, node)) : undefined;

    const percentage = boundValue !== undefined ? Number(boundValue) : props.percentage || 0;
    const label = props.label || '';
    const strokeWidth = props.strokeWidth || 8;
    const variant = props.variant || 'default';

    const variantColorMap = {
      default: '#409EFF', success: '#22C55E', warning: '#F59E0B', error: '#EF4444', info: '#3B82F6',
    };
    const color = props.color || variantColorMap[variant] || variantColorMap.default;
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
  const eventCtx = payload && typeof payload === 'object'
    ? { ...(ctx && typeof ctx === 'object' ? ctx : {}), value: payload.value, payload }
    : ctx;
  if (target && target.bus_event_v2 === true) {
    const snapshot = host.getSnapshot();
    const busInKey = typeof target.bus_in_key === 'string' ? target.bus_in_key.trim() : '';
    const value = target.value_ref !== undefined
      ? resolveRefsDeep(target.value_ref, eventCtx, snapshot, host, node)
      : (payload && Object.prototype.hasOwnProperty.call(payload, 'value') ? payload.value : payload);
    const meta = target.meta_ref !== undefined
      ? resolveRefsDeep(target.meta_ref, eventCtx, snapshot, host, node)
      : (target.meta !== undefined ? resolveRefsDeep(target.meta, eventCtx, snapshot, host, node) : {});
    const envelope = {
      type: 'bus_event_v2',
      bus_in_key: busInKey,
      value,
      meta: {
        op_id: nextEditorOpId(),
        source: 'ui_renderer',
        ...(meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {}),
      },
    };
    const label = buildBusDispatchLabel(envelope);
    host.dispatchAddLabel(label);
    return label;
  }
  if (target && Object.prototype.hasOwnProperty.call(target, 'pin')) {
    const snapshot = host.getSnapshot();
    const out = { pin: target.pin };
    const resolvedTarget = resolveRefForNode(resolveRefsDeep(target.target_ref, eventCtx, snapshot, host, node), node);
    if (resolvedTarget !== undefined) {
      out.target = resolvedTarget;
    } else if (node.cell_ref && Number.isInteger(node.cell_ref.model_id)) {
      out.target = { model_id: node.cell_ref.model_id, p: node.cell_ref.p, r: node.cell_ref.r, c: node.cell_ref.c };
    }
    if (target.value_ref !== undefined) {
      out.value = resolveRefsDeep(target.value_ref, eventCtx, snapshot, host, node);
    } else if (payload && Object.prototype.hasOwnProperty.call(payload, 'value')) {
      out.value = payload.value;
    } else if (payload !== undefined) {
      out.value = payload;
    }
    if (target.meta_ref !== undefined) {
      out.meta = resolveRefsDeep(target.meta_ref, eventCtx, snapshot, host, node);
    } else if (target.meta !== undefined) {
      out.meta = resolveRefsDeep(target.meta, eventCtx, snapshot, host, node);
    }
    const envelope = normalizeEditorPinEvent(out);
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
  if (target && Object.prototype.hasOwnProperty.call(target, 'action')) {
    const snapshot = host.getSnapshot();
    const action = target.action;
    const out = { action };
    if (action !== 'submodel_create') {
      const resolvedTarget = resolveRefForNode(resolveRefsDeep(target.target_ref, eventCtx, snapshot, host, node), node);
      if (resolvedTarget !== undefined) {
        out.target = resolvedTarget;
      } else if (node.cell_ref && Number.isInteger(node.cell_ref.model_id)) {
        out.target = { model_id: node.cell_ref.model_id, p: node.cell_ref.p, r: node.cell_ref.r, c: node.cell_ref.c };
      }
    }

    if (action === 'label_add' || action === 'label_update' || action === 'ui_owner_label_update') {
      if (target.value_ref !== undefined) {
        out.value = resolveRefsDeep(target.value_ref, eventCtx, snapshot, host, node);
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
      out.value = resolveRefsDeep(target.value_ref, eventCtx, snapshot, host, node);
    } else if (target.value_ref !== undefined) {
      out.value = resolveRefsDeep(target.value_ref, eventCtx, snapshot, host, node);
    }

    if (target.meta_ref !== undefined) {
      out.meta = resolveRefsDeep(target.meta_ref, eventCtx, snapshot, host, node);
    } else if (target.meta !== undefined) {
      out.meta = resolveRefsDeep(target.meta, eventCtx, snapshot, host, node);
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
    renderTree(ast, context) {
      const snapshot = host.getSnapshot();
      void context;
      return renderTreeNode(ast, snapshot, registry);
    },
    renderVNode(ast, context) {
      if (!vue || typeof vue.h !== 'function') {
        throw new Error('Vue bridge not provided');
      }
      const snapshot = host.getSnapshot();
      return buildVueNode(ast, snapshot, vue, host, registry, context || null);
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
