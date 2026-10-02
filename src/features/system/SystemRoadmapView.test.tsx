import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SystemRoadmapView } from './SystemRoadmapView'
import { SystemScreen } from './SystemScreen'
import { createSystemRepository } from '../../data/repositories/systemRepository'
import { createWebStorageStore } from '../../data/storage/webStorageStore'
import { createSystemRoadmapService } from '../../application/systemRoadmaps'
import { createGoal, type SystemData } from '../../domain/systemPathGoal'
import { roadmapFixture, SYSTEM_TEST_NOW as NOW } from '../../test/systemRoadmapFixtures'

beforeEach(() => {
  window.localStorage.clear()
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
})
function setup(initial = roadmapFixture(), storageProblem: string | null = null) {
  const store = createWebStorageStore(), repository = createSystemRepository(store)
  repository.save(initial)
  const service = createSystemRoadmapService(repository)
  function Harness() {
    const [data, setData] = useState<SystemData>(initial)
    return <SystemRoadmapView data={data} pathId={data.paths[1]!.id} service={service} onData={setData} onEditState={() => undefined} storageProblem={storageProblem} />
  }
  const rendered = render(<Harness />)
  return { ...rendered, repository, store, user: userEvent.setup() }
}
function stepRow(title: string) { return screen.getByRole('heading', { level: 4, name: title }).closest('li')! }
describe('Roadmap UI', () => {
  it('creates a manual Roadmap, Phases and Steps from a Goal', async () => {
    const initial = roadmapFixture()
    const { user, repository } = setup({ ...initial, roadmaps: [], roadmapPhases: [], roadmapSteps: [] })
    expect(screen.getByText('No Roadmap yet.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create Roadmap' }))
    await user.type(screen.getByLabelText('Title'), 'My learning route')
    await user.selectOptions(screen.getByLabelText('Roadmap type'), 'SKILL')
    await user.click(within(screen.getByRole('form')).getByRole('button', { name: 'Create Roadmap' }))
    expect(screen.getByText('No Phases yet.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add Phase' }))
    await user.type(screen.getByLabelText('Title'), 'Foundation')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('No Steps yet. Add a meaningful stage.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add Step' }))
    await user.type(screen.getByLabelText('Title'), 'Learn variables')
    await user.click(screen.getByLabelText('Optional Step'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('heading', { level: 4, name: 'Learn variables' })).toBeInTheDocument()
    expect(screen.getByText('AVAILABLE · OPTIONAL')).toBeInTheDocument()
    expect(repository.load()!.roadmapSteps[0]).toMatchObject({ optional: true })
  })
  it('selects current, completes, unlocks prerequisites and persists across remount', async () => {
    const { user, repository, unmount } = setup()
    expect(within(stepRow('DOM')).getByText('LOCKED')).toBeInTheDocument()
    expect(within(stepRow('DOM')).queryByRole('button', { name: 'Complete Step' })).not.toBeInTheDocument()
    await user.click(within(stepRow('Variables')).getByRole('button', { name: 'Set current' }))
    expect(screen.getByRole('region', { name: 'Current Step' })).toHaveTextContent('Variables')
    await user.click(screen.getByRole('button', { name: 'Complete current Step' }))
    expect(within(stepRow('DOM')).getByText('AVAILABLE')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Suggested next Step' })).toHaveTextContent('DOM')
    const saved = repository.load()!
    unmount(); setup(saved)
    expect(within(stepRow('Variables')).getByText('COMPLETED')).toBeInTheDocument()
    expect(screen.getByText(/1 \/ 3 Steps completed/)).toBeInTheDocument()
  })
  it('edits prerequisites and optional property, rejecting cycles while retaining form input', async () => {
    const { user } = setup()
    await user.click(within(stepRow('Variables')).getByRole('button', { name: 'Edit Step' }))
    await user.clear(screen.getByLabelText('Title')); await user.type(screen.getByLabelText('Title'), 'My authored text')
    await user.click(screen.getByLabelText('DOM'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('cycle')
    expect(screen.getByLabelText('Title')).toHaveValue('My authored text')
    await user.click(screen.getByLabelText('DOM'))
    await user.click(screen.getByLabelText('Optional Step'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('AVAILABLE · OPTIONAL')).toBeInTheDocument()
  })
  it('reorders Steps and Phases with keyboard buttons', async () => {
    const { user, repository } = setup()
    const reorder = screen.getByRole('button', { name: 'Move Browser up' })
    reorder.focus(); await user.keyboard('{Enter}')
    expect(repository.load()!.roadmapPhases.find(p => p.id === 'phase_two')?.order).toBe(0)
    const stepMove = screen.getByRole('button', { name: 'Move Events up' })
    stepMove.focus(); await user.keyboard('{Enter}')
    expect(repository.load()!.roadmapSteps.find(s => s.id === 'step_three')?.order).toBe(0)
  })
  it('selects one Goal at a time', async () => {
    const initial = roadmapFixture()
    const another = createGoal({ id: 'goal_other', pathId: initial.paths[1]!.id, title: 'Learn English', now: NOW })
    const { user } = setup({ ...initial, goals: [...initial.goals, another] })
    await user.selectOptions(screen.getByLabelText('Goal'), 'goal_other')
    expect(screen.getByText('No Roadmap yet.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Variables' })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Goal'), 'goal_test')
    expect(screen.getByRole('heading', { name: 'Variables', level: 4 })).toBeInTheDocument()
  })
  it('pauses, resumes, archives and restores the route', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Pause Roadmap' }))
    expect(screen.getByText('Roadmap paused. Resume when you are ready.')).toBeInTheDocument()
    expect(within(stepRow('Variables')).getByRole('button', { name: 'Complete Step' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Resume Roadmap' }))
    await user.click(screen.getByRole('button', { name: 'Archive Roadmap' }))
    expect(screen.getByText('Roadmap archived. Your route and completed history remain here.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Restore Roadmap' }))
    expect(screen.getByRole('heading', { name: 'Variables', level: 4 })).toBeInTheDocument()
  })
  it('archives and restores completed Step history', async () => {
    const { user } = setup()
    await user.click(within(stepRow('Events')).getByRole('button', { name: 'Complete Step' }))
    await user.click(within(stepRow('Events')).getByRole('button', { name: 'Archive Step' }))
    await user.click(screen.getByText('Archived history (1)'))
    expect(screen.getByText('Completed 2026-10-02')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Restore Step' }))
    expect(within(stepRow('Events')).getByText('COMPLETED')).toBeInTheDocument()
    await user.click(within(stepRow('Events')).getByRole('button', { name: 'Undo completion' }))
    expect(within(stepRow('Events')).getByText('AVAILABLE')).toBeInTheDocument()
  })
  it('retains authored text on storage failure', async () => {
    const { user, store } = setup()
    await user.click(screen.getByRole('button', { name: 'Edit Roadmap' }))
    await user.clear(screen.getByLabelText('Title')); await user.type(screen.getByLabelText('Title'), 'Keep my draft')
    vi.spyOn(store, 'write').mockReturnValue('unavailable')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Storage unavailable')
    expect(screen.getByLabelText('Title')).toHaveValue('Keep my draft')
  })
  it('disables writes when System storage cannot be read safely', () => {
    setup(roadmapFixture(), 'Future schema')
    expect(screen.getByRole('button', { name: 'Edit Roadmap' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add Phase' })).toBeDisabled()
  })
  it('handles a Path with no Goals', () => {
    const initial = roadmapFixture()
    setup({ ...initial, goals: [], roadmaps: [], roadmapPhases: [], roadmapSteps: [] })
    expect(screen.getByText('No Goal yet.')).toBeInTheDocument()
    expect(screen.getByLabelText('Goal')).toBeDisabled()
  })
  it('switches Map/Roadmap while preserving the existing Map and guards unsaved edits', async () => {
    const store = createWebStorageStore(), repository = createSystemRepository(store)
    repository.save(roadmapFixture())
    const user = userEvent.setup()
    render(<SystemScreen repository={repository} />)
    await user.click(screen.getByRole('button', { name: 'Enter the System' }))
    await user.click(screen.getAllByRole('button', { name: 'Path' })[0]!)
    expect(screen.getByRole('group', { name: 'Your system, in motion.' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ROADMAP' }))
    await user.selectOptions(screen.getByLabelText('Path'), 'path_8e2f1c6a')
    expect(screen.getByRole('heading', { name: 'JavaScript' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit Roadmap' }))
    expect(screen.getByRole('button', { name: 'MAP' })).toBeDisabled()
    await user.type(screen.getByLabelText('Title'), ' draft')
    await user.click(screen.getAllByRole('button', { name: 'Today' })[0]!)
    await user.click(screen.getAllByRole('button', { name: 'Path' })[0]!)
    expect(screen.getByLabelText('Title')).toHaveValue('JavaScript draft')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'MAP' }))
    expect(screen.getByRole('group', { name: 'Your system, in motion.' })).toBeInTheDocument()
  })
})
