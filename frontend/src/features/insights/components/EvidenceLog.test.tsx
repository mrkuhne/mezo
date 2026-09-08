import { render, screen } from '@testing-library/react'
import { EvidenceLog } from '@/features/insights/components/EvidenceLog'
import type { PatternEvent } from '@/data/types'

const events: PatternEvent[] = [
  { kind: 'observation', occurredAt: '2026-09-06T12:12:00Z', text: 'Négy Annás nap után átlag 40 perc többlet-alvás.' },
  { kind: 'user_reply', occurredAt: '2026-09-06T12:15:00Z', choice: 'watch', text: 'Igen, figyeld — de nem Anna miatt.' },
  { kind: 'revised', occurredAt: '2026-09-07T01:40:00Z', text: 'Új mellék-hipotézis nyílt: szabadnap → több alvás.' },
  { kind: 'evidence', occurredAt: '2026-09-08T01:40:00Z', hit: true, n: 5, verdict: 'LIVE' },
]

test('the timeline renders one row per event, oldest first, with the kind labels', () => {
  const { container } = render(<EvidenceLog events={events} />)
  const rows = container.querySelectorAll('.pdt-event')
  expect(rows).toHaveLength(4)
  expect([...rows].map((row) => row.querySelector('em')?.textContent))
    .toEqual(['észrevétel', 'te', 'átfogalmazva', 'bizonyíték'])
})

test('the reply is the user\'s own quoted voice', () => {
  const { container } = render(<EvidenceLog events={events} />)
  const reply = container.querySelectorAll('.pdt-event')[1]
  expect(reply).toHaveClass('pdt-event-you')
  expect(reply.querySelector('p')?.textContent).toBe('„Igen, figyeld — de nem Anna miatt.”')
})

// A kapu MINDEN éjszaka ír egy bizonyíték-sort, és a verdikt bármelyik lehet a
// `PatternGate.Verdict` ötösből — mind az öt kap saját, őszinte magyar mondatot (mezo-eq85.6).
test.each([
  ['a hit', { hit: true, n: 5 }, 'Bejött · 5 nap'],
  ['a miss', { hit: false, n: 6 }, 'Nem jött be · 6 nap'],
  ['a thin gate', { verdict: 'FEW_DAYS' }, 'Kevés nap'],
  ['a thin group split', { verdict: 'IMBALANCED_GROUPS' }, 'Még vékony csoport'],
  ['a series that never moved', { verdict: 'DEGENERATE' }, 'Nem mozdult'],
  ['no data at all', { verdict: 'NO_DATA' }, 'Nincs adat'],
  ['an unknown verdict', { verdict: 'SOMETHING_NEW' }, 'Nincs adat'],
])('an evidence night reads as %s', (_name, patch, text) => {
  render(<EvidenceLog events={[{ kind: 'evidence', occurredAt: '2026-09-08T01:40:00Z', ...patch }]} />)
  expect(screen.getByText(text)).toBeInTheDocument()
})

test('the decision and engine events keep the journal copy', () => {
  render(<EvidenceLog events={[
    { kind: 'monitoring', occurredAt: '2026-09-01T08:00:00Z' },
    { kind: 'confirmed', occurredAt: '2026-09-02T08:00:00Z' },
    { kind: 'rejected', occurredAt: '2026-09-03T08:00:00Z' },
    { kind: 'refuted', occurredAt: '2026-09-04T08:00:00Z' },
    { kind: 'dormant', occurredAt: '2026-09-05T08:00:00Z' },
    { kind: 'reinforced', occurredAt: '2026-09-06T08:00:00Z', reinforcementCount: 3 },
    { kind: 'promoted', occurredAt: '2026-09-07T08:00:00Z' },
    { kind: 'snapshot', occurredAt: '2026-09-08T08:00:00Z', n: 21 },
  ]} />)
  expect(screen.getByText('Megfigyelésre tetted.')).toBeInTheDocument()
  expect(screen.getByText('Megerősítetted.')).toBeInTheDocument()
  expect(screen.getByText('Elvetetted — befagyasztva.')).toBeInTheDocument()
  expect(screen.getByText('Megnéztük — nem igazolódott.')).toBeInTheDocument()
  expect(screen.getByText('Pihen — várom az adatot.')).toBeInTheDocument()
  expect(screen.getByText('Újra előjött ugyanabban az irányban — a tudás megerősödött (×3).')).toBeInTheDocument()
  expect(screen.getByText('Bekerült a tudástárba.')).toBeInTheDocument()
  expect(screen.getByText('Először számolhatóvá vált — 21 közös nap.')).toBeInTheDocument()
  // a `confirmed` sor a naplóból hozza a félkövérét is
  expect(screen.getByText('Megerősítetted.').tagName).toBe('STRONG')
})

