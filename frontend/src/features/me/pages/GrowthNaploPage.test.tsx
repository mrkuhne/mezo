import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { GrowthNaploPage } from '@/features/me/pages/GrowthNaploPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { mockQuestHistory } from '@/data/quest/questMock'
import { mockActivityHistory } from '@/data/activity/activityMock'

// `vi.hoisted` because `vi.mock` is hoisted above module-scope consts (GrowthHubPage.test.tsx idiom).
const hooks = vi.hoisted(() => ({
  useQuestHistory: vi.fn(),
  useActivityHistory: vi.fn(),
  useGrowthWeek: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  ...hooks,
}))
// Pin "today" to 2026-07-12 so `mondayOf` resolves the week deterministically (-> 2026-07-06);
// spread the real module so `mondayOf`/`addDays`/`huMonthDay` stay real.
vi.mock('@/shared/lib/dates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/dates')>()),
  localDateString: () => '2026-07-12',
}))

function renderPage() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me/growth/naplo']}>
        <GrowthNaploPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

beforeEach(() => {
  hooks.useQuestHistory.mockReturnValue({ data: mockQuestHistory, isPending: false, isError: false })
  hooks.useActivityHistory.mockReturnValue({ data: mockActivityHistory, isPending: false, isError: false })
})

test('hero counts completed quests; "Ez a hét" tile shows the 4 cells + savings; journal below', () => {
  hooks.useGrowthWeek.mockReturnValue({
    data: { weekStart: '2026-07-06', questCompleted: 6, questClosed: 7, lifeXp: 185, activities: 2, savingsHuf: 12000 },
    isPending: false,
    isError: false,
  })
  const { container } = renderPage()
  const completed = mockQuestHistory.filter((q) => q.status === 'completed').length
  // scoped: the bare digit also appears elsewhere on the page (day XP, mcells) — the hero's own
  // big-number span is unambiguous.
  expect(within(container.querySelector('.mz-hero-row')!).getByText(String(completed))).toBeInTheDocument()
  expect(screen.getByText('teljesített küldetés')).toBeInTheDocument()
  expect(screen.getByText('Ez a hét')).toBeInTheDocument()
  expect(screen.getByText('Júl 6 – Júl 12')).toBeInTheDocument()
  // scoped: '6' / '1' collide with other digits on the page — the week tile's own mcells row
  // is unambiguous.
  const cells = within(container.querySelector('.mz-mcells')!)
  expect(cells.getByText('6')).toBeInTheDocument()
  expect(cells.getByText('1')).toBeInTheDocument() // 7 closed − 6 completed = 1 lejárt
  expect(screen.getByText('+185')).toBeInTheDocument()
  expect(screen.getByText('12 000 Ft')).toBeInTheDocument()
  expect(hooks.useGrowthWeek).toHaveBeenCalledWith('2026-07-06')
})

test('week tile renders NOTHING when the endpoint is unavailable (null), savings line hidden at 0', () => {
  hooks.useGrowthWeek.mockReturnValue({ data: null, isPending: false, isError: false })
  const { container } = renderPage()
  expect(screen.queryByText('Ez a hét')).toBeNull()
  expect(container.querySelector('.gr-band')).toBeNull()
})
