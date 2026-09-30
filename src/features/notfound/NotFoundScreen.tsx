import { useNavigate } from 'react-router-dom'

import { ScreenHeader } from '../../app/ScreenHeader'
import { Button, Card, EmptyState } from '../../components/ui'

/**
 * Not found.
 *
 * Written as a recovery rather than a dead end: the user probably
 * mistyped something or followed an old link, and the most useful thing
 * we can do is get them back to today.
 *
 * Implementation note: this uses a real <button> and navigates with
 * useNavigate, rather than wrapping a <Link> in a <Button>. Nesting an
 * anchor inside a button is invalid HTML and produces a control that
 * screen readers announce with two conflicting roles.
 */
export function NotFoundScreen() {
  const navigate = useNavigate()

  return (
    <>
      <ScreenHeader title="Page not found">
        <p>That link does not lead anywhere in ASCEND.</p>
      </ScreenHeader>

      <Card>
        <EmptyState
          title="Let's get you back on track"
          description="The page you were looking for does not exist. Your plan and progress are untouched."
          action={
            <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/')}>
              Go to Today
            </Button>
          }
        />
      </Card>
    </>
  )
}
