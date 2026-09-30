# Security headers policy

Two places set headers, for two different reasons. Change both together.

| Surface | Set by | Why not the other |
|---|---|---|
| `/api/*` (Worker function) | `worker/index.ts` | Static assets never reach the Worker |
| Static assets | `public/_headers` | The Worker never runs for asset requests |

`wrangler.jsonc` sets `run_worker_first: ["/api/*"]`. That is deliberate: routing
every asset through the Worker would spend Worker invocations and CPU on
requests that serve a static file, which is exactly the kind of waste the
Cloudflare Free plan should not carry. We pay that cost only where the Worker
actually does work.

## Currently shipped

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: geolocation=(), camera=(), microphone=(), interest-cohort=()`
- `Cache-Control`: immutable for hashed assets, `no-cache` for the HTML shell

## Deliberately not shipped yet: Content-Security-Policy

The policy we intend to ship in Phase 13:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
connect-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none'
```

Why it is not in Phase 1: a wrong Content-Security-Policy breaks the app
silently — no error, no build failure, just a blank page in production. Phase 1
has no end-to-end tests and no browser session available to verify against, so
shipping it now would mean shipping an unverified security control. That is a
worse position than shipping none.

`'unsafe-inline'` is required only for `style-src` because inline `style`
attributes carry dynamic widths (the progress bar). It is not needed for
`script-src`: ASCEND has no inline scripts, including the theme bootstrap.

When Phase 13 lands it, add it to `public/_headers`, then verify with Playwright
that a full reload, all four routes, a theme switch and a production build all
still render. If it holds, tighten `style-src` by moving the progress bar width
to a CSS custom property set via a stylesheet rule instead of an attribute.
