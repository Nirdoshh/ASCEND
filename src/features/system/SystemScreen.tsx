import { useEffect, useState } from 'react'

import './SystemScreen.css'

type SystemView = 'today' | 'path' | 'status' | 'you'
type FocusKey = 'body' | 'build' | 'voice' | 'build-goal' | 'build-milestone' | 'build-action'

type Objective = {
  id: string
  label: string
  detail: string
}

type GraphNode = {
  id: FocusKey | 'you' | 'body-goal' | 'voice-goal'
  label: string
  kind: 'you' | 'path' | 'goal' | 'milestone' | 'action'
  x: number
  y: number
  branch: 'body' | 'build' | 'voice' | 'core'
  subtitle?: string
}

const OBJECTIVES: Objective[] = [
  { id: 'status', label: 'Complete status UI', detail: 'Make the new state visible' },
  { id: 'overdue', label: 'Test overdue state', detail: 'Pressure-test the edge case' },
  { id: 'flow', label: 'Review final flow', detail: 'Walk it once as a user' },
]

const GRAPH_NODES: GraphNode[] = [
  { id: 'you', label: 'YOU', kind: 'you', x: 500, y: 445, branch: 'core', subtitle: 'the source' },
  { id: 'body', label: 'BODY', kind: 'path', x: 200, y: 320, branch: 'body', subtitle: 'capacity' },
  { id: 'build', label: 'BUILD', kind: 'path', x: 500, y: 320, branch: 'build', subtitle: 'make real' },
  { id: 'voice', label: 'VOICE', kind: 'path', x: 800, y: 320, branch: 'voice', subtitle: 'be heard' },
  { id: 'body-goal', label: 'Energy baseline', kind: 'goal', x: 200, y: 225, branch: 'body' },
  { id: 'build-goal', label: 'Launch product', kind: 'goal', x: 500, y: 225, branch: 'build' },
  { id: 'voice-goal', label: 'Clear point of view', kind: 'goal', x: 800, y: 225, branch: 'voice' },
  { id: 'build-milestone', label: 'Payments ready', kind: 'milestone', x: 500, y: 145, branch: 'build' },
  { id: 'build-action', label: 'Finish workflow', kind: 'action', x: 500, y: 70, branch: 'build', subtitle: 'current action' },
]

const GRAPH_EDGES = [
  ['you', 'body'],
  ['you', 'build'],
  ['you', 'voice'],
  ['body', 'body-goal'],
  ['build', 'build-goal'],
  ['voice', 'voice-goal'],
  ['build-goal', 'build-milestone'],
  ['build-milestone', 'build-action'],
] as const

const BRANCHES: Array<{ id: FocusKey; label: string; meta: string }> = [
  { id: 'body', label: 'BODY', meta: 'capacity' },
  { id: 'build', label: 'BUILD', meta: 'make real' },
  { id: 'voice', label: 'VOICE', meta: 'be heard' },
]

function SystemMark() {
  return (
    <svg className="system-mark" viewBox="0 0 34 34" aria-hidden="true">
      <path d="M17 2.5 30 10v14L17 31.5 4 24V10z" />
      <path d="m11 17 4 4 8-9" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="system-arrow">
      <path d="M4 10h11M11 5l5 5-5 5" />
    </svg>
  )
}

function SystemHeader({ view, onView }: { view: SystemView; onView: (next: SystemView) => void }) {
  return (
    <header className="system-header">
      <a className="system-brand" href="/system" aria-label="ASCEND System home">
        <SystemMark />
        <span>
          <strong>ASCEND</strong>
          <small>SYSTEM / ALPHA</small>
        </span>
      </a>
      <nav className="system-nav" aria-label="System sections">
        {(['today', 'path', 'status', 'you'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={view === item ? 'is-active' : undefined}
            aria-current={view === item ? 'page' : undefined}
            onClick={() => onView(item)}
          >
            <span className="system-nav__index">0{(['today', 'path', 'status', 'you'] as const).indexOf(item) + 1}</span>
            {item}
          </button>
        ))}
      </nav>
      <span className="system-header__signal" aria-label="System signal stable">
        <i aria-hidden="true" />
        SIGNAL STABLE
      </span>
    </header>
  )
}

function Eyebrow({ children }: { children: string }) {
  return <p className="system-eyebrow">{children}</p>
}

