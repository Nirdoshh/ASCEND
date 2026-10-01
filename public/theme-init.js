/**
 * Applies the saved colour theme before the app renders.
 *
 * Why this file exists at all:
 *   If we wait for React to set the theme, a user who chose dark mode
 *   would see a flash of the light theme on every page load. Fixing that
 *   with JavaScript in the <head> is the standard solution.
 *
 * Rules we agreed in the Phase 1 plan:
 *   - Storage is owned by src/data/. This file only READS.
 *   - The key below mirrors ASCEND_PREFERENCES_KEY in
 *     src/data/storage/keys.ts. A test asserts the two stay in sync,
 *     because a silent mismatch would mean "dark mode randomly resets".
 */
;(function () {
  try {
    var raw = window.localStorage.getItem('ascend:preferences:v1')
    var parsed = raw ? JSON.parse(raw) : null
    var theme = parsed && parsed.theme
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme)
    }

    var resolved = theme === 'dark' || (theme !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light'
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#111110' : '#fafaf9')
  } catch (error) {
    // A corrupt or unavailable store must never block the app from
    // rendering. We fall back to the CSS system-colour defaults.
  }
})()
