import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NapMezoPage } from '@/features/today/pages/NapMezoPage'
import { MezoThreadProvider } from '@/features/today/MezoThreadProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import type { FeedMessage } from '@/data/types'
import { lastSeenMessage } from '@/shared/lib/seenMessages'
import { localDateString } from '@/shared/lib/dates'

// Mezo üzenetei page (mezo-d20.2.2) — the Nap hub's Mezo tile → own full page
// (prototype nap-body.html #page-mezo): p-coral tone, breathing-orb hero, the day's
// companion messages as a thread of cards, chat CTA at the bottom. The thread logic is
// the sheet's verbatim (buildMezoMessages + useCompanionFeed + useFeedback wiring).

// Mode-agnostic data stubs: the companion feed is [] in mock mode and MSW-fixture-fed in
// real mode — this suite tests the page, not the data layer (QuickInputSheet.test pattern).
const feedMock = vi.hoisted(() => ({ useCompanionFeed: vi.fn<() => FeedMessage[]>(() => []) }))
const voteMock = vi.hoisted(() => ({ vote: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useCompanionFeed: () => feedMock.useCompanionFeed(),
    useFeedback: () => ({ get: () => undefined, vote: voteMock.vote, pending: false }),
  }
})

// Életjel küszöb-nudge-ok (mezo-d20.11): the thread's tail is data-driven, so the
// ring engine is stubbed — empty by default, and one red ring in the dedicated test.
const needsMock = vi.hoisted(() => ({
  states: [] as { key: string; pct: number; band: string }[],
}))
vi.mock('@/features/today/logic/useNeeds', () => ({
  useNeeds: () => ({ states: needsMock.states, isPending: false }),
}))
// A fixed wall clock: `deriveNudges` is quiet at night and in the first hour after
// waking, so an unpinned clock would make the nudge test flake by time of day.
// Held in a mutable box (mezo-z4h4) so one test can move the clock into the quiet
// window (a red ring that `deriveNudges` suppresses) without unpinning the rest.
const tickMock = vi.hoisted(() => ({ now: new Date('2026-05-22T13:42:00') }))
vi.mock('@/features/today/logic/useMinuteTick', () => ({
  useMinuteTick: () => tickMock.now,
}))

const morningMsg: FeedMessage = {
  id: 'fm-1', kind: 'morning', eyebrow: 'Reggeli briefing',
  body: [{ type: 'p', text: 'Két nap múlva W3-csúcs — ma a Pull A a hét kulcs-edzése.' }],
  refs: [{ kind: 'workout', label: 'Pull A' }],
  generatedAt: '2026-05-22T07:05:00',
}
const sleepMsg: FeedMessage = {
  id: 'fm-2', kind: 'sleep', eyebrow: 'Alvás-reakció',
  body: [{ type: 'p', text: '7:24, 92% hatékonyság — zsinórban a harmadik cél feletti éjszakád.' }],
  refs: [],
  generatedAt: '2026-05-22T07:12:00',
}
// mezo-z4h4: 4+ refs across two kinds — proves the chat-style grouped chips (human kind label,
// domain icon, one group open at a time) replace the raw `[FuelDay]` RefTag rendering. The
// labels are bare ISO dates, the honest-label fallback chatRefDisplay must humanise.
const refsMsg: FeedMessage = {
  id: 'fm-3', kind: 'evening', eyebrow: 'Napi összegzés',
  body: [{ type: 'p', text: 'Sok forrásra épült ez a nap.' }],
  refs: [
    { kind: 'FuelDay', label: '2026-08-25' },
    { kind: 'FuelDay', label: '2026-08-26' },
    { kind: 'Practice', label: '2026-08-27' },
    { kind: 'Practice', label: '2026-09-02' },
  ],
  generatedAt: '2026-05-22T20:00:00',
}

