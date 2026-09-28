import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { RecallSheet } from '@/features/insights/sheets/RecallSheet'
import { MOCK_PERSON_RECALL } from '@/data/insights/turnMemory'

function Where() {
  const l = useLocation()
  return <p data-testid="where">{l.pathname + l.search}</p>
}

test('each recalled fact is its own line (gist joined with a newline), and the door opens Emberek', async () => {
  render(
    <MemoryRouter initialEntries={['/mezo/chat']}>
      <Routes>
        <Route path="/mezo/chat" element={<RecallSheet items={MOCK_PERSON_RECALL} onClose={vi.fn()} />} />
        <Route path="/mezo/knowledge" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(screen.getByText('EMLÉKSZEM')).toBeInTheDocument()
  expect(screen.getByText('Ezt vettem elő a válaszhoz')).toBeInTheDocument()
  expect(screen.getByText('az egyetem óta ismeritek')).toBeInTheDocument()
  expect(screen.getByText('ő szervezi a szombati edzéseket')).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(4)
  expect(document.body.textContent).not.toContain('\n')
  await userEvent.click(screen.getByRole('button', { name: 'Emberek a Tudástárban ›' }))
  expect(await screen.findByTestId('where')).toHaveTextContent('/mezo/knowledge?view=emberek')
})
