// ============================================================
// Mezo · TodayPage nudge-thread coverage (mezo-dhzk Task 5). Verifies the wiring, not the
// simulation: `@/features/today/logic/useNeeds` is module-mocked (hoisted, mirrors the
// `@/data/hooks` idiom `TodayPage.dispatch.test.tsx` uses) so a SINGLE ring's band is under
// direct control — the decay/refill sim itself is Task 1-4's own coverage. Everything else on
// the page renders against the real mock hooks, exactly like `TodayPage.test.tsx`.
// Separate file for the same reason `TodayPage.dispatch.test.tsx` is separate: a different
// hook gets module-mocked here.
// ============================================================
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TodayPage } from '@/features/today/pages/TodayPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { NUDGE_COPY } from '@/features/today/logic/needsNudges'
import { NEED_META, type NeedBand, type NeedKey, type NeedState } from '@/features/today/logic/needs'

const mocks = vi.hoisted(() => ({ useNeeds: vi.fn() }))
vi.mock('@/features/today/logic/useNeeds', () => ({ useNeeds: mocks.useNeeds }))

const ALL_KEYS: NeedKey[] = ['energia', 'hidratacio', 'pihenes', 'mozgas', 'lelek', 'rend']

/** A minimal, otherwise-irrelevant NeedState — only `key`/`band` matter to the nudge wiring. */
const state = (key: NeedKey, band: NeedBand, pct = 80): NeedState => ({
  key, band, pct,
  emoji: NEED_META[key].emoji, label: NEED_META[key].label, color: NEED_META[key].color,
  ratePerHour: 5, zeroAt: null, lastFill: null, todayFills: [],
})

const allGreen = (): NeedState[] => ALL_KEYS.map((k) => state(k, 'green'))
const withHidratacioRed = (): NeedState[] =>
  ALL_KEYS.map((k) => (k === 'hidratacio' ? state('hidratacio', 'red', 20) : state(k, 'green')))

function tree() {
  return (
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={['/today']}>
          <TodayPage />
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>
  )
}

/** The chip's total-messages count — MezoChip's aria-label carries it (`, N üzenet`). */
const chipCount = (): number => {
  const label = screen.getByRole('button', { name: /Mezo üzenetei/ }).getAttribute('aria-label') ?? ''
  const m = label.match(/(\d+) üzenet/)
  if (!m) throw new Error(`no count in aria-label: ${label}`)
  return Number(m[1])
}

beforeEach(() => {
  localStorage.clear()
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date(2026, 4, 21, 16, 0))
})
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); vi.clearAllMocks() })

describe('TodayPage — küszöb-nudge-ok a mezo-szálban (mezo-dhzk Task 5)', () => {
  test('egy pirosba forduló ring +1-gyel növeli a chip üzenetszámát, és a sheet mutatja a bubble-t', () => {
    mocks.useNeeds.mockReturnValue({ states: allGreen(), isPending: false })
    const { rerender } = render(tree())
    const baseline = chipCount()

    mocks.useNeeds.mockReturnValue({ states: withHidratacioRed(), isPending: false })
    rerender(tree())
    expect(chipCount()).toBe(baseline + 1)

    fireEvent.click(screen.getByRole('button', { name: /Mezo üzenetei/ }))
    const sheet = screen.getByRole('dialog', { name: 'Mezo üzenetei' })
    expect(within(sheet).getByText(NUDGE_COPY.hidratacio)).toBeInTheDocument()
    expect(within(sheet).getByText('Életjel-figyelő')).toBeInTheDocument()
  })

  test('újrarenderelve ugyanaz a piros ring nem duplikálja a nudge-ot', () => {
    mocks.useNeeds.mockReturnValue({ states: allGreen(), isPending: false })
    const { rerender } = render(tree())
    const baseline = chipCount()

    mocks.useNeeds.mockReturnValue({ states: withHidratacioRed(), isPending: false })
    rerender(tree())
    expect(chipCount()).toBe(baseline + 1)

    rerender(tree())
    rerender(tree())
    expect(chipCount()).toBe(baseline + 1)
  })
})
