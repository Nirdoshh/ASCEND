import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/** Orient each destination once; local editors retain their own focus. */
export function useRouteFocus() {
  const { pathname, key } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const previousPath = useRef<string | null>(null)

  useLayoutEffect(() => {
    // Preserve the skip link as the first Tab stop on a fresh document.
    if (previousPath.current !== null || key !== 'default') {
      mainRef.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
    previousPath.current = pathname
  }, [pathname, key])

  return mainRef
}
