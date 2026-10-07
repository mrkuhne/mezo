import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { PlannedSkip } from '@/features/train/logic/plannedSkips'
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'

const voice = vi.hoisted(() => ({ onTranscript: null as null | ((t: string) => void), toggle: vi.fn() }))
vi.mock('@/shared/lib/voice/useVoiceInput', async (orig) => ({
  ...(await orig<typeof import('@/shared/lib/voice/useVoiceInput')>()),
  useVoiceInput: (onTranscript: (t: string) => void) => {
    voice.onTranscript = onTranscript
    return { state: 'idle', error: null, toggle: voice.toggle }
  },
}))

import { MealSkipSheet } from '@/features/fuel/sheets/MealSkipSheet'

const SHAME = /elrontott|túlléptél|hiba|rossz|bukta|kudarc/i

function sk(over: Partial<PlannedSkip> = {}): PlannedSkip {
  return {
    id: 's1', kind: 'MEAL', date: '2026-09-27', sessionKey: 'snack#1', reasonCategory: 'NONE', reasonText: null,
    plannedKcal: 420, source: 'USER', serious: false, freePass: false, excused: true, ...over,
  }
}

function renderSheet(skip: PlannedSkip | null = sk(), over: { canOpenRecovery?: boolean; open?: () => Promise<unknown> } = {}) {
  const h = {
    onClose: vi.fn(), onReason: vi.fn(), onDone: vi.fn(),
    openRecovery: vi.fn(over.open ?? (() => Promise.resolve())),
  }
  const r = render(<MealSkipSheet open skip={skip ?? undefined} slotLabel="Uzsonna"
    canOpenRecovery={over.canOpenRecovery ?? true} {...h} />)
  return { ...h, ...r }
}

afterEach(() => { vi.clearAllMocks(); vi.useRealTimers() })

describe('MealSkipSheet (prototype elo/fuel.html mealWhy)', () => {
  test('head: eyebrow, title, sub', () => {
    renderSheet()
    expect(screen.getByText('KIHAGYVA · UZSONNA')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Miért marad ki?' })).toBeInTheDocument()
    expect(screen.getByText('Nem kötelező. Segít, hogy a coach értse a mintát.')).toBeInTheDocument()
  })

  test('six chips in order, each with its Titanium icon', () => {
    renderSheet()
    const group = screen.getByRole('group', { name: 'A kihagyás oka' })
    const chips = Array.from(group.querySelectorAll('button'))
    expect(chips.map((c) => c.textContent)).toEqual(
      ['Nem vagyok éhes', 'Nincs időm', 'Gyomorrontás', 'Beteg vagyok', 'Úton vagyok', 'Egyéb'])
    expect(chips.map((c) => c.querySelector('use')?.getAttribute('href'))).toEqual(
      ['#t-nohunger', '#t-clock', '#t-digestion', '#t-ill', '#t-travel', '#t-other'])
  })

  test('Kész is disabled until a chip is chosen; the invitation note shows', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Kész' })).toBeDisabled()
    expect(screen.getByText('Ha megmondod, miért, a coach érteni fogja a mintát. Nem kötelező.')).toBeInTheDocument()
  })

  test('a chip tap saves the reason immediately', () => {
    const { onReason } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Nem vagyok éhes' }))
    expect(onReason).toHaveBeenCalledWith('NOT_HUNGRY', undefined)
  })

  test('a plain reason: lit chip, Kész enabled, not-a-miss note, no duration row', () => {
    renderSheet(sk({ reasonCategory: 'NOT_HUNGRY' }))
    expect(screen.getByRole('button', { name: 'Nem vagyok éhes' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Kész' })).toBeEnabled()
    expect(screen.getByText('Nem számít mulasztásnak.')).toBeInTheDocument()
    expect(screen.queryByText('MEDDIG TARTHAT?')).toBeNull()
  })

  test('a serious reason (Gyomorrontás) shows „MEDDIG TARTHAT?"', () => {
    renderSheet(sk({ reasonCategory: 'STOMACH', serious: true }))
    expect(screen.getByText('MEDDIG TARTHAT?')).toBeInTheDocument()
    expect(screen.getByText('Jobbulást!')).toBeInTheDocument()
  })

  test('no duration row while a period is already open', () => {
    renderSheet(sk({ reasonCategory: 'STOMACH' }), { canOpenRecovery: false })
    expect(screen.queryByText('MEDDIG TARTHAT?')).toBeNull()
  })

  test('a duration chip opens the period from the skipped day, shows the note, closes and toasts', async () => {
    vi.useFakeTimers()
    const toasts: ToastMessage[] = []
    const off = onToast((t) => toasts.push(t))
    const { openRecovery, onClose } = renderSheet(sk({ reasonCategory: 'STOMACH' }))
    fireEvent.click(screen.getByRole('button', { name: '2–3 nap' }))
    expect(openRecovery).toHaveBeenCalledWith({ category: 'STOMACH', estimate: 'FEW_DAYS', startDate: '2026-09-27' })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByRole('status')).toHaveTextContent(
      'Kímélő mód bekapcsolva · amíg tart, a Fuel nem kér számon semmit, az edzés és a sport pedig magától kimarad.')
    await act(async () => { vi.advanceTimersByTime(1400) })
    expect(toasts.map((t) => ('text' in t ? t.text : ''))).toContain('Kímélő mód bekapcsolva')
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(onClose).toHaveBeenCalled()
    off()
  })

  test('a failed period write resets the row', async () => {
    renderSheet(sk({ reasonCategory: 'ILLNESS' }), { open: () => Promise.reject(new Error('x')) })
    fireEvent.click(screen.getByRole('button', { name: 'Csak ma' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Csak ma' })).toHaveAttribute('aria-pressed', 'false'))
    expect(screen.queryByRole('status')).toBeNull()
  })

  test('Egyéb shows the text field with dictation; Kész hands over the text and toasts', async () => {
    const toasts: ToastMessage[] = []
    const off = onToast((t) => toasts.push(t))
    const { onDone } = renderSheet(sk({ reasonCategory: 'OTHER' }))
    const ta = screen.getByPlaceholderText('pl. elhúzódott a megbeszélés')
    fireEvent.change(ta, { target: { value: ' elhúzódott ' } })
    act(() => voice.onTranscript!('a megbeszélés'))
    expect(ta).toHaveValue(' elhúzódott  a megbeszélés')
    fireEvent.click(screen.getByRole('button', { name: 'Kész' }))
    expect(onDone).toHaveBeenCalledWith('elhúzódott  a megbeszélés')
    await waitFor(() => expect(toasts.map((t) => ('text' in t ? t.text : ''))).toContain('Megjegyeztem · „elhúzódott  a megbeszélés”'))
    off()
  })

  test('„Most nem mondom" closes without saving', async () => {
    const { onClose, onReason, onDone } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Most nem mondom' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onReason).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })

  test('renders nothing without a skip row', () => {
    renderSheet(null)
    expect(screen.queryByText('Miért marad ki?')).toBeNull()
  })

  test('no shame vocabulary in any chosen state', () => {
    for (const c of ['NONE', 'NOT_HUNGRY', 'STOMACH', 'OTHER'] as const) {
      const { container, unmount } = renderSheet(sk({ reasonCategory: c, serious: c === 'STOMACH' }))
      expect(container.ownerDocument.body.textContent).not.toMatch(SHAME)
      unmount()
    }
  })
})
