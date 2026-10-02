import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'

import { createSystemApplicationService } from '../../application/systemPaths'
import type { SystemData, SystemGoal, GoalStatus } from '../../domain/systemPathGoal'
import { Icon } from '../../components/ui/Icon'
import type { SystemRoadmapService } from '../../application/systemRoadmaps'
import { SystemRoadmapView } from './SystemRoadmapView'

type Props = {
  data: SystemData
  onData: (data: SystemData) => void
  service: ReturnType<typeof createSystemApplicationService>
  storageProblem: string | null
  pulse: boolean
  onRetry: () => void
  roadmapService: SystemRoadmapService
}

type Node = { id: string; label: string; kind: 'you' | 'path' | 'goal' | 'action'; x: number; y: number; pathId?: string; branch: string }

const phoneQuery = '(max-width: 600px)'
function subscribePhone(onChange: () => void) {
  const query = window.matchMedia(phoneQuery)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
function isPhone() { return window.matchMedia(phoneQuery).matches }

function Eyebrow({ children }: { children: string }) { return <p className="system-eyebrow">{children}</p> }
function ArrowIcon() { return <svg viewBox="0 0 20 20" aria-hidden="true" className="system-arrow"><path d="M4 10h11M11 5l5 5-5 5" /></svg> }
const DESKTOP_SLOTS: Array<[number, number]> = [[150, 175], [410, 45], [670, 175], [410, 315], [210, 45], [610, 45]]
const PHONE_SLOTS: Array<[number, number]> = [[55, 140], [180, 35], [305, 140], [180, 260], [80, 35], [280, 35]]

export function SystemPathView({ data, onData, service, roadmapService, storageProblem, pulse, onRetry }: Props) {
  const mobile = useSyncExternalStore(subscribePhone, isPhone, () => false)
  const stageRef = useRef<HTMLDivElement>(null)
  const [selectedPathId, setSelectedPathId] = useState(data.paths.find((path) => path.status === 'ACTIVE')?.id ?? data.paths[0]?.id ?? null)
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
  const [goalForm, setGoalForm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })
  const [pathFormOpen, setPathFormOpen] = useState(false)
  const [mode, setMode] = useState<'map' | 'roadmap'>('map')
  const [roadmapEditing, setRoadmapEditing] = useState(false)
  const selectedPath = data.paths.find((path) => path.id === selectedPathId) ?? data.paths[0]
  const goals = selectedPath ? data.goals.filter((goal) => goal.pathId === selectedPath.id) : []
  const nodes = useMemo(() => {
    const next: Node[] = [{ id: 'you', label: 'YOU', kind: 'you', x: mobile ? 180 : 410, y: mobile ? 135 : 175, branch: 'core' }]
    data.paths.forEach((path, index) => {
      const slot = (mobile ? PHONE_SLOTS : DESKTOP_SLOTS)[index % DESKTOP_SLOTS.length] ?? [410, 315]
      const [x, y] = slot
      const branch = `branch-system-${index % 4}`
      next.push({ id: `path:${path.id}`, label: path.name, kind: 'path', x, y, pathId: path.id, branch })
      data.goals.filter((goal) => goal.pathId === path.id).forEach((goal, goalIndex) => {
        next.push({ id: `goal:${goal.id}`, label: goal.title, kind: 'goal', x: mobile ? x : x + (goalIndex % 2 === 0 ? -62 : 62), y: y + 86 + goalIndex * 76, pathId: path.id, branch })
      })
    })
    if (pulse) next.push({ id: 'pulse-action', label: 'Status UI', kind: 'action', x: mobile ? 180 : 410, y: mobile ? 470 : 575, branch: 'branch-system-2' })
    return next
  }, [data, mobile, pulse])
  const edges = data.paths.flatMap((path) => {
    const pathNode = nodes.find((node) => node.id === `path:${path.id}`)
    if (!pathNode) return []
    return [['you', pathNode.id] as const, ...nodes.filter((node) => node.pathId === path.id && node.kind === 'goal').map((goal) => [pathNode.id, goal.id] as const)]
  })

  useEffect(() => {
    if (!mobile || !stageRef.current) return
    const target = selectedGoalId ? nodes.find((node) => node.id === `goal:${selectedGoalId}`) : undefined
    stageRef.current.scrollTo({ top: Math.max(0, ((target?.y ?? 0) - 150) * (stageRef.current.clientWidth / 360)), behavior: 'instant' })
  }, [mobile, selectedGoalId, data, nodes])

  const update = (result: ReturnType<typeof service.createGoal>) => { if (result.ok) onData(result.data) }
  const changeStatus = (goal: SystemGoal, status: GoalStatus) => update(service.setGoalStatus(goal.id, status, new Date().toISOString()))
  const submitGoal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedPath) return
    const fields = new FormData(event.currentTarget)
    const input = { pathId: selectedPath.id, title: String(fields.get('title') ?? ''), description: String(fields.get('description') ?? ''), why: String(fields.get('why') ?? ''), now: new Date().toISOString() }
    const result = goalForm.id ? service.updateGoal(goalForm.id, input) : service.createGoal(input)
    if (result.ok) { onData(result.data); setGoalForm({ open: false, id: null }) }
  }
  const submitPath = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedPath) return
    const fields = new FormData(event.currentTarget)
    const result = service.updatePath(selectedPath.id, { name: String(fields.get('name') ?? ''), description: String(fields.get('description') ?? ''), now: new Date().toISOString() })
    if (result.ok) { onData(result.data); setPathFormOpen(false) }
  }

  return <div className="system-view system-path">
    <header className="screen-heading"><div><Eyebrow>YOUR PATH</Eyebrow><h1>A bigger you.</h1><p>Every action connects to something greater.</p></div>{mode === 'map' && <div className="path-tools"><button type="button" className="path-search" aria-label="Search graph"><Icon name="search" size={17} /></button><button type="button" onClick={() => { setSelectedPathId(null); setSelectedGoalId(null) }}>Focus</button></div>}</header>
    {storageProblem && <p className="system-inline-notice" role="status">{storageProblem} <button type="button" className="text-link" onClick={onRetry}>Try again</button></p>}
    <div className="path-view-switch" role="group" aria-label="Path view"><button type="button" aria-pressed={mode === 'map'} disabled={roadmapEditing} onClick={() => setMode('map')}>MAP</button><button type="button" aria-pressed={mode === 'roadmap'} disabled={goalForm.open || pathFormOpen} onClick={() => setMode('roadmap')}>ROADMAP</button></div>
    <div hidden={mode !== 'map'}>
    <section className="graph-panel" aria-labelledby="real-graph-title"><div className="graph-panel__heading"><div><Eyebrow>ASCEND GRAPH</Eyebrow><h2 id="real-graph-title">Your system, in motion.</h2></div><span className="graph-key"><i /> ACTIVE <i className="is-muted" /> RESTING</span></div>
      <div ref={stageRef} className={`graph-stage ${pulse ? 'is-pulsing' : ''}`}><svg className="graph-svg" viewBox={mobile ? '0 0 360 620' : '0 0 820 700'} role="group" aria-labelledby="real-graph-title"><desc>A semantic graph connecting You to real Paths and Goals.</desc><defs><filter id="system-glow-real"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs><g className="graph-edges">{edges.map(([fromId, toId]) => { const from = nodes.find((node) => node.id === fromId); const to = nodes.find((node) => node.id === toId); if (!from || !to) return null; const dimmed = Boolean(selectedPath && to.pathId && to.pathId !== selectedPath.id); return <path key={`${fromId}-${toId}`} className={`graph-edge ${to.branch} ${dimmed ? 'is-dimmed' : ''}`} d={`M ${from.x} ${from.y} C ${from.x} ${(from.y + to.y) / 2}, ${to.x} ${(from.y + to.y) / 2}, ${to.x} ${to.y}`} /> })}</g><g className="graph-nodes">{nodes.map((node) => { const dimmed = Boolean(selectedPath && node.pathId && node.pathId !== selectedPath.id); const active = node.pathId === selectedPath?.id || node.id === `goal:${selectedGoalId}` || node.id === 'pulse-action'; const radius = node.kind === 'you' ? 37 : node.kind === 'path' ? 19 : node.kind === 'action' ? 7 : 9; const focus = () => { if (node.pathId) setSelectedPathId(node.pathId); if (node.kind === 'goal') setSelectedGoalId(node.id.slice(5)); }; return <g key={node.id} className={`graph-node graph-node--${node.kind} ${node.branch} ${dimmed ? 'is-dimmed' : ''} ${active ? 'is-active' : ''}`} transform={`translate(${node.x} ${node.y})`} role={node.kind === 'you' ? undefined : 'button'} tabIndex={node.kind === 'you' ? undefined : 0} aria-label={node.kind === 'you' ? 'You, the center of the system' : node.kind === 'action' ? `${node.label}, action. Focus branch` : `${node.label}, ${node.kind}`} onClick={node.kind === 'you' ? undefined : focus} onKeyDown={node.kind === 'you' ? undefined : (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); focus() } }}><circle className="graph-node__hit" r={Math.max(34, radius + 12)} />{(node.kind === 'you' || node.kind === 'path') && <circle className="graph-node__halo" r={radius + 10} />}<circle className="graph-node__core" r={radius} />{(node.kind === 'path' || node.kind === 'you') && <circle className="graph-node__mark" r="3" />}<text className="graph-node__label" y={node.kind === 'you' ? 6 : node.kind === 'path' ? 43 : 31}>{node.label.length > 22 ? `${node.label.slice(0, 21)}...` : node.label}</text></g> })}</g></svg></div>
      <div className="graph-stage__caption"><span>{selectedPath ? `FOCUS / ${selectedPath.name}` : 'SELECT A NODE TO FOCUS'}</span><span>PATHS {data.paths.length}</span></div>
      <div className="path-branches" aria-label="Path branches">{data.paths.map((path, index) => <button type="button" key={path.id} className={`branch-chip branch-chip--system-${index % 4} ${selectedPath?.id === path.id ? 'is-active' : ''}`} onClick={() => setSelectedPathId(path.id)}><span className="branch-chip__marker" /><strong>{path.name}</strong><small>{path.status === 'ACTIVE' ? `${data.goals.filter((goal) => goal.pathId === path.id && goal.status === 'ACTIVE').length} active goals` : path.status}</small><ArrowIcon /></button>)}</div>
    </section>
    {selectedPath && <section className="goal-management" aria-labelledby="goal-management-title"><div className="goal-management__heading"><div><Eyebrow>PATH DETAIL</Eyebrow><h2 id="goal-management-title">{selectedPath.name}</h2><p>{selectedPath.description ?? 'A direction you chose for your growth.'}</p></div><div className="goal-management__actions"><button type="button" className="system-button" onClick={() => setPathFormOpen((open) => !open)}>Edit Path</button>{selectedPath.status === 'PAUSED' && <button type="button" className="system-button" onClick={() => update(service.setPathStatus(selectedPath.id, 'ACTIVE', new Date().toISOString()))}>Resume</button>}{selectedPath.status === 'ACTIVE' && <button type="button" className="system-button" onClick={() => update(service.setPathStatus(selectedPath.id, 'PAUSED', new Date().toISOString()))}>Pause</button>}</div></div>
      {pathFormOpen && <form className="goal-form" onSubmit={submitPath}><label>Name<input name="name" defaultValue={selectedPath.name} required maxLength={80} /></label><label>Description<textarea name="description" defaultValue={selectedPath.description ?? ''} maxLength={500} /></label><div><button type="submit" className="system-button system-button--primary">Save Path</button><button type="button" className="system-button" onClick={() => setPathFormOpen(false)}>Cancel</button></div></form>}
      <div className="goal-management__list"><div className="goal-management__list-heading"><Eyebrow>GOALS</Eyebrow><button type="button" className="system-button system-button--primary" onClick={() => setGoalForm({ open: true, id: null })}>Add Goal <ArrowIcon /></button></div>{goals.length === 0 && <div className="system-empty-state"><strong>{selectedPath.name}</strong><p>No active Goal yet.</p><small>Create something you want to move forward.</small></div>}{goals.map((goal) => <article className={`goal-record goal-record--${goal.status.toLowerCase()}`} key={goal.id}><div><h3>{goal.title}</h3>{goal.why && <p>{goal.why}</p>}<span>{goal.status}</span></div><div className="goal-record__actions"><button type="button" className="text-link" onClick={() => setGoalForm({ open: true, id: goal.id })}>Edit</button>{goal.status === 'ACTIVE' && <button type="button" className="text-link" onClick={() => changeStatus(goal, 'PAUSED')}>Pause</button>}{goal.status === 'PAUSED' && <button type="button" className="text-link" onClick={() => changeStatus(goal, 'ACTIVE')}>Resume</button>}{goal.status !== 'COMPLETED' && goal.status !== 'ARCHIVED' && <button type="button" className="text-link" onClick={() => changeStatus(goal, 'COMPLETED')}>Complete</button>}{goal.status !== 'ARCHIVED' && <button type="button" className="text-link" onClick={() => changeStatus(goal, 'ARCHIVED')}>Archive</button>}</div></article>)}</div>
      {goalForm.open && <form className="goal-form" onSubmit={submitGoal}><Eyebrow>{goalForm.id ? 'EDIT GOAL' : 'NEW GOAL'}</Eyebrow><label>Title<input name="title" defaultValue={goalForm.id ? data.goals.find((goal) => goal.id === goalForm.id)?.title : ''} required maxLength={500} /></label><label>Description<textarea name="description" defaultValue={goalForm.id ? data.goals.find((goal) => goal.id === goalForm.id)?.description ?? '' : ''} maxLength={500} /></label><label>WHY<textarea name="why" defaultValue={goalForm.id ? data.goals.find((goal) => goal.id === goalForm.id)?.why ?? '' : ''} maxLength={500} /></label><div><button type="submit" className="system-button system-button--primary">{goalForm.id ? 'Save Goal' : 'Create Goal'}</button><button type="button" className="system-button" onClick={() => setGoalForm({ open: false, id: null })}>Cancel</button></div></form>}
    </section>}
    </div>
    <div hidden={mode !== 'roadmap'}>
      <div className="roadmap-path-choice"><label htmlFor="roadmap-path">Path</label><select id="roadmap-path" value={selectedPath?.id ?? ''} disabled={roadmapEditing} onChange={event => setSelectedPathId(event.target.value)}>{data.paths.map(path => <option key={path.id} value={path.id}>{path.name}{path.status !== 'ACTIVE' ? ` · ${path.status}` : ''}</option>)}</select></div>
      {roadmapEditing && <p className="system-inline-notice">Save or cancel this edit before switching views.</p>}
      <SystemRoadmapView data={data} pathId={selectedPath?.id ?? ''} selectedGoalId={selectedGoalId} onGoalSelect={setSelectedGoalId} service={roadmapService} onData={onData} onEditState={setRoadmapEditing} storageProblem={storageProblem} />
    </div>
  </div>
}
