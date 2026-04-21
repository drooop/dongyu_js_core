import { createApp, h } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'katex/dist/katex.min.css';
import './failsafe.css';
import { createDemoStore } from './demo_modeltable.js';
import { createRemoteStore } from './remote_store.js';
import { createAppShell } from './demo_app.js';
import { createGalleryStore } from './gallery_store.js';
import ThreeSceneHost from './components/ThreeSceneHost.js';

const qs = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const server = qs.get('server') || (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:9000');
const defaultMode = typeof window !== 'undefined' && window.location && window.location.port === '5173' ? 'local' : 'remote';
const mode = qs.get('mode') || defaultMode;
const persistLocal = qs.get('persist') !== '0';

function registerGlobalComponents(app) {
  app.component('ThreeSceneHost', ThreeSceneHost);
  return app;
}

if (mode === 'local') {
  // Local mode: no authentication
  const store = createDemoStore({ persist: persistLocal, storageKey: 'dy_modeltable_local_v1' });
  const galleryStore = createGalleryStore({ sourceStore: store });

  if (store && typeof store.consumeOnce === 'function') {
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
      const lastOp = labels && labels.bus_event_last_op_id ? labels.bus_event_last_op_id.v : '';
      const err = labels && labels.bus_event_error ? labels.bus_event_error.v : null;
      console.log('[dy mailbox]', { bus_event_last_op_id: lastOp, bus_event_error: err });
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

  const app = registerGlobalComponents(createApp(createAppShell({ mainStore: store, galleryStore })));
  app.use(ElementPlus);
  app.mount('#app');
} else {
  // Remote mode: direct access (no auth gate)
  const store = createRemoteStore({ baseUrl: server });
  const galleryStore = createGalleryStore({ sourceStore: store });

  if (typeof window !== 'undefined') {
    window.__DY_STORE = store;
    window.__DY_GALLERY_STORE = galleryStore;
    window.dyPrintMailbox = () => {
      const snap = store && store.snapshot ? store.snapshot : null;
      const model = snap && snap.models ? (snap.models[-1] || snap.models['-1']) : null;
      const cell = model && model.cells ? model.cells['0,0,1'] : null;
      const labels = cell && cell.labels ? cell.labels : null;
      const lastOp = labels && labels.bus_event_last_op_id ? labels.bus_event_last_op_id.v : '';
      const err = labels && labels.bus_event_error ? labels.bus_event_error.v : null;
      console.log('[dy mailbox]', { bus_event_last_op_id: lastOp, bus_event_error: err });
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

  const app = registerGlobalComponents(createApp(createAppShell({ mainStore: store, galleryStore })));
  app.use(ElementPlus);
  app.mount('#app');
}
