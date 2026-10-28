import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load .env files (env vars with VITE_ prefix become import.meta.env.VITE_*)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    root: 'src/renderer',
    base: './',
    build: {
      outDir: '../../dist/renderer',
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, 'src/renderer/index.html'),
      },
    },
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@lib': path.resolve(__dirname, 'src/lib'),
      },
    },
    define: {
      // Expose env vars to the renderer bundle
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL ?? ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY ?? ''),
      // API base URL for HTTP calls (empty = relative /api, or set to full URL)
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL ?? ''),
      // Expose API base as a global for the API client
      'window.__API_BASE__': JSON.stringify(env.VITE_API_BASE_URL ?? ''),
    },
    server: {
      port: 5173,
      strictPort: true,
      host: '0.0.0.0',
      // Proxy API requests to the Express server in development
      proxy: {
        '/api': {
          target: env.VITE_API_URL ?? 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target: env.VITE_API_URL ?? 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
});

