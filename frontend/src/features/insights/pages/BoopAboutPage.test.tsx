import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { BoopAboutPage } from '@/features/insights/pages/BoopAboutPage'

it('keeps knowledge and explicit instructions directly available while the portrait loads', () => {
  render(<MemoryRouter><BoopAboutPage /></MemoryRouter>, { wrapper: QueryWrapper })
  expect(screen.getByRole('heading', { name: 'Rólad' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Tudástár' })).toHaveAttribute('href', '/mezo/knowledge')
  expect(screen.getByRole('link', { name: 'Így beszélj velem' })).toHaveAttribute('href', '/settings/mezo/communication')
})
