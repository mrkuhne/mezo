import type {
  RunningBlockResponse,
  RunSessionLogResponse,
  RunWeek,
  RunPrescribedSession,
  RunSegment,
} from '@/data/train/runningApi'

// dayOfWeek: 0=Hét..6=Vas. Tue=1, Fri=4.
function sprintSession(rounds: number, restSec: number): RunPrescribedSession {
  return {
    key: 'tue-sprint', dayOfWeek: 1, timeOfDay: '18:00', label: 'Sprint-intervallum', kind: 'sprint',
    rpeTarget: { min: 9, max: 10 }, rounds,
    segments: [
      { type: 'warmup', durationSec: 300, label: null },
      { type: 'work', durationSec: 15, label: null },
      { type: 'rest', durationSec: restSec, label: null },
      { type: 'cooldown', durationSec: 300, label: null },
    ],
  }
}
function pyramidSession(workSecs: number[], restMul: number): RunPrescribedSession {
  const segments: RunSegment[] = [{ type: 'warmup', durationSec: 300, label: null }]
  for (const w of workSecs) {
    segments.push({ type: 'work', durationSec: w, label: null })
    segments.push({ type: 'rest', durationSec: Math.round(w * restMul), label: null })
  }
  segments.push({ type: 'cooldown', durationSec: 300, label: null })
  return {
    key: 'fri-pyramid', dayOfWeek: 4, timeOfDay: '17:30', label: 'Piramis-intervallum', kind: 'pyramid',
    rpeTarget: { min: 8, max: 9 }, rounds: null, segments,
  }
}
function week(n: number, phase: string, sprintRounds: number, sprintRest: number, pyramid: number[], pyrMul: number): RunWeek {
  return { weekNumber: n, phaseLabel: phase, sessions: [sprintSession(sprintRounds, sprintRest), pyramidSession(pyramid, pyrMul)] }
}

const activeWeeks: RunWeek[] = [
  week(1, 'Alapozás', 5, 45, [15, 30, 45, 30, 15], 2),
  week(2, 'Alapozás', 5, 45, [15, 30, 45, 30, 15], 2),
  week(3, 'Alapozás', 6, 45, [15, 30, 45, 45, 30, 15], 2),
  week(4, 'Alapozás', 6, 45, [15, 30, 45, 45, 30, 15], 2),
  week(5, 'Röpi-specifikus', 8, 45, [15, 30, 45, 60, 45, 30, 15], 2),
  week(6, 'Röpi-specifikus', 8, 45, [15, 30, 45, 60, 45, 30, 15], 2),
  week(7, 'Röpi-specifikus', 8, 30, [15, 30, 45, 60, 45, 30, 15], 1.5),
  week(8, 'Röpi-specifikus', 8, 30, [15, 30, 45, 60, 45, 30, 15], 1.5),
]

export const runningBlocksMock: RunningBlockResponse[] = [
  {
    id: 'rb-archived-01', title: 'Téli base 02', goal: 'aerob bázis', kind: 'interval',
    status: 'archived', startDate: '2026-02-12', endDate: '2026-04-09', weeks: 8, currentWeek: 8,
    summary: '7/10 · pulzus-megnyugvás −18mp javult',
    structure: { weeks: [week(1, 'Bázis', 4, 60, [15, 30, 15], 2)] },
  },
  {
    id: 'rb-active-01', title: 'Robbanékonyság 01', goal: 'sprint-állóképesség röpihez', kind: 'interval',
    status: 'active', startDate: '2026-06-16', endDate: '2026-08-11', weeks: 8, currentWeek: 3,
    summary: null, structure: { weeks: activeWeeks },
  },
  {
    id: 'rb-planned-01', title: '5K-alapozó', goal: 'aerob bázis', kind: 'interval',
    status: 'planned', startDate: '2026-08-14', endDate: '2026-09-24', weeks: 6, currentWeek: 0,
    summary: null, structure: { weeks: [week(1, 'Bázis', 4, 60, [30, 45, 30], 2)] },
  },
]

export const runSessionsMock: RunSessionLogResponse[] = [
  { id: 'rs-01', blockId: 'rb-active-01', weekNumber: 3, sessionKey: 'tue-sprint', date: '2026-06-30',
    completedRounds: 6, rpeActual: 9, hrRecoverySec: 42, sprintLandmark: 'túl a 2. lámpaoszlopon', durationMin: 22, notes: null },
  { id: 'rs-02', blockId: 'rb-active-01', weekNumber: 2, sessionKey: 'fri-pyramid', date: '2026-06-26',
    completedRounds: null, rpeActual: 8, hrRecoverySec: 50, sprintLandmark: null, durationMin: 26, notes: 'jó tempó' },
]
