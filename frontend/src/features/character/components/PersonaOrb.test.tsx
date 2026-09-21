import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'

test('all nine personas use the menu Boop with distinct role badges and isolated gradients', () => {
  const keys = ['doki', 'edzo', 'taplalkozo', 'szomnologus', 'pszichologus', 'drill', 'antropologus', 'szkeptikus', 'mezo']
  const { container } = render(<>{keys.map(key => <PersonaOrb key={key} expertKey={key} size={44} />)}</>)
  expect(container.querySelectorAll('svg.boop.is-alive')).toHaveLength(9)
  const badges = [...container.querySelectorAll('.kr-persona-badge use')].map(node => node.getAttribute('href'))
  expect(new Set(badges).size).toBe(9)
  const ids = [...container.querySelectorAll('[id]')].map(node => node.id)
  expect(new Set(ids).size).toBe(ids.length)
})

test('unknown catalog persona falls back to Mezo without breaking sizing', () => {
  const { container } = render(<PersonaOrb expertKey="future-expert" size={28} />)
  expect(container.querySelector('svg.boop')).toHaveAttribute('width', '28')
  expect(container.querySelector('.kr-persona-badge use')).toHaveAttribute('href', '#i-mezo')
})
