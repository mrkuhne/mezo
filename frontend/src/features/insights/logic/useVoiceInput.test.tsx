import { renderHook, act, waitFor } from '@testing-library/react'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useVoiceInput } from '@/features/insights/logic/useVoiceInput'

/** Minimal MediaRecorder stand-in — jsdom ships neither it nor getUserMedia. */
class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = []
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  mimeType = 'audio/webm'
  constructor(public stream: MediaStream) {
    FakeMediaRecorder.instances.push(this)
  }
  start() {}
  stop() {
    // one clip comfortably over the mis-tap floor
    this.ondataavailable?.({ data: new Blob([new Uint8Array(2048)], { type: 'audio/webm' }) })
    this.onstop?.()
  }
}

const fakeStream = () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream

function installMediaStack(getUserMedia = vi.fn().mockResolvedValue(fakeStream())) {
  FakeMediaRecorder.instances = []
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true, value: { getUserMedia },
  })
  // The wav round trip needs Web Audio, which jsdom lacks — the hook falls back to the raw blob.
  vi.stubGlobal('AudioContext', undefined)
  vi.stubGlobal('OfflineAudioContext', undefined)
  return getUserMedia
}

describe('useVoiceInput (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it('records, transcribes, and hands the text back', async () => {
    installMediaStack()
    const onTranscript = vi.fn()
    const { result } = renderHook(() => useVoiceInput(onTranscript), { wrapper: makeHookWrapper() })

    expect(result.current.state).toBe('idle')
    await act(async () => { result.current.toggle() })
    expect(result.current.state).toBe('recording')

    await act(async () => { FakeMediaRecorder.instances[0].stop() })
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith(expect.stringContaining('Ma reggel')))
    await waitFor(() => expect(result.current.state).toBe('idle'))
    expect(result.current.error).toBeNull()
  })

  it('reports an honest error when the mic is denied', async () => {
    installMediaStack(vi.fn().mockRejectedValue(new Error('NotAllowedError')))
    const { result } = renderHook(() => useVoiceInput(vi.fn()), { wrapper: makeHookWrapper() })

    await act(async () => { result.current.toggle() })
    await waitFor(() => expect(result.current.error).toMatch(/mikrofont/))
    expect(result.current.state).toBe('idle')
  })

  it('is unsupported when the browser has no MediaRecorder', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
    const { result } = renderHook(() => useVoiceInput(vi.fn()), { wrapper: makeHookWrapper() })
    expect(result.current.state).toBe('unsupported')
  })
})
