import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { TodaySessionCard } from '@/features/train/components/TodaySessionCard'

const base = {
  art: 't-run', tag: 'FUTÁS', time: '12:00', title: 'Sprint-intervallum',
  facts: ['RPE 9–10', '5 kör'], logged: false, stateLabel: 'MOST',
  ctaLabel: 'Naplózd a futást',
} as const

// ── Kihagyás S1 (mezo-q4xt2.1) — the skip row used below ──
const skipRow = {
  id: 'k1', kind: 'RUN' as const, date: '2026-09-29', sessionKey: 'tue', reasonCategory: 'TIRED' as const,
  reasonText: null, source: 'USER' as const, serious: false, freePass: true, excused: true,
}

// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `sessStep()`): the row face is a kit step —
// time, glyph bubble, title, „tag · facts" with the state chip — with the text-link actions under it.
test('row face: a step in its tone — time, the glyph bubble, title, „tag · facts", the state chip and the action link', () => {
  const onLog = vi.fn()
  const { container } = render(<TodaySessionCard {...base} tone="run" onLog={onLog} />)
  const card = container.querySelector('.em-sess.em-sess-run') as HTMLElement
  expect(card).toBeInTheDocument()
  // no old skin: no glass card, no lit well
  expect(container.querySelector('.glass, .uv-well, [class*="trm-"]')).toBeNull()
  expect(card.querySelector('.fo-step .si use')?.getAttribute('href')).toBe('#t-run')
  expect(card.querySelector('.fo-step time')?.textContent).toBe('12:00')
  expect(screen.getByText('Sprint-intervallum', { selector: '.em-sess-title' })).toBeInTheDocument()
  // the wire's upper-case tag reads as a word; the facts follow it on one line
  expect(card.querySelector('.em-sess-facts')?.textContent).toBe('Futás · RPE 9–10 · 5 kör')
  expect(screen.getByText('Most')).toHaveClass('fo-st', 'plan')
  fireEvent.click(screen.getByRole('button', { name: /Naplózd a futást/ }))
  expect(onLog).toHaveBeenCalledTimes(1)
})

test('each of the five tones gets its own tone class; TRX keeps its capitals', () => {
  for (const tone of ['gym', 'sport', 'cross', 'trx', 'run'] as const) {
    const { container, unmount } = render(<TodaySessionCard {...base} tone={tone} />)
    expect(container.querySelector(`.em-sess-${tone}`)).toBeInTheDocument()
    unmount()
  }
  const { container } = render(<TodaySessionCard {...base} tone="trx" tag="TRX" />)
  expect(container.querySelector('.em-sess-facts')?.textContent).toMatch(/^TRX · /)
})

test('one-off event: said after the facts', () => {
  const { container } = render(<TodaySessionCard {...base} tone="sport" oneOff />)
  expect(container.querySelector('.em-sess-facts')?.textContent).toBe('Futás · RPE 9–10 · 5 kör · egyszeri')
})

test('logged state: the green tick, the „Megvan" chip, the done line instead of the action, no state chip', () => {
  const onLog = vi.fn()
  const { container } = render(
    <TodaySessionCard
      {...base}
      tone="run"
      logged
      loggedSummary="RPE 9 · 5/5 kör"
      loggedDetail="12:04-kor logolva"
      onLog={onLog}
    />,
  )
  expect(container.querySelector('.em-sess.is-logged')).toBeInTheDocument()
  // the done mark is the tick glyph, its meaning spoken
  expect(screen.getByRole('img', { name: 'kész' }).querySelector('use')?.getAttribute('href')).toBe('#t-tick')
  expect(screen.getByText('Megvan')).toHaveClass('fo-st', 'ok')
  expect(screen.getByText('RPE 9 · 5/5 kör')).toBeInTheDocument()
  expect(screen.getByText('12:04-kor logolva')).toBeInTheDocument()
  expect(screen.queryByText('Most')).not.toBeInTheDocument()
  expect(screen.queryByText(/Naplózd a futást/)).not.toBeInTheDocument()
  // the done line's „Megnézem" link re-opens the sheet
  expect(screen.getByRole('button').textContent).toBe('Megnézem')
  fireEvent.click(screen.getByRole('button', { name: 'Sprint-intervallum — logolt session megnyitása' }))
  expect(onLog).toHaveBeenCalledTimes(1)
})

