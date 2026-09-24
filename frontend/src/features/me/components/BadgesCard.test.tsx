import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { BadgesCard, badgeArt } from '@/features/me/components/BadgesCard'
import { achievementsMock } from '@/data/progression/achievementsMock'

test('unearned badges carry a progress ring (--v = current/target %), earned ones t-tick megvan', () => {
  const { container } = render(<div className="mz-play"><BadgesCard badges={achievementsMock.badges} /></div>)
  expect(container.querySelectorAll('.gr-bdg')).toHaveLength(9)
  expect(container.querySelectorAll('.gr-bdg.done')).toHaveLength(4)
  expect(screen.getAllByText('megvan')).toHaveLength(4)
  expect(container.querySelectorAll('.gr-bdg.done small use[href="#t-tick"]')).toHaveLength(4)
  expect(container.textContent).not.toContain('✓')
  const q50 = [...container.querySelectorAll('.gr-bdg:not(.done)')].find((b) => b.textContent?.includes('50 küldetés'))!
  expect(q50.querySelector('.gr-ring')?.getAttribute('style')).toContain('--v: 46')
  expect(q50.textContent).toContain('23 / 50')
  expect(screen.getByText('4 / 9 megszerezve')).toBeInTheDocument()
  // huInt groups thousands with a regular space (1085 → "1 085"), not toLocaleString's NBSP.
  const lifeXp = [...container.querySelectorAll('.gr-bdg')].find((b) => b.textContent?.includes('10 000 LIFE XP'))!
  expect(lifeXp.textContent).toContain('1 085 / 10 000')
})

test('an unearned badge with target 0 renders --v: 0, never NaN', () => {
  const badges = [{ ...achievementsMock.badges[0], achieved: false, current: 0, target: 0 }]
  const { container } = render(<div className="mz-play"><BadgesCard badges={badges} /></div>)
  expect(container.querySelector('.gr-ring')?.getAttribute('style')).toContain('--v: 0')
})

test('badges wear 3D art, never the backend emoji; an unknown badge falls back to the medal', () => {
  const { container } = render(<BadgesCard badges={achievementsMock.badges} />)
  const art = [...container.querySelectorAll('.gr-bdg .gr-bdg-art use')].map((u) => u.getAttribute('href'))
  expect(art).toEqual(['#t-flag', '#t-scroll', '#t-record', '#t-note', '#t-flame', '#t-gem', '#t-brain', '#t-peak', '#t-coin'])
  expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u)
  expect(badgeArt({ key: 'renamed', icon: '🔥' })).toBe('t-flame')
  expect(badgeArt({ key: 'brand_new', icon: '🦄' })).toBe('t-record')
})
