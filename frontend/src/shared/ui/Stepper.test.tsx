import { render, screen } from '@testing-library/react'
import { Stepper } from '@/shared/ui/Stepper'

test('renders count, dots with done/active states, and the step label', () => {
  const { container } = render(
    <Stepper title="Recept-varázsló" step={2} total={5} stepLabel="Hozzávalók kiválasztása" />,
  )
  expect(screen.getByText('Recept-varázsló')).toBeInTheDocument()
  expect(screen.getByText('2 / 5')).toBeInTheDocument()
  expect(screen.getByText('Hozzávalók kiválasztása')).toBeInTheDocument()
  const dots = container.querySelectorAll('.stepper-dot')
  expect(dots).toHaveLength(5)
  expect(dots[0]).toHaveClass('done')
  expect(dots[1]).toHaveClass('active')
  expect(dots[2]).not.toHaveClass('done')
  expect(dots[2]).not.toHaveClass('active')
})

test('exposes an accessible group label', () => {
  render(<Stepper title="Új terv" step={3} total={3} />)
  expect(screen.getByRole('group', { name: 'Új terv: 3. lépés / 3' })).toBeInTheDocument()
})

test('numbered mode draws one named disc per step with the same done/active states', () => {
  const { container } = render(
    <Stepper title="Beállítás" step={2} total={3} steps={['Rólad', 'Testméretek', 'Összefoglaló']} />,
  )
  expect(screen.getByRole('group', { name: 'Beállítás: 2. lépés / 3' })).toBeInTheDocument()
  expect(container.querySelector('.stepper-dot')).toBeNull()
  const discs = [...container.querySelectorAll('.stepper-step')]
  expect(discs.map((d) => d.textContent)).toEqual(['1Rólad', '2Testméretek', '3Összefoglaló'])
  expect(discs[0]).toHaveClass('done')
  expect(discs[1]).toHaveClass('active')
  expect(discs[2]).not.toHaveClass('done')
  expect(discs[2]).not.toHaveClass('active')
})
