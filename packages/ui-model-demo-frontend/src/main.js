import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import { createDemoStore } from './demo_modeltable.js';
import { createDemoRoot } from './demo_app.js';

const store = createDemoStore();
const app = createApp(createDemoRoot(store));
app.use(ElementPlus);
app.mount('#app');
