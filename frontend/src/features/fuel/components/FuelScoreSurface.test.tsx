// ============================================================
// Mezo · FuelScoreSurface (Folyadék F5, mezo-n4wf5.5) — az étkezés ÉS a recept értékelő oldalának EGY felülete.
// Amit ezek a körök őriznek: nyolc szempont fiolában, a kimaradt szempont „még tanulom" (nem nulla), a javaslat hatása a
// tízes skálán ugyanabból a számból, mint a régi pont (bible F4.8), „megbízhatóság" az egy szó, és a szerver szövegei úgy
// jelennek meg, ahogy érkeznek.
// ============================================================
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { MealBreakdown, MealDimension } from '@/data/types'
import { FuelScoreSurface } from '@/features/fuel/components/FuelScoreSurface'
import { impactPoints } from '@/features/fuel/logic/formatImpact'

const base = { color: '', coverage: 1 }
const DIMS: MealDimension[] = [
  { ...base, id: 'macro', label: 'Kcal és makróarány', weight: 0.22, score: 0.86, detail: 'Az energia **31%** fehérje.',
    macroRatio: { p: 31, c: 46, f: 23 }, macroTargets: { p: '25%', c: '55%', f: '20%' }, kcalShareOfDay: 24.5, targetOrigin: 'a napi célodból', notes: 'A zsír a sáv fölött van.' },
  { ...base, id: 'micro', label: 'Rost és mikro', weight: 0.1, score: 0.76, detail: '7 g rost.',
    micros: [{ name: 'Rost', value: '7 g', pct: 86, status: 'good' }, { name: 'Magnézium', value: '48 mg', pct: 32, status: 'low' }] },
  { ...base, id: 'who', label: 'Ajánlások · WHO', weight: 0.14, score: 0.83, detail: 'Cukor a határ alatt.', context: [{ label: 'Cukor', value: '24 g' }] },
  { ...base, id: 'fat_quality', label: 'Zsírminőség', weight: 0.1, score: 0.84, detail: '', context: [{ label: 'Telített zsír', value: '6,2 g' }] },
  { ...base, id: 'nova', label: 'Feldolgozottság', weight: 0.18, score: 0.52, detail: 'Egy ultra-feldolgozott tétel.', note: 'A whey itt nem gyengeség.',
    nova: { dominant: 1, stack: [{ nova: 1, pct: 71, label: 'zab, banán' }, { nova: 4, pct: 29, label: 'whey' }, { nova: 2, pct: 0, label: '—' }],
      items: [{ name: 'Zabpehely 60g', nova: 1 }, { name: 'Whey 30g', nova: 4, warning: true }] } },
  { ...base, id: 'plant_diversity', label: 'Növényi változatosság', weight: 0.08, score: 0.82, detail: '', context: [{ label: 'Növényi kategória', value: '2 / 3' }] },
  // adat nélkül: súly 0, payload nélkül
  { ...base, id: 'energy_density', label: 'Energiasűrűség', weight: 0, score: 0, detail: '', coverage: 0 },
  { ...base, id: 'context', label: 'Időzítés és kontextus', weight: 0.12, score: 0.91, detail: '07:20-kor logoltad.',
    context: [{ label: 'Szerep', value: 'Pre-workout' }, { label: 'Ablak', value: '07:00–10:00' }],
    timing: { eatenAt: '07:20', windowFrom: '07:00', windowTo: '10:00', slotLabel: 'reggeli' } },
] as MealDimension[]

const BREAKDOWN: MealBreakdown = {
  confidence: 0.98, summary: null, tagline: null, tools: [], dimensions: DIMS,
  improve: [{ text: 'Egy marék dió a tetejére.', impact: '+0.02 score' }, { text: 'A méz fele is elég.', impact: '+0.036 score' }, { text: 'Tökmag mellé.', impact: 'Mg 32% → 48%' }],
}

function mount(over: Partial<React.ComponentProps<typeof FuelScoreSurface>> = {}) {
  const onDetail = vi.fn()
  const utils = render(
    <FuelScoreSurface breakdown={BREAKDOWN} scorePct={84} label="Reggeli · 07:20" tagline="Fehérjében erős, tiszta tányér"
      summary="A fehérje viszi." improve={BREAKDOWN.improve} detail={{ label: 'Az étkezés részletei', onClick: onDetail }}
      feedback={<div>VISSZAJELZÉS</div>} note="JEGYZET" {...over} />,
  )
  return { ...utils, onDetail }
}

