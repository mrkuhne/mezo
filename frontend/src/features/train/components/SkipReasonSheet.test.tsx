import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { PlannedSkip } from '@/features/train/logic/plannedSkips'
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'

const voice = vi.hoisted(() => ({
  onTranscript: null as null | ((t: string) => void),
  toggle: vi.fn(),
}))
vi.mock('@/shared/lib/voice/useVoiceInput', async (orig) => ({
  ...(await orig<typeof import('@/shared/lib/voice/useVoiceInput')>()),
  useVoiceInput: (onTranscript: (t: string) => void) => {
    voice.onTranscript = onTranscript
    return { state: 'idle', error: null, toggle: voice.toggle }
  },
}))

import { SkipReasonSheet } from '@/features/train/components/SkipReasonSheet'

function sk(over: Partial<PlannedSkip> = {}): PlannedSkip {
  return {
    id: 's1', kind: 'GYM', date: '2026-09-29', reasonCategory: 'NONE', reasonText: null, source: 'USER',
    serious: false, freePass: true, excused: true, ...over,
  }
}

function renderSheet(skip: PlannedSkip | null = sk(), open = true) {
  const h = { onClose: vi.fn(), onReason: vi.fn(), onDone: vi.fn() }
  const r = render(<SkipReasonSheet open={open} skip={skip ?? undefined} title="Pull Day" {...h} />)
  return { ...h, ...r }
}

afterEach(() => vi.clearAllMocks())

