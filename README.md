# ASCEND

**Turn the person you want to become into small actions you can complete every day.**

A personal growth operating system. The goal is not more time in the app — it is
more meaningful action in real life.

---

## Status

Phase 3E complete: onboarding creates a Journey; Today supports a DailyPlan,
Today's Win, Daily Steps and explicit Step completion. The UI Foundation is in
place. Progress now derives recorded actions, seven-day activity and Journey
calendar time from existing records, without persisting counters or claiming
personal improvement. See [Progress foundation](docs/progress-foundation.md) for
exact definitions, validation and remaining limitations.

Growth Points / Phase 3F have not started. The Journey and You screens still have
their existing placeholders; Daily Review and Recovery are not implemented.

| Phase | Scope | State |
|---|---|---|
| 0 | Architecture and product proposal | Done |
| 1 | Shell, design system, responsive, a11y base, Cloudflare plumbing | **Done** |
| 2A | Onboarding: welcome + Growth Areas | **Done** |
| 2B | Onboarding: Goal + WHY | **Done** |
| 2C | Onboarding: duration, milestones, daily effort | **Done** |
| 2D | Onboarding: summary + Journey creation | **Done** |
| 3A–3D | DailyPlan, Today's Win, Daily Steps, completion | **Done** |
| UI Foundation | Shared visual language and accessibility | **Done** |
| 3E | Derived Progress foundation | **Done** |
| 3F | Growth Points | Not started |

## Requirements

- Node.js 20.19+ or 22.12+ (developed on 26.x)
- A Cloudflare account — only when you want to deploy. Development needs no account.

## Commands

```bash
npm install         # install dependencies

npm run dev         # dev server (Cloudflare Workers runtime, hot reload)
npm run build       # typecheck, then build to dist/
npm test            # run the test suite once
npm run test:watch  # run tests in watch mode

npm run deploy      # build and deploy to Cloudflare
npm run preview     # serve the production build locally
```

### Quality gate

Every change passes all four before it is committed. `npm run verify` runs them in
order; run the four individually when you want to see each one.

```bash
npm run typecheck   # tsc across all three projects (app, test, node/worker)
npm run lint        # ESLint: TypeScript, React, React Hooks, JSX a11y
npm test            # 75 tests
npm run build       # production build, sizes checked below
```

`npm run lint` runs with `--max-warnings 0`: a warning fails the gate. A small number of
rules are set to `warn` rather than `error` (hook dependency arrays, `console`) so that
the editor stays quiet while CI stays strict.

ESLint is configured in `eslint.config.js`, which is commented rule-by-rule with the
reason each rule is on. Read it before adding one: every rule there had to justify its
own existence. We deliberately do not enforce formatting — Prettier, import sorting and
line width are not defects, and a linter that reports style is a linter people stop
reading.

## Architecture in one paragraph

A React + TypeScript single-page app served by a single Cloudflare Worker that
also serves the static assets. V1 is **local-first**: all data lives in the user's
browser and persistence happens only through repository interfaces, so swapping to
Workers + D1 in a later phase touches one factory function rather than the UI.
There is no database and no authentication in V1 — deliberately.

```
UI (features/, app/)
  ↓
Application services   (Phase 2+)
  ↓
Domain logic           (Phase 4+ — scoring, consistency, journey, recovery)
  ↓
Repository interfaces  (src/data/repositories)  ← the swap point
  ↓
Storage                (src/data/storage → localStorage, later Worker + D1)
```

## Project layout

