import { offsetIso } from '@/shared/lib/dates'
import type { TeamChatDay, TeamChatLine } from '@/data/character/teamChatApi'
import { buildTeamChatDay } from '@/data/character/teamChatMock'
import { chips, clockOf, groupByDayPart, stripText, unreadCount } from './teamChat'

const DATE = '2026-09-28'

function line(id: string, time: string, over: Partial<TeamChatLine> = {}): TeamChatLine {
  return {
    id, threadId: 't1', kind: 'GUEST', character: 'szunya', body: `mondat ${id}`,
    voiced: true, facts: [], occurredAt: offsetIso(DATE, time), ...over,
  }
}

function day(lines: TeamChatLine[], over: Partial<TeamChatDay> = {}): TeamChatDay {
  return { date: DATE, lines, openThreads: [], pushesToday: 0, pushBudget: 2, ...over }
}

describe('groupByDayPart', () => {
  test('a határok: 05 reggel, 11 délben, 14 délután, 18 este, 22 éjjel', () => {
    const groups = groupByDayPart([
      line('a', '04:59'), line('b', '05:00'), line('c', '10:59'), line('d', '11:00'), line('e', '13:59'),
      line('f', '14:00'), line('g', '17:59'), line('h', '18:00'), line('i', '21:59'), line('j', '22:00'),
    ])
    expect(groups.map(g => [g.part, g.lines.map(l => l.id).join('')])).toEqual([
      ['ÉJJEL', 'a'], ['REGGEL', 'bc'], ['DÉLBEN', 'de'], ['DÉLUTÁN', 'fg'], ['ESTE', 'hi'], ['ÉJJEL', 'j'],
    ])
  })

  test('időrendbe teszi a sorokat, és üres napra üres listát ad', () => {
    expect(groupByDayPart([line('late', '12:30'), line('early', '07:10')]).map(g => g.lines[0].id)).toEqual(['early', 'late'])
    expect(groupByDayPart([])).toEqual([])
  })

  test('a mintanap: reggel · délben · délután', () => {
    expect(groupByDayPart(buildTeamChatDay(DATE).lines).map(g => g.part)).toEqual(['REGGEL', 'DÉLBEN', 'DÉLUTÁN'])
  })
})

describe('stripText', () => {
  test('a legutóbbi KARAKTER-sor — a te soraid nem számítanak', () => {
    const d = day([
      line('a', '07:40', { character: 'szunya', body: 'reggeli' }),
      line('b', '13:05', { character: 'falat', body: 'déli' }),
      line('c', '15:00', { kind: 'USER', character: null, body: 'én' }),
    ])
    expect(stripText(d)).toEqual({ speaker: 'falat', text: 'déli' })
  })

  test('nincs karakter-sor → null', () => {
    expect(stripText(day([]))).toBeNull()
    expect(stripText(day([line('u', '09:00', { kind: 'USER', character: null })])) ).toBeNull()
  })
})

describe('unreadCount', () => {
  const d = day([
    line('a', '07:40'), line('b', '12:05'),
    line('u', '12:40', { kind: 'USER', character: null }), line('c', '16:20'),
  ])
  test('a lastSeen utáni karakter-sorok', () => {
    expect(unreadCount(d, offsetIso(DATE, '12:00'))).toBe(2)
    expect(unreadCount(d, offsetIso(DATE, '17:00'))).toBe(0)
  })
  test('lastSeen nélkül minden karakter-sor olvasatlan', () => {
    expect(unreadCount(d, null)).toBe(3)
  })
})

describe('chips', () => {
  test('a mintanap: 2 nyitott, 1 rendeződött, 2 / 2 értesítés', () => {
    expect(chips(buildTeamChatDay(DATE))).toEqual({ open: 2, resolved: 1, pushes: '2 / 2' })
  })
  test('üres nap', () => {
    expect(chips(day([], { pushBudget: 2 }))).toEqual({ open: 0, resolved: 0, pushes: '0 / 2' })
  })
})

test('clockOf: a sor helyi óra:perce', () => {
  expect(clockOf(offsetIso(DATE, '07:05'))).toBe('07:05')
})
