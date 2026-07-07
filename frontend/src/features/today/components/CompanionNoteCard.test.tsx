import { render, screen } from '@testing-library/react'
import { CompanionNoteCard } from '@/features/today/components/CompanionNoteCard'

test('CompanionNoteCard renders a nudge with the in-day eyebrow', () => {
  render(
    <CompanionNoteCard
      note={{ window: 'midday', kind: 'nudge', text: 'Tarts egy kis szünetet, és igyál egy pohár vizet.' }}
    />,
  )
  expect(screen.getByText('Mezo · napközbeni jegyzet')).toBeInTheDocument()
  expect(screen.getByText(/Tarts egy kis szünetet/)).toBeInTheDocument()
})

test('CompanionNoteCard renders a closing with the day-close eyebrow', () => {
  render(
    <CompanionNoteCard note={{ window: 'evening', kind: 'closing', text: 'Szép zárás, a nap kerek lett.' }} />,
  )
  expect(screen.getByText('Mezo · napzárás')).toBeInTheDocument()
  expect(screen.getByText(/Szép zárás/)).toBeInTheDocument()
})
