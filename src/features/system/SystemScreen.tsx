import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { Icon, type IconName } from '../../components/ui/Icon'

import './SystemScreen.css'

type SystemView = 'today' | 'path' | 'status' | 'you'
type FocusKey = 'body' | 'mind' | 'build' | 'voice' | 'build-goal' | 'build-milestone' | 'build-action' | 'build-action-overdue' | 'build-action-flow'
type Objective = { id: string; label: string; detail: string }
type GraphNode = { id: FocusKey | 'you' | 'body-goal' | 'mind-goal' | 'voice-goal'; label: string; kind: 'you' | 'path' | 'goal' | 'milestone' | 'action'; x: number; y: number; branch: 'body' | 'mind' | 'build' | 'voice' | 'core'; subtitle?: string }

const OBJECTIVES: Objective[] = [
  { id: 'status', label: 'Complete status UI', detail: 'Make the new state visible' },
  { id: 'overdue', label: 'Test overdue state', detail: 'Pressure-test the edge case' },
  { id: 'flow', label: 'Review final flow', detail: 'Walk it once as a user' },
]

const GRAPH_NODES: GraphNode[] = [
  { id: 'you', label: 'YOU', kind: 'you', x: 410, y: 175, branch: 'core' },
  { id: 'mind', label: 'MIND', kind: 'path', x: 410, y: 45, branch: 'mind', subtitle: 'clarity' },
  { id: 'body', label: 'BODY', kind: 'path', x: 155, y: 175, branch: 'body', subtitle: 'capacity' },
  { id: 'voice', label: 'VOICE', kind: 'path', x: 665, y: 175, branch: 'voice', subtitle: 'be heard' },
  { id: 'build', label: 'BUILD', kind: 'path', x: 410, y: 315, branch: 'build', subtitle: 'make real' },
  { id: 'body-goal', label: 'Energy', kind: 'goal', x: 155, y: 300, branch: 'body' },
  { id: 'mind-goal', label: 'Practice', kind: 'goal', x: 570, y: 45, branch: 'mind' },
  { id: 'voice-goal', label: 'Point of view', kind: 'goal', x: 665, y: 300, branch: 'voice' },
  { id: 'build-goal', label: 'Launch PayPilot', kind: 'goal', x: 410, y: 425, branch: 'build' },
  { id: 'build-milestone', label: 'Payments', kind: 'milestone', x: 410, y: 520, branch: 'build' },
  { id: 'build-action', label: 'Status UI', kind: 'action', x: 275, y: 630, branch: 'build', subtitle: 'current action' },
  { id: 'build-action-overdue', label: 'Overdue', kind: 'action', x: 410, y: 640, branch: 'build' },
  { id: 'build-action-flow', label: 'Final flow', kind: 'action', x: 545, y: 630, branch: 'build' },
]

