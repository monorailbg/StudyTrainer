import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Forward /api/* from the Vite dev server to the Express proxy.
    // This works in both local dev and GitHub Codespaces because the
    // forwarding happens server-side (container → container) — the
    // browser only ever talks to the Vite port.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
