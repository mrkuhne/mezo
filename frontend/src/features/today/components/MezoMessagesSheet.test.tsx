import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { MezoMessagesSheet } from '@/features/today/components/MezoMessagesSheet'
import type { MezoMessageItem } from '@/features/today/logic/mezoMessages'
import type { ArtifactFeedback, FeedbackHandle } from '@/data/feedback/feedbackTypes'

const briefing: MezoMessageItem = {
  id: 'briefing', eyebrow: 'Reggeli briefing', time: '06:30',
  paragraphs: ['Jó reggelt.', 'Ma Pull Day.'],
  refs: [{ kind: 'workout', label: 'Push Day · tegnap' }],
  meta: 'Demo tartalom',
}
const note: MezoMessageItem = {
  id: 'note', eyebrow: 'Napközi jegyzet', time: '12:30',
  paragraphs: ['Fehérjéből 100 g van meg.'], refs: [], meta: null,
}

// ── mezo-b3pp.15 · visszajelzés-chipek ────────────────────────────────────────
const FEEDBACK_GROUP = 'Visszajelzés az üzenetről'

/** A feed-sor: perzisztált companion_message, tehát VAN artifactId-je. */
const feedMsg: MezoMessageItem = {
  id: 'midday', artifactId: 'fm-1', eyebrow: 'Déli jegyzet', time: '12:00',
  paragraphs: ['Fehérjéből 100 g van meg.'], refs: [], meta: null,
}
const feedMsg2: MezoMessageItem = { ...feedMsg, id: 'evening', artifactId: 'fm-2', eyebrow: 'Esti jegyzet' }

// W5.2 (mezo-b3pp.19) — a „Segített?" kártya-változat: intervention kindű feed-sor.
const interventionMsg: MezoMessageItem = {
  id: 'intervention', artifactId: 'fm-3', kind: 'intervention', eyebrow: 'Mezo · észrevétel', time: '15:00',
  paragraphs: ['Két napja alszol keveset — ma korábban lefeküdhetnél.'], refs: [], meta: null,
}

const stored = (over: Partial<ArtifactFeedback> = {}): ArtifactFeedback => ({
  artifactKind: 'feed_message', artifactId: 'fm-1', verdict: 'up', reason: null,
  updatedAt: '2026-08-21T12:00:00Z', ...over,
})

const handle = (over: Partial<FeedbackHandle> = {}): FeedbackHandle => ({
  get: () => undefined, vote: vi.fn(), pending: false, ...over,
})

describe('MezoMessagesSheet — visszajelzés-chipek (mezo-b3pp.15)', () => {
  test('perzisztált feed-üzenetre kiül a chipsor, és a 👍 az artifactId-vel votol', async () => {
    const vote = vi.fn()
    render(<MezoMessagesSheet messages={[feedMsg]} onClose={() => {}} feedback={handle({ vote })} />)
    expect(screen.getByRole('group', { name: FEEDBACK_GROUP })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Segített/ }))
    expect(vote).toHaveBeenCalledWith('fm-1', 'up', undefined)
  })

  test('a chip a handle tárolt verdictjét mutatja, artifactId szerint', () => {
    render(
      <MezoMessagesSheet
        messages={[feedMsg, feedMsg2]}
        onClose={() => {}}
        feedback={handle({ get: (id) => (id === 'fm-1' ? stored() : undefined) })}
      />,
    )
    const ups = screen.getAllByRole('button', { name: /Segített/ })
    expect(ups[0]).toHaveAttribute('aria-pressed', 'true')
    expect(ups[1]).toHaveAttribute('aria-pressed', 'false')
  })

  test('artifactId NÉLKÜLI elemre (demo-kártya, nudge) NEM ül ki chip — nincs hamis affordancia (mezo-kr9v)', () => {
    render(<MezoMessagesSheet messages={[briefing, note]} onClose={() => {}} feedback={handle()} />)
    expect(screen.queryByRole('group', { name: FEEDBACK_GROUP })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Segített/ })).not.toBeInTheDocument()
  })

  test('feedback prop nélkül nincs chip, még perzisztált üzeneten sem', () => {
    render(<MezoMessagesSheet messages={[feedMsg]} onClose={() => {}} />)
    expect(screen.queryByRole('group', { name: FEEDBACK_GROUP })).not.toBeInTheDocument()
  })

  test('vegyes szálban pontosan a perzisztált elemek kapnak chipsort', () => {
    render(
      <MezoMessagesSheet messages={[briefing, feedMsg, feedMsg2]} onClose={() => {}} feedback={handle()} />,
    )
    expect(screen.getAllByRole('group', { name: FEEDBACK_GROUP })).toHaveLength(2)
  })

  test('az indok-sor per üzenet nyílik — minden bubble saját FeedbackChips példány (artifactId a key)', async () => {
    render(
      <MezoMessagesSheet messages={[feedMsg, feedMsg2]} onClose={() => {}} feedback={handle()} />,
    )
    await userEvent.click(screen.getAllByRole('button', { name: /Nem talált/ })[0])
    expect(screen.getAllByRole('button', { name: 'pontatlan' })).toHaveLength(1)
  })

  // W5.2 (mezo-b3pp.19) — a „Segített?" kártya-változat intervention kindre.
  test('intervention kártyán megjelenik a „Segített?" felirat és a chipsor, a közbelépésről szóló felirattal', () => {
    render(<MezoMessagesSheet messages={[interventionMsg]} onClose={() => {}} feedback={handle()} />)
    expect(screen.getByText('Segített?')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Visszajelzés a közbelépésről' })).toBeInTheDocument()
  })

  test('nem-intervention (pl. morning) feed-elemen NEM jelenik meg a „Segített?" felirat', () => {
    render(<MezoMessagesSheet messages={[feedMsg]} onClose={() => {}} feedback={handle()} />)
    expect(screen.queryByText('Segített?')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: FEEDBACK_GROUP })).toBeInTheDocument()
  })
})

