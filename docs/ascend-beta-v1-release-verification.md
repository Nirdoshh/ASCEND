# ASCEND Beta V1 release candidate verification

Date: 2026-10-03. Scope: release preparation only; no commit or deployment.
The approved System visual reference remains unchanged.

## Product changes

- `/` directly renders the existing System screen; `/system` remains an alias.
  There is no redirect, cloned screen, legacy deletion, or Journey conversion.
  ADR 0017 records the entry decision. Existing Workers Static Assets SPA
  fallback handles cold loads and hard refresh on both URLs.
- Status keeps four metric cards and shows active Paths, active Goals,
  completed Roadmap Steps, and completed Daily Directives. Additional factual
  readouts show completed Goals/objectives and per-Path Goal/Step counts.
  Counts use saved statuses/timestamps, including retained history where
  available. They do not measure mastery. No Level, Rank, Stability, Condition,
  evidence-day counts, fake evidence bars, or assumed personal initial remain.
- You shows an honest identity empty state, a real active Path count, local
  storage configuration, and no cloud account/sync. No profile editor was added.
- Lock-In uses the real accepted Directive, its actual context, and saved
  objective controls. Normal navigation stays hidden. The static countdown is
  replaced by `NOW / UNTIMED SESSION`; `DISTRACTIONS TO AVOID` and an explicit
  no-blocking notice replace the sealed-distractions claim. Exit labels do not
  imply an unimplemented hold gesture. The modal permits cancellation, Escape,
  and intentional exit without penalties.
- The remaining user-facing example surface is the clearly suggested,
  unpersisted distraction reminder list. Suggested Paths are real editable
  records. No sample Goals, Roadmaps, missions, actions, or progression metrics
  are inserted into user data.

## Regression evidence

The automated suite has **1,075 passing tests across 49 files**. Thirty release
cases were added; existing root/navigation/boot assertions were updated.
`npm run verify` passes TypeScript checks, ESLint with zero warnings, the full
Vitest suite, and the production client/Worker build. `git diff --check` passes.
Generated builds, browser screenshots, scripts, and reports remain in ignored
`dist/` and `verify/` directories.

| Area | Verified evidence |
| --- | --- |
| Paths and Goals | Suggested records; stable identity; custom/authored data round trips; Goal creation, edit, pause, resume, completion, archive; legacy routes retained. |
| Roadmaps | Manual SKILL/GOAL routes; Phases and Steps; current selection; prerequisites and cycles; completion/undo; ordering; pause/archive/restore; persistence and form recovery. |
| Graph | Pure projection and deterministic layout; Global/Path/Goal/Phase/Step inspection; search; ACTIVE/ALL; pointer and keyboard pan; zoom; fit/reset; both Roadmap navigation directions; persisted completion update. |
| Today | Empty, one/multiple candidate, acceptance, manual creation/edit/replacement, objective edit/reorder/completion, Directive completion, explicit linked Step completion, refresh. Replacement retains original history. |
| Lock-In | Real context and objective persistence; normal navigation hidden; labeled modal, Escape, exit and focus return; truthful blocking/session copy. |
| Status/You | Factual counts only; neutral identity/configuration; unreadable records show unavailable counts instead of fabricated metrics. |
| Persistence | v1→v3 and v2→v3 read-only migration; v3 round trips; future collection/record refusal; malformed data preservation; storage/quota failures; real legacy-key byte preservation. |
| Empty/error states | No Goals, Roadmap, Phases, Steps or candidate; completed Directive; archived Goal/Roadmap/history; future/malformed/unavailable storage; failed-save draft retention. |

Two concrete persistence risks were repaired: v2 envelopes with conflicting
Directive fields are refused rather than overwritten, and v3 authored text and
unknown Directive/objective extensions survive reads and edits. Execution
validation now rejects invalid timestamps/calendar dates, duplicate active
daily records, colliding IDs, and duplicate objective ordering. No stored field,
schema version, storage key, or runtime dependency was added.

