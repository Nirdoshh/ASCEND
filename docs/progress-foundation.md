# Phase 3E — Progress foundation

ASCEND answers “Have I actually been taking action?” using retained Journey,
DailyPlan and Daily Step records. No measure claims improved skills, personality,
discipline or achieved daily outcomes.

## Model and exact definitions

`ProgressSnapshot` contains Journey/date identity, plan-day count, total and
completed actions, all-history active and fully completed days, seven recent
`ProgressDay` values, recent active-day count, inclusive Journey day and duration.
Each day includes its saved local date, plan presence, whether an empty day is
before the Journey, Step counts and activity/full-completion flags.

| Value | Definition |
| --- | --- |
| Analyzed history | Retained plans belonging to the active Journey, with saved localDate on or before the snapshot date, and their associated Step lists. Future plans are excluded. Existing earlier plan dates are retained even if a timezone change shifts the reconstructed start date. |
| totalActions | All existing Steps in analyzed history, including preserved sets with more than four Steps. |
| completedActions | Existing Steps with completedAt not null. Reopening a Step removes it from this count. |
| planDays | Number of distinct analyzed plan dates, including plans without Steps. |
| activeDays | Distinct analyzed plan dates with at least one completed Step. Opening Today or creating a plan alone does not count. |
| fullyCompletedDays | Plan dates with a valid composition of 2–4 Steps and every Step complete. Zero, one and over-full sets never count as fully complete, though their actions still count. |
| recentDays | Exactly the seven local calendar dates from asOfLocalDate minus six days through asOfLocalDate, oldest first, with missing dates filled honestly. |
| recentActiveDays | Active dates within that seven-day window. The denominator remains seven even for a younger Journey; dates before its start are described explicitly in accessible text. |
| journeyElapsedDays | Inclusive calendar day: max(0, calendar boundaries from locally interpreted startedAt to asOfLocalDate + 1). Start date is Day 1; a future start is Day 0. It is not capped to duration. |
| journeyDurationDays | Journey's saved intended duration, unchanged. “Day 11 of 45” describes calendar time, never achievement percentage. |

Activity uses **DailyPlan.localDate**, never a UTC conversion of completedAt. DST
does not create fractional or missing days. Journey's startedAt is an instant and
uses the browser's current timezone, as Today does. Journey v1 has no original
timezone field; changing zones can shift the reconstructed start date by a day.
Saved plan dates and Step activity never move.

Deleted Steps are absent from retained history. There is no immutable event log,
so totals can decrease after removal or undo. Today's Win and Journey milestones
are not read to infer completion. Previous Step schema v1 loads as open v2 Steps
in memory only; no migration is written during aggregation.

## Repository and application design

- DailyPlan keys: `ascend:daily-plan:<journeyId>:<localDate>`.
- Daily Step keys: `ascend:daily-steps:<dailyPlanId>`; the actual persisted shape is
  a versioned array of Steps, not a separate DailyStepsRecord wrapper.
- `DailyPlanRepository.listForJourney` lists only the requested Journey's keys,
  validates key/record identity, real calendar dates and unique plan IDs, and sorts
  by date. Missing records are allowed; malformed/future records stop the read.
- `DailyStepsRepository.readForPlan` distinguishes empty/missing lists from
  unreadable or future data. It preserves over-full lists and stable identities.
- `JourneyRepository.readActive` distinguishes absence from failure and refuses to
  invent an invalid startedAt using a fallback clock.
- `KeyValueStore.readResult` and `keysWithPrefix` provide explicit failure results.
  Both are non-destructive. Legacy nullable reads also preserve malformed JSON.
- `application/loadProgress` loads the Journey, its plans and relevant Step lists,
  then calls pure `domain/deriveProgressSnapshot`. React renders the result only.

No source completion is duplicated. No derived value is persisted. Nothing is
created merely by visiting Progress. The snapshot is recalculated on navigation
back to Progress or error retry, naturally reflecting source updates.

For K storage keys, P Journey plans and S associated Steps, loading costs
O(K + P log P + S). Pure aggregation costs O(P + S), plus seven fixed calendar
entries. Memory is O(P + S) including loaded sources. This is appropriate for the
expected local V1 dataset; there are no new dependencies or performance caches.

## Screen and states

The calm screen anchors on completed actions, with one recent-activity surface and
a quieter Journey calendar section. Counts and dates accompany the accent color.
The seven-day list wraps to four columns on phones without a charting library.

- No active Journey: component offers Journey creation; existing protected-route
  guards still redirect a normal first-time visit to onboarding.
- Journey with no plans: first-action invitation and Journey calendar day.
- Plans without Steps: invitation to add Steps, without a zero-heavy history.
- Steps with nothing complete: first-action invitation and honest open-Step ratios.
- Partial history: missing days show a dash; accessible text distinguishes no plan,
  no Steps, and dates before the Journey.
- Storage failure: an alert and keyboard-operable retry.
- Malformed history: records preserved, totals withheld, explanation and retry.
- Future schema: records preserved, user directed to the latest ASCEND version.

Semantic headings/sections, ordered history and full-date textual descriptions
support assistive technology. Visual ratios are hidden from screen readers to
avoid duplicate announcements. Interactive links/buttons retain 44px targets at
the requested normal viewports. Existing focus, contrast tokens and reduced-motion
rules are reused. Desktop navigation can wrap with enlarged text.

