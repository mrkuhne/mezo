import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { SkillBandCard, type SkillRowVM } from '@/features/me/components/SkillBandCard'

const row = (key: string, level: number, pct = 50): SkillRowVM => ({ key, icon: key.slice(0, 2), name: key, level, progressPct: pct, xp: level * 100 })
const rows = [row('a', 9, 35), row('b', 7), row('c', 5), row('d', 4), row('e', 3), row('f', 2)]

test('renders the preview rows (4) with Lv plaques and animated meters; the rest hidden behind Mind a 6 ▸', async () => {
  const { container } = render(<div className="mz-play"><SkillBandCard eyebrow="Izom" chip="6 izom · legjobb Lv 9" chipTone="warn" wash="amber" rows={rows} /></div>)
  expect(container.querySelectorAll('.gr-skl')).toHaveLength(6)
  expect(container.querySelectorAll('.gr-skl.more')).toHaveLength(2)
  expect(screen.getByText('Lv 9')).toBeInTheDocument()
  expect(container.querySelector('.gr-skl .gr-tbar i')?.getAttribute('style')).toContain('--w: 35%')
  expect(screen.getByRole('button', { name: 'Mind a 6 ▸' })).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(screen.getByRole('button', { name: 'Mind a 6 ▸' }))
  expect(container.querySelector('.gr-band')?.classList.contains('expanded')).toBe(true)
  expect(screen.getByRole('button', { name: 'Kevesebb ▴' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Kevesebb ▴' })).toHaveAttribute('aria-expanded', 'true')
})

test('the perk hint appears only one level before a milestone', () => {
  const { container } = render(<SkillBandCard eyebrow="LIFE" chip="x" chipTone="lav" wash="lav" rows={rows} />)
  const hints = [...container.querySelectorAll('.gr-skl-perk')].map((e) => e.textContent)
  expect(hints).toEqual(['→ perk Lv 10', '→ perk Lv 5'])   // a (9) and d (4)
})

test('no expand button at or under previewRows; footer renders when given', () => {
  render(<SkillBandCard eyebrow="LIFE" chip="x" chipTone="lav" wash="lav" rows={rows.slice(0, 3)} footer={<span>Megtakarítás (30 nap) · <b>50 000 Ft</b></span>} />)
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.getByText('50 000 Ft')).toBeInTheDocument()
})
