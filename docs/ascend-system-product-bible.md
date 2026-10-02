# ASCEND SYSTEM — Product Bible

**Status:** ASCEND Beta V1 Release Candidate — October 2026 (not deployed)
**Scope:** The primary application at `/`, with `/system` retained as a compatibility alias. Local-first Paths, Goals, Roadmaps, Graph, Daily Directives, and objective completion are real. The approved System UI remains the visual reference (`docs/reference/approved-system-ui.png`). This document records the current local-first release contract; it does not define a backend schema. The historical isolation requirement is superseded only for the explicitly approved Beta V1 entry transition.

## 1. Product vision

ASCEND is a personal operating system that turns who someone wants to become into a visible Path, gives them one meaningful daily mission, helps them enter deep focus, and shows how real actions are changing their life.

The System should feel extraordinary, cinematic, premium, personal, mysterious, focused, powerful, and alive. It should remain calm enough to support action rather than becoming a game dashboard.

## 2. Identity hierarchy

The working hierarchy is:

**YOU → IDENTITY → PATHS / GROWTH AREAS → GOALS → MILESTONES → DAILY DIRECTIVE → ACTIONS → REAL-WORLD COMPLETION → PATH EVOLUTION**

YOU is conceptually central. Identity gives direction. Paths are meaningful growth areas such as BUILD, BODY, and VOICE. Goals describe an outcome inside a Path; Milestones make the outcome legible; Actions are the smallest real-world commitments.

## 3. Daily Directive

Today has one dominant object: the **Daily Directive**. It is a meaningful primary mission, connected to a Path, Goal, and Milestone. Candidates are derived from real Roadmap Steps and require acceptance. Users may also create, edit, or explicitly replace a manual Directive. Today contains no seeded mission or objectives. ENTER LOCK-IN passes the actual accepted Directive and saved objectives into focus mode.

Secondary actions can support momentum, but they must remain visually and semantically secondary to the Directive.

## 4. Actions

An Action is an observable real-world step. Completion is a meaningful signal, not a currency reward. Directive objectives are real ordered records saved in the System repository. Completion, editing, and reordering update those records. Removing an objective asks for confirmation; completed Directives are read-only in the UI. Directive completion never automatically completes its linked Roadmap Step.

## 5. Path model

A Path is a user-owned direction of growth that connects identity to action. Beta 1 seeds four suggested Paths: **BODY** (What am I training?), **MIND** (What am I learning?), **FOCUS** (What deserves my attention?), and **SELF** (Who am I becoming?). They are ordinary records, not fixture labels. The model also accepts custom Paths so future additions do not require a migration.

Each Path has `schemaVersion`, an opaque stable `id`, `name`, optional `description`, `source` (`SUGGESTED` or `CUSTOM`), `status` (`ACTIVE`, `PAUSED`, or `ARCHIVED`), `createdAt`, and `updatedAt`. Names are presentation text; references use the id. Archiving keeps the record and its history.

The stable storage key remains `ascend:system:v1`. Beta 2 upgraded the envelope to version 2 and Beta 4 upgraded it to version 3; Path and Goal record contracts remain version 1. Keeping the same key makes guarded Beta 1 builds see the newer envelope and refuse writes rather than create a second, diverging System. Existing Journey, DailyPlan, Today's Win, and Daily Step records remain under their existing keys. Migration and Roadmap records are described below.

## 6. Goal model

A Goal belongs to exactly one Path through `pathId`. It has `schemaVersion`, an opaque stable `id`, `title`, optional `description`, optional `why`, `status` (`ACTIVE`, `PAUSED`, `COMPLETED`, or `ARCHIVED`), `createdAt`, `updatedAt`, and nullable `completedAt`. Editing changes authored text while preserving the Goal id, Path association, and timestamps that future Roadmap and Notes records can reference.

The Path screen keeps the graph primary. Selecting a Path reveals its Goals and a restrained detail area with Add, Edit, Pause, Resume, Complete, and Archive actions. Archived and completed records remain recoverable in the persisted collection but do not count as active Goals. Empty Paths explain the next action without inventing a Goal for the user.

## 7. Graph model

