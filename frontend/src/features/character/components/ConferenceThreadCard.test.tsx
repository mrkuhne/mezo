// ConferenceThreadCard — one dossier chapter's thread, collapsed by default (mezo-xlvr).
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { ConferenceThreadCard } from './ConferenceThreadCard'
import { MOCK_EXPERTS } from '@/data/character/characterMock'
import type { ConferenceThread } from '@/data/character/characterApi'

const THREAD: ConferenceThread = {
  dimensionKey: 'recovery',
  title: 'Regeneráció',
  items: [
    {
      index: 0,
      expertKey: 'szomnologus',
      text: 'Romlik az alvásod.',
      kind: 'NEW',
      claimId: null,
      sensitive: false,
      reactions: [{ expertKey: 'pszichologus', stance: 'CHALLENGE', argument: 'Lehet stressz is.' }],
      skeptic: { verdict: 'KILL', argument: 'Kevés adat.' },
      chair: { accepted: false, confidence: 0.4, reason: 'Nem engedem be.' },
    },
    {
      index: 1,
      expertKey: 'pszichologus',
      text: 'Feszült hét áll mögötted.',
      kind: 'NEW',
      claimId: null,
      sensitive: false,
      reactions: [],
      skeptic: { verdict: 'KEEP', argument: 'Elfogadható.' },
      chair: { accepted: true, confidence: 0.8, reason: 'Rendben.' },
    },
  ],
}

describe('ConferenceThreadCard', () => {
  test('collapsed by default: shows the chapter, the tally and every claim text, but no reasoning', () => {
    render(<ConferenceThreadCard thread={THREAD} experts={MOCK_EXPERTS} />)

    expect(screen.getByText('Regeneráció')).toBeInTheDocument()
    expect(screen.getByText(/2 állítás/)).toBeInTheDocument()
    expect(screen.getByText(/1 maradt meg/)).toBeInTheDocument()
    expect(screen.getByText('Romlik az alvásod.')).toBeInTheDocument()
    expect(screen.queryByText('Kevés adat.')).not.toBeInTheDocument()
  })

  test('opening the thread reveals the chain: peer stance, skeptic, chair', async () => {
    render(<ConferenceThreadCard thread={THREAD} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText('Lehet stressz is.')).toBeInTheDocument()
    expect(screen.getByText(/Kevés adat\./)).toBeInTheDocument()
    expect(screen.getByText(/Nem engedem be\./)).toBeInTheDocument()
  })

  test('confidence is shown as a word, never as a number', async () => {
    render(<ConferenceThreadCard thread={THREAD} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText(/biztos/)).toBeInTheDocument()
    expect(screen.queryByText(/0\.8/)).not.toBeInTheDocument()
  })

  test('an item with no skeptic verdict says the round gave no answer', async () => {
    const open: ConferenceThread = {
      ...THREAD,
      items: [{ ...THREAD.items[0], skeptic: null, chair: null }],
    }
    render(<ConferenceThreadCard thread={open} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    const noAnswers = screen.getAllByText(/nem adott választ/)
    expect(noAnswers).toHaveLength(2)
  })
})
