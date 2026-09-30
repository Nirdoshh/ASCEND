import type { ReactNode } from 'react'

import './ScreenHeader.css'

/**
 * The shared page header pattern.
 *
 * Every screen in ASCEND answers one question, and stating that
 * question in the user's own words is the fastest way to orient
 * someone. It keeps the four screens visually consistent without
 * giving them identical content.
 */
export function ScreenHeader({
  eyebrow,
  title,
  children,
}: {
  /** Optional context line, e.g. "DAY 12 OF 45". */
  eyebrow?: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="screen-header">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1 className="screen-header__title">{title}</h1>
      {children ? <div className="screen-header__body">{children}</div> : null}
    </div>
  )
}
