import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { ScreenHeader } from '../../app/ScreenHeader'
import { Button, TextAreaField } from '../../components/ui'
import type { StepValidation } from '../../domain/onboardingValidation'
import './AnswerStepScreen.css'

export interface AnswerStepScreenProps {
  /** The question in the user's own words. This becomes the page's <h1>. */
  question: string
  /** One short line under the question. Never two. */
  body: string
  /** Always-visible help under the field, linked with aria-describedby. */
  hint: string
  /**
   * Example text for an empty field.
   *
   * An example, never a template: the value is not validated against it
   * and the user is never nudged towards it. It exists so an empty box
   * does not read as "type something legal here".
   */
  placeholder: string
  /** The limit the domain enforces. The DOM cap is deliberately larger. */
  maxLength: number
  /**
   * What the user currently sees in the field, untrimmed.
   *
   * The screen keeps this locally and writes through on every keystroke,
   * rather than reading it back from the draft. Storage holds the trimmed
   * sentence, so a controlled input bound to it would eat the space the
   * user just typed and put the caret back a character — which makes long
   * sentences almost impossible to type.
   */
  value: string
  onChange: (raw: string) => void
  /**
   * The step's own domain validation, passed in rather than computed here.
   *
   * A screen may display what the domain decided. It may not decide
   * anything itself, or the rule ends up living in two places and the two
   * drift — and the drift only ever shows up for the person on the
   * unusual path.
   */
  validation: StepValidation
  /** Called with a valid answer. */
  onContinue: () => void
  /** Where the visible Back control goes. Always a real URL. */
  backTo: string
  /**
   * Set on a step that is the last one this build can show. After
   * Continue, the CTA is replaced by this honest note plus a way back.
   *
   * Phase 2B uses it on the WHY, where "the next question is not built
   * yet" is the truthful thing to say and a button that goes nowhere would
   * be a lie. Nothing about the stored draft changes: after a refresh the
   * answer is still there and Continue is still pressable, which is a
   * smaller cost than recording a "they finished" flag that would then
   * have to be kept in step with the answers themselves.
   */
  finishedMessage?: string
}

/**
 * One question, one textarea, one decision.
 *
 * The Goal and the WHY are the same screen with different words, and they
 * are built from one component on purpose. The parts that matter —
 * a real <label>, a hint linked to the field, errors announced with
 * role="alert", focus moved to the thing that needs fixing, a Back
 * control, a 44px CTA — are the parts that are easy to forget in the
 * second copy and impossible to notice missing until a keyboard user hits
 * them. One component means the third text-based step in Phase 2C is
 * twenty lines of configuration rather than a third implementation to keep
 * in step.
 *
 * WHY CONTINUE IS NOT DISABLED
 *
 * Phase 2A disables Continue until something is chosen, and says why next
 * to it. That is right for a group of chips, where the reason is static
 * and the user can see it without trying.
 *
 * It is wrong here, and the difference is the input type. A disabled
 * button is skipped by the tab order, so a keyboard or screen-reader user
 * cannot reach it at all and never finds out why. A text field also has
 * no visible "state" to inspect: the screen cannot know whether the box is
 * empty because the question was skipped or because the person has not
 * started yet, and refusing to enable a button over that distinction is
 * how apps end up blocking people who were mid-sentence.
 *
 * So Continue is always pressable. Pressing it with nothing usable shows
 * the validator's own message under the field and moves focus there.
 * Nothing is ever silently refused, and the user is told the reason in one
 * place — the domain — rather than in two.
 */
export function AnswerStepScreen({
  question,
  body,
  hint,
  placeholder,
  maxLength,
  value,
  onChange,
  validation,
  onContinue,
  backTo,
  finishedMessage,
}: AnswerStepScreenProps) {
  const navigate = useNavigate()
  const [field, setField] = useState<HTMLTextAreaElement | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [finished, setFinished] = useState(false)

  // Shown only after a real attempt. An empty box on arrival is not a
  // mistake, and announcing "tell us what you would love to achieve" at
  // someone who has not read the question yet is the tone this app does
  // not use.
  const error = attempted && !validation.valid ? validation.message : undefined

  const onSubmit = (event: FormEvent) => {
    // A real <form>, so Enter inside the textarea inserts a newline
    // rather than submitting — but the button is still the way through for
    // anyone who does not want a paragraph.
    event.preventDefault()

    if (!validation.valid) {
      setAttempted(true)
      // Focus the field rather than only announcing the error: a person
      // using a screen reader should be taken to the thing that needs
      // fixing, not told about it from a distance.
      field?.focus()
      return
    }

    setAttempted(false)
    setFinished(finishedMessage !== undefined)
    onContinue()
  }

  return (
    <form className="answer-step" onSubmit={onSubmit} noValidate>
      <ScreenHeader title={question}>
        <p>{body}</p>
      </ScreenHeader>

      <div className="answer-step__field">
        <TextAreaField
          label={question}
          hint={hint}
          error={error}
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            // The complaint goes as soon as they start fixing it, so it is
            // never stale about what is now in the box.
            if (error) setAttempted(false)
          }}
          /*
           * Twice the limit the rule enforces, for the same reason the
           * Growth Areas composer is capped at double its rule: a cap set
           * AT the limit makes the limit unreachable, which makes it
           * untestable, and it silently swallows a paste. This still bounds
           * a 5,000-character paste, and a genuinely over-long answer is
           * refused with a message rather than truncated.
           */
          maxLength={maxLength * 2}
          rows={4}
          ref={setField}
          autoComplete="off"
        />
      </div>

      <div className="onboarding__actions">
        {finished && finishedMessage ? (
          <>
            {/*
              The boundary of this build, stated plainly. Phase 2C's
              duration question does not exist yet, and a Continue button
              that quietly goes nowhere — or a success screen for something
              that has not been built — would be worse than admitting it.
            */}
            <p className="answer-step__boundary" role="status">
              {finishedMessage}
            </p>
            <Button variant="secondary" fullWidth onClick={() => setFinished(false)}>
              Change my answer
            </Button>
          </>
        ) : (
          <>
            <Button type="submit" variant="primary" size="lg" fullWidth>
              Continue
            </Button>

            <Button variant="quiet" onClick={() => void navigate(backTo)}>
              Back
            </Button>
          </>
        )}
      </div>
    </form>
  )
}
