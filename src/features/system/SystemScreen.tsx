import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { Icon, type IconName } from '../../components/ui/Icon'
import { createSystemApplicationService } from '../../application/systemPaths'
import { createSystemRoadmapService } from '../../application/systemRoadmaps'
import { createSystemDirectiveService } from '../../application/systemDirectives'
import { defaultSystemRepository } from '../../data/repositories/defaults'
import type { SystemRepository } from '../../data/repositories/systemRepository'
import { createSystemData, type SystemData } from '../../domain/systemPathGoal'
import { localDateKey, type DirectiveCandidate, type SystemDailyDirective, type SystemDirectiveObjective } from '../../domain/systemDailyDirective'
import { systemStatus } from '../../domain/systemStatus'
import { SystemPathView } from './SystemPathView'

import './SystemScreen.css'

/* Keep the approved System composition; native browser prompts remain bounded edit controls. */
/* eslint-disable react/no-unescaped-entities, jsx-a11y/no-autofocus */

type SystemView = 'today' | 'path' | 'status' | 'you'
function SystemMark() { return <svg className="system-mark" viewBox="0 0 34 34" aria-hidden="true"><path d="M17 2.5 30 10v14L17 31.5 4 24V10z" /><path d="m11 17 4 4 8-9" /></svg> }
function ArrowIcon() { return <svg viewBox="0 0 20 20" aria-hidden="true" className="system-arrow"><path d="M4 10h11M11 5l5 5-5 5" /></svg> }
function NavIcon({ view }: { view: SystemView }) { const paths: Record<SystemView, string> = { today: 'M4 5h16M4 12h16M4 19h10', path: 'M5 19 10 5l4 9 5-6', status: 'M4 18V6m5 12V10m5 8V4m5 14v-7', you: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0' }; return <svg viewBox="0 0 24 24" aria-hidden="true" className="system-nav__icon"><path d={paths[view]} /></svg> }
function Eyebrow({ children }: { children: string }) { return <p className="system-eyebrow">{children}</p> }

function SystemNav({ view, onView }: { view: SystemView; onView: (next: SystemView) => void }) {
  const items: Array<{ id: SystemView; label: string }> = [{ id: 'today', label: 'Today' }, { id: 'path', label: 'Path' }, { id: 'status', label: 'Status' }, { id: 'you', label: 'You' }]
  return <><aside className="system-sidebar"><a className="system-brand" href="/" aria-label="ASCEND System home"><SystemMark /><span>ASCEND</span></a><nav aria-label="System sections">{items.map((item) => <button key={item.id} type="button" aria-current={view === item.id ? 'page' : undefined} onClick={() => onView(item.id)}><NavIcon view={item.id} /><span>{item.label}</span></button>)}</nav><div className="system-sidebar__footer"><span className="system-avatar" aria-hidden="true"><SystemMark /></span><div><strong>LOCAL SYSTEM</strong><small>Saved on this device</small></div></div></aside><nav className="system-bottom-nav" aria-label="System sections">{items.map((item) => <button key={item.id} type="button" aria-current={view === item.id ? 'page' : undefined} onClick={() => onView(item.id)}><NavIcon view={item.id} /><span>{item.label}</span></button>)}</nav></>
}

function DirectiveObjectives({ objectives, onToggle, onEdit = () => undefined, onMove = () => undefined, onRemove, disabled = false }: { disabled?: boolean; objectives: readonly SystemDirectiveObjective[]; onToggle: (id: string) => void; onEdit?: (id: string, title: string) => void; onMove?: (id: string, direction: -1 | 1) => void; onRemove: (id: string) => void }) {
  return <div className="objective-list">{objectives.map((objective, index) => <div className={`objective ${objective.completedAt ? 'is-complete' : ''}`} key={objective.id}><label><input type="checkbox" disabled={disabled} checked={Boolean(objective.completedAt)} onChange={() => onToggle(objective.id)} /><span className="objective__box" aria-hidden="true">{objective.completedAt ? '✓' : ''}</span><span><strong>{objective.title}</strong></span></label><span className="objective-actions"><button type="button" className="text-link" disabled={disabled} onClick={() => { const title = window.prompt('Edit objective', objective.title); if (title?.trim()) onEdit(objective.id, title) }}>Edit</button><button type="button" className="text-link" disabled={disabled || index === 0} onClick={() => onMove(objective.id, -1)} aria-label={`Move ${objective.title} up`}>↑</button><button type="button" className="text-link" disabled={disabled || index === objectives.length - 1} onClick={() => onMove(objective.id, 1)} aria-label={`Move ${objective.title} down`}>↓</button><button type="button" className="text-link objective-remove" disabled={disabled} onClick={() => onRemove(objective.id)} aria-label={`Remove ${objective.title}`}>Remove</button></span></div>)}</div>
}

function TodayDirectiveView({ data, service, onData, onEnterLockIn, onViewPath }: { data: SystemData; service: ReturnType<typeof createSystemDirectiveService>; onData: (data: SystemData) => void; onEnterLockIn: (directive: SystemDailyDirective, objectives: readonly SystemDirectiveObjective[]) => void; onViewPath: (candidate?: DirectiveCandidate) => void }) {
  const dateKey = localDateKey()
  const [refresh, setRefresh] = useState(0)
  const [manualOpen, setManualOpen] = useState(false)
  const [chooserOpen, setChooserOpen] = useState(false)
  const [objectiveTitle, setObjectiveTitle] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const hasDraft = manualOpen || objectiveTitle.trim() !== ''
  useEffect(() => {
    if (!hasDraft) return
    const protectDraft = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protectDraft)
    return () => window.removeEventListener('beforeunload', protectDraft)
  }, [hasDraft])
  const current = service.current(dateKey)
  const candidates = service.candidates()
  const directive = current.directive
  const source = directive?.sourceRoadmapStepId ? (() => { const step = data.roadmapSteps.find(entry => entry.id === directive.sourceRoadmapStepId); const phase = step && data.roadmapPhases.find(entry => entry.id === step.phaseId); const roadmap = step && data.roadmaps.find(entry => entry.id === step.roadmapId); const goal = roadmap && data.goals.find(entry => entry.id === roadmap.goalId); const path = goal && data.paths.find(entry => entry.id === goal.pathId); return step && phase && roadmap && goal && path ? { step, phase, roadmap, goal, path, selected: roadmap.activeStepId === step.id } : candidates.find(candidate => candidate.step.id === directive.sourceRoadmapStepId) })() : undefined
  const apply = (result: ReturnType<typeof service.accept>) => { if (result.ok) { onData(result.data); setMessage(null); setRefresh(value => value + 1); return true } else { setMessage(result.message); return false } }
  const now = () => new Date().toISOString()
  const accept = (candidate: DirectiveCandidate) => apply(service.accept(candidate, { dateKey, now: now() }))
  const submitManual = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const fields = new FormData(event.currentTarget); if (apply(service.manual({ dateKey, title: String(fields.get('title') ?? ''), why: String(fields.get('why') ?? ''), now: now() }))) setManualOpen(false) }
  const addObjective = () => { if (!directive || !objectiveTitle.trim()) return; if (apply(service.objectiveAdd(directive.id, objectiveTitle, now()))) setObjectiveTitle('') }
  const complete = () => { if (!directive) return; apply(service.complete(directive.id, now())) }
  const completedCount = current.objectives.filter(objective => objective.completedAt).length
  const formatted = new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: '2-digit' }).toUpperCase()
  if (!directive) return <div className="system-view system-today"><header className="screen-heading"><div><Eyebrow>{formatted}</Eyebrow><h1>Today</h1><p>Choose what deserves your attention today.</p></div></header><section className="directive-panel directive-panel--empty"><div className="directive-panel__heading"><Eyebrow>DAILY DIRECTIVE</Eyebrow></div><h2>NO DIRECTIVE YET</h2><p className="directive-empty-copy">{candidates.length === 0 ? 'Create a Roadmap Step or set a manual focus to begin.' : 'Review a suggested Roadmap Step before it becomes today\'s focus.'}</p>{candidates.length > 0 && <div className="directive-candidates">{candidates.length > 1 && <p className="directive-section-label">CHOOSE TODAY'S FOCUS</p>}{(chooserOpen || candidates.length === 1) && candidates.map(candidate => <button type="button" className="directive-candidate" key={candidate.step.id} onClick={() => accept(candidate)}><span>{candidate.path.name}</span><strong>{candidate.step.title}</strong><small>{candidate.goal.title} · {candidate.roadmap.title}</small></button>)}{candidates.length > 1 && !chooserOpen && <button type="button" className="system-button system-button--primary" onClick={() => setChooserOpen(true)}>CHOOSE FOCUS <ArrowIcon /></button>}</div>}<div className="directive-panel__actions"><button type="button" className="system-button" disabled={manualOpen} onClick={() => setManualOpen(true)}>CREATE MANUAL DIRECTIVE</button></div>{manualOpen && <form className="goal-form" onSubmit={submitManual}><label>Title<input name="title" required maxLength={500} autoFocus /></label><label>Why<textarea name="why" maxLength={500} /></label><button type="submit" className="system-button system-button--primary">Accept Directive</button><button type="button" className="system-button" onClick={() => setManualOpen(false)}>Cancel</button></form>}{message && <p className="system-inline-notice" role="alert">{message}</p>}</section></div>
  return <div className="system-view system-today"><header className="screen-heading"><div><Eyebrow>{formatted}</Eyebrow><h1>Today</h1><p>One meaningful action, connected to the route you chose.</p></div><div className="screen-heading__status"><span><i /> {directive.status === 'COMPLETED' ? 'COMPLETE' : 'ACTIVE'}</span><small>{directive.dateKey}</small></div></header><section className={`directive-panel ${directive.status === 'COMPLETED' ? 'directive-panel--complete' : ''}`} aria-labelledby="directive-title"><div className="directive-panel__heading"><Eyebrow>DAILY DIRECTIVE</Eyebrow><span className="sample-chip">{directive.sourceType === 'ROADMAP_STEP' ? 'ROADMAP' : 'MANUAL'}</span></div><h2 id="directive-title">{directive.title}</h2>{source ? <button type="button" className="directive-path" onClick={() => onViewPath(source)}><span>{source.path.name}</span><b>→</b><span>{source.goal.title}</span><b>→</b><span>{source.roadmap.title}</span><ArrowIcon /></button> : <p className="directive-empty-copy">{directive.sourceType === 'ROADMAP_STEP' ? 'Source Roadmap Step is no longer available. This daily record is preserved.' : 'A focus you chose for today.'}</p>}{directive.why && <p className="directive-why"><strong>WHY THIS TODAY</strong>{directive.why}</p>}<div className="directive-panel__body"><div><div className="directive-section-label"><span>OBJECTIVES</span><strong>{completedCount}/{current.objectives.length}</strong></div><DirectiveObjectives objectives={current.objectives} onToggle={id => apply(service.objectiveToggle(id, now()))} onEdit={(id, title) => apply(service.objectiveEdit(id, title, now()))} onMove={(id, direction) => { const ids = current.objectives.map(objective => objective.id); const index = ids.indexOf(id); const target = index + direction; if (index < 0 || target < 0 || target >= ids.length) return; [ids[index], ids[target]] = [ids[target]!, ids[index]!]; apply(service.objectiveReorder(directive.id, ids, now())) }} onRemove={id => { if (window.confirm('Remove this objective and its recorded completion?')) apply(service.objectiveRemove(id, now())) }} disabled={directive.status !== 'ACTIVE'}/>{directive.status === 'ACTIVE' && <div className="directive-add-objective"><input value={objectiveTitle} onChange={event => setObjectiveTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addObjective() } }} placeholder="Add an objective" aria-label="Add an objective" /><button type="button" className="text-link" onClick={addObjective}>Add</button></div>}</div></div><div className="directive-panel__actions">{directive.status === 'ACTIVE' && <><button type="button" className="system-button system-button--primary" onClick={() => onEnterLockIn(directive, current.objectives)}>ENTER LOCK-IN <ArrowIcon /></button><button type="button" className="system-button" disabled={completedCount !== current.objectives.length || current.objectives.length === 0} onClick={complete}>Complete Daily Directive</button><button type="button" className="text-link" onClick={() => { const candidate = candidates.find(candidate => candidate.step.id !== source?.step.id); if (candidate) { apply(service.replace(directive.id, { candidate, now: now() })); return } const title = window.prompt('Replace today’s Directive. The original record will be kept.', directive.title); if (title?.trim()) apply(service.replace(directive.id, { title, now: now() })) }}>Change Today’s Directive</button></>}{directive.status === 'COMPLETED' && <><strong className="directive-complete-label">DIRECTIVE COMPLETE</strong>{source && !source.step.completedAt && <button type="button" className="system-button system-button--primary" onClick={() => apply(service.completeLinkedRoadmapStep(directive.id, now()))}>Complete Roadmap Step</button>}</>}</div>{message && <p className="system-inline-notice" role="alert">{message}</p>}</section><section className="other-actions"><div className="section-heading"><Eyebrow>ROADMAP CONTEXT</Eyebrow><button type="button" className="text-link" onClick={() => onViewPath(source)}>View in Map <ArrowIcon /></button></div><p className="directive-context-note">{source ? `${source.phase.title} · linked Roadmap Step` : 'Source context is retained with this directive.'}</p></section><span hidden>{refresh}</span></div>
}

