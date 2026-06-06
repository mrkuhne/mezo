import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoirView } from './MemoirView'

test('renders the memoir card, anchors, anniversary card and archive footer', () => {
  render(<MemoirView />)
  expect(screen.getByText('Heti memoir · Hét 20 · 2026 · Máj 11-17')).toBeInTheDocument()
  expect(screen.getByText('Egy hét amikor a tested megtanult várni')).toBeInTheDocument()
  // RefTag renders "[PR] Chest Row 102.5 × 9"; RTL normalizes &nbsp; to a space, so this matches.
  // If it ever doesn't, fall back to: screen.getByText(/Chest Row 102\.5 × 9/)
  expect(screen.getByText(/Chest Row 102\.5 × 9/)).toBeInTheDocument()
  expect(screen.getByText('Évforduló · 1 hónap')).toBeInTheDocument()
  expect(screen.getByText('Memoir archive · 17 darab')).toBeInTheDocument()
})

test('reaction chips toggle the brand state', async () => {
  render(<MemoirView />)
  const like = screen.getByRole('button', { name: /Like/ })
  expect(like.className).not.toMatch(/brand/)
  await userEvent.click(like)
  expect(like.className).toMatch(/brand/)
})