beforeEach(() => {
  feedMock.useCompanionFeed.mockReturnValue([])
  voteMock.vote.mockClear()
  needsMock.states = []
  tickMock.now = new Date('2026-05-22T13:42:00')
  localStorage.clear()
})

function renderPage() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/nap', '/nap/uzenetek']} initialIndex={1}>
        {/* A szál a shell providereé (mezo-atry) — az oldal fogyasztó, nem építő. */}
        <MezoThreadProvider>
        <Routes>
          <Route path="/nap" element={<div>nap-hub</div>} />
          <Route path="/nap/uzenetek" element={<NapMezoPage />} />
          <Route path="/mezo/chat" element={<div>chat-page</div>} />
        </Routes>
        </MezoThreadProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('the hero is the breathing orb with the Mezo · ma name and the honest message count', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg, sleepMsg])
  renderPage()
  expect(await screen.findByText('Mezo · ma')).toBeInTheDocument()
  expect(screen.getByText('2 üzenet · a napod fonala')).toBeInTheDocument()
  expect(document.querySelector('.mz-page-hero.orb use[href="#s-orb"]')).not.toBeNull()
  expect(document.querySelector('.mz-page.mz-p-coral')).not.toBeNull()
})

test('the back chip navigates back to the hub', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Vissza' }))
  expect(await screen.findByText('nap-hub')).toBeInTheDocument()
})

test('feed messages render as thread cards: time · eyebrow head, body, refs, daypart spot', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg, sleepMsg])
  renderPage()
  // sleep (07:12) is the thread's last voice → full card by default; morning (07:05) is
  // collapsed (mezo-ho9k) — tap its row open before asserting the full-card contents.
  expect(await screen.findByText('07:12 · Alvás-reakció')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /07:05.*Reggeli briefing/ }))
  expect(await screen.findByText('07:05 · Reggeli briefing')).toBeInTheDocument()
  expect(screen.getByText(/W3-csúcs/)).toBeInTheDocument()
  expect(screen.getByText(/Pull A$/)).toBeInTheDocument() // the ref tag
  // kind → spot mapping: morning → s-reggel, sleep → s-este
  expect(document.querySelector('.nap-mzmsg use[href="#s-reggel"]')).not.toBeNull()
  expect(document.querySelector('.nap-mzmsg use[href="#s-este"]')).not.toBeNull()
})

test('no morning message in the feed → the labelled demo briefing leads the thread', async () => {
  feedMock.useCompanionFeed.mockReturnValue([sleepMsg])
  renderPage()
  // sleep is the thread's last voice → full card by default; the demo briefing (leading
  // the thread) is collapsed (mezo-ho9k) as a one-line `.nap-mzrow`.
  expect(await screen.findByText('07:12 · Alvás-reakció')).toBeInTheDocument()
  // Záró review Finding 2: the "Demo tartalom" honesty label must survive collapse — it is
  // rendered inline in the collapsed row itself, not only inside the expanded card.
  const row = screen.getByRole('button', { name: /Reggeli briefing/ })
  expect(within(row).getByText('Demo tartalom')).toBeInTheDocument()
  await userEvent.click(row)
  expect(await screen.findByText('Demo tartalom')).toBeInTheDocument()
  const cards = document.querySelectorAll('.nap-mzmsg')
  expect(cards).toHaveLength(2)
  expect(within(cards[0] as HTMLElement).getByText('Demo tartalom')).toBeInTheDocument()
})

