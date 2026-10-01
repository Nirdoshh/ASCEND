# ADR 0011 — A draft from a newer build is never overwritten

- **Status:** Accepted (Phase 2B compatibility correction)
- **Date:** 2026-10-01
- **Corrects:** the "No schema version bump, on purpose" section of ADR 0010

## Context

Phase 2B added two optional fields to the onboarding draft, `goal` and `why`,
and deliberately kept `ONBOARDING_SCHEMA_VERSION` at **3**. The reasoning was
recorded in ADR 0010:

> a v3 build without these fields reads a draft that has them, ignores them,
> and behaves exactly as before.

Before starting Phase 2C that assumption was tested rather than trusted, because
it is cheap to check and expensive to be wrong about. The test ran the **actual
historical v3 code**, not a re-implementation: a git worktree checked out at
`112d82d` (the v3 commit, which is on `origin/main`), given the real
`createOnboardingDraftRepository`, was fed a Phase 2B v3 draft containing
selected Growth Areas, a Goal and a WHY.

## What the historical code actually does

It destroys the fields.

The v3 reader's `normalizeFields` does not copy the stored object and overlay
known fields; it **constructs a fresh object from the six keys it knows** —
`schemaVersion`, `currentStep`, `selectedGrowthAreaIds`, `customGrowthAreas`,
`startedAt`, `updatedAt`. A key it has no name for is simply not in its output.

The consequence is a two-step loss, not a one-step one:

1. **On load**, `repository.load()` runs `migrateAndNormalizeDraft`, so the
   in-memory draft is already missing `goal` and `why` — even if the user does
   nothing.
2. **On the next write** — selecting an area, adding a custom area, pressing
   Continue — that stripped draft is serialised back. The fields are gone from
   disk.

The measured round trip, starting from a v3 draft with eight keys and ending
with one area deselected:

| stage | keys present |
| --- | --- |
| stored | schemaVersion, currentStep, selectedGrowthAreaIds, customGrowthAreas, **goal**, **why**, startedAt, updatedAt |
| after load | schemaVersion, currentStep, selectedGrowthAreaIds, customGrowthAreas, startedAt, updatedAt |
| after a normal update | schemaVersion: 3 — no goal, no why |

The domain update itself was checked as a **control**: `deselectGrowthArea`
spreads the draft, so handed the raw stored object it *does* preserve unknown
keys. The loss is entirely at the read boundary. That is not a loophole — the
app always reads before it writes, so the spread never sees the fields.

A second finding: the v3 reader treats a version **higher** than its own by
calling that same `normalizeFields`. It adopts what it recognises, drops what it
does not, and rewrites `schemaVersion` back down to 3. So a v4 draft read by a
cached v3 build is not safe by that route either.

## Decision

Three changes.

**1. The schema version is bumped to 4.** The number is earned when a stored
draft would be read *wrong* by a build other than the one that wrote it, and
that is exactly what happens here. The bump does not, on its own, stop the v3
build — but it is the honest label, and it is what steps 2 and 3 read.

**2. `migrateAndNormalizeDraft` refuses a future version instead of normalising
it.** A higher stored version now returns `null` rather than a partial,
silently-downgraded draft. Refusing loses nothing on disk; the newer build
still finds the same bytes.

**3. `save` refuses to write over a draft it cannot represent.**
`OnboardingDraftRepository.save` returns `'newer-schema'` and writes nothing
when the stored draft's version is higher than this build's. Refusing to *read*
is not enough: a null read shows a first-run screen, and the first tap would
then write a fresh draft over the newer one — the same loss, one step later.
The guard re-reads storage rather than trusting a flag captured at load, so it
also covers another tab.

A pass-through `migrateDraftV3ToV4` is registered at key 3. It converts
nothing — v3 and v4 differ only by two fields that are allowed to be absent —
but a version with no registered step is treated as unreconstructable, so a gap
at 3 would drop every existing v3 draft.

## Consequences

**Good**

- A draft from a newer build survives an older build completely intact.
- The direction that was tested is now safe *by construction*, not by a
  reader's leniency: the write is refused, not attempted and then filtered.
- Every existing v1/v2/v3 draft still loads; the `1 → 2 → 3 → 4` chain is
  covered by tests, including the full `1 → 4` walk.
- The failure is loud in storage terms — `save` reports `'newer-schema'`, which
  the provider already surfaces as "progress is not being saved" — rather than
  silent. No new user-facing surface was added for it.

**Bad / accepted costs**

- **The already-written v3 build cannot be retrofitted.** Nothing in this
  repository changes a browser already running `112d82d`; its `normalizeFields`
  is fixed. The mitigation is that `112d82d` is superseded by the commit that
  carries this ADR and was not deployed — deployment is manual, and Phase 2B is
  the first build after it, so no released client has the v3 reader. If a v3
  build is running anywhere, it must be replaced, not patched.
- **An older build that meets newer data is now stuck, not graceful.** It shows
  a first-run screen and refuses to save. The right product answer is a screen
  that says "this data is from a newer version; update", but that is a UI
  feature and out of scope here. The safe half shipped; the legible half did
  not.
- **`preferencesRepository` still has the older behaviour.** Its
  `migrateAndNormalize` adopts a future version and drops unknown fields. That
  object is a single small settings record rather than the user's typed
  answers, and changing it was out of scope for this correction, but the same
  class of bug is present there.

## Related

- ADR 0010 — the Goal and the WHY are Journey-level (its data-model decision is
  unchanged; its schema-version section is corrected by this ADR)
- `src/data/repositories/onboardingDraftRepository.ts` — the migrations, the
  future-version refusal, and `save`'s write guard
- `src/domain/onboardingDraft.ts` — `ONBOARDING_SCHEMA_VERSION` and its note
- `src/data/repositories/onboardingDraftRepository.test.ts` and
  `src/features/onboarding/onboarding.test.tsx` — the regression tests
