# ADR 0016 - System Daily Directives and local-day execution records

- **Status:** Accepted (System Beta 4)
- **Date:** 2026-10-02

## Decision

Extend the existing `ascend:system:v1` System collection from schema version 2
to version 3 with `directives` and `directiveObjectives` arrays. The v1 to v3
and v2 to v3 migrations are read-only and add empty arrays only when the older
collection has no conflicting extensions. A successful operation writes one
validated v3 envelope. Malformed and newer collections remain untouched.

Directive records are immutable-in-history daily execution snapshots. They
retain opaque IDs, local `YYYY-MM-DD` date keys, authored text, source type,
optional source Roadmap Step ID, lifecycle status, and timestamps. Objectives
are separate ordered records so completion and safe explicit removal do not
rewrite the linked Roadmap Step. Source IDs are references, not live text
mirrors; unresolved sources remain historical records.

The local date key is derived from the browser's local `Date` calendar fields.
UTC conversion and timezone libraries are intentionally avoided. Candidate
derivation is pure and deterministic: active Path, Goal, and Roadmap records
with available Steps are considered; explicit active Steps sort before the
next required available Step, followed by stable authored labels and IDs.
Candidates are suggestions. The user must accept one, create a manual
Directive, or explicitly replace an active Directive; no candidate silently
overwrites accepted history.

Directive completion only records the Daily Directive. Completing a linked
Roadmap Step is a separate explicit action delegated to the existing Roadmap
application service, preserving one source of Roadmap completion truth and
allowing Map projection to update from persisted state.

## Consequences

Today can explain Path, Goal, Roadmap, and Step context while retaining a
future-friendly execution history. The web prototype still has no AI ranking,
automatic scheduling, progression formulas, calendar UI, backend, or native
Lock-In engine. Secondary Roadmap action presentation remains intentionally
bounded until a later phase.
