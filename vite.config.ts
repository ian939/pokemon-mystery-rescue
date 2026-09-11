import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  base: mode === 'github' ? '/pokemon-mystery-rescue/' : '/',
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith('.css') ? 'assets/app.css' : 'assets/[name][extname]',
      },
    },
  },
}));
