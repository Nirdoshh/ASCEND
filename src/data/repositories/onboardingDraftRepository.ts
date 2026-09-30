/**
 * Onboarding draft repository.
 *
 * Follows the same shape as `preferencesRepository` on purpose: read a
 * raw `unknown`, migrate it, validate it field by field, and never
 * throw. The difference is the one that matters for this data:
 *
 *   `load()` returns null when there is nothing usable.
 *
 * Preferences have a sensible default, so "absent" and "corrupt" are the
 * same thing and it does not matter. A draft does not: null means "this
 * user has never started", which is genuinely different information from
 * "this user's draft was unreadable", and the two lead to different
 * screens. Collapsing them would either lose progress silently or show a
 * welcome screen to someone who had already answered three questions.
 *
 * This file is also the Phase 11 swap point: when persistence moves to
 * the Worker + D1, this interface stays identical and only the factory
 * below changes.
 */

import {
  normalizeCustomGrowthArea,
  ONBOARDING_SCHEMA_VERSION,
  ONBOARDING_STEPS,
  reconcileSelections,
  type CustomGrowthArea,
  type OnboardingDraft,
  type OnboardingStep,
} from '../../domain/onboardingDraft'
import { ASCEND_ONBOARDING_DRAFT_KEY } from '../storage/keys'
import type { KeyValueStore, StoreWriteResult } from '../storage/webStorageStore'

export interface OnboardingDraftRepository {
  /** The draft, or null when there is none or none can be trusted. */
  load(): OnboardingDraft | null
  save(draft: OnboardingDraft): StoreWriteResult
  /** Called once a real Journey exists; onboarding data is then obsolete. */
  clear(): void
  isAvailable(): boolean
}

/**
 * Upgrades an older draft to the current shape.
 *
 * Empty at v1 because there is no v0. The mechanism exists now so that
 * when v2 arrives, real user drafts can be upgraded instead of thrown
 * away — and throwing away a user's typing is the worst thing this app
 * could do.
 *
 *   { 1: (value) => ({ ...value, customGrowthAreas: [] }) }
 */
export const ONBOARDING_DRAFT_MIGRATIONS: Record<number, (value: unknown) => unknown> = {}

export function createOnboardingDraftRepository(
  store: KeyValueStore,
): OnboardingDraftRepository {
  return {
    load(): OnboardingDraft | null {
      const raw = store.read(ASCEND_ONBOARDING_DRAFT_KEY)
      return migrateAndNormalizeDraft(raw, nowIso())
    },

    save(draft: OnboardingDraft): StoreWriteResult {
      return store.write(ASCEND_ONBOARDING_DRAFT_KEY, draft)
    },

    clear(): void {
      store.remove(ASCEND_ONBOARDING_DRAFT_KEY)
    },

    isAvailable: () => store.isAvailable(),
  }
}

/**
 * Turns anything at all into a valid draft, or null.
 *
 * Exported and pure so every branch is directly testable. Four things
 * can arrive here:
 *   - null                     nothing stored
 *   - a current object         normal load
 *   - an older version         migration path
 *   - corrupt or hand-edited   discarded
 *
 * and one that must never be trusted blindly:
 *   - a FUTURE version, meaning this build is older than the data. We
 *     keep the fields we understand and default the rest, because
 *     dropping the whole draft would delete answers the user gave to a
 *     newer version of the app.
 */
export function migrateAndNormalizeDraft(
  raw: unknown,
  now: string = nowIso(),
  currentVersion: number = ONBOARDING_SCHEMA_VERSION,
  migrations: Record<number, (value: unknown) => unknown> = ONBOARDING_DRAFT_MIGRATIONS,
): OnboardingDraft | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null
  }

  let value: object = raw
  const startVersion = readSchemaVersion(value)

  if (startVersion > currentVersion) {
    return normalizeFields(value, now)
  }

  for (let version = startVersion; version < currentVersion; version += 1) {
    const migrate = migrations[version]
    if (!migrate) {
      // We cannot reconstruct this version, and a half-understood draft
      // is worse than none: starting over is recoverable, silently
      // showing wrong answers is not.
      return null
    }
    value = migrate(value) as object
  }

  return normalizeFields(value, now)
}

function readSchemaVersion(value: object): number {
  const candidate = (value as { schemaVersion?: unknown }).schemaVersion
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : 0
}

/**
 * Field-by-field validation, then reconciliation.
 *
 * Each field is checked on its own so one bad value cannot discard good
 * ones. The order matters at the end: custom areas are repaired FIRST,
 * because reconciliation can only recognise a selection once it knows
 * which areas exist.
 */
function normalizeFields(value: object, now: string): OnboardingDraft {
  const candidate = value as Record<string, unknown>

  const currentStep = normalizeStep(candidate.currentStep)
  const customGrowthAreas = normalizeCustomAreas(candidate.customGrowthAreas)

  const draft: OnboardingDraft = {
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    currentStep,
    selectedGrowthAreas: normalizeSelections(candidate.selectedGrowthAreas),
    customGrowthAreas,
    startedAt: normalizeTimestamp(candidate.startedAt, now),
    updatedAt: normalizeTimestamp(candidate.updatedAt, now),
  }

  // Drop selections pointing at areas that no longer exist. Without
  // this, a draft from a future build could show "you chose Extimism"
  // next to a list that cannot display it.
  return reconcileSelections(draft)
}

function normalizeStep(value: unknown): OnboardingStep {
  return typeof value === 'string' && (ONBOARDING_STEPS as readonly string[]).includes(value)
    ? (value as OnboardingStep)
    : 'welcome'
}

function normalizeSelections(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const kept: string[] = []

  for (const entry of value) {
    // Order is the order the user chose in, so duplicates are dropped
    // rather than sorted or re-ordered.
    if (typeof entry !== 'string' || entry === '' || seen.has(entry)) continue
    seen.add(entry)
    kept.push(entry)
  }

  return kept
}

function normalizeCustomAreas(value: unknown): CustomGrowthArea[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const kept: CustomGrowthArea[] = []

  for (const entry of value) {
    const area = normalizeCustomGrowthArea(entry)
    // First one wins, which preserves the capitalization the user
    // originally typed if the same area was somehow stored twice.
    if (!area || seen.has(area.id)) continue
    seen.add(area.id)
    kept.push(area)
  }

  return kept
}

/**
 * Accepts an ISO timestamp, or falls back to now.
 *
 * An unreadable timestamp must not discard a draft that contains real
 * answers. Falling back to `now` is honest — "we do not know when" —
 * where defaulting the whole draft would not be.
 */
function normalizeTimestamp(value: unknown, fallback: string): string {
  return typeof value === 'string' && value !== '' && !Number.isNaN(Date.parse(value))
    ? value
    : fallback
}

function nowIso(): string {
  return new Date().toISOString()
}