// Presentation coordinates only; node identity, edges, and focus semantics stay shared.
const MOBILE_GRAPH_POSITIONS: Record<GraphNode['id'], [number, number]> = {
  you: [180, 140], mind: [180, 35], body: [42, 140], voice: [318, 140],
  build: [180, 245], 'build-goal': [180, 335], 'build-milestone': [180, 450],
  'build-action': [64, 580], 'build-action-overdue': [180, 600], 'build-action-flow': [296, 580],
  'body-goal': [42, 245], 'mind-goal': [300, 35], 'voice-goal': [318, 245],
}
const mobileGraphQuery = '(max-width: 600px)'
function subscribeMobileGraph(onChange: () => void) {
  const query = window.matchMedia(mobileGraphQuery)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
function isMobileGraph() { return window.matchMedia(mobileGraphQuery).matches }

const GRAPH_EDGES = [
  ['you', 'mind'], ['you', 'body'], ['you', 'voice'], ['you', 'build'],
  ['body', 'body-goal'], ['mind', 'mind-goal'], ['voice', 'voice-goal'],
  ['build', 'build-goal'], ['build-goal', 'build-milestone'], ['build-milestone', 'build-action'], ['build-milestone', 'build-action-overdue'], ['build-milestone', 'build-action-flow'],
] as const
const BRANCHES: Array<{ id: FocusKey; label: string; meta: string }> = [
  { id: 'body', label: 'BODY', meta: 'capacity' }, { id: 'mind', label: 'MIND', meta: 'clarity' }, { id: 'build', label: 'BUILD', meta: 'make real' }, { id: 'voice', label: 'VOICE', meta: 'be heard' },
]

function SystemMark() { return <svg className="system-mark" viewBox="0 0 34 34" aria-hidden="true"><path d="M17 2.5 30 10v14L17 31.5 4 24V10z" /><path d="m11 17 4 4 8-9" /></svg> }
function ArrowIcon() { return <svg viewBox="0 0 20 20" aria-hidden="true" className="system-arrow"><path d="M4 10h11M11 5l5 5-5 5" /></svg> }
function NavIcon({ view }: { view: SystemView }) { const paths: Record<SystemView, string> = { today: 'M4 5h16M4 12h16M4 19h10', path: 'M5 19 10 5l4 9 5-6', status: 'M4 18V6m5 12V10m5 8V4m5 14v-7', you: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0' }; return <svg viewBox="0 0 24 24" aria-hidden="true" className="system-nav__icon"><path d={paths[view]} /></svg> }
function Eyebrow({ children }: { children: string }) { return <p className="system-eyebrow">{children}</p> }

function SystemNav({ view, onView }: { view: SystemView; onView: (next: SystemView) => void }) {
  const items: Array<{ id: SystemView; label: string }> = [{ id: 'today', label: 'Today' }, { id: 'path', label: 'Path' }, { id: 'status', label: 'Status' }, { id: 'you', label: 'You' }]
  return <><aside className="system-sidebar"><a className="system-brand" href="/system" aria-label="ASCEND System home"><SystemMark /><span>ASCEND</span></a><nav aria-label="System sections">{items.map((item) => <button key={item.id} type="button" aria-current={view === item.id ? 'page' : undefined} onClick={() => onView(item.id)}><NavIcon view={item.id} /><span>{item.label}</span></button>)}</nav><div className="system-sidebar__footer"><span className="system-avatar" aria-hidden="true">N</span><div><strong>Lv. 18</strong><small><i /> 82% Stable</small></div></div></aside><nav className="system-bottom-nav" aria-label="System sections">{items.map((item) => <button key={item.id} type="button" aria-current={view === item.id ? 'page' : undefined} onClick={() => onView(item.id)}><NavIcon view={item.id} /><span>{item.label}</span></button>)}</nav></>
}

function ObjectiveList({ objectives, onObjective, compact = false }: { objectives: Record<string, boolean>; onObjective: (id: string) => void; compact?: boolean }) {
  return <div className={`objective-list ${compact ? 'objective-list--compact' : ''}`}>{OBJECTIVES.map((objective) => <label className={`objective ${objectives[objective.id] ? 'is-complete' : ''}`} key={objective.id}><input type="checkbox" checked={Boolean(objectives[objective.id])} onChange={() => onObjective(objective.id)} /><span className="objective__box" aria-hidden="true">{objectives[objective.id] ? '✓' : ''}</span><span><strong>{objective.label}</strong><small>{objective.detail}</small></span></label>)}</div>
}

function TodayView({ objectives, onObjective, onEnterLockIn, onViewPath }: { objectives: Record<string, boolean>; onObjective: (id: string) => void; onEnterLockIn: () => void; onViewPath: () => void }) {
  const completeCount = OBJECTIVES.filter((objective) => objectives[objective.id]).length
  return <div className="system-view system-today"><header className="screen-heading"><div><Eyebrow>MON, OCT 02</Eyebrow><h1>Today</h1><p>A more deliberate pace is built through small, consistent decisions.</p></div><div className="screen-heading__status"><span><i /> STABLE</span><small>DAY 018</small></div></header><section className="directive-panel" aria-labelledby="directive-title"><div className="directive-panel__heading"><Eyebrow>DAILY DIRECTIVE</Eyebrow><span className="sample-chip">SAMPLE</span></div><h2 id="directive-title">Finish the payment workflow.</h2><button type="button" className="directive-path" onClick={onViewPath}><span>BUILD</span><b>→</b><span>PayPilot</span><b>→</b><span>Payments</span><ArrowIcon /></button><div className="directive-panel__body"><div><div className="directive-section-label"><span>OBJECTIVES</span><strong>{completeCount}/{OBJECTIVES.length}</strong></div><ObjectiveList objectives={objectives} onObjective={onObjective} /></div><dl className="directive-meta"><div><dt>EST. FOCUS</dt><dd>60 <small>MIN</small></dd></div><div><dt>TYPE</dt><dd>Deep Work</dd></div><div><dt>IMPACT</dt><dd>High</dd></div></dl></div><div className="directive-panel__actions"><button type="button" className="system-button system-button--primary" onClick={onEnterLockIn}>ENTER LOCK-IN <ArrowIcon /></button><span>A focused hour changes the shape of the day.</span></div></section><section className="other-actions" aria-labelledby="other-actions-title"><div className="section-heading"><Eyebrow>OTHER ACTIONS</Eyebrow><button type="button" className="text-link" onClick={onViewPath}>View Path <ArrowIcon /></button></div><div className="other-actions__grid"><article><span className="action-dot action-dot--teal" /><strong>Workout</strong><small>Body</small></article><article><span className="action-dot action-dot--blue" /><strong>Read 10 pages</strong><small>Learning</small></article><article><span className="action-dot action-dot--amber" /><strong>Plan tomorrow</strong><small>Personal Growth</small></article></div></section></div>
}

function PathView({ focused, onFocus, pulse }: { focused: FocusKey | null; onFocus: (key: FocusKey | null) => void; pulse: boolean }) {
  const mobile = useSyncExternalStore(subscribeMobileGraph, isMobileGraph, () => false)
  const stageRef = useRef<HTMLDivElement>(null)
  const focusBranch = focused && ['body', 'mind', 'build', 'voice'].includes(focused) ? focused : focused?.startsWith('build') ? 'build' : null
  const selectedLabel = focused ? GRAPH_NODES.find((node) => node.id === focused)?.label : undefined
  const nodes = GRAPH_NODES.map((node) => {
    const [x, y] = mobile ? MOBILE_GRAPH_POSITIONS[node.id] : [node.x, node.y]
    return { ...node, x, y }
  })
  useEffect(() => {
    const stage = stageRef.current
    if (!mobile || !stage) return
    // Reveal the selected depth without losing the surrounding Path context.
    // BUILD focus needs the full Goal → Milestone → Action chain above the
    // fixed mobile navigation, so anchor the viewport to the action row.
    const scale = stage.clientWidth / 360
    const y = focused ? MOBILE_GRAPH_POSITIONS[focused][1] : 0
    const buildBottom = (MOBILE_GRAPH_POSITIONS['build-action-overdue'][1] + 48) * scale
    const top = focusBranch === 'build' ? Math.max(0, buildBottom - stage.clientHeight + 16) : Math.max(0, y - 180) * scale
    stage.scrollTo({ top, behavior: 'instant' })
  }, [mobile, focused, focusBranch])
  return <div className="system-view system-path">
    <header className="screen-heading"><div><Eyebrow>YOUR PATH</Eyebrow><h1>A bigger you.</h1><p>Every action connects to something greater.</p></div><div className="path-tools"><button type="button" className="path-search" aria-label="Search graph"><Icon name="search" size={17} /></button><button type="button" onClick={() => onFocus(null)}>Focus</button></div></header>
    <section className="graph-panel" aria-labelledby="graph-title">
      <div className="graph-panel__heading"><div><Eyebrow>ASCEND GRAPH</Eyebrow><h2 id="graph-title">Your system, in motion.</h2></div><span className="graph-key"><i /> ACTIVE <i className="is-muted" /> RESTING</span></div>
      <div ref={stageRef} className={`graph-stage ${focusBranch ? `focus-${focusBranch}` : ''} ${pulse ? 'is-pulsing' : ''}`}>
        <svg className="graph-svg" viewBox={mobile ? '0 0 360 750' : '0 0 820 700'} role="group" aria-labelledby="graph-title graph-description">
          <desc id="graph-description">A semantic graph connecting You to Paths, Goals, Milestones, and Actions. On small screens, scroll to explore deeper nodes.</desc>
          <defs><filter id="system-glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
          <g className="graph-edges">{GRAPH_EDGES.map(([fromId, toId]) => {
            const from = nodes.find((node) => node.id === fromId)
            const to = nodes.find((node) => node.id === toId)
            if (!from || !to) return null
            const branch = to.branch === 'core' ? from.branch : to.branch
            const dimmed = Boolean(focusBranch && branch !== focusBranch && branch !== 'core')
            return <path key={`${fromId}-${toId}`} className={`graph-edge branch-${branch} ${dimmed ? 'is-dimmed' : ''} ${focusBranch === branch ? 'is-focused' : ''} ${pulse && toId === 'build-action' ? 'is-pulse-edge' : ''}`} d={`M ${from.x} ${from.y} C ${from.x} ${(from.y + to.y) / 2}, ${to.x} ${(from.y + to.y) / 2}, ${to.x} ${to.y}`} />
          })}</g>
          <g className="graph-nodes">{nodes.map((node) => {
            const dimmed = Boolean(focusBranch && node.branch !== focusBranch && node.branch !== 'core')
            const active = node.id === focused || (pulse && node.id === 'build-action')
            const interactive = node.id !== 'you'
            const radius = node.kind === 'you' ? 37 : node.kind === 'path' ? 19 : node.kind === 'goal' ? 9 : 7
            return <g key={node.id} className={`graph-node graph-node--${node.kind} branch-${node.branch} ${dimmed ? 'is-dimmed' : ''} ${focusBranch === node.branch ? 'is-focused' : ''} ${active ? 'is-active' : ''}`} transform={`translate(${node.x} ${node.y})`} role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined} aria-label={interactive ? `${node.label}, ${node.kind}. Focus branch` : 'You, the center of the system'} onClick={interactive ? () => onFocus(node.id as FocusKey) : undefined} onKeyDown={interactive ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onFocus(node.id as FocusKey) } } : undefined}>
              <circle className="graph-node__hit" r={Math.max(34, radius + 12)} />
              {(node.kind === 'you' || node.kind === 'path') && <circle className="graph-node__halo" r={radius + 10} />}
              {node.kind === 'milestone' ? <path className="graph-node__core" d="M 0 -12 12 0 0 12 -12 0 Z" /> : <circle className="graph-node__core" r={radius} />}
              {(node.kind === 'path' || node.kind === 'you') && <circle className="graph-node__mark" r="3" />}
              <text className="graph-node__label" y={node.kind === 'you' ? 6 : node.kind === 'path' ? 43 : 31}>{mobile && node.id === 'voice-goal' ? <><tspan x="0">Point of</tspan><tspan x="0" dy="17">view</tspan></> : node.label}</text>
              {node.subtitle && <text className="graph-node__subtitle" y={node.kind === 'path' ? 60 : 48}>{node.subtitle}</text>}
            </g>
          })}</g>
        </svg>
      </div>
      <div className="graph-stage__caption"><span>{selectedLabel ? `FOCUS / ${selectedLabel}` : 'SELECT A NODE TO FOCUS'}</span><span>DEPTH 02.5</span></div>
      <div className="path-branches" aria-label="Path branches">{BRANCHES.map((branch) => <button type="button" key={branch.id} className={`branch-chip branch-chip--${branch.id} ${focusBranch === branch.id ? 'is-active' : ''}`} onClick={() => onFocus(focusBranch === branch.id ? null : branch.id)}><span className="branch-chip__marker" /><strong>{branch.label}</strong><small>{branch.meta}</small><ArrowIcon /></button>)}</div>
    </section>
  </div>
}

