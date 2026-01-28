import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import { createDemoStore } from './demo_modeltable.js';
import { createRemoteStore } from './remote_store.js';
import { createDemoRoot } from './demo_app.js';

const qs = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const server = qs.get('server') || (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:9000');
const defaultMode = typeof window !== 'undefined' && window.location && window.location.port === '5173' ? 'local' : 'remote';
const mode = qs.get('mode') || defaultMode;
const store = mode === 'remote' ? createRemoteStore({ baseUrl: server }) : createDemoStore();
const app = createApp(createDemoRoot(store));
app.use(ElementPlus);
app.mount('#app');
