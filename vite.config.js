import { defineConfig } from 'vite';
import { resolve } from 'path';

// GitHub Pages base: https://<user>.github.io/phd-robotics-atlas/
export default defineConfig({
  base: '/phd-robotics-atlas/',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