function StatusView() {
  const areas = [{ name: 'BUILD', count: '18', detail: '18 completed actions', active: 'Active 7 days' }, { name: 'BODY', count: '11', detail: '11 completed actions', active: 'Active 5 days' }, { name: 'VOICE', count: '08', detail: '8 practices completed', active: 'Active 4 days' }]
  return <div className="system-view system-status"><header className="screen-heading"><div><h1>SYSTEM STATUS</h1><p>A reflection of your real progress.</p></div><div className="screen-heading__status"><span><i /> STABLE</span><small>MON, OCT 02</small></div></header><section className="status-metrics" aria-label="Sample system status values"><article><Eyebrow>LEVEL</Eyebrow><div className="metric-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle className="metric-ring__track" cx="50" cy="50" r="46" /><circle className="metric-ring__progress" cx="50" cy="50" r="46" pathLength="100" strokeDasharray="72 100" /></svg><strong>18</strong><small>LEVEL</small></div><span className="metric-note">SAMPLE / PERMANENT</span></article><article><Eyebrow>RANK</Eyebrow><strong className="metric-rank">C</strong><span className="metric-note">SAMPLE / CURRENT STANDING</span></article><article><Eyebrow>SYSTEM STABILITY</Eyebrow><strong className="metric-percent">82%</strong><svg className="signal-wave" viewBox="0 0 200 35" preserveAspectRatio="none" aria-hidden="true"><path d="M 0 24 18 23 32 14 47 26 64 19 80 23 96 10 113 19 128 16 147 22 163 13 179 20 200 17" /></svg></article><article><Eyebrow>CONDITION</Eyebrow><strong className="metric-condition"><i /> STABLE</strong><span className="metric-note">temporary state</span></article></section><section className="growth-section" aria-labelledby="growth-title"><div className="section-heading"><div><Eyebrow>GROWTH AREAS</Eyebrow><h2 id="growth-title">Real evidence</h2></div><button type="button" className="text-link">View all <ArrowIcon /></button></div><div className="growth-list">{areas.map((area, index) => <article key={area.name}><span className={`growth-marker growth-marker--${index}`} /><div><h3>{area.name}</h3><p>{area.detail}</p></div><div className="growth-bars" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ opacity: .35 + ((i * 17 + index * 13) % 60) / 100 }} />)}</div><small>{area.active}</small><strong>{area.count}</strong></article>)}</div></section><p className="status-disclaimer">◇ Level, Rank, and Stability shown here are sample prototype values. Final progression rules remain unresolved.</p></div>
}

