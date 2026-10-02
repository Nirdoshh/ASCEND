import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SystemRoadmapService, RoadmapOperationResult } from '../../application/systemRoadmaps'
import type { SystemData, SystemGoal } from '../../domain/systemPathGoal'
import { currentRoadmapStep, orderedPhases, orderedSteps, roadmapProgress, stepState, type RoadmapCommand, type RoadmapType } from '../../domain/systemRoadmap'
import { Icon } from '../../components/ui/Icon'
import './SystemRoadmapView.css'

type Editor = {
  kind: 'create' | 'edit' | 'add-phase' | 'edit-phase' | 'add-step' | 'edit-step'
  goalId: string
  roadmapId?: string
  phaseId?: string
  stepId?: string
  title: string
  description: string
  type: RoadmapType
  optional: boolean
  prerequisites: string[]
}
type Props = {
  data: SystemData
  pathId: string
  selectedGoalId?: string | null
  onGoalSelect?: (id: string) => void
  service: SystemRoadmapService
  onData: (data: SystemData) => void
  onEditState: (editing: boolean) => void
  storageProblem: string | null
  onViewMap?: (goalId: string) => void
}
const emptyEditor = { title: '', description: '', type: 'GOAL' as const, optional: false, prerequisites: [] }
function move(ids: string[], index: number, direction: number): string[] {
  const result = [...ids]
  const other = index + direction
  if (other >= 0 && other < ids.length) [result[index], result[other]] = [result[other]!, result[index]!]
  return result
}
function Reorder({ title, index, count, onMove }: { title: string; index: number; count: number; onMove: (direction: number) => void }) {
  return <div className="roadmap-reorder"><button type="button" className="text-link" disabled={index === 0} aria-label={`Move ${title} up`} onClick={() => onMove(-1)}>Up</button><button type="button" className="text-link" disabled={index === count - 1} aria-label={`Move ${title} down`} onClick={() => onMove(1)}>Down</button></div>
}