// ── Összecsukott régebbiek (mezo-ho9k): a legújabb teljes, a többi egysoros.
test('a legújabb üzenet teljes kártya, a régebbi összecsukott sor — koppintva kinyílik chipekkel', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg, sleepMsg])
  renderPage()
  // a szál vége (sleep, 07:12) a legfrissebb → az teljes kártya
  expect(await screen.findByText('07:12 · Alvás-reakció')).toBeInTheDocument()
  expect(screen.getByText(/zsinórban a harmadik/)).toBeInTheDocument()
  // a morning (07:05) összecsukott: a fejsora látszik, a törzse (teljes kártya body) nem —
  // a `.pv` egysoros előnézet a saját szövegét (ellipszissel vágva CSS-ben) megjelenítheti,
  // csak a teljes kártya `.txt` bekezdése nem létezhet még.
  expect(screen.queryByText(/W3-csúcs/, { selector: '.txt' })).toBeNull()
  const row = screen.getByRole('button', { name: /07:05.*Reggeli briefing/ })
  expect(row).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(row)
  expect(await screen.findByText(/W3-csúcs/)).toBeInTheDocument()
  // kibontva a chipjei is élnek (mezo-kr9v: artifactos sor)
  const msg = screen.getByText('07:05 · Reggeli briefing').closest('.nap-mzmsg') as HTMLElement
  await userEvent.click(within(msg).getByRole('button', { name: /Segített/ }))
  expect(voteMock.vote).toHaveBeenCalledWith('fm-1', 'up', undefined)
})

test('egyetlen üzenet nem kap összecsukott sort', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  renderPage()
  expect(await screen.findByText(/W3-csúcs/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /07:05.*Reggeli briefing/ })).toBeNull()
})

// ── Chat-mintájú ref-chipek (mezo-z4h4): a "mit nézett meg Mezo" rész a chat-oldal
// domain-ikonos, emberi címkés, csoportosított chipjeit kapja a nyers `[FuelDay]` szöveg
// helyett.
test('a ref-chipek a chat-mintát követik: csoportosított, emberi címkés, nem nyers [Kind] szöveg', async () => {
  feedMock.useCompanionFeed.mockReturnValue([refsMsg])
  renderPage()
  expect(await screen.findByText('Sok forrásra épült ez a nap.')).toBeInTheDocument()
  expect(screen.getByText('Amire épült')).toBeInTheDocument()
  expect(screen.queryByText(/\[FuelDay\]/)).toBeNull()
  expect(screen.queryByText(/\[Practice\]/)).toBeNull()
  const fuelGroup = screen.getByRole('button', { name: /Fuel nap.*×2/ })
  expect(fuelGroup).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('button', { name: /Gyakorlat.*×2/ })).toBeInTheDocument()
  await userEvent.click(fuelGroup)
  expect(await screen.findByText('aug. 25.')).toBeInTheDocument()
  expect(screen.getByText('aug. 26.')).toBeInTheDocument()
})

// ── Visszacsukható régebbi üzenet (mezo-z4h4): a korábbi `expand`-only halmaz miatt egy
// felhasználó által kinyitott régebbi kártyát soha nem lehetett visszacsukni.
test('egy felhasználó által kinyitott régebbi kártya az összecsukás gombbal visszacsukható', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg, sleepMsg])
  renderPage()
  const row = await screen.findByRole('button', { name: /07:05.*Reggeli briefing/ })
  await userEvent.click(row)
  expect(await screen.findByText(/W3-csúcs/)).toBeInTheDocument()
  const msg = screen.getByText('07:05 · Reggeli briefing').closest('.nap-mzmsg') as HTMLElement
  const collapseBtn = within(msg).getByRole('button', { name: 'Összecsukás' })
  expect(collapseBtn).toHaveAttribute('aria-expanded', 'true')
  await userEvent.click(collapseBtn)
  expect(screen.queryByText(/W3-csúcs/, { selector: '.txt' })).toBeNull()
  expect(await screen.findByRole('button', { name: /07:05.*Reggeli briefing/ })).toBeInTheDocument()
})

test('a legújabb üzenetnek nincs összecsukás gombja', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg, sleepMsg])
  renderPage()
  const sleepCard = (await screen.findByText('07:12 · Alvás-reakció')).closest('.nap-mzmsg') as HTMLElement
  expect(within(sleepCard).queryByRole('button', { name: 'Összecsukás' })).toBeNull()
})

