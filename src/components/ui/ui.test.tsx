import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button, ProgressBar, TextField } from './index'

describe('Button', () => {
  it('defaults to type="button" so it cannot submit a form by accident', () => {
    render(<Button>Complete</Button>)

    // A button inside a form defaults to submit. This is a real bug we
    // have prevented before, so it is worth a permanent test.
    expect(screen.getByRole('button', { name: /complete/i })).toHaveAttribute('type', 'button')
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={onClick}>Start</Button>)

    await user.click(screen.getByRole('button', { name: /start/i }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not call onClick while loading', async () => {
    // Saving a step must be impossible to double-submit.
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    )

    const button = screen.getByRole('button')
    await user.click(button)

    expect(onClick).not.toHaveBeenCalled()
    expect(button).toBeDisabled()
  })

  it('cannot override loading safety with disabled={false}', () => {
    render(
      <Button loading disabled={false}>
        Saving
      </Button>,
    )

    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('exposes aria-busy while loading', () => {
    render(<Button loading>Saving</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
  })

  it('is reachable by keyboard with Enter', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={onClick}>Complete</Button>)

    await user.tab()
    expect(screen.getByRole('button')).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('ProgressBar', () => {
  it('exposes value information to assistive technology', () => {
    render(<ProgressBar label="Today's steps" value={2} max={4} />)

    const bar = screen.getByRole('progressbar', { name: /today's steps/i })

    expect(bar).toHaveAttribute('aria-valuenow', '2')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '4')
  })

  it('shows the numbers as text, never colour alone', () => {
    // A bar on its own communicates nothing to many users. The count is
    // always present in the visible output.
    render(<ProgressBar label="Today's steps" value={2} max={4} />)

    expect(screen.getByText('2 of 4')).toBeInTheDocument()
  })

  it('clamps out-of-range values instead of rendering a broken bar', () => {
    // A bug in scoring must not produce a bar wider than its track.
    render(<ProgressBar label="Steps" value={99} max={4} />)

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4')
  })

  it('survives a zero or invalid max', () => {
    render(<ProgressBar label="Steps" value={0} max={0} />)

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '1')
  })

  it('uses a custom valueText when provided', () => {
    render(
      <ProgressBar
        label="This week"
        value={6}
        max={7}
        valueText="6 of 7 days active, 86% consistency"
      />,
    )

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '6 of 7 days active, 86% consistency',
    )
  })

  it('keeps an accessible label when the visible value is hidden', () => {
    render(<ProgressBar label="Today's steps" value={2} max={4} showValue={false} />)

    const bar = screen.getByRole('progressbar', { name: /today's steps/i })
    const labelledBy = bar.getAttribute('aria-labelledby')

    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy ?? '')).toHaveTextContent("Today's steps")
    expect(screen.queryByText('2 of 4')).not.toBeInTheDocument()
  })
})

describe('TextField', () => {
  it('associates the label with the input', () => {
    render(<TextField label="Goal" />)

    expect(screen.getByLabelText('Goal')).toBeInTheDocument()
  })

  it('links hint text to the input via aria-describedby', () => {
    render(<TextField label="Goal" hint="One sentence is enough." />)

    const input = screen.getByLabelText('Goal')
    const hint = screen.getByText('One sentence is enough.')

    expect(input).toHaveAttribute('aria-describedby', hint.id)
  })

  it('marks the field invalid and announces the error', () => {
    render(<TextField label="Goal" error="Tell us what you want to improve." />)

    expect(screen.getByLabelText('Goal')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Tell us what you want to improve.')
  })

  it('keeps a valid field free of invalid state', () => {
    render(<TextField label="Goal" />)

    expect(screen.getByLabelText('Goal')).not.toHaveAttribute('aria-invalid')
  })
})