The ASCEND Graph is a semantic, stable-layout SVG projection of YOU, Paths, Goals, Roadmap Phases, and Steps. Global, Path, Goal, and Phase focus progressively reveal real persisted records. It uses curved fine connections, subtle perspective, depth through scale and luminosity, and focusable branches. It is intentionally not a random physics graph or an Obsidian clone. Node placement is stable so meaning does not move while a user explores.

Clicking a Path focuses that branch. Clicking a Goal or Phase reveals the corresponding route detail. Steps expose their recorded completion and prerequisite state in the inspector. Search, ACTIVE/ALL, pan, zoom, fit/reset, and Map ↔ Roadmap navigation operate on the same records.

## 8. Level

Level is intended to represent permanent accumulated progression. Normal daily failure must not reduce permanent Level. Numerical accumulation and thresholds are deliberately unresolved.

## 9. Rank

Rank is intended to represent current progression tier or standing. Its relationship to Level, evidence, time, and recovery is not finalized. Beta V1 shows no Rank value.

## 10. System Stability

Stability is a temporary system condition. It may eventually reflect accepted commitments, completed Lock-In sessions, abandonment, and recovery. Beta V1 shows no Stability percentage or Condition label.

## 11. Conditions

The exploratory condition vocabulary is **STABLE**, **UNSTABLE**, **DEGRADED**, and **DORMANT**. Conditions need definitions, transition rules, user language, and recovery affordances before production use.

## 12. Penalties and recovery direction

The direction is to keep setbacks temporary and recoverable. A normal missed day must not damage permanent Level. Voluntary abandonment may eventually affect Stability or a temporary condition; emergency and legitimate interruptions should not receive punishment. No formulas or penalties are implemented in Beta V1.

## 13. Lock-In

Lock-In is a web focus environment. It hides normal navigation and shows the real Directive, its Path/Goal/Roadmap context where available, and usable saved objectives. The frozen sample countdown is removed: the ring explicitly reads NOW / UNTIMED SESSION. There is no countdown, persisted session, duration tracking, resume-after-refresh, or background timer guarantee. Refresh leaves focus mode but preserves Directive and objective data.

DISTRACTIONS TO AVOID is a fixed, clearly labeled set of suggested reminders. No apps or websites are blocked, no avoidance commitment is inferred, and the list is not saved or configurable. EXIT opens a keyboard-accessible native dialog; Escape closes the dialog and End session leaves focus. A reason can be selected but is not recorded. Emergency and legitimate exits remain available with no penalties. EXIT does not claim a hold gesture. Real blocking would require native integration in a later approved phase.

The future “Deep Lock” direction may require a minimum focus time and primary mission completion. These are product hypotheses, not finalized rules.

## 14. Status

Status uses the approved four-card layout for factual active Path, active Goal, completed Roadmap Step, and completed Daily Directive counts. It also reports completed Goals, completed objectives, and per-Path active Goals and Step completions. Active counts use each record's saved ACTIVE status; completion counts use recorded timestamps or COMPLETED Directive status, including retained history where available. Counts do not measure personal mastery. No Level, Rank, Stability, Condition, fake evidence bars, or invented activity-day counts remain. Unreadable storage reports unavailability rather than fabricated zero values.

## 15. Visual language

The System uses a near-black midnight environment, graphite and translucent surfaces, fine geometric frames, indigo and violet light, icy text, and a small coral signal for sample or interruption states. Depth comes from layered atmosphere, restrained gradients, linework, and selective bloom. There are no external images or copyrighted assets. The System has its own geometry and typography treatment.

## 16. Motion language

Motion is purposeful and short: 120–300ms for interface changes and 300–600ms for meaningful arrival or consequence moments. Alpha includes a brief awakening, panel arrival, branch focus, and a restrained pulse traveling through the active graph connection after completion. It avoids confetti, loot, coins, constant particles, bounce, and interaction-blocking transitions. Reduced-motion users receive the same state changes without spatial or looping motion.

## 17. Real records and remaining examples

Paths, Goals, Roadmaps, Phases, Steps, Directives, and objectives are real local records. Suggested BODY, MIND, FOCUS, and SELF Paths are intentionally offered as editable user records; no Goals or Roadmaps are seeded. The Graph is derived from these records rather than a fixture graph.

The only remaining user-facing sample surface is Lock-In's explicitly suggested distraction reminders. There are no sample missions, actions, fake completion counts, personal initials, age, identity statement, or progression scores. You shows an honest identity empty state, the real active Path count, and device-local storage / no-cloud-account configuration. It does not imply a user-selected focus duration or offer a profile editor.

