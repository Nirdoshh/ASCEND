import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { createOnboardingDraftRepository } from '../../data/repositories'
import type { OnboardingDraftRepository } from '../../data/repositories'
import { createWebStorageStore, type StoreWriteResult } from '../../data/storage'
import { createGrowthAreaId } from '../../domain/growthAreaId'
import {
  createCustomGrowthArea,
  SUGGESTED_GROWTH_AREAS,
  type GrowthArea,
  type NewGrowthAreaResult,
} from '../../domain/growthAreas'
import {
  addCustomGrowthArea,
  addMilestone as addMilestoneIn,
  completeStep,
  createOnboardingDraft,
  editMilestone as editMilestoneIn,
  knownGrowthAreas,
  reconcileSelections,
  removeMilestone as removeMilestoneIn,
  setDailyEffortMinutes as setDailyEffortIn,
  setDurationDays as setDurationIn,
  setGoal as setGoalIn,
  setWhy as setWhyIn,
  toggleGrowthArea as toggleGrowthAreaIn,
  type MilestoneWriteResult,
} from '../../domain/onboardingDraft'
import { createMilestoneId } from '../../domain/milestone'
import type { OnboardingDraft, OnboardingStep } from '../../domain/onboardingDraft'

/**
 * The repository onboarding uses by default.
 *
 * The same one-line seam as preferences: replace this factory in Phase
 * 11 with one that talks to the Worker API and no screen changes.
 */
export const defaultOnboardingDraftRepository: OnboardingDraftRepository =
  createOnboardingDraftRepository(createWebStorageStore())