function TodayView({
  objectives,
  onObjective,
  onEnterLockIn,
  onViewPath,
}: {
  objectives: Record<string, boolean>
  onObjective: (id: string) => void
  onEnterLockIn: () => void
  onViewPath: () => void
}) {
  const completeCount = OBJECTIVES.filter((objective) => objectives[objective.id]).length
  return (
    <div className="system-view system-today">
      <div className="system-view__intro system-reveal">
        <Eyebrow>THURSDAY / 02 OCTOBER 2026</Eyebrow>
        <h1>What matters <em>right now?</em></h1>
        <p className="system-lede">One deliberate move. A visible consequence.</p>
      </div>

      <section className="directive-card system-reveal system-reveal--delay" aria-labelledby="directive-title">
        <div className="directive-card__rail" aria-hidden="true"><span /></div>
        <div className="directive-card__content">
          <div className="directive-card__topline">
            <Eyebrow>DAILY DIRECTIVE / 01</Eyebrow>
            <span className="sample-chip">SAMPLE DIRECTIVE</span>
          </div>
          <h2 id="directive-title">Finish the payment workflow</h2>
          <button type="button" className="directive-path" onClick={onViewPath}>
            <span className="directive-path__glyph" aria-hidden="true">↗</span>
            <span><small>PATH</small> BUILD <b>→</b> Launch Product <b>→</b> Payments</span>
            <ArrowIcon />
          </button>
          <div className="directive-card__body">
            <div>
              <div className="directive-section-label"><span>OBJECTIVES</span><strong>{completeCount}/{OBJECTIVES.length}</strong></div>
              <div className="objective-list">
                {OBJECTIVES.map((objective) => (
                  <label className={`objective ${objectives[objective.id] ? 'is-complete' : ''}`} key={objective.id}>
                    <input type="checkbox" checked={Boolean(objectives[objective.id])} onChange={() => onObjective(objective.id)} />
                    <span className="objective__box" aria-hidden="true">{objectives[objective.id] ? '✓' : ''}</span>
                    <span><strong>{objective.label}</strong><small>{objective.detail}</small></span>
                  </label>
                ))}
              </div>
            </div>
            <aside className="directive-card__aside">
              <span className="directive-card__aside-label">EST. FOCUS</span>
              <strong>60 <small>MIN</small></strong>
              <span className="directive-card__aside-rule" aria-hidden="true" />
              <span className="directive-card__aside-label">SYSTEM NOTE</span>
              <p>Momentum is waiting on one clear finish.</p>
            </aside>
          </div>
          <div className="directive-card__action-row">
            <button type="button" className="system-button system-button--primary" onClick={onEnterLockIn}>
              <span className="button-orbit" aria-hidden="true" /> ENTER LOCK-IN <ArrowIcon />
            </button>
            <span className="directive-card__commitment">A focused hour changes the shape of the day.</span>
          </div>
        </div>
      </section>

      <div className="today-lower-grid system-reveal system-reveal--delay-2">
        <section className="signal-card" aria-labelledby="secondary-title">
          <div className="signal-card__heading"><Eyebrow>SECONDARY SIGNALS</Eyebrow><span>03 AVAILABLE</span></div>
          <h2 id="secondary-title">Keep the field moving.</h2>
          <ul>
            <li><span>01</span><strong>Send launch note</strong><small>BUILD / 10 min</small></li>
            <li><span>02</span><strong>Walk before lunch</strong><small>BODY / 20 min</small></li>
            <li><span>03</span><strong>Read one clear voice</strong><small>VOICE / 15 min</small></li>
          </ul>
        </section>
        <section className="continuity-card" aria-labelledby="continuity-title">
          <Eyebrow>CONTINUITY</Eyebrow>
          <h2 id="continuity-title">Your system is <em>awake.</em></h2>
          <p>Three branches are active. The next meaningful action is already connected.</p>
          <button type="button" className="text-link" onClick={onViewPath}>See the Path <ArrowIcon /></button>
        </section>
      </div>
    </div>
  )
}

