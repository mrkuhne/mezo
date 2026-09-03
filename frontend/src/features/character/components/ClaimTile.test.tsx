// ClaimTile — the three feedback flows (mezo-1gim.13, Task 4). Mode-agnostic: `useClaimFeedback`
// is stubbed at the `@/data/hooks` boundary (the KarakterHubPage.test.tsx idiom), so this file
// pins the COMPONENT's local-state contract (thanks/retired/textarea), not the hook's dual-mode
// behavior — that lives in characterHooks.test.tsx.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ClaimTile } from './ClaimTile'
import type { CharacterClaimDto } from '@/data/character/characterApi'

const hoisted = vi.hoisted(() => ({ submitSpy: vi.fn().mockResolvedValue(undefined), pending: false, showSpy: vi.fn() }))

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return { ...actual, useClaimFeedback: () => ({ submit: hoisted.submitSpy, pending: hoisted.pending }) }
})
vi.mock('@/shared/ui/ToastProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui/ToastProvider')>()
  return { ...actual, useToast: () => ({ show: hoisted.showSpy }) }
})

const claim: CharacterClaimDto = {
  id: 'physical-claim-0',
  text: 'A testzsírszázalék lassan csökken, miközben a testsúly stagnál.',
  confidence: 0.8,
  sensitive: false,
  evidence: [{ kind: 'observation', label: 'x' }],
}

beforeEach(() => {
  hoisted.submitSpy.mockClear()
  hoisted.showSpy.mockClear()
  hoisted.pending = false
})

describe('ClaimTile', () => {
  test('shows the confidence-word chip and claim text', () => {
    render(<ClaimTile claim={claim} />)
    expect(screen.getByText('biztos')).toBeInTheDocument()
    expect(screen.getByText(claim.text)).toBeInTheDocument()
  })

  test('sensitive claims carry the sensitive frame class, no fabricated mirror line', () => {
    const { container } = render(<ClaimTile claim={{ ...claim, sensitive: true }} />)
    expect(container.querySelector('.kr-claim.sensitive')).toBeInTheDocument()
    expect(container.querySelector('.cmirror, .kr-cmirror')).not.toBeInTheDocument()
  })

  test('talál submits TALAL, shows thanks microcopy, and disables the pills', async () => {
    render(<ClaimTile claim={claim} />)
    await userEvent.click(screen.getByRole('button', { name: 'Talál' }))
    expect(hoisted.submitSpy).toHaveBeenCalledWith('physical-claim-0', 'TALAL')
    expect(screen.getByText('✓ Köszönöm — jegyzem.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Talál' })).not.toBeInTheDocument()
  })

  test('nem igaz submits NEM_IGAZ, flips to the retired face, and toasts — the claim stays rendered locally', async () => {
    render(<ClaimTile claim={claim} />)
    await userEvent.click(screen.getByRole('button', { name: 'Nem igaz' }))
    expect(hoisted.submitSpy).toHaveBeenCalledWith('physical-claim-0', 'NEM_IGAZ')
    expect(screen.getByText('nyugdíjazva — a csapat nem viszi tovább')).toBeInTheDocument()
    expect(screen.getByText(claim.text)).toBeInTheDocument()
    expect(hoisted.showSpy).toHaveBeenCalledWith({ kind: 'info', text: 'Rendben — a csapat nem viszi tovább' })
  })

  test('pontosítom opens a textarea; Küldés submits PONTOSITOM with the text and toasts, claim text unchanged', async () => {
    render(<ClaimTile claim={claim} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pontosítom' }))
    const textarea = screen.getByPlaceholderText('Mit pontosítanál?')
    await userEvent.type(textarea, 'nem pontos')
    await userEvent.click(screen.getByRole('button', { name: 'Küldés' }))
    expect(hoisted.submitSpy).toHaveBeenCalledWith('physical-claim-0', 'PONTOSITOM', 'nem pontos')
    expect(hoisted.showSpy).toHaveBeenCalledWith({ kind: 'info', text: 'Elküldve — a következő konzíliumon foglalkozik vele a csapat' })
    expect(screen.getByText(claim.text)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Mit pontosítanál?')).not.toBeInTheDocument()
  })

  // Fix round 1 (reviewer finding #2): a rejected mutation must never show a success face —
  // the pills/textarea revert and an honest error toast fires instead.
  describe('failure paths (rejected mutation never fakes success)', () => {
    test('talál: a failed submit shows no thanks microcopy, pills stay usable, error toast fires', async () => {
      hoisted.submitSpy.mockRejectedValueOnce(new Error('network'))
      render(<ClaimTile claim={claim} />)
      await userEvent.click(screen.getByRole('button', { name: 'Talál' }))
      expect(screen.queryByText('✓ Köszönöm — jegyzem.')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Talál' })).toBeInTheDocument()
      expect(hoisted.showSpy).toHaveBeenCalledWith({ kind: 'error', text: 'Nem sikerült elküldeni a visszajelzést — próbáld újra' })
    })

    test('nem igaz: a failed submit shows no retired face, no success toast, error toast fires', async () => {
      hoisted.submitSpy.mockRejectedValueOnce(new Error('network'))
      render(<ClaimTile claim={claim} />)
      await userEvent.click(screen.getByRole('button', { name: 'Nem igaz' }))
      expect(screen.queryByText('nyugdíjazva — a csapat nem viszi tovább')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Nem igaz' })).toBeInTheDocument()
      expect(hoisted.showSpy).not.toHaveBeenCalledWith({ kind: 'info', text: 'Rendben — a csapat nem viszi tovább' })
      expect(hoisted.showSpy).toHaveBeenCalledWith({ kind: 'error', text: 'Nem sikerült elküldeni a visszajelzést — próbáld újra' })
    })

    test('pontosítom: a failed submit keeps the textarea open with the typed text, error toast fires', async () => {
      hoisted.submitSpy.mockRejectedValueOnce(new Error('network'))
      render(<ClaimTile claim={claim} />)
      await userEvent.click(screen.getByRole('button', { name: 'Pontosítom' }))
      const textarea = screen.getByPlaceholderText('Mit pontosítanál?')
      await userEvent.type(textarea, 'nem pontos')
      await userEvent.click(screen.getByRole('button', { name: 'Küldés' }))
      expect(screen.getByPlaceholderText('Mit pontosítanál?')).toHaveValue('nem pontos')
      expect(hoisted.showSpy).not.toHaveBeenCalledWith({ kind: 'info', text: 'Elküldve — a következő konzíliumon foglalkozik vele a csapat' })
      expect(hoisted.showSpy).toHaveBeenCalledWith({ kind: 'error', text: 'Nem sikerült elküldeni a visszajelzést — próbáld újra' })
    })
  })
})
