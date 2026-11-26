// client/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // Listen on 0.0.0.0 for Docker container support
  },
  preview: {
    port: 5173,
    host: true,
  },
});
