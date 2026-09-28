import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'
import { ReadinessCard, TodayReadiness } from '@/features/train/components/ReadinessCard'
import { readinessMock } from '@/data/train/readinessMock'
import type { ReadinessTodayResponse } from '@/data/train/readinessApi'

afterEach(() => vi.unstubAllEnvs())

const noop = () => {}

function renderCard(readiness: ReadinessTodayResponse, handlers: Partial<Record<'onLighten' | 'onKeep' | 'onUndo', () => void>> = {}) {
  return render(
    <div className="trm">
      <ReadinessCard readiness={readiness} onLighten={handlers.onLighten ?? noop}
        onKeep={handlers.onKeep ?? noop} onUndo={handlers.onUndo ?? noop} />
    </div>,
  )
}

describe('ReadinessCard (prototype elo/edzes.html readyCard)', () => {
  test('offer: eyebrow, title, reason chips with their 3D icons, the care row and the note', () => {
    const { container } = renderCard(readinessMock)
    expect(screen.getByText('MAI ÁLLAPOT · A REGGELI CHECK-INBŐL')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Könnyebb nap javasolt' })).toBeInTheDocument()
    expect(screen.getByText('Kipihentség 4/10')).toBeInTheDocument()
    expect(screen.getByText('Izomláz 7/10')).toBeInTheDocument()
    expect(screen.getByText('Kedv 5/10')).toBeInTheDocument()
    const icons = Array.from(container.querySelectorAll('use')).map((u) => u.getAttribute('href'))
    expect(icons).toEqual(['#t-rested', '#t-soreness', '#t-motivation', '#t-pain'])
    expect(container.querySelector('.trd-care')?.textContent)
      .toBe('Rear Delt Fly — fáj a vállad (5/10). Ma óvatosan: könnyebb súly, vagy hagyd ki.')
    expect(screen.getByText('Csak javaslat — magától nem változtat semmit.')).toBeInTheDocument()
  })

  test('offer: the two taps fire their handlers', () => {
    const onLighten = vi.fn()
    const onKeep = vi.fn()
    renderCard(readinessMock, { onLighten, onKeep })
    fireEvent.click(screen.getByRole('button', { name: 'Könnyítsük' }))
    fireEvent.click(screen.getByRole('button', { name: 'Maradjon a terv' }))
    expect(onLighten).toHaveBeenCalledTimes(1)
    expect(onKeep).toHaveBeenCalledTimes(1)
  })

  test('offer: no care row and no intensity when nothing hurts / intensity unanswered', () => {
    const { container, rerender } = renderCard({ ...readinessMock, care: [] })
    expect(container.querySelector('.trd-care')).toBeNull()
    rerender(
      <div className="trm">
        <ReadinessCard readiness={{ ...readinessMock, care: [{ ...readinessMock.care[0], intensity: null }] }}
          onLighten={noop} onKeep={noop} onUndo={noop} />
      </div>,
    )
    expect(container.querySelector('.trd-care')?.textContent).toContain('fáj a vállad. Ma óvatosan')
  })

  test('lightened: sage state, the hold line naming the care exercise, and the undo', () => {
    const onUndo = vi.fn()
    const { container } = renderCard({ ...readinessMock, state: 'LIGHTENED' }, { onUndo })
    expect(screen.getByText('MAI ÁLLAPOT · KÖNNYÍTVE')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ma egy fokkal lejjebb' })).toBeInTheDocument()
    expect(container.querySelector('.trd-ok')?.textContent).toBe(
      'Minden gyakorlatnál a múlt heti súly marad, nem emelünk. A Rear Delt Fly nehéz szettjei kimaradnak.')
    expect(container.querySelector('.trd')?.getAttribute('style')).toContain('--dv-sage')
    fireEvent.click(screen.getByRole('button', { name: 'Visszaállítom a tervet' }))
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  test('lightened: „Az" before a vowel and a joined list for two care exercises', () => {
    const { container } = renderCard({
      ...readinessMock,
      state: 'LIGHTENED',
      care: [
        { exerciseName: 'Oldalemelés', region: 'VALL', regionLabel: 'vállad', intensity: 4 },
        { exerciseName: 'Face Pull', region: 'VALL', regionLabel: 'vállad', intensity: 4 },
      ],
    })
    expect(container.querySelector('.trd-ok')?.textContent).toContain('Az Oldalemelés és Face Pull nehéz szettjei kimaradnak.')
  })

  test('renders nothing for NONE and KEPT', () => {
    const { container: none } = renderCard({ ...readinessMock, state: 'NONE' })
    expect(none.querySelector('.trd')).toBeNull()
    const { container: kept } = renderCard({ ...readinessMock, state: 'KEPT' })
    expect(kept.querySelector('.trd')).toBeNull()
  })
})

describe('TodayReadiness (wired)', () => {
  function captureToasts() {
    const seen: string[] = []
    const off = onToast((t: ToastMessage) => { if ('text' in t) seen.push(t.text) })
    return { seen, off }
  }

  test('mock mode: Könnyítsük → lightened + toast; undo → offer + toast; Maradjon a terv hides it', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { seen, off } = captureToasts()
    render(<QueryWrapper><div className="trm"><TodayReadiness done={false} /></div></QueryWrapper>)

    fireEvent.click(screen.getByRole('button', { name: 'Könnyítsük' }))
    await screen.findByText('MAI ÁLLAPOT · KÖNNYÍTVE')
    fireEvent.click(screen.getByRole('button', { name: 'Visszaállítom a tervet' }))
    await screen.findByText('MAI ÁLLAPOT · A REGGELI CHECK-INBŐL')
    fireEvent.click(screen.getByRole('button', { name: 'Maradjon a terv' }))
    await waitFor(() => expect(screen.queryByText('Könnyebb nap javasolt')).toBeNull())

    expect(seen).toEqual(['Könnyítve — ma egy fokkal lejjebb', 'Visszaállítva az eredeti terv', 'Rendben, marad a terv'])
    off()
  })

  test('hidden once today’s workout is done', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { container } = render(<QueryWrapper><TodayReadiness done /></QueryWrapper>)
    expect(container.querySelector('.trd')).toBeNull()
  })

  test('real mode: hidden while the server says NONE, shown when it offers', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const { container, unmount } = render(<QueryWrapper><TodayReadiness done={false} /></QueryWrapper>)
    await waitFor(() => expect(container.querySelector('.trd')).toBeNull())
    unmount()

    server.use(http.get(`${API_BASE}/api/train/readiness/today`, () => HttpResponse.json(readinessMock)))
    render(<QueryWrapper><TodayReadiness done={false} /></QueryWrapper>)
    expect(await screen.findByText('Könnyebb nap javasolt')).toBeInTheDocument()
  })
})
