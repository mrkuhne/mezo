// ConferenceThreadCard — one dossier chapter's thread, collapsed by default (mezo-xlvr).
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { ConferenceThreadCard } from './ConferenceThreadCard'
import { MOCK_CONFERENCE_DETAIL, MOCK_EXPERTS } from '@/data/character/characterMock'
import type { ConferenceThread } from '@/data/character/characterApi'

const W2_THREADS = MOCK_CONFERENCE_DETAIL.w2.deliberation!
const THREAD_WITH_REACTIONS = { ...W2_THREADS[0], items: [W2_THREADS[0].items[0]] }
const THREAD_RETIRE = { ...W2_THREADS[0], items: [W2_THREADS[0].items[1]] }
const THREAD_NO_REACTIONS = W2_THREADS[2]

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
    render(<ConferenceThreadCard thread={THREAD} experts={MOCK_EXPERTS} crossTalkRan />)

    expect(screen.getByText('Regeneráció')).toBeInTheDocument()
    expect(screen.getByText(/2 állítás/)).toBeInTheDocument()
    expect(screen.getByText(/1 hozzászólás/)).toBeInTheDocument()
    expect(screen.getByText('Romlik az alvásod.')).toBeInTheDocument()
    expect(screen.queryByText('Kevés adat.')).not.toBeInTheDocument()
  })

  test('opening the thread reveals the chain: peer stance, skeptic, chair', async () => {
    render(<ConferenceThreadCard thread={THREAD} experts={MOCK_EXPERTS} crossTalkRan />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText('Lehet stressz is.')).toBeInTheDocument()
    expect(screen.getByText(/Kevés adat\./)).toBeInTheDocument()
    expect(screen.getByText(/Nem engedem be\./)).toBeInTheDocument()
  })

  test('confidence is shown as a word, never as a number', async () => {
    render(<ConferenceThreadCard thread={THREAD} experts={MOCK_EXPERTS} crossTalkRan />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText(/biztos/)).toBeInTheDocument()
    expect(screen.queryByText(/0\.8/)).not.toBeInTheDocument()
  })

  // I3 (mezo-xlvr final review): an accepted item's badge must say what actually happened to the
  // dossier — an accepted RETIRE retired a claim, it did not add one.
  test.each([
    ['NEW', 'Bekerült'],
    ['UP', 'Megerősítve'],
    ['DOWN', 'Gyengítve'],
    ['RETIRE', 'Nyugdíjazva'],
  ])('an accepted %s item is labelled %s', (kind, label) => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [{ ...THREAD.items[1], kind }],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} crossTalkRan />)

    expect(screen.getByText(label)).toBeInTheDocument()
  })

  test('an accepted item with an unknown kind falls back to the neutral "Elfogadva"', () => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [{ ...THREAD.items[1], kind: null }],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} crossTalkRan />)

    expect(screen.getByText('Elfogadva')).toBeInTheDocument()
  })

  test('a rejected item is labelled "Elvetve"', () => {
    const thread: ConferenceThread = { ...THREAD, items: [THREAD.items[0]] }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} crossTalkRan />)

    expect(screen.getByText('Elvetve')).toBeInTheDocument()
  })

  test('an item the chair never ruled on says "Nincs döntés" — and is not styled as rejected', () => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [{ ...THREAD.items[0], chair: null }],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} crossTalkRan />)

    const badge = screen.getByText('Nincs döntés')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('non')
    expect(badge.className).not.toContain('rej')
  })

  test('the header tally counts what it says it counts: accepted items', () => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [{ ...THREAD.items[0], reactions: [] }, { ...THREAD.items[1], kind: 'RETIRE' }],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} crossTalkRan={false} />)

    // one accepted RETIRE: it is "elfogadva", and nothing "maradt meg"
    expect(screen.getByText('2 állítás · 1 elfogadva')).toBeInTheDocument()
    expect(screen.queryByText(/maradt meg/)).not.toBeInTheDocument()
  })

  test('an item with no skeptic verdict says the round gave no answer', async () => {
    const open: ConferenceThread = {
      ...THREAD,
      items: [{ ...THREAD.items[0], skeptic: null, chair: null }],
    }
    render(<ConferenceThreadCard thread={open} experts={MOCK_EXPERTS} crossTalkRan />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    const noAnswers = screen.getAllByText(/nem adott választ/)
    expect(noAnswers).toHaveLength(2)
  })

  test('a fejléc a hozzászólások számát mutatja, ha volt kereszt-vita', () => {
    render(<ConferenceThreadCard thread={THREAD_WITH_REACTIONS} experts={MOCK_EXPERTS} crossTalkRan />)
    expect(screen.getByText('3 hozzászólás')).toBeInTheDocument()
  })

  test('a fejléc "nem vitatták"-at mond, ha a kör lefutott, de nem volt reakció', () => {
    render(<ConferenceThreadCard thread={THREAD_NO_REACTIONS} experts={MOCK_EXPERTS} crossTalkRan />)
    expect(screen.getByText(/nem vitatták/)).toBeInTheDocument()
    expect(screen.queryByText(/hozzászólás/)).not.toBeInTheDocument()
  })

  test('ha a kereszt-vita kör nem is létezett, a régi elfogadás-számláló marad', () => {
    render(<ConferenceThreadCard thread={THREAD_NO_REACTIONS} experts={MOCK_EXPERTS} crossTalkRan={false} />)
    expect(screen.getByText(/elfogadva/)).toBeInTheDocument()
    expect(screen.queryByText(/nem vitatták/)).not.toBeInTheDocument()
  })

  test('a lenyitott lánc orb-ot rajzol, nem pöttyöt', async () => {
    const { container } = render(
      <ConferenceThreadCard thread={THREAD_WITH_REACTIONS} experts={MOCK_EXPERTS} crossTalkRan defaultOpen />,
    )
    // M2 (mezo-sp9w branch-review): `.kr-thdot` no longer exists anywhere in the CSS or in any
    // component, so asserting its absence alone can never catch a regression — the only
    // assertion that actually exercises "the chain draws orbs" is this one.
    expect(container.querySelectorAll('.kr-thstep .kr-thorb').length).toBeGreaterThan(0)
  })

  test('a reakciók állásfoglalás-chipet kapnak', () => {
    render(<ConferenceThreadCard thread={THREAD_WITH_REACTIONS} experts={MOCK_EXPERTS} crossTalkRan defaultOpen />)
    expect(screen.getByText('támogatja')).toBeInTheDocument()
    expect(screen.getByText('vitatja')).toBeInTheDocument()
    expect(screen.getByText('árnyalja')).toBeInTheDocument()
  })

  test('Mezo döntése a javaslat fajtájához illő címkét kap, bizonyossággal', () => {
    render(<ConferenceThreadCard thread={THREAD_RETIRE} experts={MOCK_EXPERTS} crossTalkRan defaultOpen />)
    expect(screen.getByText('Nyugdíjazva · valószínű')).toBeInTheDocument()
  })
})
