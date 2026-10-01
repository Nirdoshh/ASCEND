# ADR 0007 — Growth Area identity is opaque, never derived from a name

- **Status:** Accepted (Phase 2A architecture correction)
- **Date:** 2026-10-01

## Context

Phase 2A derived a Growth Area's `id` from its normalized name:

```ts
// Phase 2A — id and comparison key were the same string
{ id: 'digital marketing', name: 'Digital Marketing' }
```

That made duplicate detection free: two areas were the same area exactly when
their ids matched. It also meant the id changed whenever the name did.

The name is not a stable thing. It gets corrected for spelling, translated, given
different capitalization, and — from Phase 2B onward — renamed by the user
themselves. Every stored thing that points at a Growth Area points at that id:
milestones, daily actions, `PointEvent`s, weekly reviews, and eventually D1 rows.

So the design made "change your mind about a spelling" indistinguishable from
"delete and recreate this area", with data loss spread across several tables and
no error anywhere.

## Decision

A Growth Area has **three separate names**, and no two of them may be conflated:

```ts
interface GrowthArea {
  id: string             // opaque, assigned once, never recomputed
  name: string           // display text, preserves the user's capitalization
  normalizedName: string // comparison key only, NEVER an identifier
}
```

Rules that follow:

1. **The id is minted once at creation and read forever after.** It is never
   re-derived, including by the repository's repair path.
2. **Duplicates are compared by `normalizedName`**, so `Digital Marketing`,
   `digital marketing` and `DIGITAL   MARKETING` are still one area.
3. **Renaming changes `name` and `normalizedName` and leaves `id` alone.**
4. **Suggested areas have hardcoded, hand-written ids** (`ga_s_fitness`,
   `ga_s_communication`, …), pinned by a test. The slug is not computed from the
   display name, which is exactly what makes a future rename safe.
6. **Every id carries the namespace prefix of its origin**, so the three id
   spaces are disjoint by construction rather than by an incidental property.
5. **Suggested and custom areas are the same shape with the same behaviour.**
   Nothing downstream can tell them apart, so the suggestion list cannot quietly
   become a limit.

## Rationale

**Renaming is a thing people do.** If identity follows the label, then adding a
rename feature in Phase 4 silently breaks references that already exist. The
inverse is free: an opaque id costs one generated string.

**Two areas with the same name on two devices must be two areas.** This is what
makes Phase 11 cross-device sync and any later merging possible. Name-derived ids
collapse them into one and the collision is unrecoverable.

**The comparison key is still needed, but it is not an identity.** Normalizing
casing and whitespace is a display concern. Keeping it separate is what lets
duplicate detection stay strict while identity stays stable.

**Hand-written suggested ids are a permanent contract.** Pinning them in a test
turns "someone renamed Communication to Talking" from an invisible data
corruption into a reviewed, deliberate change.

## Consequences

**Good**

- Renaming is safe, and enforceable by a test rather than by a comment.
- Two users typing the same thing get two distinct areas.
- Every future reference is an id, so D1 rows, point events and reviews cannot
  break on a spelling correction.
- Duplicate detection is unchanged in behaviour, so all Phase 2A UX still holds.

**Bad / accepted costs**

- Every stored v1 draft needs a migration, because its ids *were* names. See
  `ONBOARDING_DRAFT_MIGRATIONS` and the schema bump to 2.
- `normalizedName` is now stored derived data, so it must never be trusted on
  read. The repository recomputes it from `name` every load.
- One extra field per area. Cheap, and it is what buys the rename guarantee.
- A second schema bump to 3, because the id spaces were separated by suffix
  length rather than by prefix. See "Id spaces" below.

## Id spaces

Three ways an id is born, none of which can collide with another:

| Origin | Prefix | Suffix | Property |
| --- | --- | --- | --- |
| Suggested | `ga_s_` | hand-written slug | pinned by a test |
| Custom (new) | `ga_c_` | `crypto.randomUUID()` prefix | 16 chars, 122 bits |
| Recovered (migrated from v1, or repaired) | `ga_m_` | FNV-1a of the old name | 14 chars, deterministic |

### Why an explicit prefix per origin

The first version of this ADR gave all three the single prefix `ga_` and relied
on **suffix length** to keep them apart. That worked by accident rather than by
design: suggested slugs have variable length, so nothing prevented a future
suggestion with a 14- or 16-character slug from being read as a custom or
migrated id. In that world, migrating such a draft would move the suggestion
into a custom namespace and every stored reference to it would break.

With a distinct prefix per origin, no id can match two namespaces whatever
follows it. The differing lengths are kept as a cheap cross-check, but nothing
depends on them any more. A test asserts both properties, and one asserts that a
14- or 16-character slug is still classified as a suggestion — a case the shipped
suggestion list cannot produce, which is exactly why it needed its own test.

The recovered form is **deterministic on purpose**. A random id generated at
migration time would be re-minted on every page load, and the user's selection
would appear to vanish each time they reopened the app. Hashing is not a return
to name-derived identity: the result is computed once, stored, and opaque
forever after. The same hash is used to rebuild an id that is found missing or
blank, because that is also a recovery rather than a mint.

## Related

- `src/domain/growthAreaId.ts` — the three id namespaces and why they are disjoint
- `src/domain/growthAreaName.ts` — display vs comparison normalization
- `src/domain/growthAreas.ts` — `GrowthArea`, `createCustomGrowthArea`, `mergeGrowthAreas`
- `src/data/repositories/onboardingDraftRepository.ts` — the v1 → v2 and v2 → v3 migrations
- ADR 0002 — versioned storage keys and migrations
