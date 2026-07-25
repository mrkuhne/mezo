import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { expect, test } from 'vitest'
import { useBackNav } from '@/shared/hooks/useBackNav'

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