```
worker/index.ts          Cloudflare Worker: serves assets, /api/health, security headers
public/                  static files copied verbatim, including _headers

src/
  main.tsx               entry point; style import order matters
  App.tsx                three providers composed; no business logic

  app/                   application shell, routing, cross-cutting providers
    AppShell.tsx           skip link, header, nav, <main>, error boundary
    routes.tsx             the four screens plus /design-system
    PreferencesProvider    theme state, backed by the repository
    RouteErrorBoundary     user-safe error copy
    ScreenHeader.tsx       the shared page-heading pattern

  features/              one folder per product area
    today/ journey/ progress/ you/ notfound/ designsystem/

  components/
    ui/                  the design system primitives
      Button Card TextField ProgressBar states Icon
    layout/              AppHeader, PrimaryNav

  data/                  persistence boundary
    repositories/         PreferencesRepository (knows ASCEND shapes)
    storage/              webStorageStore, keys (knows nothing)

  styles/
    tokens.css           ALL colours, sizes, radii, shadows, durations
    base.css             reset + element defaults + reduced-motion
    utilities.css        small shared helpers
    contrast.test.ts     enforces WCAG AA against the real tokens

  lib/                   tiny helpers (cn)
  test/                  global test setup

docs/
  adr/                   architecture decision records
  security-headers.md    what we ship, and what is deliberately deferred

docs/adr/                0001 Cloudflare Worker, 0002 repository interfaces,
                         0003 CSS tokens, 0004 no DB/auth in V1,
                         0005 single Preferences object,
                         0006 toolchain versions (TS 6 / ESLint 9),
                         0007 opaque Growth Area ids, in three namespaces,
                         0008 currentStep is navigation only,
                         0009 unresolved references are kept, not deleted,
                         0010 the Goal and the WHY are Journey-level,
                         0011 a draft from a newer build is never overwritten,
                         0012 every persisted field needs a version bump and a
                              sequential migration
```

## Design system

Everything visual comes from `src/styles/tokens.css`. Components never hardcode a
colour, radius, shadow or duration — they consume a semantic token
(`--text-secondary`, `--color-accent`) rather than a presentational one
(`--grey-500`). That is what makes dark mode and any future re-brand a
one-file change.

Browse every primitive, both themes and all states at **`/design-system`**. It is
deliberately not in the main navigation.

Contrast is enforced by tests, not documented and hoped for.
`src/styles/contrast.test.ts` parses `tokens.css` and asserts WCAG 2.2 AA for
every text/surface pair the UI actually renders, plus 3:1 for control borders and
the focus ring. That test has already caught one real failure.

## Accessibility

WCAG 2.2 AA is the target, treated as a requirement rather than a pass at the end.

- Real semantic elements; no clickable `<div>`
- Every interactive target at least 44 × 44 px
- Skip link to main content, focus moved programmatically, not just scrolled
- One `<nav>` element repositioned by CSS, never duplicated per breakpoint
- Visible `:focus-visible` rings, never removed without replacement
- Colour is never the only signal; every status also has text
- `prefers-reduced-motion` honoured globally so no component can ignore it
- Errors announced with `role="alert"`; hints linked with `aria-describedby`
- Text never below 16px in inputs, so iOS cannot zoom on focus

## Testing

940 tests, run with `npm test`. The Phase 3E changes add 84 tests for Progress,
safe historical reads, local calendar arithmetic and real-router navigation.

- **Storage** — corrupt JSON, blocked storage, quota exhaustion
- **Preferences** — migration, validation, unknown future versions
- **Contrast** — WCAG AA against the real token values
- **Primitives** — progress clamping, button double-submit prevention, label binding
- **Navigation** — four destinations, correct `aria-current`, single `<nav>`

Two real defects were caught by the test suite in Phase 1 and fixed: a border token at
1.49:1 contrast (now 3.15:1) and a `storageStatus` flag initialised from a meaningless
version check (now `repository.isAvailable()`).
- **Theme** — cycling and accessible naming

## Deployment

Workers + Static Assets, not Pages, so the same project can grow into the API
without a hosting migration. See `docs/adr/0001-cloudflare-static-assets.md`.

`wrangler.jsonc` sets `run_worker_first: ["/api/*"]`, so static assets are served
directly by the assets binding and do not consume Worker invocations. The Worker
only runs for `/api/*`. This is what keeps the project comfortably inside the
Cloudflare Free plan.

Static-asset headers live in `public/_headers` because the Worker never runs for
asset requests. `docs/security-headers.md` explains the split and the
Content-Security-Policy we are deliberately deferring to Phase 13.

## Principles the code is meant to protect

- Progress over perfection
- Missing a day creates a path back; it never destroys progress
- Real-world progress outranks digital progress
- Never use shame as motivation, and never punish someone for being human
- Points are secondary to real progress
- Empty states and errors must move the user forward

## Licence

Private. Not published.
