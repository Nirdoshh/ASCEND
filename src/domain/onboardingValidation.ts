/**
 * Onboarding validation.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE
 *
 *   currentStep is for NAVIGATION and RESUME POSITION. Nothing else.
 *
 * It records where the user is. It does NOT record whether their answers
 * are any good, and it must never be read as if it did. A draft can sit
 * on `currentStep: 'goal'` with a selection pointing at an area that no
 * longer exists, and validation must still refuse it. The tempting
 * shortcut — "the user got to step 4, so steps 1–3 must be fine" — is
 * wrong for reasons that all show up in real use: a suggestion was
 * renamed, storage was edited by hand, a future version wrote a step
 * this build has never heard of, or the user reached forward by
 * navigating directly to a URL.
 *
 * So validity is computed from the DATA, per step, by a named function
 * per step. `currentStep` never appears in any of them.
 *
 * THE THREE DISTINCTIONS, AND WHICH FUNCTION OWNS EACH
 *
 *   field presence        -> ANSWERED.  "There is a Goal for ga_c_ab12."
 *   step validator        -> VALID.     "That Goal is good enough to
 *                                         start a Journey."
 *   currentStep           -> RESUME.    "Send them back to this screen."
 *
 * These are three different questions with three different answers, and
 * conflating any pair of them produces a bug. Conflating presence with
 * validity lets an unusable answer through; conflating currentStep with either
 * lets a corrupt draft masquerade as a finished one.
 *
 * So presence alone never satisfies a step. A step with an answer that cannot
 * be honoured is `unresolvable`, not valid — the answer is still there, and the
 * user is asked to resolve it rather than having it treated as done or thrown
 * away. That is the same product rule that keeps later draft data when its
 * Growth Area is deselected: user-entered work is never deleted to make the
 * state tidier.
 *
 * WHO CALLS THIS
 *
 * Domain code and the future application service. React components must
 * not decide whether onboarding is complete overall — a component that
 * re-implements the rules is a second implementation that will drift,
 * and the drift will only show up for the people who got the unusual
 * path. A screen may ask about ONE step, through the step's own
 * validator, for the purpose of enabling its own button. That is a local
 * concern and it reuses the same function, so it cannot disagree.
 */

import { MAX_MILESTONES, MIN_MILESTONES } from './milestone'
import { knownGrowthAreas, ONBOARDING_STEPS } from './onboardingDraft'
import type { OnboardingDraft, OnboardingStep } from './onboardingDraft'
import { MAX_GOAL_LENGTH, MAX_WHY_LENGTH } from './personalAnswer'
import type { PersonalAnswer } from './personalAnswer'
import {
  DAILY_EFFORT_BOUNDS,
  DURATION_BOUNDS,
  isBoundedNumberInRange,
} from './schedule'

/**
 * Why a step is not satisfied.
 *
 *   unanswered       nothing was chosen or written
 *   not-answered-yet this build has no rule for the step at all, because
 *                    the screen for it does not exist yet. Distinct from
 *                    `unanswered` on purpose: one is the user's doing,
 *                    the other is ours, and conflating them would let a
 *                    half-built phase look like a user who skipped a
 *                    question.
 *   not-started      there is no draft, so no step has been reached
 *   unresolvable     an answer exists but points at something we cannot
 *                    show the user, so it cannot be honoured
 *   too-long         an answer exists and says something real, but breaks
 *                    a bound we have to enforce. Separate from
 *                    `unanswered` because the user HAS answered, and
 *                    telling them so would be a lie — they would sit there
 *                    retyping a sentence they had already written
 *                    correctly.
 */
export type OnboardingProblem =
  | 'not-started'
  | 'unanswered'
  | 'not-answered-yet'
  | 'unresolvable'
  | 'too-long'
  /**
   * A number was stored that this build cannot honour.
   *
   * Its own name rather than a reuse of `too-long`, because "too long" is
   * false for a 3-day Journey and "unanswered" is false for a 3-day Journey
   * somebody typed on purpose. Both of those would leave them retyping an
   * answer they had already given correctly, which is the exact failure
   * `too-long` exists to avoid.
   *
   * Reachable only from hand-edited storage or a build with different
   * bounds: our own screens refuse an out-of-range number before it is ever
   * stored. See schedule.ts.
   */
  | 'out-of-range'

export type StepValidation =
  | { readonly valid: true }
  | { readonly valid: false; readonly problem: OnboardingProblem; readonly message: string }

/**
 * Step 2 is satisfied when at least one Growth Area is chosen AND every
 * chosen id still resolves to an area we can display.
 *
 * The second half is not paranoia. A draft written by an older build, a
 * draft edited by hand, or a draft whose suggestion was retired in a
 * later release can all carry ids we cannot render. Counting them would
 * let someone "pass" this step with a selection the screen does not show,
 * which is worse than asking again.
 */
