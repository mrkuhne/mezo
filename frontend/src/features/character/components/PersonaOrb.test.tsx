import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'

// Üvegesítés U9 (mezo-me75u.9): the nine backend personas fold into the csapatfal's five
// characters + the Szkeptikus — the orb is that character's figure in its accent well.
test('the nine personas render as their csapatfal character, in its accent well', () => {
  const keys = ['doki', 'edzo', 'taplalkozo', 'szomnologus', 'pszichologus', 'drill', 'antropologus', 'szkeptikus', 'mezo']
  const { container } = render(<>{keys.map(key => <PersonaOrb key={key} expertKey={key} size={44} />)}</>)
  expect(container.querySelectorAll('svg.boop.is-alive')).toHaveLength(9)
  const chars = [...container.querySelectorAll('.kr-persona')].map(n => n.getAttribute('data-character'))
  expect(chars).toEqual(['deru', 'mocor', 'falat', 'szunya', 'deru', 'mocor', 'mezo', 'szkeptikus', 'mezo'])
  expect(container.querySelector('[data-character="szunya"]')).toHaveClass('tf-av', 'tf-c-lav')
  expect(container.querySelector('.kr-persona-badge')).toBeNull()
  const ids = [...container.querySelectorAll('[id]')].map(node => node.id)
  expect(new Set(ids).size).toBe(ids.length)
})

test('unknown catalog persona falls back to Mezo without breaking sizing', () => {
  const { container } = render(<PersonaOrb expertKey="future-expert" size={28} />)
  expect(container.querySelector('.kr-persona')).toHaveAttribute('data-character', 'mezo')
  expect(container.querySelector('.kr-persona')).toHaveStyle({ width: '28px', height: '28px' })
})
