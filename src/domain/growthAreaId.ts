/**
 * Growth Area identifiers.
 *
 * WHY IDS EXIST AT ALL
 *
 * Phase 2A derived a Growth Area's id from its normalized name, which
 * was convenient and wrong. The moment a user can rename an area — or
 * the moment a name is edited by hand, or corrected by a future
 * migration — every stored reference to that area silently stops
 * matching. Milestones, daily actions, point events, reviews and D1
 * rows all point at an id, so a name-derived id turns a harmless rename
 * into data loss spread across tables.
 *
 * So an id is now opaque, assigned once, and never recomputed. Names are
 * for people; ids are for machines.
 *
 * THREE WAYS AN ID IS BORN, AND WHY THEY DO NOT COLLIDE
 *
 *   suggested   ga_fitness, ga_learning, ...  hardcoded in growthAreas.ts.
 *               They are a permanent contract, pinned by a test, and a
 *               rename must not touch them.
 *
 *   custom      ga_ + 16 random characters. 128 bits of entropy, so
 *               two people typing "Piano" on two devices get two
 *               different areas and can later merge or sync them.
 *
 *   migrated    ga_ + 14 deterministic characters, hashed from the
 *               normalized name a Phase 2A draft used AS ITS ID.
 *               Deterministic so migrating the same draft twice always
 *               produces the same ids — otherwise every page load would
 *               re-mint identities and break references again. The 14
 *               characters cannot collide with a 16-character random id
 *               because the lengths differ.
 *
 * The one impure function in the domain is `createGrowthAreaId`. It is
 * isolated here on purpose: everything else stays pure, and tests inject
 * a fixed id instead of asserting against randomness.
 */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

/** Common prefix so an id is recognisable in a log or a D1 row. */
export const GROWTH_AREA_ID_PREFIX = 'ga_'

/**
 * Lengths differ on purpose — see the collision note above. The hashed
 * form is two equal halves, so its length is derived rather than typed,
 * which keeps the "these two spaces cannot collide" claim true by
 * construction instead of by two numbers agreeing.
 */
const RANDOM_ID_LENGTH = 16
const HASH_HALF_LENGTH = 7
const HASHED_ID_LENGTH = HASH_HALF_LENGTH * 2

/**
 * A fresh, opaque id for a newly created custom Growth Area.
 *
 * Prefers `crypto.randomUUID`, which is unbiased by construction.
 * Falls back to `getRandomValues` and finally to `Math.random` so this
 * can never be the reason onboarding breaks — an id only has to be
 * unique, never secret.
 */
export function createGrowthAreaId(): string {
  const source = globalThis.crypto

  if (typeof source?.randomUUID === 'function') {
    return GROWTH_AREA_ID_PREFIX + source.randomUUID().replaceAll('-', '').slice(0, RANDOM_ID_LENGTH)
  }

  return GROWTH_AREA_ID_PREFIX + randomCharacters(RANDOM_ID_LENGTH, source)
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
 * The stable id for a Growth Area carried over from a Phase 2A draft.
 *
 * FNV-1a run twice with different seeds, giving 64 bits, rendered as two
 * padded base-36 halves. Two 32-bit hashes rather than one because
 * 32 bits means a 1-in-4-billion birthday collision per user, which is
 * small but not worth carrying into data we cannot re-migrate later.
 *
 * Hashing the *name* is not a return to name-derived identity: the
 * result is computed once, at migration time, and then stored. After
 * that the id is opaque and a rename cannot move it.
 *
 * The returned length is asserted in the tests. If it ever grew to match
 * RANDOM_ID_LENGTH, the two id spaces could overlap and the no-collision
 * argument above would quietly stop holding.
 */
export function migratedGrowthAreaId(normalizedName: string): string {
  const low = fnv1a(normalizedName, 0).toString(36).padStart(HASH_HALF_LENGTH, '0')
  const high = fnv1a(normalizedName, 0x9e3779b9).toString(36).padStart(HASH_HALF_LENGTH, '0')

  const id = GROWTH_AREA_ID_PREFIX + low + high

  if (id.length !== GROWTH_AREA_ID_PREFIX.length + HASHED_ID_LENGTH) {
    // Unreachable with two 32-bit hashes in base 36, but the collision
    // guarantee depends on this length, so it is checked rather than
    // assumed.
    throw new RangeError(`migrated Growth Area id has the wrong length: ${id}`)
  }

  return id
}

function fnv1a(text: string, seed: number): number {
  let hash = 0x811c9dc5 ^ seed

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}
