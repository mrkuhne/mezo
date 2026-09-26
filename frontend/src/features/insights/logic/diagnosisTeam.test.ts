import type { Diagnosis, DiagnosisSuspect } from '@/data/types'
import { hostOf, LIVE_QUESTIONS, UPCOMING_QUESTIONS } from '@/features/insights/logic/diagnosisCatalog'
import {
  DAILY_QUOTA, guestsOf, helpersLine, newestFirst, quotaLeft, suspectOwner,
} from '@/features/insights/logic/diagnosisTeam'

const suspect = (rank: number, domain?: DiagnosisSuspect['domain']): DiagnosisSuspect => ({
  rank, title: `s${rank}`, claim: '', evidenceIndexes: [0], strength: 'moderate', probeText: '',
  metricKey: 'X', expectedDirection: 'up', totalDays: 7, domain,
})

const diag = (over: Partial<Diagnosis>): Diagnosis => ({
  id: 'd', phenomenon: 'fatigue', windowDays: 14, verdict: 'v', confidence: 'moderate',
  evidence: [], suspects: [], generatedAt: '2026-09-26T08:00:00Z', stale: false, ...over,
})

describe('diagnosis catalog hosts (mezo-u3712)', () => {
  test('every question has its owner-decided host; fatigue is Mezo', () => {
    expect(LIVE_QUESTIONS.map((q) => [q.phenomenon, q.host])).toEqual([
      ['fatigue', 'mezo'], ['sleep', 'szunya'], ['weight', 'deru'],
    ])
    expect(UPCOMING_QUESTIONS.map((q) => q.host)).toEqual(['mocor', 'mezo'])
    expect(hostOf('unknown')).toBe('mezo')
  })
})

describe('diagnosisTeam', () => {
  test('a suspect is owned by its metric domain character; no domain → Mezo', () => {
    expect(suspectOwner(suspect(1, 'sleep'))).toBe('szunya')
    expect(suspectOwner(suspect(1, 'train'))).toBe('mocor')
    expect(suspectOwner(suspect(1))).toBe('mezo')
  })

  test('guests are the distinct suspect owners other than the host, in rank order', () => {
    const d = diag({ suspects: [suspect(1, 'sleep'), suspect(2, 'train'), suspect(3, 'sleep'), suspect(4, 'other')] })
    expect(guestsOf(d)).toEqual(['szunya', 'mocor'])
    expect(guestsOf(diag({ phenomenon: 'sleep', suspects: [suspect(1, 'sleep')] }))).toEqual([])
  })

  test('the helpers line names the host and joins guests the Hungarian way', () => {
    expect(helpersLine('mezo', ['szunya', 'mocor'])).toBe('Mezo nézte meg · Szunya és Mocor segített')
    expect(helpersLine('deru', ['falat'])).toBe('Derű nézte meg · Falat segített')
    expect(helpersLine('szunya', [])).toBe('Szunya nézte meg')
  })

  test('quota counts today\'s generated rows against the daily 3', () => {
    const now = new Date('2026-09-26T15:00:00')
    const today = new Date('2026-09-26T09:00:00').toISOString()
    const earlier = new Date('2026-09-25T09:00:00').toISOString()
    expect(DAILY_QUOTA).toBe(3)
    expect(quotaLeft([diag({ generatedAt: today }), diag({ generatedAt: earlier })], now)).toBe(2)
    expect(quotaLeft([1, 2, 3, 4].map(() => diag({ generatedAt: today })), now)).toBe(0)
  })

  test('newestFirst sorts by generatedAt without mutating', () => {
    const a = diag({ id: 'a', generatedAt: '2026-09-01T00:00:00Z' })
    const b = diag({ id: 'b', generatedAt: '2026-09-20T00:00:00Z' })
    const input = [a, b]
    expect(newestFirst(input).map((d) => d.id)).toEqual(['b', 'a'])
    expect(input.map((d) => d.id)).toEqual(['a', 'b'])
  })
})
