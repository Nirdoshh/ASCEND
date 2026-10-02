/**
 * Daily Step — a single action that moves toward Today's Win.
 *
 * Phase 3D: Daily Steps support explicit completion state.
 *
 * This is NOT:
 * - a score (Phase 3D+)
 * - a streak (Phase 3D+)
 * - a milestone (already exists for Journey)
 * - a generic task (the user decides their steps)
 *
 * The user decides their steps. AI suggestions come later.
 */

export const DAILY_STEP_ID_PREFIX = 'ds_'

/**
 * Daily Step schema version.
 *
 * Bumped when a stored step would be read WRONG by a build other than
 * the one that wrote it. Follows ADR 0011 pattern.
 */
export const DAILY_STEP_SCHEMA_VERSION = 2
export const DAILY_STEP_PREVIOUS_SCHEMA_VERSION = 1

/**
 * Maximum length for Daily Step text.
 *
 * 160 characters is enough for a concise action like:
 * "Fix the onboarding routing bug" (28 chars)
 * "Test the full onboarding flow" (28 chars)
 * "Deploy the verified build" (24 chars)
 * "Put on running clothes after breakfast" (38 chars)
 *
 * 160 provides generous room without encouraging essays.
 */
export const MAX_DAILY_STEP_LENGTH = 160

/**
 * A Daily Step — a single action that moves toward Today's Win.
 *
 * There are 2-4 steps per DailyPlan.
 * Identity is stable: editing preserves the id.
 */
export interface DailyStep {
  readonly schemaVersion: typeof DAILY_STEP_SCHEMA_VERSION
  /** Opaque, stable, never derived from user text. */
  readonly id: string
  /** The user's action in their own words. */
  readonly text: string
  /** ISO timestamp when the user completed the action, or null when open. */
  readonly completedAt: string | null
}

/**
 * Generates an opaque, stable Daily Step id.
 *
 * The prefix 'ds_' keeps it disjoint from other id spaces.
 * The caller (application service) decides when to call this, so tests
 * can assert on identity.
 */
export function createDailyStepId(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return DAILY_STEP_ID_PREFIX + Array.from(bytes).map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16)
}

/**
 * Creates a new Daily Step.
 *
 * Pure function — no persistence, no side effects. The caller decides
 * when to persist.
 */
export function createDailyStep(
  text: string,
  _now: string,
  stepId: string,
): DailyStep {
  return {
    schemaVersion: DAILY_STEP_SCHEMA_VERSION,
    id: stepId,
    text: text.trim(),
    completedAt: null,
  }
}

/**
 * Updates a Daily Step's text.
 *
 * Returns a new Step with updated text, preserving the id.
 */
export function updateDailyStep(
  step: DailyStep,
  text: string,
): DailyStep {
  const normalizedText = text.trim()
  if (step.text === normalizedText) return step
  return {
    ...step,
    text: normalizedText,
  }
}

/** Returns true only when a persisted completion timestamp is present. */
export function isDailyStepCompleted(step: DailyStep): boolean {
  return step.completedAt !== null
}

/** Marks a step complete without changing an existing completion timestamp. */
export function completeDailyStep(step: DailyStep, completedAt: string): DailyStep {
  if (isDailyStepCompleted(step)) return step
  return { ...step, completedAt }
}

/** Clears completion while preserving the step's identity, text, and order. */
export function uncompleteDailyStep(step: DailyStep): DailyStep {
  if (!isDailyStepCompleted(step)) return step
  return { ...step, completedAt: null }
}

/** Completion timestamps must be parseable ISO timestamps. */
export function isValidDailyStepCompletionTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value))
}

/**
 * Deterministically upgrades the Phase 3C array shape to Phase 3D.
 * No IDs, text, or array order are regenerated.
 */
export function migrateDailyStepsV1ToV2(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw

  const isV1 = raw.every((item) => {
    if (typeof item !== 'object' || item === null) return false
    return (item as Record<string, unknown>).schemaVersion === DAILY_STEP_PREVIOUS_SCHEMA_VERSION
  })

  if (!isV1) return raw

  return raw.map((item) => ({
    ...(item as Record<string, unknown>),
    schemaVersion: DAILY_STEP_SCHEMA_VERSION,
    completedAt: null,
  }))
}

/**
 * Validates Daily Step text.
 *
 * Structural validation only. Does not judge whether the Step is
 * philosophically good — the user decides their steps.
 */
