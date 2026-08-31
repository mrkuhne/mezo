import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'
import { makeHookWrapper } from '@/test/queryWrapper'
import type { ActivityWriteResult } from '@/data/activity/activityApi'
import type { ActivityEntry, DailyQuest } from '@/data/types'
import type { LevelUpResult } from '@/data/train/trainApi'

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
    expect(await screen.findByText('Tanulás')).toBeInTheDocument()
    expect(screen.getByText('+15 XP')).toBeInTheDocument()
  })

  test('(b) low-confidence result switches to the picker and categorize fires with the picked key', async () => {
    logActivity.mockResolvedValue(result({ entry: entry({ skillKey: null, xpAwarded: 0, categorizedBy: null }) }))
    categorize.mockResolvedValue(result({ entry: entry({ skillKey: 'cooking', xpAwarded: 10, categorizedBy: 'USER' }) }))
    renderSheet()
    fireEvent.change(screen.getByPlaceholderText(/Olvastam 30 percet/), { target: { value: 'Rendet raktam' } })
    fireEvent.click(screen.getByRole('button', { name: 'Naplózom' }))
    expect(await screen.findByText('Nem egyértelmű — melyik skillhez tartozik?')).toBeInTheDocument()
    // all 8 LIFE skill chips are offered (F7.4: clay symbol + name, no emoji)
    for (const s of LIFE_SKILLS) expect(screen.getByRole('button', { name: s.name })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Konyha' }))
    await waitFor(() => expect(categorize).toHaveBeenCalledWith('act-new', 'cooking'))
    // Deflake (PR #338: 3× CI-only, mode-flipping): the pick → done re-render can outrun
    // findByText's 1s default on a saturated runner — wait the picker out, then find the
    // done card, both on generous budgets.
    await waitFor(
      () => expect(screen.queryByText('Nem egyértelmű — melyik skillhez tartozik?')).not.toBeInTheDocument(),
      { timeout: 15000 },
    )
    expect(await screen.findByText('Konyha', undefined, { timeout: 15000 })).toBeInTheDocument()
  }, 40000)

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

  test('a successful log with a level-up payload emits a reward toast (eyebrow "Naplózva")', async () => {
    const levelUp: LevelUpResult = {
      source: 'ACTIVITY', workoutLabel: 'Olvastam', durationMin: undefined, rpe: undefined, totalXp: 15,
      gains: [], levelUps: [], perks: [], robustness: { xpGained: 0, streakWeeks: 0 },
    }
    logActivity.mockResolvedValue(result({ levelUps: [levelUp] }))
    const seen: ToastMessage[] = []
    const off = onToast((t) => seen.push(t))
    renderSheet()
    fireEvent.change(screen.getByPlaceholderText(/Olvastam 30 percet/), { target: { value: 'Olvastam 30 percet' } })
    fireEvent.click(screen.getByRole('button', { name: 'Naplózom' }))
    await waitFor(() => expect(seen.some((t) => t.kind === 'reward')).toBe(true))
    off()

    const reward = seen.find((t) => t.kind === 'reward')
    expect((reward as { eyebrow: string }).eyebrow).toBe('Naplózva')
  })

  test('entry prop starts the sheet in the picker phase', () => {
    renderSheet({ entry: entry({ id: 'act3', text: 'Rendet raktam a garázsban', skillKey: null, xpAwarded: 0, categorizedBy: null }) })
    expect(screen.getByText('Nem egyértelmű — melyik skillhez tartozik?')).toBeInTheDocument()
    expect(screen.getByText(/Rendet raktam a garázsban/)).toBeInTheDocument()
  })
})
