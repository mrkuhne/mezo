import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { BadgesCard } from '@/features/me/components/BadgesCard'
import { achievementsMock } from '@/data/progression/achievementsMock'

test('unearned badges carry a conic progress ring (--v = current/target %), earned ones ✓ megvan', () => {
  const { container } = render(<div className="mz-play"><BadgesCard badges={achievementsMock.badges} /></div>)
  expect(container.querySelectorAll('.gr-bdg')).toHaveLength(9)
  expect(container.querySelectorAll('.gr-bdg.done')).toHaveLength(4)
  expect(screen.getAllByText('✓ megvan')).toHaveLength(4)
  const q50 = [...container.querySelectorAll('.gr-bdg:not(.done)')].find((b) => b.textContent?.includes('50 küldetés'))!
  expect(q50.querySelector('.gr-ring')?.getAttribute('style')).toContain('--v: 46')
  expect(q50.textContent).toContain('23 / 50')
  expect(screen.getByText('4 / 9 megszerezve')).toBeInTheDocument()
})
