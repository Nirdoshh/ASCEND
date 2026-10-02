# ADR 0015: System graph projection and deterministic layout

**Status:** Accepted for ASCEND System Beta 3  
**Date:** October 2026

## Context

The System Map needs to show the same persisted Paths, Goals, Roadmaps, Phases,
and Steps used by the existing screens. A second graph store would duplicate
user truth and create identity and migration problems. A force simulation would
also move records unpredictably as text or data changes.

## Decision

Build a pure, read-only graph projection from `SystemData`. Namespaced node keys
contain the source record ID, and edges are derived from existing parent IDs and
SKILL prerequisite IDs. The projection is filtered and semantically zoomed by
focus: global exposes Paths and active Goals; Path focus exposes that branch;
Goal and Phase focus reveal ordered Roadmap detail.

Use deterministic sector, radial, and layered placement. YOU is the stable
anchor, suggested Path names receive preferred regions, custom Paths are ordered
by opaque ID, and focused branches use record order. Camera state is transient
React state. No graph coordinates or graph-only records are persisted.

## Consequences

Renaming a record cannot change its graph identity or rearrange unrelated
records. Larger graphs can be progressively disclosed without adding a runtime
graph dependency. Projection and layout can be tested as pure functions. The
tradeoff is that bespoke user positioning is not supported; that remains a
separate product decision.
