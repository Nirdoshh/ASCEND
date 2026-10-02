import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { ScreenHeader } from '../../app/ScreenHeader'
import { Button, ChoiceChip, TextField } from '../../components/ui'
import { parseNumberChoice } from '../../domain/schedule'
import type { StepValidation } from '../../domain/onboardingValidation'
import './NumberChoiceStepScreen.css'

export interface NumberChoiceStepScreenProps {
  /** The question in the user's own words. Becomes the page's <h1>. */
  question: string
  /** One short line under the question. Never two. */
  body: string
  /** The offered answers, in the order they should be read. */
  presets: readonly number[]
  /** The unit every option is labelled with, e.g. "days". */
  unit: string
  /** The range the domain accepts, for parsing and for the field's own hint. */
  bounds: { min: number; max: number; unit: string }
  /** Label on the button that reveals the free-entry field. */
  customLabel: string
  /** What the custom field is called once it is open. */
  customFieldLabel: string
  /** What the custom field is for. Shown under it, linked with aria-describedby. */
  customHint: string
  /** An example, never a template. Shown in the empty custom field. */
  customPlaceholder: string
  /** The stored answer, or undefined when the question has not been answered. */
  value: number | undefined
  onSelect: (value: number) => void
  /**
   * The step's own domain validation, passed in rather than computed here.
   *
   * A screen may display what the domain decided. It may not decide anything
   * itself, or the rule ends up living in two places and the two drift — and
   * the drift only ever shows up for the person on the unusual path.
   */
  validation: StepValidation
  /**
   * Called with a valid answer. The caller records it and decides where the
   * user goes next, exactly as `AnswerStepScreen` does — this component is
   * never the thing that knows a URL.
   */
  onContinue: () => void
  /** Where the visible Back control goes. Always a real URL. */
  backTo: string
}

/**
 * One question, a row of preset numbers, and an optional box to type another.
 *
 * The Duration and the Daily Effort screens are the same screen with different
 * words, bounds and unit, and they are built from one component on purpose.
 * The parts that matter — a labelled group so a screen reader knows these
 * options answer one question, `aria-pressed` rather than a colour, a tick so
 * the state survives greyscale, focus moved to the box that needs fixing, a
 * 44px target on every option — are the parts that are easy to forget in the
 * second copy and impossible to notice missing until a keyboard user hits
 * them.
 *
 * WHY A WHOLE NUMBER IS PARSED IN THE DOMAIN AND NOT HERE
 *
 * `parseNumberChoice` lives in schedule.ts, next to the bounds it enforces.
 * This component never decides whether "30.5" or "0" is acceptable; it hands
 * the raw string over and renders whatever comes back. That is what makes the
 * message under the field and the message in the step validator the same
 * message, generated from the same constants.
 *
 * WHY CONTINUE IS DISABLED HERE, HAVING ARGUED AGAINST IT FOR TEXT
 *
 * `AnswerStepScreen` keeps Continue pressable and explains the refusal on
 * press, because a text field has no visible state to inspect and a disabled
 * button is skipped by the tab order. Neither argument applies to a group of
 * presets.
 *
 * The state IS visible — a chip is pressed or it is not — and the reason for
 * being unable to continue is static and readable without trying: the
 * validator's own message sits directly under the button. This is the same
 * call Phase 2A made for the Growth Area chips, and the two screens agree.
 *
 * THE ONE CASE WHERE DISABLING ALONE WOULD STRAND SOMEBODY
 *
 * An out-of-range value can only arrive from hand-edited storage or a build
 * with different bounds (see schedule.ts). It is not one of the presets, so
 * nothing on screen would look selected and Continue would be disabled with a
 * message naming a range and no way to act on it.
 *
 * So when the stored number exists but is not a preset, the custom field opens
 * by itself, pre-filled with the value that is actually stored. The user sees
 * what this build read, and can change it. Nothing is silently discarded and
 * nothing is silently rewritten to the nearest allowed number.
 */
