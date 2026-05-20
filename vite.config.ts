import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: '/clickexp/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    allowedHosts: ['dev.clasp.gu.se'],
    host: '0.0.0.0',
    port: 5062,
  },
  build: {
    outDir: 'dist/clickexp',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
        replay: fileURLToPath(new URL('./replay.html', import.meta.url)),
      },
    },
  },
});