function PathView({ focused, onFocus, pulse }: { focused: FocusKey | null; onFocus: (key: FocusKey | null) => void; pulse: boolean }) {
  const focusBranch = focused && ['body', 'build', 'voice'].includes(focused) ? focused : focused?.startsWith('build') ? 'build' : null
  const selectedLabel = focused ? GRAPH_NODES.find((node) => node.id === focused)?.label : undefined
  return (
    <div className="system-view system-path">
      <div className="system-view__intro system-reveal">
        <Eyebrow>PATH / SEMANTIC MAP</Eyebrow>
        <div className="path-heading-row">
          <div><h1>Where am I <em>going?</em></h1><p className="system-lede">A living map of the person behind the action.</p></div>
          {focused && <button type="button" className="system-button system-button--quiet" onClick={() => onFocus(null)}>Clear focus <span aria-hidden="true">×</span></button>}
        </div>
      </div>
      <section className="graph-shell system-reveal system-reveal--delay" aria-labelledby="graph-title">
        <div className="graph-shell__topline"><div><Eyebrow>ASCEND GRAPH / LIVE BRANCH</Eyebrow><h2 id="graph-title">The shape of your becoming.</h2></div><span className="graph-shell__legend"><i className="legend-dot legend-dot--active" />ACTIVE <i className="legend-dot legend-dot--quiet" />DORMANT</span></div>
        <div className={`graph-stage ${focusBranch ? `focus-${focusBranch}` : ''} ${pulse ? 'is-pulsing' : ''}`}>
          <div className="graph-stage__grid" aria-hidden="true" />
          <svg className="graph-svg" viewBox="0 0 1000 500" role="img" aria-labelledby="graph-title graph-description">
            <desc id="graph-description">A semantic graph connecting You to three Paths, then Goals, Milestones, and the current Action.</desc>
            <defs>
              <linearGradient id="system-line" x1="0" x2="1"><stop stopColor="#8179ff" stopOpacity=".18" /><stop offset=".5" stopColor="#a89cff" stopOpacity=".88" /><stop offset="1" stopColor="#8179ff" stopOpacity=".18" /></linearGradient>
              <filter id="system-glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <g className="graph-edges">
              {GRAPH_EDGES.map(([fromId, toId]) => {
                const from = GRAPH_NODES.find((node) => node.id === fromId)
                const to = GRAPH_NODES.find((node) => node.id === toId)
                if (!from || !to) return null
                const branch = to.branch === 'core' ? from.branch : to.branch
                const dimmed = Boolean(focusBranch && branch !== focusBranch && branch !== 'core')
                const pulseEdge = pulse && toId === 'build-action'
                return <path key={`${fromId}-${toId}`} className={`graph-edge ${dimmed ? 'is-dimmed' : ''} ${pulseEdge ? 'is-pulse-edge' : ''}`} d={`M ${from.x} ${from.y} C ${from.x} ${(from.y + to.y) / 2}, ${to.x} ${(from.y + to.y) / 2}, ${to.x} ${to.y}`} />
              })}
            </g>
            <g className="graph-nodes">
              {GRAPH_NODES.map((node) => {
                const dimmed = Boolean(focusBranch && node.branch !== focusBranch && node.branch !== 'core')
                const active = node.id === focused || (node.id === 'build-action' && pulse)
                const interactive = node.id !== 'you'
                return (
                  <g
                    key={node.id}
                    className={`graph-node graph-node--${node.kind} ${dimmed ? 'is-dimmed' : ''} ${active ? 'is-active' : ''}`}
                    transform={`translate(${node.x} ${node.y})`}
                    role={interactive ? 'button' : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    aria-label={interactive ? `${node.label}, ${node.kind}. Focus branch` : 'You, the center of the system'}
                    onClick={interactive ? () => onFocus(node.id as FocusKey) : undefined}
                    onKeyDown={interactive ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onFocus(node.id as FocusKey) } } : undefined}
                  >
                    <circle className="graph-node__halo" r={node.kind === 'path' ? 35 : node.kind === 'you' ? 43 : 27} />
                    <circle className="graph-node__core" r={node.kind === 'path' ? 22 : node.kind === 'you' ? 29 : 16} />
                    <circle className="graph-node__mark" r="3" />
                    <text className="graph-node__label" y={node.kind === 'you' ? 54 : 48}>{node.label}</text>
                    {node.subtitle && <text className="graph-node__subtitle" y={node.kind === 'you' ? 68 : 62}>{node.subtitle}</text>}
                  </g>
                )
              })}
            </g>
          </svg>
          <div className="graph-stage__caption"><span>{selectedLabel ? `FOCUS / ${selectedLabel}` : 'SELECT A NODE TO FOCUS THE SYSTEM'}</span><span>DEPTH 02.5</span></div>
        </div>
        <div className="path-branches" aria-label="Path branches">
          {BRANCHES.map((branch) => <button type="button" key={branch.id} className={`branch-chip ${focusBranch === branch.id ? 'is-active' : ''}`} onClick={() => onFocus(focusBranch === branch.id ? null : branch.id)}><span className="branch-chip__marker" /><strong>{branch.label}</strong><small>{branch.meta}</small><ArrowIcon /></button>)}
        </div>
      </section>
      <p className="path-footnote"><span aria-hidden="true">⌁</span> Complete an action to send its signal upward through the branch.</p>
    </div>
  )
}