## 18. Not implemented

The System does not implement AI priority or Roadmap generation, automatic personalized scheduling, Roadmap templates, Node Notes, `[[links]]`, backlinks, a Markdown editor, backend, authentication, native app blocking, persistent Lock-In sessions or countdown timers, cloud accounts or sync, XP, Level formulas, Rank formulas, Stability formulas, penalties, a full Daily History UI, Notes, or backlinks. Standalone Milestone records remain unimplemented; a Roadmap Step can describe a milestone.

## 19. Copyright and originality boundary

ASCEND may take broad conceptual inspiration from progression fiction and games. It must not copy artwork, exact UI panels, logos, sounds, screenshots, character assets, or terminology unique to another work. All alpha geometry, copy, layout, and visual treatment are original ASCEND explorations.

## 20. Future native requirements

True blocking of apps and sites, reliable background timing, device policy, notifications, and cross-device sessions will require a native or mobile integration with explicit permissions and platform-specific safety behavior. The web prototype cannot provide those guarantees.

## Beta 4 Daily Directive contract

Beta 4 replaces the Today fixture with a persisted Daily Directive in the
same `ascend:system:v1` System collection. The collection envelope is now
schema version 3; v1 and v2 records are migrated in memory and only written
as v3 after a successful user operation. Paths, Goals, Roadmaps, Phases, and
Steps retain their opaque IDs and authored content. Malformed or newer data is
left untouched.

A Directive is a dated execution record with an opaque ID, local
`YYYY-MM-DD` date key, title, optional WHY, source type (`ROADMAP_STEP` or
`MANUAL`), optional source Step ID, lifecycle status (`ACTIVE`, `COMPLETED`,
or `ABANDONED`), and timestamps. Directive objectives are separate ordered
records with stable IDs, completion timestamps, and simple add, edit, reorder,
complete, undo, and remove operations.

The local date key uses the browser's local calendar fields; UTC conversion is
not used for daily identity. Candidate derivation is pure and deterministic.
It considers active Paths, active Goals with active Roadmaps, and available
non-archived Steps whose prerequisites are complete. Explicit Roadmap
`activeStepId` selections sort before the next required available Step,
followed by stable Path, Goal, order, and ID comparisons. Candidates are
suggestions only: one is reviewed and accepted, while multiple candidates use
a compact chooser. An accepted Directive is never silently replaced.

Editing a Directive stores a daily snapshot and never edits its source Step.
Completing all objectives enables Directive completion. A linked Roadmap Step
remains incomplete until the user explicitly chooses **Complete Roadmap Step**;
that action calls the existing Roadmap application operation, allowing factual
progress and the existing Graph projection to update normally. Manual
Directives are available without a Roadmap association. Completed and
abandoned records remain persisted for future History work, and unavailable
source records show a restrained notice rather than deleting history.

Today retains the approved compact layout, with the Directive as the visual
anchor, visible Path → Goal → Roadmap context, restrained Map/Roadmap
navigation, and the real Directive title passed into the prototype Lock-In
entry where available.

## 21. Unresolved product decisions

- How are Level contributions measured without incentivizing quantity?
- What makes Rank change, and how should Rank communicate uncertainty?
- Which evidence qualifies as meaningful across different Paths?
- How is Stability derived, and how do users recover without shame?
- When can the System suggest or change a Daily Directive?
- What makes a Lock-In session complete, paused, abandoned, or recovered?
- How should identity evolve while preserving user authorship?
- Which graph scale and history views are useful without becoming analytics?
- What data must be portable before any backend or native integration?

## 22. Roadmap purpose and hierarchy

The execution hierarchy is **YOU → PATH → GOAL → ROADMAP → PHASE → STEP**. A Roadmap answers “What route should I follow to achieve this Goal?” It belongs to exactly one real System Goal through `goalId`; it is part of the same persisted System collection, never a disconnected roadmap database.

Beta 2 permits one Roadmap per Goal, including paused, completed, or archived routes. Restore and edit the existing route rather than create multiple competing routes. Multiple route alternatives remain a later product decision.

