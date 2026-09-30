# ADR 0001 — Deploy to a Cloudflare Worker with Static Assets, not Pages

- **Status:** Accepted (Phase 1)
- **Date:** 2026-10-01

## Context

ASCEND is local-first in V1. There is no server-side data, no auth, and no API.
The deployment target still matters now, because choosing the wrong one forces a
migration at exactly the moment the product starts being validated — which is
the worst possible time to change infrastructure.

Two Cloudflare options were considered:

1. **Pages** — static hosting with a Pages Functions runtime.
2. **Workers + Static Assets** — a single Worker that also serves the built
   assets, with the assets binding handling delivery.

## Decision

Use Workers + Static Assets via `@cloudflare/vite-plugin`, with one `wrangler.jsonc`
describing both the Worker and the asset directory.

```
React + TypeScript + Vite
        ↓
Cloudflare Vite integration
        ↓
Cloudflare Worker  +  Static Assets
```

Later, without changing deployment:

```
React → /api/* → Cloudflare Worker → D1
```

## Rationale

**One deployable, one limit surface.** The Free plan we are targeting is bounded
on Workers invocations, CPU time and D1 reads/writes. Those limits apply to the
API whether it runs on Pages Functions or a standalone Worker, but keeping the
frontend and API in a single project means one place to look at consumption and
one command to ship. The stated goal was "one Cloudflare architecture that can
naturally evolve from frontend-only to full-stack".

**No future re-host.** If we had started on Pages, adding a meaningful Worker API
would mean either a second project with its own deploy pipeline, or migrating the
frontend's hosting after real users have the URL. Both are avoidable now at a cost
of roughly nothing.

**The Worker is nearly free when it does nothing.** The assets binding serves
files without invoking the Worker, so a V1 user loading the app does not spend a
Worker invocation on the HTML request. The Worker only runs for `/api/*`. This is
what keeps the free-plan constraint comfortable.

## Consequences

**Good**

- `/api/*` routes can be added in Phase 11 with no change to how the app is built or deployed.
- One `wrangler.jsonc` is the single source of truth for Worker settings.
- Free-plan cost stays proportional to actual API usage, not page views.

**Bad / accepted costs**

- The Vite Cloudflare plugin adds a build dependency we would not otherwise need.
- `wrangler` is required to run the dev server, not just to deploy. That is a
  heavier local setup than plain Vite.
- The compatibility date must be one the installed `workerd` supports. A date in
  the future fails the dev server with `ERR_FUTURE_COMPATIBILITY_DATE`. This bit
  us in Phase 1 and is documented in `wrangler.jsonc`.

## Alternatives rejected

- **Cloudflare Pages now, Workers later.** Rejected: guarantees a hosting migration.
- **Plain Vite with no Cloudflare plugin.** Rejected: works today, but makes Phase 10
  a rewrite of the build and deployment rather than a config change.
