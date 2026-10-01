import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { ScreenHeader } from '../../app/ScreenHeader'
import { Button, TextField } from '../../components/ui'
import { MAX_MILESTONE_LENGTH, MAX_MILESTONES } from '../../domain/milestone'
import type { DraftMilestone } from '../../domain/milestone'
import { isMilestoneStepValid } from '../../domain/onboardingValidation'
import { useOnboarding } from './OnboardingDraftProvider'
import './MilestonesScreen.css'

/**
 * Which form is open at the bottom of the screen, if any.
 *
 * One composer serves both jobs rather than each row growing its own. A row
 * that swaps itself for a text field has nowhere to put focus back when it
 * closes, because the button it replaced no longer exists; a single composer
 * below a list that never unmounts keeps every row and every button in place,
 * so returning focus is a matter of naming the row rather than rebuilding it.
 */
type Composer =
  | { readonly kind: 'add' }
  | { readonly kind: 'edit'; readonly id: string }

/**
 * Step 6 — "What would prove you're making progress?"
 *
 * WHY THIS IS THE ONLY LIST OF SENTENCES IN ONBOARDING
 *
 * Growth Areas are chosen from a grid and a custom one is a label. A milestone
 * is a sentence the user wrote about their own life — the same kind of data as
 * the Goal and the WHY, in a list. That combination is what makes identity
 * matter here for the first time: every later phase will point at a specific
 * milestone ("you said earning your first £100 would prove it"), and it has to
 * keep pointing at it when the wording is corrected.
 *
 * So renaming changes the sentence and NOTHING else. The id is read, never
 * written; a rename that changed the id would orphan every reference, and
 * "Run my first 5k" and "run my first 5K" would be two different milestones.
 * Both rules live in milestone.ts and are tested there; this screen just has to
 * avoid breaking them, which is why the "Change" form sends the id it was
 * opened with rather than re-deriving one from the text.
 *
 * WHY THE USER'S WORDING IS KEPT EXACTLY
 *
 * Only outer whitespace is trimmed. Nothing is rewritten, nothing is
 * capitalised, nothing is punctuated for them. And unlike the custom Growth
 * Area composer, a milestone is NOT required to contain a word: one word is a
 * complete answer, and ASCEND does not grade vocabulary. That is the same call
 * personalAnswer.ts made for the Goal and the WHY, and it is the reason "🎹"
 * is a legal milestone here.
 *
 * WHY THERE IS NO CONFIRMATION DIALOG ON REMOVE
 *
 * It was considered and left out. A milestone is one short sentence, there are
 * at most five, and retyping a deleted one takes seconds — while a modal on
 * every removal is friction on the common path to protect against a rare
 * mistake. What the user does get is an announced "Removed.", and the text
 * stays in their browser history of the form for a moment. If milestones ever
 * grow consequences — a streak, points, a Journey row that depends on them —
 * this call should be revisited, because then a removal really would destroy
 * something.
 *
 * WHAT THIS SCREEN DELIBERATELY DOES NOT ASK
 *
 * Which Growth Area a milestone belongs to. In V1 milestones are
 * Journey-level (ADR 0010): the user has not been given a reason to sort them,
 * and asking would imply a structure the rest of the app does not have yet.
 * Also absent: any completion checkbox, any date, any points, any ownership.
 * A milestone in Phase 2C is a sentence and an id, and nothing else.
 */
