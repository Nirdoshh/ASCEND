import { useEffect, useState } from 'react'

import { ScreenHeader } from '../../app/ScreenHeader'
import { Card, EmptyState, TextField, Button } from '../../components/ui'
import { defaultJourneyRepository, defaultDailyPlanRepository, defaultTodayWinRepository } from '../../data/repositories/defaults'
import { getOrCreateTodayPlan } from '../../application/todayPlan'
import { setTodayWin, loadTodayWin } from '../../application/todayWin'
import type { Journey } from '../../domain/journey'
import type { DailyPlan } from '../../domain/dailyPlan'
import type { TodayWin } from '../../domain/todayWin'
import './TodayScreen.css'

/**
 * TODAY — the most important screen in ASCEND.
 *
 * Phase 3B: Shows the active Journey, today's DailyPlan, and Today's Win.
 * Daily Steps arrive in Phase 3C.
 */
export function TodayScreen() {
  const [journey, setJourney] = useState<Journey | null>(null)
  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [win, setWin] = useState<TodayWin | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Win input state
  const [editText, setEditText] = useState('')
  const [editError, setEditError] = useState<string | undefined>()

  useEffect(() => {
    let cancelled = false

    async function loadToday() {
      setIsLoading(true)
      setError(null)

      const planResult = await getOrCreateTodayPlan(
        defaultJourneyRepository,
        defaultDailyPlanRepository,
      )

      if (cancelled) return

      if (planResult.ok) {
        setJourney(defaultJourneyRepository.loadActive())
        setPlan(planResult.plan)

        // Load today's win
        const todayWin = loadTodayWin(defaultDailyPlanRepository, defaultTodayWinRepository, defaultJourneyRepository)
        setWin(todayWin)
      } else {
        setError(planResult.message)
      }

      setIsLoading(false)
    }

    void loadToday()

    return () => {
      cancelled = true
    }
  }, [])

  const handleSetWin = async (text: string) => {
    setEditError(undefined)
    const result = await setTodayWin(
      defaultJourneyRepository,
      defaultDailyPlanRepository,
      defaultTodayWinRepository,
      text,
    )

    if (result.ok) {
      setWin(result.win)
      setEditText('')
    } else {
      setEditError(result.message)
    }
  }

  if (isLoading) {
    return (
      <>
        <ScreenHeader title="Today">
          <p>Loading today&rsquo;s plan&hellip;</p>
        </ScreenHeader>
        <Card>
          <EmptyState title="Loading&hellip;" description="" />
        </Card>
      </>
    )
  }

  if (error || !journey || !plan) {
    return (
      <>
        <ScreenHeader title="Today">
          <p>No active Journey</p>
        </ScreenHeader>
        <Card>
          <EmptyState
            title="No Journey yet"
            description={error ?? 'Start onboarding to create your first Journey.'}
          />
        </Card>
      </>
    )
  }

  const goalText = journey.goal.text
  const formattedDate = formatLocalDate(plan.localDate)

  return (
    <>
      <ScreenHeader title="Today" eyebrow={formattedDate}>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          Your Journey
        </p>
        <p style={{ fontWeight: 500 }}>{goalText}</p>
      </ScreenHeader>

      <Card>
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-text)' }}>
            TODAY&rsquo;S WIN
          </p>
          {win ? (
            <>
              <p style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '1rem', wordBreak: 'break-word' }}>
                {win.text}
              </p>
              <Button variant="quiet" onClick={() => {}}>
                Edit
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted" style={{ marginBottom: '1rem' }}>
                What would make today a win?
              </p>
              <TextField
                label="Today's Win"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="Deploy the auth flow"
                error={editError}
              />
              <div style={{ marginTop: '0.75rem' }}>
                <Button onClick={() => void handleSetWin(editText)} disabled={editText.trim() === ''}>
                  Set Today&rsquo;s Win
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card>
        <EmptyState
          title="Today&rsquo;s plan is ready"
          description="The next phase will add your Daily Steps."
        />
      </Card>
    </>
  )
}

/**
 * Formats a LocalDate (YYYY-MM-DD) into a human-readable string.
 * Example: "2026-10-01" → "October 1, 2026"
 */
function formatLocalDate(localDate: string): string {
  const parts = localDate.split('-')
  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}