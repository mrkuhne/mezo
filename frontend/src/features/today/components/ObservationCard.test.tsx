import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom'
import { ObservationCard } from '@/features/today/components/ObservationCard'
import { observations as seed } from '@/data/insights/observations'
import { mapEvidence, type WireEvidence } from '@/shared/ui/evidence/observationEvidence'
import type { Observation } from '@/data/types'

function ChatProbe() {
  const [params] = useSearchParams()
  return <div>chat:{params.get('c')}</div>
}

const fresh = seed[0]
const back = seed[1]
const watching = seed[2]
const confirmed = seed[3]

function renderCard(item: Observation, onReply = vi.fn()) {
  render(
    <MemoryRouter>
      <ObservationCard item={item} onReply={onReply} />
    </MemoryRouter>,
  )
  return onReply
}

test('a fresh card renders the Mezo sentence, the question and three chips', () => {
  renderCard(fresh)
  expect(screen.getByText('Anna és az alvásod')).toBeInTheDocument()
  expect(screen.getByText('ÚJ')).toBeInTheDocument()
  expect(screen.getByText('ÚJ')).toHaveClass('fo-st', 'plan')
  const say = document.querySelector('.nb-obs .fo-msg .nb-say')
  expect(say?.textContent).toContain('40 perccel többet')
  expect(document.querySelector('.nb-ask')?.textContent).toContain('Figyeljem tovább?')
  const chips = document.querySelectorAll('.nb-chips button')
  expect(chips).toHaveLength(3)
  expect([...chips].map((c) => c.textContent)).toEqual(['Igen, ez igaz rám', 'Nem, ez nem stimmel', 'Beszéljük meg'])
  // Folyadék (mezo-n4wf5.2): a white kit card, the source glyph in the head's chip, Mezo as a
  // glyph badge — no glass, no Boop; the first reply is the liquid button, the rest are ghosts.
  expect(document.querySelector('.nb-obs.fo-card .fo-head .fo-bub use[href="#t-journal"]')).not.toBeNull()
  expect(document.querySelector('.nb-obs .fo-msg .fo-badge use[href="#t-orb"]')).not.toBeNull()
  expect(document.querySelector('.nb-q .nb-qeb .fo-badge')).not.toBeNull()
  expect(document.querySelector('.glass')).toBeNull()
  expect(document.querySelector('.boop')).toBeNull()
  expect([...chips].map((c) => c.classList.contains('ghost'))).toEqual([false, true, true])
})

// A dróton az időpont UTC-ben jön (`…T12:12:00Z`). A nyers karakterlánc-szeletelés az UTC
// órát írta volna ki (12:12), a mock-seed csak azért nem buktatta le, mert az ő bélyegeiről
// hiányzik a `Z`. Ezért a teszt a zónát is rögzíti - különben egy UTC-ben futó gépen
// mindkét megvalósítás átmenne.
describe('az eyebrow ideje HELYI idő, nem UTC', () => {
  const originalTz = process.env.TZ
  beforeAll(() => { process.env.TZ = 'Europe/Budapest' })
  afterAll(() => { process.env.TZ = originalTz })

  test('a Z-vel érkező időbélyeg a helyi órát mutatja', () => {
    renderCard({ ...fresh, occurredAt: '2026-05-22T12:12:00Z' })
    expect(document.querySelector('.nb-obs .fo-msg .nm small')?.textContent).toContain('14:12')
    expect(document.querySelector('.nb-obs .fo-msg .nm small')?.textContent).not.toContain('12:12')
  })
})

test('a return card offers the same three replies as a fresh card', async () => {
  const onReply = renderCard(back)
  const chips = document.querySelectorAll('.nb-chips button')
  expect([...chips].map((c) => c.textContent)).toEqual(['Igen, ez igaz rám', 'Nem, ez nem stimmel', 'Beszéljük meg'])
  expect(screen.getByText('FIGYELEM')).toHaveClass('fo-st', 'warn')

  await userEvent.click(screen.getByRole('button', { name: 'Igen, ez igaz rám' }))
  expect(onReply).toHaveBeenCalledWith(back.patternId, 'watch')
})

