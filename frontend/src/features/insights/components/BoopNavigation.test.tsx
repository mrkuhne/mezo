import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BoopNavigation } from '@/features/insights/components/BoopNavigation'

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><BoopNavigation /></MemoryRouter>)

// mezo-a9bo7.10: the chip strip rides the legacy feature pages only; the rooms and the Gépterem
// are the new world, and the grid itself is the „Összes funkció” destination.
test.each(['/mezo/csapat', '/mezo/csapat/szunya', '/mezo/karakter/gepterem', '/mezo/karakter/gepterem/osszes'])(
  '%s — nincs chip-sáv', (path) => {
    at(path)
    expect(screen.queryByRole('navigation', { name: 'Boop funkciók' })).not.toBeInTheDocument()
  })

test('a régi funkcióoldalakon a chip-sáv az „Összes funkció” rácsra visz', () => {
  at('/mezo/patterns')
  expect(screen.getByRole('link', { name: 'Összes funkció' })).toHaveAttribute('href', '/mezo/karakter/gepterem/osszes')
})
