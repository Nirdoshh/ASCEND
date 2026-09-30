import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { createOnboardingDraftRepository } from '../../data/repositories'
import type { OnboardingDraftRepository } from '../../data/repositories'
import { createWebStorageStore, type StoreWriteResult } from '../../data/storage'
import {
  createCustomGrowthArea,
  SUGGESTED_GROWTH_AREAS,
  type GrowthArea,
  type NewGrowthAreaResult,
} from '../../domain/growthAreas'
import {
  addCustomGrowthArea,
  completeStep,
  createOnboardingDraft,
  knownGrowthAreas,
  reconcileSelections,
  toggleGrowthArea as toggleGrowthAreaIn,
} from '../../domain/onboardingDraft'
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

  const begin = useCallback(() => {
    setDraft((current) => {
      // Never discard an existing draft: someone who refreshes, or
      // navigates back to the welcome screen, keeps their answers.
      if (current) return current

      const created = startDraft()
      setStorageStatus(repository.save(created) === 'ok' ? 'ok' : 'unavailable')
      return created
    })
  }, [repository])

  const now = useCallback(() => new Date().toISOString(), [])

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
      const result = createCustomGrowthArea(raw, existing)

      if (result.ok) {
        apply((current) => addCustomGrowthArea(current, result.area, now()))
      }
      return result
    },
    [apply, draft, now],
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
      isSelected: (id: string) => usable?.selectedGrowthAreas.includes(id) ?? false,
      storageStatus,
      begin,
      toggleArea,
      createCustomArea,
      advanceFrom,
    }
  }, [draft, storageStatus, begin, toggleArea, createCustomArea, advanceFrom])

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