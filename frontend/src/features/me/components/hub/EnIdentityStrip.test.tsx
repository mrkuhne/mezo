import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EnIdentityStrip } from './EnIdentityStrip'
import { renderUnit } from './hubTestKit'

// The identity strip (mezo-lhqw7): a thin FLAT row — the whole strip is one door to Fejlődés.
const store = vi.hoisted(() => ({
  name: 'Daniel' as string | null,
  titleEquipped: true,
  streakAlive: true as boolean | undefined,
  pending: false,
  error: false,
  level: 12, totalXp: 3140, coins: 240, streakDays: 6,
}))

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useProfile: () => ({ user: store.name == null ? null : { name: store.name } }),
    useGamification: () => ({
      isPending: store.pending, isError: store.error,
      profile: { level: store.level, totalXp: store.totalXp, xpInLevel: 60, xpForNext: 520, coins: store.coins, streakDays: store.streakDays, streakAlive: store.streakAlive },
    }),
    useTitles: () => ({ titles: [{ key: 'a', name: 'A kitartó', equipped: store.titleEquipped }, { key: 'b', name: 'Másik', equipped: false }] }),
  }
})

beforeEach(() => { store.name = 'Daniel'; store.titleEquipped = true; store.streakAlive = true; store.pending = false
  Object.assign(store, { error: false, level: 12, totalXp: 3140, coins: 240, streakDays: 6 })
})

test('the strip carries the monogram, name, title chip and Lv · XP · streak · coin, and opens Fejlődés', async () => {
  renderUnit(<EnIdentityStrip />)
  const strip = screen.getByRole('button', { name: 'Daniel · Fejlődés' })
  expect(strip).toHaveClass('enh-idstrip')
  expect(strip).not.toHaveClass('glass') // flat, never glass
  expect(strip).toHaveAttribute('data-kalauz-anchor', 'me-idhero')
  expect(strip.querySelector('.enh-idmono')).toHaveTextContent('D')
  expect(strip).toHaveTextContent('A kitartó')
  expect(strip).toHaveTextContent('Lv 12')
  expect(strip).toHaveTextContent('3 140 XP')
  expect(strip).toHaveTextContent('6 nap')
  expect(strip).toHaveTextContent('240')
  const hrefs = [...strip.querySelectorAll('use')].map((u) => u.getAttribute('href'))
  expect(hrefs).toEqual(['#t-record', '#t-bolt', '#t-coin'])
  await userEvent.click(strip)
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/growth')
})

test('no title chip when nothing is equipped', () => {
  store.titleEquipped = false
  renderUnit(<EnIdentityStrip />)
  expect(document.querySelector('.enh-idtitle')).toBeNull()
  expect(screen.queryByText('A kitartó')).toBeNull()
})

test('a broken streak is dimmed, not hidden', () => {
  store.streakAlive = false
  renderUnit(<EnIdentityStrip />)
  expect(document.querySelector<HTMLElement>('.enh-idstreak')!.style.opacity).toBe('0.45')
})

test('an unresolved profile shows no fabricated Lv / XP / coin numbers', () => {
  store.pending = true
  store.name = null
  renderUnit(<EnIdentityStrip />)
  const strip = screen.getByRole('button', { name: 'Fejlődés' })
  expect(strip.querySelector('.enh-idln')).toBeNull()
  expect(strip).not.toHaveTextContent('XP')
})

// final review: a failed (non-404) read leaves the ghost profile in `data` — it is not shown
test('a failed progression read hides the level / XP / streak / coin line; the name stays and the strip still navigates', async () => {
  Object.assign(store, { error: true, level: 1, totalXp: 0, coins: 0, streakDays: 0 })
  renderUnit(<EnIdentityStrip />)
  const strip = screen.getByRole('button', { name: 'Daniel · Fejlődés' })
  expect(strip.querySelector('.enh-idln')).toBeNull()
  expect(strip).not.toHaveTextContent(/Lv|XP|0 nap/)
  expect(strip.querySelector('.enh-idnm')).toHaveTextContent('Daniel')
  await userEvent.click(strip)
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/growth')
})
