# ADR 0009 — A reference to a deselected Growth Area is kept and marked unresolved, never deleted

- **Status:** Accepted (Phase 2A architecture correction)
- **Date:** 2026-10-01

## Context

From Phase 2B onward, the draft holds answers that are keyed **by Growth Area
id**: a Goal, a WHY, a set of milestones, a daily effort figure. The ids are
opaque and permanent (ADR 0007).

That creates a new situation. A user can go back to step 2 and deselect an area
they had already written a Goal for. The area is not deleted — deselecting only
edits `selectedGrowthAreaIds`, and the custom area itself stays in the draft.
But the Goal now refers to something that is no longer selected, and the
question becomes: what happens to that sentence?

Two obvious answers:

- **Delete the orphaned Goal.** The draft is tidy and every remaining answer
  refers to something selected.
- **Keep it silently.** The Goal stays, but nothing anywhere says it belongs to
  an area that is no longer part of the plan.

Both are wrong. The first destroys something a person typed, with no warning and
no way to recover it. The second hides a real inconsistency behind a screen that
looks complete.

## Decision

**Later answers are KEPT and their references marked unresolved.**

At Summary, the user must explicitly choose one of four things:

- restore the Growth Area
- assign another Growth Area to the orphaned item
- edit the dependent item
- intentionally remove it

Nothing is deleted to tidy the state up. The fourth option is listed explicitly
because "I did not want that one" is a legitimate answer, and a UI that only
offers restore/keep makes people invent a workaround.

## Rationale

**An orphaned Goal is a sentence somebody wrote.** Deleting it because a chip was
deselected is the "never punish the user" failure in miniature: the app takes
away work for a reason the user did not intend and cannot undo.

**Deletion is not actually simpler.** Any draft that has been edited can be
inconsistent. A migration that fills in defaults, a browser extension, or a
half-finished v1 draft all produce references the current UI would not create.
The code has to survive inconsistency either way; the only question is whether it
destroys data when it finds some.

**The alternatives were not "silently drop" versus "ask".** Silently dropping was
rejected because it is unrecoverable. Asking was rejected because a user who
just deselected a chip by accident should not be stopped with an error — the
flow continues, and the resolution happens once, at the point where the answer
actually matters.

**Explicit removal is a feature, not a workaround.** Offering it means the user
can clean up their own plan deliberately, which is better than the app deciding
on their behalf.

## Consequences

**Good**

- No user-entered text is ever lost to a selection change.
- Every inconsistency is surfaced at a place where the user has the context to
  resolve it.
- Validation can tell "unanswered" from "answered but unresolvable", which are
  genuinely different states and must not be collapsed.

**Bad / accepted costs**

- Summary needs a second kind of message: not "fill this in" but "this refers to
  something you removed — what do you want to do with it?".
- The draft carries a notion of an unresolved reference, which is more state to
  model and more to test than a plain missing value.
- One more branch in `validateOnboardingDraft`, where a step can now fail
  because something *earlier* changed rather than because the user left it blank.

## Not built yet, deliberately

There is nothing to implement in Phase 2A. The draft type has no `goal`, no
`why`, no `milestones` and no `dailyEffortMinutes` field at all — an unanswered
question cannot be stored as `""` because there is nowhere to put it. Inventing
an empty resolution state now would be structure with no content.

What is locked in here is the **shape of the decision**, and two supporting
properties are already enforced by tests:

1. Later answers are keyed by area id, so an id reference is the only thing that
   can be orphaned.
2. `reconcileSelections` deliberately does **not** touch dependent data. It
   reconciles the *selection list* against areas that exist at all, and nothing
   else. Extending it to dependent fields when those fields arrive would
   reintroduce exactly this bug.

## Related

- `src/domain/onboardingDraft.ts` — the selection/answer split, and why the toggle functions are pure projections over exactly one key
- `src/domain/onboardingValidation.ts` — `unresolvable` as distinct from `unanswered`
- ADR 0007 — Growth Area identity is opaque
- ADR 0008 — `currentStep` is navigation only
