import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import { AnchorIsland } from '@/features/today/components/AnchorIsland'

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}{loc.search}</div>
}

const renderAnchor = () =>
  render(
    <MemoryRouter initialEntries={['/nap?day=rough']}>
      <AnchorIsland />
      <LocationProbe />
    </MemoryRouter>,
  )

describe('AnchorIsland', () => {
  test('renders the three anchors and the warm message', () => {
    renderAnchor()
    expect(screen.getByText('Egy pohár víz')).toBeInTheDocument()
    expect(screen.getByText('Egy fehérje-étkezés')).toBeInTheDocument()
    expect(screen.getByText('10 perces sétálás')).toBeInTheDocument()
    expect(screen.getByText(/ma elég a minimum/)).toBeInTheDocument()
  })

  test('ticking an anchor flips it done locally', async () => {
    renderAnchor()
    const buttons = screen.getAllByRole('button', { name: 'Megvolt ✓' })
    expect(buttons).toHaveLength(3)
    await userEvent.click(buttons[0])
    expect(screen.getAllByRole('button', { name: 'Megvolt ✓' })).toHaveLength(2)
  })

  test('the exit drops back to /today without the rough param', async () => {
    renderAnchor()
    await userEvent.click(screen.getByRole('button', { name: 'Kilépés a horgony módból' }))
    expect(screen.getByTestId('loc').textContent).toBe('/nap')
  })
})