export function isGrowthAreaStepValid(draft: OnboardingDraft | null): StepValidation {
  // No draft means nothing was chosen, which is the same situation as an
  // empty selection — so it is the same answer. Accepting null here keeps
  // the message for "you have not chosen anything yet" in exactly one
  // place instead of forcing every caller to invent its own.
  if (!draft || draft.selectedGrowthAreaIds.length === 0) {
    return { valid: false, problem: 'unanswered', message: 'Choose at least one Growth Area.' }
  }

  const known = new Set(knownGrowthAreas(draft).map((area) => area.id))
  if (draft.selectedGrowthAreaIds.some((id) => !known.has(id))) {
    return {
      valid: false,
      problem: 'unresolvable',
      message: 'One of the chosen areas is no longer available. Choose again.',
    }
  }

  return { valid: true }
}

/**
 * Step 3 is satisfied when the user has written something, and it is no
 * longer than the limit.
 *
 * What is NOT checked, on purpose:
 *
 *   - Whether it is a good goal. A person who writes "be better at stuff"
 *     has answered the question, and second-guessing them here would be
 *     the app grading them at the moment they are trying to start.
 *   - Which Growth Areas it mentions. It is a Journey-level answer and
 *     references no area (ADR 0010), so there is nothing to resolve.
 *   - Capitalisation, punctuation, spelling, emoji or language. ASCEND
 *     does not correct people. See personalAnswer.ts.
 *
 * The length check runs on the TRIMMED text, so a sentence padded with
 * spaces is not rejected for being over the limit, and a sentence is not
 * accepted because a stray space hid four characters of it.
 */
export function isGoalStepValid(draft: OnboardingDraft | null): StepValidation {
  return validateAnswer(draft?.goal, {
    maxLength: MAX_GOAL_LENGTH,
    unanswered: 'Tell us what you would love to achieve.',
    tooLong: `That is a bit long. Keep your goal to ${MAX_GOAL_LENGTH} characters or fewer.`,
  })
}

/**
 * Step 4 is satisfied the same way as step 3.
 *
 * The WHY is first-class data, not decoration, and that is exactly why it
 * must not be easy to fake. There is deliberately no fallback text, no
 * suggested answer and nothing inserted on the user's behalf: an answer
 * ASCEND made up is worth nothing on the day somebody needs to hear it.
 */
export function isWhyStepValid(draft: OnboardingDraft | null): StepValidation {
  return validateAnswer(draft?.why, {
    maxLength: MAX_WHY_LENGTH,
    unanswered: 'Tell us why this matters to you.',
    tooLong: `That is a bit long. Keep it to ${MAX_WHY_LENGTH} characters or fewer.`,
  })
}

/**
 * The shared rule behind both free-text steps.
 *
 * One implementation for two steps, because the two differences that
 * matter — how long, and what to say when it is not usable — are the
 * caller's to supply. Everything else is identical, and two hand-written
 * copies of "trim, then check for emptiness, then check the length" is
 * how a step ends up rejecting a valid sentence that its twin accepts.
 *
 * A stored `{ text: '   ' }` is treated as no answer at all. The setter
 * and the repository normaliser both refuse to create one, so this is only
 * reachable from hand-edited or corrupted storage — and refusing it is the
 * right answer there, because a field of spaces is not what anybody meant.
 */
function validateAnswer(
  answer: PersonalAnswer | undefined,
  rules: { maxLength: number; unanswered: string; tooLong: string },
): StepValidation {
  if (!answer) return { valid: false, problem: 'unanswered', message: rules.unanswered }

  const text = answer.text.trim()
  if (text === '') return { valid: false, problem: 'unanswered', message: rules.unanswered }
  if (text.length > rules.maxLength) {
    return { valid: false, problem: 'too-long', message: rules.tooLong }
  }

  return { valid: true }
}

/**
 * The shared rule behind both numeric steps.
 *
 * The same reasoning as `validateAnswer` above: the two differences that
 * matter — the range, and what to say when the number is unusable — are the
 * caller's to supply, and everything else is identical. Duration in days and
 * daily effort in minutes are the same question asked about different units.
 *
 * Three outcomes, and the distinction between the last two is the whole
 * point of this function:
 *
 *   no number at all        unanswered. The user has not been asked, or has
 *                           not answered, and saying so is the truth.
 *   a number we cannot use  out-of-range. The user HAS given a number and it
 *                           is a real one; we simply cannot honour it. They
 *                           are told the range and asked to pick again, which
 *                           is a different conversation from "you have not
 *                           answered yet".
 *   a usable number         valid.
 *
 * The message for `out-of-range` is built from the bounds rather than typed,
 * so it cannot go stale if a limit is ever moved.
 */