test("a return card's 'Nem, ez nem stimmel' chip answers reject", async () => {
  const onReply = renderCard(back)
  await userEvent.click(screen.getByRole('button', { name: 'Nem, ez nem stimmel' }))
  expect(onReply).toHaveBeenCalledWith(back.patternId, 'reject')
})

test('watching and confirmed cards carry no chips at all - nothing to answer', () => {
  const { unmount } = render(
    <MemoryRouter><ObservationCard item={watching} onReply={vi.fn()} /></MemoryRouter>,
  )
  expect(document.querySelector('.nb-chips')).toBeNull()
  unmount()
  render(<MemoryRouter><ObservationCard item={confirmed} onReply={vi.fn()} /></MemoryRouter>)
  expect(document.querySelector('.nb-chips')).toBeNull()
  expect(screen.getByText('BEÉPÜLT')).toHaveClass('fo-st', 'ok')
})

test('tapping „Igen, ez igaz rám" replies watch and flips the card to its acknowledgement line', async () => {
  const onReply = renderCard(fresh)
  await userEvent.click(screen.getByRole('button', { name: 'Igen, ez igaz rám' }))

  expect(onReply).toHaveBeenCalledWith(fresh.patternId, 'watch')
  expect(document.querySelector('.nb-chips')).toBeNull()
  expect(document.querySelector('.nb-ack')?.textContent)
    .toBe('Megjegyeztem, hogy ez igaz rád. Az összefüggést tovább figyelem.')
})

test('a measurable-less fresh card acknowledges without promising a day count', async () => {
  const onReply = renderCard({ ...fresh, minN: undefined })
  await userEvent.click(screen.getByRole('button', { name: 'Igen, ez igaz rám' }))

  expect(onReply).toHaveBeenCalledWith(fresh.patternId, 'watch')
  expect(document.querySelector('.nb-ack')?.textContent)
    .toBe('Megjegyeztem, hogy ez igaz rád. Az összefüggést tovább figyelem.')
})

test('a card the server already knows the answer to opens acknowledged, without chips', () => {
  renderCard({ ...fresh, repliedChoice: 'reject' })
  expect(document.querySelector('.nb-chips')).toBeNull()
  expect(document.querySelector('.nb-ack')?.textContent)
    .toBe('Értem, ez nem stimmel. Nem hozom fel újra ebben a formában.')
})

test("the chip group is disabled while that card's reply is in flight - no double reply", async () => {
  const onReply = vi.fn()
  render(
    <MemoryRouter>
      <ObservationCard item={fresh} onReply={onReply} pending />
    </MemoryRouter>,
  )
  const chip = screen.getByRole('button', { name: 'Igen, ez igaz rám' })
  expect(chip).toBeDisabled()
  await userEvent.click(chip)
  expect(onReply).not.toHaveBeenCalled()
})

test('a watching card shows the 8-vessel tally (full / dashed / empty), the 5 / 8 evidence line with its legend and the lab link', () => {
  renderCard(watching)
  expect(screen.getByText('GYŰLIK')).toHaveClass('fo-st', 'plan')
  const slots = document.querySelectorAll('.nb-tally i')
  expect(slots).toHaveLength(8)
  // mezo-n4wf5.2: each day is a small vessel - a hit is full, a miss is dashed, a missing day is
  // empty. The meaning stays in the data hook AND in each slot's accessible text.
  expect([...slots].map((s) => s.getAttribute('data-slot')))
    .toEqual(['hit', 'hit', 'hit', 'hit', 'miss', 'none', 'none', 'none'])
  expect([...slots].map((s) => s.textContent)).toEqual([
    'bejött', 'bejött', 'bejött', 'bejött', 'nem jött be', 'még nincs adat', 'még nincs adat', 'még nincs adat',
  ])
  expect([...slots].map((s) => s.className)).toEqual(['hit', 'hit', 'hit', 'hit', 'miss', 'none', 'none', 'none'])
  expect(document.querySelector('.nb-tally')?.textContent).not.toMatch(/[✓✕·]/)
  expect(document.querySelector('.nb-tally')).toHaveAttribute(
    'aria-label', 'Napok: bejött, nem jött be, még nincs adat',
  )
  expect(screen.getByText('Bizonyíték · 5 / 8 nap')).toBeInTheDocument()
  expect([...document.querySelectorAll('.nb-leg span')].map((x) => x.textContent))
    .toEqual(['egybevág', 'ellene szól', 'még hiányzik'])
  // the watching card has no prose - the question line carries the numbers instead; its kind
  // label stands beside the state pill
  expect(document.querySelector('.nb-say')).toBeNull()
  expect(document.querySelector('.nb-obst .nb-obeb')?.textContent).toBe('Figyelem · 5 megfigyelt nap')
  expect(screen.getByRole('link', { name: 'Laborfüzet ›' }))
    .toHaveAttribute('href', `/mezo/patterns/${watching.hypothesisKey}`)
})

