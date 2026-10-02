import { ScreenHeader } from '../../app/ScreenHeader'
import { Card, Skeleton } from '../../components/ui'
import './TodayScreen.css'

/** Shared by the lazy route and plan load so neither transition goes blank. */
export function TodayLoading() {
  return (
    <div className="today" aria-busy="true">
      <ScreenHeader title="Today"><p>One meaningful action at a time.</p></ScreenHeader>
      <Card className="today__win-card today__loading-win">
        <div className="today__win-content" aria-hidden="true">
          <Skeleton width="8rem" height="1.25rem" />
          <Skeleton height="2.5rem" />
          <Skeleton width="5rem" height="2.75rem" />
        </div>
      </Card>
      <Card className="today__steps-card today__loading-steps">
        <div className="today__steps-content" aria-hidden="true">
          <Skeleton width="8rem" height="1.25rem" />
          <Skeleton height="2.75rem" />
          <Skeleton height="2.75rem" />
        </div>
      </Card>
      <p className="visually-hidden" role="status">Loading today’s plan…</p>
    </div>
  )
}
