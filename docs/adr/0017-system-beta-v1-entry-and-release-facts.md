# ADR 0017 — Beta V1 entry and factual release readouts

- **Status:** Accepted (ASCEND Beta V1 release candidate)
- **Date:** 2026-10-03

## Decision

Render the existing `SystemScreen` at `/` and `/system`. Both routes sit outside
the legacy Journey guard. Direct rendering needs only one root-route element
change, keeps `/` as the product URL, and avoids a redirect or duplicated screen.
The explicitly approved release transition supersedes the historical isolated
prototype requirement for entry routing only. Legacy routes, code, and storage
remain available and untouched.

Use the existing Status card composition for counts derived from persisted
records. Active Paths and Goals count their saved ACTIVE status. Completion
counts use recorded timestamps / completed Directive status and retained
history where available. No XP, Level, Rank, Stability, Condition, or mastery
formula is introduced. You presents neutral configuration and an identity
empty state. The sidebar has no assumed initial or progression value.

Lock-In receives the real Directive and writes objective changes through the
existing application service. Replace the frozen sample timer with an explicit
untimed session and the sealed-app claim with suggested distractions to avoid.
The focus list and exit reason remain transient; native blocking and the full
persistent session engine remain deferred.

Keep collection schema version 3 and its stable storage key. Harden the existing
reader without changing fields: refuse conflicting v2 Directive extensions,
validate execution dates/timestamps, and preserve authored text and unknown
Directive/objective fields on reads and edits. Unsupported data is left intact.
This follows ADRs 0014 and 0016 rather than adding a migration or recovery reset.

## Consequences

Cold loads and refreshes on both routes use the existing Workers Static Assets
SPA fallback. No hosting or Worker changes are required. Legacy Journey data is
not converted into System records. Local data remains specific to its origin;
users moving to another origin or device will not have automatic transfer.

Navigation, camera, Lock-In state, and draft editors remain transient. This
release adds no runtime dependency, backend, authentication, sync, or later
feature phase. Browser verification is local and does not constitute deployment
or accessibility certification.