test('a row with no hypothesis key offers no lab link to a page that cannot exist', () => {
  renderCard({ ...watching, hypothesisKey: undefined })
  expect(screen.queryByRole('link', { name: 'Laborfüzet ›' })).toBeNull()
})

test('„Beszéljük meg" replies talk and, with a conversation id back, opens that chat thread', async () => {
  const onReply = vi.fn().mockResolvedValue({ conversationId: 'conv-9' })
  render(
    <MemoryRouter initialEntries={['/nap/uzenetek']}>
      <Routes>
        <Route path="/nap/uzenetek" element={<ObservationCard item={fresh} onReply={onReply} />} />
        <Route path="/mezo/chat" element={<ChatProbe />} />
      </Routes>
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Beszéljük meg' }))
  expect(onReply).toHaveBeenCalledWith(fresh.patternId, 'talk')
  expect(await screen.findByText('chat:conv-9')).toBeInTheDocument()
})

test('„Beszéljük meg" without a conversation id stays put and only acknowledges', async () => {
  const onReply = vi.fn().mockResolvedValue({})
  render(
    <MemoryRouter initialEntries={['/nap/uzenetek']}>
      <Routes>
        <Route path="/nap/uzenetek" element={<ObservationCard item={fresh} onReply={onReply} />} />
        <Route path="/mezo/chat" element={<ChatProbe />} />
      </Routes>
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Beszéljük meg' }))
  expect(await screen.findByText('Megnyitom a chatet ezzel a szállal.')).toBeInTheDocument()
  expect(screen.queryByText(/^chat:/)).toBeNull()
})

test('egy elbukott válasz NEM hazudik nyugtázást - a chipek visszajönnek hibasorral', async () => {
  const onReply = vi.fn().mockRejectedValue(new Error('boom'))
  render(
    <MemoryRouter><ObservationCard item={fresh} onReply={onReply} /></MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Igen, ez igaz rám' }))

  expect(await screen.findByText('Nem sikerült elküldeni — próbáld újra.')).toBeInTheDocument()
  expect(document.querySelector('.nb-ack')).toBeNull()
  expect(screen.getByRole('button', { name: 'Igen, ez igaz rám' })).toBeInTheDocument()
})


test('statistical watching exposes source evidence and detail link without invented reflection tally', () => {
  renderCard({ ...watching, kind: 'statistical', evidenceHits: 0, evidenceMisses: 0,
    minN: undefined, evidence: [mapEvidence({ type: 'tag', text: '2026-09-09 · Check-in: stressz' })], hypothesisKey: 'stress_sleep' })
  expect(screen.getByText('2026-09-09 · Check-in: stressz')).toBeInTheDocument()
  expect(document.querySelector('.nb-tally')).toBeNull()
  expect(document.querySelector('.nb-leg')).toBeNull()
  expect(document.querySelector('.nb-obst .nb-obeb')?.textContent).toBe('Figyelt összefüggés')
  expect(screen.getByRole('link', { name: 'Laborfüzet ›' })).toHaveAttribute('href', '/mezo/patterns/stress_sleep')
  expect(screen.queryByRole('group', { name: 'Válaszod az észrevételre' })).toBeNull()
})

test('return confirmation records experience without calling it measured proof', async () => {
  renderCard(back)
  await userEvent.click(screen.getByRole('button', { name: 'Igen, ez igaz rám' }))
  expect(document.querySelector('.nb-ack')?.textContent)
    .toBe('Megjegyeztem, hogy ez igaz rád. Az összefüggést tovább figyelem.')
})

test('older unanswered card retains its original observation date', () => {
  renderCard({ ...fresh, occurredAt: '2026-05-22T12:12:00Z' })
  // the kind label rides beside Mezo's name, in the meta's quiet lower case
  const eb = document.querySelector('.nb-obs .fo-msg .nm small')?.textContent ?? ''
  expect(eb).toMatch(/^feltűnt · máj\. 22\. \d\d:\d\d$/)
})

// mezo-d6ivw.1: a strukturált bizonyíték tagolt sorokká bomlik, két check-in közös
// változás-grafikont kap, és a kérdés a válasz-pillek fölött ül.
const RAW_EVIDENCE = Array.of<WireEvidence>(
  { type: 'record', source: 'sport_session', date: '2026-09-17', time: '20:46',
    fields: { sport: 'volleyball', duration_min: '120', rpe: '7.0', shoulder_strain: '6', kcal: '975', kcal_is_estimate: 'true' },
    quote: 'Típus: Edzés' },
  { type: 'record', source: 'check_in', date: '2026-09-22', time: '14:00',
    fields: { energy: '7', stress: '2', body: '8', mental: '8' }, quote: 'Jól vagyok' },
  { type: 'record', source: 'check_in', date: '2026-09-22', time: '20:00',
    fields: { energy: '4', stress: '1', body: '9', mental: '10' }, quote: 'Jó a randi' },
).map(mapEvidence)

test('a Mezo-mondat egyenes szöveg, a nyers bizonyíték tagolt sorokként jelenik meg', () => {
  renderCard({ ...fresh, evidence: RAW_EVIDENCE })
  expect(document.body.textContent).not.toContain('shoulder_strain')
  expect(document.body.textContent).not.toContain('kcal_is_estimate')
  const rows = document.querySelectorAll('.nap-ev-row')
  expect(rows).toHaveLength(3)
  expect(rows[0].querySelector('.nap-ev-src strong')?.textContent).toBe('Röplabda')
  expect(rows[0].querySelector('use[href="#t-volley"]')).not.toBeNull()
  expect([...rows[0].querySelectorAll('.nap-ev-vals span')].map((s) => s.textContent))
    .toEqual(['120perc', 'RPE 7/10', 'Vállterhelés 6/10', '~975kcal'])
  expect(rows[0].querySelector('.nap-ev-quote')?.textContent).toBe('„Típus: Edzés”')
  // a két check-in sora számok nélkül; a változás egy közös blokkban
  expect(document.querySelectorAll('.nap-ev-cells')).toHaveLength(0)
  const energy = document.querySelector('.nap-sh-row[data-dim="energy"]')
  expect(energy?.querySelector('.nap-sh-n')?.textContent).toBe('7→4')
  expect(energy?.querySelector('.nap-sh-d')?.textContent).toBe('−3')
  expect(document.querySelector('.nap-ev-shift')).toHaveAttribute('aria-label', 'Változás: 14:00 → 20:00')
  expect(screen.getByText('Miből látom · 3 bejegyzés')).toBeInTheDocument()
  // a kérdés a válasz-gombok blokkjában ül
  expect(document.querySelector('.nb-q .nb-ask')?.textContent).toContain('Figyeljem tovább?')
  expect(document.querySelector('.nb-q .nb-chips')).not.toBeNull()
})

test('a bizonyíték nyitva indul, csukható; megválaszolt kártyán csukva, koppintásra nyílik', async () => {
  const { unmount } = render(
    <MemoryRouter><ObservationCard item={{ ...fresh, evidence: RAW_EVIDENCE }} onReply={vi.fn()} /></MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Elrejtem' }))
  expect(document.querySelector('.nap-ev-row')).toBeNull()
  unmount()
  renderCard({ ...fresh, evidence: RAW_EVIDENCE, repliedChoice: 'watch' })
  expect(document.querySelector('.nap-ev-row')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Megnézem ›' }))
  expect(document.querySelectorAll('.nap-ev-row')).toHaveLength(3)
})
