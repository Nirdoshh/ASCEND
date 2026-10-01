/**
 * Local date handling for ASCEND.
 *
 * Daily plans are keyed by CALENDAR DAY in the user's local timezone,
 * not by UTC date boundaries. This is critical: "today" means the
 * date the user sees on their calendar, not an arbitrary 24-hour window.
 *
 * For Phase 3A V1: we detect the browser's timezone and use it.
 * A future phase will add explicit timezone configuration UI.
 */

/**
 * A local calendar date in YYYY-MM-DD format.
 *
 * This is an opaque string type — comparisons and operations should
 * go through the functions below, not string manipulation.
 */
export type LocalDate = string

/**
 * Provider for the current local date.
 *
 * Injected rather than using `new Date()` directly so tests can
 * control time without depending on the machine's real clock.
 */
export interface LocalDateProvider {
  /** Returns the current local date in YYYY-MM-DD format. */
  today(): LocalDate
}

/**
 * Creates a LocalDateProvider that uses the browser's local timezone.
 *
 * This is the production implementation. It reads the system's
 * timezone via Intl.DateTimeFormat and constructs the date in that zone.
 */
export function createSystemLocalDateProvider(): LocalDateProvider {
  return {
    today(): LocalDate {
      // Get the user's timezone from the browser
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const now = new Date()

      // Format the date in the user's local timezone
      // This handles DST transitions correctly
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      const parts = formatter.formatToParts(now)
      const year = parts.find((p) => p.type === 'year')?.value ?? '1970'
      const month = parts.find((p) => p.type === 'month')?.value ?? '01'
      const day = parts.find((p) => p.type === 'day')?.value ?? '01'
      return `${year}-${month}-${day}`
    },
  }
}

/**
 * Creates a LocalDateProvider with a fixed date for testing.
 *
 * Tests use this to simulate different days without depending on
 * the real system clock.
 */
export function createFixedLocalDateProvider(fixedDate: LocalDate): LocalDateProvider {
  return {
    today(): LocalDate {
      return fixedDate
    },
  }
}

/**
 * Validates that a string is a valid LocalDate (YYYY-MM-DD) AND
 * represents a real calendar date.
 */
export function isValidLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false
  // YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parts = value.split('-')
  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])
  // Validate ranges
  if (year < 1 || year > 9999) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  // Check actual calendar validity
  const date = new Date(Date.UTC(year, month - 1, day))
  // Date constructor handles invalid dates by rolling over, so check components match
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/**
 * Parses a LocalDate string into year, month, day components.
 * Returns null if invalid.
 */
export function parseLocalDate(date: LocalDate): { year: number; month: number; day: number } | null {
  if (!isValidLocalDate(date)) return null
  const parts = date.split('-')
  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])
  // After isValidLocalDate, these are guaranteed to be numbers
  return { year, month, day }
}

/**
 * Creates a LocalDate from year, month, day components.
 * Month is 1-12.
 */
export function createLocalDate(year: number, month: number, day: number): LocalDate {
  const monthStr = String(month).padStart(2, '0')
  const dayStr = String(day).padStart(2, '0')
  return `${year}-${monthStr}-${dayStr}`
}

/**
 * Compares two LocalDates.
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
export function compareLocalDate(a: LocalDate, b: LocalDate): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * Returns true if two LocalDates represent the same calendar day.
 */
export function isSameLocalDate(a: LocalDate, b: LocalDate): boolean {
  return a === b
}