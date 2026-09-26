import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LevelUpProvider, useLevelUp } from '@/features/progression/LevelUpProvider'
import { gymLevelUpMock } from '@/data/progression/progressionMock'

function stubReduced() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: true,
    media: q,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

function Trigger({ value }: { value: typeof gymLevelUpMock | undefined }) {
  const { showLevelUp } = useLevelUp()
  return <button onClick={() => showLevelUp(value)}>fire</button>
}

describe('LevelUpProvider', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders nothing until showLevelUp is called', () => {
    stubReduced()
    render(
      <LevelUpProvider>
        <Trigger value={gymLevelUpMock} />
      </LevelUpProvider>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the overlay on showLevelUp(result) and clears it on Tovább', () => {
    stubReduced()
    render(
      <LevelUpProvider>
        <Trigger value={gymLevelUpMock} />
      </LevelUpProvider>,
    )
    fireEvent.click(screen.getByText('fire'))
    const dialog = screen.getByRole('dialog', { name: 'Szintlépés' })
    // the üveg overlay (mezo-me75u.10): the source chip wears the 3D dumbbell for a GYM result
    expect(dialog.querySelector('.lvu-chip use')?.getAttribute('href')).toBe('#t-dumbbell')
    fireEvent.click(screen.getByRole('button', { name: /Tovább/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('showLevelUp(undefined) is a no-op (switch-off path)', () => {
    stubReduced()
    render(
      <LevelUpProvider>
        <Trigger value={undefined} />
      </LevelUpProvider>,
    )
    fireEvent.click(screen.getByText('fire'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // mezo-e1ii9 (Train parity P1, Task 2): the overlay used to be dismissible ONLY by its own
  // Tovább CTA, so a user who navigated away kept a full-frame `.levelup` painted over every
  // following route until a hard reload (measured live over /train/mesocycles/new and
  // /train/gym). A route change now clears it — a provider-level fix, domain-agnostic.
  it('clears the overlay on a route change (it must never outlive the route that raised it)', () => {
    stubReduced()
    function Raiser() {
      const { showLevelUp } = useLevelUp()
      const navigate = useNavigate()
      return (
        <>
          <button onClick={() => showLevelUp(gymLevelUpMock)}>fire</button>
          <button onClick={() => navigate('/elsewhere')}>go</button>
        </>
      )
    }
    render(
      <MemoryRouter initialEntries={['/here']}>
        <LevelUpProvider>
          <Routes>
            <Route path="/here" element={<Raiser />} />
            <Route path="/elsewhere" element={<div>ELSEWHERE</div>} />
          </Routes>
        </LevelUpProvider>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByText('fire'))
    expect(document.querySelector('.levelup')).not.toBeNull()
    fireEvent.click(screen.getByText('go'))
    expect(screen.getByText('ELSEWHERE')).toBeInTheDocument()
    expect(document.querySelector('.levelup')).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
