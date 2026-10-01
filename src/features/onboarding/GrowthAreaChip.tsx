import type { GrowthArea } from '../../domain/growthAreas'
import { ChoiceChip } from '../../components/ui'

/**
 * One selectable Growth Area.
 *
 * A thin wrapper around the design system's `ChoiceChip`, and the thinness is
 * the point. The chip is presentation — a 44px pill with a pressed state and a
 * tick. This is the piece that knows what it is presenting: that a Growth Area
 * is chosen by ID rather than by name, and that clicking must carry that ID
 * back to the toggle.
 *
 * Keeping the domain-shaped adapter in the feature is what stops the design
 * system having to learn about Growth Areas, and what lets the next list of
 * choices reuse the pill without inheriting this one's meaning.
 *
 * The accessibility decisions — a real <button>, `aria-pressed`, and a tick so
 * selection is not signalled by colour alone — moved into `ChoiceChip` and are
 * documented there. Nothing about this screen's behaviour moved with them:
 * same role, same accessible name, same pressed state, same tick.
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
    <ChoiceChip selected={selected} onClick={() => onToggle(area.id)}>
      {area.name}
    </ChoiceChip>
  )
}
