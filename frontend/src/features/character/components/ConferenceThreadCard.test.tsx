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
    expect(screen.getByText(/1 elfogadva/)).toBeInTheDocument()
    expect(screen.getByText('Romlik az alvásod.')).toBeInTheDocument()
    expect(screen.queryByText('Kevés adat.')).not.toBeInTheDocument()
  })

  test('opening the thread reveals the chain: peer stance, skeptic, chair', async () => {
    render(<ConferenceThreadCard thread={THREAD} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText('Lehet stressz is.')).toBeInTheDocument()
    expect(screen.getByText(/Kevés adat\./)).toBeInTheDocument()
    // Item 0 is a ratified KILL rejection (no dissent, no note) — the chair added nothing beyond
    // the Szkeptikus's own verdict, so the card shows the honest short form instead of paraphrasing
    // the reason 'Nem engedem be.' (mezo-lghn).
    expect(screen.getByText(/nem teszek hozzá/)).toBeInTheDocument()
  })

  test('a WEAKEN verdikt saját címkét kap, a chair dissent és note megjelenik', async () => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [
        {
          ...THREAD.items[0],
          skeptic: { verdict: 'WEAKEN', argument: 'Kevés adat.', suggestedConfidence: 0.55 },
          chair: {
            accepted: true,
            confidence: 0.6,
            reason: 'A dosszié ezt erősíti.',
            dissent: true,
            note: 'CONTRADICTS',
          },
        },
      ],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText(/Gyengítette/)).toBeInTheDocument()
    expect(screen.getByText(/a Szkeptikus döntése ellenében/)).toBeInTheDocument()
    expect(screen.getByText(/ellentmond a dossziénak/)).toBeInTheDocument()
  })

  test('a dissent önmagában is felfedi a döntést, akkor is ha az erősség szava egyezik', async () => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [
        {
          ...THREAD.items[0],
          skeptic: { verdict: 'KEEP', argument: 'Elfogadható.', suggestedConfidence: 0.6 },
          chair: {
            accepted: true,
            confidence: 0.6,
            reason: 'Mégis ez az erősség indokolt.',
            dissent: true,
            note: null,
          },
        },
      ],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText(/a Szkeptikus döntése ellenében/)).toBeInTheDocument()
    expect(screen.queryByText(/nem teszek hozzá/)).not.toBeInTheDocument()
  })

  // mezo-lghn fix round 4, item 1 (MUST-FIX): an accept that OVERRULES an explicit KILL must
  // always be shown — even without a `dissent` flag AND with a `suggestedConfidence` on that KILL
  // landing in the SAME confidence-word tier as the chair's own number (both 0.6 → "valószínű"
  // here). Before the fix this exact combination fell through to the word-comparison arm, compared
  // equal, and rendered the honest-looking-but-false "nem teszek hozzá" short form while the claim
  // was written to the dossier regardless.
  test('egy KILL felülbírálása látszik dissent jelzés és eltérő erősség nélkül is', async () => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [
        {
          ...THREAD.items[0],
          skeptic: { verdict: 'KILL', argument: 'Túlinterpretálás.', suggestedConfidence: 0.6 },
          chair: {
            accepted: true,
            confidence: 0.6,
            reason: 'A dossziéban két korábbi mérés is ezt mutatja, amit a Szkeptikus nem látott.',
            dissent: false,
            note: null,
          },
        },
      ],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(
      screen.getByText(/A dossziéban két korábbi mérés is ezt mutatja, amit a Szkeptikus nem látott\./),
    ).toBeInTheDocument()
    expect(screen.queryByText(/nem teszek hozzá/)).not.toBeInTheDocument()
  })

  // mezo-lghn fix round 4, item 2: a KILL carries no suggested strength — a stray
  // `suggestedConfidence` on the Szkeptikus's KILL must never render as a confidence word on its
  // own step (mirrors the backend's `skepticLine`).
  test('a Kukázta lépés nem jelenít meg erősség-szót, ha a Szkeptikus javasolt egyet KILL mellé', async () => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [
        {
          ...THREAD.items[0],
          skeptic: { verdict: 'KILL', argument: 'Kevés adat.', suggestedConfidence: 0.8 },
          chair: { accepted: false, confidence: null, reason: 'Egyetértek.', dissent: false, note: null },
        },
      ],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText(/Kukázta/)).toBeInTheDocument()
    expect(screen.queryByText(/biztos/)).not.toBeInTheDocument()
  })

  // A fired sensitivity guardrail (KonziliumVerdictRound.lacksSensitiveClearance) drops an accept
  // to a rejection carrying a system-authored note — that ruling must stay visible even though it
  // ratifies the Szkeptikus's KILL and never sets `dissent` (mezo-lghn).
  test('egy kiváltott érzékenységi korlát megjelenik, dissent nélkül is', async () => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [
        {
          ...THREAD.items[0],
          skeptic: { verdict: 'KILL', argument: 'Kevés adat.' },
          chair: {
            accepted: false,
            confidence: null,
            reason: 'Érzékeny állítás, amit a Szkeptikus nem hagyott jóvá — a rendszer nem írja a dossziéba.',
            dissent: false,
            note: 'NOT_FOR_DOSSIER',
          },
        },
      ],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText(/nem dossziéba való/)).toBeInTheDocument()
    expect(screen.queryByText(/nem teszek hozzá/)).not.toBeInTheDocument()
  })

  // A rejection has nothing to ratify when the Szkeptikus gave NO answer at all — that is a real
  // disagreement, not a ratified KILL, and must be shown in full (mirrors the backend's
  // `addsSomething`: "a rejection over KEEP/WEAKEN or over no answer at all is always shown").
  test('egy elutasítás akkor is látszik, ha a Szkeptikus egyáltalán nem válaszolt', async () => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [
        {
          ...THREAD.items[0],
          skeptic: null,
          chair: {
            accepted: false,
            confidence: null,
            reason: 'A dosszié már tartalmaz ehhez hasonlót.',
            dissent: false,
            note: null,
          },
        },
      ],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText(/A dosszié már tartalmaz ehhez hasonlót\./)).toBeInTheDocument()
    expect(screen.queryByText(/nem teszek hozzá/)).not.toBeInTheDocument()
  })

  // An accepted ruling that carries no confidence at all (e.g. a DOWN/UP that steps the lifecycle's
  // own ±0.10 off the claim's current value, per KonziliumVerdictRound) is always shown — there is
  // no chair number to compare against the Szkeptikus's suggestion, so this can never collapse into
  // the ratification short form even if a suggestion happens to map to the same word as `null` would.
  test('egy elfogadás megjelenik, ha a chair egyáltalán nem adott erősséget', async () => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [
        {
          ...THREAD.items[0],
          skeptic: { verdict: 'KEEP', argument: 'Elfogadható.', suggestedConfidence: 0.3 },
          chair: { accepted: true, confidence: null, reason: 'A lépés a saját szabálya szerint mozdul.', dissent: false, note: null },
        },
      ],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText(/A lépés a saját szabálya szerint mozdul\./)).toBeInTheDocument()
    expect(screen.queryByText(/nem teszek hozzá/)).not.toBeInTheDocument()
  })

  // No suggestion to compare against is itself new information, even when the chair's own
  // confidence happens to land in the same WORD bucket a missing suggestion would coerce to.
  test('egy elfogadás megjelenik akkor is, ha a Szkeptikus nem javasolt erősséget', async () => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [
        {
          ...THREAD.items[0],
          skeptic: { verdict: 'KEEP', argument: 'Elfogadható.' },
          chair: { accepted: true, confidence: 0.3, reason: 'Csak enyhén emelem.', dissent: false, note: null },
        },
      ],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText(/Csak enyhén emelem\./)).toBeInTheDocument()
    expect(screen.queryByText(/nem teszek hozzá/)).not.toBeInTheDocument()
  })

  test('egy elfogadás megjelenik, ha a chair erősség-szava eltér a javasolttól', async () => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [
        {
          ...THREAD.items[0],
          skeptic: { verdict: 'KEEP', argument: 'Elfogadható.', suggestedConfidence: 0.3 },
          chair: { accepted: true, confidence: 0.8, reason: 'Erősebbnek látom, mint a Szkeptikus.', dissent: false, note: null },
        },
      ],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText(/Erősebbnek látom, mint a Szkeptikus\./)).toBeInTheDocument()
    expect(screen.queryByText(/nem teszek hozzá/)).not.toBeInTheDocument()
  })

  test('egy elfogadás elrejtőzik a rövid forma mögé, ha a chair pontosan a javasolt erősséget hagyja jóvá', async () => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [
        {
          ...THREAD.items[0],
          skeptic: { verdict: 'KEEP', argument: 'Elfogadható.', suggestedConfidence: 0.6 },
          chair: { accepted: true, confidence: 0.65, reason: 'Ezt a szintet hagyom jóvá.', dissent: false, note: null },
        },
      ],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText(/nem teszek hozzá/)).toBeInTheDocument()
    expect(screen.queryByText(/Ezt a szintet hagyom jóvá\./)).not.toBeInTheDocument()
  })

  test('a puszta ratifikáció nem parafrazál, hanem kimondja hogy nincs hozzátenni való', async () => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [
        {
          ...THREAD.items[0],
          skeptic: { verdict: 'KILL', argument: 'Két megfigyelés egy napról.' },
          chair: { accepted: false, confidence: null, reason: 'Egyetértek.', dissent: false, note: null },
        },
      ],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText(/nem teszek hozzá/)).toBeInTheDocument()
  })

  test('confidence is shown as a word, never as a number', async () => {
    render(<ConferenceThreadCard thread={THREAD} experts={MOCK_EXPERTS} />)

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
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} />)

    expect(screen.getByText(label)).toBeInTheDocument()
  })

  test('an accepted item with an unknown kind falls back to the neutral "Elfogadva"', () => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [{ ...THREAD.items[1], kind: null }],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} />)

    expect(screen.getByText('Elfogadva')).toBeInTheDocument()
  })

  test('a rejected item is labelled "Elvetve"', () => {
    const thread: ConferenceThread = { ...THREAD, items: [THREAD.items[0]] }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} />)

    expect(screen.getByText('Elvetve')).toBeInTheDocument()
  })

  test('an item the chair never ruled on says "Nincs döntés" — and is not styled as rejected', () => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [{ ...THREAD.items[0], chair: null }],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} />)

    const badge = screen.getByText('Nincs döntés')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('non')
    expect(badge.className).not.toContain('rej')
  })

  test('the header tally counts what it says it counts: accepted items', () => {
    const thread: ConferenceThread = {
      ...THREAD,
      items: [THREAD.items[0], { ...THREAD.items[1], kind: 'RETIRE' }],
    }
    render(<ConferenceThreadCard thread={thread} experts={MOCK_EXPERTS} />)

    // one accepted RETIRE: it is "elfogadva", and nothing "maradt meg"
    expect(screen.getByText('2 állítás · 1 elfogadva')).toBeInTheDocument()
    expect(screen.queryByText(/maradt meg/)).not.toBeInTheDocument()
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
