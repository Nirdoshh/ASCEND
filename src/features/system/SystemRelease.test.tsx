import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SystemScreen } from './SystemScreen'
import { createSystemRepository } from '../../data/repositories/systemRepository'
import { createWebStorageStore } from '../../data/storage/webStorageStore'
import { applyRoadmapCommand } from '../../domain/systemRoadmap'
import { createGoal, createSystemData, type SystemData } from '../../domain/systemPathGoal'
import { roadmapFixture, SYSTEM_TEST_NOW as NOW } from '../../test/systemRoadmapFixtures'
import { ASCEND_SYSTEM_KEY } from '../../data/storage/keys'

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

async function setup(data: SystemData = roadmapFixture()) {
  const store = createWebStorageStore()
  const repository = createSystemRepository(store)
  expect(repository.save(data)).toBe('ok')
  const user = userEvent.setup()
  const rendered = render(<SystemScreen repository={repository} />)
  await user.click(screen.getByRole('button', { name: 'Enter the System' }))
  await screen.findByRole('heading', { name: 'Today' })
  const section = async (name: string) => user.click(screen.getAllByRole('button', { name })[0]!)
  return { ...rendered, user, section, repository, store }
}

describe('Beta V1 release', () => {
  it('opens a resting Goal found by search and pans with keyboard controls', async () => {
    const initial = roadmapFixture()
    const { user, section } = await setup({ ...initial, goals: initial.goals.map(goal => ({ ...goal, status: 'PAUSED' })) })
    await section('Path')
    await user.type(screen.getByLabelText('Search graph'), 'Learn')
    await user.click(within(screen.getByRole('group', { name: 'Graph search results' })).getByRole('button'))
    expect(screen.getByRole('complementary', { name: 'GOAL details' })).toHaveTextContent('PAUSED')
    const graph = screen.getByRole('group', { name: 'Your system, in motion.' })
    const transform = graph.querySelector('g')!.getAttribute('transform')
    graph.focus()
    await user.keyboard('{ArrowRight}')
    expect(graph.querySelector('g')!.getAttribute('transform')).not.toBe(transform)
  })

  it('preserves an open Today form across section navigation', async () => {
    const { user, section } = await setup(createSystemData())
    await user.click(screen.getByRole('button', { name: 'CREATE MANUAL DIRECTIVE' }))
    await user.type(screen.getByLabelText('Title'), 'Keep this daily draft')
    await section('Status')
    await section('Today')
    expect(screen.getByLabelText('Title')).toHaveValue('Keep this daily draft')
  })

  it('allows explicit manual replacement while retaining the original record', async () => {
    const { user, repository } = await setup(createSystemData())
    await user.click(screen.getByRole('button', { name: 'CREATE MANUAL DIRECTIVE' }))
    await user.type(screen.getByLabelText('Title'), 'Original focus')
    await user.click(screen.getByRole('button', { name: 'Accept Directive' }))
    vi.spyOn(window, 'prompt').mockReturnValueOnce('New intentional focus')
    await user.click(screen.getByRole('button', { name: 'Change Today’s Directive' }))
    expect(screen.getByRole('heading', { name: 'New intentional focus' })).toBeInTheDocument()
    expect(repository.load()!.directives.find(entry => entry.title === 'Original focus')?.status).toBe('ABANDONED')
  })

  it('shows factual Status counts, retained completion history and neutral You configuration', async () => {
    let data = applyRoadmapCommand(roadmapFixture(), { kind: 'complete', stepId: 'step_three' }, NOW)
    data = applyRoadmapCommand(data, { kind: 'archive-step', stepId: 'step_three' }, NOW)
    const { section } = await setup(data)
    await section('Status')
    const metrics = screen.getByRole('region', { name: 'Recorded System facts' })
    expect(metrics).toHaveTextContent('ACTIVE PATHS4')
    expect(metrics).toHaveTextContent('ACTIVE GOALS1')
    expect(metrics).toHaveTextContent('STEPS COMPLETED1')
    expect(metrics).toHaveTextContent('DIRECTIVES COMPLETED0')
    expect(screen.queryByText(/82%|Lv\. 18|BUILD|VOICE|Active 7 days/)).not.toBeInTheDocument()
    await section('You')
    expect(screen.getByText(/No identity statement has been recorded/)).toBeInTheDocument()
    expect(screen.getByText('No cloud account or sync')).toBeInTheDocument()
    expect(screen.queryByText(/days awake|SAMPLE IDENTITY|60 min/)).not.toBeInTheDocument()
  })

  it('completes the Today → objectives → Directive → explicit Step → Map loop and reloads', async () => {
    const { user, section, repository, unmount } = await setup()
    await user.click(screen.getByRole('button', { name: /MIND.*Variables/ }))
    expect(screen.getByRole('button', { name: 'Complete Daily Directive' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'Variables' }))
    await user.click(screen.getByRole('button', { name: 'Complete Daily Directive' }))
    expect(repository.load()!.roadmapSteps[0]?.completedAt).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Variables' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Complete Roadmap Step' }))
    expect(repository.load()!.roadmapSteps[0]?.completedAt).not.toBeNull()
    await section('Status')
    expect(screen.getByRole('region', { name: 'Recorded System facts' })).toHaveTextContent('DIRECTIVES COMPLETED1')
    await section('Path')
    await user.click(screen.getByRole('button', { name: 'Learn JavaScript, goal' }))
    await user.click(screen.getByRole('button', { name: 'Variables, step' }))
    expect(screen.getByRole('complementary', { name: 'STEP details' })).toHaveTextContent('COMPLETED')
    unmount()
    render(<SystemScreen repository={repository} />)
    await user.click(screen.getByRole('button', { name: 'Enter the System' }))
    expect(await screen.findByText('DIRECTIVE COMPLETE')).toBeInTheDocument()
  })

  it('uses real Lock-In context, persists its objectives and supports intentional exit', async () => {
    const { user, repository } = await setup()
    await user.click(screen.getByRole('button', { name: /MIND.*Variables/ }))
    await user.click(screen.getByRole('button', { name: 'ENTER LOCK-IN' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Variables' })).toHaveFocus()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getByText('MIND → Learn JavaScript → JavaScript')).toBeInTheDocument()
    expect(screen.getByText('DISTRACTIONS TO AVOID')).toBeInTheDocument()
    expect(screen.getByText(/No apps or websites are blocked/)).toBeInTheDocument()
    expect(screen.getByLabelText('Untimed focus session')).toBeInTheDocument()
    expect(screen.queryByText(/PayPilot|42:16|SEALED|HOLD/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Variables' }))
    expect(repository.load()!.directiveObjectives[0]?.completedAt).not.toBeNull()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    // jsdom does not implement modal dialogs; Chromium verifies native focus trapping.
    const dialog = document.querySelector('dialog')!
    dialog.showModal = () => { dialog.open = true }
    await user.click(screen.getByRole('button', { name: 'EXIT' }))
    expect(screen.getByRole('dialog', { name: 'Leave Lock-In?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'End session' }))
    expect(screen.getAllByRole('navigation', { name: 'System sections' })).toHaveLength(2)
    expect(screen.getByRole('checkbox', { name: 'Variables' })).toBeChecked()
  })

  it('keeps manual and objective input after failed writes', async () => {
    const { user, store } = await setup(createSystemData())
    await user.click(screen.getByRole('button', { name: 'CREATE MANUAL DIRECTIVE' }))
    await user.type(screen.getByLabelText('Title'), 'Keep my focus')
    const failure = vi.spyOn(store, 'write').mockReturnValue('quota-exceeded')
    await user.click(screen.getByRole('button', { name: 'Accept Directive' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Storage is full')
    expect(screen.getByLabelText('Title')).toHaveValue('Keep my focus')
    failure.mockRestore()
    await user.click(screen.getByRole('button', { name: 'Accept Directive' }))
    await user.type(screen.getByLabelText('Add an objective'), 'Keep my objective')
    vi.spyOn(store, 'write').mockReturnValue('unavailable')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByRole('alert')).toHaveTextContent('storage is unavailable')
    expect(screen.getByLabelText('Add an objective')).toHaveValue('Keep my objective')
  })

  it('edits and reorders objectives through the existing service', async () => {
    const { user, repository } = await setup()
    await user.click(screen.getByRole('button', { name: /MIND.*Variables/ }))
    await user.type(screen.getByLabelText('Add an objective'), 'Practice once')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Move Practice once up' }))
    expect(repository.load()!.directiveObjectives.find(entry => entry.title === 'Practice once')?.order).toBe(0)
    vi.spyOn(window, 'prompt').mockReturnValueOnce('Practice twice')
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]!)
    expect(screen.getByRole('checkbox', { name: 'Practice twice' })).toBeInTheDocument()
  })

  it('offers a chooser for multiple real candidates and preserves replaced history', async () => {
    let data = roadmapFixture()
    data = { ...data, goals: [...data.goals, createGoal({ id: 'goal_other', pathId: data.paths[0]!.id, title: 'Run 5K', now: NOW })] }
    data = applyRoadmapCommand(data, { kind: 'create', id: 'route_other', goalId: 'goal_other', title: 'Running', type: 'GOAL' }, NOW)
    data = applyRoadmapCommand(data, { kind: 'add-phase', id: 'phase_other', roadmapId: 'route_other', title: 'Start' }, NOW)
    data = applyRoadmapCommand(data, { kind: 'add-step', id: 'step_other', phaseId: 'phase_other', title: 'Run 1K' }, NOW)
    const { user, repository } = await setup(data)
    await user.click(screen.getByRole('button', { name: 'CHOOSE FOCUS' }))
    await user.click(screen.getByRole('button', { name: /BODY.*Run 1K/ }))
    await user.click(screen.getByRole('button', { name: 'Change Today’s Directive' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Variables' })).toBeInTheDocument()
    expect(repository.load()!.directives.find(entry => entry.title === 'Run 1K')?.status).toBe('ABANDONED')
  })

  it.each(['future', 'malformed'])('reports %s storage across screens without showing fake facts or rewriting bytes', async kind => {
    const bytes = kind === 'future' ? '{"schemaVersion":99,"paths":[],"goals":[]}' : '{broken'
    window.localStorage.setItem(ASCEND_SYSTEM_KEY, bytes)
    const user = userEvent.setup()
    render(<SystemScreen />)
    await user.click(screen.getByRole('button', { name: 'Enter the System' }))
    await screen.findByText(/Existing data is preserved/)
    for (const label of ['Today', 'Path', 'Status', 'You']) {
      await user.click(screen.getAllByRole('button', { name: label })[0]!)
      expect(screen.getAllByRole('status').some(element => element.textContent?.includes('preserved'))).toBe(true)
    }
    expect(window.localStorage.getItem(ASCEND_SYSTEM_KEY)).toBe(bytes)
  })

  it('announces Goal save failure and keeps the authored form', async () => {
    const { user, section, store } = await setup()
    await section('Path')
    await user.click(screen.getByRole('button', { name: 'Add Goal' }))
    await user.type(screen.getByLabelText('Title'), 'My authored goal')
    vi.spyOn(store, 'write').mockReturnValue('unavailable')
    await user.click(screen.getByRole('button', { name: 'Create Goal' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save')
    expect(screen.getByLabelText('Title')).toHaveValue('My authored goal')
  })

  it('shows no invented candidate for an archived Goal', async () => {
    const data = roadmapFixture()
    const { section } = await setup({ ...data, goals: data.goals.map(goal => ({ ...goal, status: 'ARCHIVED' })) })
    expect(screen.getByText('NO DIRECTIVE YET')).toBeInTheDocument()
    await section('Path')
    expect(screen.queryByRole('button', { name: 'Learn JavaScript, goal' })).not.toBeInTheDocument()
  })
})
