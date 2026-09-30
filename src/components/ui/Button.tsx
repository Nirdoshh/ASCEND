import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '../../lib/cn'
import './Button.css'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
export type ButtonSize = 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner, blocks clicks and announces the busy state. */
  loading?: boolean
  /** Stretches to the container width. Useful for the one CTA on a screen. */
  fullWidth?: boolean
  leadingIcon?: ReactNode
}

/**
 * The one interactive primitive in ASCEND.
 *
 * Accessibility decisions, in order of importance:
 *   - Always a real <button>, so Enter, Space and the screen-reader
 *     role come for free. We never build a clickable <div>.
 *   - type defaults to "button". Without this, a button inside a form
 *     submits it, which is one of the most common real bugs in apps
 *     that add a form later.
 *   - Every size is at least 44px tall (WCAG 2.2 target size).
 *   - While loading, the button stays enabled in the DOM but ignores
 *     clicks and exposes aria-busy, so focus is not lost mid-action.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leadingIcon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={cn(
        'button',
        `button--${variant}`,
        `button--${size}`,
        fullWidth && 'button--full',
        loading && 'button--loading',
        className,
      )}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <span className="button__spinner" aria-hidden="true" />
      ) : (
        leadingIcon
      )}
      <span className="button__label">{children}</span>
    </button>
  )
}
