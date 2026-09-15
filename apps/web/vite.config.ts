import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

/**
 * Local development: `pnpm dev` runs this site on :8080 and the API on :3001.
 * Proxying /api makes the API same-origin — exactly like CloudFront's /api/*
 * behavior in AWS — and the proxy adds the origin header CloudFront would add.
 * The default secret matches the API's local default (apps/api/src/main.ts).
 */
const LOCAL_API_URL = process.env.LOCAL_API_URL ?? 'http://localhost:3001';
const LOCAL_ORIGIN_SECRET = process.env.API_ORIGIN_SECRET ?? 'local-dev-origin-secret';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 8080,
    strictPort: true,
    proxy: {
      '/api': {
        target: LOCAL_API_URL,
        changeOrigin: true,
        headers: { 'x-origin-verify': LOCAL_ORIGIN_SECRET },
      },
    },
  },
  preview: {
    port: 8080,
  },
});
