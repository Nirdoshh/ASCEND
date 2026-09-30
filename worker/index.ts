/**
 * ASCEND Worker — Phase 1.
 *
 * Responsibilities today:
 *   1. Serve the compiled React app as static assets.
 *   2. Answer /api/health so we can verify the Worker runs at all.
 *
 * Responsibilities later (Phase 11+):
 *   3. Serve a small JSON API backed by D1 at /api/*.
 *
 * Free-plan posture:
 *   - No CPU-heavy work, no crypto, no image processing, no libraries.
 *   - Static assets are served by the assets binding, not by us, so
 *     requests mostly never reach this function.
 *   - We add no per-request overhead to asset responses other than
 *     security headers, which are set on the way out.
 *
 * Types note:
 *   We declare the tiny bit of the Workers contract we actually use
 *   instead of installing @cloudflare/workers-types yet. Phase 11 (D1)
 *   is the point where those types become necessary; adding them then
 *   is a small, mechanical change.
 */

export interface WorkerEnv {
  /** The assets binding configured as `ASSETS` in wrangler.jsonc. */
  readonly ASSETS: AssetFetcher
}

interface AssetFetcher {
  fetch(request: Request): Promise<Response>
}

/** Minimal shape of the Workers execution context (unused for now). */
interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void
}

interface WorkerEntrypoint {
  fetch(request: Request, env: WorkerEnv, ctx: WorkerContext): Promise<Response>
}

/** Routes the Worker handles itself. Everything else is a static asset. */
const WORKER_ROUTES = new Set(['/api/health'])

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (WORKER_ROUTES.has(pathname)) {
      return withSecurityHeaders(
        Response.json(
          { status: 'ok', service: 'ascend', phase: 1 },
          { headers: { 'cache-control': 'no-store' } },
        ),
      )
    }

    const assetResponse = await env.ASSETS.fetch(request)
    return withSecurityHeaders(assetResponse)
  },
} satisfies WorkerEntrypoint

/**
 * Baseline security headers.
 *
 * Deliberately conservative for Phase 1: every header here is safe for a
 * static SPA and cannot break the app. A full Content-Security-Policy is
 * deferred to Phase 13 (hardening), where we can verify it against real
 * routes with end-to-end tests instead of guessing.
 */
function withSecurityHeaders(response: Response): Response {
  const next = new Response(response.body, response)

  next.headers.set('x-content-type-options', 'nosniff')
  next.headers.set('referrer-policy', 'strict-origin-when-cross-origin')
  next.headers.set('x-frame-options', 'DENY')

  return next
}
