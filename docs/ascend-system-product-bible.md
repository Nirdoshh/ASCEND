# ASCEND SYSTEM — Product Bible

**Status:** System Prototype Alpha, October 2026
**Scope:** Isolated `/system` experience with sample fixtures. This document records direction and open questions; it does not define a production schema.

## 1. Product vision

ASCEND is a personal operating system that turns who someone wants to become into a visible Path, gives them one meaningful daily mission, helps them enter deep focus, and shows how real actions are changing their life.

The System should feel extraordinary, cinematic, premium, personal, mysterious, focused, powerful, and alive. It should remain calm enough to support action rather than becoming a game dashboard.

## 2. Identity hierarchy

The working hierarchy is:

**YOU → IDENTITY → PATHS / GROWTH AREAS → GOALS → MILESTONES → DAILY DIRECTIVE → ACTIONS → REAL-WORLD COMPLETION → PATH EVOLUTION**

YOU is conceptually central. Identity gives direction. Paths are meaningful growth areas such as BUILD, BODY, and VOICE. Goals describe an outcome inside a Path; Milestones make the outcome legible; Actions are the smallest real-world commitments.

## 3. Daily Directive

Today has one dominant object: the **Daily Directive**. It is a meaningful primary mission, connected to a Path, Goal, and Milestone. A user may accept the System's suggestion or change it. The alpha uses the sample directive “Finish the payment workflow” with three sample objectives and a prominent ENTER LOCK-IN action.

Secondary actions can support momentum, but they must remain visually and semantically secondary to the Directive.

## 4. Actions

An Action is an observable real-world step. Completion is a meaningful signal, not a currency reward. Alpha objectives are local in-memory fixtures and do not write to existing repositories.

## 5. Path model

A Path is a direction of growth that connects identity to action. The alpha presents BUILD, BODY, and VOICE. A Path can be focused so unrelated branches recede, making the next meaningful context easier to see.

## 6. Graph model

The ASCEND Graph is a semantic, stable-layout SVG: YOU at the conceptual center, Paths above it, then Goals, Milestones, and the current Action. It uses curved fine connections, subtle perspective, depth through scale and luminosity, and focusable branches. It is intentionally not a random physics graph or an Obsidian clone. Node placement is stable so meaning does not move while a user explores.

Clicking a Path focuses that branch. Clicking a Goal or Milestone focuses the corresponding branch and exposes its connected depth. The current Action is visually connected to its Path.

## 7. Level

Level is intended to represent permanent accumulated progression. Normal daily failure must not reduce permanent Level. Numerical accumulation and thresholds are deliberately unresolved.

## 8. Rank

Rank is intended to represent current progression tier or standing. Its relationship to Level, evidence, time, and recovery is not finalized. The alpha shows sample Rank C only.

## 9. System Stability

Stability is a temporary system condition. It may eventually reflect accepted commitments, completed Lock-In sessions, abandonment, and recovery. Alpha shows sample Stability 82% and does not calculate or persist it.

## 10. Conditions

The exploratory condition vocabulary is **STABLE**, **UNSTABLE**, **DEGRADED**, and **DORMANT**. Conditions need definitions, transition rules, user language, and recovery affordances before production use.

## 11. Penalties and recovery direction

The direction is to keep setbacks temporary and recoverable. A normal missed day must not damage permanent Level. Voluntary abandonment may eventually affect Stability or a temporary condition; emergency and legitimate interruptions should not receive punishment. No formulas or penalties are implemented in Alpha.

## 12. Lock-In

Lock-In is a focused-session UX prototype, not OS-level blocking. The alpha hides normal navigation, keeps the mission, timer, objectives, sealed distractions, and an always-available emergency exit. Exiting asks for a reason. Real blocking would require native or mobile integration later.

The future “Deep Lock” direction may require a minimum focus time and primary mission completion. These are product hypotheses, not finalized rules.

## 13. Status

Status is a readout of what is happening to the user's System. Alpha includes clearly labeled sample values: Level 18, Rank C, Stability 82%, Condition Stable. Below that, Real Evidence modules show action history for BUILD, BODY, and VOICE. Alpha does not claim hidden measurements such as strength or intelligence scores.

## 14. Visual language

The System uses a near-black midnight environment, graphite and translucent surfaces, fine geometric frames, indigo and violet light, icy text, and a small coral signal for sample or interruption states. Depth comes from layered atmosphere, restrained gradients, linework, and selective bloom. There are no external images or copyrighted assets. The System has its own geometry and typography treatment.

## 15. Motion language

Motion is purposeful and short: 120–300ms for interface changes and 300–600ms for meaningful arrival or consequence moments. Alpha includes a brief awakening, panel arrival, branch focus, and a restrained pulse traveling through the active graph connection after completion. It avoids confetti, loot, coins, constant particles, bounce, and interaction-blocking transitions. Reduced-motion users receive the same state changes without spatial or looping motion.

## 16. Sample-only data

The directive, objectives, timer, Level 18, Rank C, Stability 82%, conditions, evidence counts, identity statement, and “21 days awake” are sample fixtures. They are not user records, analytics, measurements, or progression formulas.

## 17. Not implemented

Alpha does not implement persistence, schema migration, domain changes, repository changes, backend, authentication, AI, native app blocking, real timers, numerical progression math, final Rank rules, production navigation, or a light System theme.

## 18. Copyright and originality boundary

ASCEND may take broad conceptual inspiration from progression fiction and games. It must not copy artwork, exact UI panels, logos, sounds, screenshots, character assets, or terminology unique to another work. All alpha geometry, copy, layout, and visual treatment are original ASCEND explorations.

## 19. Future native requirements

True blocking of apps and sites, reliable background timing, device policy, notifications, and cross-device sessions will require a native or mobile integration with explicit permissions and platform-specific safety behavior. The web prototype cannot provide those guarantees.

## 20. Unresolved product decisions

- How are Level contributions measured without incentivizing quantity?
- What makes Rank change, and how should Rank communicate uncertainty?
- Which evidence qualifies as meaningful across different Paths?
- How is Stability derived, and how do users recover without shame?
- When can the System suggest or change a Daily Directive?
- What makes a Lock-In session complete, paused, abandoned, or recovered?
- How should identity evolve while preserving user authorship?
- Which graph scale and history views are useful without becoming analytics?
- What data must be portable before any backend or native integration?