function TodayDirectiveWithEdit(props: Parameters<typeof TodayDirectiveView>[0]) {
  const [editDraft, setEditDraft] = useState<string | null>(null)
  const [editProblem, setEditProblem] = useState<string | null>(null)
  const directive = props.service.current(localDateKey()).directive
  const edit = () => {
    if (!directive) return
    const title = window.prompt('Edit today\'s directive', editDraft ?? directive.title)
    if (!title || title.trim() === title && title.trim() === directive.title) return
    setEditDraft(title.trim())
    const result = props.service.edit(directive.id, { title: title.trim(), now: new Date().toISOString() })
    if (result.ok) { props.onData(result.data); setEditProblem(null); setEditDraft(null) }
    else setEditProblem(result.message)
  }
  return <>{editProblem && <p className="system-inline-notice" role="alert">{editProblem}</p>}<TodayDirectiveView data={props.data} service={props.service} onData={props.onData} onEnterLockIn={props.onEnterLockIn} onViewPath={props.onViewPath} />{directive?.status === 'ACTIVE' && <button type="button" className="text-link directive-edit-button" onClick={edit}>EDIT DIRECTIVE</button>}</>
}


function StatusView({ data }: { data: SystemData | null }) {
  if (!data) return <div className="system-view system-status"><header className="screen-heading"><h1>SYSTEM STATUS</h1></header><p role="status">System records are unavailable. Counts cannot be shown.</p></div>
  const facts = systemStatus(data)
  const metrics = [
    ['ACTIVE PATHS', facts.activePaths, 'current directions'],
    ['ACTIVE GOALS', facts.activeGoals, 'recorded as active'],
    ['STEPS COMPLETED', facts.completedSteps, 'recorded completions'],
    ['DIRECTIVES COMPLETED', facts.completedDirectives, 'daily records'],
  ] as const
  return <div className="system-view system-status">
    <header className="screen-heading"><div><h1>SYSTEM STATUS</h1><p>A reflection of your recorded progress.</p></div><div className="screen-heading__status"><span>LOCAL RECORDS</span></div></header>
    <section className="status-metrics" aria-label="Recorded System facts">{metrics.map(([label, value, note]) => <article key={label}><Eyebrow>{label}</Eyebrow><strong className="metric-rank">{value}</strong><span className="metric-note">{note}</span></article>)}</section>
    <section className="growth-section" aria-labelledby="growth-title"><div className="section-heading"><div><Eyebrow>PATHS</Eyebrow><h2 id="growth-title">Recorded evidence</h2></div></div>
      <p className="status-disclaimer">{facts.completedGoals} Goals completed · {facts.completedObjectives} objectives completed</p>
      <div className="growth-list">{facts.paths.map(path => <article key={path.id}><span className="growth-marker" aria-hidden="true" /><div><h3>{path.name}</h3><p>{path.activeGoals} active Goals · {path.status}</p></div><small>Steps completed</small><strong aria-label={path.completedSteps + ' Steps completed'}>{path.completedSteps}</strong></article>)}</div>
      {facts.paths.length === 0 && <p className="system-empty-state">No Path records available.</p>}
    </section><p className="status-disclaimer">Completion counts include retained history. They measure recorded actions, not mastery. XP, Level, Rank, Stability, and Condition are not calculated.</p>
  </div>
}

