import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LevelUpProvider, useLevelUp } from '@/features/progression/LevelUpProvider'
import { gymLevelUpMock } from '@/data/progressionMock'

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
    expect(screen.getByRole('dialog')).toBeInTheDocument()
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
})
