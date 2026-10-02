import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ScreenHeader } from '../../app/ScreenHeader'
import {
  addDailyStep,
  completeDailyStep,
  editDailyStep,
  loadDailySteps,
  removeDailyStep,
  uncompleteDailyStep,
} from '../../application/dailySteps'
import { getOrCreateTodayPlan } from '../../application/todayPlan'
import { loadTodayWin, setTodayWin } from '../../application/todayWin'
import { Button, Card, EmptyState, ErrorState, Icon, Skeleton, TextField } from '../../components/ui'
import {
  defaultDailyPlanRepository,
  defaultDailyStepsRepository,
  defaultJourneyRepository,
  defaultTodayWinRepository,
} from '../../data/repositories/defaults'
import type { DailyPlan } from '../../domain/dailyPlan'
import { isDailyStepCompleted, type DailyStep } from '../../domain/dailyStep'
import type { Journey } from '../../domain/journey'
import type { TodayWin } from '../../domain/todayWin'
import './TodayScreen.css'

type SaveStatus = 'idle' | 'saving' | 'saved'

/** Today is the user's immediate plan: one meaningful win, then its steps. */
export function TodayScreen() {
  const navigate = useNavigate()
  const [journey, setJourney] = useState<Journey | null>(null)
  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [win, setWin] = useState<TodayWin | null>(null)
  const [steps, setSteps] = useState<DailyStep[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<{ problem: string; message: string } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [editText, setEditText] = useState('')
  const [editError, setEditError] = useState<string | undefined>()
  const [winStatus, setWinStatus] = useState<SaveStatus>('idle')
  const [editStepText, setEditStepText] = useState('')
  const [editStepError, setEditStepError] = useState<string | undefined>()
  const [completionError, setCompletionError] = useState<string | undefined>()
  const [stepStatus, setStepStatus] = useState<SaveStatus>('idle')
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [stepDraftText, setStepDraftText] = useState('')
  const [completionSavingStepId, setCompletionSavingStepId] = useState<string | null>(null)
  const [isEditingWin, setIsEditingWin] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadToday() {
      setIsLoading(true)
      setError(null)
      const result = await getOrCreateTodayPlan(defaultJourneyRepository, defaultDailyPlanRepository)
      if (cancelled) return

      if (result.ok) {
        setJourney(defaultJourneyRepository.loadActive())
        setPlan(result.plan)
        setWin(loadTodayWin(defaultDailyPlanRepository, defaultTodayWinRepository, defaultJourneyRepository))
        setSteps(loadDailySteps(defaultDailyPlanRepository, defaultDailyStepsRepository, defaultJourneyRepository))
      } else {
        setError({ problem: result.problem, message: result.message })
      }
      setIsLoading(false)
    }

    void loadToday()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const handleSetWin = async (text: string) => {
    setEditError(undefined)
    setWinStatus('saving')
    const result = await setTodayWin(defaultJourneyRepository, defaultDailyPlanRepository, defaultTodayWinRepository, text)

    if (result.ok) {
      setWin(result.win)
      setEditText('')
      setIsEditingWin(false)
      setWinStatus('saved')
    } else {
      setEditError(result.message)
      setWinStatus('idle')
    }
  }

  const handleAddStep = async (text: string) => {
    setEditStepError(undefined)
    setStepStatus('saving')
    const result = await addDailyStep(
      defaultDailyPlanRepository,
      defaultDailyStepsRepository,
      defaultJourneyRepository,
      defaultTodayWinRepository,
      text,
    )

    if (result.ok) {
      setSteps(result.steps)
      setEditStepText('')
      setStepStatus('saved')
    } else {
      setEditStepError(result.message)
      setStepStatus('idle')
    }
  }

  const handleEditStep = async (stepId: string, text: string) => {
    setEditStepError(undefined)
    setStepStatus('saving')
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
      setStepStatus('saved')
    } else {
      setEditStepError(result.message)
      setStepStatus('idle')
    }
  }

  const handleRemoveStep = async (stepId: string) => {
    setEditStepError(undefined)
    setStepStatus('saving')
    const result = await removeDailyStep(
      defaultDailyStepsRepository,
      defaultDailyPlanRepository,
      defaultJourneyRepository,
      defaultTodayWinRepository,
      stepId,
    )

    if (result.ok) {
      setSteps(result.steps)
      setStepStatus('saved')
    } else {
      setEditStepError(result.message)
      setStepStatus('idle')
    }
  }

  const handleToggleStep = async (step: DailyStep, completed: boolean) => {
    setCompletionError(undefined)
    setCompletionSavingStepId(step.id)
    const result = completed
      ? await completeDailyStep(
          defaultDailyPlanRepository,
          defaultDailyStepsRepository,
          defaultJourneyRepository,
          defaultTodayWinRepository,
          step.id,
        )
      : await uncompleteDailyStep(
          defaultDailyPlanRepository,
          defaultDailyStepsRepository,
          defaultJourneyRepository,
          defaultTodayWinRepository,
          step.id,
        )

    setCompletionSavingStepId(null)
    if (result.ok) {
      setSteps(result.steps)
      setStepStatus('saved')
    } else {
      setCompletionError(result.message)
      setStepStatus('idle')
    }
  }

  if (isLoading) {
    return (
      <div className="today" aria-busy="true">
        <ScreenHeader title="Today">
          <p>Loading today&rsquo;s plan&hellip;</p>
        </ScreenHeader>
        <Card className="today__section">
          <div className="today__steps-content" aria-hidden="true">
            <Skeleton width="8rem" height="1.5rem" />
            <Skeleton height="2rem" />
            <Skeleton width="7rem" height="2.75rem" />
          </div>
          <p className="visually-hidden" role="status">Loading today&rsquo;s plan&hellip;</p>
        </Card>
      </div>
    )
  }

  if (error || !journey || !plan) {
    const noJourney = error?.problem === 'no-journey'
    return (
      <div className="today">
        <ScreenHeader title="Today">
          <p>{noJourney ? 'Your next meaningful action starts with a Journey.' : 'Today\'s plan is temporarily unavailable.'}</p>
        </ScreenHeader>
        <Card className="today__section">
          {noJourney ? (
            <EmptyState
              title="No Journey yet"
              description="Start onboarding to create your first Journey."
              action={<Button onClick={() => void navigate('/onboarding')}>Start onboarding</Button>}
            />
          ) : (
            <ErrorState
              title="We couldn&rsquo;t load today&rsquo;s plan"
              description={error?.message ?? 'Try again. Your saved work is still here.'}
              action={<Button variant="secondary" onClick={() => setReloadKey((key) => key + 1)} leadingIcon={<Icon name="retry" size={18} />}>Try again</Button>}
            />
          )}
        </Card>
      </div>
    )
  }

  const formattedDate = formatLocalDate(plan.localDate)

  return (
    <div className="today">
      <ScreenHeader title="Today" eyebrow={formattedDate}>
        <h2 className="today__journey-label">Your Journey</h2>
        <p className="today__journey-goal">{journey.goal.text}</p>
      </ScreenHeader>

      <section className="today__section" aria-labelledby="today-win-heading">
        <Card className="today__win-card">
          <div className="today__win-content">
            <h2 className="today__section-title" id="today-win-heading">Today&rsquo;s Win</h2>
            {win && !isEditingWin ? (
              <>
                <p className="today__win-value">{win.text}</p>
                <div className="today__actions">
                  <Button
                    variant="quiet"
                    leadingIcon={<Icon name="edit" size={18} />}
                    onClick={() => {
                      setEditText(win.text)
                      setEditError(undefined)
                      setWinStatus('idle')
                      setIsEditingWin(true)
                    }}
                  >
                    Edit
                  </Button>
                  <p className="today__status today__feedback" role="status" aria-live="polite">
                    {winStatus === 'saved' ? 'Saved.' : ''}
                  </p>
                </div>
              </>
            ) : (
              <>
                {!win ? <p className="today__hint">What would make today a win?</p> : null}
                <TextField
                  label="Today&rsquo;s Win"
                  value={editText}
                  onChange={(event) => setEditText(event.target.value)}
                  placeholder="Deploy the auth flow"
                  error={editError}
                />
                <div className="today__actions">
                  <Button
                    loading={winStatus === 'saving'}
                    onClick={() => void handleSetWin(editText)}
                    disabled={editText.trim() === ''}
                    leadingIcon={<Icon name="save" size={18} />}
                  >
                    {win ? 'Save Today\'s Win' : 'Set Today\'s Win'}
                  </Button>
                  {win ? <Button variant="quiet" leadingIcon={<Icon name="close" size={18} />} onClick={() => { setIsEditingWin(false); setEditText(''); setEditError(undefined); setWinStatus('idle') }}>Cancel</Button> : null}
                  <p className="today__status today__feedback" role="status" aria-live="polite">
                    {winStatus === 'saved' ? 'Saved.' : ''}
                  </p>
                </div>
              </>
            )}
          </div>
        </Card>
      </section>

      <section className="today__section" aria-labelledby="today-steps-heading">
        <Card className="today__steps-card">
          <div className="today__steps-content">
            <h2 className="today__section-title" id="today-steps-heading">Today&rsquo;s Steps</h2>
            {!win ? (
              <p className="today__hint">Set your Today&rsquo;s Win first to add steps.</p>
            ) : (
              <>
                {steps.length === 0 ? <p className="today__hint">Add at least 2 small actions that move Today&rsquo;s Win forward.</p> : null}
                {steps.length > 0 ? (
                  <>
                    <p className="today__step-count">{steps.length} of 4 steps</p>
                    <ol className="today__step-list">
                      {steps.map((step, index) => (
                        <li className={`today__step-row${isDailyStepCompleted(step) ? ' today__step-row--completed' : ''}`} key={step.id}>
                          <div className="today__step-leading">
                            <span className="today__step-number" aria-hidden="true">{index + 1}</span>
                            <label className="today__step-completion">
                              <input
                                type="checkbox"
                                checked={isDailyStepCompleted(step)}
                                disabled={completionSavingStepId === step.id}
                                onChange={(event) => void handleToggleStep(step, event.target.checked)}
                                aria-label={`${isDailyStepCompleted(step) ? 'Mark' : 'Complete'} step ${index + 1}: ${step.text}`}
                              />
                              <span className="today__step-check-icon" aria-hidden="true">
                                {isDailyStepCompleted(step) ? <Icon name="check" size={18} /> : null}
                              </span>
                            </label>
                          </div>
                          {editingStepId === step.id ? (
                            <div className="today__step-main">
                              <TextField
                                label={'Edit step ' + (index + 1)}
                                value={stepDraftText}
                                onChange={(event) => setStepDraftText(event.target.value)}
                                error={editStepError}
                              />
                              <div className="today__step-actions">
                                <Button loading={stepStatus === 'saving'} onClick={() => void handleEditStep(step.id, stepDraftText)} disabled={stepDraftText.trim() === ''} leadingIcon={<Icon name="save" size={18} />}>Save</Button>
                                <Button variant="quiet" leadingIcon={<Icon name="close" size={18} />} onClick={() => { setEditingStepId(null); setStepDraftText(''); setEditStepError(undefined); setStepStatus('idle') }}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="today__step-main">
                                <p className="today__step-text">{step.text}</p>
                              </div>
                              <div className="today__step-actions">
                                <Button variant="quiet" leadingIcon={<Icon name="edit" size={18} />} onClick={() => { setEditingStepId(step.id); setStepDraftText(step.text); setEditStepError(undefined); setStepStatus('idle') }} aria-label={'Edit step ' + (index + 1)}>Edit</Button>
                                <Button variant="quiet" leadingIcon={<Icon name="remove" size={18} />} onClick={() => void handleRemoveStep(step.id)} aria-label={'Remove step ' + (index + 1)}>Remove</Button>
                              </div>
                            </>
                          )}
                        </li>
                      ))}
                    </ol>
                    {steps.length > 0 && steps.every(isDailyStepCompleted) ? (
                      <p className="today__complete-ack" role="status">Today&rsquo;s steps are complete.</p>
                    ) : null}
                    {completionError ? <p className="today__step-error" role="alert">{completionError}</p> : null}
                  </>
                ) : null}

                {steps.length < 4 ? (
                  <div className="today__add-step">
                    <TextField
                      label="Add a step"
                      value={editStepText}
                      onChange={(event) => setEditStepText(event.target.value)}
                      placeholder="Fix the onboarding routing bug"
                      error={editStepError}
                    />
                    <div className="today__actions">
                      <Button loading={stepStatus === 'saving'} onClick={() => void handleAddStep(editStepText)} disabled={editStepText.trim() === '' || steps.length >= 4} leadingIcon={<Icon name="plus" size={18} />}>Add Step</Button>
                      <p className="today__step-minimum">{steps.length < 2 ? 'Add at least 2 steps' : 'Up to 4 steps'}</p>
                    </div>
                  </div>
                ) : null}
                <p className="today__status today__feedback" role="status" aria-live="polite">
                  {stepStatus === 'saved' ? 'Step changes saved.' : ''}
                </p>
              </>
            )}
          </div>
        </Card>
      </section>
    </div>
  )
}

function formatLocalDate(localDate: string): string {
  const parts = localDate.split('-')
  const date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])))
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}
