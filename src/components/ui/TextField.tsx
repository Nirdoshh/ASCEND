import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

import { cn } from '../../lib/cn'
import './TextField.css'

interface BaseTextFieldProps {
  label: string
  hint?: ReactNode
  error?: string | undefined
  /** Rendered at the end of the label row, e.g. an optional marker. */
  labelSuffix?: ReactNode
}

export interface TextFieldProps
  extends BaseTextFieldProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, 'aria-describedby' | 'id'> {}

export interface TextAreaFieldProps
  extends BaseTextFieldProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'aria-describedby' | 'id'> {}

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
  hint,
  error,
  labelSuffix,
  className,
  ...rest
}: TextFieldProps) {
  const id = useId()

  return (
    <div className={cn('field', error && 'field--invalid', className)}>
      <label className="field__label" htmlFor={id}>
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
      <label className="field__label" htmlFor={id}>
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
