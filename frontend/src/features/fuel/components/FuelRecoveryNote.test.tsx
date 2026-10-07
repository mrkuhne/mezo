// Kihagyás S3 (mezo-q4xt2.3) — a kímélő nap sávja és jegyzete (prototype elo/fuel.html `kmStrip`/`kmNote`).
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { FuelRecoveryNote, FuelRecoveryStrip } from '@/features/fuel/components/FuelRecoveryNote'

const SHAME = /elrontott|túlléptél|hiba|rossz|bukta|kudarc/i

test('the strip names the category and the day, wears t-kimelo and is a button', async () => {
  const onTap = vi.fn()
  const { container } = render(<FuelRecoveryStrip category="INJURY" day={3} onTap={onTap} />)
  const strip = screen.getByRole('button', { name: /Kímélő mód, Sérülés, 3\. nap/ })
  expect(strip).toHaveTextContent('Kímélő mód · Sérülés · 3. nap')
  expect(container.querySelector('use')!.getAttribute('href')).toBe('#t-kimelo')
  await userEvent.click(strip)
  expect(onTap).toHaveBeenCalledOnce()
})

test('the strip reads „Úton vagy" for travel and survives a missing day', () => {
  render(<FuelRecoveryStrip category="TRAVEL" day={null} onTap={vi.fn()} />)
  expect(screen.getByRole('button')).toHaveTextContent('Kímélő mód · Úton vagy')
})

test('MAINTENANCE note: the injury copy ends with the disclaimer', () => {
  const { container } = render(<FuelRecoveryNote mode="MAINTENANCE" />)
  expect(screen.getByText('Sérülés alatt nem fogyókúrázunk')).toBeInTheDocument()
  expect(container.textContent).toContain('A hiányt kikapcsoltam: szinten tartó keretet látsz. A fehérje most a legfontosabb, abból épül vissza a szövet.')
  expect(container.querySelector('em')).toHaveTextContent('Ez nem orvosi tanács.')
  expect(container.querySelector('use')!.getAttribute('href')).toBe('#t-pain')
})

test('ESTIMATE note: travel copy, no disclaimer needed', () => {
  const { container } = render(<FuelRecoveryNote mode="ESTIMATE" />)
  expect(screen.getByText('Úton vagy, becsülj nyugodtan')).toBeInTheDocument()
  expect(container.textContent).toContain('Elég nagyjából beírni, a keret most csak tájékoztat. Ha egy dologra figyelsz, a fehérje legyen.')
  expect(container.querySelector('use')!.getAttribute('href')).toBe('#t-travel')
})

test('no shame vocabulary, nothing glass', () => {
  for (const ui of [<FuelRecoveryNote key="a" mode="MAINTENANCE" />, <FuelRecoveryNote key="b" mode="ESTIMATE" />, <FuelRecoveryStrip key="c" category="STOMACH" day={1} onTap={vi.fn()} />]) {
    const { container, unmount } = render(ui)
    expect(container.textContent).not.toMatch(SHAME)
    expect(container.querySelector('.glass')).toBeNull()
    unmount()
  }
})