test('a deeplink célkártyának nincs összecsukás gombja, akkor sem, ha nem a legújabb', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg, sleepMsg])
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[`/nap/uzenetek?n=fm-1&d=${localDateString()}`]}>
        <MezoThreadProvider>
          <Routes><Route path="/nap/uzenetek" element={<NapMezoPage />} /></Routes>
        </MezoThreadProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
  const card = (await screen.findByText('07:05 · Reggeli briefing')).closest('.nap-mzmsg') as HTMLElement
  expect(within(card).queryByRole('button', { name: 'Összecsukás' })).toBeNull()
})

test('a persisted feed message carries the feedback chips and votes with its artifactId', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  renderPage()
  const card = await screen.findByText('07:05 · Reggeli briefing')
  const msg = card.closest('.nap-mzmsg') as HTMLElement
  await userEvent.click(within(msg).getByRole('button', { name: /Segített/ }))
  expect(voteMock.vote).toHaveBeenCalledWith('fm-1', 'up', undefined)
})

test('the demo briefing card carries NO feedback chips — nothing persisted to vote on', async () => {
  feedMock.useCompanionFeed.mockReturnValue([])
  renderPage()
  const meta = await screen.findByText('Demo tartalom')
  const msg = meta.closest('.nap-mzmsg') as HTMLElement
  expect(within(msg).queryByRole('button', { name: /Segített/ })).toBeNull()
})

// ── Tab-szétválasztás (mezo-ho9k): a nudge-ok az Életjelek tabra költöznek.
test('alapból az Üzenetek tab aktív, a nudge nem látszik — az Életjelek tabra váltva igen', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [{ key: 'hidratacio', pct: 12, band: 'red' }]
  renderPage()
  expect(await screen.findByText('07:05 · Reggeli briefing')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Üzenetek/ })).toHaveAttribute('aria-selected', 'true')
  expect(screen.queryByText(/alig ittál/)).toBeNull()
  await userEvent.click(screen.getByRole('tab', { name: /Életjelek/ }))
  expect(await screen.findByText(/alig ittál/)).toBeInTheDocument()
  expect(screen.queryByText('07:05 · Reggeli briefing')).toBeNull()
})

test('a nudge naponta egyszer jelenik meg az Életjelek tabon (megjelenés-napló változatlan)', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [{ key: 'hidratacio', pct: 12, band: 'red' }]
  const { unmount } = renderPage()
  await userEvent.click(await screen.findByRole('tab', { name: /Életjelek/ }))
  expect(await screen.findByText(/alig ittál/)).toBeInTheDocument()
  unmount()
  renderPage()
  await userEvent.click(await screen.findByRole('tab', { name: /Életjelek/ }))
  expect(await screen.findByText(/alig ittál/)).toBeInTheDocument()
  expect(document.querySelectorAll('.nap-mzmsg')).toHaveLength(1)
})

test('?tab=eletjelek induláskor az Életjelek tabot nyitja', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [{ key: 'hidratacio', pct: 12, band: 'red' }]
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/nap/uzenetek?tab=eletjelek']}>
        <MezoThreadProvider>
          <Routes><Route path="/nap/uzenetek" element={<NapMezoPage />} /></Routes>
        </MezoThreadProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
  expect(await screen.findByText(/alig ittál/)).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Életjelek/ })).toHaveAttribute('aria-selected', 'true')
})

test('mezo-z4h4: a nudge card head shows the need\'s clay icon instead of a daypart spot, and the collapsed row previews the same icon', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [{ key: 'hidratacio', pct: 12, band: 'red' }]
  renderPage()
  await userEvent.click(await screen.findByRole('tab', { name: /Életjelek/ }))
  expect(await screen.findByText(/alig ittál/)).toBeInTheDocument()
  // hidratacio → i-viz (NEED_ICON, needs.ts), the same clay icon EletjelPage's VITAL_TILE uses.
  expect(document.querySelector('.nap-mzmsg use[href="#i-viz"]')).not.toBeNull()
  // Copy no longer starts with the 💧 emoji — the icon replaces it.
  expect(document.querySelector('.nap-mzmsg .txt')?.textContent).not.toMatch(/💧/)
})

