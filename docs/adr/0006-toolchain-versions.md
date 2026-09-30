# ADR 0006 — Pin TypeScript to 6.x and ESLint to 9.x

- **Status:** Accepted (Phase 1.5)
- **Date:** 2026-10-01

## Context

Phase 1 installed the newest published versions: TypeScript 7.0.2 and, at the time of
writing, ESLint 10.

Adding the ESLint gate required `typescript-eslint`, `eslint-plugin-react`,
`eslint-plugin-react-hooks` and `eslint-plugin-jsx-a11y`. Two of them declare peer
dependency ranges that exclude the installed versions:

| Package | Declares | Excludes |
| --- | --- | --- |
| `typescript-eslint@8.71.0` | `typescript >=4.8.4 <6.1.0` | TypeScript 7 |
| `eslint-plugin-jsx-a11y@6.10.2` | `eslint ^3 \|\| ... \|\| ^9` | ESLint 10 |

TypeScript 7 is the native (Go) compiler. `typescript-eslint` parses TypeScript through
the JavaScript compiler API, which is the part 7 most aggressively changes. The
`<6.1.0` cap is the maintainers telling us they have not validated against it.

## Decision

Pin **TypeScript 6.0.3** and **ESLint 9.39.5**. Accept one npm deprecation warning for
ESLint 9 ("no longer supported") as a deliberate, known cost.

`eslint-plugin-jsx-a11y` is the binding constraint on the ESLint major version: its peer
range stops at 9, so taking ESLint 10 would mean either dropping the accessibility
plugin the accessibility goal requires, or running permanently with
`--legacy-peer-deps` and an unverified combination.

## Rationale

**A linter on an unvalidated compiler is worse than an older compiler.** Two ways this
can fail: silently mis-parsing a construct, or reporting errors that are artifacts of
the version gap. Both waste more time than the TypeScript version gap does, and neither
is visible as a version warning at the point of the mistake.

**A clean install is worth more than the newest version number.** ESLint 9 is the last
release `jsx-a11y` supports. ESLint 10 would have meant `--legacy-peer-deps`, which
turns off the mechanism npm uses to tell us our combination is untested — precisely the
signal we wanted.

**This is cheap to reverse.** TypeScript 6 → 7 is a version bump plus a `tsc -b` run.
Nothing in our code depends on TypeScript-7-specific behaviour, and our tsconfigs use
long-stable options.

## Consequences

- Phase 1.5 verifies the downgrade changed nothing: `tsc -b` clean across all three
  projects, all 75 tests passing, build byte-identical (1.29 kB Worker, 105.23 kB gzip
  client, 4.01 kB gzip CSS).
- `typescript-eslint` gains its type-checked `no-floating-promises` and
  `no-misused-promises` rules with full support, which is worth more than the TypeScript
  version itself. Both are live: see the probe documented in `eslint.config.js`.
- Revisit when `typescript-eslint` widens its range to include TypeScript 7. That is the
  trigger to upgrade, and only that.

## Rejected

- **Keep TypeScript 7, force ESLint 9 with `--legacy-peer-deps`.** Disables the peer
  check that exists to warn us, in order to have a compiler version the linter has not
  been tested against. Trades a known-good toolchain for an unknown one.
- **ESLint 10, drop `jsx-a11y`.** The accessibility target is a product requirement, and
  a linter cannot compensate for a missing plugin later.
- **Keep ESLint 10 and `jsx-a11y` on 9 with a `resolutions`/override field.** Records the
  conflict in `package.json` instead of resolving it. We would still be running an
  unsupported combination, just with a comment.
- **`--legacy-peer-deps` everywhere.** Trains us to ignore install warnings, which is the
  opposite of what this gate is for.