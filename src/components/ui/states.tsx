import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'
import './states.css'

export interface EmptyStateProps {
  title: string
  /** One short sentence explaining what this space will hold. */
  description?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}

/**
 * Empty state.
 *
 * The product rule this enforces: an empty state must help the user
 * move FORWARD. "No data" is never acceptable copy. Every empty state
 * answers "what goes here?" and offers the next action.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('empty', className)}>
      {icon ? (
        <div className="empty__icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className="empty__title">{title}</p>
      {description ? <p className="empty__description">{description}</p> : null}
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  )
}

export interface ErrorStateProps {
  title: string
  /**
   * What happened and what the user can do, in plain language.
   * Never surface an internal error code or a stack trace.
   */
  description: string
  /** The retry control. Preserved work is a product requirement. */
  action?: ReactNode
  className?: string
}

/**
 * Error state.
 *
 * ASCEND's error copy rules:
 *   - Explain, preserve, offer recovery. No error codes.
 *   - "We couldn't save that step. Your changes are still here."
 *   - role="alert" so the change is announced, without stealing focus.
 */
export function ErrorState({ title, description, action, className }: ErrorStateProps) {
  return (
    <div className={cn('state-message', 'state-message--error', className)} role="alert">
      <p className="empty__title">{title}</p>
      <p className="empty__description">{description}</p>
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  )
}

/**
 * Loading skeleton.
 *
 * Skeletons reserve layout space so content does not jump when it
 * arrives. They are hidden from assistive tech because a screen reader
 * announcing "loading" repeatedly is worse than saying nothing while a
 * short wait resolves.
 */
export function Skeleton({
  width = '100%',
  height = '1rem',
  radius = 'var(--radius-sm)',
  className,
}: {
  width?: string
  height?: string
  radius?: string
  className?: string
}) {
  return (
    <span
      className={cn('skeleton', className)}
      style={{ inlineSize: width, blockSize: height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}
