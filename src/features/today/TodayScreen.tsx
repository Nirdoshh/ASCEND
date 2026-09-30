import { ScreenHeader } from '../../app/ScreenHeader'
import { Card, EmptyState } from '../../components/ui'

/**
 * TODAY — the most important screen in ASCEND.
 *
 * Phase 1 shows the real structure and nothing invented. There is no
 * fake progress bar and no sample plan, because a prototype that looks
 * finished is dangerous: it hides the actual work and makes the empty
 * state look like a bug rather than a starting point.
 *
 * Phase 2 (onboarding) and Phase 3 (the Today system) replace the
 * content below. The shell, header pattern and navigation around it are
 * already final.
 */
export function TodayScreen() {
  return (
    <>
      <ScreenHeader title="Today" eyebrow="Phase 1">
        <p>What should you do right now?</p>
      </ScreenHeader>

      <Card>
        <EmptyState
          title="Your plan for today will live here"
          description="One Today's Win and two to four Today's Steps — enough to move forward, not so many that choosing becomes the hard part."
          action={
            <p className="text-sm text-muted">
              Onboarding and the Today system arrive in Phase 2 and Phase 3.
            </p>
          }
        />
      </Card>
    </>
  )
}
