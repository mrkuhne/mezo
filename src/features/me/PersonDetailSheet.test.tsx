import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PersonDetailSheet } from './PersonDetailSheet'
import { people, mentions } from '@/data/people'

const person = people[0]
const personMentions = mentions.filter(m => m.person_id === person.id)

test('renders the person name and notes', () => {
  render(<PersonDetailSheet person={person} mentions={personMentions} onClose={() => {}} onLog={() => {}} />)
  expect(screen.getByText(person.name)).toBeInTheDocument()
})

test('"Log most" fires onLog (to open PersonLogSheet)', async () => {
  const onLog = vi.fn()
  render(<PersonDetailSheet person={person} mentions={personMentions} onClose={() => {}} onLog={onLog} />)
  await userEvent.click(screen.getByRole('button', { name: /Log most/ }))
  expect(onLog).toHaveBeenCalled()
})
