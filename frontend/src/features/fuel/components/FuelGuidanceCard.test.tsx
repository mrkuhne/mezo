// Kihagyás S3 (mezo-q4xt2.3) — a GUIDANCE-arc (prototype elo/fuel.html `guidance()`).
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { FuelGuidanceCard } from '@/features/fuel/components/FuelGuidanceCard'

const SHAME = /elrontott|túlléptél|hiba|rossz|bukta|kudarc/i
const base = { day: 2, waterMl: 1200, waterTargetMl: 2500, eatenKcal: 0, onWater: vi.fn() }

test('ILLNESS: eyebrow, title, lead, water row, three tips — no stomach chips, ends with the disclaimer', () => {
  const { container } = render(<FuelGuidanceCard category="ILLNESS" {...base} />)
  expect(screen.getByText('KÍMÉLŐ MÓD · BETEG VAGY · 2. NAP')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Ma nincs kalóriacél' })).toBeInTheDocument()
  expect(screen.getByText('Pihenj, igyál, és egyél, amikor megy. A számokat most elengedjük.')).toBeInTheDocument()
  expect(container.querySelectorAll('.fmx-gtip')).toHaveLength(3)
  for (const t of ['Igyál sokat', 'Könnyű, meleg étel', 'Ha megy, egy kis fehérje']) expect(screen.getByText(t)).toBeInTheDocument()
  expect(container.textContent).not.toMatch(/EZEK KÖNNYEBBEN/)
  expect(container.querySelector('.fmx-ghead use')!.getAttribute('href')).toBe('#t-ill')
  const tipIcons = Array.from(container.querySelectorAll('.fmx-gtip use')).map(u => u.getAttribute('href'))
  expect(tipIcons).toEqual(['#t-water', '#t-tea', '#t-meat'])
  expect(container.querySelector('.fmx-gfine')).toHaveTextContent(/^Ez nem orvosi tanács\.$/)
  expect(container.textContent).not.toMatch(SHAME)
})

test('STOMACH: the seven easy-food chips, the stomach tips, the skip icon, the doctor row', () => {
  const { container } = render(<FuelGuidanceCard category="STOMACH" {...base} />)
  expect(screen.getByText('KÍMÉLŐ MÓD · GYOMORRONTÁS · 2. NAP')).toBeInTheDocument()
  expect(screen.getByText('EZEK KÖNNYEBBEN MENNEK LE')).toBeInTheDocument()
  const chips = Array.from(container.querySelectorAll('.fmx-gchips span')).map(c => c.textContent)
  expect(chips).toEqual(['Banán', 'Főtt rizs', 'Pirítós', 'Főtt krumpli', 'Sós keksz', 'Húsleves', 'Almapüré'])
  expect(screen.getByText('Nem előírás, csak ötlet. Amint jobban vagy, ehetsz rendesen.')).toBeInTheDocument()
  expect(screen.getByText('Kis kortyokban, gyakran')).toBeInTheDocument()
  expect(Array.from(container.querySelectorAll('.fmx-gtip use')).map(u => u.getAttribute('href'))).toEqual(['#t-water', '#t-tea', '#t-skip'])
  expect(container.querySelector('.fmx-ghead use')!.getAttribute('href')).toBe('#t-digestion')
  expect(screen.getByRole('button', { name: /Mikor fordulj orvoshoz/ })).toBeInTheDocument()
  expect(container.querySelector('.fmx-gfine')).toHaveTextContent('Ez nem orvosi tanács.')
})

test('no calorie target, no ring-of-kcal, no comparison anywhere in the text', () => {
  for (const [cat, kcal] of [['ILLNESS', 0], ['STOMACH', 640]] as const) {
    const { container, unmount } = render(<FuelGuidanceCard category={cat} {...base} eatenKcal={kcal} />)
    expect(container.textContent).not.toMatch(/\d+\s*\/\s*\d+\s*kcal/)
    expect(container.textContent).not.toMatch(/Kihagyom|pótolható|belefér|MÉG BELEFÉR|a keret/i)
    unmount()
  }
})

test('the total line: plain kcal when something is logged, an invitation at 0', () => {
  const { rerender, container } = render(<FuelGuidanceCard category="ILLNESS" {...base} eatenKcal={0} />)
  expect(container.querySelector('.fmx-gtotal')).toHaveTextContent('Amit megeszel, beírhatod. Nem mérjük semmihez.')
  rerender(<FuelGuidanceCard category="ILLNESS" {...base} eatenKcal={1340} />)
  expect(container.querySelector('.fmx-gtotal')).toHaveTextContent('Ma eddig 1 340 kcal · nem mérjük semmihez')
})

test('the water row shows litres and opens the water sheet; the doctor row opens the doctor sheet', async () => {
  const onWater = vi.fn()
  render(<FuelGuidanceCard category="ILLNESS" {...base} onWater={onWater} />)
  const water = screen.getByRole('button', { name: 'Víz logolása' })
  expect(water).toHaveTextContent('1,2 l')
  expect(water).toHaveTextContent('/ 2,5 l folyadék ma')
  expect(water).toHaveTextContent('＋ Víz')
  await userEvent.click(water)
  expect(onWater).toHaveBeenCalledOnce()
  await userEvent.click(screen.getByRole('button', { name: /Mikor fordulj orvoshoz/ }))
  const dlg = screen.getByRole('heading', { name: 'Mikor fordulj orvoshoz?' })
  expect(within(dlg.closest('.uvl-body') as HTMLElement).getAllByRole('listitem')).toHaveLength(4)
})

test('is one glass; nothing inside is glass; the day number is optional', () => {
  const { container } = render(<FuelGuidanceCard category="ILLNESS" {...base} day={null} />)
  expect(container.querySelectorAll('.glass')).toHaveLength(1)
  expect(container.querySelector('.fmx-gcard')!.classList.contains('glass')).toBe(true)
  expect(screen.getByText('KÍMÉLŐ MÓD · BETEG VAGY')).toBeInTheDocument()
})
