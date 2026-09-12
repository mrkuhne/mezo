// ============================================================
// Mezo · FuelWaterModule tests (Fuel Titanium S1d, mezo-33k6 — fagyasztott manifeszt A12:
// a víz a Mai-on MARAD, gyorsgombokkal és visszavonással).
//
// A vízírás és a visszavonás a `useWaterActions` dolga (ennek a session-alapú undo-ját a
// data-réteg tesztjei fedik) — itt a MODUL szerződését állítjuk: a gyorsgomb a saját
// mennyiségét naplózza, a visszavonás csak akkor látszik, ha van mit visszavonni, és a cél
// alatti érték SEMLEGES, sosem hibaállapot.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, vi } from 'vitest'
import { localDateString } from '@/shared/lib/dates'
import { FuelWaterModule } from '@/features/fuel/components/FuelWaterModule'

const hoisted = vi.hoisted(() => ({
  logWater: vi.fn(),
  undoLastWater: vi.fn(),
  canUndo: false,
  dateSeen: null as string | null,
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useWaterActions: (date?: string) => {
      hoisted.dateSeen = date ?? null
      return { logWater: hoisted.logWater, undoLastWater: hoisted.undoLastWater, canUndo: hoisted.canUndo }
    },
  }
})

const TODAY = localDateString()

afterEach(() => {
  hoisted.logWater.mockReset()
  hoisted.undoLastWater.mockReset()
  hoisted.canUndo = false
  hoisted.dateSeen = null
})

test('a gyorsgomb a megadott mennyiséget naplózza, a megtekintett napra', async () => {
  render(<FuelWaterModule date={TODAY} currentMl={1250} targetMl={4000} />)
  await userEvent.click(screen.getByRole('button', { name: '+2,5 dl' }))
  expect(hoisted.logWater).toHaveBeenCalledWith(250)
  expect(hoisted.dateSeen).toBe(TODAY)
})

// A gyors mennyiségek UGYANAZOK, amiket a WaterLogSheet kínál — nem találunk ki új készletet.
test('a gyorsgombok a meglévő 250/400/500 ml készletet viszik', async () => {
  render(<FuelWaterModule date={TODAY} currentMl={0} targetMl={3000} />)
  for (const [name, ml] of [['+2,5 dl', 250], ['+4 dl', 400], ['+5 dl', 500]] as const) {
    await userEvent.click(screen.getByRole('button', { name }))
    expect(hoisted.logWater).toHaveBeenCalledWith(ml)
  }
})

test('a visszavonás csak akkor látszik, ha van mit visszavonni', () => {
  const { rerender } = render(<FuelWaterModule date={TODAY} currentMl={500} targetMl={3000} />)
  expect(screen.queryByRole('button', { name: /Visszavonom/ })).not.toBeInTheDocument()
  hoisted.canUndo = true
  rerender(<FuelWaterModule date={TODAY} currentMl={750} targetMl={3000} />)
  expect(screen.getByRole('button', { name: /Visszavonom/ })).toBeInTheDocument()
})

test('a visszavonás az utolsó saját bejegyzést vonja vissza', async () => {
  hoisted.canUndo = true
  render(<FuelWaterModule date={TODAY} currentMl={750} targetMl={3000} />)
  await userEvent.click(screen.getByRole('button', { name: /Visszavonom/ }))
  expect(hoisted.undoLastWater).toHaveBeenCalledTimes(1)
})

// Szégyenmentesség: a cél alatti érték nem hibaállapot.
test('a cél alatti víz semlegesen jelenik meg', () => {
  const { container } = render(<FuelWaterModule date={TODAY} currentMl={200} targetMl={4000} />)
  expect(container.textContent).not.toMatch(/keveset|elmaradás|hiba|kevés/i)
})

// Őszinte-null: cél nélkül nincs százalék és nincs fabrikált nulladenominátor.
test('cél nélkül a gyűrű üres és a cél gondolatjel', () => {
  const { container } = render(<FuelWaterModule date={TODAY} currentMl={600} targetMl={0} />)
  expect(container.querySelector('.fmx-ring.is-empty')).toBeInTheDocument()
  expect(container.querySelector('[aria-label^="Víz:"]')!.getAttribute('aria-label')).toContain('—')
})
