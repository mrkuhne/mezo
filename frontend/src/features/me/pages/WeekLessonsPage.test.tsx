import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { WeekLessonsPage } from '@/features/me/pages/WeekLessonsPage'

test('weekly lessons retains week context and routes decisions to the canonical inbox', () => {
  render(<MemoryRouter initialEntries={['/me/week/tanulsagok?start=2026-09-14']}><WeekLessonsPage /></MemoryRouter>, { wrapper: QueryWrapper })
  expect(screen.getByRole('link', { name: /Tudástár postaládája/ })).toHaveAttribute('href', '/mezo/knowledge?start=2026-09-14')
  expect(screen.queryByRole('button', { name: /Tanuld meg/ })).not.toBeInTheDocument()
})