test('a read-only card (no ctaLabel) renders neither an action nor a „Megnézem" link', () => {
  render(<TodaySessionCard {...base} tone="sport" ctaLabel={undefined} stateLabel="TERVEZETT" />)
  expect(screen.getByText('Tervezett')).toHaveClass('fo-st', 'q')
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('onSkip: the Kihagyom link stands beside the action link', () => {
  const onSkip = vi.fn()
  const onLog = vi.fn()
  const { container } = render(<TodaySessionCard {...base} tone="run" onLog={onLog} onSkip={onSkip} />)
  const cta = container.querySelector('.fo-under.em-sess-cta')!
  const buttons = [...cta.querySelectorAll('button')]
  expect(buttons.map((b) => b.textContent)).toEqual(['Naplózd a futást', 'Kihagyom'])
  expect(buttons.every((b) => b.classList.contains('fo-lk'))).toBe(true)
  fireEvent.click(buttons[1])
  expect(onSkip).toHaveBeenCalledTimes(1)
  expect(onLog).not.toHaveBeenCalled()
})

test('onSkip with skipLabel Kihagytam (a past missed session)', () => {
  render(<TodaySessionCard {...base} tone="run" stateLabel="ELMARADT" onSkip={() => {}} skipLabel="Kihagytam" />)
  expect(screen.getByRole('button', { name: 'Kihagytam' })).toBeInTheDocument()
})

test('onSkip on a read-only card (no action) still shows the Kihagyom link', () => {
  render(<TodaySessionCard {...base} tone="run" ctaLabel={undefined} stateLabel="TERVEZETT" onSkip={() => {}} />)
  expect(screen.getByRole('button', { name: 'Kihagyom' })).toBeInTheDocument()
})

test('skipped: is-skip, the „Kihagyva" chip, the indented skipped box instead of the actions', () => {
  const onReason = vi.fn()
  const onUndo = vi.fn()
  const { container } = render(
    <TodaySessionCard {...base} tone="run" onLog={() => {}} onSkip={() => {}} skipped={skipRow}
      onSkipReason={onReason} onSkipUndo={onUndo} />,
  )
  expect(container.querySelector('.em-sess.is-skip')).toBeInTheDocument()
  expect(screen.getByText('Kihagyva')).toHaveClass('is-skip')
  expect(screen.queryByText('Most')).not.toBeInTheDocument()
  expect(container.querySelector('.fo-under.col .fo-box.em-skipd')).toBeInTheDocument()
  expect(screen.getByText('Kihagyva · Fáradt vagyok')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Naplózd a futást/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Kihagyom' })).not.toBeInTheDocument()
  // facts stay
  expect(container.querySelector('.em-sess-facts')?.textContent).toBe('Futás · RPE 9–10 · 5 kör')
  fireEvent.click(screen.getByRole('button', { name: 'Másik ok' }))
  expect(onReason).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /Visszavonom/ }))
  expect(onUndo).toHaveBeenCalled()
})

test('a missed state chip wears the bad tone', () => {
  render(<TodaySessionCard {...base} tone="run" stateLabel="ELMARADT" />)
  expect(screen.getByText('Elmaradt')).toHaveClass('is-miss', 'fo-st', 'bad')
})

