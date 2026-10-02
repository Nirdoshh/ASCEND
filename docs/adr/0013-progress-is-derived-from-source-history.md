# ADR 0013 — Progress is derived from source history

- **Status:** Accepted (Phase 3E)
- **Date:** 2026-10-02
- **Related:** ADRs 0002, 0003, 0004, 0007, 0011 and 0012

## Context

Journey, DailyPlan and Daily Step completion already contain the source data for
observable activity. DailyPlans are keyed by Journey ID and local date; Step
arrays are keyed by plan ID. There is no historical enumeration API. The existing
nullable storage read cannot distinguish absence from failure and used to remove
malformed JSON, which is unsafe when analyzing retained history.

## Decision

ProgressSnapshot and ProgressDay are derived, transient domain values. No counters,
completion copies, summary keys or persisted contracts are added. Schema versions
remain unchanged; ADR 0012 requires a migration when persisted fields change,
which this phase does not do.

DailyPlanRepository exposes `listForJourney`, returning validated plans in date
order. JourneyRepository and DailyStepsRepository expose explicit read results so
the application can distinguish missing data, storage failure, invalid data and
future schemas. Key enumeration stays behind the storage/repository boundary;
Progress never scans storage and never reads unrelated values.

Historical reads preserve bytes and perform no writes, removals or persisted
migrations. Nullable storage reads also stop deleting malformed JSON, including
when startup routing reads a Journey before Progress mounts. Historical errors
withhold the snapshot rather than present partial totals as complete history.
Existing repository write guards remain intact.

Activity belongs to each plan's saved local date. Completion timestamps are used
only to determine whether Steps are complete, never to reassign a day's activity.
Journey time uses the browser timezone to convert startedAt into a start calendar
date, then calendar arithmetic unaffected by DST. Journey v1 does not store its
original timezone; travel can change the reconstructed start date, but never the
dates of saved activity. A schema extension for timezone policy is deferred.

The existing Today top-level route remains in place but renders inside AppShell,
restoring navigation to Progress and shared error containment. The Today tab uses
the canonical `/today` URL; `/` still redirects as before. No destinations are added.

## Consequences

Completing/uncompleting or removing a Step changes the next derived snapshot
without synchronization. Deleted Steps and orphan lists without a plan cannot be
reconstructed; these totals describe retained source records, not an event log.

V1 reads are synchronous and linear in source size, with plan sorting. There is
no cache, chart library, indexing engine, backend, or persisted derived summary.
Progress refreshes on mount and retry; live cross-tab/midnight refresh is deferred.

Metric definitions and verification evidence are in
[Progress foundation](../progress-foundation.md).