describe('MezoMessagesSheet', () => {
  test('párbeszédként nyílik, magyar címmel', () => {
    render(<MezoMessagesSheet messages={[briefing]} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Mezo üzenetei')).toBeInTheDocument()
  })

  test('a briefing MINDEN bekezdése látszik — sehol nincs csonkolás', () => {
    render(<MezoMessagesSheet messages={[briefing]} onClose={() => {}} />)
    expect(screen.getByText('Jó reggelt.')).toBeInTheDocument()
    expect(screen.getByText('Ma Pull Day.')).toBeInTheDocument()
    expect(screen.queryByText(/bővebben/i)).not.toBeInTheDocument()
  })

  test('a hivatkozás-chipek és az őszinte meta-címke megjelennek', () => {
    render(<MezoMessagesSheet messages={[briefing]} onClose={() => {}} />)
    expect(screen.getByText(/Push Day · tegnap/)).toBeInTheDocument()
    expect(screen.getByText('Demo tartalom')).toBeInTheDocument()
  })

  test('minden üzenet a saját eyebrow-jával és idejével áll, kronologikusan', () => {
    render(<MezoMessagesSheet messages={[briefing, note]} onClose={() => {}} />)
    // A Sheet portálba (document.body) renderel, nem a render() konténerébe.
    const bubbles = [...document.body.querySelectorAll('.td-msg')]
    expect(bubbles).toHaveLength(2)
    expect(within(bubbles[0] as HTMLElement).getByText('Reggeli briefing')).toBeInTheDocument()
    expect(within(bubbles[0] as HTMLElement).getByText('06:30')).toBeInTheDocument()
    expect(within(bubbles[1] as HTMLElement).getByText('Napközi jegyzet')).toBeInTheDocument()
  })

  test('a Kész gomb zárja a sheetet', async () => {
    const onClose = vi.fn()
    render(<MezoMessagesSheet messages={[briefing]} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Kész' }))
    // A Sheet animálva zár; jsdom-ban `transitionend` sosem jön, tehát a `Sheet.tsx`
    // EXIT_MS + 80 = 380 ms-os fallback időzítője hívja az onClose-t. Az 1000 ms-os budget
    // erre alig 2,6× tartalék — teljes-suite CPU-torlódás alatt (a nehéz fájlok 3× annyi
    // ideig futnak) kifutott. 3000 ms ~8× tartalék, és a 20 s-os config-plafon (vite.config.ts)
    // alatt marad; zöld futáson semmibe nem kerül, mert a wait a feltétel teljesülésekor
    // azonnal visszatér. mezo-418z
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 3000 })
  })

  test('idő nélküli üzenet nem hagy üres időbélyeget', () => {
    render(
      <MezoMessagesSheet messages={[{ ...note, time: null }]} onClose={() => {}} />,
    )
    // A Sheet portálba (document.body) renderel, nem a render() konténerébe.
    expect(document.body.querySelector('.td-bub-t')).toBeNull()
  })
})
