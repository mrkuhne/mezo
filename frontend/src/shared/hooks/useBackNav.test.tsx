import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { expect, test } from 'vitest'
import { useBackNav, useBackTo } from '@/shared/hooks/useBackNav'

function Probe() {
  const { pathname } = useLocation()
  return <div data-testid="path">{pathname}</div>
}
function BackButton({ fallback }: { fallback: string }) {
  const goBack = useBackNav(fallback)
  return <button type="button" onClick={goBack}>vissza</button>
}

test('pops history when a previous in-app entry exists', () => {
  render(
    <MemoryRouter initialEntries={['/train/gym', '/train/session']} initialIndex={1}>
      <Probe />
      <Routes>
        <Route path="*" element={<BackButton fallback="/train" />} />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'vissza' }))
  expect(screen.getByTestId('path')).toHaveTextContent('/train/gym')
})

test('deep link (first history entry) navigates to the fallback instead', () => {
  render(
    <MemoryRouter initialEntries={['/train/session']}>
      <Probe />
      <Routes>
        <Route path="*" element={<BackButton fallback="/train" />} />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'vissza' }))
  expect(screen.getByTestId('path')).toHaveTextContent('/train')
})

// ── useBackTo (mezo-me75u.13): „vissza → ahonnan jöttél", a label says where it goes ──
function BackToButton({ fallback, label }: { fallback: string; label: string }) {
  const back = useBackTo(fallback, label)
  return <button type="button" data-via={String(back.viaHistory)} onClick={back.onBack}>‹ {back.label}</button>
}

test('useBackTo pops history to where the user came from and says the neutral Vissza', () => {
  render(
    <MemoryRouter initialEntries={['/mezo', '/mezo/patterns/x']} initialIndex={1}>
      <Probe />
      <Routes>
        <Route path="*" element={<BackToButton fallback="/mezo/patterns" label="Minták" />} />
      </Routes>
    </MemoryRouter>,
  )
  const button = screen.getByRole('button')
  expect(button).toHaveTextContent('‹ Vissza')
  expect(button).toHaveAttribute('data-via', 'true')
  fireEvent.click(button)
  expect(screen.getByTestId('path')).toHaveTextContent(/^\/mezo$/)
})

test('useBackTo on a direct open names and opens the fallback list, search included', () => {
  render(
    <MemoryRouter initialEntries={['/mezo/patterns/x']}>
      <Probe />
      <Routes>
        <Route path="*" element={<BackToButton fallback="/mezo/patterns?d=sleep" label="Minták" />} />
      </Routes>
    </MemoryRouter>,
  )
  const button = screen.getByRole('button')
  expect(button).toHaveTextContent('‹ Minták')
  expect(button).toHaveAttribute('data-via', 'false')
  fireEvent.click(button)
  expect(screen.getByTestId('path')).toHaveTextContent('/mezo/patterns')
})

test('useBackTo treats the browser router first entry (idx 0) as a direct open even after a replace', () => {
  const saved = window.history.state
  window.history.replaceState({ idx: 0, key: 'abc', usr: null }, '')
  try {
    render(
      <MemoryRouter initialEntries={['/mezo/patterns', '/mezo/patterns/x']} initialIndex={1}>
        <Probe />
        <Routes>
          <Route path="*" element={<BackToButton fallback="/mezo/patterns" label="Minták" />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('button')).toHaveTextContent('‹ Minták')
  } finally {
    window.history.replaceState(saved, '')
  }
})
