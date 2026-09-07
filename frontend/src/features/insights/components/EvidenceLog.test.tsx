import { render, screen } from '@testing-library/react'
import { EvidenceLog } from '@/features/insights/components/EvidenceLog'
import type { PatternEvent } from '@/data/types'

const events: PatternEvent[] = [
  { kind: 'observation', occurredAt: '2026-09-06T12:12:00Z', text: 'Négy Annás nap után átlag 40 perc többlet-alvás.' },
  { kind: 'user_reply', occurredAt: '2026-09-06T12:15:00Z', choice: 'watch', text: 'Igen, figyeld — de nem Anna miatt.' },
  { kind: 'revised', occurredAt: '2026-09-07T01:40:00Z', text: 'Új mellék-hipotézis nyílt: szabadnap → több alvás.' },
  { kind: 'evidence', occurredAt: '2026-09-08T01:40:00Z', hit: true, n: 5, verdict: 'FEW_DAYS' },
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

test.each([
  ['a hit', { hit: true, n: 5 }, 'Bejött · 5 nap'],
  ['a miss', { hit: false, n: 6 }, 'Nem jött be · 6 nap'],
  ['a thin gate', { verdict: 'FEW_DAYS' }, 'Kevés nap'],
  ['no data at all', { verdict: 'NO_DATA' }, 'Nincs adat'],
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
  expect(screen.getByText('Újra előjött ugyanabban az irányban (×3).')).toBeInTheDocument()
  expect(screen.getByText('Bekerült a tudástárba.')).toBeInTheDocument()
  expect(screen.getByText('Újraszámolva — 21 közös nap.')).toBeInTheDocument()
})

test('an empty log says so instead of rendering an empty rail', () => {
  const { container } = render(<EvidenceLog events={[]} />)
  expect(container.querySelector('.pdt-timeline')).toBeNull()
  expect(screen.getByText('Még nincs bejegyzés — az első bizonyíték-éjszaka tölti fel.')).toBeInTheDocument()
})

describe('a timestamp is LOCAL time, never the raw UTC hour', () => {
  const originalTz = process.env.TZ
  beforeAll(() => { process.env.TZ = 'Europe/Budapest' })
  afterAll(() => { process.env.TZ = originalTz })

  test('the stamp is the Hungarian short date and the local clock', () => {
    const { container } = render(<EvidenceLog events={[events[0]]} />)
    expect(container.querySelector('.pdt-event time')?.textContent).toContain('Szept. 6. · 14:12')
  })
})