export function NumberChoiceStepScreen({
  question,
  body,
  presets,
  unit,
  bounds,
  customLabel,
  customFieldLabel,
  customHint,
  customPlaceholder,
  value,
  onSelect,
  validation,
  onContinue,
  backTo,
}: NumberChoiceStepScreenProps) {
  const navigate = useNavigate()

  const [field, setField] = useState<HTMLInputElement | null>(null)
  const [problem, setProblem] = useState<string | undefined>(undefined)

  /*
   * A stored value that is not one of the presets is the case that has to show
   * itself: see the note above. `String` rather than a formatted number, so the
   * box shows exactly what is stored — including an odd value — rather than a
   * tidied version of it.
   */
  const storedButNotPreset = value !== undefined && !presets.includes(value)

  const [customOpen, setCustomOpen] = useState(storedButNotPreset)
  const [customText, setCustomText] = useState(storedButNotPreset ? String(value) : '')
  const customButtonRef = useRef<HTMLButtonElement>(null)
  const restoreCustomFocus = useRef(false)

  useEffect(() => {
    if (customOpen) field?.focus()
    else if (restoreCustomFocus.current) {
      customButtonRef.current?.focus()
      restoreCustomFocus.current = false
    }
  }, [customOpen, field])

  // The value the field was last seeded from, so the effect below can tell a
  // NEW unusable value from a re-render of the same one. It must not reset the
  // box while somebody is typing in it, and typing does not change `value`.
  const seededFrom = useRef(validation.valid ? null : (value ?? null))

  useEffect(() => {
    if (!storedButNotPreset) return
    if (seededFrom.current === value) return

    seededFrom.current = value ?? null
    setCustomOpen(true)
    setCustomText(String(value))
    setProblem(undefined)
  }, [storedButNotPreset, value])

  const closeCustom = (restore = false) => {
    restoreCustomFocus.current = restore
    setCustomOpen(false)
    setProblem(undefined)
    // Re-seed from what is actually stored, so cancelling is a real cancel
    // rather than leaving the last thing typed in a closed box.
    setCustomText(storedButNotPreset ? String(value) : '')
  }

  const onSubmitCustom = (event: FormEvent) => {
    // A real <form> so Enter in the field submits, which is what a keyboard
    // user expects and what a mouse user gets from the button.
    event.preventDefault()

    const result = parseNumberChoice(customText, bounds)

    if (!result.ok) {
      setProblem(result.message)
      // Focus the field rather than only announcing the error: a person using
      // a screen reader should be taken to the thing that needs fixing, not
      // told about it from a distance.
      field?.focus()
      return
    }

    setProblem(undefined)
    restoreCustomFocus.current = true
    setCustomOpen(false)
    seededFrom.current = result.value
    onSelect(result.value)
  }

  return (
    <div className="number-choice">
      <ScreenHeader title={question}>
        <p>{body}</p>
      </ScreenHeader>

      {/*
        `aria-label` rather than `aria-labelledby`, because the <h1> this group
        answers is rendered by ScreenHeader and has no id to point at. The label
        is the question verbatim, which is exactly what the group needs to be
        announced as.
      */}
      <div className="number-choice__options" role="group" aria-label={question}>
        {presets.map((preset) => (
          <ChoiceChip
            key={preset}
            selected={value === preset}
            onClick={() => {
              // Choosing a preset ends the "type another" conversation, so the
              // box closes and its complaint goes with it. Leaving a
              // half-typed number open next to a pressed chip would show two
              // answers at once, and one of them would be stale.
              closeCustom()
              seededFrom.current = preset
              onSelect(preset)
            }}
          >
            {preset} {unit}
          </ChoiceChip>
        ))}
      </div>

      <div className="number-choice__custom">
        {customOpen ? (
          <form className="number-choice__composer" onSubmit={onSubmitCustom} noValidate>
            <TextField
              label={customFieldLabel}
              hint={customHint}
              error={problem}
              placeholder={customPlaceholder}
              /*
               * Numeric on every platform's software keyboard, but still a text
               * input. `type="number"` makes an unparseable entry read back as
               * the empty string, which would turn the domain's precise "type a
               * whole number" into a vague "nothing was typed" — and would also
               * let the browser silently discard a paste.
               */
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={customText}
              ref={setField}
              onChange={(event) => {
                setCustomText(event.target.value)
                // The complaint goes as soon as they start fixing it, so it is
                // never stale about what is now in the box.
                if (problem) setProblem(undefined)
              }}
            />

            <div className="number-choice__composer-actions">
              <Button type="submit" fullWidth>
                Use this
              </Button>
              <Button variant="quiet" onClick={() => closeCustom(true)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button ref={customButtonRef} variant="secondary" onClick={() => setCustomOpen(true)}>
            {customLabel}
          </Button>
        )}
      </div>

      <div className="onboarding__actions">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!validation.valid}
          onClick={onContinue}
        >
          Continue
        </Button>

        <p className="number-choice__summary text-sm text-muted" role="status">
          {validation.valid ? `${value} ${unit}. Review this before starting.` : validation.message}
        </p>

        <Button variant="quiet" onClick={() => void navigate(backTo)}>
          Back
        </Button>
      </div>
    </div>
  )
}
