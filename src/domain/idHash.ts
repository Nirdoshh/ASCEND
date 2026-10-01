/**
 * Deterministic id suffixes.
 *
 * WHY THIS IS ITS OWN FILE
 *
 * Two kinds of record in ASCEND need an id that is stable when nobody is
 * looking: a Growth Area whose identity had to be reconstructed, and a
 * milestone whose stored id was missing or blank. Both need the SAME
 * property — repairing the same draft twice produces the same id — and
 * both therefore need the same hash.
 *
 * The hash used to live inside growthAreaId.ts, which meant a second
 * implementation would have had to be copy-pasted out of it for
 * milestones. Two copies of a hash is two sets of ids: repairing a
 * Growth Area one release and a milestone the next would silently
 * disagree about what "the same text" means, and nothing would notice
 * until a reference stopped resolving. So there is one implementation,
 * here, and growthAreaId.ts imports it.
 *
 * The output is unchanged. This is an extraction, not a change: the
 * algorithm, the two seeds and the rendering are the ones already
 * shipping, and growthAreas.test.ts pins a concrete `ga_m_` id so the
 * promise is checked rather than asserted.
 *
 * WHY A HASH AND NOT A RANDOM ID
 *
 * Random is right when a record is being CREATED, and this is not that
 * case. This only ever RECOVERS an identity that was lost — a v1 draft
 * whose id WAS its name, or a stored record whose id arrived missing or
 * blank. Minting randomly on every load would re-mint the identity every
 * time the page opened, and a user's selection would appear to vanish
 * each time they came back.
 *
 * WHY TWO 32-BIT HALVES
 *
 * One 32-bit hash means a 1-in-4-billion birthday collision per user,
 * which is small enough to be tempting and too small to carry into data
 * we cannot re-migrate later. Two runs with different seeds give 64 bits,
 * rendered as two padded base-36 halves. That the halves are EQUAL in
 * length is derived rather than typed, which keeps "the two spaces cannot
 * collide" true by construction instead of by two numbers agreeing.
 *
 * This is NOT name-derived identity. The result is computed once, stored,
 * and opaque forever after — a rename cannot move it. See
 * growthAreaId.ts for why that distinction matters.
 */

/** The alphabet ids and hashes are written in. */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

/** Characters per hash half, zero-padded so both halves are the same width. */
const HASH_HALF_LENGTH = 7

/** Two halves of the same width. */
const HASHED_SUFFIX_LENGTH = HASH_HALF_LENGTH * 2

/** A different seed, so the two halves of one suffix are not the same run. */
const SECOND_SEED = 0x9e3779b9

/**
 * A deterministic, 14-character base-36 suffix for some text.
 *
 * `normalize` is expected to have been applied by the caller. It is
 * applied here too, because this function is reached from the storage
 * boundary with whatever the store held, and a hash of ' Piano' must not
 * differ from a hash of 'piano' — that would break duplicate detection
 * with the same symptom as a stale cached value.
 */
export function hashedIdSuffix(text: string): string {
  const normalized = text.trim().replace(/\s+/gu, ' ').toLowerCase()

  const low = fnv1a(normalized, 0).toString(36).padStart(HASH_HALF_LENGTH, '0')
  const high = fnv1a(normalized, SECOND_SEED).toString(36).padStart(HASH_HALF_LENGTH, '0')

  return low + high
}

/**
 * The width of every hashed suffix, so a caller can check an id's shape.
 *
 * Exported because the no-collision argument in growthAreaId.ts depends on
 * this number, and that argument is only worth making if something can
 * read the number back.
 */
export const HASHED_SUFFIX_CHARACTERS = HASHED_SUFFIX_LENGTH

/**
 * Random characters from the same alphabet the hash renders in.
 *
 * Shared because an id that is minted randomly and an id that is hashed
 * must not be tellable apart by the characters alone — only by their
 * prefix. `createGrowthAreaId` and `createMilestoneId` both use this.
 */
export function randomIdCharacters(
  length: number,
  source: Crypto | undefined = globalThis.crypto,
): string {
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

function fnv1a(text: string, seed: number): number {
  let hash = 0x811c9dc5 ^ seed

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}