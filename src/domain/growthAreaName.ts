/**
 * Growth Area NAME rules.
 *
 * Split out from growthAreas.ts because names and identity are
 * different jobs with different failure modes, and mixing them is what
 * caused the Phase 2A bug: the normalized name was used AS the id, so
 * renaming became impossible and could have orphaned every stored
 * reference.
 *
 * Two functions, two audiences:
 *
 *   toGrowthAreaDisplayName  for the person reading the screen
 *   normalizeGrowthAreaName  for comparing two names for sameness
 *
 * Neither one is ever an identifier.
 */

/**
 * Cleans a name for display without changing its capitalization.
 *
 * "  Digital   Marketing " becomes "Digital Marketing" — the extra spaces
 * were never part of what the user meant — but the casing they typed is
 * preserved exactly. Preserving it matters: it is the difference between
 * a name the user recognises as theirs and one that looks like a typo.
 */
export function toGrowthAreaDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/gu, ' ')
}

/**
 * The comparison key for a name.
 *
 * Unicode-aware, so a non-breaking space or an ideographic space is
 * collapsed exactly like a normal one.
 *
 * Returns what "these are the same area" means: trimmed, whitespace
 * collapsed, lowercased. So "Digital Marketing", " digital marketing "
 * and "DIGITAL MARKETING" all produce the same string.
 *
 * THIS IS NOT AN IDENTIFIER. It is safe to compare and unsafe to store
 * as a reference, because the moment the name is corrected the reference
 * breaks. See growthAreaId.ts.
 */
export function normalizeGrowthAreaName(raw: string): string {
  return raw.trim().replace(/\s+/gu, ' ').toLowerCase()
}
