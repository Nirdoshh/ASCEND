import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import './styles/tokens.css'
import './styles/base.css'
import './styles/utilities.css'

/**
 * Entry point.
 *
 * Style import order matters and is not arbitrary:
 *   1. tokens  — defines the custom properties everything else consumes
 *   2. base    — reset and element defaults
 *   3. utilities — small shared helpers, loaded last so they can win
 *
 * Component stylesheets are imported by the components themselves, so a
 * component is never rendered without its styles.
 *
 * StrictMode is intentionally left on. In development it double-renders
 * and surfaces unsafe side effects, which is exactly the class of bug
 * that would corrupt someone's saved plan later.
 */

const container = document.getElementById('root')

if (!container) {
  throw new Error('ASCEND could not start: the #root element is missing from index.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
