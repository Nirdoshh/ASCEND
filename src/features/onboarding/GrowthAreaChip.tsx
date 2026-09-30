import type { GrowthArea } from '../../domain/growthAreas'
import { cn } from '../../lib/cn'
import './GrowthAreaChip.css'

/**
 * One selectable Growth Area.
 *
 * A real <button> with `aria-pressed`, not a checkbox and not a clickable
 * <div>. That choice buys three things for free and correctly:
 *
 *   - Enter and Space both toggle it, so it works with a keyboard.
 *   - A screen reader announces "Fitness, toggle button, pressed",
 *     which says what it is and what state it is in.
 *   - It is in the tab order exactly once, in a sensible reading order.
 *
 * Selection is never signalled by colour alone: a check mark appears
 * when the area is chosen, so the state survives greyscale, colour
 * blindness and forced-colours mode (WCAG 1.4.1).
 */
export function GrowthAreaChip({
  area,
  selected,
  onToggle,
}: {
  area: GrowthArea
  selected: boolean
  onToggle: (id: string) => void
}) {
  return (
    <button
      type="button"
      className={cn('area-chip', selected && 'area-chip--selected')}
      aria-pressed={selected}
      onClick={() => onToggle(area.id)}
    >
      {/*
        Decorative: the state is already carried by aria-pressed, so
        announcing the tick as well would just be noise. Its presence is
        still visible, which is the part that matters.
      */}
      <span className="area-chip__tick" aria-hidden="true">
        {selected ? '✓' : ''}
      </span>
      <span className="area-chip__name">{area.name}</span>
    </button>
  )
}