test('a healthy ring set adds nothing to the thread', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [{ key: 'hidratacio', pct: 82, band: 'green' }]
  renderPage()
  expect(await screen.findByText('07:05 · Reggeli briefing')).toBeInTheDocument()
  expect(document.querySelectorAll('.nap-mzmsg')).toHaveLength(1)
})

// ── Életjelek tab státusz-sáv (mezo-ho9k): mindig látszik, sosem üres a tab.
test('az Életjelek tab a 6 gyűrű státusz-sávját mutatja, riasztás nélkül "minden rendben" sorral', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [
    { key: 'energia', pct: 72, band: 'green' }, { key: 'hidratacio', pct: 82, band: 'green' },
    { key: 'pihenes', pct: 88, band: 'green' }, { key: 'mozgas', pct: 65, band: 'green' },
    { key: 'lelek', pct: 60, band: 'green' }, { key: 'rend', pct: 55, band: 'yellow' },
  ]
  renderPage()
  await userEvent.click(await screen.findByRole('tab', { name: /Életjelek/ }))
  expect(await screen.findByText('Víz')).toBeInTheDocument() // hidratacio eyebrow (EletjelPage tile-nyelv)
  expect(screen.getByText('82%')).toBeInTheDocument()
  const okLine = screen.getByText(/Minden gyűrű rendben/)
  expect(okLine).toBeInTheDocument()
  // mezo-z4h4: emoji→icon pass — the trailing ✓ glyph is now the Icon component, not a
  // literal character in the text content.
  expect(okLine.textContent).not.toMatch(/✓/)
  expect(okLine.querySelector('svg polyline[points="4,12 10,18 20,6"]')).not.toBeNull()
  expect(document.querySelectorAll('.nap-ejcell')).toHaveLength(6)
})

test('piros gyűrű cellája warn jelölést kap, és a nudge-kártya alatta áll — nincs "minden rendben"', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [{ key: 'hidratacio', pct: 12, band: 'red' }]
  renderPage()
  await userEvent.click(await screen.findByRole('tab', { name: /Életjelek/ }))
  expect(await screen.findByText(/alig ittál/)).toBeInTheDocument()
  expect(document.querySelector('.nap-ejcell.warn')).not.toBeNull()
  expect(screen.queryByText(/Minden gyűrű rendben/)).toBeNull()
  // A nudge-kártya megvan a szálban — az őszinte figyelmeztető sor SEM kell mellé
  // (mezo-z4h4): a kártya már elmondja, a sor csak a kártya-nélküli esetre való.
  expect(screen.queryByText(/figyelmet kér/)).toBeNull()
})

// mezo-z4h4: a bug ("Minden gyűrű rendben" miközben mind a hat gyűrű 0%-on áll) abból jött,
// hogy az üres sor a NUDGE-LISTA hosszát nézte, nem a gyűrűk sávját — `deriveNudges` pedig
// elnyeli a friss nudge-ot az éjszakai/ébredés utáni csendes ablakban. A csendes ablakra
// állított óra pontosan ezt az esetet szimulálja: piros gyűrű, de a szálban NINCS nudge-kártya.
test('csendes ablakban elnyelt nudge esetén (piros gyűrű, nudge-kártya nélkül) őszinte figyelmeztető sor jön a "minden rendben" helyett', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [{ key: 'hidratacio', pct: 12, band: 'red' }]
  tickMock.now = new Date('2026-05-22T03:00:00') // mélyéjszaka — deriveNudges csendes ablaka
  renderPage()
  await userEvent.click(await screen.findByRole('tab', { name: /Életjelek/ }))
  expect(document.querySelector('.nap-ejcell.warn')).not.toBeNull()
  expect(document.querySelectorAll('.nap-mzmsg')).toHaveLength(0) // nincs nudge-kártya a szálban
  expect(screen.queryByText(/Minden gyűrű rendben/)).toBeNull()
  expect(screen.getByText('Egy gyűrű figyelmet kér — a részletekért koppints a sávra.')).toBeInTheDocument()
  expect(document.querySelector('.nap-ejok.warn')).not.toBeNull()
})

