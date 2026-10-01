import { useEffect, useState } from 'react'

import { ScreenHeader } from '../../app/ScreenHeader'
import { Card, EmptyState } from '../../components/ui'
import { defaultJourneyRepository, defaultDailyPlanRepository } from '../../data/repositories/defaults'
import { getOrCreateTodayPlan } from '../../application/todayPlan'
import type { Journey } from '../../domain/journey'
import type { DailyPlan } from '../../domain/dailyPlan'
import './TodayScreen.css'

/**
 * TODAY — the most important screen in ASCEND.
 *
 * Phase 3A: Shows the active Journey and today's DailyPlan container.
 * Win and Steps arrive in Phase 3B.
 */
export function TodayScreen() {
  const [journey, setJourney] = useState<Journey | null>(null)
  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadToday() {
      setIsLoading(true)
      setError(null)

      const result = await getOrCreateTodayPlan(
        defaultJourneyRepository,
        defaultDailyPlanRepository,
      )

      if (cancelled) return

      if (result.ok) {
        setJourney(defaultJourneyRepository.loadActive())
        setPlan(result.plan)
      } else {
        setError(result.message)
      }

      setIsLoading(false)
    }

    void loadToday()

    return () => {
      cancelled = true
    }
  }, [])

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
        <EmptyState
          title="Today&rsquo;s plan is ready"
          description="The next phase will add your Today&rsquo;s Win and Daily Steps."
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