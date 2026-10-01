/**
 * Icon set.
 *
 * ASCEND ships its own icons rather than adding an icon library.
 * Reasons:
 *   - 8 icons do not justify a dependency and its bundle cost.
 *   - Every icon is stroke-based and inherits `currentColor`, so it
 *     follows the theme automatically.
 *   - We control the accessibility contract: icons are decorative by
 *     default (`aria-hidden`) because the surrounding text already says
 *     what they mean. An icon is never the only carrier of meaning.
 *
 * All icons share a 24x24 viewBox and a 1.75 stroke width so they look
 * like a single family.
 */

export type IconName =
  | 'today'
  | 'journey'
  | 'progress'
  | 'you'
  | 'sun'
  | 'moon'
  | 'system'
  | 'plus'
  | 'check'
  | 'edit'
  | 'remove'
  | 'close'
  | 'retry'
  | 'alert'
  | 'save'

export interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}

/* today — a day with one thing done on it.
   Original mark: a page with a check. */
const PATHS = {
  today: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5z" />
      <path d="M8.75 8.25v7.5" />
      <path d="M8.75 12.25l2.5 2.5 4.25-5" />
    </>
  ),

  /* journey — a path with markers, not a map pin or a quest scroll. */
  journey: (
    <>
      <path d="M6 20c0-3 3-3.5 6-5s6-2 6-5" />
      <circle cx="6" cy="19" r="1.75" />
      <circle cx="18" cy="10" r="1.75" />
    </>
  ),

  /* progress — three ascending bars. Same idea as the ASCEND mark. */
  progress: (
    <>
      <path d="M4 19.5h16" />
      <path d="M7 19.5v-4" />
      <path d="M12 19.5v-8" />
      <path d="M17 19.5v-12" />
    </>
  ),

  /* you — a person, shoulders up. */
  you: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),

  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </>
  ),

  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,

  system: (
    <>
      <rect x="2.5" y="4.5" width="19" height="12" rx="1.5" />
      <path d="M8 20h8" />
    </>
  ),

  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),

  check: <path d="m5 12.5 4.25 4.25L19 7" />,

  edit: (
    <>
      <path d="m4 16.5-.75 3.25L6.5 19l10.75-10.75-2.5-2.5z" />
      <path d="m13.25 7.25 2.5 2.5M14.75 5.75l1-1a1.75 1.75 0 0 1 2.5 2.5l-1 1" />
    </>
  ),

  remove: (
    <>
      <path d="M5 7h14" />
      <path d="M10 11v5M14 11v5" />
      <path d="M7 7l.75 13h8.5L17 7M9 7V4.5h6V7" />
    </>
  ),

  close: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),

  retry: (
    <>
      <path d="M20 11a8 8 0 0 0-14.5-4L4 9" />
      <path d="M4 4v5h5" />
      <path d="M4 13a8 8 0 0 0 14.5 4L20 15" />
      <path d="M20 20v-5h-5" />
    </>
  ),

  alert: (
    <>
      <path d="M12 4 21 20H3z" />
      <path d="M12 9v5M12 17.5h.01" />
    </>
  ),

  save: (
    <>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 4v6h8V4M8 20v-6h8v6" />
    </>
  ),
} satisfies Record<IconName, React.ReactElement>
