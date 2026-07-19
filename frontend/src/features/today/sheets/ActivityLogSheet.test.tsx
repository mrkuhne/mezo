import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { makeHookWrapper } from '@/test/queryWrapper'
import type { ActivityWriteResult } from '@/data/activity/activityApi'
import type { ActivityEntry, DailyQuest } from '@/data/types'

const acts = vi.hoisted(() => ({ useActivityActions: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useActivityActions: acts.useActivityActions,
}))

function entry(over: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: 'act-new', occurredOn: '2026-07-11', text: 'Olvastam 30 percet',
    skillKey: 'learning', confidence: 0.9, xpAwarded: 15,
    durationMin: null, amountHuf: null, categorizedBy: 'AI', ...over,
  }
}
function result(over: Partial<ActivityWriteResult> = {}): ActivityWriteResult {
  return { entry: entry(), completedQuest: null, levelUps: [], ...over }
}

const quest: DailyQuest = {
  id: 'dq3g', questDate: '2026-07-11', slot: 'GROWTH', skillKey: 'learning',
  title: 'Olvass ma legalább 10 percet', why: 'Aki naponta olvas, az olvasó ember.',
  targetLabel: 'Tevékenységnapló-bejegyzés ma', metric: 'activity_match', xp: 20, status: 'offered',
  completionMode: 'ACTIVITY',
}

function renderSheet(props: Partial<Parameters<typeof ActivityLogSheet>[0]> = {}) {
  const Wrapper = makeHookWrapper()
  return render(
    <Wrapper>
      <LevelUpProvider>
        <ActivityLogSheet onClose={() => {}} {...props} />
      </LevelUpProvider>
    </Wrapper>,
  )
}

describe('ActivityLogSheet', () => {
  const logActivity = vi.fn()
  const categorize = vi.fn()
  beforeEach(() => {
    acts.useActivityActions.mockReturnValue({ logActivity, categorize, pending: false })
  })
  afterEach(() => vi.clearAllMocks())

  test('(a) compose → submit calls logActivity and shows the returned category + XP', async () => {
    logActivity.mockResolvedValue(result())
    renderSheet()
    fireEvent.change(screen.getByPlaceholderText(/Olvastam 30 percet/), { target: { value: 'Olvastam 30 percet' } })
    fireEvent.click(screen.getByRole('button', { name: 'Naplózom' }))
    await waitFor(() => expect(logActivity).toHaveBeenCalledWith('Olvastam 30 percet'))
    expect(await screen.findByText('📚 Tanulás')).toBeInTheDocument()
    expect(screen.getByText('+15 XP')).toBeInTheDocument()
  })

  test('(b) low-confidence result switches to the picker and categorize fires with the picked key', async () => {
    logActivity.mockResolvedValue(result({ entry: entry({ skillKey: null, xpAwarded: 0, categorizedBy: null }) }))
    categorize.mockResolvedValue(result({ entry: entry({ skillKey: 'cooking', xpAwarded: 10, categorizedBy: 'USER' }) }))
    renderSheet()
    fireEvent.change(screen.getByPlaceholderText(/Olvastam 30 percet/), { target: { value: 'Rendet raktam' } })
    fireEvent.click(screen.getByRole('button', { name: 'Naplózom' }))
    expect(await screen.findByText('Nem egyértelmű — melyik skillhez tartozik?')).toBeInTheDocument()
    // all 8 LIFE skill chips are offered
    for (const s of LIFE_SKILLS) expect(screen.getByText(`${s.icon} ${s.name}`)).toBeInTheDocument()
    fireEvent.click(screen.getByText('🍳 Konyha'))
    await waitFor(() => expect(categorize).toHaveBeenCalledWith('act-new', 'cooking'))
    expect(await screen.findByText('🍳 Konyha')).toBeInTheDocument()
  })

  test('(c) quest prop renders the quest banner', () => {
    renderSheet({ quest })
    expect(screen.getByText('Olvass ma legalább 10 percet')).toBeInTheDocument()
    expect(screen.getByText('+20 XP a teljesítésért')).toBeInTheDocument()
  })

  test('(d) a completed quest in the result renders the "Küldetés teljesítve" row', async () => {
    logActivity.mockResolvedValue(result({ completedQuest: { ...quest, status: 'completed' } }))
    renderSheet({ quest })
    fireEvent.change(screen.getByPlaceholderText(/Olvastam 30 percet/), { target: { value: 'Olvastam 30 percet' } })
    fireEvent.click(screen.getByRole('button', { name: 'Naplózom' }))
    expect(await screen.findByText(/Küldetés teljesítve: Olvass ma legalább 10 percet \(\+20 XP\)/)).toBeInTheDocument()
  })

  test('entry prop starts the sheet in the picker phase', () => {
    renderSheet({ entry: entry({ id: 'act3', text: 'Rendet raktam a garázsban', skillKey: null, xpAwarded: 0, categorizedBy: null }) })
    expect(screen.getByText('Nem egyértelmű — melyik skillhez tartozik?')).toBeInTheDocument()
    expect(screen.getByText(/Rendet raktam a garázsban/)).toBeInTheDocument()
  })
})