test('a hős: felirat, pont a tízes skálán, megbízhatóság, a címsor mint ítélet, az olvasat és a gomb', async () => {
  const { container, onDetail } = mount()
  const hero = container.querySelector('.fo-hero') as HTMLElement
  expect(hero.querySelector('.fo-hero-lbl')).toHaveTextContent('Reggeli · 07:20')
  expect(within(hero).getByRole('img', { name: 'Mezo értékelése: 8,4 a tízes skálán' })).toHaveTextContent('8,4')
  expect(hero.querySelector('.fe-sc')).toHaveTextContent('megbízhatóság 98%')
  expect(hero.querySelector('.fo-hero-verdict')).toHaveTextContent(/^Fehérjében erős, tiszta tányér\.$/)
  expect(hero.querySelector('.fo-hero-sub')).toHaveTextContent('A fehérje viszi.')
  expect(hero.textContent).not.toContain('/10')
  await userEvent.click(within(hero).getByRole('button', { name: 'Az étkezés részletei' }))
  expect(onDetail).toHaveBeenCalledTimes(1)
})

test('címsor nélkül a hős a pontot mondja ki; amíg az olvasat készül, azt', () => {
  const { container } = mount({ tagline: null, summary: null, coachPending: true, feedback: null })
  expect(container.querySelector('.fo-hero-verdict')).toHaveTextContent('Mezo értékelése: 8,4.')
  expect(container.querySelector('.fo-hero-sub')).toHaveTextContent('Mezo olvasata készül…')
  // visszajelzés nélkül nincs „Hasznos volt?" fejléc, a jegyzet megmarad
  expect(screen.queryByRole('heading', { name: /Hasznos volt/ })).not.toBeInTheDocument()
  expect(container.querySelector('.fe-fbc')).toHaveTextContent('JEGYZET')
})

test('nyolc szempont, négy fiola egy sorban; a kimaradt „még tanulom", a leggyengébb borostyán', () => {
  const { container } = mount()
  const rows = container.querySelectorAll('.fe-8 > .fo-vials')
  expect(rows).toHaveLength(2)
  expect(Array.from(rows).map(r => r.querySelectorAll('.fo-vial').length)).toEqual([4, 4])
  const vials = Array.from(container.querySelectorAll('.fe-8 .fo-vial')) as HTMLElement[]
  expect(vials.map(v => v.querySelector('small')!.firstChild!.textContent)).toEqual(
    ['Makró', 'Mikro', 'WHO', 'Zsír', 'Feldolg.', 'Növény', 'Sűrűség', 'Időzítés'])
  expect(vials.map(v => v.querySelector(':scope > b')!.textContent)).toEqual(['8,6', '7,6', '8,3', '8,4', '5,2', '8,2', '—', '9,1'])
  expect(vials.map(v => v.querySelector('small i')!.textContent)).toEqual(
    ['súly 22%', 'súly 10%', 'súly 14%', 'súly 10%', 'leggyengébb', 'súly 8%', 'még tanulom', 'legerősebb'])
  expect(vials[4].style.getPropertyValue('--c')).toBe('var(--fo-warn)')
  expect(vials[6].style.getPropertyValue('--c')).toBe('var(--fo-faint)')
  // a kimaradt szempont nem nulla pont
  expect(vials[6]).not.toHaveTextContent('0')
  expect(vials[6]).toHaveAccessibleName('Energiasűrűség: kimaradt, kevés adat, részletek')
  expect(vials[0]).toHaveAccessibleName('Kcal és makróarány: 8,6, részletek')
})

test('„Miből áll össze?": szempontonként egy sor a szerver nevével és magyarázatával', () => {
  const { container } = mount()
  expect(screen.getByRole('heading', { name: /Miből áll össze\?/ })).toBeInTheDocument()
  const rows = Array.from(container.querySelectorAll('.fe-dims .fx-it')) as HTMLElement[]
  expect(rows).toHaveLength(8)
  expect(rows[0]).toHaveTextContent('Kcal és makróarány')
  expect(rows[0].querySelector('strong, b')).not.toBeNull()
  expect(rows[0]).toHaveTextContent('Az energia 31% fehérje.')
  expect(rows[0]).toHaveTextContent('súly 22%')
  expect(rows[4]).toHaveTextContent('súly 18% · leggyengébb')
  expect(rows[6]).toHaveTextContent('Ehhez nem volt elég adat, ezért ez a szempont kimaradt.')
  expect(rows[6]).toHaveTextContent('még tanulom · kevés adat')
  expect(container.querySelector('.fe-dims')).toHaveTextContent('Koppints egy sorra a részletekért.')
})

test('„Ha feljebb vinnéd": a hatás a tízes skálán, EGY számból, EGY kerekítéssel; a szabad szöveg érintetlen', () => {
  const { container } = mount()
  const shown = Array.from(container.querySelectorAll('.fe-impc .fe-imp')).map(e => e.textContent)
  expect(shown).toEqual(['+0,2', '+0,4', 'Mg 32% → 48%'])
  // ugyanaz a szám, amit a régi lap pontként írt ki (2 és 4 pont) — tizedelve
  expect(BREAKDOWN.improve.slice(0, 2).map(i => impactPoints(i.impact)! / 10)).toEqual([0.2, 0.4])
  expect(container.textContent).not.toMatch(/\d pont\b/)
})

