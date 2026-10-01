import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '../../lib/cn'
import './ChoiceChip.css'

export interface ChoiceChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> {
  /** Whether this option is the chosen one. Drives `aria-pressed` and the tick. */
  selected: boolean
  /** The visible label. Kept as children rather than a prop so a caller can
   * control the markup of what it passes. */
  children: ReactNode
}

/**
 * One selectable option in a group of them.
 *
 * A real <button> with `aria-pressed`, not a checkbox and not a clickable
 * <div>. That choice buys three things for free and correctly:
 *
 *   - Enter and Space both toggle it, so it works with a keyboard.
 *   - A screen reader announces "Fitness, toggle button, pressed", which says
 *     what it is and what state it is in.
 *   - It is in the tab order exactly once, in a sensible reading order.
 *
 * Selection is never signalled by colour alone: a check mark appears when the
 * option is chosen, so the state survives greyscale, colour blindness and
 * forced-colours mode (WCAG 1.4.1).
 *
 * WHY THIS IS IN THE DESIGN SYSTEM RATHER THAN IN A FEATURE
 *
 * This began as `GrowthAreaChip`, owned by onboarding, and that was right
 * while Growth Areas were the only thing anybody chose from a list. Phase 2C's
 * Duration and Daily Effort screens ask the same question in a different
 * form — "pick one of these, or type your own" — so the second user of the
 * chip appeared, and the rule in this codebase is that a pattern used once
 * belongs to its component and a pattern used twice belongs to the design
 * system.
 *
 * The alternative was a second, near-identical pill in a second CSS file. Two
 * copies of a 44px target drift: one gets a hover state, one gets a
 * `forced-colors` guard, and the difference shows up only for the person
 * using both screens with the same assistive technology. The design system is
 * the right owner because it already owns "at least 44px" and "never encode
 * meaning in colour alone".
 *
 * The tick span is rendered even when empty so selecting an option does not
 * shift the labels sideways. Reserving the space up front is what stops the
 * row jumping under the finger.
 */
export function ChoiceChip({ selected, className, children, ...rest }: ChoiceChipProps) {
  return (
    <button
      {...rest}
      type="button"
      className={cn('choice-chip', selected && 'choice-chip--selected', className)}
      aria-pressed={selected}
    >
      {/*
        Decorative: the state is already carried by aria-pressed, so announcing
        the tick as well would just be noise. Its presence is still visible,
        which is the part that matters.
      */}
      <span className="choice-chip__tick" aria-hidden="true">
        {selected ? '✓' : ''}
      </span>
      <span className="choice-chip__label">{children}</span>
    </button>
  )
}