function StatusView() {
  return (
    <div className="system-view system-status">
      <div className="system-view__intro system-reveal"><Eyebrow>SYSTEM / READOUT</Eyebrow><div className="status-heading-row"><div><h1>What is happening <em>to me?</em></h1><p className="system-lede">A calm read on your current state, grounded in what you have done.</p></div><span className="sample-chip sample-chip--large">SAMPLE VALUES</span></div></div>
      <section className="status-overview system-reveal system-reveal--delay" aria-labelledby="status-heading">
        <div className="status-overview__main"><Eyebrow>ASCEND STATUS / 02 OCT 2026</Eyebrow><div className="status-level"><span>LEVEL</span><strong id="status-heading">18</strong><small>PERMANENT PROGRESSION</small></div><div className="status-rank"><span>RANK</span><strong>C</strong><small>CURRENT STANDING</small></div></div>
        <div className="stability-meter"><div className="stability-meter__top"><span>SYSTEM STABILITY</span><strong>82%</strong></div><div className="stability-meter__track"><span /></div><div className="stability-meter__bottom"><span className="condition-dot" /> CONDITION <strong>STABLE</strong><small>temporary state</small></div></div>
      </section>
      <section className="evidence-section system-reveal system-reveal--delay-2" aria-labelledby="evidence-title"><div className="evidence-section__heading"><div><Eyebrow>REAL EVIDENCE / RETAINED SIGNAL</Eyebrow><h2 id="evidence-title">Actions leave a trace.</h2></div><span>LAST 30 DAYS</span></div><div className="evidence-grid"><article><span className="evidence-index">01</span><div><h3>BUILD</h3><p>18 actions completed</p><small>Active 7 days</small></div><strong>18</strong></article><article><span className="evidence-index">02</span><div><h3>BODY</h3><p>11 actions completed</p><small>Active 5 days</small></div><strong>11</strong></article><article><span className="evidence-index">03</span><div><h3>VOICE</h3><p>8 practices completed</p><small>Active 4 days</small></div><strong>08</strong></article></div></section>
      <p className="status-disclaimer"><span aria-hidden="true">◇</span> Level, Rank, and Stability shown here are sample prototype values. Final progression rules are intentionally unresolved.</p>
    </div>
  )
}

function YouView() {
  return <div className="system-view system-you"><div className="system-view__intro system-reveal"><Eyebrow>YOU / SYSTEM CONFIGURATION</Eyebrow><h1>Who am I <em>becoming?</em></h1><p className="system-lede">The system follows your direction. It never decides your identity for you.</p></div><section className="identity-card system-reveal system-reveal--delay"><div className="identity-card__seal"><SystemMark /><span>IDENTITY<br />SEED</span></div><div><Eyebrow>CURRENT ORIENTATION</Eyebrow><h2>Build something <em>real.</em></h2><p>“I want my work to have a place in the world, and I want the courage to keep showing up.”</p><span className="sample-chip">SAMPLE IDENTITY</span></div></section><section className="configuration-grid system-reveal system-reveal--delay-2"><article><Eyebrow>PATHS</Eyebrow><strong>03</strong><p>active directions</p></article><article><Eyebrow>COMMITMENT</Eyebrow><strong>60 <small>min</small></strong><p>deep focus default</p></article><article><Eyebrow>SYSTEM AGE</Eyebrow><strong>21</strong><p>days awake</p></article></section></div>
}

