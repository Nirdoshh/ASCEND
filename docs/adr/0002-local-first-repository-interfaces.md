# ADR 0002 — Local-first persistence behind repository interfaces

- **Status:** Accepted (Phase 1)
- **Date:** 2026-10-01

## Context

V1 must run on the Cloudflare Free plan with no database and no auth. Persistence
therefore starts in `localStorage`. But V1 is meant to be used daily by real
people, and at some point losing data becomes unacceptable.

The risk is not choosing localStorage. The risk is choosing it *loosely*, so that
scattering `localStorage.getItem` across components forces a rewrite of the UI when
D1 arrives.

## Decision

Persist only through repository interfaces. Components never touch storage.

```
React component  →  hook  →  PreferencesRepository  →  KeyValueStore  →  localStorage
                                       ▲
                         swap this implementation in Phase 11
```

Two interfaces, deliberately:

- **`KeyValueStore`** — generic, knows nothing about ASCEND. Stores and returns
  `unknown`. All the defensive behaviour lives here: unavailable storage, quota
  errors, corrupt JSON.
- **`PreferencesRepository`** — knows the shape of ASCEND data. Validates it,
  applies migrations, guarantees valid output.

## Rationale

**Unknown at the storage boundary.** A generic store that validated ASCEND's shapes
would be wrong the moment we add journeys and actions. Keeping the store dumb means
one well-tested file instead of a validation layer per entity.

**Storage must never crash the app.** Web Storage throws in more situations than
people expect: private browsing, enterprise policy blocking storage, a 5 MB quota,
another tab leaving a corrupt value. Every operation returns a result instead of
throwing, and corrupt values are discarded rather than retried.

**The schema version lives in the storage key.** `ascend:preferences:v1`. A version
stored only *inside* the value cannot be read safely when the value is corrupt, so
the migration layer could not tell which schema a blob belongs to.

**Field-level validation.** `migrateAndNormalize` checks each field independently,
so one bad value cannot discard good ones, and it refuses to trust a future
version it does not understand.

## Consequences

**Good**

- Phase 11 replaces one factory function. No component, hook or screen changes.
- Storage failure is an honest, reportable state rather than a crash.
- The rules are enforceable in review and in tests.

**Bad / accepted costs**

- Two layers of indirection before the first feature ships. This is the main
  complexity cost of Phase 1 and it is accepted deliberately.
- `localStorage` is synchronous and blocks the main thread. Fine at ASCEND's V1
  data volume; if it ever stops being fine, the same interface can be backed by
  IndexedDB without touching callers.
- IndexedDB was deliberately *not* added. It is not needed yet, and adding it now
  would be complexity without a demonstrated problem.

## Related

- ADR 0004 — no database and no auth in V1.
- `src/data/storage/webStorageStore.ts`
- `src/data/repositories/preferencesRepository.ts`
