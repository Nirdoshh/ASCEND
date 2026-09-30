import { ScreenHeader } from '../../app/ScreenHeader'
import { Card, EmptyState } from '../../components/ui'

/**
 * JOURNEY — "Where am I going?"
 *
 * Phase 1 ships the shell only. The timeline, milestones and progress
 * markers arrive in Phase 5.
 */
export function JourneyScreen() {
  return (
    <>
      <ScreenHeader title="Journey">
        <p>Where you are going, and the milestones along the way.</p>
      </ScreenHeader>

      <Card>
        <EmptyState
          title="No journey yet"
          description="Your Journey appears here once you choose a goal, say why it matters, and pick how long you want to take."
        />
      </Card>
    </>
  )
}
