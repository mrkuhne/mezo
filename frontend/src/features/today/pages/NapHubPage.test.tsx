import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NapHubPage } from '@/features/today/pages/NapHubPage'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { RECOVERY_QUERY_KEY } from '@/data/train/recoveryHooks'
import { mockOpen, recoveryEmpty } from '@/data/train/recoveryMock'
import type { RecoveryState } from '@/data/train/recoveryApi'
import { addDays, localDateString } from '@/shared/lib/dates'

const store = vi.hoisted(() => ({
  save: vi.fn(), pending: false, error: false, retry: vi.fn(),
  notes: [] as object[],
  slots: [{ time: '08:00', state: 'done', note: null, values: null }, { time: '12:00', state: 'now', note: null, values: null }],
  tick: new Date('2026-09-17T14:00:00'),
  fuelMode: null as string | null,
  needs: [] as { key: string; pct: number; band: string }[],
  training: { score: 100, status: 'DONE', value: '1/1' },
  week: null as null | { days: object[] },
}))
vi.mock('@/data/hooks', () => ({
  useCheckins: () => ({ checkins: store.slots, saveCheckIn: store.save, isPending: store.pending, isError: store.error, refetch: store.retry }),
  useFuelDay: () => ({ fuel: { consumed: { kcal: 900, p: 60, c: 100, f: 30 }, targets: { kcal: 2000, p: 150, c: 250, f: 70 }, meals: [], fuelMode: store.fuelMode }, isPending: false }),
  useMeWeek: () => ({ week: store.week }),
  useCheckInPlan: () => ({ plan: { items: [{}, {}, {}], adaptive: {} } }),
  useJournalNotes: () => ({ data: store.notes, isPending: false }),
  useActivities: () => ({ data: [], isPending: false }),
  // NapzarasCard's own hooks (mezo-yjzhw.4): at the default 14:00 tick the card renders
  // nothing; the 20:30 test below opens its window. Today is an open, in-progress day with
  // the training done — `normalizeDayEvaluation` is the identity here, so this is the
  // normalized shape.
  useRitualDay: () => ({ data: { closed: false }, isPending: false }),
  useDayEvaluation: () => ({
    data: {
      date: '2026-09-17', state: 'in_progress', score: null, base: null, adjustment: null,
      narrative: [], highlights: [], context: [],
      dimensions: [
        { id: 'training', label: 'Edzés', weight: 0.2, score: store.training.score, status: store.training.status, facts: [{ label: 'edzés', value: store.training.value }], note: null },
        { id: 'nutrition', label: 'Táplálkozás', weight: 0.3, score: 45, status: 'IN_PROGRESS', facts: [], note: null },
      ],
    },
    isPending: false,
  }),
  normalizeDayEvaluation: (raw: unknown) => raw,
}))
vi.mock('@/features/today/logic/useNeeds', () => ({ useNeeds: () => ({ states: store.needs, isPending: false }) }))
vi.mock('@/features/today/logic/useMinuteTick', () => ({ useMinuteTick: () => store.tick }))
vi.mock('@/features/today/logic/useDayFace', () => ({ useDayFace: () => ({ face: 'nap' }) }))
vi.mock('@/features/today/components/NapPersonalInsight', () => ({ NapPersonalInsight: () => <div>Valódi megfigyelés</div> }))
vi.mock('@/features/today/components/NapFuelGraphic', () => ({ NapFuelGraphic: ({ guidance }: { guidance?: boolean }) => <div>{guidance ? 'Makrók · kímélő' : 'Makrók'}</div> }))
vi.mock('@/features/today/sheets/CheckInSheet', () => ({ CheckInSheet: ({ slotIdx, onSave, onClose }: { slotIdx: number; onSave: (d: object) => void; onClose: () => void }) => <div role="dialog">slot:{slotIdx}<button onClick={() => { onSave({ state: 'done', note: 'Megérkeztem' }); onClose() }}>Mentés</button></div> }))
vi.mock('@/features/me/sheets/JournalSheet', () => ({ JournalSheet: () => <div role="dialog">Napló írása</div> }))
vi.mock('@/features/today/sheets/ActivityLogSheet', () => ({ ActivityLogSheet: () => <div role="dialog">Aktivitás rögzítése</div> }))
vi.mock('@/shared/lib/voice/useVoiceInput', async (orig) => ({
  ...(await orig<typeof import('@/shared/lib/voice/useVoiceInput')>()), useVoiceInput: () => ({ state: 'idle', toggle: vi.fn() }) }))