export function SystemRoadmapView({ data, pathId, selectedGoalId, onGoalSelect, service, onData, onEditState, storageProblem, onViewMap }: Props) {
  const goals = data.goals.filter(g => g.pathId === pathId)
  const [goalId, setGoalId] = useState<string | null>(null)
  const goal = goals.find(g => g.id === (selectedGoalId ?? goalId)) ?? goals.find(g => g.status === 'ACTIVE') ?? goals[0]
  const roadmap = data.roadmaps.find(r => r.goalId === goal?.id)
  const [editor, setEditor] = useState<Editor | null>(null)
  const editing = editor !== null
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { if (editing) formRef.current?.querySelector<HTMLInputElement>('input')?.focus() }, [editing])
  useEffect(() => {
    if (!editing) return
    const protectDraft = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protectDraft)
    return () => window.removeEventListener('beforeunload', protectDraft)
  }, [editing])
  const edit = (next: Editor) => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setEditor(next); onEditState(true); setMessage('')
  }
  const close = () => {
    setEditor(null); onEditState(false)
    queueMicrotask(() => { if (returnFocus.current?.isConnected) returnFocus.current.focus(); else headingRef.current?.focus() })
  }
  const apply = (result: RoadmapOperationResult, success: string) => {
    setError(!result.ok); setMessage(result.ok ? success : result.message)
    if (result.ok) onData(result.data)
    return result.ok
  }
  const run = (command: RoadmapCommand, success = 'Roadmap saved.') => apply(service.execute(command, new Date().toISOString()), success)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editor) return
    const input = { title: editor.title, description: editor.description }
    let command: RoadmapCommand
    switch (editor.kind) {
      case 'create': command = { kind: 'create', goalId: editor.goalId, type: editor.type, ...input }; break
      case 'edit': command = { kind: 'edit', roadmapId: editor.roadmapId!, ...input }; break
      case 'add-phase': command = { kind: 'add-phase', roadmapId: editor.roadmapId!, ...input }; break
      case 'edit-phase': command = { kind: 'edit-phase', phaseId: editor.phaseId!, ...input }; break
      case 'add-step': command = { kind: 'add-step', phaseId: editor.phaseId!, ...input, optional: editor.optional, prerequisiteStepIds: editor.prerequisites }; break
      case 'edit-step': command = { kind: 'edit-step', stepId: editor.stepId!, ...input, optional: editor.optional, prerequisiteStepIds: editor.prerequisites }; break
    }
    if (run(command)) close()
  }
  const begin = (kind: Editor['kind'], selectedGoal: SystemGoal) => edit({ ...emptyEditor, kind, goalId: selectedGoal.id, roadmapId: roadmap?.id, type: roadmap?.type ?? 'GOAL' })
  const phases = roadmap ? orderedPhases(data, roadmap.id) : []
  const current = roadmap ? currentRoadmapStep(data, roadmap) : null
  const progress = roadmap ? roadmapProgress(data, roadmap.id) : null
  const editable = Boolean(roadmap && roadmap.status !== 'ARCHIVED' && !storageProblem && !editor)
  const actionable = editable && roadmap?.status !== 'PAUSED'
  const editorRoadmap = data.roadmaps.find(r => r.id === editor?.roadmapId)
  const prerequisiteChoices = editorRoadmap ? orderedSteps(data, editorRoadmap.id).filter(s => s.id !== editor?.stepId) : []
  const archivedPhases = data.roadmapPhases.filter(p => p.roadmapId === roadmap?.id && p.archivedAt)
  const archivedSteps = data.roadmapSteps.filter(s => s.roadmapId === roadmap?.id && s.archivedAt && !data.roadmapPhases.find(p => p.id === s.phaseId)?.archivedAt)
  const formTitle = editor?.kind === 'create' ? 'Create Roadmap' : editor?.kind === 'add-phase' ? 'Add Phase' : editor?.kind === 'add-step' ? 'Add Step' : editor?.kind === 'edit-phase' ? 'Edit Phase' : editor?.kind === 'edit-step' ? 'Edit Step' : 'Edit Roadmap'

  return <section className="roadmap-view" aria-labelledby="roadmap-title">
    <div className="roadmap-goal-choice"><label htmlFor="roadmap-goal">Goal</label><select id="roadmap-goal" value={goal?.id ?? ''} disabled={Boolean(editor) || goals.length === 0} onChange={e => { setGoalId(e.target.value); onGoalSelect?.(e.target.value); setMessage('') }}>{goals.length === 0 && <option value="">No Goal yet</option>}{goals.map(g => <option key={g.id} value={g.id}>{g.title}{g.status !== 'ACTIVE' ? ` · ${g.status}` : ''}</option>)}</select></div>
    <header className="roadmap-heading"><div><p className="system-eyebrow">{roadmap ? `${roadmap.type} ROADMAP` : 'ROADMAP'}</p><h2 id="roadmap-title" ref={headingRef} tabIndex={-1}>{roadmap?.title ?? goal?.title ?? 'Choose your direction.'}</h2>{roadmap?.description && <p>{roadmap.description}</p>}</div>{roadmap && <span className="roadmap-status">{roadmap.status}</span>}</header>
    <p className="roadmap-feedback" role={error && !editor ? 'alert' : 'status'} aria-live="polite">{error && editor ? '' : message}</p>
    {!goal && <div className="system-empty-state"><p>No Goal yet.</p><small>Add a Goal in Map to build its route.</small></div>}
    {goal && !roadmap && !editor && <div className="system-empty-state"><p>No Roadmap yet.</p><small>Create the route to this Goal.</small><button type="button" className="system-button system-button--primary" disabled={Boolean(storageProblem) || goal.status === 'ARCHIVED'} onClick={() => begin('create', goal)}>Create Roadmap</button>{goal.status === 'ARCHIVED' && <p>This Goal is archived. Its history is preserved.</p>}</div>}
    {roadmap && <>
      <div className="roadmap-toolbar">
        {onViewMap && <button type="button" className="text-link" disabled={Boolean(editor)} onClick={() => onViewMap(goal!.id)}>View in Map</button>}
        <button type="button" className="text-link" disabled={!editable} onClick={() => edit({ ...emptyEditor, kind: 'edit', goalId: goal!.id, roadmapId: roadmap.id, title: roadmap.title, description: roadmap.description ?? '', type: roadmap.type })}>Edit Roadmap</button>
        {roadmap.status === 'PAUSED' || roadmap.status === 'ARCHIVED' ? <button type="button" className="text-link" disabled={Boolean(editor) || Boolean(storageProblem)} onClick={() => apply(service.resume(roadmap.id, new Date().toISOString()), 'Roadmap resumed.')}>{roadmap.status === 'ARCHIVED' ? 'Restore Roadmap' : 'Resume Roadmap'}</button> : roadmap.status === 'ACTIVE' && <button type="button" className="text-link" disabled={!editable} onClick={() => apply(service.pause(roadmap.id, new Date().toISOString()), 'Roadmap paused.')}>Pause Roadmap</button>}
        {roadmap.status !== 'ARCHIVED' && <button type="button" className="text-link" disabled={!editable} onClick={() => apply(service.archive(roadmap.id, new Date().toISOString()), 'Roadmap archived. All content and history are retained.')}>Archive Roadmap</button>}
      </div>
      {roadmap.status === 'PAUSED' && <p className="system-inline-notice">Roadmap paused. Resume when you are ready.</p>}
      {roadmap.status === 'ARCHIVED' && <p className="system-inline-notice">Roadmap archived. Your route and completed history remain here.</p>}
      {roadmap.status === 'COMPLETED' && <p className="system-inline-notice">{progress?.required ? 'Required Steps complete.' : 'Roadmap complete.'} Your route remains visible.{current && ' Optional Steps are still available.'}</p>}
      {current && <section className="roadmap-current" aria-label={current.selected ? 'Current Step' : 'Suggested next Step'}><p className="system-eyebrow">{current.selected ? 'CURRENT' : 'NEXT AVAILABLE · SUGGESTED'}</p><h3>{current.step.title}</h3>{current.step.description && <p>{current.step.description}</p>}<div>{current.selected ? <button type="button" className="system-button system-button--primary" disabled={!actionable} onClick={() => run({ kind: 'complete', stepId: current.step.id }, 'Step completed. Next availability updated.')}>Complete current Step <Icon name="check" size={16} /></button> : <button type="button" className="system-button system-button--primary" disabled={!actionable} onClick={() => run({ kind: 'active', roadmapId: roadmap.id, stepId: current.step.id }, 'Current Step selected.')}>Set as current Step</button>}</div></section>}
      {progress && <p className="roadmap-progress">{progress.completed} / {progress.total} Steps completed <span>· {progress.requiredCompleted} / {progress.required} required</span>{current && <span> · Phase {phases.findIndex(p => p.id === current.step.phaseId) + 1} of {phases.length}</span>}</p>}
      {phases.length === 0 && <div className="system-empty-state"><p>No Phases yet.</p><small>Start with the first stage of your route.</small></div>}
      <ol className="roadmap-phases">{phases.map((phase, phaseIndex) => {
        const steps = orderedSteps(data, roadmap.id, phase.id)
        const state = steps.length && steps.every(s => s.optional || s.completedAt) && steps.some(s => s.completedAt) ? 'COMPLETE' : current?.step.phaseId === phase.id ? 'ACTIVE' : steps.length && steps.every(s => stepState(data, roadmap, s) === 'LOCKED') ? 'LOCKED' : 'AVAILABLE'
        return <li className="roadmap-phase" key={phase.id}><header><span className="roadmap-phase-number">{String(phaseIndex + 1).padStart(2, '0')}</span><div><h3>{phase.title}</h3>{phase.description && <p>{phase.description}</p>}</div><span className="roadmap-status">{state}</span></header>
          <div className="roadmap-edit-actions"><button type="button" className="text-link" disabled={!editable} onClick={() => edit({ ...emptyEditor, kind: 'edit-phase', goalId: goal!.id, roadmapId: roadmap.id, phaseId: phase.id, title: phase.title, description: phase.description ?? '', type: roadmap.type })}>Edit Phase</button><button type="button" className="text-link" disabled={!editable} onClick={() => run({ kind: 'archive-phase', phaseId: phase.id }, 'Phase archived. Content and history retained.')}>Archive Phase</button>{editable && <Reorder title={phase.title} index={phaseIndex} count={phases.length} onMove={direction => run({ kind: 'reorder-phases', roadmapId: roadmap.id, ids: move(phases.map(p => p.id), phaseIndex, direction) }, 'Phase order saved.')} />}</div>
          {steps.length === 0 && <p className="roadmap-phase-empty">No Steps yet. Add a meaningful stage.</p>}
          <ol className="roadmap-steps">{steps.map((step, stepIndex) => {
            const state = stepState(data, roadmap, step)
            return <li key={step.id} className={`roadmap-step roadmap-step--${state.toLowerCase()}`}><div className="roadmap-step-mark" aria-hidden="true">{state === 'COMPLETED' ? <Icon name="check" size={15} /> : <span />}</div><div className="roadmap-step-content"><h4>{step.title}</h4><p className="roadmap-step-state">{state}{step.optional && ' · OPTIONAL'}</p>{step.description && <p>{step.description}</p>}{step.prerequisiteStepIds.length > 0 && <p className="roadmap-prerequisites">Requires: {step.prerequisiteStepIds.map(id => data.roadmapSteps.find(s => s.id === id)?.title).join(', ')}</p>}
              <div className="roadmap-step-actions">{state === 'AVAILABLE' && <button type="button" className="text-link" disabled={!actionable} onClick={() => run({ kind: 'active', roadmapId: roadmap.id, stepId: step.id }, 'Current Step selected.')}>Set current</button>}{state === 'AVAILABLE' || state === 'ACTIVE' ? <button type="button" className="text-link" disabled={!actionable} onClick={() => run({ kind: 'complete', stepId: step.id }, 'Step completed. Next availability updated.')}>Complete Step</button> : state === 'COMPLETED' && <button type="button" className="text-link" disabled={!actionable} onClick={() => run({ kind: 'undo', stepId: step.id }, 'Completion undone.')}>Undo completion</button>}
                <button type="button" className="text-link" disabled={!editable} onClick={() => edit({ ...emptyEditor, kind: 'edit-step', goalId: goal!.id, roadmapId: roadmap.id, phaseId: phase.id, stepId: step.id, title: step.title, description: step.description ?? '', type: roadmap.type, optional: step.optional, prerequisites: [...step.prerequisiteStepIds] })}>Edit Step</button><button type="button" className="text-link" disabled={!editable} onClick={() => run({ kind: 'archive-step', stepId: step.id }, 'Step archived. Completion history retained.')}>Archive Step</button>{editable && <Reorder title={step.title} index={stepIndex} count={steps.length} onMove={direction => run({ kind: 'reorder-steps', phaseId: phase.id, ids: move(steps.map(s => s.id), stepIndex, direction) }, 'Step order saved.')} />}
              </div></div></li>
          })}</ol><button type="button" className="text-link roadmap-add-step" disabled={!editable} onClick={() => edit({ ...emptyEditor, kind: 'add-step', goalId: goal!.id, roadmapId: roadmap.id, phaseId: phase.id, type: roadmap.type })}><Icon name="plus" size={15} /> Add Step</button>
        </li>
      })}</ol>
      <button type="button" className="system-button" disabled={!editable} onClick={() => begin('add-phase', goal!)}><Icon name="plus" size={16} /> Add Phase</button>
      {(archivedPhases.length > 0 || archivedSteps.length > 0) && <details className="roadmap-history"><summary>Archived history ({archivedPhases.length + archivedSteps.length})</summary>{archivedPhases.map(p => <article key={p.id}><h3>{p.title} · Archived Phase</h3>{data.roadmapSteps.filter(s => s.phaseId === p.id).map(s => <p key={s.id}>{s.title} · {s.completedAt ? `Completed ${s.completedAt.slice(0, 10)}` : 'Incomplete'}{s.optional && ' · Optional'}</p>)}<button type="button" className="text-link" disabled={!editable} onClick={() => run({ kind: 'restore-phase', phaseId: p.id }, 'Phase restored.')}>Restore Phase</button></article>)}{archivedSteps.map(s => <article key={s.id}><h3>{s.title} · Archived Step</h3><p>{s.completedAt ? `Completed ${s.completedAt.slice(0, 10)}` : 'Incomplete'}</p><button type="button" className="text-link" disabled={!editable} onClick={() => run({ kind: 'restore-step', stepId: s.id }, 'Step restored.')}>Restore Step</button></article>)}</details>}
    </>}
    {editor && <form ref={formRef} className="goal-form roadmap-form" aria-label={formTitle} onSubmit={submit}>
      <h3>{formTitle}</h3><p>Goal: {data.goals.find(g => g.id === editor.goalId)?.title}</p>
      {error && message && <p className="roadmap-feedback" role="alert">{message}</p>}
      <label>Title<input required maxLength={500} value={editor.title} onChange={e => setEditor({ ...editor, title: e.target.value })} /></label>
      <label>Description<textarea maxLength={500} value={editor.description} onChange={e => setEditor({ ...editor, description: e.target.value })} /></label>
      {editor.kind === 'create' && <label>Roadmap type<select value={editor.type} onChange={e => setEditor({ ...editor, type: e.target.value as RoadmapType })}><option value="GOAL">GOAL — milestones and phases</option><option value="SKILL">SKILL — learning with prerequisites</option></select></label>}
      {(editor.kind === 'add-step' || editor.kind === 'edit-step') && <><label className="roadmap-checkbox"><input type="checkbox" checked={editor.optional} onChange={e => setEditor({ ...editor, optional: e.target.checked })} /> Optional Step</label>{editor.type === 'SKILL' && <fieldset><legend>Prerequisites</legend><p>Listed Steps must be completed first. Cycles are rejected.</p>{prerequisiteChoices.length === 0 && <p>No other Steps yet.</p>}{prerequisiteChoices.map(s => <label className="roadmap-checkbox" key={s.id}><input type="checkbox" checked={editor.prerequisites.includes(s.id)} onChange={e => setEditor({ ...editor, prerequisites: e.target.checked ? [...editor.prerequisites, s.id] : editor.prerequisites.filter(id => id !== s.id) })} />{s.title}{s.optional && ' (optional)'}</label>)}</fieldset>}</>}
      <div><button type="submit" className="system-button system-button--primary">{editor.kind === 'create' ? 'Create Roadmap' : 'Save'}</button><button type="button" className="system-button" onClick={close}>Cancel</button></div>
    </form>}
  </section>
}
