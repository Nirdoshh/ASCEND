# ADR 0010 — The Goal and the WHY are Journey-level answers, not keyed by Growth Area

- **Status:** Accepted (Phase 2B)
- **Date:** 2026-10-01

## Context

ADR 0009 was written during the Phase 2A architecture correction, before Phase
2B had a settled design. It says, in its context section:

> From Phase 2B onward, the draft holds answers that are keyed **by Growth Area
> id**: a Goal, a WHY, a set of milestones, a daily effort figure.

That was one plausible shape, and it was the shape ADR 0009 reasoned about. It
is not the shape Phase 2B built. The two Phase 2B questions are:

- 2B-1 "What would you love to achieve?" → `draft.goal`
- 2B-2 "Why does this matter to you?" → `draft.why`

Both are asked **once**, of the **whole Journey**, in the same way for every
area. Nothing in either question asks the user to say which Growth Area the
answer belongs to, and no screen reads them per area.

So the fields are:

```ts
interface OnboardingDraft {
  // ...
  readonly goal?: PersonalAnswer
  readonly why?: PersonalAnswer
}
```

Two optional, unkeyed fields — siblings of `selectedGrowthAreaIds` and
`customGrowthAreas`, not children of anything inside them.

## Decision

**The Goal and the WHY belong to the Journey. They are never keyed by a Growth
Area id, and `reconcileSelections` is not extended to know about them.**

ADR 0009's *rule* is unchanged and still binding: user-entered work is never
deleted to make the state tidier, and an answer whose referent is gone is kept
and surfaced rather than dropped. What changes is that these two answers have no
referent, so there is nothing for them to be orphaned by. The rule simply has
no work to do for `goal` and `why`.

This is not a relaxation of ADR 0009. It removes a case that ADR 0009 anticipated
rather than removing a guarantee it made.

## Rationale

**A Journey spans several Growth Areas, so the question is asked of the
Journey.** A person who selects "Fitness" and "Learning" has one reason for
starting and one outcome they want. Splitting that sentence into a per-area
field would force an answer to a question nobody asked, and the first
deselection would then have to invent a rule for which fragment survives.

**The alternative was tried on paper and produces strictly more states.** If
`goal` were `Record<GrowthAreaId, PersonalAnswer>`, every deselect would create a
potential orphan, and every screen would need to decide whether to show the goal
of the currently selected area, all goals, or a merged one. That is ADR 0009's
resolution flow, multiplied by the number of areas, for a question that has one
answer.

**It makes deselection genuinely harmless.** Someone who writes a Goal, goes
back, and changes their mind about their areas keeps their Goal with no
prompt, no warning and no Summary decision, because nothing was ever coupled.
The generous outcome falls out of the data model instead of being special-cased
in the UI.

**It is already enforced by tests, not by convention.** `setGoal` and `setWhy`
are pure projections over exactly one key, `reconcileSelections` does not
mention them at all, and `onboardingDraft.test.ts` asserts that a goal survives
deselecting the only selected area.

## Consequences

**Good**

- Deselecting an area cannot orphan, hide or destroy a Goal or a WHY.
- No per-area resolution UI is needed for these two steps, now or at Summary.
- The storage shape stays small: adding the fields needed **no** schema bump and
  **no** migration (see below), because a draft written by an earlier build
  simply has no such keys, which is exactly the "unanswered" representation.

**Bad / accepted costs**

- **ADR 0009's context section is now wrong about `goal` and `why`.** It is left
  in place as the record of a decision made with the information available, and
  annotated to point here. Rewriting history in an ADR is worse than correcting
  it in the open.
- **Later steps may still need the per-area pattern.** Milestones and daily
  effort are plausibly per-area, and if they are, ADR 0009 applies to them in
  full. This ADR does not settle those; it settles the two answers Phase 2B
  actually asked.
- **A Goal that mentions an area the user later removes is not contradicted.**
  Nothing checks that the sentence still "matches" the selection. That is
  deliberate — ASCEND does not grade or re-read the user's own words back at
  them — but it does mean a stale-sounding Goal can survive. The user can edit
  it at any time, which is the intended remedy.

## No schema version bump, on purpose

`ONBOARDING_SCHEMA_VERSION` stays **3**.

Adding two optional fields is not a shape change an earlier build would
misinterpret: a v3 build without these fields reads a draft that has them,
ignores them, and behaves exactly as before. Bumping to 4 would force a
migration that does nothing, and would create a real hazard in the other
direction — a v4 draft written by this build, then read by a *cached v3 build*,
would hit the unknown-future-version path and could lose the Goal entirely. The
rule is that a version bump is earned by a shape change that an older reader
would get **wrong**, and this is not one.

## Related

- `src/domain/personalAnswer.ts` — the rules for a free-text answer, and why an
  answer is either a real sentence or absent
- `src/domain/onboardingDraft.ts` — `setGoal` / `setWhy` as pure projections, and
  the schema-version note
- `src/domain/onboardingValidation.ts` — `isGoalStepValid` / `isWhyStepValid`
- ADR 0007 — Growth Area identity is opaque
- ADR 0008 — `currentStep` is navigation only
- ADR 0009 — unresolved references are kept, not deleted (still binding; this ADR
  narrows its scope rather than overriding its rule)
