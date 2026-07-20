import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { RoutineCard } from '@/features/today/components/RoutineCard'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'

vi.mock('@/shared/lib/daypart', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/daypart')>()),
  daypartNow: vi.fn(() => 'reggel'),
}))
import { daypartNow } from '@/shared/lib/daypart'

function renderCard() {
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter>
          <RoutineCard />
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
}

describe('RoutineCard', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => {
    vi.mocked(daypartNow).mockReturnValue('reggel')
    vi.unstubAllEnvs()
  })

  test('morning daypart renders the morning chain with anchors', () => {
    renderCard()
    expect(screen.getByText('Reggeli rutin')).toBeInTheDocument()
    expect(screen.getByText('Ébredés időben')).toBeInTheDocument()
    expect(screen.getByText('ébredés után')).toBeInTheDocument()
    expect(screen.queryByText('Koffein-cutoff')).not.toBeInTheDocument()
  })

  test('header sums the XP already earned from done habits', () => {
    renderCard()
    // seed: 3 morning habits done (10 + 5 + 10) → 25 XP
    expect(screen.getByText(/3\/6 ma · \+25 XP/)).toBeInTheDocument()
  })

  test('only the current habit carries a prominent action; downstream stays a tappable row', () => {
    renderCard()
    // seed morning: wake/napfény/súlymérés done → Gombakávé is the first pending (nav → Napló)
    const current = screen.getByRole('button', { name: 'Gombakávé logolása' })
    expect(current).toHaveTextContent('Napló')
    // a downstream pending habit is the whole row (no "Napló"/"Pipa" label text on it)
    const downstream = screen.getByRole('button', { name: 'Reggeli edzés logolása' })
    expect(downstream).not.toHaveTextContent('Napló')
  })

  test('evening daypart renders the evening chain', () => {
    vi.mocked(daypartNow).mockReturnValue('este')
    renderCard()
    expect(screen.getByText('Esti rutin')).toBeInTheDocument()
    expect(screen.getByText('Koffein-cutoff')).toBeInTheDocument()
  })

  test('midday renders the compact summary row', () => {
    vi.mocked(daypartNow).mockReturnValue('delutan')
    renderCard()
    expect(screen.getByText(/Reggeli rutin 3\/6/)).toBeInTheDocument()
  })

  test('manual pending habit checks and flips', async () => {
    vi.mocked(daypartNow).mockReturnValue('este')
    renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Wind-down, képernyő le pipálása' }))
    // the row's status mark flips from ◦ to ✓ via the cache patch
    expect((await screen.findAllByText('✓')).length).toBeGreaterThan(0)
  })
})
