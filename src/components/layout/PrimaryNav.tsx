import { NavLink } from 'react-router-dom'

import { Icon, type IconName } from '../ui/Icon'
import './PrimaryNav.css'

/**
 * The only navigation in ASCEND. Four destinations, no more.
 *
 * Why four: the approved information architecture is Today, Journey,
 * Progress, You. Navigation is itself a cost — every extra tab is a
 * decision the user has to make on a phone, at a moment when they
 * should be getting on with their day. If a destination is not one of
 * these four, it belongs inside one of them.
 */
interface NavItem {
  to: string
  label: string
  icon: IconName
  /** Used as the accessible name so it reads clearly out of context. */
  description: string
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/today',
    label: 'Today',
    icon: 'today',
    description: 'What should I do right now?',
  },
  {
    to: '/journey',
    label: 'Journey',
    icon: 'journey',
    description: 'Where am I going?',
  },
  {
    to: '/progress',
    label: 'Progress',
    icon: 'progress',
    description: 'Have I actually been taking action?',
  },
  {
    to: '/you',
    label: 'You',
    icon: 'you',
    description: 'What am I working toward, and how should ASCEND work for me?',
  },
]

/**
 * Rendered as ONE <nav> that is repositioned by CSS per breakpoint.
 *
 * We do not render a separate mobile and desktop nav. Two navs would
 * mean two sets of links for a screen reader to walk through, one of
 * them invisible, which is a common and serious accessibility bug.
 */
export function PrimaryNav() {
  return (
    <nav className="primary-nav" aria-label="Main">
      <ul className="primary-nav__list">
        {NAV_ITEMS.map((item) => (
          <li className="primary-nav__item" key={item.to}>
            <NavLink
              to={item.to}
              // NavLink sets aria-current="page" for the active route.
              // The root redirects to /today; match its canonical screen URL.
              end={item.to === '/today'}
              className={({ isActive }) =>
                `primary-nav__link${isActive ? ' primary-nav__link--active' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} className="primary-nav__icon" />
                  <span className="primary-nav__label">{item.label}</span>
                  {/* Visually hidden: gives screen readers the question
                      each screen answers, which is the point of the tab. */}
                  <span className="visually-hidden">. {item.description}</span>
                  {isActive ? <span className="visually-hidden">(current page)</span> : null}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
