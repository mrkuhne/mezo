import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { TodaySessionCard } from '@/features/train/components/TodaySessionCard'

const base = {
  art: 't-run', tag: 'FUTÁS', time: '12:00', title: 'Sprint-intervallum',
  facts: ['RPE 9–10', '5 kör'], logged: false, stateLabel: 'MOST',
  ctaLabel: 'Naplózd a futást',
} as const

test('renders the glass card in its tone, the 3D art in a lit well, tag line, title, fact pills and the CTA', () => {
  const onLog = vi.fn()
  const { container } = render(<TodaySessionCard {...base} tone="run" onLog={onLog} />)
  // one glass card, its hue published as --c on the card itself (bible U1 rule 4)
  const card = container.querySelector('.trm-sess-run.glass') as HTMLElement
  expect(card).toBeInTheDocument()
  expect(card.style.getPropertyValue('--c')).toBe('var(--dv-sky)')
  // the session's 3D art sits in the lit well (the emoji shield is gone)
  expect(container.querySelector('.trm-sess-well use')?.getAttribute('href')).toBe('#t-run')
  expect(screen.getByText(/FUTÁS/)).toBeInTheDocument()
  expect(screen.getByText('12:00')).toBeInTheDocument()
  expect(screen.getByText('Sprint-intervallum')).toBeInTheDocument()
  expect(container.querySelectorAll('.trm-fact')).toHaveLength(2)
  expect(screen.getByText('MOST')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Naplózd a futást/ }))
  expect(onLog).toHaveBeenCalledTimes(1)
})

test('each of the five tones gets its own tone class and tag variant', () => {
  for (const tone of ['gym', 'sport', 'cross', 'trx', 'run'] as const) {
    const { container, unmount } = render(<TodaySessionCard {...base} tone={tone} />)
    expect(container.querySelector(`.trm-sess-${tone}`)).toBeInTheDocument()
    expect(container.querySelector(`.trm-tag-${tone}`)).toBeInTheDocument()
    unmount()
  }
})

test('logged state: 3D done mark, MEGVAN eyebrow, DoneBar instead of the CTA, no state chip', () => {
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
  expect(container.querySelector('.trm-sess.is-logged')).toBeInTheDocument()
  // the done mark is the 3D tick, its meaning spoken (the old check glyph is gone)
  expect(screen.getByRole('img', { name: 'kész' }).querySelector('use')?.getAttribute('href')).toBe('#t-tick')
  expect(screen.getByText(/MEGVAN/)).toBeInTheDocument()
  expect(screen.getByText('RPE 9 · 5/5 kör')).toBeInTheDocument()
  expect(screen.getByText('12:04-kor logolva')).toBeInTheDocument()
  expect(screen.queryByText('MOST')).not.toBeInTheDocument()
  expect(screen.queryByText(/Naplózd a futást/)).not.toBeInTheDocument()
  // the DoneBar is the tap target -> re-opens the sheet
  fireEvent.click(screen.getByRole('button'))
  expect(onLog).toHaveBeenCalledTimes(1)
})

test('a read-only card (no ctaLabel) renders neither CTA nor tappable bar', () => {
  render(<TodaySessionCard {...base} tone="sport" ctaLabel={undefined} stateLabel="TERVEZETT" />)
  expect(screen.getByText('TERVEZETT')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

// ── Kihagyás S1 (mezo-q4xt2.1) — prototype elo/edzes.html `.sess` Kihagyom / is-skip ──
const skipRow = {
  id: 'k1', kind: 'RUN' as const, date: '2026-09-29', sessionKey: 'tue', reasonCategory: 'TIRED' as const,
  reasonText: null, source: 'USER' as const, serious: false, freePass: true, excused: true,
}

test('onSkip: a ghost Kihagyom pill sits before the existing CTA', () => {
  const onSkip = vi.fn()
  const onLog = vi.fn()
  const { container } = render(<TodaySessionCard {...base} tone="run" onLog={onLog} onSkip={onSkip} />)
  const cta = container.querySelector('.trm-sess-cta')!
  const buttons = [...cta.querySelectorAll('button')]
  expect(buttons.map((b) => b.textContent)).toEqual(['Kihagyom', 'Naplózd a futást ›'])
  expect(buttons[0].querySelector('use')?.getAttribute('href')).toBe('#t-skip')
  fireEvent.click(buttons[0])
  expect(onSkip).toHaveBeenCalledTimes(1)
  expect(onLog).not.toHaveBeenCalled()
})

test('onSkip with skipLabel Kihagytam (a past missed session)', () => {
  render(<TodaySessionCard {...base} tone="run" stateLabel="ELMARADT" onSkip={() => {}} skipLabel="Kihagytam" />)
  expect(screen.getByRole('button', { name: 'Kihagytam' })).toBeInTheDocument()
})

test('onSkip on a read-only card (no CTA) still shows the Kihagyom pill', () => {
  render(<TodaySessionCard {...base} tone="run" ctaLabel={undefined} stateLabel="TERVEZETT" onSkip={() => {}} />)
  expect(screen.getByRole('button', { name: 'Kihagyom' })).toBeInTheDocument()
})

test('skipped: is-skip card, KIHAGYVA chip, the inner SkippedBlock instead of the CTA row', () => {
  const onReason = vi.fn()
  const onUndo = vi.fn()
  const { container } = render(
    <TodaySessionCard {...base} tone="run" onLog={() => {}} onSkip={() => {}} skipped={skipRow}
      onSkipReason={onReason} onSkipUndo={onUndo} />,
  )
  expect(container.querySelector('.trm-sess.is-skip')).toBeInTheDocument()
  expect(screen.getByText('KIHAGYVA')).toHaveClass('is-skip')
  expect(screen.queryByText('MOST')).not.toBeInTheDocument()
  expect(container.querySelector('.trm-skipd.is-in')).toBeInTheDocument()
  expect(screen.getByText('Kihagyva · Fáradt vagyok')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Naplózd a futást/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Kihagyom' })).not.toBeInTheDocument()
  // facts stay (dimmed by CSS)
  expect(container.querySelectorAll('.trm-fact')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Másik ok' }))
  expect(onReason).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /Visszavonom/ }))
  expect(onUndo).toHaveBeenCalled()
})

test('an ELMARADT state chip wears the missed tint', () => {
  render(<TodaySessionCard {...base} tone="run" stateLabel="ELMARADT" />)
  expect(screen.getByText('ELMARADT')).toHaveClass('is-miss')
})
