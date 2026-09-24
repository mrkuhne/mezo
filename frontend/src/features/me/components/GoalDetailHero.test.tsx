import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { GoalDetailHero } from '@/features/me/components/GoalDetailHero'

test('renders the asymmetric Goal detail hero with an accessible summary and three stat pods', () => {
  const { container } = render(<GoalDetailHero
    tone="nutrition"
    icon="i-fuel"
    name="Mai étrendi keret"
    eyebrow="Ma · edzésnap"
    big="2 940 kcal"
    description="A heti keretből ma több energia jut az edzés köré."
    stats={[
      { label: 'Heti átlag', value: '2 780' },
      { label: 'Edzésnap', value: '2 940' },
      { label: 'Pihenőnap', value: '2 580' },
    ]}
  />)

  expect(screen.getByRole('region', { name: 'Mai étrendi keret áttekintése' })).toBeInTheDocument()
  expect(screen.getByText('2 940 kcal')).toBeInTheDocument()
  expect(container.querySelectorAll('.goal-detail-pod')).toHaveLength(3)
})

test('the üveg variant is a frameless halo hero with 3D art and three flat stat cells', () => {
  const { container } = render(<GoalDetailHero
    tone="guards"
    icon="i-eletjel"
    art="t-shield"
    name="Védőkorlátok"
    eyebrow="Célbiztonság"
    big="3 / 4"
    description="A cél az erőt figyeli."
    stats={[
      { label: 'Rendben', value: '3 jel' },
      { label: 'Figyelendő', value: '1 jel' },
      { label: 'Összesen', value: '4 jel' },
    ]}
  />)
  const hero = screen.getByRole('region', { name: 'Védőkorlátok áttekintése' })
  expect(hero).toHaveClass('uv-halo')
  expect(hero).not.toHaveClass('glass')
  expect(hero.querySelector('use')).toHaveAttribute('href', '#t-shield')
  expect(screen.getByText('3 / 4')).toBeInTheDocument()
  expect(container.querySelectorAll('.goal-detail-pod')).toHaveLength(3)
})
