# ADR 0005 — One typed Preferences object, no settings key/value system

- **Status:** Accepted (Phase 1, from architecture review modification 4)
- **Date:** 2026-10-01

## Context

The first architecture proposal modelled settings two ways at once:

- `users.prefs` as a JSON column
- a separate generic `settings(user_id, key, value)` table

That is two competing sources of truth for the same data, and neither was needed.

## Decision

One `Preferences` object with named, typed fields, stored under one versioned key.

```ts
interface Preferences {
  schemaVersion: 1
  theme: 'system' | 'light' | 'dark'
}
```

New preferences are added as fields on this object, not as new rows.

## Rationale

**A generic key/value store moves type errors to runtime.** `settings.theme` is a
string at the database level and only becomes `'light' | 'dark'` if something
validates it. With a typed object, an invalid value is a compile error at the point
it is written.

**Every field gets validated.** `migrateAndNormalize` checks each field
independently and substitutes a default for anything invalid, so corrupt or
hand-edited storage can never reach the UI as an unexpected shape.

**There is no real need yet.** Preference 1 says dark and light mode; nothing else
is required in Phase 1. Building a table for a requirement that does not exist is
complexity with no benefit.

**Migration safety comes free.** Because the object is versioned, adding
"reduce motion" later is one field plus one migration entry — a change the V1 code
was already shaped to accept.

## Consequences

**Good**

- No dual source of truth.
- Preferences are fully typed and validated in one place.
- Adding a preference is a two-line change plus a migration.

**Bad / accepted costs**

- Every preference is read as a whole object. At V1 volumes this is irrelevant;
  it would matter only with hundreds of rows, which a preferences object will never
  have.
- A genuinely open-ended, user-defined settings system would need a key/value
  store. ASCEND does not want one — the user should not be given arbitrary knobs.

## Related

- `src/data/repositories/preferencesRepository.ts`
- ADR 0002 — versioned storage keys.
