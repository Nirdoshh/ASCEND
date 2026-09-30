import { ScreenHeader } from '../../app/ScreenHeader'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  ProgressBar,
  Skeleton,
  TextAreaField,
  TextField,
} from '../../components/ui'
import './DesignSystemScreen.css'

/**
 * A living style reference.
 *
 * Deliberately NOT in the main navigation. Four destinations is the
 * information architecture we approved; adding a fifth "Components"
 * tab would contradict it. This route exists so that design decisions
 * can be reviewed in one place at realistic density, and so the next
 * phase has an obvious place to add every new primitive.
 *
 * It stays in the production bundle on purpose: it costs a few
 * kilobytes of already-shipped components, and having the reference
 * available on a deployed preview URL is genuinely useful for review on
 * a real phone. Gate it on import.meta.env.DEV if that trade ever
 * stops being worth it.
 */
export function DesignSystemScreen() {
  return (
    <>
      <ScreenHeader title="Design system" eyebrow="Phase 1 reference">
        <p>
          Every value below comes from a token in <code>src/styles/tokens.css</code>.
          Components never hardcode colour, radius or duration.
        </p>
      </ScreenHeader>

      <div className="stack-lg">
        <Section title="Buttons" description="One dominant action per screen.">
          <div className="ds-row">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="quiet">Quiet</Button>
            <Button variant="danger">Danger</Button>
          </div>
          <div className="ds-row">
            <Button size="lg" variant="primary">
              Large
            </Button>
            <Button size="lg" variant="secondary">
              Large secondary
            </Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title="Inputs" description="Real labels, never placeholders as instructions.">
          <TextField label="Goal" placeholder="Become capable of building and shipping" hint="One sentence is enough." />
          <TextField label="How long do you realistically have?" labelSuffix="most days" />
          <TextField label="Today's Win" error="Give this a short, concrete outcome." defaultValue="" />
          <TextAreaField label="What made things difficult today?" hint="Optional. A few words is plenty." />
        </Section>

        <Section title="Progress" description="Always paired with text, never colour alone.">
          <ProgressBar label="Today's steps" value={2} max={4} />
          <ProgressBar label="This week" value={6} max={7} valueText="6 of 7 days active, 86% consistency" />
          <ProgressBar label="Finished" value={4} max={4} tone="success" />
          <ProgressBar label="Clamped against bad input" value={99} max={4} />
        </Section>

        <Section title="Cards">
          <Card eyebrow="Today" title="Finish and deploy the database integration" description="45 minutes of focused work.">
            <p className="text-secondary">
              Cards are surfaces, not buttons. Anything actionable inside stays a real
              button or link so it stays keyboard reachable.
            </p>
          </Card>
          <Card tone="sunken" title="Sunken tone" />
          <Card tone="accent" title="Accent tone" description="Used for the WHY and for recovery messaging." />
        </Section>

        <Section title="States" description="Every empty state must help the user move forward.">
          <Card>
            <EmptyState
              title="No milestones yet"
              description="What's one result that would prove you're moving forward?"
              action={<Button variant="secondary">Add milestone</Button>}
              icon={<Icon name="journey" size={24} />}
            />
          </Card>
          <ErrorState
            title="We couldn't save that step"
            description="Your changes are still here. Nothing has been lost."
            action={<Button variant="secondary">Try again</Button>}
          />
          <div className="stack-sm" aria-hidden="true">
            <Skeleton height="1.25rem" />
            <Skeleton height="1.25rem" width="80%" />
            <Skeleton height="3rem" radius="var(--radius-lg)" />
          </div>
        </Section>

        <Section title="Icons" description="Stroke-based, inherit currentColor, decorative by default.">
          <div className="ds-row">
            {(['today', 'journey', 'progress', 'you', 'system', 'sun', 'moon'] as const).map(
              (name) => (
                <span className="ds-icon" key={name}>
                  <Icon name={name} size={24} />
                  <span className="ds-icon__label">{name}</span>
                </span>
              ),
            )}
          </div>
        </Section>

        <Section title="Colour" description="Semantic tokens. Test any pair with your own eyes in both themes.">
          <Swatches
            items={[
              ['--surface-page', 'page'],
              ['--surface-raised', 'raised'],
              ['--surface-sunken', 'sunken'],
              ['--border-default', 'border'],
              ['--text-primary', 'text'],
              ['--text-secondary', 'text'],
              ['--text-muted', 'text'],
              ['--color-accent', 'accent'],
              ['--color-accent-text', 'accent'],
              ['--color-success', 'status'],
              ['--color-warning', 'status'],
              ['--color-danger', 'status'],
            ]}
          />
        </Section>

        <Section title="Keyboard and focus" description="Tab through this page and watch the ring.">
          <div className="stack-sm">
            <Button variant="secondary">Focus me first</Button>
            <TextField label="Then me" />
            <a className="ds-link" href="#top">
              Then this link
            </a>
          </div>
          <p className="text-sm text-muted">
            Press Shift+Tab from here to reach the skip link at the very top.
          </p>
        </Section>
      </div>
    </>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card title={title} description={description}>
      <div className="ds-section">{children}</div>
    </Card>
  )
}

function Swatches({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="ds-swatches">
      {items.map(([token, kind]) => (
        <div className="ds-swatch" key={token}>
          {/*
            The text colour is set with the same inline custom property
            the chip is painted with, so a text token is previewed in its
            own colour without the CSS needing to know the array order.
          */}
          <span
            className={`ds-swatch__chip ds-swatch__chip--${kind}`}
            style={
              kind === 'text'
                ? { backgroundColor: 'var(--surface-raised)', color: `var(${token})` }
                : { backgroundColor: `var(${token})` }
            }
            aria-hidden="true"
          />
          <dt className="ds-swatch__name">{token.replace(/^--/, '')}</dt>
        </div>
      ))}
    </dl>
  )
}
