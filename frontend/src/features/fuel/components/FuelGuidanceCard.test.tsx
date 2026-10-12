// Kihagyás S3 (mezo-q4xt2.3) — a GUIDANCE-arc (Folyadék F5, mezo-n4wf5.5: prototype vilagos/fuel.js `mai()`
// GUIDANCE branch — the amber hero with the water glass, then section 1 „Most ez segít").
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { FuelGuidanceCard } from '@/features/fuel/components/FuelGuidanceCard'

const SHAME = /elrontott|túlléptél|hiba|rossz|bukta|kudarc/i
const base = { day: 2, waterMl: 1200, waterTargetMl: 2500, eatenKcal: 0, onWater: vi.fn() }

const tipIcons = (c: HTMLElement) => Array.from(c.querySelectorAll('.fa-gtips .fx-tip use')).map(u => u.getAttribute('href'))

test('ILLNESS: label, verdict, lead, water glass, three tips — no stomach chips, ends with the disclaimer', () => {
  const { container } = render(<FuelGuidanceCard category="ILLNESS" {...base} />)
  const hero = screen.getByRole('region', { name: 'Kímélő mód · ma nincs kalóriacél' })
  expect(hero.classList.contains('warn')).toBe(true)
  expect(within(hero).getByText('Kímélő mód · Beteg vagy · 2. nap')).toBeInTheDocument()
  expect(within(hero).getByText('Ma nincs kalóriacél.')).toBeInTheDocument()
  expect(hero.querySelector('.fo-hero-sub')!.textContent).toContain('Pihenj, igyál, és egyél, amikor megy. A számokat most elengedjük.')
  expect(screen.getByRole('heading', { name: /Most ez segít/ })).toBeInTheDocument()
  expect(container.querySelectorAll('.fa-gtips .fx-tip')).toHaveLength(3)
  for (const t of ['Igyál sokat', 'Könnyű, meleg étel', 'Ha megy, egy kis fehérje']) expect(screen.getByText(t)).toBeInTheDocument()
  expect(container.textContent).not.toMatch(/könnyebben mennek le/i)
  expect(tipIcons(container)).toEqual(['#t-water', '#t-tea', '#t-meat'])
  expect(screen.getByText('A kímélő módot a Nap oldalon zárod le. Ez nem orvosi tanács.')).toBeInTheDocument()
  expect(container.textContent).not.toMatch(SHAME)
})

test('STOMACH: the seven easy-food chips, the stomach tips, the skip icon, the doctor link', () => {
  const { container } = render(<FuelGuidanceCard category="STOMACH" {...base} />)
  expect(screen.getByText('Kímélő mód · Gyomorrontás · 2. nap')).toBeInTheDocument()
  expect(screen.getByText('Ezek könnyebben mennek le')).toBeInTheDocument()
  const chips = Array.from(container.querySelectorAll('.fa-easy span')).map(c => c.textContent)
  expect(chips).toEqual(['Banán', 'Főtt rizs', 'Pirítós', 'Főtt krumpli', 'Sós keksz', 'Húsleves', 'Almapüré'])
  expect(screen.getByText('Nem előírás, csak ötlet. Amint jobban vagy, ehetsz rendesen.')).toBeInTheDocument()
  expect(screen.getByText('Kis kortyokban, gyakran')).toBeInTheDocument()
  expect(tipIcons(container)).toEqual(['#t-water', '#t-tea', '#t-skip'])
  expect(screen.getByRole('button', { name: 'Mikor fordulj orvoshoz?' })).toBeInTheDocument()
  expect(container.textContent).toContain('Ez nem orvosi tanács.')
})

test('no calorie target, no ring-of-kcal, no comparison anywhere in the text', () => {
  for (const [cat, kcal] of [['ILLNESS', 0], ['STOMACH', 640]] as const) {
    const { container, unmount } = render(<FuelGuidanceCard category={cat} {...base} eatenKcal={kcal} />)
    expect(container.textContent).not.toMatch(/\d+\s*\/\s*\d+\s*kcal/)
    expect(container.textContent).not.toMatch(/Kihagyom|pótolható|belefér|MÉG BELEFÉR|a keret/i)
    expect(container.querySelector('circle')).toBeNull()
    unmount()
  }
})

test('the total line: plain kcal when something is logged, an invitation at 0', () => {
  const { rerender, container } = render(<FuelGuidanceCard category="ILLNESS" {...base} eatenKcal={0} />)
  expect(container.querySelector('.fo-hero-sub')).toHaveTextContent('Amit megeszel, beírhatod. Nem mérjük semmihez.')
  rerender(<FuelGuidanceCard category="ILLNESS" {...base} eatenKcal={1340} />)
  expect(container.querySelector('.fo-hero-sub')).toHaveTextContent('Ma eddig 1 340 kcal; nem mérjük semmihez.')
  expect(container.querySelector('.fo-hero-sub strong')).toHaveTextContent('1 340 kcal')
})

test('the water glass shows litres and opens the water sheet, and so does „+ Víz"; the doctor link opens the doctor sheet', async () => {
  const onWater = vi.fn()
  render(<FuelGuidanceCard category="ILLNESS" {...base} onWater={onWater} />)
  const water = screen.getByRole('button', { name: 'Víz logolása' })
  expect(water).toHaveTextContent('1,2 / 2,5 l')
  expect(water).toHaveTextContent('folyadék ma')
  // the level is a glass, never a ring
  expect(water.querySelector('.fx-glass')).not.toBeNull()
  await userEvent.click(water)
  expect(onWater).toHaveBeenCalledOnce()
  await userEvent.click(screen.getByRole('button', { name: '+ Víz' }))
  expect(onWater).toHaveBeenCalledTimes(2)
  await userEvent.click(screen.getByRole('button', { name: 'Mikor fordulj orvoshoz?' }))
  const dlg = screen.getByRole('dialog')
  expect(within(dlg).getByRole('heading', { name: 'Mikor fordulj orvoshoz?' })).toBeInTheDocument()
  expect(within(dlg).getAllByRole('listitem')).toHaveLength(4)
})

test('nothing is glass; the day number is optional', () => {
  const { container } = render(<FuelGuidanceCard category="ILLNESS" {...base} day={null} />)
  expect(container.querySelectorAll('.glass')).toHaveLength(0)
  expect(screen.getByText('Kímélő mód · Beteg vagy')).toBeInTheDocument()
})