function validateBoundedNumber(
  value: number | undefined,
  bounds: { min: number; max: number; unit: string },
): StepValidation {
  if (value === undefined) {
    return {
      valid: false,
      problem: 'unanswered',
      message: `Choose how many ${bounds.unit} you want.`,
    }
  }

  if (!isBoundedNumberInRange(value, bounds)) {
    return {
      valid: false,
      problem: 'out-of-range',
      message: `Choose between ${bounds.min} and ${bounds.max} ${bounds.unit}.`,
    }
  }

  return { valid: true }
}

/**
 * Step 5 is satisfied when the user has chosen a duration inside the bounds.
 *
 * Not checked, on purpose: whether the number is achievable, whether it
 * suits their Goal, whether it is "enough" time. A person who answers "7"
 * has answered the question. Second-guessing a number is the same mistake as
 * second-guessing a sentence, and the brief is explicit that daily effort is
 * planning context rather than a score — so this validator has no opinion
 * about the value, only about whether it is one we can store and use.
 *
 * Nothing here compares duration against daily effort. 90 days at 10 minutes
 * and 30 days at 90 minutes are both valid, because judging one against the
 * other is exactly the judgement this phase refuses to make.
 */
export function isDurationStepValid(draft: OnboardingDraft | null): StepValidation {
  return validateBoundedNumber(draft?.durationDays, DURATION_BOUNDS)
}

/**
 * Step 7 is satisfied the same way, in minutes.
 *
 * The word "realistically" is in the question, so the screen's copy is the
 * place that carries it. The validator deliberately has no view on whether
 * the number was realistic: telling somebody their honest answer is too
 * small would be the exact shaming the brief rules out, and it is not
 * something a number can tell us anyway.
 */
export function isEffortStepValid(draft: OnboardingDraft | null): StepValidation {
  return validateBoundedNumber(draft?.dailyEffortMinutes, DAILY_EFFORT_BOUNDS)
}

/**
 * Step 6 is satisfied when at least one milestone is written and no more
 * than MAX_MILESTONES are.
 *
 * The LOWER bound is `unanswered` — no milestones means the question has not
 * been answered. That is only true because `removeMilestone` DELETES the key
 * when the last one goes; a stored `milestones: []` would claim otherwise,
 * and the rule would have to bend to accommodate it.
 *
 * The UPPER bound is a real refusal rather than a silent truncation. Eight
 * stored milestones cannot come from our own screens — `addMilestone`
 * refuses the ninth — so this is hand-edited storage, and four of those
 * eight are sentences somebody typed. Truncating them would delete real
 * work; refusing the step tells them to combine two, which is the advice the
 * limit exists to give.
 *
 * Deliberately NOT checked: what a milestone says, whether it is specific
 * enough, whether it is reachable, and which Growth Area it belongs to.
 * Milestones are Journey-level in V1 (ADR 0010), so there is no area to
 * resolve against, and ASCEND does not grade what people write.
 */
export function isMilestoneStepValid(draft: OnboardingDraft | null): StepValidation {
  const count = draft?.milestones?.length ?? 0

  if (count < MIN_MILESTONES) {
    return {
      valid: false,
      problem: 'unanswered',
      message: 'Add at least one thing that would prove it is working.',
    }
  }

  if (count > MAX_MILESTONES) {
    return {
      valid: false,
      problem: 'too-long',
      message: `Keep it to ${MAX_MILESTONES} or fewer — try to combine two.`,
    }
  }

  return { valid: true }
}

/**
 * One validator per step, keyed by step.
 *
 * Only the steps that exist have entries. Adding a screen in a later
 * phase means adding its `isXStepValid` here and nothing else — the
 * aggregator, the ordering and the "start at the first unanswered step"
 * behaviour are already here.
 *
 * The full set, as it will grow:
 *   isGrowthAreaStepValid  implemented
 *   isGoalStepValid        implemented
 *   isWhyStepValid         implemented
 *   isDurationStepValid    implemented
 *   isMilestoneStepValid   implemented
 *   isEffortStepValid      implemented
 *
 * Note there is no validator for `welcome`: the welcome screen asks
 * nothing, so there is nothing to validate, and it is excluded from the
 * scan below.
 *
 * AND NO VALIDATOR FOR `summary`
 *
 * `summary` is the step that creates the Journey, so it is deliberately
 * still absent. `validateOnboardingDraft` therefore CANNOT return
 * `valid: true` in Phase 2C even for a draft where every question has been
 * answered perfectly: the scan reaches `summary`, finds no rule, and stops
 * with `not-answered-yet`.
 *
 * That is the strongest statement this codebase can make that Phase 2D
 * owns the transition. It would have been easy — and wrong — to register a
 * placeholder that returned `valid: true` so the gate would open. Onboarding
 * would then be "complete" with no Journey having been created, and Phase
 * 2D would inherit a gate that has already been satisfied by nobody.
 */
