import { render, screen } from '@testing-library/react'
import { CoachBubble } from '@/shared/ui/CoachBubble'

test('renders the coach voice body with eyebrow + time', () => {
  render(<CoachBubble time="most">Az ütem pont ott van, ahol lennie kell.</CoachBubble>)
  expect(screen.getByText('COACH')).toBeInTheDocument()
  expect(screen.getByText('most')).toBeInTheDocument()
  expect(screen.getByText('Az ütem pont ott van, ahol lennie kell.')).toBeInTheDocument()
})

test('avatar can be disabled and the eyebrow overridden', () => {
  const { container } = render(<CoachBubble avatar={false} eyebrow="MAI FÓKUSZ">Szöveg</CoachBubble>)
  expect(container.querySelector('.cb-avatar')).toBeNull()
  expect(screen.getByText('MAI FÓKUSZ')).toBeInTheDocument()
})
