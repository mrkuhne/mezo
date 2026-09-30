import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { GratitudeRows } from '@/features/me/components/GratitudeRows'

// `useVoiceInput` talks to getUserMedia/MediaRecorder, neither of which exists under jsdom.
// Every row owns its own voice field (mezo-xojq8), so the stub records WHICH hook instance was
// toggled: `voice.active` is that row's transcript callback, and the test feeds it the text.
const voice = vi.hoisted(() => ({ active: null as null | ((t: string) => void) }))
vi.mock('@/shared/lib/voice/useVoiceInput', async (orig) => ({
  ...(await orig<typeof import('@/shared/lib/voice/useVoiceInput')>()),
  useVoiceInput: (onTranscript: (t: string) => void) => {
    const [state, setState] = useState<'idle' | 'recording'>('idle')
    return {
      state,
      error: null,
      toggle: vi.fn(() => {
        voice.active = onTranscript
        setState((s) => (s === 'recording' ? 'idle' : 'recording'))
      }),
    }
  },
}))

/** Drives the component the way both real callers do: the parent owns rows + lifeArea. */
function Harness({ max, onRows }: { max?: number; onRows?: (r: string[]) => void }) {
  const [rows, setRows] = useState<string[]>([''])
  const [lifeArea, setLifeArea] = useState<string | null>(null)
  return (
    <GratitudeRows
      rows={rows}
      onRowsChange={(r) => { setRows(r); onRows?.(r) }}
      lifeArea={lifeArea}
      onLifeAreaChange={setLifeArea}
      max={max}
      hint="1–3 dolog, amiért ma hálás vagy (max. 280 karakter soronként)."
    />
  )
}

describe('GratitudeRows', () => {
  test('renders one row, the hint and the life-area chips', () => {
    render(<Harness />)

    expect(screen.getByLabelText('1. hálás gondolat')).toBeInTheDocument()
    expect(screen.queryByLabelText('2. hálás gondolat')).not.toBeInTheDocument()
    expect(screen.getByText(/1–3 dolog, amiért ma hálás vagy/)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Life area' })).toBeInTheDocument()
  })

  test('„+ Még egy" adds rows and disappears at the cap', async () => {
    const user = userEvent.setup()
    render(<Harness max={3} />)

    await user.click(screen.getByRole('button', { name: '+ Még egy' }))
    await user.click(screen.getByRole('button', { name: '+ Még egy' }))

    expect(screen.getByLabelText('3. hálás gondolat')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Még egy' })).not.toBeInTheDocument()
  })

  test('honours a max below 3 — the ritual act passes the remaining slots', async () => {
    const user = userEvent.setup()
    render(<Harness max={1} />)

    expect(screen.getByLabelText('1. hálás gondolat')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Még egy' })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('1. hálás gondolat'), 'x')
    expect(screen.queryByLabelText('2. hálás gondolat')).not.toBeInTheDocument()
  })

  test('a life-area chip toggles on and off', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const chip = screen.getAllByRole('button', { pressed: false })
      .find((b) => /Kapcsolat|Regeneráció|Tudatosság/.test(b.textContent ?? ''))!

    await user.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    await user.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'false')
  })

  test('the transcript lands in the row whose mic was tapped — not in some other box', async () => {
    const user = userEvent.setup()
    const onRows = vi.fn()
    render(<Harness max={3} onRows={onRows} />)

    await user.click(screen.getByRole('button', { name: '+ Még egy' }))
    await user.click(screen.getAllByRole('button', { name: 'Diktálás' })[1])
    act(() => voice.active!('Hívott anya'))

    expect(onRows).toHaveBeenLastCalledWith(['', 'Hívott anya'])
  })

  test('the transcript APPENDS to what is already typed in that row', async () => {
    const user = userEvent.setup()
    const onRows = vi.fn()
    render(<Harness onRows={onRows} />)

    await user.type(screen.getByLabelText('1. hálás gondolat'), 'Reggeli kávé')
    await user.click(screen.getByRole('button', { name: 'Diktálás' }))
    act(() => voice.active!('a teraszon'))

    expect(onRows).toHaveBeenLastCalledWith(['Reggeli kávé a teraszon'])
  })

  test('a row typed into WHILE its mic listened still gets the text appended, not overwritten', async () => {
    const user = userEvent.setup()
    const onRows = vi.fn()
    render(<Harness max={3} onRows={onRows} />)
    await user.click(screen.getByRole('button', { name: '+ Még egy' }))

    await user.click(screen.getAllByRole('button', { name: 'Diktálás' })[0])
    await user.type(screen.getByLabelText('2. hálás gondolat'), 'Séta')
    act(() => voice.active!('Hívott anya'))

    expect(onRows).toHaveBeenLastCalledWith(['Hívott anya', 'Séta'])
  })
})
