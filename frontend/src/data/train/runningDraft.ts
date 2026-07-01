import type {
  RunningBlockResponse, RunningBlockUpsertRequest, RunningBlockStructureDto, RunWeek, RunPrescribedSession, RunSegment,
} from '@/data/train/runningApi'

const warmup = (): RunSegment => ({ type: 'warmup', durationSec: 300, label: null })
const cooldown = (): RunSegment => ({ type: 'cooldown', durationSec: 300, label: null })

export function sprintSession(rounds: number, restSec: number): RunPrescribedSession {
  return { key: 'tue-sprint', dayOfWeek: 1, timeOfDay: '18:00', label: 'Sprint-intervallum', kind: 'sprint',
    rpeTarget: { min: 9, max: 10 }, rounds,
    segments: [warmup(), { type: 'work', durationSec: 15, label: null }, { type: 'rest', durationSec: restSec, label: null }, cooldown()] }
}
export function pyramidSession(workSecs: number[], restMul: number): RunPrescribedSession {
  const segs: RunSegment[] = [warmup()]
  for (const w of workSecs) { segs.push({ type: 'work', durationSec: w, label: null }); segs.push({ type: 'rest', durationSec: Math.round(w * restMul), label: null }) }
  segs.push(cooldown())
  return { key: 'fri-pyramid', dayOfWeek: 4, timeOfDay: '17:30', label: 'Piramis-intervallum', kind: 'pyramid', rpeTarget: { min: 8, max: 9 }, rounds: null, segments: segs }
}
export function defaultWeek(n: number): RunWeek {
  return { weekNumber: n, phaseLabel: 'Alapozás', sessions: [sprintSession(5, 45), pyramidSession([15, 30, 45, 30, 15], 2)] }
}
export function newDraft(startIso: string, endIso: string): RunningBlockUpsertRequest {
  return { title: 'Új futóterv', goal: '', kind: 'interval', startDate: startIso, endDate: endIso, weeks: 4, currentWeek: 0,
    summary: null, structure: { weeks: [defaultWeek(1), defaultWeek(2), defaultWeek(3), defaultWeek(4)] } }
}
export function toUpsert(b: RunningBlockResponse): RunningBlockUpsertRequest {
  return { title: b.title, goal: b.goal ?? '', kind: b.kind, startDate: b.startDate, endDate: b.endDate,
    weeks: b.weeks, currentWeek: b.currentWeek, summary: b.summary ?? null, structure: b.structure }
}
export function duplicateDraft(b: RunningBlockResponse): RunningBlockUpsertRequest {
  return { ...toUpsert(b), title: `${b.title} (másolat)`, currentWeek: 0 }
}
export function setSprintRounds(s: RunningBlockStructureDto, weekNumber: number, rounds: number): RunningBlockStructureDto {
  return mapSession(s, weekNumber, 'tue-sprint', (sess) => ({ ...sess, rounds: Math.max(1, rounds) }))
}
export function setSprintRest(s: RunningBlockStructureDto, weekNumber: number, restSec: number): RunningBlockStructureDto {
  return mapSession(s, weekNumber, 'tue-sprint', (sess) => ({
    ...sess, segments: sess.segments.map((g) => g.type === 'rest' ? { ...g, durationSec: Math.max(5, restSec) } : g) }))
}
export function setPyramidWork(s: RunningBlockStructureDto, weekNumber: number, workSecs: number[]): RunningBlockStructureDto {
  return mapSession(s, weekNumber, 'fri-pyramid', (sess) => {
    const restMul = 2
    const segs: RunSegment[] = [warmup()]
    for (const w of workSecs) { segs.push({ type: 'work', durationSec: w, label: null }); segs.push({ type: 'rest', durationSec: Math.round(w * restMul), label: null }) }
    segs.push(cooldown())
    return { ...sess, segments: segs }
  })
}
function mapSession(s: RunningBlockStructureDto, weekNumber: number, key: string,
  fn: (sess: RunPrescribedSession) => RunPrescribedSession): RunningBlockStructureDto {
  return { weeks: s.weeks.map((w) => w.weekNumber !== weekNumber ? w
    : { ...w, sessions: w.sessions.map((sess) => sess.key === key ? fn(sess) : sess) }) }
}
// Plan-level: apply fn to the same-key session in EVERY week (day/time are constant across weeks).
function mapSessionAllWeeks(s: RunningBlockStructureDto, key: string,
  fn: (sess: RunPrescribedSession) => RunPrescribedSession): RunningBlockStructureDto {
  return { weeks: s.weeks.map((w) => ({ ...w, sessions: w.sessions.map((sess) => sess.key === key ? fn(sess) : sess) })) }
}
export function setSessionDay(s: RunningBlockStructureDto, key: string, dayOfWeek: number): RunningBlockStructureDto {
  return mapSessionAllWeeks(s, key, (sess) => ({ ...sess, dayOfWeek }))
}
export function setSessionTime(s: RunningBlockStructureDto, key: string, timeOfDay: string): RunningBlockStructureDto {
  return mapSessionAllWeeks(s, key, (sess) => ({ ...sess, timeOfDay }))
}
export function addWeek(s: RunningBlockStructureDto): RunningBlockStructureDto {
  if (s.weeks.length >= 8) return s
  const last = s.weeks[s.weeks.length - 1]
  const n = s.weeks.length + 1
  return { weeks: [...s.weeks, { ...last, weekNumber: n, sessions: last.sessions.map((sess) => ({ ...sess, segments: sess.segments.map((g) => ({ ...g })) })) }] }
}
export function removeLastWeek(s: RunningBlockStructureDto): RunningBlockStructureDto {
  if (s.weeks.length <= 1) return s
  return { weeks: s.weeks.slice(0, -1) }
}
export function sprintOf(w: RunWeek) { return w.sessions.find((s) => s.kind === 'sprint') ?? null }
export function pyramidOf(w: RunWeek) { return w.sessions.find((s) => s.kind === 'pyramid') ?? null }
export function workSecs(sess: RunPrescribedSession): number[] { return sess.segments.filter((g) => g.type === 'work').map((g) => g.durationSec) }
export function restSec(sess: RunPrescribedSession): number { return sess.segments.find((g) => g.type === 'rest')?.durationSec ?? 0 }
