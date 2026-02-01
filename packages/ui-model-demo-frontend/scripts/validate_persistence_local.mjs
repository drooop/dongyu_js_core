import { ModelTableRuntime } from '../../worker-base/src/index.mjs';
import { createLocalStoragePersister, createMemoryStorage } from '../src/local_persistence.js';
import { EDITOR_MAILBOX_MODEL_ID, GALLERY_MAILBOX_MODEL_ID } from '../src/model_ids.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function getLabel(runtime, ref) {
  const model = runtime.getModel(ref.model_id);
  if (!model) return null;
  const cell = runtime.getCell(model, ref.p, ref.r, ref.c);
  return cell.labels.get(ref.k) || null;
}

try {
  const storage = createMemoryStorage();
  const persister = createLocalStoragePersister({
    storageKey: 'test_mt_local_v1',
    storage,
    ignoreModelIds: new Set([EDITOR_MAILBOX_MODEL_ID, GALLERY_MAILBOX_MODEL_ID]),
  });

  // First runtime writes.
  {
    const rt = new ModelTableRuntime();
    rt.setPersistence(persister);
    persister.loadIntoRuntime(rt);

    rt.createModel({ id: 1, name: 'M1', type: 'main' });
    const m1 = rt.getModel(1);
    rt.addLabel(m1, 0, 0, 0, { k: 'title', t: 'str', v: 'persist_me' });

    rt.createModel({ id: EDITOR_MAILBOX_MODEL_ID, name: 'mailbox', type: 'ui' });
    const mbox = rt.getModel(EDITOR_MAILBOX_MODEL_ID);
    rt.addLabel(mbox, 0, 0, 1, { k: 'ui_event', t: 'event', v: { hello: 1 } });
  }

  // Second runtime restores.
  {
    const rt2 = new ModelTableRuntime();
    rt2.setPersistence(persister);
    const loaded = persister.loadIntoRuntime(rt2);
    assert(loaded.ok === true, 'persistence_load_failed');

    assert(rt2.getModel(1), 'model_1_missing_after_restore');
    const title = getLabel(rt2, { model_id: 1, p: 0, r: 0, c: 0, k: 'title' });
    assert(title && title.v === 'persist_me', 'label_not_restored');

    // Mailbox labels should be ignored.
    assert(!rt2.getModel(EDITOR_MAILBOX_MODEL_ID) || !getLabel(rt2, { model_id: EDITOR_MAILBOX_MODEL_ID, p: 0, r: 0, c: 1, k: 'ui_event' }), 'mailbox_label_should_not_restore');
  }

  console.log('validate_persistence_local: PASS');
  process.exit(0);
} catch (err) {
  console.error('validate_persistence_local: FAIL');
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}
