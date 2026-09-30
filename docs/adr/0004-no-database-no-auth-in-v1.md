# ADR 0004 — No database and no authentication in V1

- **Status:** Accepted (Phase 1, from architecture review)
- **Date:** 2026-10-01

## Context

The production plan lists `users`, `journeys`, `goals`, `growth_areas`,
`daily_plans`, `daily_actions`, `point_events` and more. The free-plan constraint
and the product plan both say the database arrives *after* the daily experience has
been used and validated.

There is a real risk in the opposite direction too: a schema built in Phase 1 tends
to encode assumptions that only become visible after real use.

## Decision

V1 has **no database** and **no authentication**.

- `wrangler.jsonc` declares `"d1_databases": []`. Nothing is provisioned.
- No login, register, password, session or OAuth code exists.
- There is exactly one implicit local user. Entity IDs are generated locally and
  never assume a server-assigned identity.

`domain/` and repository interfaces are still designed so that adding a `userId`
scope and a remote implementation later is additive rather than structural.

## Rationale

**An unprovisioned, unused schema is a liability.** It encodes guesses — the wrong
granularity of a completion, the wrong milestone shape, the wrong point-event
model — and nothing rewrites a wrong schema cheaply once it holds real personal
history.

**Custom authentication would be worse than none.** ASCEND holds goals and personal
reflections. Homemade auth, homemade password hashing, or weakening a real
provider's security to fit infrastructure would be a serious failure. Deferring is
the only responsible option.

**It removes the highest-risk code from V1.** No credentials, no sessions, no
authorisation surface, nothing to breach.

**The Free plan is not the reason; it agrees with the plan.** D1 on the Free plan
would be fine. Deferring is a product decision, and the free-plan constraint merely
removes the objection to it.

## Consequences

**Good**

- Nothing to secure, migrate or back up in V1.
- Data lives in one browser on one device, which is trivially exportable.
- The database schema will be designed against real usage.

**Bad / accepted costs**

- Data is not available across devices or browsers.
- Clearing browser data destroys it. Mitigated by JSON export arriving with the
  settings screen, and by honest copy rather than a false promise of safety.
- There is no real account deletion until Phase 12+. The V1 equivalent —
  explicit "delete everything" — must ship with the data.

## When to revisit

Phase 11 (D1 backend) and Phase 12 (auth + sync). At that point, a proven
authentication provider is evaluated separately. It is not a Phase 1 decision.

## Related

- ADR 0001 — Workers + Static Assets.
- ADR 0002 — repository interfaces make the swap additive.
