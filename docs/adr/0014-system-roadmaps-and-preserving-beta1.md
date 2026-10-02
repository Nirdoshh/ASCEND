# ADR 0014 — Goal-owned System Roadmaps and preserving Beta 1

- **Status:** Accepted (System Beta 2)
- **Date:** 2026-10-02

## Decision

Extend the existing System collection to schema version 2 with Roadmaps,
Phases, and Steps, linked by opaque parent IDs to real System Goals. Keep
unchanged Path and Goal record contracts at version 1. New records use version
2. Retain the stable `ascend:system:v1` key: guarded Beta 1 clients must see the
new envelope and refuse writes, rather than continue editing a stale fork.
This is an explicit System exception to the key-per-version convention in
ADR 0002, following the read/write protections in ADRs 0011 and 0012.

The sequential v1 → v2 migration adds only empty Roadmap arrays, preserves
original records and unknown fields, and runs on read without writing. A
successful user operation persists the upgraded collection atomically in one
Web Storage write. Malformed or future-schema collections are never replaced.
No production Journey contracts or keys change.

Beta 2 allows one Roadmap per Goal, including archived routes. Archive and
restore retain stable identities, authored text, and completed history. No
destructive removal API exists. Phase archive hides children without deleting
them. Live prerequisites may not reference archived content; completed history
and the explicit current selection must remain valid after every operation.

Persist completion timestamps, optional properties, ordered positions, and
one explicit `activeStepId`. Derive locked/available/active/completed states
and next suggestions. Suggestions never replace selection or cause read-time
writes. SKILL prerequisites are explicit same-Roadmap references with cycle
validation; GOAL routes use ordering without dependency locks.

Map keeps its existing graph. Roadmap is an ordered, single-Goal execution
view. `getCurrentStep(goalId)` is an application query for future integrations,
with no Today coupling. Beta 3 can use stable record IDs and parent references
without adding Map nodes in Beta 2.

## Accepted limits

Local persistence remains device-local and synchronous. Same-version
simultaneous-tab conflict handling, persistent editor drafts, export/recovery,
multiple alternate Roadmaps, and moving Steps between Phases are not part of
this slice. There is no backend, AI generation, Notes, progression formula,
or Daily Directive automation.