test('csendes ablakban több elnyelt piros/kritikus gyűrű esetén a figyelmeztető sor többes számot használ helyesen', async () => {
  feedMock.useCompanionFeed.mockReturnValue([])
  needsMock.states = [
    { key: 'hidratacio', pct: 12, band: 'red' },
    { key: 'energia', pct: 5, band: 'critical' },
    { key: 'pihenes', pct: 80, band: 'green' },
  ]
  tickMock.now = new Date('2026-05-22T03:00:00')
  renderPage()
  await userEvent.click(await screen.findByRole('tab', { name: /Életjelek/ }))
  expect(document.querySelectorAll('.nap-mzmsg')).toHaveLength(0)
  expect(screen.getByText('2 gyűrű figyelmet kér — a részletekért koppints a sávra.')).toBeInTheDocument()
})

test('a státusz-sáv a teljes életjel-oldalra visz', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [{ key: 'hidratacio', pct: 82, band: 'green' }]
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/nap/uzenetek?tab=eletjelek']}>
        <MezoThreadProvider>
          <Routes>
            <Route path="/nap/uzenetek" element={<NapMezoPage />} />
            <Route path="/nap/eletjel" element={<div>eletjel-page</div>} />
          </Routes>
        </MezoThreadProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Életjelek részletei' }))
  expect(await screen.findByText('eletjel-page')).toBeInTheDocument()
})

test('the chat CTA navigates to /mezo/chat', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Beszélgess Mezóval ›' }))
  expect(await screen.findByText('chat-page')).toBeInTheDocument()
})

test('opening the thread stamps the read watermark — the hub tile’s unread counter clears (mezo-d20.11)', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg, sleepMsg])
  renderPage()
  await screen.findByText('07:12 · Alvás-reakció')
  // the watermark is the LAST thread item's id (the sheet's own seenMessages idiom).
  // The date key comes from the shared minute tick (MezoThreadProvider, mezo-atry) — here
  // that is the pinned clock above, not the wall clock.
  expect(lastSeenMessage(localDateString(new Date('2026-05-22T13:42:00')))).toBe('sleep')
})

// ── Tab-pöttyök (mezo-ho9k): belépéskori olvasatlan-pillanatkép, tab-látogatása törli.
test('olvasatlan nudge mellett az Életjelek tabon pötty ég, és a tab meglátogatása törli', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [{ key: 'hidratacio', pct: 12, band: 'red' }]
  renderPage()
  await screen.findByText('07:05 · Reggeli briefing')
  const ejTab = screen.getByRole('tab', { name: /Életjelek/ })
  expect(ejTab.querySelector('.nap-mzdot')).not.toBeNull()
  // az aktív Üzenetek tabon nincs pötty (ott van a user)
  expect(screen.getByRole('tab', { name: /Üzenetek/ }).querySelector('.nap-mzdot')).toBeNull()
  await userEvent.click(ejTab)
  expect(ejTab.querySelector('.nap-mzdot')).toBeNull()
})

test('minden olvasottnak jelölve → egyik tabon sincs pötty', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [{ key: 'hidratacio', pct: 12, band: 'red' }]
  const { unmount } = renderPage()
  await screen.findByText('07:05 · Reggeli briefing') // markSeen lefutott
  unmount()
  renderPage()
  await screen.findByText('07:05 · Reggeli briefing')
  expect(document.querySelector('.nap-mzdot')).toBeNull()
})
