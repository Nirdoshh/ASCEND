# ADR 0012 — Every persisted field needs a version bump and a sequential migration

- **Status:** Accepted (Phase 2C)
- **Date:** 2026-10-01
- **Applies:** ADR 0011's read and write guards to every field added from here on

## Context

Phase 2C adds three optional fields to the onboarding draft:

- `durationDays` — a whole number of days (bounded 7–365)
- `milestones` — up to five `{ id, text }` records
- `dailyEffortMinutes` — a whole number of minutes (bounded 5–480)

The obvious move is to add them without touching `ONBOARDING_SCHEMA_VERSION`.
They are optional, an older build has no screen that reads them, and leaving the
number alone keeps the diff small. Phase 2B made exactly that argument for `goal`
and `why`, and ADR 0011 records what happened when it was tested: an older build
**deletes the fields** on the next ordinary write.

The mechanism is in `normalizeFields`. It does not copy the stored object and
overlay the keys it knows; it **constructs a fresh object from the keys it
knows**. A key it has no name for is simply not in its output. So the loss is
two-step — `load()` strips the fields in memory, and the next `save()` writes the
stripped object back to disk. The user never sees an error; they answer three
questions, tap a chip, and their answers are gone.

That is true of any new key, in any build, forever. It is a property of the
reader, not of these three fields.

## Decision

**1. `ONBOARDING_SCHEMA_VERSION` goes from 4 to 5, and a pass-through
`migrateDraftV4ToV5` is registered at key 4.**

The bump is not what stops the older build — the reader it already runs cannot be
changed. The bump is what lets *this* build recognise a v5 draft, and what an
older build's guards key off. The pass-through converts nothing (v4 and v5 differ
only by fields that are allowed to be absent), but a version with no registered
step is treated as unreconstructable, so a gap at 4 would drop every existing
Phase 2B draft outright.

**2. The migration registry must have no gaps, and each step runs in order.**
`1 → 2 → 3 → 4 → 5` is what a v1 draft walks. The order is asserted by a test
that watches which migration functions are called, not merely that one was.

**3. The rule, stated once, for every field added after this: adding a field
that can be persisted requires a version bump and a sequential migration.**
"Optional" is not an exemption. `goal` and `why` were optional too.

**4. New fields are read the same way every other field is — honestly.**
`normalizeFields` keeps any positive whole number for `durationDays` and
`dailyEffortMinutes`, even one outside the current bounds; it is the step
validator, not the reader, that refuses an out-of-range step and says so. A
malformed `milestones` value (a non-array, or a list where nothing is usable)
becomes an **absent key**, never an empty list, because `[]` would claim the
question was answered with nothing. This is ADR 0009's rule — never silently
delete a person's work — applied at the read boundary.

## Consequences

**Good**

- A v5 draft is never read wrong by this build, and a v4 build meeting a v5
  draft refuses it instead of quietly damaging it (ADR 0011's guards do the
  work; the bump makes them fire).
- Every existing draft still loads: the `1 → 2 → 3 → 4 → 5` chain is covered by
  a test, and so is the specific case of a v4 draft that already carries the
  Phase 2C fields — which is what happens if the number were ever written before
  the fields were.
- The failure mode the bump protects against is pinned by a test with a
  counterfactual: a rebuild-from-known-keys reader drops a key it cannot name,
  using a stand-in key this build does not know. The test cannot run the
  historical v4 reader (that code is not in this tree), so it proves the
  mechanism rather than the exact historical round trip.

**Bad / accepted costs**

- **The version number is now load-bearing for every field.** Adding a field and
  forgetting the bump is silent data loss, and nothing in the type system
  catches it. The mitigation is this ADR and the comments in
  `onboardingDraft.ts` and `onboardingDraftRepository.ts`; the risk is human.
- **Every bump costs a migration entry, even when it converts nothing.** That is
  deliberate friction: the entry is where the reason for the number gets written
  down.
- **`normalizeFields` still cannot distinguish "the user removed this key" from
  "an old build removed it."** Both arrive as absent. That is
  indistinguishable on disk and is the reason removal deletes the key rather
  than writing an empty value.

## Related

- ADR 0011 — a draft from a newer build is never overwritten (the guards this
  bump activates)
- ADR 0009 — unresolved references are kept, not deleted (the read-boundary
  rule for out-of-range and empty values)
- ADR 0008 — `currentStep` is navigation only (why validity is read from the
  fields, never the pointer)
- `src/domain/onboardingDraft.ts` — `ONBOARDING_SCHEMA_VERSION` and its note
- `src/data/repositories/onboardingDraftRepository.ts` — the migration registry,
  `migrateDraftV4ToV5`, and `normalizeFields`
- `src/data/repositories/onboardingDraftRepository.test.ts` — the `1 → 5` walk,
  the v4-with-Phase-2C-fields case, and the counterfactual
