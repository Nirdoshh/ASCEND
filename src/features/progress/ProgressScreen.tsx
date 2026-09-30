import { ScreenHeader } from '../../app/ScreenHeader'
import { Card, EmptyState } from '../../components/ui'

/**
 * PROGRESS — "Am I actually improving?"
 *
 * Phase 1 ships the shell only. Consistency, effort, milestones and
 * Growth Areas arrive in Phase 6.
 *
 * Note for the future: this screen is the most at risk of becoming an
 * analytics dashboard. The approved rule is that progress is shown as
 * several honest dimensions, never collapsed into one flattering
 * score.
 */
export function ProgressScreen() {
  return (
    <>
      <ScreenHeader title="Progress">
        <p>What evidence do you have that you are improving?</p>
      </ScreenHeader>

      <Card>
        <EmptyState
          title="Nothing to show yet"
          description="Progress is measured from what you actually do: how often you show up, how much you put in, and the milestones you finish."
        />
      </Card>
    </>
  )
}
