import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { PlannedSkip } from '@/features/train/logic/plannedSkips'
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'

const voice = vi.hoisted(() => ({
  onTranscript: null as null | ((t: string) => void),
  toggle: vi.fn(),
}))
vi.mock('@/features/insights/logic/useVoiceInput', () => ({
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
    expect(screen.getByText('KIHAGYVA · PULL DAY')).toBeInTheDocument()
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
    expect(screen.getByText('Ha megmondod, miért, a terv és az edző ehhez igazodik. Nem kötelező.')).toBeInTheDocument()
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

  test('renders nothing when closed or without a skip', () => {
    renderSheet(sk(), false)
    expect(screen.queryByText('Miért marad ki?')).toBeNull()
    renderSheet(null, true)
    expect(screen.queryByText('Miért marad ki?')).toBeNull()
  })
})