export interface OnboardingContextValue {
  /** null means "this person has not started yet". */
  draft: OnboardingDraft | null
  /** Every area available to choose: suggestions plus customs. */
  readonly areas: readonly GrowthArea[]
  isSelected: (id: string) => boolean
  /** 'ok' when the draft persists; 'unavailable' when it cannot. */
  storageStatus: Extract<StoreWriteResult, 'ok' | 'unavailable'>
  begin(): void
  toggleArea(id: string): void
  createCustomArea(raw: string): NewGrowthAreaResult
  /**
   * Records the Goal, on every keystroke rather than on Continue.
   *
   * The order is the product promise, not an optimisation. If this were
   * called when Continue was pressed, a person who typed an answer and
   * closed the tab would lose it — and "if the user answered something and
   * we lose it, that is the single most annoying thing this app could do"
   * is the rule the whole file is written around.
   *
   * It costs one localStorage write per keystroke, which is a few hundred
   * bytes. The draft is small, writes are synchronous but trivial at this
   * size, and `setGoal` returns the identical draft when the trimmed text
   * has not changed, so a keystroke that only moves a trailing space costs
   * nothing at all.
   */
  setGoal(raw: string): void
  /** The WHY. Same reasoning, same rules, same cost. */
  setWhy(raw: string): void
  /**
   * Records the Duration, in days.
   *
   * NOT per-keystroke, unlike the Goal and the WHY, and the difference is
   * the widget rather than the principle. A preset chip is a COMMITTED
   * answer the moment it is pressed, so there is no half-typed sentence to
   * lose. The custom number field is the exception: it commits on submit,
   * which is why the field keeps its own draft text in local state until
   * the user actually submits it.
   *
   * A number that is not a positive whole number DELETES the answer rather
   * than storing it. Zero is not a short duration; see schedule.ts.
   */
  setDuration(days: number): void
  /** The Daily Effort, in minutes. Same rules, same absence rule. */
  setEffort(minutes: number): void
  /**
   * Adds a milestone, or explains why it was refused.
   *
   * Returns the result rather than throwing, because every refusal here is
   * an ordinary thing a person does — a blank box, a sentence already on
   * the list — and the screen's job is to say which one it was next to the
   * field they typed it in.
   */
  addMilestone(raw: string): MilestoneWriteResult
  /** Changes a milestone's text. The id is read, never written. */
  editMilestone(id: string, raw: string): MilestoneWriteResult
  /** Removes a milestone. Removing the last one leaves the question unanswered. */
  removeMilestone(id: string): void
  advanceFrom(step: OnboardingStep): void
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

/**
 * Onboarding state, kept in memory and mirrored to storage.
 *
 * The rule that shapes this file: MEMORY IS THE TRUTH, STORAGE IS A
 * BACKUP. Every action changes React state first and writes afterwards.
 *
 * That ordering is deliberate. If a write fails — a private window, a
 * full quota, storage blocked by policy — the user keeps everything they
 * typed and simply sees an honest warning that it will not be there
 * tomorrow. The reverse ordering would throw away real answers to save
 * a few kilobytes, which is the one thing this app must never do.
 *
 * Note there is no `localStorage` in this file, or anywhere below it.
 * Screens call these functions; only this file knows what a repository
 * is.
 */
export function OnboardingDraftProvider({
  children,
  repository = defaultOnboardingDraftRepository,
}: {
  children: ReactNode
  /** Injectable so tests can supply an in-memory repository. */
  repository?: OnboardingDraftRepository
}) {
  const [draft, setDraft] = useState<OnboardingDraft | null>(() => repository.load())
  const [storageStatus, setStorageStatus] = useState<
    Extract<StoreWriteResult, 'ok' | 'unavailable'>
  >(() => (repository.isAvailable() ? 'ok' : 'unavailable'))

  /**
   * Applies a pure draft transformation and persists the result.
   *
   * All state changes funnel through here, which is what makes "write
   * after, never instead of" enforceable rather than aspirational, and
   * it means there is exactly one place that stamps `updatedAt`.
   *
   * A missing draft is created here rather than refused. Someone who
   * deep-links to /onboarding/areas, or refreshes there before the
   * welcome screen has ever run, would otherwise get a screen with no
   * Growth Areas and a Continue button that can never be pressed. Any
   * interaction producing a fresh draft is strictly better than that
   * dead end.
   */
  const apply = useCallback(
    (change: (current: OnboardingDraft) => OnboardingDraft) => {
      setDraft((current) => {
        const base = current ?? startDraft()
        const next = change(base)

        if (next === base && current !== null) return current

        setStorageStatus(repository.save(next) === 'ok' ? 'ok' : 'unavailable')
        return next
      })
    },
    [repository],
  )

  const now = useCallback(() => new Date().toISOString(), [])

  const begin = useCallback(() => {
    // Marks the welcome step as done, which both creates the draft and
    // moves it off the screen the user has just read.
    //
    // The currentStep test is the whole point. `apply` has already
    // substituted a fresh draft for a missing one, so "is there a draft
    // yet" cannot be asked inside `change` — the answer is always yes.
    // Asking "has the welcome step been completed" can be asked, and is
    // the question that actually matters: it means pressing Start after
    // coming Back from the WHY does NOT rewind somebody's progress.
    //
    // It also repairs the stale pointer carried by every draft written in
    // Phase 2A, whose `begin()` created a draft still saying `welcome`.
    apply((current) =>
      current.currentStep === 'welcome' ? completeStep(current, 'welcome', now()) : current,
    )
  }, [apply, now])

  const toggleArea = useCallback(
    (id: string) => {
      apply((current) => toggleGrowthAreaIn(current, id, now()))
    },
    [apply, now],
  )

  const createCustomArea = useCallback(
    (raw: string): NewGrowthAreaResult => {
      // Validate against the areas that exist with or without a draft:
      // the suggestions are code, so they are always available, and a
      // duplicate must be caught even on a first visit.
      const existing = draft ? knownGrowthAreas(draft) : SUGGESTED_GROWTH_AREAS

      // The id is minted HERE, at the moment of creation, and never
      // recomputed. It is the reference every later milestone, action,
      // point event and D1 row will point at, so deriving it from the
      // name would make a rename silently break all of them.
      const result = createCustomGrowthArea(raw, existing, createGrowthAreaId())

      if (result.ok) {
        apply((current) => addCustomGrowthArea(current, result.area, now()))
      }
      return result
    },
    [apply, draft, now],
  )

  const setGoal = useCallback(
    (raw: string) => {
      apply((current) => setGoalIn(current, raw, now()))
    },
    [apply, now],
  )

  const setWhy = useCallback(
    (raw: string) => {
      apply((current) => setWhyIn(current, raw, now()))
    },
    [apply, now],
  )

  const setDuration = useCallback(
    (days: number) => {
      apply((current) => setDurationIn(current, days, now()))
    },
    [apply, now],
  )

  const setEffort = useCallback(
    (minutes: number) => {
      apply((current) => setDailyEffortIn(current, minutes, now()))
    },
    [apply, now],
  )

  /**
   * Adds a milestone.
   *
   * Two calls to the same pure function, and the duplication is the point.
   *
   * The FIRST validates against the draft the user is looking at, so the
   * message they get matches the list in front of them. The SECOND runs
   * against whatever React state actually holds when the update is applied,
   * so a state update still in flight cannot be clobbered by returning the
   * first call's draft directly. `createCustomArea` above splits the same
   * way for the same reason.
   *
   * The ID IS MINTED HERE, ONCE, BEFORE EITHER CALL. That
   * is what makes it stable: the domain never generates one, so the two
   * calls cannot mint two different ids for the same milestone, and the
   * retry-on-commit above cannot produce a different result from the one
   * the user was told about.
   */
  const addMilestone = useCallback(
    (raw: string): MilestoneWriteResult => {
      const base = draft ?? startDraft()
      const id = createMilestoneId()
      const result = addMilestoneIn(base, id, raw, now())

      if (result.ok) {
        apply((current) => {
          const applied = addMilestoneIn(current, id, raw, now())
          // The second call can only fail if the world moved underneath the
          // user — a second tab, say. Keeping `current` unchanged is the
          // honest outcome: nothing was silently dropped or reordered.
          return applied.ok ? applied.draft : current
        })
      }

      return result
    },
    [apply, draft, now],
  )

  const editMilestone = useCallback(
    (id: string, raw: string): MilestoneWriteResult => {
      const base = draft ?? startDraft()
      const result = editMilestoneIn(base, id, raw, now())

      if (result.ok) {
        apply((current) => {
          const applied = editMilestoneIn(current, id, raw, now())
          return applied.ok ? applied.draft : current
        })
      }

      return result
    },
    [apply, draft, now],
  )

  const removeMilestone = useCallback(
    (id: string) => {
      apply((current) => removeMilestoneIn(current, id, now()))
    },
    [apply, now],
  )

  const advanceFrom = useCallback(
    (step: OnboardingStep) => {
      apply((current) => completeStep(current, step, now()))
    },
    [apply, now],
  )

  const value = useMemo<OnboardingContextValue>(() => {
    // Reconcile on read, not on write: it repairs storage that was
    // hand-edited or written by a different build, and it is a no-op
    // for a healthy draft, so it costs nothing in the common case.
    const usable = draft ? reconcileSelections(draft) : null

    return {
      draft: usable,
      // The suggestions are code, not user data, so they are available
      // before any draft exists. Returning an empty list here is what
      // made a deep link to step 2 an unusable screen.
      areas: usable ? knownGrowthAreas(usable) : SUGGESTED_GROWTH_AREAS,
      isSelected: (id: string) => usable?.selectedGrowthAreaIds.includes(id) ?? false,
      storageStatus,
      begin,
      toggleArea,
      createCustomArea,
      setGoal,
      setWhy,
      setDuration,
      setEffort,
      addMilestone,
      editMilestone,
      removeMilestone,
      advanceFrom,
    }
  }, [
    draft,
    storageStatus,
    begin,
    toggleArea,
    createCustomArea,
    setGoal,
    setWhy,
    setDuration,
    setEffort,
    addMilestone,
    editMilestone,
    removeMilestone,
    advanceFrom,
  ])

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

/**
 * A fresh draft. Persistence is the caller's job, so this stays pure and
 * there is exactly one place that decides a draft is worth writing.
 */
function startDraft(): OnboardingDraft {
  return createOnboardingDraft(new Date().toISOString())
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding must be used inside <OnboardingDraftProvider>')
  }
  return context
}