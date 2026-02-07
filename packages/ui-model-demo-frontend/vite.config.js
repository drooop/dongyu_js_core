import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@ui-renderer': path.resolve(__dirname, '../ui-renderer/src'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
    proxy: {
      '/auth': 'http://127.0.0.1:9000',
      '/snapshot': 'http://127.0.0.1:9000',
      '/stream': 'http://127.0.0.1:9000',
      '/ui_event': 'http://127.0.0.1:9000',
    },
  },
});
