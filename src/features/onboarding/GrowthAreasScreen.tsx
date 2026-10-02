import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { ScreenHeader } from '../../app/ScreenHeader'
import { Button, Icon, TextField } from '../../components/ui'
import { MAX_GROWTH_AREA_NAME_LENGTH } from '../../domain/growthAreas'
import { isGrowthAreaStepValid } from '../../domain/onboardingValidation'
import { GrowthAreaChip } from './GrowthAreaChip'
import { useOnboarding } from './OnboardingDraftProvider'
import './GrowthAreasScreen.css'

/**
 * Step 2 — "What do you want to improve?"
 *
 * The first screen where the user commits to anything, so it is built
 * around one risk: making it feel like a test. There is no way to fail
 * it. Nothing here is ranked, nothing is scored, and nothing is final.
 *
 * Design decisions worth stating:
 *
 *   - "Create your own" is DISCLOSED, not always visible. Ten chips
 *     plus an open text field is a wall on a phone. The button is the
 *     last thing in the list so a person who wants their own thing
 *     finds it by reading down.
 *
 *   - Adding a custom area selects it. Nobody types the name of
 *     something they do not want to work on.
 *
 *   - The custom field is capped at 120 characters rather than the 60
 *     the rule enforces. Capping it at 60 would make the length rule
 *     unreachable and therefore untestable, and would silently truncate
 *     a paste. The 120 cap exists only to bound an accidental 5,000
 *     character paste.
 *
 *   - Continue is disabled until something is chosen, and says so. A
 *     disabled button with no explanation is the most common way apps
 *     confuse people; nothing is ever silently refused.
 */
export function GrowthAreasScreen() {
  const navigate = useNavigate()
  const { draft, areas, isSelected, toggleArea, createCustomArea, advanceFrom } = useOnboarding()

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [problem, setProblem] = useState<string | undefined>(undefined)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const fieldRef = useRef<HTMLInputElement>(null)
  const createRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)

  useEffect(() => {
    if (creating) fieldRef.current?.focus()
    else if (restoreFocus.current) {
      createRef.current?.focus()
      restoreFocus.current = false
    }
  }, [creating])

  const suggested = areas.filter((area) => area.kind === 'suggested')
  const custom = areas.filter((area) => area.kind === 'custom')

  // Whether Continue is enabled is a DOMAIN question, asked through the
  // step's own validator. The screen used to decide it by counting chips,
  // which meant the rule lived in two places and the two would eventually
  // disagree. A component may ask about its own step; it must never decide
  // whether onboarding is complete overall.
  const step = isGrowthAreaStepValid(draft)
  const canContinue = step.valid

  // The count is for display only. It reports what the user picked and is
  // never used to decide anything.
  const chosenCount = areas.filter((area) => isSelected(area.id)).length

  const closeComposer = () => {
    restoreFocus.current = true
    setCreating(false)
    setName('')
    setProblem(undefined)
    // The confirmation belongs to the composer that produced it. Closing
    // the composer ends that conversation, so leaving "Piano added." on
    // screen means the next time they open it they are told about an add
    // that happened a minute and a click ago — a live region saying
    // something that is no longer what just happened.
    setJustAdded(null)
  }

  const onSubmit = (event: FormEvent) => {
    // A real <form> so Enter in the field submits, which is what a
    // keyboard user expects and what a mouse user gets from the button.
    event.preventDefault()

    const result = createCustomArea(name)

    if (!result.ok) {
      setProblem(result.message)
      // One outcome at a time. Showing "Piano added." while the box below
      // it refuses to add anything says two contradictory things at once,
      // and the refusal is the one that is about to matter.
      setJustAdded(null)
      fieldRef.current?.focus()
      return
    }

    setName('')
    setProblem(undefined)
    // Announced politely rather than by moving focus, because moving
    // focus would rip the user out of the field mid-typing.
    setJustAdded(result.area.name)
  }

  const onContinue = () => {
    advanceFrom('growth-areas')
    // React Router 7 types navigate() as possibly returning a promise.
    // There is nothing to await here, so `void` states that rather than
    // silencing a real check.
    void navigate('/onboarding/goal')
  }

  return (
    <>
      <ScreenHeader title="What do you want to improve?">
        <p>Choose anything that matters to you. Review your choices before starting.</p>
      </ScreenHeader>

      <section className="areas" aria-labelledby="suggested-heading">
        <h2 className="areas__heading" id="suggested-heading">
          Pick any of these
        </h2>

        {/*
          A labelled group rather than a bare list of buttons: it tells a
          screen reader that these buttons belong together and answer one
          question, which is what makes a screen of ten toggles
          navigable rather than an undifferentiated pile.
        */}
        <div className="areas__list" role="group" aria-labelledby="suggested-heading">
          {suggested.map((area) => (
            <GrowthAreaChip
              key={area.id}
              area={area}
              selected={isSelected(area.id)}
              onToggle={toggleArea}
            />
          ))}
        </div>
      </section>

      {custom.length > 0 ? (
        <section className="areas" aria-labelledby="custom-heading">
          <h2 className="areas__heading" id="custom-heading">
            Yours
          </h2>

          {/*
            Same component, same rules, same toggle function as the
            suggestions above. Only the heading differs, and that is
            presentation rather than behaviour.
          */}
          <div className="areas__list" role="group" aria-labelledby="custom-heading">
            {custom.map((area) => (
              <GrowthAreaChip
                key={area.id}
                area={area}
                selected={isSelected(area.id)}
                onToggle={toggleArea}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="areas">
        {creating ? (
          <form className="areas__composer" onSubmit={onSubmit} noValidate>
            <TextField
              ref={fieldRef}
              label="What do you want to improve?"
              hint="Anything you like — Piano, Cooking, Public speaking."
              placeholder="Piano"
              value={name}
              error={problem}
              maxLength={MAX_GROWTH_AREA_NAME_LENGTH * 2}
              autoComplete="off"
              onChange={(event) => {
                setName(event.target.value)
                // Clear the complaint as soon as they start fixing it,
                // so the message is never stale about what they typed.
                if (problem) setProblem(undefined)
              }}
            />

            <div className="areas__composer-actions">
              <Button type="submit" fullWidth>
                Add it
              </Button>
              <Button variant="quiet" onClick={closeComposer}>
                Cancel
              </Button>
            </div>

            {justAdded ? (
              <p className="areas__added" role="status">
                {justAdded} added.
              </p>
            ) : null}
          </form>
        ) : (
          <Button ref={createRef} variant="secondary" leadingIcon={<Icon name="plus" size={18} />} onClick={() => setCreating(true)}>
            Create your own
          </Button>
        )}
      </section>

      <div className="onboarding__actions">
        <Button variant="primary" size="lg" fullWidth disabled={!canContinue} onClick={onContinue}>
          Continue
        </Button>

        {canContinue ? (
          <p className="areas__count text-sm text-muted">
            {chosenCount === 1
              ? '1 chosen. Pick more, or continue.'
              : `${chosenCount} chosen. Pick more, or continue.`}
          </p>
        ) : (
          // The message comes from the validator, so the reason the
          // button is disabled is stated in exactly one place and can
          // never drift from the rule.
          <p className="areas__count text-sm text-muted">{step.message}</p>
        )}

        <Button variant="quiet" onClick={() => void navigate('/onboarding')}>
          Back
        </Button>
      </div>
    </>
  )
}