function YouView() { return <div className="system-view system-you"><header className="screen-heading"><div><Eyebrow>IDENTITY</Eyebrow><h1>Build something real.</h1><p>Your direction stays yours. ASCEND simply keeps it visible.</p></div></header><section className="identity-panel"><Eyebrow>CURRENT ORIENTATION</Eyebrow><blockquote>“I want my work to have a place in the world, and I want the courage to keep showing up.”</blockquote><span className="sample-chip">SAMPLE IDENTITY</span></section><section className="configuration-grid"><article><Eyebrow>PATHS</Eyebrow><strong>03</strong><p>active directions</p></article><article><Eyebrow>COMMITMENT</Eyebrow><strong>60 <small>min</small></strong><p>deep focus default</p></article><article><Eyebrow>SYSTEM AGE</Eyebrow><strong>21</strong><p>days awake</p></article></section></div> }

function LockInView({ objectives, onObjective, onExit }: { objectives: Record<string, boolean>; onObjective: (id: string) => void; onExit: () => void }) {
  const completeCount = OBJECTIVES.filter((objective) => objectives[objective.id]).length
  const [exitReason, setExitReason] = useState('emergency')
  const openExitDialog = () => { const dialog = document.getElementById('lockin-exit'); if (dialog instanceof HTMLDialogElement) dialog.showModal() }
  const closeExitDialog = () => { const dialog = document.getElementById('lockin-exit'); if (dialog instanceof HTMLDialogElement) dialog.close() }
  return <main className="system-lockin" aria-labelledby="lockin-title"><header className="lockin-header"><span className="lockin-header__brand"><SystemMark /> ASCEND / LOCK-IN</span><span className="lockin-header__status"><i /> ACTIVE</span><button type="button" className="lockin-exit-link" onClick={openExitDialog}>EXIT (HOLD)</button></header><div className="lockin-layout"><div className="lockin-timer" aria-label="42 minutes and 16 seconds remaining"><svg className="lockin-timer__ring" viewBox="0 0 320 320" aria-hidden="true"><circle className="lockin-timer__track" cx="160" cy="160" r="156" /><circle className="lockin-timer__progress" cx="160" cy="160" r="156" pathLength="100" strokeDasharray={`${((60 * 60 - (42 * 60 + 16)) / (60 * 60)) * 100} 100`} /></svg><span>FOCUS TIME</span><strong>42:16</strong><small>/ 60 MIN</small></div><section className="lockin-mission"><Eyebrow>MISSION</Eyebrow><h1 id="lockin-title">Finish the payment workflow.</h1><p className="lockin-path">BUILD <span>→</span> PayPilot <span>→</span> Payments</p><div className="lockin-objectives"><div className="lockin-objectives__heading"><Eyebrow>OBJECTIVES</Eyebrow><strong>{completeCount}/{OBJECTIVES.length}</strong></div><ObjectiveList objectives={objectives} onObjective={onObjective} compact /></div></section><section className="lockin-sealed"><Eyebrow>DISTRACTIONS SEALED</Eyebrow><div>{([{ name: 'Instagram', icon: 'today' }, { name: 'Facebook', icon: 'you' }, { name: 'YouTube', icon: 'system' }, { name: 'TikTok', icon: 'journey' }, { name: 'Games', icon: 'plus' }] satisfies Array<{ name: string; icon: IconName }>).map((app) => <span className="sealed-app" key={app.name}><Icon name={app.icon} size={18} />{app.name}</span>)}</div><small>“Discipline is freedom in progress.”</small></section><button type="button" className="system-button lockin-mobile-exit" onClick={openExitDialog}>HOLD TO EXIT</button></div><dialog className="lockin-exit-dialog" id="lockin-exit"><div><Eyebrow>END SESSION</Eyebrow><h2>Leave Lock-In?</h2><p>Emergency and legitimate exits are always allowed. Choose a reason.</p><label htmlFor="exit-reason">Reason</label><select id="exit-reason" value={exitReason} onChange={(event) => setExitReason(event.target.value)}><option value="emergency">Emergency</option><option value="legitimate">Legitimate interruption</option><option value="finished">Mission complete</option></select><div className="lockin-exit-dialog__actions"><button type="button" className="system-button system-button--quiet" onClick={closeExitDialog}>Stay</button><button type="button" className="system-button system-button--primary" onClick={onExit}>End session <ArrowIcon /></button></div></div></dialog></main>
}