// Kímélő mód (mezo-q4xt2.2): the slot reads the recovery state through the real hooks in mock
// mode — a fresh client per render, optionally seeded with an open period.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())
function setup(recovery?: RecoveryState) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (recovery) client.setQueryData([...RECOVERY_QUERY_KEY, localDateString()], recovery)
  return render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter initialEntries={['/nap']}><Routes>
    <Route path="/nap" element={<NapHubPage />} />
    {['/nap/gyors', '/mezo/chat', '/nap/eletjel', '/nap/checkin', '/nap/napom', '/nap/kuldetesek', '/nap/uzenetek', '/nap/rutin', '/fuel', '/me/sleep', '/me/naplo', '/train/mai', '/ritual'].map(path => <Route key={path} path={path} element={<div>destination:{path}</div>} />)}
  </Routes></MemoryRouter></ToastProvider></QueryClientProvider>)
}
const hero = () => document.querySelector('[data-kalauz-anchor="nap-hero"]') as HTMLElement
const sectionTitles = () => [...document.querySelectorAll('.nm-page > .fo-sec > span:first-of-type')].map(e => e.textContent)

it('wears the Folyadék skeleton: tank, the numbered-less sections in order, no old skin', () => {
  const { container } = setup()
  expect(container.querySelector('.fo-page.nm-page')).not.toBeNull()
  expect(hero().querySelector('.fo-tank')).not.toBeNull()
  expect(sectionTitles()).toEqual(['Mai szintek', 'Most következik', 'Mai napló', 'Továbbiak'])
  // (Észrevétel brings its own heading — the component is mocked here)
  expect(screen.getByText('Valódi megfigyelés')).toBeInTheDocument()
  expect(container.querySelector('.glass:not(.tf-askteam), .uv-ring, .uv-halo, .uv-empty, [class*="nap-center"], [class*="nap-companion"]')).toBeNull()
  expect(screen.queryByText('NAPKÖZPONT')).not.toBeInTheDocument()
})
it('the tank shows the average of the six életjel, and „…" while there is nothing to average', () => {
  const view = setup()
  expect(hero().querySelector('.fo-tank-n b')).toHaveTextContent('…')
  expect(within(hero()).getByText('a 100-ból · hat életjel átlaga')).toBeInTheDocument()
  view.unmount()
  store.needs = [72, 52, 81, 34, 64, 58].map((pct, i) => ({ key: ['energia', 'hidratacio', 'pihenes', 'mozgas', 'lelek', 'rend'][i], pct, band: pct < 40 ? 'red' : 'green' }))
  try {
    setup()
    expect(hero().querySelector('.fo-tank-n b')).toHaveTextContent('60')
    const row = screen.getByRole('button', { name: /^Életjelekhat jel/ })
    expect(row).toHaveTextContent('hat jel · a mozgás kér figyelmet')
    expect(row.querySelector('.v')).toHaveTextContent('60')
  } finally { store.needs = [] }
})
it('the tank verdict is the day reading (the same rule as A napom)', () => {
  const view = setup()
  expect(within(hero()).getByText('Még üres a napod. Az első beírással elindul.')).toBeInTheDocument()
  view.unmount()
  store.week = { days: [{ date: '2026-09-17', kcal: 900, proteinG: 60, proteinTargetG: 150, sleepMin: 436, checkinCount: 1, workoutCount: 1 }] }
  try {
    setup()
    expect(within(hero()).getByText('Az edzés megvolt. Egy esti check-in, és kerek a nap.')).toBeInTheDocument()
    // today's sleep is a level
    expect(screen.getByRole('button', { name: /Alvás/ })).toHaveTextContent('7 ó 16')
  } finally { store.week = null }
})
it('opens the next check-in directly from the tank and saves to that slot', async () => {
  setup()
  await userEvent.click(within(hero()).getByRole('button', { name: /^Délelőtti check-in/ }))
  expect(screen.getByRole('dialog')).toHaveTextContent('slot:1')
  await userEvent.click(screen.getByText('Mentés'))
  expect(store.save).toHaveBeenCalledWith(1, expect.objectContaining({ state: 'done', note: 'Megérkeztem' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('„Most következik" leads with the same check-in: its time, the tap count, Kitöltöm', async () => {
  setup()
  const item = document.querySelector('.fo-stream-item.now') as HTMLElement
  expect(item).toHaveTextContent('12:00')
  expect(item).toHaveTextContent('Délelőtti check-in')
  expect(item).toHaveTextContent('4 koppintás, kb. fél perc')
  expect(item).toHaveTextContent('Kitöltöm')
  expect(screen.getByText('1 teendő')).toBeInTheDocument()
  await userEvent.click(item)
  expect(screen.getByRole('dialog')).toHaveTextContent('slot:1')
})
it('an open training day adds the Edzés step → /train/mai', async () => {
  store.training = { score: 0, status: 'IN_PROGRESS', value: '0/1' }
  try {
    setup()
    expect(screen.getByText('2 teendő')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mozgás/ })).toHaveTextContent('0/1')
    await userEvent.click(screen.getByRole('button', { name: /a mai edzés még hátravan/ }))
    expect(screen.getByText('destination:/train/mai')).toBeInTheDocument()
  } finally { store.training = { score: 100, status: 'DONE', value: '1/1' } }
})
it('opens Napló capture directly, and Aktivitás from „Több"', async () => {
  const view = setup(); await userEvent.click(screen.getByRole('button', { name: 'Napló' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Napló írása')
  view.unmount(); setup()
  await userEvent.click(screen.getByRole('button', { name: 'Több' }))
  await userEvent.click(await screen.findByRole('button', { name: /^Aktivitás/ }))
  expect(await screen.findByText('Aktivitás rögzítése')).toBeInTheDocument()
})
it.each([['Chat', '/mezo/chat'], ['Napi küldetések', '/nap/kuldetesek'], ['Életjelek', '/nap/eletjel']])('„Több" routes %s to the existing flow', async (name, path) => {
  setup(); await userEvent.click(screen.getByRole('button', { name: 'Több' }))
  const sheet = (await screen.findByRole('heading', { name: 'Több' })).closest('.sheet') as HTMLElement
  expect(sheet).toHaveClass('fo-sheet')
  await userEvent.click(within(sheet).getByRole('button', { name: new RegExp(`^${name}`) }))
  expect(screen.getByText(`destination:${path}`)).toBeInTheDocument()
})
it.each([['+ Új bejegyzés', '/nap/gyors'], ['Életjelek', '/nap/eletjel'], ['Összes észrevétel', '/nap/uzenetek'], [/Kalória/, '/fuel'], [/Alvás/, '/me/sleep']] as const)('routes %s to the existing flow', async (name, path) => {
  setup(); await userEvent.click(screen.getAllByRole('button', { name: typeof name === 'string' ? new RegExp(`^${name.replace('+', '\\+')}`) : name })[0])
  expect(screen.getByText(`destination:${path}`)).toBeInTheDocument()
})
it('tapping the air of the tank opens the életjel page (the old companion tap)', async () => {
  setup(); await userEvent.click(within(hero()).getByRole('button', { name: 'Életjelek' }))
  expect(screen.getByText('destination:/nap/eletjel')).toBeInTheDocument()
})
it('with every check-in done the tank offers Gyors logolás, and the done check-ins stay reachable in the log', async () => {
  const prev = store.slots; store.slots = prev.map(s => ({ ...s, state: 'done' }))
  try {
    const view = setup()
    expect(screen.queryByRole('button', { name: /check-in→?$/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Most következik')).not.toBeInTheDocument()
    await userEvent.click(within(hero()).getByRole('button', { name: /^Gyors logolás/ }))
    expect(screen.getByText('destination:/nap/gyors')).toBeInTheDocument()
    view.unmount(); setup()
    await userEvent.click(screen.getAllByRole('button', { name: /Check-inEgy pillanatkép rólad/ })[0])
    expect(screen.getByText('destination:/nap/checkin')).toBeInTheDocument()
  } finally { store.slots = prev }
})

it('waits for persisted slots before offering capture and exposes retry on read failure', async () => {
  store.pending = true
  const view = setup()
  expect(screen.queryByRole('button', { name: /check-in/ })).not.toBeInTheDocument()
  expect(within(hero()).getByRole('button', { name: /^Gyors logolás/ })).toBeInTheDocument()
  view.unmount(); store.pending = false; store.error = true
  setup()
  expect(screen.queryByRole('button', { name: /^Délelőtti check-in/ })).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('A check-ineket most nem sikerült betölteni.')
  await userEvent.click(screen.getByRole('button', { name: 'Check-in újratöltése' }))
  expect(store.retry).toHaveBeenCalled(); store.error = false
})

it('the four levels carry their glyphs and the fuel numbers of the day', () => {
  setup()
  const vials = [...document.querySelectorAll('.nm-levels .fo-vial')] as HTMLElement[]
  expect(vials.map(v => v.querySelector('use')?.getAttribute('href'))).toEqual(['#t-flame', '#t-meat', '#t-sleep', '#t-dumbbell'])
  expect(vials[0]).toHaveTextContent('900')
  expect(vials[0]).toHaveTextContent('1 100 van még')
  expect(vials[0].querySelector('.fo-tube em')).toHaveTextContent('2 000')
  expect(vials[1]).toHaveTextContent('60 g')
  expect(vials[1]).toHaveTextContent('90 g hiányzik')
  expect(vials[3]).toHaveTextContent('1/1')
})
it('Mai napló rows are stream pills that open their record', async () => {
  store.notes = [{ id: 'n1', occurredOn: '2026-09-17', text: 'Jó nap', createdAt: '2026-09-17T09:00:00' }]
  try {
    const { container } = setup()
    const row = container.querySelector('.nm-log .fo-stream-item') as HTMLElement
    expect(row.tagName).toBe('BUTTON')
    expect(row).toHaveTextContent('09:00')
    expect(row).toHaveTextContent('Napló')
    expect(row).toHaveTextContent('Jó nap')
    expect(container.querySelector('.nm-log .glass')).toBeNull()
    await userEvent.click(row)
    expect(screen.getByText('destination:/me/naplo')).toBeInTheDocument()
  } finally { store.notes = [] }
})
it('an empty day says so in the log', () => {
  const prev = store.slots; store.slots = prev.map(s => ({ ...s, state: 'pending' }))
  try { setup(); expect(screen.getByText('Az első mai bejegyzésed itt kap helyet.')).toBeInTheDocument() } finally { store.slots = prev }
})

it('at 20:30 the tank turns to the evening napzárás with the day\'s chips, and the stream offers Napzárás + Esti rutin', async () => {
  store.tick = new Date('2026-09-17T20:30:00')
  try {
    setup()
    expect(hero().querySelector('.fo-tank')).toHaveClass('fo-dusk')
    expect(screen.getByText('Tegyük le a napot.')).toBeInTheDocument()
    expect(screen.getByText('edzés 1/1')).toBeInTheDocument()
    expect(screen.getByText('1/6 terület kész')).toBeInTheDocument()
    expect(screen.getByText('Hat rövid lépés, kb. 3 perc')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Esti rutin/ }))
    expect(screen.getByText('destination:/nap/rutin')).toBeInTheDocument()
  } finally {
    store.tick = new Date('2026-09-17T14:00:00')
  }
})

describe('NapHubPage — Kérdezd a csapatot (mezo-u3712)', () => {
  test('a Továbbiak kártyán a belépő a Diagnózis oldalra visz', () => {
    setup()
    const link = screen.getByRole('link', { name: /Kérdezd a csapatot/ })
    expect(link).toHaveAttribute('href', '/mezo/diagnozis')
    expect(link.closest('.fo-card')).toHaveClass('nm-more')
  })
})

describe('NapHubPage — kímélő mód (mezo-q4xt2.2)', () => {
  const open = () => mockOpen(recoveryEmpty, { category: 'ILLNESS', estimate: 'FEW_DAYS', startDate: addDays(localDateString(), -1) })

  test('no period: the „Nem vagyok jól" row closes the Továbbiak card → Mi történt? → Beteg vagyok → 2–3 nap → the Hogy vagy? hero on top', async () => {
    const { container } = setup()
    const row = screen.getByRole('button', { name: 'Nem vagyok jól' })
    expect(row).toHaveTextContent('Kímélő mód: betegség, sérülés vagy utazás idejére')
    expect(row.closest('.fo-card')).toHaveClass('nm-more')
    expect(container.querySelector('.nm-km')).toBeNull()
    await userEvent.click(row)
    await userEvent.click(await screen.findByRole('button', { name: 'Beteg vagyok' }))
    await userEvent.click(screen.getByRole('button', { name: '2–3 nap' }))
    await userEvent.click(screen.getByRole('button', { name: 'Kímélő mód bekapcsolása' }))
    expect(await screen.findByText('Kímélő mód bekapcsolva')).toBeInTheDocument()
    expect(await screen.findByText('Hogy vagy?')).toBeInTheDocument()
    expect(document.querySelector('.nm-km .fo-hero-sub')?.textContent?.replace(/\s+/g, ' ')).toBe('1. nap · becslés: 2–3 nap')
    // the hero is the first thing on the page, above the tank
    expect(container.querySelector('.nm-page')!.firstElementChild).toHaveClass('nm-km')
    expect(screen.queryByRole('button', { name: 'Nem vagyok jól' })).not.toBeInTheDocument()
  })

  test('an open period by day: the tank reads rest, Mozgás is paused', () => {
    store.training = { score: 0, status: 'IN_PROGRESS', value: '0/1' }
    try {
      setup(open())
      expect(within(hero()).getByText('Ma a pihenés a dolgod.')).toBeInTheDocument()
      expect(within(hero()).getByText('Az edzés magától kimarad, és nem számít mulasztásnak.')).toBeInTheDocument()
      expect(within(hero()).getByText('a 100-ból · kímélő mód · 2. nap')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Mozgás/ })).toHaveTextContent('kímélő · kimarad')
      const step = screen.getByText('kímélő mód · nem számít mulasztásnak').closest('.fo-stream-item') as HTMLElement
      expect(step.tagName).toBe('DIV')
      expect(step).toHaveTextContent('Kimarad')
    } finally { store.training = { score: 100, status: 'DONE', value: '1/1' } }
  })

  test('an open period: the hero sits above the evening tank, whose gym chip reads „edzés · kímélő mód"', () => {
    store.tick = new Date('2026-09-17T20:30:00')
    try {
      const { container } = setup(open())
      const card = container.querySelector('.nm-km')!
      const tank = container.querySelector('.fo-tank.fo-dusk')!
      expect(card.compareDocumentPosition(tank) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(screen.getByText('edzés · kímélő mód')).toBeInTheDocument()
      expect(screen.queryByText('edzés 1/1')).not.toBeInTheDocument()
    } finally {
      store.tick = new Date('2026-09-17T14:00:00')
    }
  })
})

// Kihagyás S3 (mezo-q4xt2.3): a GUIDANCE nap az üzemanyag-lapnak és a szinteknek is a kímélő sort adja.
it('hands the GUIDANCE day to the fuel sheet and the levels, and only that day', async () => {
  store.fuelMode = 'GUIDANCE'
  try {
    const view = setup()
    expect(screen.getByText('Kímélő mód · ma nincs kalóriacél — folyadék, könnyű étel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^–Kalória/ })).toHaveTextContent('ma nincs cél')
    await userEvent.click(screen.getByRole('button', { name: /^A napod üzemanyaga/ }))
    expect(await screen.findByText('Makrók · kímélő')).toBeInTheDocument()
    view.unmount()
    store.fuelMode = 'MAINTENANCE'
    setup()
    expect(screen.queryByText(/ma nincs kalóriacél/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^A napod üzemanyaga/ }))
    expect(await screen.findByText('Makrók')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'A napod üzemanyaga' }).closest('.sheet')).toHaveClass('fo-sheet')
  } finally { store.fuelMode = null }
})
