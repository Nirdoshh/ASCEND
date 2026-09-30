import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

/**
 * ASCEND build configuration.
 *
 * Architecture decision (see docs/adr/0001-worker-static-assets.md):
 * we deploy to a single Cloudflare Worker that also serves the static
 * assets, instead of Cloudflare Pages.
 *
 * Why this matters for ASCEND:
 *   - V1 is local-first, so the Worker does almost nothing.
 *   - But the /api/* -> Worker -> D1 path can be added later without
 *     moving the frontend or changing how it is deployed.
 *   - One project, one deploy command, one place where API limits apply.
 *
 * The @cloudflare/vite-plugin reads wrangler.jsonc, so worker settings
 * live in one file rather than being duplicated here.
 */
export default defineConfig({
  plugins: [react(), cloudflare()],
  build: {
    // Small, long-lived build cache; ASCEND is a small app today and
    // we want the cheapest possible path to a fast cold start.
    target: 'es2022',
    sourcemap: true,
  },
})
