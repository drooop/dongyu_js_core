'use strict';

// ---------------------------------------------------------------------------
// CircularBuffer data model
// ---------------------------------------------------------------------------
// PICtest behaviour oracle: vendor/PICtest/yhl/model_Data_base/circular_buffer.py
//
// Metadata at Cell(0,0,0): size_now, start_pos, end_pos, size_max
// Data rows at Cell(0, 1..size_max, 0) — each row holds a single json label
// Wrapping: end_pos = (end_pos % size_max) + 1
// Overflow: when end_pos collides with start_pos, advance start_pos and
//           overwrite the oldest cell.
// ---------------------------------------------------------------------------

function circularBufferAddData(runtime, model, label) {
  const meta = (k) => runtime.getLabelValue(model, 0, 0, 0, k);
  const setMeta = (k, t, v) => runtime.addLabel(model, 0, 0, 0, { k, t, v });

  let sizeNow = meta('size_now') || 0;
  const sizeMax = meta('size_max') || 2000;

  if (sizeNow === 0) {
    runtime.addLabel(model, 0, 1, 0, label);
    setMeta('start_pos', 'int', 1);
    setMeta('end_pos', 'int', 1);
    setMeta('size_now', 'int', 1);
    return;
  }

  let startPos = meta('start_pos') || 1;
  let endPos = meta('end_pos') || 1;

  endPos = (endPos % sizeMax) + 1;
  setMeta('end_pos', 'int', endPos);

  if (endPos === startPos) {
    startPos = (startPos % sizeMax) + 1;
    runtime.removeCell(model, 0, endPos, 0);
    setMeta('start_pos', 'int', startPos);
  } else {
    setMeta('size_now', 'int', sizeNow + 1);
  }

  runtime.addLabel(model, 0, endPos, 0, label);
}

function circularBufferGetAllData(runtime, model) {
  const meta = (k) => runtime.getLabelValue(model, 0, 0, 0, k);
  const sizeNow = meta('size_now') || 0;
  if (sizeNow === 0) return [];

  const startPos = meta('start_pos') || 1;
  const endPos = meta('end_pos') || 1;
  const sizeMax = meta('size_max') || 2000;

  const result = [];
  let pos = startPos;
  for (let i = 0; i < sizeNow; i++) {
    const cell = model.getCell(0, pos, 0);
    for (const lv of cell.labels.values()) {
      result.push({ p: 0, r: pos, c: 0, k: lv.k, t: lv.t, v: lv.v });
    }
    pos = (pos % sizeMax) + 1;
  }
  return result;
}

function circularBufferGetDataSize(runtime, model) {
  return runtime.getLabelValue(model, 0, 0, 0, 'size_now') || 0;
}

function circularBufferClear(runtime, model) {
  runtime.addLabel(model, 0, 0, 0, { k: 'size_now', t: 'int', v: 0 });
  runtime.addLabel(model, 0, 0, 0, { k: 'start_pos', t: 'int', v: 0 });
  runtime.addLabel(model, 0, 0, 0, { k: 'end_pos', t: 'int', v: 0 });
}

// ---------------------------------------------------------------------------
// Data model type registry
// ---------------------------------------------------------------------------

const DATA_TYPE_REGISTRY = {
  CircularBuffer: initCircularBuffer,
};

function initCircularBuffer(runtime, model) {
  const meta = (k) => runtime.getLabelValue(model, 0, 0, 0, k);
  const setMeta = (k, t, v) => runtime.addLabel(model, 0, 0, 0, { k, t, v });

  if (meta('size_now') === undefined) setMeta('size_now', 'int', 0);
  if (meta('start_pos') === undefined) setMeta('start_pos', 'int', 0);
  if (meta('end_pos') === undefined) setMeta('end_pos', 'int', 0);
  if (meta('size_max') === undefined) setMeta('size_max', 'int', 2000);

  runtime.registerFunction(model, 'add_data', (ctx) => {
    const payload = ctx.label ? ctx.label.v : null;
    if (!payload) return;
    const dataLabel = typeof payload === 'object' && payload.k && payload.t
      ? payload
      : { k: 'data', t: 'json', v: payload };
    circularBufferAddData(ctx.runtime, ctx.model, dataLabel);
  });

  runtime.registerFunction(model, 'get_all_data', (ctx) => {
    return circularBufferGetAllData(ctx.runtime, ctx.model);
  });

  runtime.registerFunction(model, 'get_data_size', (ctx) => {
    return circularBufferGetDataSize(ctx.runtime, ctx.model);
  });

  runtime.registerFunction(model, 'clear_data', (ctx) => {
    circularBufferClear(ctx.runtime, ctx.model);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function initDataModel(runtime, model) {
  const dataType = runtime.getLabelValue(model, 0, 0, 0, 'data_type');
  if (!dataType || typeof dataType !== 'string') return false;
  const init = DATA_TYPE_REGISTRY[dataType];
  if (!init) return false;
  init(runtime, model);
  return true;
}

module.exports = { initDataModel, DATA_TYPE_REGISTRY, circularBufferAddData };
