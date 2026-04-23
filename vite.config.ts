import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // For GitHub Pages deployment under /<repo>/
  base: process.env.GITHUB_PAGES === 'true' ? '/Medical-card/' : '/',
})
