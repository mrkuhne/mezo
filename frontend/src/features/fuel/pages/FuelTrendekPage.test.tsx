// A Trendek oldal tesztjei (Fuel Titanium S3, mezo-83g0 — C1 · C4 · C5 · C6).
//
// A mock heti rollup a MAI hétre van dátumozva (`mockWeekRollup`), ezért egyetlen dátum sincs
// beégetve: minden elvárás `mondayIso()`-ból származik. (Fix fixture itt éjfélkor elromlana.)
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { FuelTrendekPage } from '@/features/fuel/pages/FuelTrendekPage'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import { addDays, huMonthDay } from '@/shared/lib/dates'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function renderView() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/fuel/trendek']}>
        <FuelTrendekPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

/** A mock hét 2. napja (kedd) — naplózott, keretbe belefér. */
const loggedDay = () => huMonthDay(addDays(mondayIso(), 1))
/** A mock hét szombatja — naplózott és a keret FELETT (2740 / 2200). */
const overDay = () => huMonthDay(addDays(mondayIso(), 5))

test('a Trendek oldal a saját címével jelenik meg', () => {
  renderView()
  expect(screen.getByRole('heading', { name: 'Trendek' })).toBeInTheDocument()
})

test('a heti kép a hét napjait mutatja a kerethez mérve', () => {
  const { container } = renderView()
  expect(container.querySelectorAll('.ftx-day')).toHaveLength(7)
  // A keret vonala minden naphoz kirajzolódik, nem csak a naplózottakhoz.
  expect(container.querySelectorAll('.ftx-target').length).toBe(7)
})

// Az owner kérése: a napokon AI pontszám álljon, ne nyers makró-számok („2.1, 2.3" = „nem túl
// beszédes").
test('a nap az AI pontszámát mutatja', () => {
  const { container } = renderView()
  expect(container.querySelector('.ftx-day-score')).toHaveTextContent(/^\d/)
  // Nyers makró-pár SEHOL nem áll a napokon.
  for (const day of container.querySelectorAll('.ftx-day')) {
    expect(day.textContent).not.toMatch(/\d+[.,]\d\s*·\s*\d+[.,]\d/)
  }
})

test('a nap koppintása üvegdobozban nyitja a napi részleteket', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: new RegExp(loggedDay(), 'i') }))
  const box = screen.getByRole('dialog')
  expect(box.className).toContain('glass')
})

// A napi részletek OLVASHATÓAK: a dimenzió-tények SOROKBAN állnak (owner: „nagyon össze van
// dobva és nehéz olvasni").
test('a napi üvegdoboz sorokban tálalja a dimenzió-tényeket', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: new RegExp(loggedDay(), 'i') }))
  expect(within(screen.getByRole('dialog')).getAllByRole('listitem').length).toBeGreaterThan(1)
})

// Szégyenmentesség: a keret feletti nap nem hibaállapot.
test('a kereten túli nap nem hibaként jelenik meg', () => {
  const { container } = renderView()
  // A mock hét szombatja TÉNYLEG a keret felett jár — különben ez a teszt vákuum.
  expect(container.querySelector('.ftx-day.is-over')).not.toBeNull()
  expect(container.querySelector('.ftx-day.is-error')).toBeNull()
  expect(container.textContent).not.toMatch(/elrontott|túlléptél|hiba|rossz|bukta|kudarc/i)
})

test('a kereten túli nap üvegdoboza sem vádol', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: new RegExp(overDay(), 'i') }))
  const box = screen.getByRole('dialog')
  expect(box.textContent).toMatch(/így alakult/i)
  expect(box.textContent).not.toMatch(/elrontott|túlléptél|hiba|rossz|bukta|kudarc/i)
})

// Őszinte-null: nem naplózott nap.
test('a nem naplózott nap „nincs adat", nem nulla oszlop', () => {
  const { container } = renderView()
  const day = container.querySelector('.ftx-day.is-empty')!
  expect(day).not.toBeNull()
  expect(day).toHaveTextContent(/nincs adat/i)
  // NEM nulla magasságú oszlop: kitöltés helyett hézag-jel áll ott.
  expect(day.querySelector('.ftx-fill')).toBeNull()
  expect(day.querySelector('.ftx-gap')).not.toBeNull()
})

test('a nem naplózott nap üvegdoboza kimondja, hogy kimarad az átlagból', async () => {
  const { container } = renderView()
  const empty = container.querySelector('.ftx-day.is-empty') as HTMLButtonElement
  await userEvent.click(empty)
  expect(screen.getByRole('dialog').textContent).toMatch(/nem naplóztál/i)
  expect(screen.getByRole('dialog').textContent).toMatch(/átlagból is kimarad/i)
})

// C1 + C2: a kontraszt-sorok és a Task 1 felszabadította két átlag.
test('a hétköznap/hétvége kontraszt és a két heti átlag ott áll', () => {
  const { container } = renderView()
  expect(container.querySelectorAll('.ftx-splitrow').length).toBe(2)
  expect(screen.getByText('Hétköznap')).toBeInTheDocument()
  expect(screen.getByText('Hétvége')).toBeInTheDocument()
  expect(screen.getByText('Étkezés-minőség')).toBeInTheDocument()
  expect(screen.getByText('Heti súlyátlag')).toBeInTheDocument()
  // A mock hét átlaga 0.78 → 7,8 a 0–10 skálán; a súly 81,3 kg.
  expect(container.querySelector('.ftx-tile.is-score')).toHaveTextContent('7,8')
  expect(container.querySelector('.ftx-tile.is-weight')).toHaveTextContent('81,3')
})

// C6: az edzésnap a heti képben is látszik (a mock hét első napja edzésnap).
test('az edzésnap jelölést kap a heti képben', () => {
  const { container } = renderView()
  expect(container.querySelectorAll('.ftx-day .ftx-train').length).toBeGreaterThan(0)
})

// C3: a hosszabb táv a heti kép ALATT áll, és a két sorozat egy tengelyen fut.
test('a hosszabb táv a heti kép alatt, egy időtengelyen rajzol', () => {
  const { container } = renderView()
  expect(screen.getByRole('heading', { name: 'Hosszabb táv' })).toBeInTheDocument()
  expect(container.querySelector('.ftx-horizon-kcal')).not.toBeNull()
  expect(container.querySelector('.ftx-horizon-weight')).not.toBeNull()
  // A sorrend kötött: a heti kép a protagonista.
  const hero = container.querySelector('.ftx-hero')!
  const horizon = container.querySelector('.ftx-horizon')!
  expect(hero.compareDocumentPosition(horizon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
