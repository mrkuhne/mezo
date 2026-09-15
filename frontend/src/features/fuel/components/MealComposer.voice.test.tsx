// ============================================================
// Mezo · MealComposer — hangbevitel (Fuel Titanium S1c, mezo-33k6; manifeszt A6).
//
// A6: a hang NEM új backend. A leiratozott mondat ugyanabba a szövegmezőbe kerül, amiből az
// AI-piszkozat készül — a mentés `provenance.origin`-ja emiatt `ai-text`, és ez helyes: hangot
// a draft-végpont nem kap.
//
// A `useVoiceInput` getUserMedia/MediaRecorder-t használ, ami jsdom alatt nem létezik — a stub
// (a GratitudeRows.test.tsx mintája) kiadja a transcript-callbacket, így a célmező közvetlenül
// állítható, és a `state`/`error` tesztenként vezérelhető.
// ============================================================
import type { ReactNode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const voice = vi.hoisted(() => ({
  onTranscript: null as null | ((t: string) => void),
  state: 'idle' as 'unsupported' | 'idle' | 'recording' | 'transcribing',
  error: null as string | null,
  toggle: vi.fn(),
}))
vi.mock('@/features/insights/logic/useVoiceInput', () => ({
  useVoiceInput: (onTranscript: (t: string) => void) => {
    voice.onTranscript = onTranscript
    return { state: voice.state, error: voice.error, toggle: voice.toggle }
  },
}))

import { MealComposer } from '@/features/fuel/components/MealComposer'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  voice.state = 'idle'
  voice.error = null
  voice.toggle.mockClear()
})
afterEach(() => vi.unstubAllEnvs())

function renderComposer(opts: { voiceState?: typeof voice.state; voiceError?: string } = {}) {
  if (opts.voiceState) voice.state = opts.voiceState
  if (opts.voiceError) voice.error = opts.voiceError
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return render(
    <MealComposer fixedSlot="snack" aiPanelOpenOnMount prefill={null} onSaved={() => {}} onCancel={() => {}} />,
    { wrapper },
  )
}
const transcript = (t: string) => voice.onTranscript!(t)

test('a bemondott mondat a szövegmezőbe kerül', () => {
  renderComposer()
  act(() => transcript('Egy joghurt és egy banán volt.'))
  expect(screen.getByLabelText('Mit ettél?')).toHaveValue('Egy joghurt és egy banán volt.')
})

test('a második mondat a meglévő szöveg MÖGÉ kerül, nem írja felül', () => {
  renderComposer()
  act(() => transcript('Egy joghurt.'))
  act(() => transcript('És egy banán.'))
  expect(screen.getByLabelText('Mit ettél?')).toHaveValue('Egy joghurt. És egy banán.')
})

test('a mikrofon koppintása a hang-hookot indítja, nem ment semmit', async () => {
  renderComposer()
  const { default: userEvent } = await import('@testing-library/user-event')
  await userEvent.setup().click(screen.getByRole('button', { name: /hang/i }))
  expect(voice.toggle).toHaveBeenCalledTimes(1)
})

test('felvétel közben a gomb ezt mondja, és leiratozás közben tiltott', () => {
  const { unmount } = renderComposer({ voiceState: 'recording' })
  expect(screen.getByRole('button', { name: /hallgatlak/i })).toHaveAttribute('aria-pressed', 'true')
  unmount()

  voice.state = 'transcribing'
  renderComposer()
  expect(screen.getByRole('button', { name: /leiratozom/i })).toBeDisabled()
})

// Nem támogatott böngészőn a gomb nem hazudik: nem jelenik meg működőként.
test('hangfelismerés nélkül a mikrofon tiltott', () => {
  renderComposer({ voiceState: 'unsupported' })
  expect(screen.getByRole('button', { name: /hang/i })).toBeDisabled()
})

test('a hangfelismerés hibája a felhasználónak is látszik', () => {
  renderComposer({ voiceError: 'Nem sikerült a leiratozás.' })
  expect(screen.getByText('Nem sikerült a leiratozás.')).toBeInTheDocument()
})
