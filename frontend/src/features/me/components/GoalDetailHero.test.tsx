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
