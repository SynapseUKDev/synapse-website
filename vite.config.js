import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Same first-party PostHog proxy as the /relay-sx rewrites in vercel.json, so local
// runs behave like production and ad blockers don't drop usage events (spec 002).
// Order matters: the /static rule must come before the general one.
const posthogProxy = {
  '/relay-sx/static': {
    target: 'https://eu-assets.i.posthog.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/relay-sx/, ''),
  },
  '/relay-sx': {
    target: 'https://eu.i.posthog.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/relay-sx/, ''),
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: posthogProxy,
  },
  preview: {
    host: true,
    proxy: posthogProxy,
  },
})
