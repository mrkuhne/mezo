import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { TeamCharacterId } from '@/features/insights/logic/team'
import { StoryStrip } from './StoryStrip'

const TODAY = '2026-09-23'
const fresh = { szunya: true, mocor: false, falat: true, deru: false, mezo: false, szkeptikus: false } satisfies Record<TeamCharacterId, boolean>

const renderStrip = () =>
  render(<MemoryRouter><StoryStrip today={TODAY} fresh={fresh} waiting={{ falat: true }} /></MemoryRouter>)

afterEach(() => localStorage.clear())

test('öt kör, a Szkeptikus nélkül; mindegyik a karakter szobájába visz', () => {
  renderStrip()
  const links = screen.getAllByRole('link')
  expect(links).toHaveLength(5)
  expect(screen.queryByText('Szkeptikus')).not.toBeInTheDocument()
  expect(links[0]).toHaveAttribute('href', '/mezo/csapat/szunya')
})

test('friss + nem látott → színes gyűrű; rád-vár → pötty', () => {
  renderStrip()
  expect(screen.getByRole('link', { name: /Szunya.*új bejegyzés/ })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Mocor/ })).not.toHaveAccessibleName(/új bejegyzés/)
  expect(screen.getByRole('link', { name: /Falat.*rád vár/ })).toBeInTheDocument()
})

test('a megnyitott kör aznapra láttra vált, és ez megmarad', async () => {
  const { unmount } = renderStrip()
  await userEvent.click(screen.getByRole('link', { name: /Szunya/ }))
  expect(localStorage.getItem(`tf-seen:szunya:${TODAY}`)).toBe('1')
  unmount()
  renderStrip()
  expect(screen.getByRole('link', { name: /Szunya/ })).not.toHaveAccessibleName(/új bejegyzés/)
})

test('kieső böngésző-tár → minden friss gyűrű „új” marad (ártalmatlan alapállás)', () => {
  const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  try {
    renderStrip()
    expect(screen.getByRole('link', { name: /Szunya.*új bejegyzés/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Falat.*új bejegyzés/ })).toBeInTheDocument()
  } finally {
    spy.mockRestore()
  }
})
