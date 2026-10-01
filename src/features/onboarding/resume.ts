import { ONBOARDING_STEPS, resumeStep } from '../../domain/onboardingDraft'
import type { OnboardingDraft, OnboardingStep } from '../../domain/onboardingDraft'
import { answeredSteps } from '../../domain/onboardingValidation'

/**
 * Where a returning user is put back.
 *
 * `resumeStep` in the domain says what step the draft was left on. That is
 * necessary and not sufficient, and the gap between the two is where this
 * file lives.
 *
 * THE PROBLEM
 *
 * Two independent things can be true at once, and both have to be
 * respected:
 *
 *   the build   Phase 2C left `summary` without a screen. A stored
 *               `currentStep: 'daily-effort'` — which is exactly what
 *               pressing Continue on the milestones screen writes — had no
 *               URL beyond the effort screen to send anybody to. Following
 *               it would land on a 404 immediately after a successful-looking
 *               answer, which is about the worst outcome this app could
 *               produce.
 *
 *               Phase 2C removed `duration`, `milestones` and `daily-effort`
 *               from this list by building their screens. Phase 2D builds the
 *               Summary screen, so `summary` is no longer a dead end.
 *
 *   the data    `currentStep` says where someone was, not whether what
 *               they left there is usable. A draft can sit on `why` with a
 *               WHY and no Goal, and resuming at `why` would put them on a
 *               screen they cannot get past, with no explanation.
 *
 * THE RULE
 *
 *   Resume at the EARLIER of two steps, then clamp the result to the last
 *   step this build can actually show.
 *
 *     the first step whose own validator is not satisfied
 *     the step the draft was left on
 *
 * `answeredSteps` already stops at the first gap rather than counting
 * scattered successes, so "the first step not satisfied" is simply the one
 * just past the end of what it returns. Reusing it means a progress
 * indicator and the resume target come from the same function and cannot
 * disagree — which is the property that matters, because a bar that says
 * three of four while resume drops someone on step two is a lie the user
 * cannot see.
 *
 * Taking the earlier of the two is what enforces "do not silently advance
 * because a field merely exists": presence is not validity, and validity
 * is what holds the door. The converse falls out of the same rule — a user
 * who chose a Growth Area and never pressed Continue is sent back to the
 * chips rather than skipped past them, even though their answer is
 * perfectly good. Nothing is lost either way, and being asked to confirm
 * something you just did is a smaller cost than being moved forward
 * without being asked.
 *
 * Neither of the two steps is ever `welcome`, and that needs a rule rather
 * than an assumption. `begin()` records the move off it, so a draft made
 * by THIS build is always somewhere real — but a draft written by Phase
 * 2A's `begin()`, which did not record it, can still say `welcome` while
 * holding a perfectly good answer. Trusting that pointer would mean the
 * Continue button on the welcome screen navigates to the welcome screen,
 * which is a dead button on the one screen whose whole job is a button.
 *
 * So: when the draft is only recorded as being on `welcome`, the first
 * unanswered step wins instead. Somebody upgrading mid-onboarding lands on
 * their next question with their Growth Areas intact, which is the
 * generous reading of a stale pointer.
 *
 * WHY THIS IS NOT IN domain/
 *
 * Because "which steps have screens" is a fact about the build, not about
 * the data. Putting it in the domain would mean editing a domain file every
 * time a phase adds a screen, and a domain that knows about URLs is a
 * domain that can no longer be tested without a router.
 */

/** The steps this build can show, in order. Grows one entry per phase. */
const BUILT_STEPS = [
  'welcome',
  'growth-areas',
  'goal',
  'why',
  'duration',
  'milestones',
  'daily-effort',
  'summary',
] as const

/** A step that has a screen, and therefore a URL. */
export type BuiltStep = (typeof BUILT_STEPS)[number]

