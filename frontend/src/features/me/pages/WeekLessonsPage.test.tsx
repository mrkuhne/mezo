import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { WeekLessonsPage } from '@/features/me/pages/WeekLessonsPage'

test('weekly lessons retains week context and routes decisions to the canonical Rólad inbox', () => {
  render(<MemoryRouter initialEntries={['/me/week/tanulsagok?start=2026-09-14']}><WeekLessonsPage /></MemoryRouter>, { wrapper: QueryWrapper })
  expect(screen.getByRole('link', { name: /Rólad postaládája/ })).toHaveAttribute('href', '/mezo/rolad?start=2026-09-14')
  expect(screen.queryByRole('button', { name: /Tanuld meg/ })).not.toBeInTheDocument()
})