function YouView({ data }: { data: SystemData | null }) {
  return <div className="system-view system-you"><header className="screen-heading"><div><Eyebrow>YOUR SYSTEM</Eyebrow><h1>Your direction stays yours.</h1><p>Choose your Paths and Goals. ASCEND keeps the route visible.</p></div></header>
    <section className="identity-panel"><Eyebrow>PERSONAL DIRECTION</Eyebrow><p className="identity-empty-copy">Your identity is yours to define. No identity statement has been recorded in ASCEND.</p></section>
    <section className="configuration-grid"><article><Eyebrow>ACTIVE PATHS</Eyebrow><strong>{data ? systemStatus(data).activePaths : '—'}</strong><p>recorded directions</p></article><article><Eyebrow>STORAGE</Eyebrow><strong>Local</strong><p>This browser and device</p></article><article><Eyebrow>ACCOUNT</Eyebrow><strong>None</strong><p>No cloud account or sync</p></article></section>
  </div>
}

function LockInView({ data, directive, onObjective, onExit, problem }: { data: SystemData; directive: SystemDailyDirective; onObjective: (id: string) => void; onExit: () => void; problem: string | null }) {
  const objectives = data.directiveObjectives.filter(objective => objective.directiveId === directive.id).sort((a, b) => a.order - b.order)
  const completeCount = objectives.filter(objective => objective.completedAt).length
  const step = data.roadmapSteps.find(entry => entry.id === directive.sourceRoadmapStepId)
  const roadmap = data.roadmaps.find(entry => entry.id === step?.roadmapId)
  const goal = data.goals.find(entry => entry.id === roadmap?.goalId)
  const path = data.paths.find(entry => entry.id === goal?.pathId)
  const [exitReason, setExitReason] = useState('emergency')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { titleRef.current?.focus() }, [])
  const openExitDialog = () => dialogRef.current?.showModal()
  return <main className="system-lockin" aria-labelledby="lockin-title">
    <header className="lockin-header"><span className="lockin-header__brand"><SystemMark /> ASCEND / LOCK-IN</span><span className="lockin-header__status"><i /> ACTIVE</span><button type="button" className="lockin-exit-link" onClick={openExitDialog}>EXIT</button></header>
    <div className="lockin-layout"><div className="lockin-timer" aria-label="Untimed focus session"><svg className="lockin-timer__ring" viewBox="0 0 320 320" aria-hidden="true"><circle className="lockin-timer__track" cx="160" cy="160" r="156" /></svg><span>FOCUS TIME</span><strong>NOW</strong><small>UNTIMED SESSION</small></div>
      <section className="lockin-mission"><Eyebrow>DAILY DIRECTIVE</Eyebrow><h1 id="lockin-title" ref={titleRef} tabIndex={-1}>{directive.title}</h1><p className="lockin-path">{path && goal && roadmap ? path.name + ' → ' + goal.title + ' → ' + roadmap.title : 'A focus you chose for today.'}</p>
        <div className="lockin-objectives"><div className="lockin-objectives__heading"><Eyebrow>OBJECTIVES</Eyebrow><strong>{completeCount}/{objectives.length}</strong></div><div className="objective-list objective-list--compact">{objectives.map(objective => <label className={'objective ' + (objective.completedAt ? 'is-complete' : '')} key={objective.id}><input type="checkbox" checked={Boolean(objective.completedAt)} onChange={() => onObjective(objective.id)} /><span className="objective__box" aria-hidden="true">{objective.completedAt ? '✓' : ''}</span><span><strong>{objective.title}</strong></span></label>)}</div>{objectives.length === 0 && <p className="directive-empty-copy">No objectives recorded. Add them in Today when you are ready.</p>}{problem && <p role="alert" className="system-inline-notice">{problem}</p>}</div>
      </section>
      <section className="lockin-sealed"><Eyebrow>DISTRACTIONS TO AVOID</Eyebrow><div>{([{ name: 'Instagram', icon: 'today' }, { name: 'Facebook', icon: 'you' }, { name: 'YouTube', icon: 'system' }, { name: 'TikTok', icon: 'journey' }, { name: 'Games', icon: 'plus' }] satisfies Array<{ name: string; icon: IconName }>).map(app => <span className="sealed-app" key={app.name}><Icon name={app.icon} size={18} />{app.name}</span>)}</div><small>Suggested reminders only. No apps or websites are blocked. This focus list is not saved.</small></section>
      <button type="button" className="system-button lockin-mobile-exit" onClick={openExitDialog}>EXIT LOCK-IN</button>
    </div>
    <dialog ref={dialogRef} className="lockin-exit-dialog" aria-labelledby="lockin-exit-title"><div><Eyebrow>LEAVE FOCUS</Eyebrow><h2 id="lockin-exit-title">Leave Lock-In?</h2><p>Emergency and legitimate exits are always allowed. No penalties apply. The reason is not saved.</p><label htmlFor="exit-reason">Reason</label><select id="exit-reason" value={exitReason} onChange={event => setExitReason(event.target.value)}><option value="emergency">Emergency</option><option value="legitimate">Legitimate interruption</option><option value="finished">Mission complete</option></select><div className="lockin-exit-dialog__actions"><button type="button" className="system-button system-button--quiet" onClick={() => dialogRef.current?.close()}>Stay</button><button type="button" className="system-button system-button--primary" onClick={onExit}>End session <ArrowIcon /></button></div></div></dialog>
  </main>
}

