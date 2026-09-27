import { offsetIso } from '@/shared/lib/dates'
import type { TeamChatDay, TeamChatLine, TeamChatThread } from '@/data/character/teamChatApi'
import { buildTeamChatDay } from '@/data/character/teamChatMock'
import { chips, clockOf, groupByDayPart, stripText, talkedFlagKeys, unreadCount } from './teamChat'

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
  test('a mintanap: 3 nyitott, 1 rendeződött, 2 / 2 értesítés', () => {
    expect(chips(buildTeamChatDay(DATE))).toEqual({ open: 3, resolved: 1, pushes: '2 / 2' })
  })
  test('üres nap', () => {
    expect(chips(day([], { pushBudget: 2 }))).toEqual({ open: 0, resolved: 0, pushes: '0 / 2' })
  })

  const thread = (id: string, over: Partial<TeamChatThread> = {}): TeamChatThread => ({
    id, flagKey: 'late_eating', ruleLabel: 'Késői étkezés', owner: 'falat', guest: null,
    status: 'RESOLVED', openedAt: offsetIso(DATE, '17:50'), closedAt: offsetIso(DATE, '21:52'),
    pushed: false, actions: [], applied: null, closeReason: 'REPLY', closeNote: 'meccsnap',
    offer: null, offerTag: null, remembered: null, ...over,
  })

  test('S7: a válasszal (REPLY) és kivétellel (EXCUSED) lezárt ügy is rendeződött — RESOLVE sor nélkül is', () => {
    const replyClosed = thread('t-reply')
    const excused = thread('t-excused', { closeReason: 'EXCUSED' })
    const lines = [
      line('o1', '17:50', { threadId: 't-reply', kind: 'OPEN', character: 'falat', thread: replyClosed }),
      line('r1', '21:52', { threadId: 't-reply', kind: 'REPLY', character: 'falat', thread: replyClosed }),
      line('o2', '18:00', { threadId: 't-excused', kind: 'OPEN', character: 'falat', thread: excused }),
      line('r2', '18:05', { threadId: 't-excused', kind: 'REPLY', character: 'falat', thread: excused }),
    ]
    expect(chips(day(lines)).resolved).toBe(2)
  })

  test('S7: egy adat-zárta ügy OPEN + RESOLVE sorral egyszer számít; a máskor zárult és a nyitott nem', () => {
    const data = thread('t-data', { closeReason: 'DATA', closeNote: null })
    const earlier = thread('t-old', { closedAt: offsetIso('2026-09-27', '21:00') })
    const open = thread('t-open', { status: 'OPEN', closedAt: null, closeReason: null, closeNote: null })
    const lines = [
      line('o1', '08:00', { threadId: 't-data', kind: 'OPEN', character: 'falat', thread: data }),
      line('x1', '12:00', { threadId: 't-data', kind: 'RESOLVE', character: 'falat', thread: data }),
      line('r2', '09:00', { threadId: 't-old', kind: 'REPLY', character: 'falat', thread: earlier }),
      line('o3', '10:00', { threadId: 't-open', kind: 'OPEN', character: 'falat', thread: open }),
    ]
    expect(chips(day(lines)).resolved).toBe(1)
  })
})

test('clockOf: a sor helyi óra:perce', () => {
  expect(clockOf(offsetIso(DATE, '07:05'))).toBe('07:05')
})

describe('talkedFlagKeys', () => {
  const thread = (id: string, flagKey: string) => ({
    id, flagKey, ruleLabel: flagKey, owner: 'szunya' as const, guest: null, status: 'OPEN' as const,
    openedAt: offsetIso(DATE, '07:00'), closedAt: null, pushed: false, actions: [], applied: null,
  })

  test('a nyitott ügyek és a mai sorok ügyeinek szabálykulcsai; ügy nélküli sor nem ad kulcsot', () => {
    const keys = talkedFlagKeys(day(
      [line('a', '12:00', { thread: { ...thread('t2', 'late_eating'), status: 'RESOLVED' } }),
        line('b', '12:10', { threadId: null })],
      { openThreads: [thread('t1', 'sleep_debt')] },
    ))
    expect([...keys].sort()).toEqual(['late_eating', 'sleep_debt'])
  })

  test('üres napra üres halmaz', () => {
    expect(talkedFlagKeys(day([])).size).toBe(0)
  })
})
