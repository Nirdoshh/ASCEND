import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'

import { ScreenHeader } from '../../app/ScreenHeader'
import { Button } from '../../components/ui'
import { useOnboarding } from './OnboardingDraftProvider'
import './SummaryScreen.css'

/**
 * The Summary screen — Step 8.
 *
 * A CALM REVIEW of everything the user has answered. No editing logic
 * lives here; each section has an Edit link that returns to the original
 * onboarding step. After editing, the user can navigate back to Summary.
 *
 * If the draft is incomplete, the invalid section(s) are identified and
 * Start Day 1 is disabled. The message says "Some things need your
 * attention" and the Edit links let them fix it.
 *
 * When valid, Start Day 1 runs the finalization service:
 *   validate → create Journey → save Journey → THEN clear draft
 *
 * This screen does NOT create a Journey on mount or refresh — only the
 * explicit button press does.
 */
export function SummaryScreen() {
  const navigate = useNavigate()
  const { draft, areas, getValidationDetails, getIncompleteSteps, finalize, hasActiveJourney } = useOnboarding()

  const [submitting, setSubmitting] = useState(false)
  const [finalizeError, setFinalizeError] = useState<string | undefined>(undefined)

  const validation = getValidationDetails()
  const incompleteSteps = getIncompleteSteps()
  const isValid = validation.valid

  const handleStartDay1 = async () => {
    // Double-submission guard: disable immediately
    setSubmitting(true)
    setFinalizeError(undefined)

    const result = await finalize()

    setSubmitting(false)

    if (result.ok) {
      void navigate('/today')
    } else {
      setFinalizeError(result.message)
    }
  }

  if (!draft) {
    const activeJourney = hasActiveJourney()

    if (activeJourney) {
      return (
        <div className="summary">
          <ScreenHeader title="Your Journey">
            <p>Your Journey has already started.</p>
          </ScreenHeader>
          <div className="summary__actions">
            <Button variant="primary" size="lg" fullWidth onClick={() => void navigate('/today')}>
              Go to Today
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="summary">
        <ScreenHeader title="Your Journey">
          <p>There is nothing to review yet.</p>
        </ScreenHeader>
        <div className="summary__actions">
          <Button variant="quiet" onClick={() => void navigate('/onboarding')}>
            Start onboarding
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="summary">
      <ScreenHeader title="Your Journey">
        <p>Review your answers. You can edit any section before starting.</p>
      </ScreenHeader>

      <div className="summary__sections">
        <SummarySection
          title="Growth Areas"
          content={renderGrowthAreas(draft, areas)}
          editHref="/onboarding/areas"
          isInvalid={incompleteSteps.some((s) => s.step === 'growth-areas')}
        />

        <SummarySection
          title="Goal"
          content={<p>{draft.goal?.text ?? 'Not answered'}</p>}
          editHref="/onboarding/goal"
          isInvalid={incompleteSteps.some((s) => s.step === 'goal')}
        />

        <SummarySection
          title="Why this matters"
          content={<p>{draft.why?.text ?? 'Not answered'}</p>}
          editHref="/onboarding/why"
          isInvalid={incompleteSteps.some((s) => s.step === 'why')}
        />

        <SummarySection
          title="Duration"
          content={<p>{draft.durationDays ? `${draft.durationDays} days` : 'Not answered'}</p>}
          editHref="/onboarding/duration"
          isInvalid={incompleteSteps.some((s) => s.step === 'duration')}
        />

        <SummarySection
          title="Milestones"
          content={renderMilestones(draft)}
          editHref="/onboarding/milestones"
          isInvalid={incompleteSteps.some((s) => s.step === 'milestones')}
        />

        <SummarySection
          title="Daily Effort"
          content={<p>{draft.dailyEffortMinutes ? `${draft.dailyEffortMinutes} minutes` : 'Not answered'}</p>}
          editHref="/onboarding/effort"
          isInvalid={incompleteSteps.some((s) => s.step === 'daily-effort')}
        />
      </div>

      {incompleteSteps.length > 0 && (
        <div className="summary__warning" role="alert">
          <p>Some things need your attention.</p>
          <ul>
            {incompleteSteps.map((s) => (
              <li key={s.step}>
                <Link to={getEditHref(s.step)}>{getStepLabel(s.step)}</Link> — {s.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {finalizeError && (
        <div className="summary__error" role="alert">
          {finalizeError}
        </div>
      )}

      <div className="summary__actions">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!isValid || submitting}
            onClick={() => void handleStartDay1()}
          >
            {submitting ? 'Starting…' : 'Start Day 1'}
          </Button>

          <Button variant="quiet" onClick={() => void navigate('/onboarding/effort')}>
            Back
          </Button>
        </div>
    </div>
  )
}

function SummarySection({
  title,
  content,
  editHref,
  isInvalid,
}: {
  title: string
  content: React.ReactNode
  editHref: string
  isInvalid: boolean
}) {
  return (
    <section className={`summary__section ${isInvalid ? 'summary__section--invalid' : ''}`}>
      <div className="summary__section-header">
        <h2>{title}</h2>
        <Link to={editHref} className="summary__edit-link" aria-label={`Edit ${title}`}>
          Edit
        </Link>
      </div>
      <div className="summary__section-content">
        {content}
      </div>
    </section>
  )
}

function renderGrowthAreas(draft: { selectedGrowthAreaIds: readonly string[] }, areas: readonly { id: string; name: string }[]) {
  if (draft.selectedGrowthAreaIds.length === 0) {
    return <p className="summary__empty">Not answered</p>
  }

  const selectedAreas = draft.selectedGrowthAreaIds
    .map((id) => areas.find((a) => a.id === id))
    .filter((a): a is { id: string; name: string } => a !== undefined)

  return (
    <ul>
      {selectedAreas.map((area) => (
        <li key={area.id}>{area.name}</li>
      ))}
    </ul>
  )
}

function renderMilestones(draft: { milestones?: readonly { id: string; text: string }[] }) {
  const milestones = draft.milestones ?? []
  if (milestones.length === 0) {
    return <p className="summary__empty">Not answered</p>
  }

  return (
    <ul>
      {milestones.map((m) => (
        <li key={m.id}>{m.text}</li>
      ))}
    </ul>
  )
}

function getEditHref(step: string): string {
  const map: Record<string, string> = {
    'growth-areas': '/onboarding/areas',
    goal: '/onboarding/goal',
    why: '/onboarding/why',
    duration: '/onboarding/duration',
    milestones: '/onboarding/milestones',
    'daily-effort': '/onboarding/effort',
  }
  return map[step] ?? '/onboarding'
}

function getStepLabel(step: string): string {
  const map: Record<string, string> = {
    'growth-areas': 'Growth Areas',
    goal: 'Goal',
    why: 'Why this matters',
    duration: 'Duration',
    milestones: 'Milestones',
    'daily-effort': 'Daily Effort',
  }
  return map[step] ?? step
}
