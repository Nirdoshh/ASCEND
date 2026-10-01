/**
 * Daily Plan — the container for a single day's meaningful work.
 *
 * Phase 3A establishes the DAILY PLAN CONTAINER only.
 *
 * It does NOT contain:
 *   - Today's Win (Phase 3B)
 *   - Daily Steps (Phase 3B)
 *   - Completion state (Phase 3B)
 *   - Growth Points (Phase 3C)
 *   - Streaks (Phase 3C)
 *   - Reflections (Phase 3C)
 *   - AI-generated content (Phase 3D+)
 *
 * A DailyPlan exists when the user opens ASCEND on a given calendar day.
 * It is created once per (journeyId, localDate) pair.
 *
 * Identity is stable: journeyId + localDate uniquely identifies a plan.
 * Multiple calls to getOrCreateTodayPlan for the same journey/day
 * MUST return the same plan.
 */

import type { LocalDate } from './localDate'

export type { LocalDate }

/**
 * A stable, opaque DailyPlan identifier.
 *
 * Prefix 'dp_' keeps it disjoint from Journey ('jr_'), Growth Area ('ga_'),
 * Milestone ('ms_'), and Onboarding Draft ids.
 */
export const DAILY_PLAN_ID_PREFIX = 'dp_'

/**
 * Daily Plan schema version.
 *
 * Bumped when a stored plan would be read WRONG by a build other than
 * the one that wrote it. Follows ADR 0011 pattern from Journey.
 */
export const DAILY_PLAN_SCHEMA_VERSION = 1

/**
 * The persisted DailyPlan record.
 *
 * Minimal V1 shape: only the container fields. No win, no steps, no points.
 */
export interface DailyPlan {
  readonly schemaVersion: typeof DAILY_PLAN_SCHEMA_VERSION
  /** Opaque, stable, never derived from user text. */
  readonly id: string
  /** The Journey this plan belongs to. */
  readonly journeyId: string
  /** The calendar day this plan is for, in YYYY-MM-DD format (user's local timezone). */
  readonly localDate: LocalDate
  readonly createdAt: string
  readonly updatedAt: string
}

/**
 * Generates an opaque, stable DailyPlan id.
 *
 * The caller (application service) decides when to call this, so tests
 * can assert on identity.
 */
export function createDailyPlanId(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return DAILY_PLAN_ID_PREFIX + Array.from(bytes).map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16)
}

/**
 * Creates a new DailyPlan for the given journey and date.
 *
 * Pure function — no persistence, no side effects. The caller decides
 * when to persist.
 */
export function createDailyPlan(
  journeyId: string,
  localDate: LocalDate,
  now: string,
  planId: string,
): DailyPlan {
  return {
    schemaVersion: DAILY_PLAN_SCHEMA_VERSION,
    id: planId,
    journeyId,
    localDate,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Validates that a raw stored value is a usable DailyPlan.
 *
 * Field-by-field validation, never throws. A corrupted plan returns null.
 * Follows the same pattern as normalizeJourney.
 */
export function normalizeDailyPlan(raw: unknown, fallbackNow: string): DailyPlan | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null

  const obj = raw as Record<string, unknown>

  const schemaVersion = obj.schemaVersion
  if (typeof schemaVersion !== 'number' || schemaVersion !== DAILY_PLAN_SCHEMA_VERSION) return null

  const id = typeof obj.id === 'string' && obj.id.startsWith(DAILY_PLAN_ID_PREFIX) ? obj.id : null
  if (!id) return null

  const journeyId = typeof obj.journeyId === 'string' && obj.journeyId.startsWith('jr_') ? obj.journeyId : null
  if (!journeyId) return null

  const localDate = obj.localDate
  if (typeof localDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return null
  // Validate it's a real date
  const parsed = new Date(`${localDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null

  const createdAt = typeof obj.createdAt === 'string' && !Number.isNaN(Date.parse(obj.createdAt))
    ? obj.createdAt
    : fallbackNow

  const updatedAt = typeof obj.updatedAt === 'string' && !Number.isNaN(Date.parse(obj.updatedAt))
    ? obj.updatedAt
    : fallbackNow

  return {
    schemaVersion: DAILY_PLAN_SCHEMA_VERSION,
    id,
    journeyId,
    localDate,
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
export function hasNewerDailyPlanSchema(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false
  const candidate = (raw as Record<string, unknown>).schemaVersion
  return typeof candidate === 'number' && candidate > DAILY_PLAN_SCHEMA_VERSION
}

/**
 * DailyPlan storage key.
 *
 * Each plan is stored under a composite key: journeyId + localDate.
 * Format: ascend:daily-plan:<journeyId>:<localDate>
 *
 * This allows O(1) lookup and naturally enforces one plan per journey per day.
 */
export function dailyPlanStorageKey(journeyId: string, localDate: LocalDate): string {
  return `ascend:daily-plan:${journeyId}:${localDate}`
}