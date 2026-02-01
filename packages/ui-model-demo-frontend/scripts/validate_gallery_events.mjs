import { createGalleryStore } from '../src/gallery_store.js';
import { GALLERY_MAILBOX_MODEL_ID, GALLERY_STATE_MODEL_ID } from '../src/model_ids.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function mailboxEnvelope({ event_id, action, op_id, target, value }) {
  const payload = { action, meta: { op_id } };
  if (target !== undefined) payload.target = target;
  if (value !== undefined) payload.value = value;
  return {
    event_id,
    type: action,
    payload,
    source: 'ui_renderer',
    ts: 0,
  };
}

function getLabelValue(runtime, ref) {
  const model = runtime.getModel(ref.model_id);
  assert(model, 'missing_model');
  const cell = runtime.getCell(model, ref.p, ref.r, ref.c);
  const label = cell.labels.get(ref.k);
  return label ? label.v : undefined;
}

function hasLabel(runtime, ref) {
  const model = runtime.getModel(ref.model_id);
  if (!model) return false;
  const cell = runtime.getCell(model, ref.p, ref.r, ref.c);
  return cell.labels.has(ref.k);
}

function getMailboxValue(store) {
  const model = store.runtime.getModel(GALLERY_MAILBOX_MODEL_ID);
  const cell = store.runtime.getCell(model, 0, 0, 1);
  const label = cell.labels.get('ui_event');
  return label ? label.v : undefined;
}

function sendMailbox(store, envelope) {
  store.dispatchAddLabel({ p: 0, r: 0, c: 1, k: 'ui_event', t: 'event', v: envelope });
}

