/**
 * Minimal class-name joiner.
 *
 * We do not use clsx or tailwind-merge. Phase 1 needs "join truthy
 * strings", and adding a dependency for that would be complexity we
 * cannot justify. If a later phase introduces conflicting-variant
 * resolution, this is the single file to revisit.
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}
