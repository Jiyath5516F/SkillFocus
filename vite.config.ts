import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// MIRA_BASE_PATH=/Mira builds the client to be served under https://<host>/Mira/
const base = process.env.MIRA_BASE_PATH ? `${process.env.MIRA_BASE_PATH.replace(/\/+$/, '')}/` : '/';

export default defineConfig({
  root: 'client',
  base,
  plugins: [react(), tailwindcss()],
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8090' } },
});