try {
  const store = createGalleryStore();

  // 1) Checkbox v-model update -> label_update applied.
  {
    const event_id = 1;
    const op_id = 'op_1';
    const env = mailboxEnvelope({
      event_id,
      action: 'label_update',
      op_id,
      target: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 1, c: 0, k: 'checkbox_demo' },
      value: { t: 'bool', v: true },
    });
    sendMailbox(store, env);
    store.consumeOnce();
    assert(getMailboxValue(store) === null, 'mailbox_not_cleared_after_consume');
    assert(getLabelValue(store.runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 1, c: 0, k: 'checkbox_demo' }) === true, 'checkbox_demo_not_updated');
  }

  // 2) Slider v-model update -> label_update applied.
  {
    const event_id = 2;
    const op_id = 'op_2';
    const env = mailboxEnvelope({
      event_id,
      action: 'label_update',
      op_id,
      target: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 3, c: 0, k: 'slider_demo' },
      value: { t: 'int', v: 42 },
    });
    sendMailbox(store, env);
    store.consumeOnce();
    assert(getLabelValue(store.runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 3, c: 0, k: 'slider_demo' }) === 42, 'slider_demo_not_updated');
  }

  // 3) bind.change-style target is just another label_update: ensure it is observable.
  {
    const event_id = 3;
    const op_id = 'op_3';
    const env = mailboxEnvelope({
      event_id,
      action: 'label_update',
      op_id,
      target: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 1, c: 1, k: 'checkbox_change' },
      value: { t: 'bool', v: true },
    });
    sendMailbox(store, env);
    store.consumeOnce();
    assert(getLabelValue(store.runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 1, c: 1, k: 'checkbox_change' }) === true, 'checkbox_change_not_written');
  }

  // 4) Nav label is consumed and cleared (works even without window).
  {
    const event_id = 4;
    const op_id = 'op_4';
    const env = mailboxEnvelope({
      event_id,
      action: 'label_update',
      op_id,
      target: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'nav_to' },
      value: { t: 'str', v: '#/' },
    });
    sendMailbox(store, env);
    store.consumeOnce();
    assert(getLabelValue(store.runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'nav_to' }) === undefined, 'nav_to_not_cleared');
  }

  // 5) DatePicker v-model update -> label_update applied.
  {
    const event_id = 5;
    const op_id = 'op_5';
    const env = mailboxEnvelope({
      event_id,
      action: 'label_update',
      op_id,
      target: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 4, c: 0, k: 'wave_b_datepicker' },
      value: { t: 'str', v: '2024-01-15' },
    });
    sendMailbox(store, env);
    store.consumeOnce();
    assert(getLabelValue(store.runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 4, c: 0, k: 'wave_b_datepicker' }) === '2024-01-15', 'wave_b_datepicker_not_updated');
  }

  // 6) TimePicker v-model update -> label_update applied.
  {
    const event_id = 6;
    const op_id = 'op_6';
    const env = mailboxEnvelope({
      event_id,
      action: 'label_update',
      op_id,
      target: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 5, c: 0, k: 'wave_b_timepicker' },
      value: { t: 'str', v: '14:30:00' },
    });
    sendMailbox(store, env);
    store.consumeOnce();
    assert(getLabelValue(store.runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 5, c: 0, k: 'wave_b_timepicker' }) === '14:30:00', 'wave_b_timepicker_not_updated');
  }

  // 7) Tabs active tab change -> label_update applied.
  {
    const event_id = 7;
    const op_id = 'op_7';
    const env = mailboxEnvelope({
      event_id,
      action: 'label_update',
      op_id,
      target: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 6, c: 0, k: 'wave_b_tabs' },
      value: { t: 'str', v: 'settings' },
    });
    sendMailbox(store, env);
    store.consumeOnce();
    assert(getLabelValue(store.runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 6, c: 0, k: 'wave_b_tabs' }) === 'settings', 'wave_b_tabs_not_updated');
  }

  // 8) Dialog visibility toggle -> label_update applied.
  {
    const event_id = 8;
    const op_id = 'op_8';
    const env = mailboxEnvelope({
      event_id,
      action: 'label_update',
      op_id,
      target: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 7, c: 0, k: 'dialog_open' },
      value: { t: 'bool', v: true },
    });
    sendMailbox(store, env);
    store.consumeOnce();
    assert(getLabelValue(store.runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 7, c: 0, k: 'dialog_open' }) === true, 'dialog_open_not_updated');
  }

  // 9) Pagination currentPage change -> label_update applied.
  {
    const event_id = 9;
    const op_id = 'op_9';
    const env = mailboxEnvelope({
      event_id,
      action: 'label_update',
      op_id,
      target: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 8, c: 0, k: 'wave_b_pagination_currentPage' },
      value: { t: 'int', v: 3 },
    });
    sendMailbox(store, env);
    store.consumeOnce();
    assert(getLabelValue(store.runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 8, c: 0, k: 'wave_b_pagination_currentPage' }) === 3, 'wave_b_pagination_currentPage_not_updated');
  }

  // 10) Pagination pageSize change -> label_update applied.
  {
    const event_id = 10;
    const op_id = 'op_10';
    const env = mailboxEnvelope({
      event_id,
      action: 'label_update',
      op_id,
      target: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 8, c: 1, k: 'wave_b_pagination_pageSize' },
      value: { t: 'int', v: 50 },
    });
    sendMailbox(store, env);
    store.consumeOnce();
    assert(getLabelValue(store.runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 8, c: 1, k: 'wave_b_pagination_pageSize' }) === 50, 'wave_b_pagination_pageSize_not_updated');
  }

  // 11) submodel_create creates model 2001 and gallery store seeds fragment.
  {
    const event_id = 11;
    const op_id = 'op_11';
    const env = mailboxEnvelope({
      event_id,
      action: 'submodel_create',
      op_id,
      value: { t: 'json', v: { id: 2001, name: 'gallery_submodel_2001', type: 'ui' } },
    });
    sendMailbox(store, env);
    store.consumeOnce();
    assert(store.runtime.getModel(2001), 'submodel_2001_not_created');
    assert(hasLabel(store.runtime, { model_id: 2001, p: 0, r: 0, c: 0, k: 'ui_fragment_v0' }), 'submodel_fragment_not_seeded');
  }

  console.log('validate_gallery_events: PASS');
  process.exit(0);
} catch (err) {
  console.error('validate_gallery_events: FAIL');
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}