Graph search now respects archived ancestors and can reveal resting Goals and
Steps beyond the initial visible slice. A single Phase no longer overlaps YOU.
Graph operations report save failures; the blank zoom-out and inspector-close
buttons have visible symbols. Completion timers and unload listeners clean up
on unmount. No runaway effects, duplicate listeners, excessive application
warnings, or obvious performance regressions were observed in these bounded
flows; large-data benchmarks were not performed.

## Chromium verification

Fresh contexts were used for a real UI flow at **1440×900**, **768×1024**, and
**375×667**, against both local development and the compiled production preview.
The flow creates a Goal, Roadmap, Phase and current Step, inspects Map, accepts
the real candidate, completes its objective and Directive, explicitly completes
the linked Step, and checks both Roadmap and Graph. It then creates another real
Step and advances the browser clock to the next local day to enter Lock-In with
that new candidate, toggles its saved objective, exits, inspects Status/You, and
hard-refreshes `/system`. Persisted System bytes and the explicit current Step
remain intact. This next-day clock advance preserves the completed daily record
instead of rewriting history to manufacture another same-day session.

Additional Chromium checks cover malformed/future bytes, denied storage, quota
failure, keyboard-only branch activation/pan, visible focus, objective keyboard
completion, native modal isolation/exit, reduced motion, mobile control sizes,
bottom navigation clearance, long authored text, and a 320px reflow viewport.
A 720×450 CSS viewport checks the reflow equivalent of 200% zoom from 1440×900;
this is not a browser zoom certification. Screenshots were visually inspected.
No horizontal page overflow, console errors, application warnings, unexpected
failed requests, or broken navigation were observed in the verified flows.

Responsive fixes retain the existing composition: wrapping headers/actions,
fluid inputs, a compact objective toolbar, usable tablet Lock-In columns,
readable narrow configuration cards, and bounded inspector/dialog surfaces.
Named graph controls, stronger input boundaries, visible checkbox/input focus,
semantic headings/status messages, a skip link, keyboard camera controls, and
44px toolbar/navigation targets improve concrete accessibility issues. Dense
graph records also have keyboard and search alternatives to precise pointer
selection. This regression pass does not claim WCAG certification or full
screen-reader/device coverage.

## Files and accepted limits

Added:

- `src/domain/systemStatus.ts`
- `src/features/system/SystemRelease.test.tsx`
- `docs/adr/0017-system-beta-v1-entry-and-release-facts.md`
- `docs/ascend-beta-v1-release-verification.md`

Changed:

- `docs/ascend-system-product-bible.md`
- `src/app/routes.tsx`, `routes.test.tsx`, `App.test.tsx`, `BootErrorBoundary.test.tsx`
- `src/application/systemDirectives.ts`
- `src/data/repositories/systemRepository.test.ts`
- `src/domain/systemPathGoal.ts`, `systemDailyDirective.ts`, `systemGraph.ts`, `systemGraph.test.ts`
- `src/features/system/SystemScreen.tsx`, `SystemScreen.css`, `SystemScreen.test.tsx`, `SystemPathView.tsx`

Seven test files were added/updated. Schema remains **3** at the original key;
new runtime dependencies: **none**. Legacy Journey/DailyPlan/TodayWin/DailyStep
data stays under its original keys. Git remains uncommitted: 15 modified files,
4 new files, no staged changes, and no generated artifacts in the change set.

Lock-In is untimed and transient: no persisted session/resume, app/site blocking,
background timing, saved focus list, recorded exit reasons, or penalties. Only
Directive/objective records persist. Other accepted technical debt is origin-
and-device-local storage, no cross-tab conflict merge, no export/recovery UI,
in-memory editor drafts with unload warnings, native prompt edits, and bounded
graph layout/search disclosure. The completed Directive remains the visible
record for its local day. All XP, Level/Rank/Stability formulas, AI, accounts,
sync, Notes, Markdown, backlinks, native blocking, and later phases remain
unimplemented. Deployment behavior is verified locally through the production
preview and existing routing configuration; no remote deployment was tested.
