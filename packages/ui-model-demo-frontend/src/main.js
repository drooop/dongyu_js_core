import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'katex/dist/katex.min.css';
import './failsafe.css';
import { createDemoStore } from './demo_modeltable.js';
import { createRemoteStore } from './remote_store.js';
import { createAppShell } from './demo_app.js';
import { createGalleryStore } from './gallery_store.js';

const qs = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const server = qs.get('server') || (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:9000');
const defaultMode = typeof window !== 'undefined' && window.location && window.location.port === '5173' ? 'local' : 'remote';
const mode = qs.get('mode') || defaultMode;
const persistLocal = qs.get('persist') !== '0';
const store = mode === 'remote'
  ? createRemoteStore({ baseUrl: server })
  : createDemoStore({ persist: persistLocal, storageKey: 'dy_modeltable_local_v1' });
const galleryStore = mode === 'local'
  ? createGalleryStore({ runtime: store.runtime, snapshot: store.snapshot, refreshSnapshot: store.refreshSnapshot })
  : createGalleryStore();

// In local mode, gallery models live in the same runtime; rebuild editor UI AST once.
if (mode === 'local' && store && typeof store.consumeOnce === 'function') {
  store.consumeOnce();
}

if (typeof window !== 'undefined') {
  window.__DY_STORE = store;
  window.__DY_GALLERY_STORE = galleryStore;
  window.dyPrintMailbox = () => {
    const snap = store && store.snapshot ? store.snapshot : null;
    const model = snap && snap.models ? (snap.models[-1] || snap.models['-1']) : null;
    const cell = model && model.cells ? model.cells['0,0,1'] : null;
    const labels = cell && cell.labels ? cell.labels : null;
    const lastOp = labels && labels.ui_event_last_op_id ? labels.ui_event_last_op_id.v : '';
    const err = labels && labels.ui_event_error ? labels.ui_event_error.v : null;
    console.log('[dy mailbox]', { ui_event_last_op_id: lastOp, ui_event_error: err });
  };
  window.dyPrintSnapshot = () => {
    const snap = store && store.snapshot ? store.snapshot : null;
    try {
      console.log('[dy snapshot]', JSON.parse(JSON.stringify(snap)));
    } catch (_) {
      console.log('[dy snapshot]', snap);
    }
  };
  console.info('[dy] debug helpers: window.dyPrintMailbox(), window.dyPrintSnapshot(), window.__DY_STORE, window.__DY_GALLERY_STORE');
}
const app = createApp(createAppShell({ mainStore: store, galleryStore }));
app.use(ElementPlus);
app.mount('#app');