// ── Kímélő mód S2 (mezo-q4xt2.2) — prototype kmIn() / the comeback run line ──
test('kimelo: the „Kímélő mód" chip, the calm kímélő line, no skip and no action (wins over a skip row)', () => {
  const { container } = render(
    <TodaySessionCard {...base} tone="sport" onLog={() => {}} onSkip={() => {}} skipped={skipRow} kimelo />,
  )
  expect(container.querySelector('.em-sess.is-skip')).toBeInTheDocument()
  expect(screen.getByText('Kímélő mód', { selector: '.fo-st' })).toHaveClass('is-skip', 'q')
  expect(container.querySelector('.fo-under.em-kmin use')?.getAttribute('href')).toBe('#t-kimelo')
  expect(container.querySelector('.fo-under.em-kmin')?.textContent).toContain('Kímélő mód · Magától kimarad · nem számít mulasztásnak.')
  expect(screen.queryByText(/Kihagyva/)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Kihagyom' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Naplózd a futást/ })).toBeNull()
})

test('kimelo never hides a logged session', () => {
  render(<TodaySessionCard {...base} tone="sport" logged loggedSummary="RPE 7" kimelo />)
  expect(screen.queryByText('Kímélő mód')).toBeNull()
  expect(screen.getByText('RPE 7')).toBeInTheDocument()
})

test('rampNote: the „Visszatérő futás" line above the action', () => {
  const { container } = render(<TodaySessionCard {...base} tone="run" onLog={() => {}} rampNote />)
  expect(screen.getByText('Visszatérő futás')).toBeInTheDocument()
  expect(container.querySelector('.fo-under.em-rampin')?.textContent).toContain('Első futás kihagyás után: kb. fele olyan hosszú, laza tempóban.')
  expect(container.querySelector('.fo-under.em-rampin use')?.getAttribute('href')).toBe('#t-sprout')
  expect(screen.getByRole('button', { name: /Naplózd a futást/ })).toBeInTheDocument()
})

// prototype `sessHero()` / `gymDayHero()`: the same session as the day's hero.
test('hero face: eyebrow „day · time · tag", the title as the verdict, state + facts, the button and the skip link on the liquid row', () => {
  const onLog = vi.fn()
  const onSkip = vi.fn()
  const { container } = render(<TodaySessionCard {...base} hero eyebrow="Ma" tone="run" onLog={onLog} onSkip={onSkip} />)
  const hero = container.querySelector('.fo-hero.em-sess.em-sess-hero.em-sess-run') as HTMLElement
  expect(hero).toBeInTheDocument()
  expect(hero.querySelector('.fo-hero-lbl')?.textContent).toBe('Ma · 12:00 · Futás')
  expect(hero.querySelector('.fo-hero-verdict .em-sess-title')?.textContent).toBe('Sprint-intervallum')
  expect(hero.querySelector('.fo-hero-sub')?.textContent).toBe('Most · RPE 9–10 · 5 kör')
  expect(hero.querySelector('.fo-hero-left .fo-bub use')?.getAttribute('href')).toBe('#t-run')
  const acts = [...hero.querySelectorAll('.fo-hero-acts button')]
  expect(acts.map((b) => b.textContent)).toEqual(['Naplózd a futást', 'Kihagyom'])
  fireEvent.click(acts[0])
  expect(onLog).toHaveBeenCalledTimes(1)
  fireEvent.click(acts[1])
  expect(onSkip).toHaveBeenCalledTimes(1)
})

test('hero face states: logged box + „Megnézem", kímélő box without actions, skipped box with its links, the comeback-run box, a graphic instead of the glyph', () => {
  const onLog = vi.fn()
  const a = render(<TodaySessionCard {...base} hero tone="run" logged loggedSummary="RPE 9 · 5 kör" loggedDetail="12:04-kor logolva" onLog={onLog} />)
  expect(a.container.querySelector('.em-sess.is-logged .fo-hero-sub')?.textContent).toBe('Megvan · RPE 9–10 · 5 kör')
  expect(a.container.querySelector('.fo-box.em-doneb')?.textContent).toBe('RPE 9 · 5 kör12:04-kor logolva')
  fireEvent.click(screen.getByRole('button', { name: 'Sprint-intervallum — logolt session megnyitása' }))
  expect(onLog).toHaveBeenCalledTimes(1)
  a.unmount()

  const b = render(<TodaySessionCard {...base} hero tone="sport" onLog={() => {}} onSkip={() => {}} kimelo />)
  expect(b.container.querySelector('.em-sess.is-skip .fo-box use')?.getAttribute('href')).toBe('#t-kimelo')
  expect(b.container.querySelector('.fo-hero')?.getAttribute('data-closed')).toBe('true')
  expect(screen.queryByRole('button')).toBeNull()
  b.unmount()

  const onReason = vi.fn()
  const c = render(<TodaySessionCard {...base} hero tone="run" onLog={() => {}} skipped={skipRow} onSkipReason={onReason} />)
  expect(c.container.querySelector('.fo-box.em-skipd')?.textContent).toContain('Kihagyva · Fáradt vagyok')
  expect([...c.container.querySelectorAll('.fo-hero-acts button')].map((x) => x.textContent)).toEqual(['Másik ok', 'Visszavonom'])
  fireEvent.click(screen.getByRole('button', { name: 'Másik ok' }))
  expect(onReason).toHaveBeenCalled()
  c.unmount()

  const d = render(<TodaySessionCard {...base} hero tone="run" onLog={() => {}} rampNote />)
  expect(d.container.querySelector('.fo-box use')?.getAttribute('href')).toBe('#t-sprout')
  expect(screen.getByText('Visszatérő futás')).toBeInTheDocument()
  d.unmount()

  const e = render(
    <TodaySessionCard {...base} hero tone="gym" tag="GYM" facts={[]} logged loggedSummary="Kész" doneCta="Kész · megnézem"
      onLog={() => {}} graphic={<div data-testid="g" />} />,
  )
  expect(screen.getByTestId('g')).toBeInTheDocument()
  expect(e.container.querySelector('.fo-hero-left')).toBeNull()
  // with the page's own drawing the done box is not repeated; the button says it
  expect(e.container.querySelector('.em-doneb')).toBeNull()
  expect(screen.getByRole('button', { name: /logolt session megnyitása/ }).textContent).toBe('Kész · megnézem')
})
