\# ASCEND



ASCEND turns long-term personal growth goals into meaningful daily

real-world action.



\## Product principles



\- Simple outside, smart underneath.

\- Progress over perfection.

\- One meaningful action beats many meaningless tasks.

\- Real-world action matters more than screen time.

\- Never silently destroy user-entered work.

\- Make restarting easy.

\- AI may advise but must never act as authority.

\- Avoid manipulative gamification, streak anxiety, fake metrics, and

&#x20; unnecessary notifications.



\## Current roadmap



Completed:



\- Phase 1 — foundation, routing, design system, repository architecture

\- Phase 2 — onboarding and Journey creation

\- Phase 3A — DailyPlan

\- Phase 3B — Today's Win

\- Phase 3C — Daily Steps



Current next work:



\- UI Foundation

\- then Phase 3D — Daily Step completion



Do not begin later phases unless explicitly requested.



\## Architecture



Maintain:



UI

→ application services

→ domain

→ repositories

→ storage/API



Rules:



\- React components must not access localStorage directly.

\- Business rules belong in domain/application code.

\- Repository interfaces are the persistence boundary.

\- Current persistence is localStorage.

\- Future backend path is Cloudflare Worker API → D1.

\- Do not introduce backend infrastructure prematurely.

\- Avoid unnecessary abstractions.



Read applicable ADRs before architectural, persistence, routing, or

schema changes.



\## Persistence safety



\- Version persisted contracts.

\- Never silently downgrade future schema data.

\- Older builds must not overwrite newer-schema data.

\- Never silently delete or truncate recoverable user data.

\- Stable identity must not depend on mutable display text.



\## Development workflow



Before meaningful changes:



1\. check git status

2\. inspect relevant implementation

3\. inspect relevant tests

4\. inspect applicable ADRs

5\. inspect relevant available skills/resources when they materially help



After meaningful changes:



1\. run npm run verify

2\. browser-test user-facing behavior

3\. distinguish verified behavior from inference

4\. report technical debt

5\. stop at the requested phase boundary



Do not automatically begin the next phase.



\## Git safety



Do not:



\- reset unrelated user work

\- overwrite unexplained changes

\- use destructive Git commands without explicit need

\- commit generated verification artifacts



If the working tree changes unexpectedly, stop and investigate.



\## ASCEND visual direction



ASCEND should feel:



\- premium

\- calm

\- focused

\- modern

\- mature

\- optimistic

\- personal

\- intentional



ASCEND must not feel:



\- childish

\- casino-like

\- RPG-heavy

\- cyberpunk

\- cluttered

\- generic AI-generated

\- like a corporate analytics dashboard



\## UI quality rules



\### Color



Prefer neutral surfaces with one intentional ASCEND accent color.



Use the accent mainly for:



\- primary actions

\- focus

\- important states

\- meaningful progress



Avoid unnecessary gradients, glows, glass effects, or many competing

accent colors.



\### Icons



Use one consistent professional icon system.



Maintain consistent:



\- stroke weight

\- size

\- visual style



Do not use emoji as interface icons.



Emoji inside user-authored content remains supported.



\### Visual hierarchy



Every screen should have one clearly dominant piece of information or

action.



Do not make every card, heading, metric, and label equally prominent.



On Today:



Today's Win should be the visual anchor.



Today's Steps should be immediately actionable but secondary.



Use typography, whitespace, contrast, and placement before decoration.



\### Interface states



Do not design only the happy path.



Where relevant, consider:



\- empty

\- incomplete

\- saving

\- success

\- disabled

\- error



Prefer useful recovery actions over blank screens and generic spinners.



\### Motion



Use small purposeful motion.



Typical duration:

150–300 ms.



Good uses:



\- button press feedback

\- Daily Step add/edit/remove

\- Today's Win save feedback

\- small list entrance

\- form/state transitions

\- later completion feedback



Prefer:



\- opacity

\- small translation

\- restrained scale

\- short stagger



Avoid:



\- flashy transitions

\- excessive bounce

\- continuous decorative motion

\- long animation

\- layout jank

\- animation that blocks interaction



Respect prefers-reduced-motion.



\## Accessibility



Target WCAG 2.2 AA.



Maintain:



\- keyboard accessibility

\- visible focus

\- semantic controls

\- screen-reader support

\- >=44x44 touch targets

\- sufficient contrast

\- reduced-motion support

\- 200% zoom/reflow

\- no color-only communication



\## External development resources



External resource directory:



C:\\Users\\nirdo\\projects\\ai agents skills



This folder contains screenshots describing Agent Skills, development

resources, and UI principles.



The screenshots are a resource catalog.



A resource shown in a screenshot is NOT automatically installed.



Before using a screenshot-listed resource:



1\. determine its real source

2\. check whether actual files or SKILL.md exist

3\. inspect what it really does

4\. evaluate whether ASCEND actually needs it

5\. avoid unnecessary dependencies

6\. do not fabricate a skill from a screenshot



High-priority resources to investigate:



\- frontend-design.skill

\- Color Expert.skill

\- Design Auditor.skill



Potential later resources:



\- PM Skills

\- JTBD Interview Tool

\- Deep Research

\- Evidence dialogue



Do not install social-media, video-production, publishing, or marketing

skills simply because they appear in the screenshots.



Treat the external resource directory as read-only.



\## Scope control



Avoid feature creep.



Do not add functionality merely because it appears useful.



Stay within the explicitly approved task or phase.


\## ASCEND SYSTEM RESET

The ASCEND SYSTEM reset is the approved product direction for the isolated
`/system` prototype. Where this section explicitly conflicts with older UI or
product wording above, this section supersedes it for the System prototype
only. Historical engineering safety rules remain in force.

ASCEND is being explored as a personal operating system that turns identity
into Paths, Goals, Milestones, a Daily Directive, Actions, real-world
completion, and visible Path evolution. The prototype may use meaningful
Level, Rank, and System Stability language, but must not finalize numerical
XP, stat, or Rank formulas. Sample progression values must be clearly marked
as sample data.

The first System prototype may include Today, Path, Status, You, an ASCEND
Graph, completion consequence motion, and Lock-In UX. It must remain isolated
from the production navigation and current saved data. It must not add
authentication, AI, backend infrastructure, persistence migrations, domain
schema changes, or native app blocking. Do not begin later System phases
without an explicit request.

The System visual language can be cinematic, futuristic, mysterious, and
focused, using an original dark midnight and indigo/violet identity with
restrained luminosity. It must not copy copyrighted artwork, panels, logos,
terminology, sounds, screenshots, or character assets from any work. Keep
semantic hierarchy, keyboard access, WCAG 2.2 AA targets, reduced-motion
support, responsive reflow, useful interface states, and bounded slices.

Level is permanent accumulated progression and normal daily failure must not
reduce it. Rank represents current standing and its rules remain unresolved.
System Stability is temporary and may eventually reflect commitments,
completion, abandonment, and recovery. Conditions such as STABLE, UNSTABLE,
DEGRADED, and DORMANT are exploratory labels only until product decisions
are finalized. Emergency or legitimate Lock-In exits must remain available;
no punishment is implemented in this prototype.

