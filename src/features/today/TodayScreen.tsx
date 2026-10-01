import { useEffect, useState } from 'react'

import { ScreenHeader } from '../../app/ScreenHeader'
import { Card, EmptyState, TextField, Button } from '../../components/ui'
import { defaultJourneyRepository, defaultDailyPlanRepository, defaultTodayWinRepository, defaultDailyStepsRepository } from '../../data/repositories/defaults'
import { getOrCreateTodayPlan } from '../../application/todayPlan'
import { setTodayWin, loadTodayWin } from '../../application/todayWin'
import { addDailyStep, editDailyStep, removeDailyStep, loadDailySteps } from '../../application/dailySteps'
import type { Journey } from '../../domain/journey'
import type { DailyPlan } from '../../domain/dailyPlan'
import type { TodayWin } from '../../domain/todayWin'
import type { DailyStep } from '../../domain/dailyStep'
import './TodayScreen.css'

/**
 * TODAY — the most important screen in ASCEND.
 *
 * Phase 3B: Shows the active Journey, today's DailyPlan, and Today's Win.
 * Phase 3C: Shows Daily Steps supporting Today's Win.
 */
export function TodayScreen() {
  const [journey, setJourney] = useState<Journey | null>(null)
  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [win, setWin] = useState<TodayWin | null>(null)
  const [steps, setSteps] = useState<DailyStep[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Win input state
  const [editText, setEditText] = useState('')
  const [editError, setEditError] = useState<string | undefined>()

  // Step input state
  const [editStepText, setEditStepText] = useState('')
  const [editStepError, setEditStepError] = useState<string | undefined>()

  // Step editing state
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [stepDraftText, setStepDraftText] = useState('')
  const [isEditingWin, setIsEditingWin] = useState(false)

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

        // Load today's steps
        const todaySteps = loadDailySteps(defaultDailyPlanRepository, defaultDailyStepsRepository, defaultJourneyRepository)
        setSteps(todaySteps)
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
      setIsEditingWin(false)
    } else {
      setEditError(result.message)
    }
  }

  // Step handlers
  const handleAddStep = async (text: string) => {
    setEditStepError(undefined)
    const result = await addDailyStep(
      defaultDailyPlanRepository,
      defaultDailyStepsRepository,
      defaultJourneyRepository,
      defaultTodayWinRepository,
      text,
    )

    if (result.ok) {
      setSteps(result.steps)
      setEditingStepId(null)
      setStepDraftText('')
      setEditStepText('')
    } else {
      setEditStepError(result.message)
    }
  }

  const handleEditStep = async (stepId: string, text: string) => {
    setEditStepError(undefined)
    const result = await editDailyStep(
      defaultDailyStepsRepository,
      defaultDailyPlanRepository,
      defaultJourneyRepository,
      defaultTodayWinRepository,
      stepId,
      text,
    )

    if (result.ok) {
      setSteps(result.steps)
      setEditingStepId(null)
      setStepDraftText('')
    } else {
      setEditStepError(result.message)
    }
  }

  const handleRemoveStep = async (stepId: string) => {
    const result = await removeDailyStep(
      defaultDailyStepsRepository,
      defaultDailyPlanRepository,
      defaultJourneyRepository,
      defaultTodayWinRepository,
      stepId,
    )

    if (result.ok) {
      setSteps(result.steps)
    } else {
      setEditStepError(result.message)
    }
  }

  const startEditingStep = (step: DailyStep) => {
    setEditingStepId(step.id)
    setStepDraftText(step.text)
    setEditStepError(undefined)
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
          {win && !isEditingWin ? (
            <>
              <p style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '1rem', wordBreak: 'break-word' }}>
                {win.text}
              </p>
              <Button
                variant="quiet"
                onClick={() => {
                  setEditText(win.text)
                  setEditError(undefined)
                  setIsEditingWin(true)
                }}
              >
                Edit
              </Button>
            </>
          ) : (
            <>
              {!win ? <p className="text-muted" style={{ marginBottom: '1rem' }}>What would make today a win?</p> : null}
              <TextField
                label="Today's Win"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="Deploy the auth flow"
                error={editError}
              />
              <div style={{ marginTop: '0.75rem' }}>
                <Button onClick={() => void handleSetWin(editText)} disabled={editText.trim() === ''}>
                  {win ? 'Save Today’s Win' : 'Set Today’s Win'}
                </Button>
                {win ? <Button variant="quiet" onClick={() => { setIsEditingWin(false); setEditText(''); setEditError(undefined) }}>Cancel</Button> : null}
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Daily Steps Section */}
      <Card>
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-text)' }}>
            TODAY&rsquo;S STEPS
          </p>
          {!win ? (
            <p className="text-muted" style={{ marginBottom: '1rem' }}>
              Set your Today&rsquo;s Win first to add steps.
            </p>
          ) : (
            <>
              {steps.length === 0 ? (
                <p className="text-muted" style={{ marginBottom: '1rem' }}>
                  Add at least 2 small actions that move today&rsquo;s Win forward.
                </p>
              ) : (
                <>
                  <p className="text-muted" style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                    {steps.length} of 4 steps
                  </p>
                  {steps.map((step, index) => editingStepId === step.id ? (
                    <div key={step.id} style={{ marginBottom: '0.75rem' }}>
                      <TextField
                        label={`Edit step ${index + 1}`}
                        value={stepDraftText}
                        onChange={(event) => setStepDraftText(event.target.value)}
                        error={editStepError}
                      />
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                        <Button onClick={() => void handleEditStep(step.id, stepDraftText)} disabled={stepDraftText.trim() === ''}>Save</Button>
                        <Button variant="quiet" onClick={() => { setEditingStepId(null); setStepDraftText(''); setEditStepError(undefined) }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <span style={{
                        flexShrink: 0,
                        width: '1.5rem',
                        height: '1.5rem',
                        borderRadius: '50%',
                        border: '2px solid var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        color: 'var(--color-primary)',
                        backgroundColor: 'transparent',
                      }}>
                        {index + 1}
                      </span>
                      <p style={{ flex: 1, fontSize: '1rem', margin: 0, wordBreak: 'break-word' }}>
                        {step.text}
                      </p>
                      <Button variant="quiet" onClick={() => startEditingStep(step)} aria-label={`Edit step ${index + 1}`}>
                        Edit
                      </Button>
                      <Button variant="quiet" onClick={() => void handleRemoveStep(step.id)} aria-label={`Remove step ${index + 1}`}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </>
              )}
              {steps.length < 4 && win && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                  <TextField
                    label="Add a step"
                    value={editStepText}
                    onChange={(e) => setEditStepText(e.target.value)}
                    placeholder="Fix the onboarding routing bug"
                    error={editStepError}
                  />
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                    <Button onClick={() => void handleAddStep(editStepText)} disabled={editStepText.trim() === '' || steps.length >= 4}>
                      Add Step
                    </Button>
                    <p className="text-muted" style={{ margin: 0, alignSelf: 'center', fontSize: '0.875rem' }}>
                      {steps.length < 2 ? 'Add at least 2 steps' : steps.length >= 4 ? 'Maximum 4 steps' : ''}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
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