describe('SkipReasonSheet (prototype elo/edzes.html whySheet)', () => {
  test('head: eyebrow, title, sub', () => {
    renderSheet()
    expect(screen.getByText('Kihagyva · Pull Day')).toBeInTheDocument()
    // Folyadék (mezo-n4wf5.3, prototype `whySheet()`): the light sheet, no glass
    expect(document.body.querySelector('.sheet.fo-sheet.em-why')).toBeInTheDocument()
    expect(document.body.querySelector('.sheet.glass, [class*="uvl-"], .trm-whyc')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Miért marad ki?' })).toBeInTheDocument()
    expect(screen.getByText('Nem kötelező — segít, hogy a terv hozzád igazodjon.')).toBeInTheDocument()
  })

  test('renders the 8 reason chips, each with its Titanium icon', () => {
    renderSheet()
    const labels = ['Beteg vagyok', 'Gyomorrontás', 'Sérülés / fájdalom', 'Úton vagyok', 'Fáradt vagyok', 'Nincs időm', 'Nincs kedvem', 'Egyéb']
    const icons = ['t-ill', 't-digestion', 't-pain', 't-travel', 't-rested', 't-clock', 't-motivation', 't-other']
    labels.forEach((l, i) => {
      const chip = screen.getByRole('button', { name: l })
      expect(chip.querySelector('use')?.getAttribute('href')).toBe(`#${icons[i]}`)
    })
  })

  test('Kész is disabled while no reason is chosen; the invitation note shows', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Kész' })).toBeDisabled()
    expect(document.body.querySelector('.em-whynote .fo-box')?.textContent).toBe('Nem kötelezőHa megmondod, miért, a terv és az edző ehhez igazodik.')
  })

  test('choosing Fáradt calls onReason with TIRED immediately', () => {
    const { onReason } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Fáradt vagyok' }))
    expect(onReason).toHaveBeenCalledWith('TIRED', undefined)
  })

  test('the chosen chip is lit and Kész enables', () => {
    renderSheet(sk({ reasonCategory: 'TIRED' }))
    expect(screen.getByRole('button', { name: 'Fáradt vagyok' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Kész' })).toBeEnabled()
    expect(screen.getByText('Ezt a heti szabadjegyed fedezi')).toBeInTheDocument()
  })

  test('OTHER shows the textarea (with dictation); Kész hands over the text and toasts', async () => {
    const toasts: ToastMessage[] = []
    const off = onToast((t) => toasts.push(t))
    const { onDone } = renderSheet(sk({ reasonCategory: 'OTHER' }))
    const ta = screen.getByPlaceholderText('pl. családi program jött közbe')
    expect(ta).toHaveAttribute('maxLength', '500')
    fireEvent.change(ta, { target: { value: '  családi program ' } })
    act(() => voice.onTranscript!('jött közbe'))
    expect(ta).toHaveValue('  családi program  jött közbe')
    fireEvent.click(screen.getByRole('button', { name: 'Diktálás' }))
    expect(voice.toggle).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Kész' }))
    expect(onDone).toHaveBeenCalledWith('családi program  jött közbe')
    await waitFor(() => expect(toasts.map((t) => ('text' in t ? t.text : ''))).toContain('Megjegyeztem · „családi program  jött közbe”'))
    off()
  })

  test('no textarea for a non-OTHER reason', () => {
    renderSheet(sk({ reasonCategory: 'TIRED' }))
    expect(screen.queryByPlaceholderText('pl. családi program jött közbe')).toBeNull()
  })

  test('„Most nem mondom" closes without a reason call', async () => {
    const { onClose, onReason, onDone } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Most nem mondom' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onReason).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })

  test('„Most nem mondom" keeps a typed Egyéb text silently (no toast)', async () => {
    const toasts: ToastMessage[] = []
    const off = onToast((t) => toasts.push(t))
    const { onClose, onReason, onDone } = renderSheet(sk({ reasonCategory: 'OTHER' }))
    fireEvent.change(screen.getByPlaceholderText('pl. családi program jött közbe'), { target: { value: ' vendég jött ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Most nem mondom' }))
    expect(onReason).toHaveBeenCalledWith('OTHER', 'vendég jött')
    expect(onDone).not.toHaveBeenCalled()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(toasts).toEqual([])
    off()
  })

  test('„Most nem mondom" with unchanged Egyéb text makes no call', async () => {
    const { onClose, onReason } = renderSheet(sk({ reasonCategory: 'OTHER', reasonText: 'program' }))
    fireEvent.click(screen.getByRole('button', { name: 'Most nem mondom' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onReason).not.toHaveBeenCalled()
  })

  test('renders nothing when closed or without a skip', () => {
    renderSheet(sk(), false)
    expect(screen.queryByText('Miért marad ki?')).toBeNull()
    renderSheet(null, true)
    expect(screen.queryByText('Miért marad ki?')).toBeNull()
  })
})

describe('SkipReasonSheet · kímélő mód (Kihagyás S2, prototype whySheet .kmdur)', () => {
  function renderKm(skip: PlannedSkip, over: { canOpenRecovery?: boolean; open?: () => Promise<unknown> } = {}) {
    const h = {
      onClose: vi.fn(), onReason: vi.fn(), onDone: vi.fn(), onRecoveryOpened: vi.fn(),
      onOpenRecovery: vi.fn(over.open ?? (() => Promise.resolve())),
    }
    const r = render(<SkipReasonSheet open skip={skip} title="Pull Day" canOpenRecovery={over.canOpenRecovery ?? true} {...h} />)
    return { ...h, ...r }
  }
  const ill = () => sk({ reasonCategory: 'ILLNESS', serious: true, freePass: false })

  afterEach(() => vi.useRealTimers())

  test('a serious reason shows „Meddig tarthat?" with the four chips', () => {
    renderKm(ill())
    expect(screen.getByText('MEDDIG TARTHAT?')).toBeInTheDocument()
    for (const l of ['Csak ma', '2–3 nap', 'Kb. egy hét', 'Nem tudom']) expect(screen.getByRole('button', { name: l })).toBeInTheDocument()
  })

  test('no row for a non-serious reason, and none while a period is already open', () => {
    const { unmount } = renderKm(sk({ reasonCategory: 'TIRED' }))
    expect(screen.queryByText('MEDDIG TARTHAT?')).toBeNull()
    unmount()
    renderKm(ill(), { canOpenRecovery: false })
    expect(screen.queryByText('MEDDIG TARTHAT?')).toBeNull()
  })

  test('no chip picked = S1 behaviour (the serious note, Kész works)', () => {
    const { onOpenRecovery } = renderKm(ill())
    expect(screen.getByText('Nem számít mulasztásnak.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Kész' }))
    expect(onOpenRecovery).not.toHaveBeenCalled()
  })

  test('a chip opens the period, shows the note, closes after 1.4 s and toasts', async () => {
    vi.useFakeTimers()
    const toasts: ToastMessage[] = []
    const off = onToast((t) => toasts.push(t))
    const { onOpenRecovery, onRecoveryOpened, onClose } = renderKm(ill())
    fireEvent.click(screen.getByRole('button', { name: '2–3 nap' }))
    expect(onOpenRecovery).toHaveBeenCalledWith('FEW_DAYS')
    await act(async () => { await Promise.resolve() })
    expect(screen.getByRole('status').querySelector('.fo-box')?.textContent).toBe(
      'Kímélő mód bekapcsolvaAmíg tart, az edzés és a sport magától kimarad, és nem számít mulasztásnak.')
    expect(screen.getByRole('status').querySelector('use')?.getAttribute('href')).toBe('#t-kimelo')
    expect(screen.getByRole('button', { name: '2–3 nap' })).toHaveAttribute('aria-pressed', 'true')
    expect(onRecoveryOpened).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(1400) })
    expect(onRecoveryOpened).toHaveBeenCalledTimes(1)
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(onClose).toHaveBeenCalled()
    expect(toasts.map((t) => ('text' in t ? t.text : ''))).toContain('Kímélő mód bekapcsolva')
    off()
  })

  test('closed early after the save: finishes once, with the LATEST onRecoveryOpened', async () => {
    const first = vi.fn()
    const latest = vi.fn()
    const props = { open: true, skip: ill(), title: 'Pull Day', canOpenRecovery: true, onClose: vi.fn(), onReason: vi.fn(), onDone: vi.fn(),
      onOpenRecovery: () => Promise.resolve() }
    const { rerender, unmount } = render(<SkipReasonSheet {...props} onRecoveryOpened={first} />)
    fireEvent.click(screen.getByRole('button', { name: '2–3 nap' }))
    await act(async () => { await Promise.resolve() })
    rerender(<SkipReasonSheet {...props} onRecoveryOpened={latest} />)
    unmount()
    expect(latest).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })

  test('a failed open resets the row (no note, no close)', async () => {
    const { onRecoveryOpened, onClose } = renderKm(ill(), { open: () => Promise.reject(new Error('x')) })
    fireEvent.click(screen.getByRole('button', { name: 'Kb. egy hét' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Kb. egy hét' })).toHaveAttribute('aria-pressed', 'false'))
    expect(screen.queryByRole('status')).toBeNull()
    expect(onRecoveryOpened).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