export function SystemScreen() {
  const [awakened, setAwakened] = useState(false)
  const [view, setView] = useState<SystemView>('today')
  const [focused, setFocused] = useState<FocusKey | null>(null)
  const [lockIn, setLockIn] = useState(false)
  const [pulse, setPulse] = useState(false)
  const [objectives, setObjectives] = useState<Record<string, boolean>>({})
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [view, lockIn])
  useEffect(() => { if (!pulse) return; const timeout = window.setTimeout(() => setPulse(false), 1200); return () => window.clearTimeout(timeout) }, [pulse])
  const completeObjective = (id: string) => { setObjectives((current) => ({ ...current, [id]: !current[id] })); if (!objectives[id]) { setPulse(true); setView('path'); setFocused('build-action') } }
  if (!awakened) return <div className="system-app system-awakening"><div className="awakening-content"><SystemMark /><Eyebrow>ASCEND / SYSTEM PROTOTYPE ALPHA</Eyebrow><h1>Become <em>visible</em> to yourself.</h1><p>Turn intention into real-world movement. Follow the signal upward.</p><button type="button" className="system-button system-button--primary" onClick={() => setAwakened(true)}>Enter the System <ArrowIcon /></button><small>Sample environment / no data will be saved</small></div></div>
  if (lockIn) return <LockInView objectives={objectives} onObjective={completeObjective} onExit={() => { const dialog = document.getElementById('lockin-exit'); if (dialog instanceof HTMLDialogElement) dialog.close(); setLockIn(false); setView('today') }} />
  return <div className="system-app"><SystemNav view={view} onView={(next) => { setView(next); setFocused(null) }} /><main className="system-main" data-system-view={view}><div className="system-main__topline"><span>ASCEND</span></div>{view === 'today' && <TodayView objectives={objectives} onObjective={completeObjective} onEnterLockIn={() => setLockIn(true)} onViewPath={() => setView('path')} />}{view === 'path' && <PathView focused={focused} onFocus={setFocused} pulse={pulse} />}{view === 'status' && <StatusView />}{view === 'you' && <YouView />}</main></div>
}
