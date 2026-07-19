import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { GrowthJournalCard } from '@/features/me/components/GrowthJournalCard'
import type { JournalDay } from '@/features/me/logic/growthJournal'
import type { ActivityEntry, DailyQuest } from '@/data/types'

const quest = (o: Partial<DailyQuest>): DailyQuest => ({
  id: 'q1', questDate: '2026-07-11', slot: 'BODY', skillKey: 'strength_endurance',
  title: 'Csináld végig a mai edzést', why: '', targetLabel: '', metric: 'gym_session_done', xp: 25,
  status: 'completed', completionMode: 'DERIVED', ...o,
})
const activity = (o: Partial<ActivityEntry>): ActivityEntry => ({
  id: 'a1', occurredOn: '2026-07-11', text: 'Olvastam 30 percet', skillKey: 'learning',
  confidence: 0.9, xpAwarded: 18, categorizedBy: 'AI', ...o,
})

const day = (o: Partial<JournalDay> & { entries: JournalDay['entries'] }): JournalDay => ({
  date: '2026-07-11', label: 'Tegnap', xpTotal: 0, ...o,
})

test('renders the summary chip, day labels and entry texts', () => {
  const days: JournalDay[] = [
    day({
      date: '2026-07-11', label: 'Tegnap', xpTotal: 43,
      entries: [
        { kind: 'quest', quest: quest({ id: 'q-a', title: 'Reggeli súlymérés', xp: 25 }) },
        { kind: 'activity', activity: activity({ id: 'a-a', text: 'Olvastam a Psychology of Money-ból', xpAwarded: 18 }) },
      ],
    }),
    day({
      date: '2026-07-10', label: 'Júl 10', xpTotal: 10,
      entries: [{ kind: 'activity', activity: activity({ id: 'a-b', occurredOn: '2026-07-10', text: 'Rendet raktam a garázsban', skillKey: 'productivity', xpAwarded: 10 }) }],
    }),
  ]
  render(<GrowthJournalCard days={days} summary="1 ✓ · 0 — · 2 ✎" />)
  expect(screen.getByText('1 ✓ · 0 — · 2 ✎')).toBeInTheDocument()
  expect(screen.getByText('Tegnap')).toBeInTheDocument()
  expect(screen.getByText('Júl 10')).toBeInTheDocument()
  expect(screen.getByText('Reggeli súlymérés')).toBeInTheDocument()
  expect(screen.getByText('Olvastam a Psychology of Money-ból')).toBeInTheDocument()
  expect(screen.getByText('Rendet raktam a garázsban')).toBeInTheDocument()
  expect(screen.getByText('+43 XP')).toBeInTheDocument()
})

test('expired quest shows "csendben lejárt" and 0 XP', () => {
  const days: JournalDay[] = [
    day({ entries: [{ kind: 'quest', quest: quest({ status: 'expired', completionMode: 'ACTIVITY', slot: 'GROWTH', xp: 20, title: 'Elmaradt meditáció' }) }] }),
  ]
  render(<GrowthJournalCard days={days} summary="0 ✓ · 1 — · 0 ✎" />)
  expect(screen.getByText(/csendben lejárt/)).toBeInTheDocument()
  expect(screen.getByText('0')).toBeInTheDocument()
})

test('activity-completed quest shows "tevékenységgel teljesült"', () => {
  const days: JournalDay[] = [
    day({ xpTotal: 20, entries: [{ kind: 'quest', quest: quest({ status: 'completed', completionMode: 'ACTIVITY', slot: 'GROWTH', xp: 20, title: '10 perc meditáció' }) }] }),
  ]
  render(<GrowthJournalCard days={days} summary="1 ✓ · 0 — · 0 ✎" />)
  expect(screen.getByText(/tevékenységgel teljesült/)).toBeInTheDocument()
  expect(screen.getByText('+20')).toBeInTheDocument()
})

test('financial activity renders the "50 000 Ft" sublabel', () => {
  const days: JournalDay[] = [
    day({ xpTotal: 15, entries: [{ kind: 'activity', activity: activity({ id: 'a-fin', text: 'Átraktam megtakarításba', skillKey: 'financial', xpAwarded: 15, amountHuf: 50000 }) }] }),
  ]
  render(<GrowthJournalCard days={days} summary="0 ✓ · 0 — · 1 ✎" />)
  expect(screen.getByText(/50 000 Ft/)).toBeInTheDocument()
})

test('empty days render the empty-state copy', () => {
  render(<GrowthJournalCard days={[]} summary="0 ✓ · 0 — · 0 ✎" />)
  expect(screen.getByText(/Még nincs bejegyzés/)).toBeInTheDocument()
})
