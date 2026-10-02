import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ScreenHeader } from '../../app/ScreenHeader'
import { Button, Card, EmptyState, ErrorState } from '../../components/ui'
import {
  defaultJourneyRepository, defaultDailyPlanRepository, defaultDailyStepsRepository,
} from '../../data/repositories/defaults'
import { loadProgress } from '../../application/progress'
import type { ProgressDay } from '../../domain/progress'
import './ProgressScreen.css'

function readProgress() {
  return loadProgress(defaultJourneyRepository, defaultDailyPlanRepository, defaultDailyStepsRepository)
}

function dayDescription(day: ProgressDay): string {
  if (day.isBeforeJourney) return 'Before this Journey'
  if (!day.hasPlan) return 'No plan recorded'
  if (day.totalSteps === 0) return 'No steps recorded'
  const count = `${day.completedSteps} of ${day.totalSteps} actions completed`
  if (day.isFullyComplete) return `${count}. All steps complete`
  if (day.totalSteps === 1) return `${count}. Step set incomplete`
  if (day.totalSteps > 4) return `${count}. More than 4 steps recorded`
  return count
}

export function ProgressScreen() {
  // Recalculated on every route mount and explicit retry, from source records.
  const [result, setResult] = useState(readProgress)
  const snapshot = result.ok ? result.value : null
  const hasActions = snapshot !== null && snapshot.totalActions > 0

  return (
    <div className="progress-screen stack-lg">
      <ScreenHeader title="Progress">
        <p>{snapshot && snapshot.completedActions > 0
          ? 'You’re taking action. Here’s what you’ve done.'
          : 'Meaningful progress starts with a real-world action.'}</p>
      </ScreenHeader>

      {!result.ok ? (
        <ErrorState
          title="Progress couldn’t be loaded"
          description={result.problem === 'newer-schema'
            ? 'Some history was saved by a newer version of ASCEND. Open the latest version to read it. Your records have been kept.'
            : result.problem === 'invalid-data'
              ? 'Some saved history couldn’t be read safely. Your records have been kept; totals will appear when the history can be read.'
              : 'Your browser couldn’t read saved activity. Try again when storage is available.'}
          action={<Button variant="secondary" onClick={() => setResult(readProgress())}>Try again</Button>}
        />
      ) : !snapshot ? (
        <Card>
          <EmptyState title="Start with a Journey" description="Choose what matters to you, then take it one action at a time."
            action={<Link className="progress-screen__link" to="/onboarding">Create a Journey</Link>} />
        </Card>
      ) : (
        <>
          {snapshot.completedActions === 0 ? (
            <Card>
              <EmptyState
                title="No completed actions yet"
                description={snapshot.planDays === 0
                  ? 'Your Journey is ready. Your first action starts on Today.'
                  : !hasActions
                    ? 'Your plans are here. Add small actions on Today to get started.'
                    : 'Your steps are ready. Complete an action on Today when you’ve done it.'}
                action={<Link className="progress-screen__link" to="/today">Go to Today</Link>}
              />
            </Card>
          ) : (
            <section aria-labelledby="completed-actions-heading" className="progress-screen__actions">
              <h2 id="completed-actions-heading">Actions completed</h2>
              <p className="progress-screen__count">{snapshot.completedActions}</p>
              <p className="text-secondary">Across this Journey’s recorded Daily Steps.</p>
            </section>
          )}

          {hasActions ? (
            <Card title="Recent activity">
              <p className="progress-screen__consistency">Active on {snapshot.recentActiveDays} of the last 7 days</p>
              <p className="text-sm text-secondary">An active day has at least one completed Daily Step.</p>
              <ol className="progress-history" aria-label="Daily activity for the last 7 calendar days, ending today">
                {snapshot.recentDays.map((day) => {
                  // Saved dates are calendar labels. UTC here formats the label only.
                  const date = new Date(`${day.localDate}T12:00:00Z`)
                  const weekday = date.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })
                  const fullDate = date.toLocaleDateString(undefined, { dateStyle: 'full', timeZone: 'UTC' })
                  return (
                    <li key={day.localDate} className={`progress-history__day${day.isActive ? ' progress-history__day--active' : ''}`}>
                      <span className="visually-hidden">{fullDate}: {dayDescription(day)}.</span>
                      <span aria-hidden="true" className="progress-history__weekday">{weekday}</span>
                      <time aria-hidden="true" dateTime={day.localDate}>{day.localDate.slice(5)}</time>
                      <span aria-hidden="true" className="progress-history__ratio">
                        {day.totalSteps > 0 ? `${day.completedSteps}/${day.totalSteps}` : '—'}
                      </span>
                    </li>
                  )
                })}
              </ol>
              <p className="text-sm text-secondary">Completed / recorded steps. — means no steps recorded.</p>
            </Card>
          ) : null}

          <section aria-labelledby="journey-time-heading" className="progress-screen__journey stack-sm">
            <h2 id="journey-time-heading">Journey</h2>
            <p>Day {snapshot.journeyElapsedDays} of {snapshot.journeyDurationDays}</p>
            <p className="text-sm text-secondary">Calendar time since you started, not goal completion.</p>
          </section>
        </>
      )}
    </div>
  )
}
