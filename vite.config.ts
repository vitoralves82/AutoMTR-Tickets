// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.')
    }
  },
  build: {
    rollupOptions: {
      external: [
        // ignora módulos nativos que só existem em Node
        'fsevents',
        'assert',
        'node:url',
        'node:path',
        'node:module',
        'node:process',
        'node:perf_hooks',
        'node:fs/promises',
        'path'
      ]
    }
  },
  optimizeDeps: {
    exclude: ['fsevents']
  }
});