/**
 * Step to URL.
 *
 * Duplicated from `app/routes.tsx`, which needs relative child paths for
 * the router and cannot import this without creating a cycle. Two places to
 * update when a step is added — mitigated by the route smoke test in
 * `app/routes.test.tsx`, which cold-loads every URL through the real
 * router, so a forgotten route fails a test rather than a person.
 *
 * The mapping is NOT derived from the step name, and `daily-effort` is the
 * proof: its URL is `/onboarding/effort`. A derivation would have produced
 * `/onboarding/daily-effort`, which is a worse URL in a person's address
 * bar, and renaming a STEP to fix that would change the stored
 * `currentStep` of every draft already on disk. Keeping the mapping
 * explicit is what lets the URL and the stored value disagree on purpose.
 */
const STEP_PATHS: Record<BuiltStep, string> = {
  welcome: '/onboarding',
  'growth-areas': '/onboarding/areas',
  goal: '/onboarding/goal',
  why: '/onboarding/why',
  duration: '/onboarding/duration',
  milestones: '/onboarding/milestones',
  'daily-effort': '/onboarding/effort',
  summary: '/onboarding/summary',
}

/**
 * The last step this build can show.
 *
 * The fallback is unreachable — `BUILT_STEPS` is never empty and never
 * will be, since the welcome screen is step 0 of onboarding itself — and
 * exists only because `noUncheckedIndexedAccess` cannot see that through a
 * computed index. `welcome` is the right value for it, not a placeholder.
 */
export const LAST_BUILT_STEP: BuiltStep = BUILT_STEPS.at(-1) ?? BUILT_STEPS[0]

/** The step a returning user should be sent to, whatever URL they arrived on. */
export function resumeStepInBuild(draft: OnboardingDraft | null): BuiltStep {
  if (!draft) return 'welcome'

  // The first step the draft has NOT validly answered. `answeredSteps`
  // returns the satisfied prefix, so the step just past its end is the
  // first gap. Falling off the end means every built step is satisfied,
  // and there is nowhere further to go in this build regardless.
  const firstUnsatisfied: BuiltStep = clampToBuilt(
    ONBOARDING_STEPS[answeredSteps(draft).length] ?? LAST_BUILT_STEP,
  )

  const reached: BuiltStep = clampToBuilt(resumeStep(draft))

  // See the note above: `welcome` is never a destination.
  if (reached === 'welcome') return firstUnsatisfied

  return earlierOf(firstUnsatisfied, reached)
}

/** The URL a returning user should be sent to. */
export function resumePath(draft: OnboardingDraft | null): string {
  return STEP_PATHS[resumeStepInBuild(draft)]
}

/**
 * True once the draft holds at least one real answer.
 *
 * A separate question from the destination, and deliberately so. Someone
 * who pressed the first button and then closed the tab has a draft and has
 * answered nothing: "Continue where you left off" would be a lie for them,
 * and so would anything implying there is something to go back to.
 *
 * Derived from `answeredSteps` rather than from `draft !== null` or from
 * `currentStep`, so the button's wording is computed from exactly the same
 * validity data as the route it is about to take.
 */
export function hasStartedOnboarding(draft: OnboardingDraft | null): boolean {
  // `welcome` is index 0 and is always counted, so "> 1" means "at least
  // one real question has been satisfied".
  return answeredSteps(draft).length > 1
}

function earlierOf(a: BuiltStep, b: BuiltStep): BuiltStep {
  return ONBOARDING_STEPS.indexOf(a) <= ONBOARDING_STEPS.indexOf(b) ? a : b
}

/** The furthest built step at or before `step`. */
function clampToBuilt(step: OnboardingStep): BuiltStep {
  const target = ONBOARDING_STEPS.indexOf(step)
  let furthest: BuiltStep = BUILT_STEPS[0]

  for (const candidate of BUILT_STEPS) {
    if (ONBOARDING_STEPS.indexOf(candidate) <= target) furthest = candidate
  }

  return furthest
}
