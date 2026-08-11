import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { MotorPage } from '@/features/insights/pages/MotorPage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <MotorPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('MotorPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the engine-state header with the window, the gate and the raw cron', () => {
    renderPage()
    expect(screen.getByText('2026-06-13 – 2026-08-10')).toBeInTheDocument()
    expect(screen.getByText('60 nap')).toBeInTheDocument()
    expect(screen.getByText('min. 8 illeszkedő nap')).toBeInTheDocument()
    expect(screen.getByText('0 40 2 * * *')).toBeInTheDocument()
  })

  test('renders every verdict with its honest derived sentence', () => {
    renderPage()
    expect(screen.getAllByText('él')).toHaveLength(2)
    expect(screen.getByText('Még 2 illeszkedő nap kell — a szűk keresztmetszet: edzés-RPE.')).toBeInTheDocument()
    expect(
      screen.getByText('Nincs még illeszkedő nap — a(z) sportterhelés üres ebben az ablakban.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('A(z) vízbevitel nem mozdul az ablakban — így nincs mit korrelálni.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Te ítélted meg (megerősítve) — az éjszakai job nem számolja újra.'),
    ).toBeInTheDocument()
  })

  test('orders pairs live → few_days (fewest missing first) → degenerate → no_data → frozen', () => {
    renderPage()
    const titles = screen.getAllByTestId('gate-pair-title').map((el) => el.textContent)
    expect(titles[0]).toBe('Stressz-szint ↔ aznapi alvásminőség') // live, 34 illesztett nap
    expect(titles[1]).toBe('Alvásminőség ↔ másnapi edzés-RPE') // live, 21 illesztett nap
    expect(titles[2]).toBe('Késői étkezés ↔ rákövetkező alvásminőség') // 1 hiányzó nap
    expect(titles[3]).toBe('Alváshossz ↔ másnapi edzés-RPE') // 2 hiányzó nap
    expect(titles[7]).toBe('Reta-ciklusnap ↔ napi kalória') // frozen a végén
  })

  test('orders the coverage list thinnest-first', () => {
    renderPage()
    const labels = screen.getAllByTestId('coverage-label').map((el) => el.textContent)
    expect(labels[0]).toBe('sportterhelés')
    expect(labels[labels.length - 1]).toBe('alvásminőség')
  })
})

describe('MotorPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the degraded card on a 404', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/monitor`, () => new HttpResponse(null, { status: 404 })),
    )
    renderPage()
    expect(await screen.findByText('A minta-motor most nem elérhető.')).toBeInTheDocument()
  })

  test('says the job has never run when lastRunAt is null', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/monitor`, () =>
        HttpResponse.json({
          windowFrom: '2026-06-13', windowTo: '2026-08-10', lookbackDays: 60, minN: 8,
          cron: '0 40 2 * * *', lastRunAt: null, pairs: [], metrics: [],
        }),
      ),
    )
    renderPage()
    expect(await screen.findByText('még nem futott')).toBeInTheDocument()
  })
})
