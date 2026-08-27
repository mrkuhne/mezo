import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { GratitudeRows } from '@/features/me/components/GratitudeRows'

// `useVoiceInput` talks to getUserMedia/MediaRecorder, neither of which exists under jsdom.
// The stub exposes the transcript callback so the per-row target can be asserted directly —
// which is the point of the extraction (the sheet used to append it to the wrong textarea).
// `toggle` flips a real React state (via useState inside the mock, obeying rules of hooks the
// same way the real hook does) so the recording-race regression test can observe `state`
// actually flip to 'recording' and back, driving GratitudeRows' disabled-mic logic for real.
const voice = vi.hoisted(() => ({ onTranscript: null as null | ((t: string) => void) }))
vi.mock('@/features/insights/logic/useVoiceInput', () => ({
  useVoiceInput: (onTranscript: (t: string) => void) => {
    voice.onTranscript = onTranscript
    const [state, setState] = useState<'idle' | 'recording'>('idle')
    return {
      state,
      error: null,
      toggle: vi.fn(() => setState((s) => (s === 'recording' ? 'idle' : 'recording'))),
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
    await user.click(screen.getAllByRole('button', { name: 'Hangbevitel' })[1])
    voice.onTranscript!('Hívott anya')

    expect(onRows).toHaveBeenLastCalledWith(['', 'Hívott anya'])
  })

  test('the transcript APPENDS to what is already typed in that row', async () => {
    const user = userEvent.setup()
    const onRows = vi.fn()
    render(<Harness onRows={onRows} />)

    await user.type(screen.getByLabelText('1. hálás gondolat'), 'Reggeli kávé')
    await user.click(screen.getByRole('button', { name: 'Hangbevitel' }))
    voice.onTranscript!('a teraszon')

    expect(onRows).toHaveBeenLastCalledWith(['Reggeli kávé a teraszon'])
  })

  test('locks the mic to the recording row — a tap on another row cannot steal the target', async () => {
    const user = userEvent.setup()
    const onRows = vi.fn()
    render(<Harness max={3} onRows={onRows} />)
    await user.click(screen.getByRole('button', { name: '+ Még egy' }))

    // Start recording on row 1.
    const mics = screen.getAllByRole('button', { name: 'Hangbevitel' })
    await user.click(mics[0])

    // Row 2's mic must be locked out while row 1 is recording — otherwise tapping it would
    // stop row 1's in-flight recording but reassign the target to row 2 first.
    const rowTwoMic = screen.getAllByRole('button', { name: /Hangbevitel|Felvétel leállítása/ })[1]
    expect(rowTwoMic).toBeDisabled()

    // A tap on the disabled mic must be a no-op — the target must stay on row 1.
    await user.click(rowTwoMic)
    voice.onTranscript!('Hívott anya')

    expect(onRows).toHaveBeenLastCalledWith(['Hívott anya', ''])
  })
})
