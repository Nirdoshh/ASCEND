/**
 * The real Journey — the durable record that survives onboarding.
 *
 * A Journey is created ONCE, when the user explicitly presses "Start Day 1"
 * on the Summary screen. Until then, only the OnboardingDraft exists.
 *
 * V1 supports exactly ONE active Journey. The repository enforces this.
 */

import { MAX_GROWTH_AREA_NAME_LENGTH } from './growthAreas'
import type { PersonalAnswer } from './personalAnswer'
import type { DraftMilestone } from './milestone'
import type { DraftGrowthArea } from './onboardingDraft'

/**
 * A Growth Area as stored inside a Journey.
 *
 * Only the fields needed to operate after the draft is gone.
 * The id is the SAME id created during onboarding — never re-minted.
 */
export interface JourneyGrowthArea {
  readonly id: string
  readonly name: string
  readonly normalizedName: string
}

/**
 * A milestone as stored inside a Journey.
 *
 * The id is the SAME id created during onboarding — never re-minted.
 * Order is the order the user added them in.
 */
export interface JourneyMilestone {
  readonly id: string
  readonly text: string
}

/**
 * The persisted Journey record.
 *
 * schemaVersion: versioned from day one. ADR 0011's lessons apply immediately.
 * status: 'active' for V1. Future phases may add 'completed', 'archived'.
 * startedAt: when the user pressed "Start Day 1" (ISO string).
 * createdAt: when the Journey record was first written (same as startedAt for V1).
 * updatedAt: last modification (same as createdAt for V1).
 */
export interface Journey {
  readonly schemaVersion: typeof JOURNEY_SCHEMA_VERSION
  /** Opaque, stable, never derived from user text. */
  readonly id: string
  readonly status: 'active'
  /** Growth Areas the user chose, with their onboarding ids preserved. */
  readonly growthAreas: readonly JourneyGrowthArea[]
  /** The user's goal in their own words. */
  readonly goal: PersonalAnswer
  /** The user's why in their own words. */
  readonly why: PersonalAnswer
  /** Duration in whole days. */
  readonly durationDays: number
  /** Milestones in the order they were added, ids preserved. */
  readonly milestones: readonly JourneyMilestone[]
  /** Daily effort in minutes. */
  readonly dailyEffortMinutes: number
  readonly startedAt: string
  readonly createdAt: string
  readonly updatedAt: string
}

/**
 * Journey schema version.
 *
 * Bumped when a stored Journey would be read WRONG by a build other than
 * the one that wrote it. See onboardingDraftRepository.ts for the pattern
 * this follows — migrations, version guards, and the rule that a build
 * refuses rather than rewrites a newer schema.
 */
export const JOURNEY_SCHEMA_VERSION = 1

/**
 * Creates a Journey from a fully valid OnboardingDraft.
 *
 * This is a PURE FUNCTION — no persistence, no side effects. The caller
 * decides when to persist. Every field is copied verbatim from the draft;
 * no transformation, no defaults, no re-minting of ids.
 */
