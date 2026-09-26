import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { CharacterRoomPage, MaturityWell } from '@/features/insights/pages/CharacterRoomPage'

const renderRoom = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/mezo/csapat/${id}`]}>
      <Routes><Route path="/mezo/csapat/:id" element={<CharacterRoomPage />} /></Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('CharacterRoomPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('a szoba ritmusa: hero → számok → ügyek → tudás → jegyzet', async () => {
    renderRoom('falat')
    expect(await screen.findByRole('heading', { level: 1, name: 'Falat · étkezés' })).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
    expect(headings).toEqual(['Most ezen dolgozik', 'Így érik a képe rólad', 'Amit rólad tud', 'Falat jegyzete'])
    expect(screen.getByText('Kérése hozzád')).toBeInTheDocument()
  })

  test('az első ügy üveg, a többi lapos panel, mind a mélyoldalra visz', async () => {
    renderRoom('mezo')
    await screen.findByRole('heading', { level: 1, name: 'Mezo · a csapat' })
    const cases = Array.from(document.querySelectorAll('[data-case-id]'))
    expect(cases.length).toBeGreaterThan(2)
    expect(cases[0].classList.contains('glass')).toBe(true)
    for (const c of cases.slice(1)) {
      expect(c.classList.contains('glass')).toBe(false)
      expect(c.classList.contains('tf-flatc')).toBe(true)
    }
    for (const c of cases) expect(c.getAttribute('href')).toMatch(/^\/mezo\//)
  })

  // csapatfal H2 (mezo-a9bo7.13): a fal az esti kiadás válogatása, a szoba viszont a TELJES
  // rekordkészlet — ami a kiadásba nem került be, itt marad (spec 2026-09-24 §2).
  test('a szoba ügyei a teljes rekordkészletből jönnek, nem a falra került kiadásból', async () => {
    renderRoom('mocor')
    await screen.findByRole('heading', { level: 1, name: 'Mocor · mozgás' })
    const ids = Array.from(document.querySelectorAll('[data-case-id]')).map(c => c.getAttribute('data-case-id')!)
    expect(ids.length).toBeGreaterThan(0)
    // minden ügy egy REKORDRA mutat (minta, észrevétel, kísérlet, előrejelzés, karakter-feed),
    // sosem egy kiadás-poszt szeletére
    expect(ids.every(id => /^(pattern|observation|experiment|prediction|character):/.test(id))).toBe(true)
  })

  // mezo-a9bo7.11: a mock érettség-történet üres (a mock overview is üresen indul) → csak szöveg.
  test('az érési görbe nélküli szoba őszinte szöveget mutat, kitalált görbét nem', async () => {
    renderRoom('mocor')
    await screen.findByRole('heading', { level: 1, name: 'Mocor · mozgás' })
    expect(screen.getByText(/jövő héttől itt látod/)).toBeInTheDocument()
    expect(screen.queryByTestId('room-growth')).toBeNull()
  })

  test('ami rád vár, az a szoba első ügye', async () => {
    renderRoom('falat')
    await screen.findByRole('heading', { level: 1, name: 'Falat · étkezés' })
    const first = document.querySelector('[data-case-id]')!
    const anyWaiting = Array.from(document.querySelectorAll('[data-case-id] .tf-st')).some(s => s.textContent === 'Rád vár')
    if (anyWaiting) expect(first.querySelector('.tf-st')!.textContent).toBe('Rád vár')
  })

  test('üres dossziénál őszintén „ismerkedik”, nincs kitalált érettség', async () => {
    renderRoom('szunya')
    await screen.findByRole('heading', { level: 1, name: 'Szunya · alvás' })
    expect(screen.getByText('Ismerkedik')).toBeInTheDocument()
    expect(screen.getByText('Még nem épült be semmi')).toBeInTheDocument()
  })

  test('a Szkeptikusnak és ismeretlen karakternek nincs szobája', () => {
    renderRoom('szkeptikus')
    expect(screen.getByText('Nincs ilyen szoba')).toBeInTheDocument()
  })
})

describe('MaturityWell — szöveg + pöttyök, majd vonal (mezo-a9bo7.11)', () => {
  test('4 pont alatt pöttyök vonal nélkül, a szöveggel és az élő értékkel', () => {
    render(<MaturityWell series={[null, null, null, null, null, 40, null, 55]} note={null} />)
    const well = screen.getByTestId('room-growth')
    expect(well.dataset.state).toBe('dots')
    expect(well.querySelector('path.tf-l1')).toBeNull()
    expect(well.querySelectorAll('circle.tf-dot')).toHaveLength(1)
    expect(well.querySelector('circle.tf-pt')).not.toBeNull()
    expect(screen.getByText('55%')).toBeInTheDocument()
    expect(screen.getByText(/a 4\. héttől vonal köti össze/)).toBeInTheDocument()
  })

  test('4 ponttól vonal, a hiányzó hétnél megszakad', () => {
    render(<MaturityWell series={[10, 20, 30, null, 40, 50, 60, 70]} note={null} />)
    const well = screen.getByTestId('room-growth')
    expect(well.dataset.state).toBe('line')
    expect(well.querySelectorAll('path.tf-l1')).toHaveLength(2)
    expect(screen.queryByText(/a 4\. héttől/)).toBeNull()
  })

  test('esésnél a csendes felirat látszik', () => {
    render(<MaturityWell series={[null, null, null, null, 50, 60, 70, 60]} note="Sport: a meglévő állítások bizonyossága csökkent." />)
    expect(screen.getByTestId('room-growth-note')).toHaveTextContent('Sport: a meglévő állítások bizonyossága csökkent.')
  })
})