export function SystemScreen({ repository }: { repository?: SystemRepository } = {}) {
  const [awakened, setAwakened] = useState(false)
  const [view, setView] = useState<SystemView>('today')
  const [lockIn, setLockIn] = useState(false)
  const [lockInDirective, setLockInDirective] = useState<SystemDailyDirective | null>(null)
  const [systemData, setSystemData] = useState<SystemData | null>(null)
  const [lockInProblem, setLockInProblem] = useState<string | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const [systemProblem, setSystemProblem] = useState<string | null>(null)
  const systemRepository = useMemo(() => repository ?? defaultSystemRepository, [repository])
  const systemService = useMemo(() => createSystemApplicationService(systemRepository), [systemRepository])
  const roadmapService = useMemo(() => createSystemRoadmapService(systemRepository), [systemRepository])
  const directiveService = useMemo(() => createSystemDirectiveService(systemRepository), [systemRepository])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loaded = systemService.load()
      if (loaded.ok && loaded.value) { setSystemData(loaded.value); return }
      if (loaded.ok) {
        const seeded = systemService.seedIfAbsent(new Date().toISOString())
        if (seeded.ok) setSystemData(seeded.data)
        else { setSystemData(createSystemData()); setSystemProblem('System storage is unavailable. Changes cannot be saved yet.') }
        return
      }
      setSystemData(createSystemData())
      setSystemProblem(loaded.problem === 'newer-schema' ? 'This System data was created by a newer ASCEND version.' : loaded.problem === 'storage-unavailable' ? 'System storage is unavailable. Changes cannot be saved yet.' : 'System data could not be read. Existing bytes were preserved.')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [systemService])
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); if (awakened && !lockIn) mainRef.current?.focus() }, [view, lockIn, awakened])
  if (!awakened) return <div className="system-app system-awakening"><div className="awakening-content"><SystemMark /><Eyebrow>ASCEND / BETA V1</Eyebrow><h1>Become <em>visible</em> to yourself.</h1><p>Turn intention into real-world movement. Follow the signal upward.</p><button type="button" className="system-button system-button--primary" onClick={() => setAwakened(true)}>Enter the System <ArrowIcon /></button><small>Paths, Goals, and Roadmaps / saved locally</small></div></div>
  const lockInView = lockIn && lockInDirective && systemData && <LockInView data={systemData} directive={lockInDirective} problem={lockInProblem} onObjective={id => { const result = directiveService.objectiveToggle(id, new Date().toISOString()); if (result.ok) { setSystemData(result.data); setLockInProblem(null) } else setLockInProblem(result.message) }} onExit={() => { setLockIn(false); setView('today') }} />
  const updateDirectiveData = (next: SystemData) => setSystemData(next)
  return <>{lockInView}<div className="system-app" hidden={lockIn}><a className="system-skip-link" href="#system-main">Skip to main content</a><SystemNav view={view} onView={(next) => { setView(next) }} /><main ref={mainRef} tabIndex={-1} id="system-main" className="system-main" data-system-view={view}><div className="system-main__topline"><span>ASCEND</span></div>{systemProblem && <p className="system-inline-notice" role="status">{systemProblem} Existing data is preserved.</p>}{systemData && <div hidden={view !== 'today'}><TodayDirectiveWithEdit data={systemData} service={directiveService} onData={updateDirectiveData} onEnterLockIn={(directive) => { setLockInDirective(directive); setLockInProblem(null); setLockIn(true) }} onViewPath={() => setView('path')} /></div>}{systemData && <div hidden={view !== 'path'}><SystemPathView data={systemData} onData={setSystemData} service={systemService} roadmapService={roadmapService} storageProblem={systemProblem} onRetry={() => { const result = systemService.seedIfAbsent(new Date().toISOString()); if (result.ok) { setSystemData(result.data); setSystemProblem(null) } }} /></div>}{view === 'status' && <StatusView data={systemProblem ? null : systemData} />}{view === 'you' && <YouView data={systemProblem ? null : systemData} />}</main></div></>
}
