import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '../../lib/cn'
import './Card.css'

export type CardTone = 'default' | 'sunken' | 'accent'

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: CardTone
  /**
   * Renders an <h2>. Use for a card that heads a section of the page.
   *
   * We omit the native `title` attribute deliberately: a native title
   * is a tooltip, and we want the visible heading, not a hover hint.
   */
  title?: ReactNode
  /** Small uppercase label above the title. */
  eyebrow?: string
  description?: ReactNode
}

/**
 * A surface that groups related content.
 *
 * Why Card takes `title`/`description` props instead of requiring
 * CardHeader/CardBody children: in practice every card in ASCEND has
 * at most an eyebrow, a title, a description and a body. Making the
 * common case a prop keeps call sites short, and a plain `children`
 * escape hatch covers the rest. Simplicity over symmetry.
 */
export function Card({
  tone = 'default',
  title,
  eyebrow,
  description,
  className,
  children,
  ...rest
}: CardProps) {
  const hasHeading = Boolean(title || eyebrow || description)

  return (
    <div {...rest} className={cn('card', `card--${tone}`, className)}>
      {hasHeading ? (
        <div className="card__header">
          {eyebrow ? <p className="eyebrow card__eyebrow">{eyebrow}</p> : null}
          {title ? <h2 className="card__title">{title}</h2> : null}
          {description ? <p className="card__description">{description}</p> : null}
        </div>
      ) : null}
      {children ? <div className="card__body">{children}</div> : null}
    </div>
  )
}