export function createJourneyFromDraft(
  draft: {
    readonly selectedGrowthAreaIds: readonly string[]
    readonly customGrowthAreas: readonly DraftGrowthArea[]
    readonly goal: PersonalAnswer
    readonly why: PersonalAnswer
    readonly durationDays: number
    readonly milestones: readonly DraftMilestone[]
    readonly dailyEffortMinutes: number
  },
  knownAreas: readonly { readonly id: string; readonly name: string; readonly normalizedName: string }[],
  now: string,
  journeyId: string,
): Journey {
  const growthAreas = knownAreas
    .filter((area) => draft.selectedGrowthAreaIds.includes(area.id))
    .map((area) => ({
      id: area.id,
      name: area.name,
      normalizedName: area.normalizedName,
    }))

  return {
    schemaVersion: JOURNEY_SCHEMA_VERSION,
    id: journeyId,
    status: 'active',
    growthAreas,
    goal: draft.goal,
    why: draft.why,
    durationDays: draft.durationDays,
    milestones: draft.milestones.map((m) => ({ id: m.id, text: m.text })),
    dailyEffortMinutes: draft.dailyEffortMinutes,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Generates an opaque, stable Journey id.
 *
 * The prefix 'jr_' keeps it disjoint from Growth Area ('ga_') and Milestone ('ms_') ids.
 * The caller (application service) decides when to call this, so tests can assert on identity.
 */
export function createJourneyId(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return 'jr_' + Array.from(bytes).map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16)
}

/**
 * Validates that a value is a usable JourneyGrowthArea.
 */
export function normalizeJourneyGrowthArea(value: unknown): JourneyGrowthArea | null {
  if (typeof value !== 'object' || value === null) return null

  const obj = value as Record<string, unknown>
  const name = String(obj.name ?? '').trim()
  if (name === '' || name.length > MAX_GROWTH_AREA_NAME_LENGTH) return null

  const normalizedName = name.toLowerCase()
  const id = typeof obj.id === 'string' && obj.id.trim() !== '' ? obj.id.trim() : ''

  return { id, name, normalizedName }
}

/**
 * Validates that a value is a usable JourneyMilestone.
 */
export function normalizeJourneyMilestone(value: unknown): JourneyMilestone | null {
  if (typeof value !== 'object' || value === null) return null

  const obj = value as Record<string, unknown>
  const text = String(obj.text ?? '').trim()
  if (text === '') return null

  const id = typeof obj.id === 'string' && obj.id.trim() !== '' ? obj.id.trim() : ''

  return { id, text }
}

/**
 * Reads a raw stored value into a Journey, or null if unusable.
 *
 * Field-by-field validation, same pattern as onboardingDraftRepository.ts.
 * Never throws. A corrupted Journey returns null, which the repository
 * treats as "no Journey" — the user starts fresh rather than seeing garbage.
 */
export function normalizeJourney(raw: unknown, fallbackNow: string): Journey | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null

  const obj = raw as Record<string, unknown>

  const schemaVersion = obj.schemaVersion
  if (typeof schemaVersion !== 'number' || schemaVersion !== JOURNEY_SCHEMA_VERSION) return null

  const id = typeof obj.id === 'string' && obj.id.startsWith('jr_') ? obj.id : null
  if (!id) return null

  const status = obj.status
  if (status !== 'active') return null

  const growthAreasRaw = Array.isArray(obj.growthAreas) ? obj.growthAreas : []
  const growthAreas: JourneyGrowthArea[] = []
  const seenAreaIds = new Set<string>()
  for (const entry of growthAreasRaw) {
    const area = normalizeJourneyGrowthArea(entry)
    if (!area || seenAreaIds.has(area.id)) continue
    seenAreaIds.add(area.id)
    growthAreas.push(area)
  }

  const goal = obj.goal
  if (!goal || typeof goal !== 'object' || typeof (goal as Record<string, unknown>).text !== 'string') return null
  const goalText = String((goal as Record<string, unknown>).text).trim()
  if (goalText === '') return null

  const why = obj.why
  if (!why || typeof why !== 'object' || typeof (why as Record<string, unknown>).text !== 'string') return null
  const whyText = String((why as Record<string, unknown>).text).trim()
  if (whyText === '') return null

  const durationDays = typeof obj.durationDays === 'number' && Number.isInteger(obj.durationDays) && obj.durationDays > 0
    ? obj.durationDays
    : null
  if (durationDays === null) return null

  const milestonesRaw = Array.isArray(obj.milestones) ? obj.milestones : []
  const milestones: JourneyMilestone[] = []
  const seenMilestoneIds = new Set<string>()
  for (const entry of milestonesRaw) {
    const milestone = normalizeJourneyMilestone(entry)
    if (!milestone || seenMilestoneIds.has(milestone.id)) continue
    seenMilestoneIds.add(milestone.id)
    milestones.push(milestone)
  }

  const dailyEffortMinutes = typeof obj.dailyEffortMinutes === 'number' && Number.isInteger(obj.dailyEffortMinutes) && obj.dailyEffortMinutes > 0
    ? obj.dailyEffortMinutes
    : null
  if (dailyEffortMinutes === null) return null

  const startedAt = typeof obj.startedAt === 'string' && !Number.isNaN(Date.parse(obj.startedAt))
    ? obj.startedAt
    : fallbackNow

  const createdAt = typeof obj.createdAt === 'string' && !Number.isNaN(Date.parse(obj.createdAt))
    ? obj.createdAt
    : fallbackNow

  const updatedAt = typeof obj.updatedAt === 'string' && !Number.isNaN(Date.parse(obj.updatedAt))
    ? obj.updatedAt
    : fallbackNow

  return {
    schemaVersion: JOURNEY_SCHEMA_VERSION,
    id,
    status: 'active',
    growthAreas,
    goal: { text: goalText },
    why: { text: whyText },
    durationDays,
    milestones,
    dailyEffortMinutes,
    startedAt,
    createdAt,
    updatedAt,
  }
}

/**
 * Checks if a raw stored value declares a schema version newer than this build.
 */
export function hasNewerJourneySchema(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false
  const candidate = (raw as Record<string, unknown>).schemaVersion
  return typeof candidate === 'number' && candidate > JOURNEY_SCHEMA_VERSION
}