// A napi kapu-futás minden hipotézisre ír egy sort: egy hónap után a laborfüzet 30 „Kevés nap"
// alá temetné az észrevételt, a te válaszodat és az átfogalmazást. A ház szabálya
// (`patternHistory.journalEntries`): minden ember-jelentőségű esemény marad, a zajt összevonjuk.
describe('the log stays readable when the nightly job keeps writing', () => {
  const nights = (count: number, verdict: string, from = 10): PatternEvent[] =>
    Array.from({ length: count }, (_, i) => ({
      kind: 'evidence' as const, occurredAt: `2026-09-${String(from + i).padStart(2, '0')}T01:40:00Z`, verdict,
    }))

  test('a run of identical silent nights collapses into one row that names the nights', () => {
    const { container } = render(<EvidenceLog events={[
      { kind: 'observation', occurredAt: '2026-09-06T12:12:00Z', text: 'Feltűnt valami.' },
      ...nights(12, 'FEW_DAYS'),
    ]} />)
    expect(container.querySelectorAll('.pdt-event')).toHaveLength(2)
    expect(screen.getByText('Kevés nap · 12 éjszaka')).toBeInTheDocument()
  })

  test('a live night, a different verdict and every user-meaningful event survive the collapse', () => {
    const { container } = render(<EvidenceLog events={[
      ...nights(3, 'FEW_DAYS', 10),
      { kind: 'evidence', occurredAt: '2026-09-13T01:40:00Z', hit: true, n: 8, verdict: 'LIVE' },
      ...nights(2, 'FEW_DAYS', 14),
      ...nights(2, 'NO_DATA', 16),
      { kind: 'user_reply', occurredAt: '2026-09-18T09:00:00Z', text: 'Ez tetszik.' },
      { kind: 'evidence', occurredAt: '2026-09-19T01:40:00Z', hit: false, n: 9, verdict: 'LIVE' },
    ]} />)
    expect([...container.querySelectorAll('.pdt-event p')].map((p) => p.textContent)).toEqual([
      'Kevés nap · 3 éjszaka',
      'Bejött · 8 nap',
      'Kevés nap · 2 éjszaka',
      'Nincs adat · 2 éjszaka',
      '„Ez tetszik.”',
      'Nem jött be · 9 nap',
    ])
  })

  test('only the FIRST snapshot gets a line — the rest is the same recomputation', () => {
    const { container } = render(<EvidenceLog events={[
      { kind: 'snapshot', occurredAt: '2026-09-01T02:40:00Z', n: 12 },
      { kind: 'snapshot', occurredAt: '2026-09-02T02:40:00Z', n: 13 },
      { kind: 'snapshot', occurredAt: '2026-09-03T02:40:00Z', n: 14 },
    ]} />)
    expect(container.querySelectorAll('.pdt-event')).toHaveLength(1)
    expect(screen.getByText('Először számolhatóvá vált — 12 közös nap.')).toBeInTheDocument()
  })
})

test('an empty log says so instead of rendering an empty rail', () => {
  const { container } = render(<EvidenceLog events={[]} />)
  expect(container.querySelector('.pdt-timeline')).toBeNull()
  expect(screen.getByText('Még nincs bejegyzés — az első bizonyíték-éjszaka tölti fel.')).toBeInTheDocument()
})

describe('a timestamp is LOCAL time, never the raw UTC hour', () => {
  // `vi.stubEnv` restores an UNSET variable to unset; a plain reassign wrote the literal string
  // "undefined" into TZ of the reused worker process (CI runs UTC with no TZ), hour-shifting
  // unrelated date assertions that ran after this file (mezo-eq85.6 review).
  beforeAll(() => { vi.stubEnv('TZ', 'Europe/Budapest') })
  afterAll(() => { vi.unstubAllEnvs() })

  test('the stamp is the Hungarian short date and the local clock', () => {
    const { container } = render(<EvidenceLog events={[events[0]]} />)
    expect(container.querySelector('.pdt-event time')?.textContent).toContain('Szept. 6. · 14:12')
  })
})
