# ADR 0008 — currentStep is navigation only; validity is computed per step

- **Status:** Accepted (Phase 2A architecture correction)
- **Date:** 2026-10-01

## Context

The onboarding draft carries a `currentStep` field so a returning user can be sent
back to where they stopped. That is all it was designed for.

It is very easy for `currentStep` to grow a second job. If any code reads it as
"the user reached step 4, so steps 1–3 must be fine", then `currentStep` becomes
both a navigation hint and an assertion about data quality — two claims from one
field, where the second is only accidentally true.

Every way it stops being true is a real thing that happens:

- a stored id no longer resolves, because a suggestion was retired or storage was
  edited by hand
- a user navigates straight to a URL, skipping the question
- a newer build writes a step this build has never heard of
- the draft was written before a field existed

## Decision

**`currentStep` is for navigation and resume position. Nothing else.**

Three rules follow, and all are enforced by tests:

1. **Validity is never inferred from `currentStep`.** Each step has its own
   domain validator, and `validateOnboardingDraft(draft)` is the single gate for
   creating a Journey. Neither function reads `currentStep`.
2. **React components do not decide overall onboarding validity.** A screen may
   ask about *its own* step, through that step's validator, to decide whether its
   own button is enabled. It may not re-implement the rules or decide that
   onboarding is complete.
3. **Three questions, three functions.** Conflating any pair of them produces a
   bug, so each has one owner:

   | Question | Answered by | Function |
   | --- | --- | --- |
   | Is there an answer here? | field presence | (per-field check) |
   | Is it good enough to start a Journey? | the step's rule | `isGrowthAreaStepValid` |
   | Where should they be sent back to? | `currentStep` | `resumeStep` |

   Presence alone never satisfies a step. An answer that cannot be honoured is
   `unresolvable`, not valid: the answer is still there, and the user is asked to
   resolve it rather than having it treated as done or thrown away (ADR 0009).

```ts
isGrowthAreaStepValid(draft)  // one per step, named for the step
validateOnboardingDraft(draft) // walks the steps in order, stops at the first gap
answeredSteps(draft)          // stops at the first gap, for an honest progress bar
resumeStep(draft)             // the ONLY function that reads currentStep
```

A step with no registered validator is reported as `not-answered-yet`, which is
deliberately distinct from `unanswered`: one is the user's doing, the other is
ours, and conflating them would make a half-built phase look like a user who
skipped a question.

## Rationale

**A position is not an answer.** Treating `currentStep: 'goal'` as evidence that
a Growth Area was chosen would let a Journey be created from a draft where
nothing valid was selected. That is the failure the rule exists to prevent.

**Fail-closed is safer than fail-open.** With only the Growth Area rule
registered, `validateOnboardingDraft` correctly reports `goal` as
`not-answered-yet` — onboarding cannot complete, and it says so. Once a missing
migration is added, that step passes without any change to the aggregator.

**Components re-implementing rules drift.** `GrowthAreasScreen` used to decide
Continue was disabled by counting chips. That was a second implementation of
`isGrowthAreaStepValid`, and the two would eventually disagree. It now asks the
domain, including for the wording shown under the disabled button, so the reason
and the rule cannot be stated in two places.

**`answeredSteps` stops at the first gap** rather than counting scattered
successes, because "you answered 3 of 6" is misleading when steps 1 and 3 are
answered and 2 is not.

## Consequences

**Good**

- A corrupted or hand-edited draft cannot become a Journey.
- Adding a screen means adding one `isXStepValid` and registering it. Nothing else.
- Disabled-button wording and the rule behind it come from one place.
- A progress indicator cannot lie about how far someone has got.

**Bad / accepted costs**

- The rule set is a module-level registry, so it is easy to forget to register a
  new step. That fails *closed* (onboarding blocked) rather than open, which is
  the safe direction, and the `not-answered-yet` message names the missing step.
- `validateOnboardingDraft` takes an optional rule set purely so the success path
  and the mid-list failure path can be tested before those steps exist. It
  follows the injection style already used for the repository and the clock, and
  production callers pass nothing.

## Related

- `src/domain/onboardingValidation.ts` — `STEP_VALIDATORS`, `validateOnboardingDraft`
- `src/domain/onboardingDraft.ts` — `resumeStep`, the only reader of `currentStep`
- ADR 0007 — why ids must resolve before validity means anything
- ADR 0009 — why an unresolvable answer is kept rather than dropped
