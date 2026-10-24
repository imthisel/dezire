import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Always the same address: each address (localhost:5173, localhost:5174…) keeps its own sign-in,
  // so a different port would mean signing in again. If 5173 is taken, it says so instead of moving.
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
})
