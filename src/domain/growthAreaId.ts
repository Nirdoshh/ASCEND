/**
 * Growth Area identifiers.
 *
 * WHY IDS EXIST AT ALL
 *
 * Phase 2A derived a Growth Area's id from its normalized name, which was
 * convenient and wrong. The moment a user can rename an area — or the moment a
 * name is edited by hand, or corrected by a future migration — every stored
 * reference to that area silently stops matching. Milestones, daily actions,
 * point events, reviews and D1 rows all point at an id, so a name-derived id
 * turns a harmless rename into data loss spread across tables.
 *
 * So an id is opaque, assigned once, and never recomputed. Names are for
 * people; ids are for machines.
 *
 * THREE NAMESPACES, EXPLICIT
 *
 *   ga_s_  + slug      suggested     hardcoded slugs, permanent contract
 *   ga_c_  + 16 chars  custom        minted at creation from a UUID
 *   ga_m_  + 14 chars  recovered     hashed from a name a v1 draft used
 *                                    AS ITS ID, or rebuilt when a stored
 *                                    id is found missing or blank
 *
 * The earlier attempt shared one `ga_` prefix for all three and relied on
 * suffix LENGTH to keep them apart. That was a real weakness: suggested slugs
 * have variable length, so nothing stopped a future slug of 14 characters
 * colliding with a migrated id. Length was doing work it should not have been
 * asked to do.
 *
 * A distinct prefix per origin makes the namespaces disjoint BY CONSTRUCTION.
 * The lengths stay different as well, which is a second, independent guarantee:
 *
 *   ga_s_ +  5..13     the longest slug is "communication"
 *   ga_m_ + 14
 *   ga_c_ + 16
 *
 * So the two mechanisms agree, and a test asserts both.
 *
 * The lengths are NOT load-bearing, and it matters that they are not. Because
 * the prefixes are disjoint, an id cannot be ambiguous whatever follows it.
 * The differing lengths are kept as a cheap cross-check, but a future 14-
 * character suggested slug would be a suggestion, not a collision. That is the
 * whole reason v3 exists: in v2, length was the only thing separating the
 * namespaces, so a new long slug really could have corrupted an identity.
 *
 * An id's origin is also readable from the id itself, which matters later: a
 * D1 row can be filtered by origin without a lookup, and a bad row can be
 * traced back to the code path that produced it.
 *
 * WHY MIGRATED IDS ARE DETERMINISTIC
 *
 * `ga_m_` ids are hashed from a name rather than generated. If they were random
 * at migration time, every page load would re-mint identities and a user's
 * selection would appear to vanish each time they reopened the app. Hashing is
 * not a return to name-derived identity: the result is computed once, stored,
 * and opaque forever after. A rename cannot move it.
 *
 * The one impure function in the domain is `createGrowthAreaId`. It is isolated
 * here on purpose: everything else stays pure, and tests inject a fixed id
 * instead of asserting against randomness.
 */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

/** Where each id came from. Readable from the id itself. */
export const SUGGESTED_ID_PREFIX = 'ga_s_'
export const CUSTOM_ID_PREFIX = 'ga_c_'
export const MIGRATED_ID_PREFIX = 'ga_m_'

/**
 * Suffix lengths, after the namespace prefix.
 *
 * Kept as named constants rather than inline numbers because the no-collision
 * argument above depends on them, and a test asserts them. The hashed form is
 * two equal halves, so its length is derived rather than typed, which keeps
 * "the two spaces cannot collide" true by construction instead of by two
 * numbers agreeing.
 */
const RANDOM_ID_LENGTH = 16
const HASH_HALF_LENGTH = 7
const HASHED_ID_LENGTH = HASH_HALF_LENGTH * 2

/** The longest suggested slug, "communication". Asserted in a test. */
export const LONGEST_SUGGESTED_SLUG_LENGTH = 13

/**
 * The id for a suggested Growth Area.
 *
 * Takes the hand-written slug, not the display name. That is what makes a
 * rename safe: renaming "Communication" to "Talking" leaves `ga_s_communication`
 * pointing at the same thing.
 */
export function suggestedGrowthAreaId(slug: string): string {
  if (slug.length === 0) {
    throw new RangeError('a suggested Growth Area needs a slug')
  }

  return SUGGESTED_ID_PREFIX + slug
}

/**
 * A fresh, opaque id for a newly created custom Growth Area.
 *
 * Prefers `crypto.randomUUID`, which is unbiased by construction. Falls back to
 * `getRandomValues` and finally to `Math.random` so this can never be the reason
 * onboarding breaks — an id only has to be unique, never secret.
 */
export function createGrowthAreaId(): string {
  const source = globalThis.crypto

  if (typeof source?.randomUUID === 'function') {
    return CUSTOM_ID_PREFIX + source.randomUUID().replaceAll('-', '').slice(0, RANDOM_ID_LENGTH)
  }

  return CUSTOM_ID_PREFIX + randomCharacters(RANDOM_ID_LENGTH, source)
}

function randomCharacters(length: number, source: Crypto | undefined): string {
  const bytes = new Uint8Array(length)

  if (typeof source?.getRandomValues === 'function') {
    source.getRandomValues(bytes)
  } else {
    for (let index = 0; index < length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  let out = ''
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length]
  return out
}

/**
 * The stable id for a Growth Area whose identity had to be reconstructed.
 *
 * Used for two things, both of which are recovering an identity rather than
 * minting one:
 *
 *   - a Growth Area carried over from a v1 draft, whose id WAS its name
 *   - a stored custom area whose id is missing or blank
 *
 * FNV-1a run twice with different seeds, giving 64 bits, rendered as two padded
 * base-36 halves. Two 32-bit hashes rather than one because 32 bits means a
 * 1-in-4-billion birthday collision per user, which is small but not worth
 * carrying into data we cannot re-migrate later.
 *
 * Recovery is deterministic, so repairing twice yields the same identity —
 * which is the whole reason this is a hash and not a random id.
 */
export function migratedGrowthAreaId(normalizedName: string): string {
  return MIGRATED_ID_PREFIX + migratedGrowthAreaSuffix(normalizedName)
}

/**
 * The same hash, without a namespace prefix.
 *
 * Exists for exactly one caller: the v1 -> v2 migration, which has to write
 * the shape v2 defined — a bare `ga_` prefix — because a migration that emits
 * a future version's format has no intermediate state to be tested against.
 * Exposing the suffix rather than a second whole id function keeps there
 * exactly one implementation of the hash, so the two namespaces cannot drift
 * apart.
 *
 * The differing-length invariant lives here rather than in the callers, because
 * the two suffixes are computed from the same name and must therefore agree.
 * It is unreachable while the prefixes are disjoint, and kept anyway as a
 * cross-check: it is the assertion that would still fire if someone widened a
 * prefix back to `ga_` and reintroduced v2's ambiguity.
 */
export function migratedGrowthAreaSuffix(normalizedName: string): string {
  if (RANDOM_ID_LENGTH === HASHED_ID_LENGTH) {
    // Unreachable with the constants above. If it ever became reachable, two
    // ids from different namespaces could be indistinguishable, so it is
    // enforced rather than assumed.
    throw new RangeError('custom and migrated id suffixes must differ in length')
  }

  const low = fnv1a(normalizedName, 0).toString(36).padStart(HASH_HALF_LENGTH, '0')
  const high = fnv1a(normalizedName, 0x9e3779b9).toString(36).padStart(HASH_HALF_LENGTH, '0')

  return low + high
}

function fnv1a(text: string, seed: number): number {
  let hash = 0x811c9dc5 ^ seed

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}