## Validation

84 tests were added. The final suite has **940 passing tests in 36 files**.
`npm run verify` passed typechecking, lint with zero warnings, tests and the
production build.

Coverage includes empty/one/multiple-day histories, completion mixes and undo,
active/full definitions, zero/one/over-full compositions, seven-day boundaries,
younger Journeys, local midnight and DST, Journey isolation, order independence,
safe historical reads, missing/malformed/future data, UI counts/copy/errors,
accessible history, retry and real-router navigation.

Real Chromium verification used isolated seeded browser contexts (no real user
history was modified), a fixed October 11 calendar clock, and Asia/Katmandu timezone.

| Size | Light mode | Dark mode |
| --- | --- | --- |
| 375 × 667 | No history, partial, several days passed | No history, partial, several days passed |
| 768 × 1024 | No history, partial, several days passed | No history, partial, several days passed |
| 1440 × 900 | No history, partial, several days passed | No history, partial, several days passed |

All 18 cases verified rendered counts, theme, recent text where present, keyboard
skip/focus and Today/Progress round-trip navigation. They passed overflow checks
at normal viewports, half-size effective viewports corresponding to 200% reflow,
and doubled root text size. Additional browser checks passed keyboard Step
completion and undo reflected on return, reduced motion, and simulated storage
failure followed by keyboard retry recovery. No console errors, page exceptions
or unexpected failed requests occurred. Representative phone/desktop screenshots
were visually inspected.

Native browser-menu **200% zoom was not exercised**; effective-viewport reflow and
doubled text are evidence, not a claim that native zoom passed. Manual screen-reader
use and engines other than Chromium were not verified. Browser scripts,
screenshots and JSON output stay in ignored `.playwright-mcp/phase3e*` paths and are
not committed.

Remaining manual checklist:

1. In a normal browser, set actual page zoom to 200% at the requested window sizes;
   confirm readable history, reachable controls and no horizontal scrolling.
2. With NVDA/VoiceOver, traverse headings and all seven days; confirm full dates,
   ratios and missing-day descriptions are spoken once, and retry is announced.
3. Repeat navigation, theme and reflow checks in Firefox and Safari if available.

## Bugs found and technical debt

Fixed while implementing/verifying this phase:

- Legacy reads deleted malformed JSON, including reads before Progress mounted.
- Calendar validation used Date.UTC's special 1900 offset for years below 100,
  and date creation did not pad all years to the documented four digits.
- Today rendered outside AppShell, preventing normal navigation to Progress and
  omitting shared header/navigation/error containment.
- Today navigation used `/`, so it was not selected on the final `/today` route.
- The shared skip-link label incorrectly named Today's plan on every screen.
- Desktop navigation overflowed slightly at tablet width with doubled text.

Remaining limitations/debt:

- Journey has no original timezone/start-local-date contract. A future policy needs
  a deliberate versioned migration, not retroactive activity-date conversion.
- No live cross-tab or midnight refresh while Progress stays mounted; re-entry or
  reload recalculates it. localStorage history is not a transactional snapshot.
- Existing startup guards use nullable Journey reads; when the Journey itself is
  unreadable/unavailable they can redirect to onboarding instead of showing the
  Progress-specific error state. Records are now preserved by reads.
- Older feature write paths still use nullable reads and do not consistently
  distinguish corrupt JSON from absence before saving. Progress itself has no
  write path; a wider write-safety review is deferred.
- No immutable removal/completion event history, automated browser runner in the
  package, persistence recovery UI, or cross-device storage. None was added here.

## Changed files

Implementation and integration:

- `src/domain/progress.ts`, `src/domain/localDate.ts`
- `src/application/progress.ts`
- `src/data/repositories/dailyPlanRepository.ts`
- `src/data/repositories/dailyStepsRepository.ts`
- `src/data/repositories/journeyRepository.ts`
- `src/data/repositories/readResult.ts`
- `src/data/storage/webStorageStore.ts`
- `src/features/progress/ProgressScreen.tsx`, `ProgressScreen.css`
- `src/app/AppShell.tsx`, `src/app/StartupRedirect.tsx`
- `src/components/layout/PrimaryNav.tsx`, `PrimaryNav.css`

Tests and fixtures:

- `src/domain/progress.test.ts`, `src/domain/localCalendar.test.ts`
- `src/application/progress.test.ts`
- `src/data/repositories/progressHistory.test.ts`
- `src/data/storage/webStorageStore.test.ts`
- `src/features/progress/ProgressScreen.test.tsx`
- `src/app/routes.test.tsx`
- `src/components/layout/PrimaryNav.test.tsx`
- `src/test/progressFixtures.ts`

Documentation:

- `README.md`
- `docs/adr/0013-progress-is-derived-from-source-history.md`
- `docs/progress-foundation.md`

## Phase boundary

This phase adds no Growth Points, XP, levels, streaks, rankings, badges,
achievements, leaderboards, social comparison, AI insights/interpretation,
notifications, recovery system, weekly review, milestone completion or Today's
Win completion. Existing milestones and Win records remain unchanged. No Phase
3F work or deployment was performed.