**Map** answers “How does everything in my growth connect?” and remains the existing semantic graph / constellation. **Roadmap** answers “What should I do, and in what order, to reach this specific Goal?” and uses a compact vertical progression path. The Path view has a restrained MAP / ROADMAP switch. Roadmap mode selects one Path and one Goal at a time; it never dumps all routes into a graph or board. Beta 2 originally preserved Map; Beta 3 subsequently connected the real Roadmap records as described in section 30.

## 23. Roadmap types and records

**SKILL** supports ordered learning stages with explicit prerequisites, for example Fundamentals → DOM → Events → Async JavaScript → APIs → Build Application. **GOAL** organizes outcomes into ordered phases and milestones, for example Foundation → Run 2 km → Run 3.5 km → Run 5 km → Final Trial. Both routes are constructed manually. There is no AI, web research, marketplace, or template engine.

A Roadmap has record `schemaVersion: 2`, an opaque stable `id`, `goalId`, `type` (`SKILL` or `GOAL`), `title`, optional `description`, `status` (`ACTIVE`, `PAUSED`, `COMPLETED`, `ARCHIVED`), nullable `activeStepId`, `createdAt`, and `updatedAt`. Renaming never changes identity. Pause prevents selection and completion; editing remains possible. Resume restores action. Archive keeps all content and history readable and supports restoration.

## 24. Phase and Step model

A Phase has record `schemaVersion: 2`, an opaque stable `id`, `roadmapId`, `title`, optional `description`, integer `order`, nullable `archivedAt`, `createdAt`, and `updatedAt`. Reordering changes order, never identity or creation time. Live sibling orders are distinct. Restoring an archived Phase appends it without overwriting the existing order. Archiving a Phase hides its children from live progression without deleting or rewriting them; archived history remains readable.

A Step has record `schemaVersion: 2`, an opaque stable `id`, `roadmapId`, `phaseId`, `title`, optional `description`, integer `order`, boolean `optional`, `prerequisiteStepIds`, nullable `completedAt`, nullable `archivedAt`, `createdAt`, and `updatedAt`. It represents a meaningful skill, milestone, or stage, not a Daily Directive task. Users can add, edit, reorder, select, complete, undo completion, archive, and restore Steps. Editing a Step's title, optional property, and prerequisites is one validated save; a failed dependency edit never partially saves the text.

Archive is the removal operation in Beta 2. No destructive delete exists. Completed timestamps survive archive/restore. Dependencies from live Steps prevent archiving a required prerequisite or its Phase. Dependencies inside an archived Phase remain as history. Restoring a dependent Phase may require restoring its prerequisite first. Undo is refused while a completed dependent (including archived history) or the current Step would become invalid. Users can choose another current Step or undo dependents first; no dependent history is silently rewritten.

## 25. Prerequisites and derived Step states

Only SKILL routes accept prerequisites. References must point to existing Steps in the same Roadmap; cross-Phase references are supported. Duplicate references, direct self-dependency, missing parents, duplicate record IDs across the System, and chains that form cycles are rejected. A live Step cannot depend on archived content. This is bounded dependency validation, not a graph editing engine.

Order communicates the route, but does not implicitly lock Steps. Explicit prerequisites determine locking. Every listed prerequisite must be completed, including an optional Step that the user explicitly chose as a prerequisite. “Optional” excludes a Step from required progress; it does not bypass its own prerequisites.

Step state is derived and never persisted separately:

- **COMPLETED:** `completedAt` is present.
- **LOCKED:** any listed prerequisite lacks completion.
- **ACTIVE:** prerequisites are satisfied and `activeStepId` selects this live, incomplete Step.
- **AVAILABLE:** prerequisites are satisfied and the Step is not selected.

Optional is a property, so an optional Step can be available, active, locked, or completed. Labels and markers communicate state without relying on color.

## 26. Current Step and factual progress

An available Step can be explicitly selected as current. Reordering, unrelated completion, and refreshing never replace that choice. Completing or archiving the current Step clears its selection. The next live available required Step in Phase/Step order is shown as **NEXT AVAILABLE · SUGGESTED**; if no required Step is available, an available optional Step can be suggested. The user chooses whether to select it. Reading never writes the suggestion to storage. Paused and archived routes return no actionable current Step.