export type StepValidator = (draft: OnboardingDraft) => StepValidation

/** A rule set may be partial: a step with no rule is simply not yet answered. */
export type StepValidators = Partial<Record<OnboardingStep, StepValidator>>

const STEP_VALIDATORS: StepValidators = {
  'growth-areas': isGrowthAreaStepValid,
  goal: isGoalStepValid,
  why: isWhyStepValid,
  duration: isDurationStepValid,
  milestones: isMilestoneStepValid,
  'daily-effort': isEffortStepValid,
}

export type OnboardingValidation =
  | { readonly valid: true; readonly completedSteps: readonly OnboardingStep[] }
  | {
      readonly valid: false
      /** The first step that is not satisfied, in order. */
      readonly firstIncompleteStep: OnboardingStep
      readonly problem: OnboardingProblem
      readonly message: string
    }

/**
 * The single gate for creating a Journey.
 *
 * Walks the steps in order and stops at the first one that is not
 * satisfied, so the message always names the earliest thing still
 * missing.
 *
 * WHERE IT STOPS, AND WHY THAT IS THE POINT
 *
 * Through Phase 2B that was always `duration`, because no duration screen
 * existed. Through Phase 2C it is always `summary`, because Phase 2C built
 * the duration, milestone and daily-effort questions and deliberately did
 * NOT build the step that creates a Journey.
 *
 * So this build still cannot return `valid: true`, and the reason is a
 * design decision rather than an oversight: the moment onboarding claims a
 * completed draft, something downstream is entitled to create a Journey, and
 * that something is Phase 2D's to write. A placeholder validator that
 * returned `valid: true` for `summary` would have made this gate open
 * without a Journey existing, and the test that asserts the gate is closed
 * would have been the thing standing between the two phases and a Journey
 * built from a draft with nothing behind it.
 *
 * Phase 2B and Phase 2C each did NOT weaken this gate to make themselves
 * look finished. Adding validators moved the stopping point forward and
 * nothing else.
 *
 * The `validators` argument is a seam, not a feature. It exists so the
 * success path and the mid-list failure path can be tested before those
 * steps exist, using the same injection style as the repositories and
 * the injected clock. Production callers pass nothing; a caller that
 * passes a weaker rule set than the real one is bypassing the gate, and
 * the only safe place for that is a test.
 */
export function validateOnboardingDraft(
  draft: OnboardingDraft | null,
  validators: StepValidators = STEP_VALIDATORS,
): OnboardingValidation {
  if (!draft) {
    return {
      valid: false,
      firstIncompleteStep: 'welcome',
      problem: 'not-started',
      message: 'Onboarding has not been started.',
    }
  }

  const completedSteps: OnboardingStep[] = []

  for (const step of ONBOARDING_STEPS) {
    // The welcome screen asks no questions, so it is passed through
    // rather than validated. It still counts as visited, because the
    // draft existing means the user got past it.
    if (step === 'welcome') {
      completedSteps.push(step)
      continue
    }

    const validate = validators[step]
    if (!validate) {
      return {
        valid: false,
        firstIncompleteStep: step,
        problem: 'not-answered-yet',
        message: `The “${step}” step has not been built yet, so onboarding cannot be completed.`,
      }
    }

    const result = validate(draft)
    if (!result.valid) {
      // Written out rather than spread, so the discriminant cannot be
      // silently overridden by the step's own result.
      return {
        valid: false,
        firstIncompleteStep: step,
        problem: result.problem,
        message: result.message,
      }
    }

    completedSteps.push(step)
  }

  return { valid: true, completedSteps }
}

/**
 * The steps a draft has actually satisfied.
 *
 * Useful for a progress indicator that must not lie. It stops at the
 * first gap rather than counting scattered successes, because
 * "you answered 3 of 6" is misleading when steps 1 and 3 are answered
 * but 2 is not.
 *
 * Takes the same optional seam as validateOnboardingDraft, and must
 * always be called with the same rule set it was, or a progress bar and
 * the gate that guards it would disagree.
 */
export function answeredSteps(
  draft: OnboardingDraft | null,
  validators: StepValidators = STEP_VALIDATORS,
): OnboardingStep[] {
  if (!draft) return []

  const answered: OnboardingStep[] = []

  for (const step of ONBOARDING_STEPS) {
    if (step === 'welcome') {
      answered.push(step)
      continue
    }

    const validate = validators[step]
    if (!validate || !validate(draft).valid) break
    answered.push(step)
  }

  return answered
}
