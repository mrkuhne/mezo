import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom'
import { ObservationCard } from '@/features/today/components/ObservationCard'
import { observations as seed } from '@/data/insights/observations'
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

test('a fresh card renders the italic Mezo sentence, the question and three chips', () => {
  renderCard(fresh)
  expect(screen.getByText('Anna és az alvásod')).toBeInTheDocument()
  expect(screen.getByText('ÚJ')).toBeInTheDocument()
  const say = document.querySelector('.nap-obs-say')
  expect(say?.textContent).toContain('40 perccel többet')
  expect(document.querySelector('.nap-obs-ask')?.textContent).toContain('Figyeljem tovább?')
  const chips = document.querySelectorAll('.nap-obs-chips button')
  expect(chips).toHaveLength(3)
  expect([...chips].map((c) => c.textContent)).toEqual(['Igen, figyeld', 'Nem stimmel', 'Mesélj'])
  expect(document.querySelector('.nap-obs use[href="#i-naplo"]')).not.toBeNull()
})

test('a return card offers exactly the two verdict chips mapped to watch / reject', async () => {
  const onReply = renderCard(back)
  const chips = document.querySelectorAll('.nap-obs-chips button')
  expect([...chips].map((c) => c.textContent)).toEqual(['Így van', 'Kivétel volt'])
  expect(screen.getByText('FIGYELEM')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Így van' }))
  expect(onReply).toHaveBeenCalledWith(back.patternId, 'watch')
})

test('a return card’s "Kivétel volt" chip answers reject', async () => {
  const onReply = renderCard(back)
  await userEvent.click(screen.getByRole('button', { name: 'Kivétel volt' }))
  expect(onReply).toHaveBeenCalledWith(back.patternId, 'reject')
})

test('watching and confirmed cards carry no chips at all — nothing to answer', () => {
  const { unmount } = render(
    <MemoryRouter><ObservationCard item={watching} onReply={vi.fn()} /></MemoryRouter>,
  )
  expect(document.querySelector('.nap-obs-chips')).toBeNull()
  unmount()
  render(<MemoryRouter><ObservationCard item={confirmed} onReply={vi.fn()} /></MemoryRouter>)
  expect(document.querySelector('.nap-obs-chips')).toBeNull()
  expect(screen.getByText('BEÉPÜLT')).toBeInTheDocument()
})

test('tapping „Igen, figyeld" replies watch and flips the card to its acknowledgement line', async () => {
  const onReply = renderCard(fresh)
  await userEvent.click(screen.getByRole('button', { name: 'Igen, figyeld' }))

  expect(onReply).toHaveBeenCalledWith(fresh.patternId, 'watch')
  expect(document.querySelector('.nap-obs-chips')).toBeNull()
  expect(document.querySelector('.nap-obs-ack')?.textContent)
    .toBe('Rendben, figyelem. Nyolc napnál újra szólok.')
})

test('a card the server already knows the answer to opens acknowledged, without chips', () => {
  renderCard({ ...fresh, repliedChoice: 'reject' })
  expect(document.querySelector('.nap-obs-chips')).toBeNull()
  expect(document.querySelector('.nap-obs-ack')?.textContent)
    .toBe('Értem, nem stimmel. Nem hozom fel újra ebben a formában.')
})

test('the chip group is disabled while that card’s reply is in flight — no double reply', async () => {
  const onReply = vi.fn()
  render(
    <MemoryRouter>
      <ObservationCard item={fresh} onReply={onReply} pending />
    </MemoryRouter>,
  )
  const chip = screen.getByRole('button', { name: 'Igen, figyeld' })
  expect(chip).toBeDisabled()
  await userEvent.click(chip)
  expect(onReply).not.toHaveBeenCalled()
})

test('a watching card shows the 8-slot tally as text glyphs, the 5 / 8 progress and the lab link', () => {
  renderCard(watching)
  expect(screen.getByText('GYŰLIK')).toBeInTheDocument()
  const slots = document.querySelectorAll('.nap-obs-tally i')
  expect(slots).toHaveLength(8)
  expect([...slots].map((s) => s.textContent).join('')).toBe('✓✓✓✓✕···')
  expect(document.querySelector('.nap-obs-tally')).toHaveAttribute(
    'aria-label', 'Napok: bejött, nem jött be, még nincs adat',
  )
  expect(screen.getByText('5 / 8 nap')).toBeInTheDocument()
  expect(document.querySelector('.nap-obs-prog')).toHaveAttribute('aria-label', '5 a szükséges 8 napból')
  // the watching card has no prose — the question line carries the numbers instead
  expect(document.querySelector('.nap-obs-say')).toBeNull()
  expect(screen.getByRole('link', { name: 'Laborfüzet ›' }))
    .toHaveAttribute('href', `/mezo/patterns/${watching.hypothesisKey}`)
})

test('a row with no hypothesis key offers no lab link to a page that cannot exist', () => {
  renderCard({ ...watching, hypothesisKey: undefined })
  expect(screen.queryByRole('link', { name: 'Laborfüzet ›' })).toBeNull()
})

test('„Mesélj" replies talk and, with a conversation id back, opens that chat thread', async () => {
  const onReply = vi.fn().mockResolvedValue({ conversationId: 'conv-9' })
  render(
    <MemoryRouter initialEntries={['/nap/uzenetek']}>
      <Routes>
        <Route path="/nap/uzenetek" element={<ObservationCard item={fresh} onReply={onReply} />} />
        <Route path="/mezo/chat" element={<ChatProbe />} />
      </Routes>
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Mesélj' }))
  expect(onReply).toHaveBeenCalledWith(fresh.patternId, 'talk')
  expect(await screen.findByText('chat:conv-9')).toBeInTheDocument()
})

test('„Mesélj" without a conversation id stays put and only acknowledges', async () => {
  const onReply = vi.fn().mockResolvedValue({})
  render(
    <MemoryRouter initialEntries={['/nap/uzenetek']}>
      <Routes>
        <Route path="/nap/uzenetek" element={<ObservationCard item={fresh} onReply={onReply} />} />
        <Route path="/mezo/chat" element={<ChatProbe />} />
      </Routes>
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Mesélj' }))
  expect(await screen.findByText('Megnyitom a chatet ezzel a szállal.')).toBeInTheDocument()
  expect(screen.queryByText(/^chat:/)).toBeNull()
})

test('egy elbukott válasz NEM hazudik nyugtázást — a chipek visszajönnek hibasorral', async () => {
  const onReply = vi.fn().mockRejectedValue(new Error('boom'))
  render(
    <MemoryRouter><ObservationCard item={fresh} onReply={onReply} /></MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Igen, figyeld' }))

  expect(await screen.findByText('Nem sikerült elküldeni — próbáld újra.')).toBeInTheDocument()
  expect(document.querySelector('.nap-obs-ack')).toBeNull()
  expect(screen.getByRole('button', { name: 'Igen, figyeld' })).toBeInTheDocument()
})
