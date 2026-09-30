# ADR 0003 — Design tokens in CSS custom properties, no utility framework

- **Status:** Accepted (Phase 1)
- **Date:** 2026-10-01

## Context

The design system needs reusable primitives for typography, spacing, radius,
elevation, buttons, inputs, cards, progress, navigation and states. The brief
allowed Tailwind CSS, CSS variables, or an equivalent token approach.

## Decision

Plain CSS with custom properties as the design token layer. No Tailwind, no
component library, no CSS-in-JS.

- `src/styles/tokens.css` — every colour, size, radius, shadow and duration
- `src/styles/base.css` — reset and element defaults
- `src/styles/utilities.css` — a deliberately small set of shared helpers
- Component stylesheets are co-located next to their component

## Rationale

**The design system should be one file you can read.** With tokens, the entire
visual language is ~300 lines of custom properties. With utilities, the visual
language is spread across component files as class strings, and "what colours does
this app use?" becomes a search problem.

**Semantic naming survives re-branding.** `--text-secondary` and `--color-accent`
describe purpose. `--grey-500` describes an implementation and has to be rewritten
when the palette changes.

**Contrast can be reasoned about centrally.** Every text colour is declared once,
so "does this pass AA?" is answerable by reading the token file, not by auditing
every component.

**Fewer moving parts in a learning project.** No build plugin, no class-merging
rules, no dark-mode variant of every utility. What you read in a component is what
the browser receives.

**Dark mode re-points tokens, not components.** The `@media (prefers-color-scheme:
dark)` block and `[data-theme='dark']` block override the same names. No component
knows which theme is active.

## Consequences

**Good**

- Zero runtime cost, zero extra build step, zero extra dependencies.
- Dark mode and contrast are verifiable by reading two blocks of one file.
- A stylesheet is inspectable and debuggable without tooling.

**Bad / accepted costs**

- **More verbose at the call site than utilities.** `<div class="stack-lg">` beats
  nine `mt-1 mb-1 flex flex-col gap-4` classes. Accepted: readability wins.
- **No automatic dead-CSS elimination.** Vite emits one stylesheet (~17 kB, ~4 kB
  gzipped). Negligible now; revisit if it ever matters.
- **Consistency depends on discipline**, not on a linter. There is no tool forcing
  `Button` instead of a raw `<button>`. Mitigated by re-exporting the design system
  from `src/components/ui/index.ts` and reviewing for it.
- No utility framework means no safe variant-conflict resolution. If we later need
  `cn()` to resolve competing classes, that is the one file to revisit.

## When to revisit

If the team grows, or component authoring slows measurably, the tokens stay and
Tailwind can be added *on top* — mapping tokens into Tailwind's theme. That is the
reason tokens are the contract rather than utility classes.

## Related

- `src/styles/tokens.css`
- `src/features/designsystem/DesignSystemScreen.tsx` — a living reference at `/design-system`
