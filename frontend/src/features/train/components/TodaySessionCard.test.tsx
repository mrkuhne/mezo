import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { TodaySessionCard } from '@/features/train/components/TodaySessionCard'

const base = {
  emoji: '🏃', tag: 'FUTÁS', time: '12:00', title: 'Sprint-intervallum',
  facts: ['RPE 9–10', '5 kör'], logged: false, stateLabel: 'MOST',
  ctaLabel: 'Naplózd a futást',
} as const

test('renders tone class, icon shield, eyebrow, title, fact pills and the CTA', () => {
  const onLog = vi.fn()
  const { container } = render(<TodaySessionCard {...base} tone="run" onLog={onLog} />)
  expect(container.querySelector('.todaycard-run')).toBeInTheDocument()
  expect(container.querySelector('.todaycard-icon')).toHaveTextContent('🏃')
  expect(screen.getByText(/FUTÁS/)).toBeInTheDocument()
  expect(screen.getByText('12:00')).toBeInTheDocument()
  expect(screen.getByText('Sprint-intervallum')).toBeInTheDocument()
  expect(container.querySelectorAll('.metapill')).toHaveLength(2)
  expect(screen.getByText('MOST')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Naplózd a futást/ }))
  expect(onLog).toHaveBeenCalledTimes(1)
})

test('each of the five tones gets its own tone class and typetag variant', () => {
  for (const tone of ['gym', 'sport', 'cross', 'trx', 'run'] as const) {
    const { container, unmount } = render(<TodaySessionCard {...base} tone={tone} />)
    expect(container.querySelector(`.todaycard-${tone}`)).toBeInTheDocument()
    expect(container.querySelector(`.typetag-${tone}`)).toBeInTheDocument()
    unmount()
  }
})

test('logged state: check icon, MEGVAN eyebrow, DoneBar instead of the CTA, no state chip', () => {
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
  expect(container.querySelector('.todaycard.logged')).toBeInTheDocument()
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
