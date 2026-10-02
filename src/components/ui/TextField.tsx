import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, Ref, TextareaHTMLAttributes } from 'react'

import { cn } from '../../lib/cn'
import './TextField.css'

interface BaseTextFieldProps {
  label: string
  /** Retain the accessible name when the screen heading states the question. */
  labelHidden?: boolean
  hint?: ReactNode
  error?: string | undefined
  /** Rendered at the end of the label row, e.g. an optional marker. */
  labelSuffix?: ReactNode
}

export interface TextFieldProps
  extends BaseTextFieldProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, 'aria-describedby' | 'id'> {
  /**
   * Exposed so a form can move focus to the field it is complaining about.
   *
   * This used to be declared on the textarea ONLY, with the reasoning that
   * nothing in ASCEND needed to focus a single-line input and an unused prop
   * is a prop somebody eventually uses for the wrong thing. Phase 2C is the
   * counter-example that turns out to have been foreseeable all along: the
   * custom number field on the Duration and Daily Effort screens is a
   * single-line input, and it has exactly the same reason to want focus as
   * the Goal textarea does — a numeric complaint is announced, but a
   * screen-reader user still has to be taken to the box that needs fixing.
   *
   * So the constraint is lifted rather than worked around. The alternative
   * was querying the DOM for the <input> inside the field's wrapper, which
   * would reach past the component's own API to do something the component
   * can do itself.
   *
   * `InputHTMLAttributes` does not carry `ref` (that lives in
   * ClassAttributes), so it has to be declared — and because this is React 19
   * it needs no `forwardRef` wrapper: `ref` arrives as an ordinary prop and
   * `{...rest}` passes it to the <input>.
   */
  ref?: Ref<HTMLInputElement>
}

export interface TextAreaFieldProps
  extends BaseTextFieldProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'aria-describedby' | 'id'> {
  /**
   * Exposed so a form can move focus to the field it is complaining
   * about. `TextareaHTMLAttributes` does not carry `ref` (that lives in
   * ClassAttributes), so it has to be declared — and because this is React
   * 19 it needs no `forwardRef` wrapper: `ref` arrives as an ordinary
   * prop and `{...rest}` passes it to the <textarea>.
   */
  ref?: Ref<HTMLTextAreaElement>
}

const describedBy = (id: string, hint: ReactNode, error?: string): string | undefined => {
  const ids = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean)
  return ids.length > 0 ? ids.join(' ') : undefined
}

/**
 * Text inputs.
 *
 * The accessibility work here is the part people skip:
 *   - The label is a real <label for>...</label>, never a placeholder.
 *     Placeholders disappear when the user types and are unreadable at
 *     high zoom, which breaks the "label in name" screen-reader test.
 *   - Hint and error text are programmatically linked with
 *     aria-describedby, so a screen reader announces them with the field.
 *   - Errors use role="alert" so they are announced when they appear.
 *   - Font size is inherited (never shrunk), so browser text scaling works.
 */
export function TextField({
  label,
  labelHidden = false,
  hint,
  error,
  labelSuffix,
  className,
  ...rest
}: TextFieldProps) {
  const id = useId()

  return (
    <div className={cn('field', error && 'field--invalid', className)}>
      <label className={labelHidden ? 'visually-hidden' : 'field__label'} htmlFor={id}>
        {label}
        {labelSuffix ? <span className="field__label-suffix">{labelSuffix}</span> : null}
      </label>

      <input
        {...rest}
        id={id}
        className="field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
      />

      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  )
}

export function TextAreaField({
  label,
  labelHidden = false,
  hint,
  error,
  labelSuffix,
  className,
  rows = 4,
  ...rest
}: TextAreaFieldProps) {
  const id = useId()

  return (
    <div className={cn('field', error && 'field--invalid', className)}>
      <label className={labelHidden ? 'visually-hidden' : 'field__label'} htmlFor={id}>
        {label}
        {labelSuffix ? <span className="field__label-suffix">{labelSuffix}</span> : null}
      </label>

      <textarea
        {...rest}
        id={id}
        rows={rows}
        className="field__input field__input--multiline"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
      />

      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  )
}

function FieldMessages({
  id,
  hint,
  error,
}: {
  id: string
  hint: ReactNode
  error?: string | undefined
}) {
  return (
    <>
      {error ? (
        <p className="field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </>
  )
}