export function validateDailyStepText(text: string): { ok: true } | { ok: false; message: string } {
  const trimmed = text.trim()

  if (trimmed === '') {
    return { ok: false, message: 'Type what you\'ll do.' }
  }

  if (trimmed.length > MAX_DAILY_STEP_LENGTH) {
    return {
      ok: false,
      message: `Keep it to ${MAX_DAILY_STEP_LENGTH} characters or fewer.`,
    }
  }

  return { ok: true }
}

/**
 * Normalizes a DailyStep array for storage.
 *
 * Returns null if the data is invalid.
 */
export function normalizeDailySteps(raw: unknown): DailyStep[] | null {
  if (!Array.isArray(raw)) return null

  const steps: DailyStep[] = []
  const seenIds = new Set<string>()
  const seenTexts = new Set<string>()

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null

    const obj = item as Record<string, unknown>

    const schemaVersion = obj.schemaVersion
    if (typeof schemaVersion !== 'number' || schemaVersion !== DAILY_STEP_SCHEMA_VERSION) return null

    const id = typeof obj.id === 'string' && obj.id.startsWith('ds_') ? obj.id : null
    if (!id || seenIds.has(id)) return null
    seenIds.add(id)

    const text = typeof obj.text === 'string' ? obj.text : null
    if (text === null || !validateDailyStepText(text).ok) return null
    const normalizedText = text.trim()
    const duplicateKey = normalizeDailyStepText(normalizedText)
    if (seenTexts.has(duplicateKey)) return null
    seenTexts.add(duplicateKey)

    if (!Object.prototype.hasOwnProperty.call(obj, 'completedAt')) return null
    const completedAt = obj.completedAt
    if (completedAt !== null && !isValidDailyStepCompletionTimestamp(completedAt)) return null

    steps.push({
      schemaVersion: DAILY_STEP_SCHEMA_VERSION,
      id,
      text: normalizedText,
      completedAt,
    })
  }

  return steps
}

/**
 * Checks if a raw stored value declares a schema version newer than this build.
 *
 * Follows ADR 0011: a build that sees a newer schema refuses rather than
 * silently damaging it.
 */
export function hasNewerDailyStepsSchema(raw: unknown): boolean {
  if (!Array.isArray(raw)) return false
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const candidate = (item as Record<string, unknown>).schemaVersion
    if (typeof candidate === 'number' && candidate > DAILY_STEP_SCHEMA_VERSION) return true
  }
  return false
}

/**
 * Normalizes a single DailyStep text for duplicate detection.
 * Uses a strict comparison: trim, lowercase, preserve symbols/emoji.
 */
export function normalizeDailyStepText(text: string): string {
  return text.trim().toLowerCase()
}

/**
 * Daily Steps storage key.
 *
 * Keyed by DailyPlan ID to enforce one list per DailyPlan.
 * Format: ascend:daily-steps:{dailyPlanId}
 */
export function dailyStepsStorageKey(dailyPlanId: string): string {
  return `ascend:daily-steps:${dailyPlanId}`
}

/**
 * Validates a DailyStep list against the step count rules.
 *
 * Returns validation result:
 * - 0 steps: incomplete
 * - 1 step: incomplete
 * 2-4 steps: valid
 * 5+ steps: invalid (too many)
 */
export function validateDailyStepCount(steps: DailyStep[]): { ok: true; message: string; state: 'incomplete' | 'valid' | 'too-many' } | { ok: false; message: string; state: 'incomplete' | 'valid' | 'too-many' } {
  const count = steps.length

  if (count === 0) {
    return { ok: false, message: 'Add at least 2 small actions that move today\'s Win forward.', state: 'incomplete' }
  }
  if (count === 1) {
    return { ok: false, message: 'Add at least one more step to reach the minimum of 2.', state: 'incomplete' }
  }
  if (count <= 4) {
    return { ok: true, message: '', state: 'valid' }
  }
  return { ok: false, message: `Keep it to 4 steps or fewer. You have ${count}.`, state: 'too-many' }
}

/**
 * Checks if a new step text would be a duplicate of an existing step.
 * Uses normalized text comparison (trim + lowercase).
 */
export function isDuplicateDailyStep(steps: DailyStep[], newText: string, excludedStepId?: string): boolean {
  const normalizedNew = normalizeDailyStepText(newText)
  return steps.some(step => step.id !== excludedStepId && normalizeDailyStepText(step.text) === normalizedNew)
}

/**
 * Checks if a step list is at the maximum allowed count (4).
 */
export function isAtMaxDailySteps(steps: DailyStep[]): boolean {
  return steps.length >= 4
}
