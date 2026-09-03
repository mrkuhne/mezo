import { describe, it, expect } from 'vitest'
import * as hooks from '@/data/hooks'
import { useFuelDay as fromFuelHooks, useMealActions as actionsFromFuelHooks } from '@/data/fuel/fuelHooks'
import { useIntakes as useIntakesFromStackHooks } from '@/data/fuel/stackHooks'
import { useStackDay as useStackDayFromStackDayHooks } from '@/data/fuel/stackDayHooks'
import {
  useSlotTemplates as useSlotTemplatesFromSlotTemplateHooks,
  useSlotTemplateActions as useSlotTemplateActionsFromSlotTemplateHooks,
  useSlotTemplateEvaluation as useSlotTemplateEvaluationFromSlotTemplateHooks,
} from '@/data/fuel/slotTemplateHooks'
import {
  useJournalNotes as useJournalNotesFromJournalHooks,
  useJournalActions as useJournalActionsFromJournalHooks,
} from '@/data/journal/journalHooks'
import { useFeedback as useFeedbackFromFeedbackHooks } from '@/data/feedback/feedbackHooks'
import {
  useCharacterOverview as useCharacterOverviewFromCharacterHooks,
  useCharacterDimension as useCharacterDimensionFromCharacterHooks,
  useCharacterFeed as useCharacterFeedFromCharacterHooks,
  useCharacterExperts as useCharacterExpertsFromCharacterHooks,
  useCharacterConferences as useCharacterConferencesFromCharacterHooks,
  useCharacterConference as useCharacterConferenceFromCharacterHooks,
  useClaimFeedback as useClaimFeedbackFromCharacterHooks,
  useCharacterBootstrap as useCharacterBootstrapFromCharacterHooks,
  useCharacterRuns as useCharacterRunsFromCharacterHooks,
  useCharacterRun as useCharacterRunFromCharacterHooks,
} from '@/data/character/characterHooks'
import { useAdminInvites as useAdminInvitesFromAdminHooks, useAdminActions as useAdminActionsFromAdminHooks } from '@/data/admin/adminHooks'

describe('hooks.ts re-exports the dual-mode fuel-day hooks', () => {
  it('useFuelDay is the fuelHooks implementation (not the retired one-liner)', () => {
    expect(hooks.useFuelDay).toBe(fromFuelHooks)
  })
  it('useMealActions is re-exported', () => {
    expect(hooks.useMealActions).toBe(actionsFromFuelHooks)
  })
})

describe('hooks.ts re-exports useIntakes (mezo-vx9v)', () => {
  it('useIntakes is the stackHooks implementation', () => {
    expect(hooks.useIntakes).toBe(useIntakesFromStackHooks)
  })
})

describe('hooks.ts re-exports useStackDay (mezo-vx9v Task 8)', () => {
  it('useStackDay is the stackDayHooks implementation', () => {
    expect(hooks.useStackDay).toBe(useStackDayFromStackDayHooks)
  })
  it('useStackContext and useStackRecommendations are retired (Task 8 dead-code removal)', () => {
    expect('useStackContext' in hooks).toBe(false)
    expect('useStackRecommendations' in hooks).toBe(false)
  })
})

describe('hooks.ts re-exports the slot-template hooks (mezo-7102 / mezo-e6a4)', () => {
  it('useSlotTemplates is the slotTemplateHooks implementation', () => {
    expect(hooks.useSlotTemplates).toBe(useSlotTemplatesFromSlotTemplateHooks)
  })
  it('useSlotTemplateActions is the slotTemplateHooks implementation', () => {
    expect(hooks.useSlotTemplateActions).toBe(useSlotTemplateActionsFromSlotTemplateHooks)
  })
  it('useSlotTemplateEvaluation is the slotTemplateHooks implementation', () => {
    expect(hooks.useSlotTemplateEvaluation).toBe(useSlotTemplateEvaluationFromSlotTemplateHooks)
  })
})

describe('hooks.ts re-exports the journal hooks (mezo-b3pp.1)', () => {
  it('useJournalNotes is the journalHooks implementation', () => {
    expect(hooks.useJournalNotes).toBe(useJournalNotesFromJournalHooks)
  })
  it('useJournalActions is the journalHooks implementation', () => {
    expect(hooks.useJournalActions).toBe(useJournalActionsFromJournalHooks)
  })
})

describe('hooks.ts re-exports the feedback hook (mezo-b3pp.15)', () => {
  it('useFeedback is the feedbackHooks implementation', () => {
    expect(hooks.useFeedback).toBe(useFeedbackFromFeedbackHooks)
  })
})

describe('hooks.ts re-exports the character hooks (mezo-1gim.13)', () => {
  it('every character hook is the characterHooks implementation', () => {
    expect(hooks.useCharacterOverview).toBe(useCharacterOverviewFromCharacterHooks)
    expect(hooks.useCharacterDimension).toBe(useCharacterDimensionFromCharacterHooks)
    expect(hooks.useCharacterFeed).toBe(useCharacterFeedFromCharacterHooks)
    expect(hooks.useCharacterExperts).toBe(useCharacterExpertsFromCharacterHooks)
    expect(hooks.useCharacterConferences).toBe(useCharacterConferencesFromCharacterHooks)
    expect(hooks.useCharacterConference).toBe(useCharacterConferenceFromCharacterHooks)
    expect(hooks.useClaimFeedback).toBe(useClaimFeedbackFromCharacterHooks)
    expect(hooks.useCharacterBootstrap).toBe(useCharacterBootstrapFromCharacterHooks)
    expect(hooks.useCharacterRuns).toBe(useCharacterRunsFromCharacterHooks)
    expect(hooks.useCharacterRun).toBe(useCharacterRunFromCharacterHooks)
  })
})

describe('hooks.ts re-exports the admin hooks (mezo-qw37.3)', () => {
  it('useAdminInvites / useAdminActions are the adminHooks implementations', () => {
    expect(hooks.useAdminInvites).toBe(useAdminInvitesFromAdminHooks)
    expect(hooks.useAdminActions).toBe(useAdminActionsFromAdminHooks)
  })
})