Progress shows literal counts: completed live Steps / total live Steps, completed required live Steps / total required live Steps, and the current or suggested Step's Phase position. Archived content is retained as history but excluded from live counts. Required completion changes an active route to COMPLETED when there is at least one required Step and all are complete. For an all-optional route, all live Steps must be complete. Empty routes are never complete. Optional Steps remain actionable after required completion. Adding or restoring incomplete required content, or safely undoing completion, reopens a completed route. Paused and archived statuses stay under user control.

These counts measure recorded completion, never personal mastery, skill scores, XP, Rank, Level, or Stability.

## 27. Beta 2 persistence and migration

The existing `SystemRepository` persists Paths, Goals, Roadmaps, Phases, and Steps in one versioned collection through `KeyValueStore`. UI → application services → domain → repository → storage remains the boundary; React never accesses Web Storage.

The deliberate v1 → v2 migration validates the whole Beta 1 collection, preserves every Path and Goal, id, parent reference, status, timestamp, authored field, and unknown extension, then adds empty `roadmaps`, `roadmapPhases`, and `roadmapSteps` arrays. Path/Goal record versions stay 1. Loading migrates only in memory. Original stored bytes remain unchanged until a successful user edit writes the complete v2 collection. Migration refuses conflicting unversioned Roadmap fields rather than overwrite them.

The reader rejects malformed records, orphan references, invalid dependencies, ordering collisions, and future collection or record versions as a whole. It never drops invalid records to salvage the rest. Every save rechecks the current stored bytes and refuses malformed/future data. Unsupported data stays untouched and the UI reports it. Storage and quota failures retain the prior saved collection and editor input. Guarded Beta 1 clients refuse the v2 envelope. There is no migration of production Journey data.

Application services expose create/edit/pause/resume/archive Roadmap; add/edit/reorder/archive/restore Phase; add/edit/reorder/set optional/set prerequisites/set active/complete/undo/archive/restore Step; and a repository-backed `getCurrentStep(goalId)` query. Business validation is pure domain code. No Today UI dependency is introduced.

LocalStorage remains synchronous and device-local. There is no cross-tab compare-and-swap or merge protocol; same-version simultaneous edits remain an inherited limitation. Before any backend or sync phase, conflict handling and export/recovery need a deliberate design.

## 28. Future Graph and Today integration boundaries

Beta 3 can consume these actual records using Goal `id` → Roadmap `goalId`, Roadmap `id` → Phase/Step `roadmapId`, Phase `id` → Step `phaseId`, and Step prerequisite IDs. IDs stay stable through renames, reorders, completion, and archives. Graph node identity can use namespaced keys such as `roadmap-step:<id>` and read display labels from titles; archived history remains queryable. Beta 2 originally exposed none of these records as Map nodes; Beta 3 now uses the shared projection in section 30.

A future application service can call `getCurrentStep(goalId)` and receive either the explicitly selected Step or a separately marked suggestion. Beta 4 connects that bounded query to a user-confirmed Daily Directive without adding prioritization intelligence.

## 29. Interface safety and verification boundary

The vertical route keeps the current Step dominant, completion visible, locked content readable, and optional Steps explicitly labeled. It supports no-Goal, no-Roadmap, no-Phase, empty-Phase, completed, paused, archived, storage unavailable, malformed, and future-schema states. Archive history is expandable and recoverable. Reordering uses labeled Up/Down buttons with keyboard access; no drag gesture is required. Forms have labels, focus, semantic fieldsets, status/error announcements, and 44px controls. The mobile route is a single column, not a compressed desktop timeline; System reduced-motion settings apply.

An open Roadmap form must be saved or canceled before switching Goal, Path, or Map mode. System section navigation preserves the form in memory, including entering and exiting Lock-In. A browser unload guard protects an open form from silent navigation loss; drafts are not separately persisted. This is a bounded safety behavior, not a Notes or draft persistence system.

Beta V1 removes the historical Alpha/Beta progression, identity, mission, objective, and timer fixtures. No Roadmap, Phase, or Step is sample-seeded. Numerical formulas and every deferred feature in section 18 remain unresolved or unimplemented.

## 30. Beta 3 Graph projection and navigation

Beta 3's ASCEND Graph is a read-only projection of the persisted System collection. It does not create a graph database or duplicate authored records. The projection maps `YOU` to Path records, Paths to Goals, Goals to Roadmaps, Roadmaps to Phases, and Phases to Steps. SKILL prerequisite IDs may produce a separate prerequisite edge in Goal and Phase focus. Note, backlink, and free-form relationship records remain out of scope.