export function MilestonesScreen() {
  const navigate = useNavigate()
  const { draft, addMilestone, editMilestone, removeMilestone, advanceFrom } = useOnboarding()

  const list: readonly DraftMilestone[] = draft?.milestones ?? []
  const atMax = list.length >= MAX_MILESTONES

  const [composer, setComposer] = useState<Composer | null>(null)
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<string | undefined>(undefined)
  const [confirmation, setConfirmation] = useState<string | undefined>(undefined)

  /**
   * Where focus goes once the composer has closed.
   *
   * Held as state rather than moved directly in the handler, because the target
   * may not exist yet when the handler runs: closing the composer is what
   * re-renders the row buttons back into place, and focusing before that render
   * would focus an element React is about to remove.
   */
  const [pendingFocus, setPendingFocus] = useState<string | 'add' | null>(null)

  const fieldRef = useRef<HTMLInputElement | null>(null)
  const addRef = useRef<HTMLButtonElement | null>(null)
  const continueRef = useRef<HTMLButtonElement | null>(null)
  const rowRefs = useRef(new Map<string, HTMLButtonElement>())

  // Move into the composer the moment it opens, so a keyboard user is taken to
  // the box rather than having to tab past the whole list to find it.
  useEffect(() => {
    if (composer !== null) fieldRef.current?.focus()
  }, [composer])

  useEffect(() => {
    if (composer !== null || pendingFocus === null) return

    if (pendingFocus === 'add') {
      // The add control is hidden once the list is full, which is exactly the
      // state the user reaches by adding the fifth milestone. Falling back to
      // Continue is honest there: there is nothing left to add, so the next
      // thing to do IS to continue.
      const target = addRef.current ?? continueRef.current
      target?.focus()
    } else {
      rowRefs.current.get(pendingFocus)?.focus()
    }

    // Clear on the next tick so the focus effect runs without a synchronous
    // setState in its body. The pendingFocus value is the signal that focus
    // is needed; once consumed it is retired.
    setTimeout(() => {
      setPendingFocus(null)
    }, 0)
  }, [composer, pendingFocus])

  const openAdd = () => {
    setComposer({ kind: 'add' })
    setText('')
    setProblem(undefined)
    setConfirmation(undefined)
  }

  const openEdit = (milestone: DraftMilestone) => {
    setComposer({ kind: 'edit', id: milestone.id })
    setText(milestone.text)
    setProblem(undefined)
    setConfirmation(undefined)
  }

  const closeComposer = () => {
    // For a save this is the row that was edited; for a cancel, the same. An
    // add closes to the add control, which only disappears when the list is
    // full — handled by the effect above.
    setPendingFocus(composer?.kind === 'edit' ? composer.id : 'add')
    setComposer(null)
    setText('')
    setProblem(undefined)
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (composer === null) return

    const isEdit = composer.kind === 'edit'
    const result = isEdit ? editMilestone(composer.id, text) : addMilestone(text)

    if (!result.ok) {
      setProblem(result.message)
      // Focus the box that needs fixing rather than only announcing it. The
      // refusal is an ordinary thing a person does — a blank box, a sentence
      // already on the list — and it is always fixable right here.
      fieldRef.current?.focus()
      return
    }

    setConfirmation(isEdit ? 'Saved. Your wording was kept.' : 'Added.')
    closeComposer()
  }

  const onRemove = (milestone: DraftMilestone) => {
    // Choose the neighbour BEFORE the removal, so focus lands on something
    // that still exists afterwards. Falling back to the add control covers
    // removing the last one.
    const index = list.findIndex((entry) => entry.id === milestone.id)
    const neighbour = list[index + 1] ?? list[index - 1]

    removeMilestone(milestone.id)
    setConfirmation('Removed.')
    setPendingFocus(neighbour ? neighbour.id : 'add')
  }

  const step = isMilestoneStepValid(draft)

  return (
    <div className="milestones">
      <ScreenHeader title="What would prove you’re making progress?">
        <p>Add a few real outcomes you can point to along the way.</p>
      </ScreenHeader>

      {list.length > 0 ? (
        <>
          <p className="milestones__count text-sm text-muted">
            {list.length === 1 ? '1 so far' : `${list.length} so far`}
            {atMax ? ' — that is the most you can add.' : ''}
          </p>

          <ul className="milestones__list">
            {list.map((milestone) => (
              <li
                key={milestone.id}
                className={
                  composer?.kind === 'edit' && composer.id === milestone.id
                    ? 'milestones__item milestones__item--editing'
                    : 'milestones__item'
                }
              >
                <p className="milestones__text">{milestone.text}</p>

                <div className="milestones__item-actions">
                  <Button
                    variant="quiet"
                    ref={(element) => {
                      // A ref callback returning nothing, because the cleanup
                      // form would delete the entry on every re-render when it
                      // returns the removal function.
                      if (element) rowRefs.current.set(milestone.id, element)
                      else rowRefs.current.delete(milestone.id)
                    }}
                    /*
                     * The accessible name has to say WHICH milestone, because
                     * five buttons reading "Change" in a row say nothing. The
                     * visible label stays short; only assistive technology
                     * hears the sentence.
                     */
                    aria-label={`Change “${milestone.text}”`}
                    onClick={() => openEdit(milestone)}
                  >
                    Change
                  </Button>

                  <Button
                    variant="quiet"
                    aria-label={`Remove “${milestone.text}”`}
                    onClick={() => onRemove(milestone)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="milestones__composer-area">
        {composer === null ? (
          atMax ? (
            <p className="milestones__limit text-sm text-muted">
              That is {MAX_MILESTONES} — remove one to add another.
            </p>
          ) : (
            <Button variant="secondary" ref={addRef} onClick={openAdd}>
              + Add a milestone
            </Button>
          )
        ) : (
          <form className="milestones__composer" onSubmit={onSubmit} noValidate>
            <TextField
              label={composer.kind === 'edit' ? 'Change this milestone' : 'Add a milestone'}
              hint="Something you could honestly say you did. Not a promise, and not a deadline."
              error={problem}
              placeholder="Run 5 km without stopping"
              type="text"
              autoComplete="off"
              value={text}
              ref={(element) => {
                fieldRef.current = element
              }}
              onChange={(event) => {
                setText(event.target.value)
                // The complaint goes as soon as they start fixing it, so it is
                // never stale about what is now in the box.
                if (problem) setProblem(undefined)
              }}
              /*
               * Twice the limit the rule enforces, for the same reason the
               * Growth Area composer and the Goal field are: a cap set AT the
               * limit makes the limit unreachable and untestable, and it
               * silently swallows a paste. This still bounds a long paste, and
               * a genuinely over-long milestone is refused with a message
               * rather than truncated.
               */
              maxLength={MAX_MILESTONE_LENGTH * 2}
            />

            <div className="milestones__composer-actions">
              <Button type="submit" fullWidth>
                {composer.kind === 'edit' ? 'Save' : 'Add it'}
              </Button>
              <Button variant="quiet" onClick={closeComposer}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      <div className="onboarding__actions">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          ref={continueRef}
          disabled={!step.valid}
          onClick={() => {
            advanceFrom('milestones')
            void navigate('/onboarding/effort')
          }}
        >
          Continue
        </Button>

        {/*
          One paragraph, always present. It carries the refusal when the list
          is empty, the confirmation after a change, and otherwise stays quiet.
          Keeping it a polite live region means an add, an edit or a removal is
          announced without moving the user's focus for them.
        */}
        <p className="milestones__status text-sm text-muted" role="status">
          {confirmation ?? (step.valid ? 'These are yours. You can change them later.' : step.message)}
        </p>

        <Button variant="quiet" onClick={() => void navigate('/onboarding/duration')}>
          Back
        </Button>
      </div>
    </div>
  )
}
