import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  optimizeDeps: {
    include: ['pdfjs-dist']
  },
  define: {
    global: 'globalThis',
  },
  server: {
    host: true,
    port: 3000
  }
});