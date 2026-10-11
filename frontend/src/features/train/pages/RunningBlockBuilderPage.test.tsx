import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { RunningBlockBuilderPage } from '@/features/train/pages/RunningBlockBuilderPage'

// Asserts the Phase-1 mock running block (rb-active-01), so pin mock mode —
// useRunning seeds the blocks query synchronously via initialData in mock mode.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function setup() {
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/train/futas/rb-active-01']}>
          <Routes>
            <Route path="/train/futas/:id" element={<RunningBlockBuilderPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test('renders the active block title and its single lifecycle action (no Save button)', () => {
  setup()
  expect(screen.getByDisplayValue('Robbanékonyság 01')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Mentés/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Lezárás' })).toBeInTheDocument()
})

test('the sprint kör stepper shows the week value and increments on +', async () => {
  const user = userEvent.setup()
  setup()
  // rb-active-01 currentWeek=3 -> week 3 sprint rounds = 6 selected initially.
  const input = screen.getByLabelText('kör') as HTMLInputElement
  expect(input.value).toBe('6')
  await user.click(screen.getByRole('button', { name: 'kör növelése' }))
  expect(input.value).toBe('7')
})

test('editing the sprint weekday updates it across the plan', async () => {
  const user = userEvent.setup()
  setup()
  // Sprint defaults to Kedd; pick Szerda. The grid is single-select per session.
  const grids = screen.getAllByRole('button', { name: 'Sze' })
  await user.click(grids[0])
  expect(grids[0]).toHaveAttribute('aria-pressed', 'true')
})

test('a planned block exposes Aktiválás, an 8-week cap on the week adder', async () => {
  // rb-planned-01 is 6 weeks; add up to 8 then the ＋ disappears.
  render(
    <QueryWrapper><ThemeProvider>
      <MemoryRouter initialEntries={['/train/futas/rb-planned-01']}>
        <Routes><Route path="/train/futas/:id" element={<RunningBlockBuilderPage />} /></Routes>
      </MemoryRouter>
    </ThemeProvider></QueryWrapper>,
  )
  expect(screen.getByRole('button', { name: /Aktiválás/ })).toBeInTheDocument()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Hét hozzáadása' }))
  await user.click(screen.getByRole('button', { name: 'Hét hozzáadása' }))
  expect(screen.queryByRole('button', { name: 'Hét hozzáadása' })).not.toBeInTheDocument() // at 8
})

// ---- Folyadék structure (mezo-n4wf5.3, prototype `futasterv()` + sheet `blkmenu`) ----

const renderAt = (id: string) => render(
  <QueryWrapper><ThemeProvider>
    <MemoryRouter initialEntries={[`/train/futas/${id}`]}>
      <Routes><Route path="/train/futas/:id" element={<RunningBlockBuilderPage />} /></Routes>
    </MemoryRouter>
  </ThemeProvider></QueryWrapper>,
)

test('the editor is hero → Alapadatok → Hetek → one numbered card per session', () => {
  const { container } = setup()
  expect(container.querySelector('.fo-hero-lbl')).toHaveTextContent('Szerkesztő · Aktív · Hét 3/8')
  expect(container.querySelector('.fo-hero-verdict')).toHaveTextContent('Aktív terv, a 3. hétnél tart.')
  // the auto-save state: a pill + what it means
  expect(container.querySelector('.fo-hero-sub .fo-st.ok')).toHaveTextContent('Mentve')
  expect(container.querySelector('.fo-hero-sub')).toHaveTextContent('Minden változás mentve.')
  expect([...container.querySelectorAll('.fo-sec')].map((h) => h.textContent)).toEqual(
    ['1Alapadatok', '2Hetek · 1–8', '3Sprint-intervallum', '4Piramis-intervallum'])
  expect(screen.getByText('A 3. hét terhelését szerkeszted. A nap és az időpont minden hétre szól.')).toBeInTheDocument()
  // each session card redraws its interval tube from the edited segments
  expect(container.querySelectorAll('.es-ses .es-ivl')).toHaveLength(2)
  // the old skin is gone
  expect(container.querySelector('.glass, [class*="uvs-"], [class*="mz-"]')).toBeNull()
})

test('an edit flips the saved pill to „Nem mentve" and redraws the sprint tube', async () => {
  const { container } = setup()
  const tube = () => container.querySelectorAll('.es-ses')[0].querySelectorAll('.es-ivl i.s').length
  const before = tube()
  await userEvent.click(screen.getByRole('button', { name: 'kör növelése' }))
  expect(tube()).toBe(before + 1)
  expect(container.querySelector('.fo-hero-sub .fo-st')).toHaveTextContent('Nem mentve')
})

test('the pyramid segments are tags: tap cycles the seconds, × removes, ＋ adds', async () => {
  const { container } = setup()
  const tags = () => [...container.querySelectorAll('.es-pyr span.tx:not(.add)')].map((t) => t.textContent)
  expect(tags()).toEqual(['15 mp×', '30 mp×', '45 mp×', '45 mp×', '30 mp×', '15 mp×'])
  await userEvent.click(screen.getAllByRole('button', { name: '15 mp szakasz váltása' })[0])
  expect(tags()[0]).toBe('30 mp×')
  await userEvent.click(screen.getAllByRole('button', { name: '45 mp szakasz törlése' })[0])
  expect(tags()).toHaveLength(5)
  await userEvent.click(screen.getByRole('button', { name: '＋ szakasz' }))
  expect(tags()).toHaveLength(6)
  expect(screen.getByText('pihenő = szakasz × 2 · automatikus')).toBeInTheDocument()
})

test('„⋯ Több" opens the actions as a light sheet: Duplikálás and Törlés', async () => {
  setup()
  await userEvent.click(screen.getByRole('button', { name: 'További műveletek' }))
  const sheet = await screen.findByRole('dialog', { name: 'További műveletek' })
  expect(sheet).toHaveClass('fo-sheet')
  expect(within(sheet).getByRole('button', { name: 'Duplikálás' })).toBeInTheDocument()
  expect(within(sheet).getByRole('button', { name: 'Törlés' })).toHaveClass('fo-row', 'bad')
})

test('a planned block says it has not started; an archived one shows its summary and no status action', () => {
  const planned = renderAt('rb-planned-01')
  expect(planned.container.querySelector('.fo-hero-verdict')).toHaveTextContent('Ez a terv még nem indult el.')
  planned.unmount()
  const archived = renderAt('rb-archived-01')
  expect(archived.container.querySelector('.fo-hero-verdict')).toHaveTextContent('Lezárt terv, az archívumban van.')
  expect(screen.queryByRole('button', { name: /Aktiválás|Lezárás/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'További műveletek' })).toBeInTheDocument()
})

test('an unknown id is the not-found hero with the way back', () => {
  const { container } = renderAt('nope')
  expect(container.querySelector('.fo-hero-verdict')).toHaveTextContent('Ez a futóterv nem található.')
  expect(screen.getByRole('button', { name: 'Vissza a tervekhez' })).toBeInTheDocument()
})
