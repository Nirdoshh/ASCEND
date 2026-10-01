/**
 * Today's Win — the single meaningful outcome for a day.
 *
 * Phase 3B: One meaningful outcome per day.
 *
 * This is NOT:
 * - a checklist
 * - a streak
 * - a score
 * - a milestone
 * - a generic motivational sentence
 *
 * The user decides their Win. AI suggestions come later.
 */

/**
 * A stable, opaque Today's Win identifier.
 *
 * Prefix 'tw_' keeps it disjoint from Journey ('jr_'), Growth Area ('ga_'),
 * Milestone ('ms_'), Daily Plan ('dp_'), and Onboarding Draft ids.
 */
export const TODAY_WIN_ID_PREFIX = 'tw_'

/**
 * Today's Win schema version.
 *
 * Bumped when a stored Win would be read WRONG by a build other than
 * the one that wrote it. Follows ADR 0011 pattern.
 */
export const TODAY_WIN_SCHEMA_VERSION = 1

/**
 * Maximum length for Today's Win text.
 *
 * 200 characters is enough for a concise meaningful outcome like:
 * "Deploy the authentication flow" (28 chars)
 * "Finish chapter 3 and solve the practice problems" (43 chars)
 * "Call three potential customers and schedule follow-ups" (49 chars)
 *
 * 200 provides generous room without encouraging essays.
 */
export const MAX_TODAY_WIN_LENGTH = 200

/**
 * A Today's Win — the single meaningful outcome for a day.
 *
 * There is exactly ONE Win per DailyPlan.
 * Identity is stable: dailyPlanId + Win id uniquely identifies a Win.
 * Multiple edits preserve the Win id.
 */
export interface TodayWin {
  readonly schemaVersion: typeof TODAY_WIN_SCHEMA_VERSION
  /** Opaque, stable, never derived from user text. */
  readonly id: string
  /** The DailyPlan this Win belongs to. */
  readonly dailyPlanId: string
  /** The user's meaningful outcome in their own words. */
  readonly text: string
  readonly createdAt: string
  readonly updatedAt: string
}

/**
 * Generates an opaque, stable Today's Win id.
 *
 * The prefix 'tw_' keeps it disjoint from other id spaces.
 * The caller (application service) decides when to call this, so tests
 * can assert on identity.
 */
export function createTodayWinId(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return TODAY_WIN_ID_PREFIX + Array.from(bytes).map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16)
}

/**
 * Creates a new Today's Win for the given DailyPlan.
 *
 * Pure function — no persistence, no side effects. The caller decides
 * when to persist.
 */
export function createTodayWin(
  dailyPlanId: string,
  text: string,
  now: string,
  winId: string,
): TodayWin {
  return {
    schemaVersion: TODAY_WIN_SCHEMA_VERSION,
    id: winId,
    dailyPlanId,
    text,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Updates a Today's Win's text.
 *
 * Returns a new Win with updated text and timestamp, preserving the id.
 */
export function updateTodayWin(
  win: TodayWin,
  text: string,
  now: string,
): TodayWin {
  if (win.text === text) return win
  return {
    ...win,
    text,
    updatedAt: now,
  }
}

/**
 * Validates Today's Win text.
 *
 * Structural validation only. Does not judge whether the Win is
 * philosophically good — the user decides their Win.
 */
export function validateTodayWinText(text: string): { ok: true } | { ok: false; message: string } {
  const trimmed = text.trim()

  if (trimmed === '') {
    return { ok: false, message: 'Type what would make today a win.' }
  }

  if (trimmed.length > MAX_TODAY_WIN_LENGTH) {
    return {
      ok: false,
      message: `Keep it to ${MAX_TODAY_WIN_LENGTH} characters or fewer.`,
    }
  }

  return { ok: true }
}

/**
 * Validates a raw stored value is a usable TodayWin.
 *
 * Field-by-field validation, never throws. A corrupted Win returns null.
 * Follows the same pattern as normalizeDailyPlan.
 */
export function normalizeTodayWin(raw: unknown, fallbackNow: string): TodayWin | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null

  const obj = raw as Record<string, unknown>

  const schemaVersion = obj.schemaVersion
  if (typeof schemaVersion !== 'number' || schemaVersion !== TODAY_WIN_SCHEMA_VERSION) return null

  const id = typeof obj.id === 'string' && obj.id.startsWith(TODAY_WIN_ID_PREFIX) ? obj.id : null
  if (!id) return null

  const dailyPlanId = typeof obj.dailyPlanId === 'string' && obj.dailyPlanId.startsWith('dp_') ? obj.dailyPlanId : null
  if (!dailyPlanId) return null

  const text = typeof obj.text === 'string' ? obj.text : null
  if (!text) return null

  const createdAt = typeof obj.createdAt === 'string' && !Number.isNaN(Date.parse(obj.createdAt))
    ? obj.createdAt
    : fallbackNow

  const updatedAt = typeof obj.updatedAt === 'string' && !Number.isNaN(Date.parse(obj.updatedAt))
    ? obj.updatedAt
    : fallbackNow

  return {
    schemaVersion: TODAY_WIN_SCHEMA_VERSION,
    id,
    dailyPlanId,
    text,
    createdAt,
    updatedAt,
  }
}

/**
 * Checks if a raw stored value declares a schema version newer than this build.
 *
 * Follows ADR 0011: a build that sees a newer schema refuses rather than
 * silently damaging it.
 */
export function hasNewerTodayWinSchema(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false
  const candidate = (raw as Record<string, unknown>).schemaVersion
  return typeof candidate === 'number' && candidate > TODAY_WIN_SCHEMA_VERSION
}

/**
 * Today's Win storage key.
 *
 * Keyed by DailyPlan ID to enforce one Win per DailyPlan.
 * Format: ascend:today-win:{dailyPlanId}
 */
export function todayWinStorageKey(dailyPlanId: string): string {
  return `ascend:today-win:${dailyPlanId}`
}