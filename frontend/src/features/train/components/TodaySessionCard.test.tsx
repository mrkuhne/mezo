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
