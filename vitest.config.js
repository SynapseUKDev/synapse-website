import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: [
      'tests/admin-questions/**/*.{test,spec}.{js,jsx}',
      'tests/usage-analytics/**/*.{test,spec}.{js,jsx}',
      'tests/flashcards-v2/**/*.{test,spec}.{js,jsx}',
    ],
  },
})