Global View prioritizes YOU, visible Paths, and active Goals. Focus View progressively reveals the selected Path's Goals, then a selected Goal's Roadmap Phases and current or nearby Steps. Phase focus reveals that Phase's Steps. Semantic zoom changes which records are rendered; it does not merely shrink labels. ACTIVE filtering hides archived records and keeps current work prominent. ALL includes retained historical records where useful.

Node keys are namespaced from stable source IDs (`path:<id>`, `goal:<id>`, `phase:<id>`, and `step:<id>`). Titles and positions are presentation values and never identity. Structural edges use solid connections; prerequisite edges use a visually distinct dashed treatment. The projection derives status, completion, optional, locked, and current state from existing records.

Layout is deterministic and semantic. YOU is the stable anchor. Suggested Path names receive preferred geographic sectors (MIND upper, BODY left, FOCUS right, SELF lower); custom Paths receive stable sectors ordered by their opaque IDs. Goals grow from their Path, and focused Goal layouts use ordered Phase and Step layers. Reopening the same data produces the same positions, including after a title edit. Camera pan, bounded zoom, reset, and fit are transient UI state and are never persisted.

Map and Roadmap remain separate views of the same Goal. A Goal inspector's **OPEN ROADMAP** enters the existing Roadmap mode for that Goal. Roadmap's **VIEW IN MAP** returns to Map and focuses the corresponding Goal. Search uses normalized substring matching over Paths, Goals, Phases, and Steps; selecting a result reveals and selects its branch. The compact inspector exposes only data already present in the Path, Goal, Phase, Roadmap, or Step records.

Graph nodes are keyboard controls with visible focus and meaningful accessible names, and the inspector provides a semantic text representation of the selected record. The graph stage supports pointer drag on desktop and touch, with explicit zoom controls on every viewport. Reduced-motion users receive immediate state changes without traveling pulses. Completing a persisted Step may briefly pulse its visible structural branch; the animation is transient and is not replayed after refresh.

Empty, unavailable, malformed, and future-schema states use explicit recovery or creation messaging and never insert fake graph nodes. The graph projection and layout remain pure, testable functions; React owns only transient focus, search, camera, and inspector state. Beta 3 requires no schema migration and no runtime graph dependency.

## 31. Beta V1 release boundary

The real core loop is **PATH → GOAL → ROADMAP → GRAPH → DAILY DIRECTIVE → ACTION → COMPLETION → ROADMAP UPDATE → GRAPH UPDATE**. Only the user explicitly completes a linked Step. Both entry routes render the same System screen directly; no redirect, cloned screen, Journey migration, legacy deletion, new schema version, or runtime dependency is introduced. Legacy /today, /journey, /progress, /you, and onboarding routes and their data remain in the repository.

Persistence remains collection version 3 at ascend:system:v1. Version 1 and 2 migration is read-only until a successful save. Conflicting older unversioned Directive fields, malformed records, and future schemas are refused without overwriting bytes. Directive/objective authored text and unknown record extensions survive read/save. Timestamp and calendar-date validation reject malformed execution data. No legacy Journey, DailyPlan, TodayWin, or DailyStep key is changed by the System flow.

Release polish retains the approved visual composition. Controls expose visible focus, named graph actions, labeled forms and errors, accessible objective completion, and a named exit dialog. The responsive pass covers 1440×900, 768×1024, and 375×667, plus 200% reflow and reduced motion. Verification is a concrete regression pass, not accessibility certification.

Known limits: one browser/device, no cross-tab merge protocol, no export/recovery UI, and no persistent editor drafts. Today and Path drafts survive section navigation in memory; explicit cancel or browser reload can discard them. Today, Roadmap, and Path forms install an unload warning while editing. Lock-In state, focus-list suggestions, and exit reasons are transient. The completed daily record remains visible for its local day; the next local day offers the next real candidate. AI prioritization, XP, Level/Rank/Stability formulas, penalties, cloud accounts, sync, native blocking, the full persistent Lock-In engine, Notes, Markdown, and backlinks remain unimplemented.

This is a release candidate only. No deployment, automatic commit, or later feature phase is authorized by this work. See docs/ascend-beta-v1-release-verification.md for the verification evidence and its limits.
