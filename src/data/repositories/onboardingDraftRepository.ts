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

import { SUGGESTED_GROWTH_AREAS } from '../../domain/growthAreas'
import {
  CUSTOM_ID_PREFIX,
  MIGRATED_ID_PREFIX,
  migratedGrowthAreaSuffix,
  SUGGESTED_ID_PREFIX,
  suggestedGrowthAreaId,
} from '../../domain/growthAreaId'
import { normalizeGrowthAreaName, toGrowthAreaDisplayName } from '../../domain/growthAreaName'
import {
  normalizeDraftGrowthArea,
  ONBOARDING_SCHEMA_VERSION,
  ONBOARDING_STEPS,
  reconcileSelections,
  type DraftGrowthArea,
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
 *
 * Keyed by the version being upgraded FROM, and applied in order, so a
 * v1 draft reaching a v4 build walks 1 -> 2 -> 3 -> 4. Registering the
 * mechanism while there are only two versions is what makes it possible to
 * change the stored shape later without throwing away what a user typed —
 * and throwing away a user's typing is the worst thing this app could do.
 */
export const ONBOARDING_DRAFT_MIGRATIONS: Record<number, (value: unknown) => unknown> = {
  1: migrateDraftV1ToV2,
  2: migrateDraftV2ToV3,
}

/**
 * v1 -> v2: normalized names stop being identities.
 *
 * Phase 2A stored `selectedGrowthAreas` as normalized names and used the
 * normalized name as a custom area's id. Both are replaced here by real
 * ids, and every v1 selection is translated through the same lookup, so
 * a draft keeps exactly the choices it had.
 *
 * Deterministic on purpose. A custom area's new id is hashed from the
 * name it used to BE rather than generated fresh, so migrating the same
 * draft twice always yields the same ids. If ids were random here, every
 * page load would re-mint identities and a user's selection would appear
 * to vanish each time they came back.
 *
 * A v1 selection that matches no suggestion and no custom area is
 * dropped. That is a repair rather than data loss: in v1 such a name
 * resolved to nothing, so the UI was already showing it as unselected.
 * The string cannot be honoured because there is no area behind it, and
 * keeping it would mean claiming a choice the screen cannot display.
 *
 * The ids produced here carry the v2 shape (`ga_` + suffix) even though the
 * namespace prefixes only arrive in v3. That is deliberate: a migration must
 * write the shape its own version defined, or the intermediate state does not
 * exist and there is nothing to test `migrateDraftV2ToV3` against. It also
 * keeps this step free of judgement — v2 -> v3 is then a pure, mechanical
 * re-prefix with nothing to decide, which is much easier to reason about when
 * something goes wrong.
 */
export function migrateDraftV1ToV2(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value

  const v1 = value as Record<string, unknown>

  const customGrowthAreas = toArray(v1.customGrowthAreas)
    .map(migrateV1CustomArea)
    .filter((area): area is DraftGrowthArea => area !== null)

  // The order here is load-bearing. Custom areas go in first and the
  // suggestions overwrite them, so a v1 draft that recorded a custom
  // "fitness" resolves its selection to the suggestion. In Phase 2A those
  // two shared one identity and were therefore already the same area;
  // mapping the selection to the custom's new id instead would produce a
  // selection that mergeGrowthAreas then hides as a duplicate — the user
  // would silently lose their choice.
  //
  // Suggestions are matched on normalizedName and re-emitted in the v2 shape,
  // not read straight off the current table. Reading the table would make
  // this migration emit v3 ids for v2 data, which is the bug that made the
  // intermediate state untestable in the first place.
  const idByNormalizedName = new Map<string, string>()
  for (const area of customGrowthAreas) {
    idByNormalizedName.set(area.normalizedName, area.id)
  }
  for (const area of SUGGESTED_GROWTH_AREAS) {
    const slug = area.id.slice(SUGGESTED_ID_PREFIX.length)
    idByNormalizedName.set(area.normalizedName, V2_ID_PREFIX + slug)
  }

  const selectedGrowthAreaIds: string[] = []
  const seen = new Set<string>()

  for (const entry of toArray(v1.selectedGrowthAreas)) {
    if (typeof entry !== 'string') continue
    const id = idByNormalizedName.get(normalizeGrowthAreaName(entry))
    if (!id || seen.has(id)) continue
    seen.add(id)
    selectedGrowthAreaIds.push(id)
  }

  // The v1 key is removed rather than left behind. Two fields holding
  // selections, one of them dead, is exactly the kind of duplication that
  // produces a bug six months later.
  const { selectedGrowthAreas: _superseded, ...rest } = v1

  return { ...rest, customGrowthAreas, selectedGrowthAreaIds }
}

/**
 * A v1 custom area becomes a v2 one with a hashed id.
 *
 * The v1 `id` is deliberately NOT reused: it was the normalized name, and
 * keeping it would preserve the exact bug this migration exists to fix.
 *
 * The id is written in the v2 shape — `ga_` plus the bare hash — because
 * producing v2 is this migration's whole job. The v2 -> v3 pass then adds
 * `ga_m_` to that same suffix, so the hash is computed once and the two steps
 * cannot disagree about it.
 */
function migrateV1CustomArea(entry: unknown): DraftGrowthArea | null {
  if (typeof entry !== 'object' || entry === null) return null
  const name = toGrowthAreaDisplayName(String((entry as { name?: unknown }).name ?? ''))
  if (name === '') return null

  const normalizedName = normalizeGrowthAreaName(name)
  return { id: V2_ID_PREFIX + migratedGrowthAreaSuffix(normalizedName), name, normalizedName }
}

/**
 * v2 -> v3: id namespaces become explicit.
 *
 * v2 gave every id the single prefix `ga_` and relied on suffix LENGTH to keep
 * the three origins apart. Suggested slugs have variable length, so nothing
 * stopped a future 14-character slug from colliding with a migrated id — the
 * separation existed but was fragile, and it was invisible to anyone reading an
 * id in a log.
 *
 * v3 gives each origin its own prefix:
 *
 *   ga_fitness        -> ga_s_fitness      (suggested)
 *   ga_<16 random>    -> ga_c_<16 random>  (custom)
 *   ga_<14 hash>      -> ga_m_<14 hash>    (migrated)
 *
 * This is a pure re-prefixing. No id is regenerated, no selection is remapped
 * through a name lookup, and no answer is touched — the suffix is carried across
 * byte for byte, so every reference keeps pointing at the same thing. Anything
 * unrecognised is left alone rather than guessed at, because a wrong guess is a
 * broken reference, while an unchanged unknown is at worst still broken in
 * exactly the way it already was.
 *
 * Identity is preserved, which is the entire requirement: a rename never moves an
 * id, and this migration moves nothing but the namespace.
 */
export function migrateDraftV2ToV3(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value

  const v2 = value as Record<string, unknown>

  return {
    ...v2,
    customGrowthAreas: toArray(v2.customGrowthAreas).map(upgradeV2Area),
    selectedGrowthAreaIds: toArray(v2.selectedGrowthAreaIds).map((entry) =>
      typeof entry === 'string' ? upgradeV2Id(entry) : entry,
    ),
  }
}

function upgradeV2Area(entry: unknown): unknown {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return entry

  const area = entry as Record<string, unknown>
  return typeof area.id === 'string' ? { ...area, id: upgradeV2Id(area.id) } : area
}

/**
 * Re-prefixes one v2 id, or returns it untouched if it is not recognisable.
 *
 * The slug list is a parameter rather than read from a module constant so a
 * test can classify an id against a slug that is 14 or 16 characters long.
 * No slug shipped today is, which means the ordering below is otherwise
 * untestable — and untestable ordering is exactly the kind that gets
 * "tidied up" one day and silently corrupts a suggestion's identity.
 */
function upgradeV2Id(id: string, slugs: ReadonlySet<string> = SUGGESTED_SLUGS): string {
  if (!id.startsWith(V2_ID_PREFIX)) return id

  const suffix = id.slice(V2_ID_PREFIX.length)

  // Slugs first, and by exact match. The list is fixed and known, while the
  // length checks below are heuristics that a long slug could accidentally
  // satisfy. Checking length first would move a 14- or 16-character slug into
  // a custom namespace, and from that moment every reference to that
  // suggestion would point at an id that no longer exists.
  if (slugs.has(suffix)) {
    return suggestedGrowthAreaId(suffix)
  }

  if (isIdSuffix(suffix, RANDOM_SUFFIX_LENGTH)) {
    return CUSTOM_ID_PREFIX + suffix
  }

  if (isIdSuffix(suffix, MIGRATED_SUFFIX_LENGTH)) {
    return MIGRATED_ID_PREFIX + suffix
  }

  // Unrecognised shape. Left exactly as it is; normalizeFields will
  // reconcile away any selection pointing at it rather than display it.
  return id
}

/**
 * The classification above, exposed for its ordering to be tested.
 *
 * Not part of the repository's surface and not how the migration calls itself:
 * `migrateDraftV2ToV3` is the only entry point. This exists so a test can ask
 * "what happens to a 14-character slug?" — a question the shipped suggestion
 * list cannot answer and therefore cannot keep honest.
 */
export function classifyV2GrowthAreaId(
  id: string,
  slugs: ReadonlySet<string> = SUGGESTED_SLUGS,
): string {
  return upgradeV2Id(id, slugs)
}

/** The single prefix v2 used for all three namespaces. */
const V2_ID_PREFIX = 'ga_'

/** Suffix length of a random custom id. */
const RANDOM_SUFFIX_LENGTH = 16

/** Suffix length of a migrated id: two 7-character base-36 halves. */
const MIGRATED_SUFFIX_LENGTH = 14

/**
 * The suggested slugs, derived from the current table rather than restated.
 *
 * Deriving them means adding a suggestion is automatically migratable, and
 * removing one automatically stops old ids being rewritten into a `ga_s_` id
 * that no longer exists in the list — which would otherwise produce a selection
 * pointing at a suggestion the UI can no longer display.
 */
const SUGGESTED_SLUGS: ReadonlySet<string> = new Set(
  SUGGESTED_GROWTH_AREAS.map((area) => area.id.slice(SUGGESTED_ID_PREFIX.length)),
)

/**
 * A suffix of an exact length, in the alphabet ids are written in.
 *
 * The character check matters: without it, any 16-character string — including
 * a slug containing an uppercase letter or a dash — could be mistaken for a
 * random id and moved into the custom namespace.
 */
function isIdSuffix(suffix: string, length: number): boolean {
  return suffix.length === length && /^[0-9a-z]+$/.test(suffix)
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

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
    selectedGrowthAreaIds: normalizeSelections(candidate.selectedGrowthAreaIds),
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

function normalizeCustomAreas(value: unknown): DraftGrowthArea[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const kept: DraftGrowthArea[] = []

  for (const entry of value) {
    const area = normalizeDraftGrowthArea(entry)
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
