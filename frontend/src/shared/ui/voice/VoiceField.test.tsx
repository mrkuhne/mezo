import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'
import { VoiceField } from '@/shared/ui/voice/VoiceField'

// jsdom has no getUserMedia/MediaRecorder: the stub hands back the transcript callback and a
// state the test drives, so the tile's states and the append behaviour are checked directly.
const voice = vi.hoisted(() => ({
  onTranscript: null as null | ((t: string) => void),
  state: 'idle' as 'unsupported' | 'idle' | 'recording' | 'transcribing',
  toggle: vi.fn(),
}))
vi.mock('@/shared/lib/voice/useVoiceInput', async (orig) => ({
  ...(await orig<typeof import('@/shared/lib/voice/useVoiceInput')>()),
  useVoiceInput: (onTranscript: (t: string) => void) => {
    voice.onTranscript = onTranscript
    return { state: voice.state, error: null, toggle: voice.toggle }
  },
}))

function Note() {
  const [text, setText] = useState('')
  return (
    <VoiceField domain="nap" onTranscript={(t) => setText((d) => appendDictation(d, t))}>
      <textarea aria-label="Gondolatok" value={text} onChange={(e) => setText(e.target.value)} />
    </VoiceField>
  )
}

describe('VoiceField (mezo-xojq8)', () => {
  test('lays the mic tile beside the field and taps start the hook', async () => {
    voice.state = 'idle'
    voice.toggle.mockClear()
    const { container } = render(<Note />)
    expect(container.querySelector('.vfield[data-domain="nap"]')).not.toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Diktálás' }))
    expect(voice.toggle).toHaveBeenCalledTimes(1)
  })

  test('dictation appends to what is typed', async () => {
    voice.state = 'idle'
    render(<Note />)
    await userEvent.setup().type(screen.getByLabelText('Gondolatok'), 'Fáradt vagyok')
    act(() => voice.onTranscript!('de jól aludtam'))
    expect(screen.getByLabelText('Gondolatok')).toHaveValue('Fáradt vagyok de jól aludtam')
  })

  test('while listening the tile says it stops; while transcribing it is disabled', () => {
    voice.state = 'recording'
    const { unmount } = render(<Note />)
    expect(screen.getAllByRole('button', { name: 'Felvétel leállítása' })[0]).toHaveAttribute('aria-pressed', 'true')
    unmount()
    voice.state = 'transcribing'
    render(<Note />)
    expect(screen.getByRole('button', { name: 'Diktálás' })).toBeDisabled()
  })

  test('a browser without recording gets a disabled tile, not a fake one', () => {
    voice.state = 'unsupported'
    render(<Note />)
    expect(screen.getByRole('button', { name: 'Diktálás' })).toBeDisabled()
  })
})