function LockInView({ objectives, onObjective, onExit }: { objectives: Record<string, boolean>; onObjective: (id: string) => void; onExit: () => void }) {
  const completeCount = OBJECTIVES.filter((objective) => objectives[objective.id]).length
  const [exitReason, setExitReason] = useState('emergency')
  const openExitDialog = () => {
    const dialog = document.getElementById('lockin-exit')
    if (dialog instanceof HTMLDialogElement) dialog.showModal()
  }
  const closeExitDialog = () => {
    const dialog = document.getElementById('lockin-exit')
    if (dialog instanceof HTMLDialogElement) dialog.close()
  }
  return <main className="system-lockin" aria-labelledby="lockin-title"><div className="lockin-backdrop" aria-hidden="true" /><header className="lockin-header"><span className="lockin-header__brand"><SystemMark /> ASCEND / LOCK-IN</span><span className="lockin-header__status"><i /> SESSION SEALED</span></header><div className="lockin-content"><Eyebrow>DEEP LOCK / PRIMARY MISSION</Eyebrow><h1 id="lockin-title">Finish the payment workflow.</h1><p className="lockin-path">BUILD <span>→</span> LAUNCH PRODUCT <span>→</span> PAYMENTS</p><div className="lockin-timer" aria-label="54 minutes and 32 seconds remaining"><span>REMAINING FOCUS</span><strong>54:32</strong><small>MINIMUM FOCUS / 60 MIN</small></div><section className="lockin-objectives" aria-labelledby="lockin-objectives-title"><div><Eyebrow>OBJECTIVES</Eyebrow><h2 id="lockin-objectives-title">Keep the thread.</h2></div><strong className="lockin-objectives__count">{completeCount}/{OBJECTIVES.length}</strong>{OBJECTIVES.map((objective) => <label className={`objective objective--lockin ${objectives[objective.id] ? 'is-complete' : ''}`} key={objective.id}><input type="checkbox" checked={Boolean(objectives[objective.id])} onChange={() => onObjective(objective.id)} /><span className="objective__box" aria-hidden="true">{objectives[objective.id] ? '✓' : ''}</span><span><strong>{objective.label}</strong><small>{objective.detail}</small></span></label>)}</section><div className="lockin-sealed"><Eyebrow>SEALED DISTRACTIONS</Eyebrow><span>Instagram</span><span>Facebook</span><span>Games</span><span>YouTube Shorts</span></div><button type="button" className="lockin-emergency" onClick={openExitDialog}>Emergency exit <small>Always available</small></button></div><dialog className="lockin-exit-dialog" id="lockin-exit"><div><Eyebrow>END SESSION</Eyebrow><h2>Leave Lock-In?</h2><p>Emergency and legitimate exits are always allowed. Choose a reason so the system can learn context later.</p><label htmlFor="exit-reason">Reason</label><select id="exit-reason" value={exitReason} onChange={(event) => setExitReason(event.target.value)}><option value="emergency">Emergency</option><option value="legitimate">Legitimate interruption</option><option value="finished">Mission complete</option></select><div className="lockin-exit-dialog__actions"><button type="button" className="system-button system-button--quiet" onClick={closeExitDialog}>Stay in Lock-In</button><button type="button" className="system-button system-button--primary" onClick={onExit}>End session <ArrowIcon /></button></div></div></dialog></main>
}

export function SystemScreen() {
  const [awakened, setAwakened] = useState(false)
  const [view, setView] = useState<SystemView>('today')
  const [focused, setFocused] = useState<FocusKey | null>(null)
  const [lockIn, setLockIn] = useState(false)
  const [pulse, setPulse] = useState(false)
  const [objectives, setObjectives] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!pulse) return
    const timeout = window.setTimeout(() => setPulse(false), 1200)
    return () => window.clearTimeout(timeout)
  }, [pulse])

  const completeObjective = (id: string) => {
    setObjectives((current) => ({ ...current, [id]: !current[id] }))
    if (!objectives[id]) {
      setPulse(true)
      setView('path')
      setFocused('build-action')
    }
  }

  if (!awakened) {
    return <div className="system-app system-awakening"><div className="awakening-noise" aria-hidden="true" /><div className="awakening-orbit" aria-hidden="true"><span /><span /><span /></div><div className="awakening-content"><span className="awakening-code">ASCEND / SYSTEM PROTOTYPE ALPHA</span><SystemMark /><p className="awakening-kicker">A PERSONAL OPERATING SYSTEM</p><h1>Become <em>visible</em> to yourself.</h1><p>Turn intention into real-world movement. Follow the signal upward.</p><button type="button" className="system-button system-button--primary system-button--awakening" onClick={() => setAwakened(true)}>Enter the System <ArrowIcon /></button><small>Sample environment / no data will be saved</small></div><div className="awakening-footer"><span>SYS.001</span><span>ORIGINAL ASCEND EXPERIENCE</span><span>READY</span></div></div>
  }

  if (lockIn) return <LockInView objectives={objectives} onObjective={completeObjective} onExit={() => { const dialog = document.getElementById('lockin-exit'); if (dialog instanceof HTMLDialogElement) dialog.close(); setLockIn(false); setView('today') }} />

  return <div className="system-app"><div className="system-atmosphere" aria-hidden="true" /><SystemHeader view={view} onView={(next) => { setView(next); setFocused(null) }} /><main className="system-main"><div className="system-main__marker" aria-hidden="true"><span /> ASCEND SYSTEM / ALPHA</div>{view === 'today' && <TodayView objectives={objectives} onObjective={completeObjective} onEnterLockIn={() => setLockIn(true)} onViewPath={() => setView('path')} />}{view === 'path' && <PathView focused={focused} onFocus={setFocused} pulse={pulse} />}{view === 'status' && <StatusView />}{view === 'you' && <YouView />}</main><footer className="system-footer"><span>ASCEND / PERSONAL PROGRESSION SYSTEM</span><span>PROTOTYPE ALPHA <i aria-hidden="true" /></span></footer></div>
}
