import { ScreenHeader } from '../../app/ScreenHeader'
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui'

/**
 * JOURNEY — "Where am I going?"
 *
 * Journey management is not available. Keep this screen honest about
 * the existing daily-action experience rather than implying setup was lost.
 */
export function JourneyScreen() {
  return (
    <>
      <ScreenHeader title="Journey">
        <p>One meaningful action at a time.</p>
      </ScreenHeader>

      <Card title="Your Journey is underway">
        <p className="text-secondary">Your daily plan is on Today. Progress shows the actions you have recorded.</p>
        <Link className="action-link" to="/today">Go to Today</Link>
      </Card>
    </>
  )
}
