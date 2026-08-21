import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const BACKEND_URL = process.env.VITE_API_URL || 'http://localhost:3001';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      // Proxy : toutes les requêtes /api sont transmises au backend Express + PostgreSQL
      proxy: {
        '/api': {
          target: BACKEND_URL,
          changeOrigin: true,
        },
      },
    },
  };
});
