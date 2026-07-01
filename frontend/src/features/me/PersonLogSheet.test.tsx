import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PersonLogSheet } from '@/features/me/PersonLogSheet'
import { people } from '@/data/me/people'

test('preselects initialPersonId and saves a MentionLogInput', async () => {
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(
    <PersonLogSheet onClose={onClose} onSave={onSave} people={people} initialPersonId={people[0].id} />,
  )
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ personId: people[0].id, tone: 'positive' }),
  )
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('does not save when no person is chosen', async () => {
  const onSave = vi.fn()
  render(<PersonLogSheet onClose={() => {}} onSave={onSave} people={people} />)
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).not.toHaveBeenCalled()
})