test('a visszajelzés és a jegyzet a „Hasznos volt?" kártyán áll', () => {
  const { container } = mount()
  expect(screen.getByRole('heading', { name: /Hasznos volt\?/ })).toHaveTextContent('3')
  expect(container.querySelector('.fe-fbc')).toHaveTextContent('VISSZAJELZÉSJEGYZET')
})

test('egy szempont lapja: a pont a cím, a név a lap neve; súly, lefedettség, a szerver magyarázata és a tényei', async () => {
  const { container } = mount()
  await userEvent.click(within(container.querySelector('.fe-dims') as HTMLElement).getByRole('button', { name: /Kcal és makróarány/ }))
  const box = screen.getByRole('dialog')
  expect(box).toHaveAccessibleName('Kcal és makróarány')
  expect(within(box).getByRole('heading', { level: 2 })).toHaveTextContent('8,6')
  expect(within(box).getByText('súly 22%')).toBeInTheDocument()
  expect(within(box).getByText('lefedettség 100%')).toBeInTheDocument()
  expect(within(box).getByRole('img', { name: 'Kcal és makróarány: 8,6 a tízes skálán' })).toBeInTheDocument()
  expect(within(box).getByText('31% · cél 25%')).toBeInTheDocument()
  expect(within(box).getByText('46% · cél 55%')).toBeInTheDocument()
  expect(within(box).getByText('Az étel makró-felépítése · a napi keret 24,5%-a')).toBeInTheDocument()
  expect(within(box).getByText('A zsír a sáv fölött van.')).toBeInTheDocument()
  // „Honnan a cél" nincs a jóváhagyott lapon
  expect(box.textContent).not.toMatch(/Honnan a cél|a napi célodból/)
})

test('a NOVA lap: egy edény a csoportokkal, a tételek a csoportjuk nevével; Mezo jegyzete alatta', async () => {
  const { container } = mount()
  await userEvent.click(within(container.querySelector('.fe-dims') as HTMLElement).getByRole('button', { name: /Feldolgozottság/ }))
  const box = screen.getByRole('dialog')
  expect(box.querySelectorAll('.fx-split > i')).toHaveLength(2)
  expect(within(box).getByText('NOVA 1 · zab, banán')).toBeInTheDocument()
  expect(within(box).getByText('Whey 30g').closest('li')).toHaveTextContent('Ultra-feldolgozott')
  expect(within(box).getByText('Whey 30g').closest('li')).toHaveTextContent('figyeld')
  expect(within(box).getByText('Mezo jegyzete')).toBeInTheDocument()
  expect(within(box).getByText('A whey itt nem gyengeség.')).toBeInTheDocument()
})

test('a kimaradt szempont lapja őszinte: nincs pont, nincs panel', async () => {
  const { container } = mount()
  await userEvent.click(within(container.querySelector('.fe-dims') as HTMLElement).getByRole('button', { name: /Energiasűrűség/ }))
  const box = screen.getByRole('dialog')
  expect(within(box).getByRole('heading', { level: 2 })).toHaveTextContent('—')
  expect(within(box).getByText('súly 0%')).toBeInTheDocument()
  expect(within(box).getByRole('img', { name: 'Energiasűrűség: nincs pontszám' })).toBeInTheDocument()
  expect(within(box).getByText('Őszintén')).toBeInTheDocument()
  expect(within(box).getByText(/Nem találgatunk\./)).toBeInTheDocument()
  expect(box.querySelector('.fe-panel')).toBeNull()
})

test('az időzítés lapja: a nap tengelye és a szerver tény-sorai', async () => {
  const { container } = mount()
  await userEvent.click(within(container.querySelector('.fe-dims') as HTMLElement).getByRole('button', { name: /Időzítés és kontextus/ }))
  const box = screen.getByRole('dialog')
  expect(box.querySelector('.fe-tl')).not.toBeNull()
  expect(within(box).getByText('Szerep')).toBeInTheDocument()
  expect(within(box).getByText('07:00–10:00')).toBeInTheDocument()
})

test('a mikro lap: tápanyagonként egy sor a szintjével', async () => {
  const { container } = mount()
  await userEvent.click(within(container.querySelector('.fe-dims') as HTMLElement).getByRole('button', { name: /Rost és mikro/ }))
  const box = screen.getByRole('dialog')
  const rows = box.querySelectorAll('.fe-rows .fx-it')
  expect(rows).toHaveLength(2)
  expect(rows[1]).toHaveTextContent('Magnézium')
  expect(rows[1]).toHaveTextContent('48 mg')
  expect((rows[1].querySelector('.fo-level') as HTMLElement).style.getPropertyValue('--c')).toBe('var(--fo-warn)')
})
