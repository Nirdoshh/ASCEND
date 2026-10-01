import { useId } from 'react'

import { cn } from '../../lib/cn'
import './ProgressBar.css'

export type ProgressTone = 'default' | 'success'

export interface ProgressBarProps {
  /** Completed amount. Clamped, so a bug upstream cannot render a broken bar. */
  value: number
  max: number
  label: string
  /** Human description for assistive tech, e.g. "2 of 4 steps complete". */
  valueText?: string
  /** Renders the "2 of 4" caption under the bar. */
  showValue?: boolean
  tone?: ProgressTone
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Progress indicator.
 *
 * Design decisions worth knowing:
 *   - It ALWAYS shows text next to it, by default. A bar on its own
 *     communicates nothing to a screen reader user and nothing to a
 *     user at 200% zoom.
 *   - `role="progressbar"` with aria-valuenow/min/max is the correct
 *     pattern. We deliberately do NOT mark it aria-live: a bar that
 *     announces itself on every tick is exhausting to listen to.
 *   - The fill animates its width, which is the one motion in ASCEND
 *     that carries meaning (it shows change rather than decoration).
 */
export function ProgressBar({
  value,
  max,
  label,
  valueText,
  showValue = true,
  tone = 'default',
  size = 'md',
  className,
}: ProgressBarProps) {
  const id = useId()

  const safeMax = Number.isFinite(max) && max > 0 ? max : 1
  const safeValue = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), safeMax)
  const percent = Math.round((safeValue / safeMax) * 100)

  return (
    <div className={cn('progress', className)}>
      {showValue ? (
        <div className="progress__header">
          <span className="progress__label" id={`${id}-label`}>
            {label}
          </span>
          <span className="progress__value">
            {safeValue} of {safeMax}
          </span>
        </div>
      ) : (
        // Keep the labelled-by target in the accessibility tree even when the
        // visible count is intentionally hidden.
        <span className="visually-hidden" id={`${id}-label`}>
          {label}
        </span>
      )}

      <div
        className={cn('progress__track', `progress__track--${size}`)}
        role="progressbar"
        aria-labelledby={`${id}-label`}
        aria-valuenow={safeValue}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuetext={valueText ?? `${safeValue} of ${safeMax} complete`}
      >
        <div
          className={cn('progress__fill', `progress__fill--${tone}`)}
          style={{ inlineSize: `${percent}%` }}
        />
      </div>
    </div>
  )
}
