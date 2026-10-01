/**
 * A personal text answer: the Goal and the WHY.
 *
 * Split out from onboardingDraft.ts for the same reason growthAreaName.ts
 * exists: the RULES for a piece of user text are a separate job from
 * storing it, they change for different reasons, and mixing them is how
 * "we tidied up the user's sentence without asking" happens.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE
 *
 *   An answer is either a real sentence or it is ABSENT. There is no third
 *   state.
 *
 * `goal: ''` claims the user answered with nothing. That is a different,
 * and false, statement from "has not been asked yet" — and it is exactly
 * the shape that lets a screen invent a default, pass a step it should
 * fail, or display a blank box as though the person had chosen blank. So
 * `toPersonalAnswer` is the only way to build one, and it returns null for
 * a blank string. `goal: { text: '' }` is not merely discouraged; it is
 * unrepresentable.
 *
 * WHY THE TWO LENGTHS DIFFER
 *
 * A Goal is one outcome: "Run my first 10K", "Play three songs on the
 * piano". 300 characters is roughly fifty words, which is already longer
 * than a useful goal, and a limit the user can never see through is a
 * limit that only ever surprises them.
 *
 * The WHY is the thing ASCEND will read back to someone on a bad day. It
 * is the one answer people genuinely try to say properly, and it is
 * usually about more than one thing — why they started, who they are
 * doing it for, what they are afraid of staying. 500 characters buys that
 * without becoming a place to write an essay.
 *
 * Both are bounds on storage and on what later screens have to render.
 * Neither is a judgement about what somebody wanted to say.
 *
 * WHY `trim()` AND NOTHING ELSE
 *
 * Compare `toGrowthAreaDisplayName`, which also collapses runs of
 * internal whitespace. That is right for a NAME, which is a label that has
 * to line up with a chip grid. It is wrong here, and the difference is the
 * whole point of this file.
 *
 * A Goal is a sentence. Two spaces after a full stop, a line break
 * someone typed on purpose, a capital letter in the middle — those are
 * how the person wrote it, and removing them is rewriting their words
 * without asking. Only the whitespace at the two ends goes, because a
 * trailing space from a phone keyboard is never part of the answer and
 * would otherwise count against the length limit.
 */

export interface PersonalAnswer {
  /** Trimmed at both ends. Never empty — see `toPersonalAnswer`. */
  readonly text: string
}

/** Longest accepted Goal, in characters. See the note above. */
export const MAX_GOAL_LENGTH = 300

/** Longest accepted WHY, in characters. See the note above. */
export const MAX_WHY_LENGTH = 500

/**
 * The only constructor.
 *
 * Returns null for anything that is not a real sentence, so "unanswered"
 * has exactly one representation in this codebase and no screen has to
 * invent a second.
 */
export function toPersonalAnswer(raw: string): PersonalAnswer | null {
  const text = raw.trim()
  return text === '' ? null : { text }
}

/** The stored text, or '' for an unanswered question. */
export function personalAnswerText(answer: PersonalAnswer | undefined): string {
  return answer?.text ?? ''
}

/**
 * Rebuilds an answer from stored data that cannot be trusted.
 *
 * Two shapes are accepted, and the reason for the second one is the same
 * as everywhere else in this codebase: refusing to understand something
 * silently deletes what a person wrote.
 *
 *   { text: "..." }   this build's shape
 *   "..."             a bare string, which is what a draft from a version
 *                     of ASCEND that stored a plain string would hold
 *
 * Everything else — a number, an array, `{}`, `{ text: 42 }`, null — is
 * dropped, because those are corruption rather than an older format.
 *
 * NOT applied here: the maximum length. Truncating would be a silent
 * rewrite and clamping would be a lie about what was stored. An answer
 * that is too long stays too long, and `isGoalStepValid` refuses the step
 * so the person gets to fix it themselves.
 */
export function normalizePersonalAnswer(value: unknown): PersonalAnswer | null {
  const text = readText(value)
  return text === undefined ? null : toPersonalAnswer(text)
}

function readText(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined

  const candidate = (value as { text?: unknown }).text
  return typeof candidate === 'string' ? candidate : undefined
}
