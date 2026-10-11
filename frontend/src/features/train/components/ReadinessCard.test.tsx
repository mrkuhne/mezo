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
    <div>
      <ReadinessCard readiness={readiness} onLighten={handlers.onLighten ?? noop}
        onKeep={handlers.onKeep ?? noop} onUndo={handlers.onUndo ?? noop} />
    </div>,
  )
}

describe('ReadinessCard (prototype vilagos/edzes.js readyCard)', () => {
  test('offer: the amber hero — eyebrow, verdict, one tube per reason filled to its value, the care box and the note', () => {
    const { container } = renderCard(readinessMock)
    const hero = container.querySelector('.fo-hero.warn.em-ready') as HTMLElement
    expect(hero).toBeInTheDocument()
    expect(container.querySelector('.glass, .trd')).toBeNull()
    expect(hero.querySelector('.fo-hero-lbl')?.textContent).toBe('Mai állapot · a reggeli check-inből')
    expect(hero.querySelector('.fo-hero-verdict')?.textContent).toBe('Könnyebb nap javasolt')
    const tubes = [...hero.querySelectorAll('.em-rd .fo-vial')] as HTMLElement[]
    expect(tubes.map((t) => `${t.querySelector('small')?.textContent} ${t.querySelector(':scope > b')?.textContent}`))
      .toEqual(['Kipihentség 4/10', 'Izomláz 7/10', 'Kedv 5/10'])
    // the level is the value; the colour is its state (low rest = warn, high soreness = bad, fair mood = ok)
    expect(tubes.map((t) => (t.querySelector('.l') as HTMLElement).style.getPropertyValue('--p'))).toEqual(['40%', '70%', '50%'])
    expect(tubes.map((t) => t.style.getPropertyValue('--c'))).toEqual(['var(--fo-warn)', 'var(--fo-bad)', 'var(--fo-ok)'])
    const icons = Array.from(container.querySelectorAll('use')).map((u) => u.getAttribute('href'))
    expect(icons).toEqual(['#t-rested', '#t-soreness', '#t-motivation', '#t-pain'])
    expect(container.querySelector('.fo-box.em-care')?.textContent)
      .toBe('Rear Delt FlyFáj a vállad (5/10). Ma óvatosan: könnyebb súly, vagy hagyd ki.')
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
    expect(container.querySelector('.em-care')).toBeNull()
    rerender(
      <div>
        <ReadinessCard readiness={{ ...readinessMock, care: [{ ...readinessMock.care[0], intensity: null }] }}
          onLighten={noop} onKeep={noop} onUndo={noop} />
      </div>,
    )
    expect(container.querySelector('.em-care')?.textContent).toContain('Fáj a vállad. Ma óvatosan')
  })

  test('lightened: the calm hero with the green tick, the hold line naming the care exercise, and the undo', () => {
    const onUndo = vi.fn()
    const { container } = renderCard({ ...readinessMock, state: 'LIGHTENED' }, { onUndo })
    expect(screen.getByText('Mai állapot · könnyítve')).toBeInTheDocument()
    expect(container.querySelector('.em-ready.is-lightened .fo-hero-verdict')?.textContent).toBe('Ma egy fokkal lejjebb')
    expect(container.querySelector('.em-ready .fo-hero-sub')?.textContent).toBe(
      'Minden gyakorlatnál a múlt heti súly marad, nem emelünk. A Rear Delt Fly nehéz szettjei kimaradnak.')
    expect(container.querySelector('.em-ready')).not.toHaveClass('warn')
    expect(container.querySelector('.em-ready .fo-hero-left use')?.getAttribute('href')).toBe('#t-tick')
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
    expect(container.querySelector('.em-ready .fo-hero-sub')?.textContent).toContain('Az Oldalemelés és Face Pull nehéz szettjei kimaradnak.')
  })

  test('renders nothing for NONE and KEPT', () => {
    const { container: none } = renderCard({ ...readinessMock, state: 'NONE' })
    expect(none.querySelector('.em-ready')).toBeNull()
    const { container: kept } = renderCard({ ...readinessMock, state: 'KEPT' })
    expect(kept.querySelector('.em-ready')).toBeNull()
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
    render(<QueryWrapper><div><TodayReadiness done={false} /></div></QueryWrapper>)

    fireEvent.click(screen.getByRole('button', { name: 'Könnyítsük' }))
    await screen.findByText('Mai állapot · könnyítve')
    fireEvent.click(screen.getByRole('button', { name: 'Visszaállítom a tervet' }))
    await screen.findByText('Mai állapot · a reggeli check-inből')
    fireEvent.click(screen.getByRole('button', { name: 'Maradjon a terv' }))
    await waitFor(() => expect(screen.queryByText('Könnyebb nap javasolt')).toBeNull())

    expect(seen).toEqual(['Könnyítve — ma egy fokkal lejjebb', 'Visszaállítva az eredeti terv', 'Rendben, marad a terv'])
    off()
  })

  test('hidden once today’s workout is done', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { container } = render(<QueryWrapper><TodayReadiness done /></QueryWrapper>)
    expect(container.querySelector('.em-ready')).toBeNull()
  })

  test('real mode: hidden while the server says NONE, shown when it offers', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const { container, unmount } = render(<QueryWrapper><TodayReadiness done={false} /></QueryWrapper>)
    await waitFor(() => expect(container.querySelector('.em-ready')).toBeNull())
    unmount()

    server.use(http.get(`${API_BASE}/api/train/readiness/today`, () => HttpResponse.json(readinessMock)))
    render(<QueryWrapper><TodayReadiness done={false} /></QueryWrapper>)
    expect(await screen.findByText('Könnyebb nap javasolt')).toBeInTheDocument()
  })
})
