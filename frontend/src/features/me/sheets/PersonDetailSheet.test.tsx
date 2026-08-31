import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PersonDetailSheet } from '@/features/me/sheets/PersonDetailSheet'
import { people, mentions } from '@/data/me/people'

const person = people[0]
const personMentions = mentions.filter(m => m.person_id === person.id)

test('renders the person name and notes', () => {
  render(<PersonDetailSheet person={person} mentions={personMentions} onClose={() => {}} onLog={() => {}} onEdit={() => {}} />)
  expect(screen.getByText(person.name)).toBeInTheDocument()
})

test('"Log most" fires onLog (to open PersonLogSheet)', async () => {
  const onLog = vi.fn()
  render(<PersonDetailSheet person={person} mentions={personMentions} onClose={() => {}} onLog={onLog} onEdit={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /Log most/ }))
  expect(onLog).toHaveBeenCalled()
})

test('"Szerkesztés" fires onEdit (to open PersonEditSheet)', async () => {
  const onEdit = vi.fn()
  render(<PersonDetailSheet person={person} mentions={personMentions} onClose={() => {}} onLog={() => {}} onEdit={onEdit} />)
  await userEvent.click(screen.getByRole('button', { name: /Szerkesztés/ }))
  expect(onEdit).toHaveBeenCalled()
})
