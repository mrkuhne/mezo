import { render, screen } from '@testing-library/react'
import { GreetingHeader } from '@/features/today/components/GreetingHeader'
import { today, user } from '@/data/today/today'

test('renders the day line with reta day and the daypart greeting', () => {
  render(<GreetingHeader today={today} user={user} retaDay={3} now={new Date('2026-07-13T14:00:00')} />)
  expect(screen.getByText(content => content.includes('Reta D3'))).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('jó napod lesz.')
  // The greeting interpolates the user's name (afternoon variant: "Szia <name> — ...").
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(user.name)
})

test('morning and evening greetings follow the daypart', () => {
  const { rerender } = render(
    <GreetingHeader today={today} user={user} retaDay={3} now={new Date('2026-07-13T06:30:00')} />,
  )
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('induljunk.')
  rerender(<GreetingHeader today={today} user={user} retaDay={3} now={new Date('2026-07-13T21:00:00')} />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('zárjuk a napot.')
})
