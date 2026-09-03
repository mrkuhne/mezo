// ============================================================
// Mezo · lifegoalMock — mock-mode seed for the life-goal slice (mezo-iizd.1).
// Mirrors backend/.../feature/lifegoal/LifeGoalSeedData.java field-for-field (the file's own
// doc comment names this file as its FE mirror) and SignalCatalog.java's 28-row catalog, plus a
// template proposer (mockPropose) mirroring LifeGoalTemplateProposer.java's dimension/pillar
// rules. The four ids below (lg-kockahas/lg-hustle/lg-baratno/lg-spanyol) are mock-only — the
// backend seed has no stable ids — later tasks' tests reference them directly.
// ============================================================
import type {
  IfThenPlan, LifeGoalPillarInput, LifeGoalPillarResponse, LifeGoalProgressResponse,
  LifeGoalProposeRequest, LifeGoalProposeResponse, LifeGoalResponse, LifeGoalTodayResponse,
  PillarDayStatus, PillarProgress, PillarRule, PillarSource, SignalCatalogEntry, TrendArrow,
} from '@/data/lifegoal/lifegoalApi'
import type { components } from '@/data/_client/api.gen'
import { addDays, localDateString } from '@/shared/lib/dates'

type PillarDayEntry = components['schemas']['PillarDayEntry']
type GoalDayEntry = components['schemas']['GoalDayEntry']

function pillar(
  id: string, position: number, label: string, skillKey: string,
  kind: LifeGoalPillarInput['kind'], weight: number, source: PillarSource, rule: PillarRule = {},
): LifeGoalPillarResponse {
  return { id, position, label, skillKey, kind, weight, active: true, source, rule }
}

const metric = (key: string): PillarSource => ({ type: 'metric', key })
const activitySrc = (skillKey: string, measure: PillarSource['measure']): PillarSource => ({ type: 'activity', skillKey, measure })
const ring = (r: PillarSource['ring']): PillarSource => ({ type: 'needs_ring', ring: r })
const avg = (threshold: number, comparator: PillarRule['comparator'] = 'gte'): PillarRule => ({ threshold, comparator, windowDays: 7 })
const habit = (threshold: number, daysPerWeek: number): PillarRule => ({ threshold, comparator: 'gte', daysPerWeek })
const base = (): PillarRule => ({ windowDays: 28, direction: 'up', minDataDays: 14 })

const KOCKAHAS_PLANS: IfThenPlan[] = [
  { ha: '21 után éhes vagyok', akkor: 'túró + fahéj, nem nassolás' },
  {
    ha: 'lábnap után fáradt vagyok', akkor: '20:30 lefekvés, telefon a konyhában',
    trigger: { source: 'sport_session_logged', delayHours: 4 },
  },
]

const HUSTLE_PLANS: IfThenPlan[] = [
  { ha: 'este 20:00 és nincs edzés', akkor: '90 perc mély munka, Slack lenémítva' },
  { ha: 'új ötlet jön', akkor: 'a bd-be írom, nem kezdem el aznap' },
]

const BARATNO_PLANS: IfThenPlan[] = [
  { ha: 'hétvégén nincs terv', akkor: 'hívok valakit szombat délelőtt, nem várok' },
  { ha: 'tetszik valaki', akkor: 'egy héten belül kérdezek, nem elemzek' },
]

export const MOCK_LIFE_GOALS: LifeGoalResponse[] = [
  {
    id: 'lg-kockahas',
    title: 'Kockahas',
    whyText: 'Erős, egészséges test, ami bírja a röpit és a hétköznapokat — a kockahas ennek a jele, nem a célja.',
    frame: 'intrinsic',
    dimension: 'health',
    secondaryDimension: 'accomplishment',
    status: 'active',
    startDate: '2026-08-10',
    targetDate: '2026-11-30',
    activatedAt: '2026-08-10T07:00:00Z',
    obstacleText: 'Késő esti nassolás',
    ifThenPlans: KOCKAHAS_PLANS,
    pillars: [
      pillar('pil-kockahas-0', 0, 'Testkompozíció', 'recovery', 'linked', 2, { type: 'weight_goal' }),
      pillar('pil-kockahas-1', 1, 'Fehérje', 'cooking', 'average', 1, metric('DAILY_PROTEIN_G'), avg(160)),
      pillar('pil-kockahas-2', 2, 'Alvás', 'recovery', 'average', 2, metric('SLEEP_DURATION_H'), avg(7.0)),
      pillar('pil-kockahas-3', 3, 'Edzés', 'max_strength', 'habit', 1, metric('GYM_VOLUME_KG'), habit(1, 4)),
      pillar('pil-kockahas-4', 4, 'Fegyelem · napzárás', 'mindset', 'habit', 1, metric('RITUAL_CLOSED'), habit(1, 6)),
    ],
  },
  {
    id: 'lg-hustle',
    title: 'Side hustle',
    whyText: 'Egy saját termék, ami mások napját is rendbe teszi — és ami nem függ egy munkáltatótól.',
    frame: 'intrinsic',
    dimension: 'accomplishment',
    secondaryDimension: 'engagement',
    status: 'active',
    startDate: '2026-08-24',
    activatedAt: '2026-08-24T07:00:00Z',
    obstacleText: 'Este nincs energia a mély munkára',
    ifThenPlans: HUSTLE_PLANS,
    pillars: [
      pillar('pil-hustle-0', 0, 'Fejlesztés', 'productivity', 'baseline', 2, activitySrc('productivity', 'minutes'), base()),
      pillar('pil-hustle-1', 1, 'Tanulás', 'learning', 'habit', 1, activitySrc('learning', 'count'), habit(1, 2)),
      pillar('pil-hustle-2', 2, 'Bevétel', 'financial', 'target', 1, activitySrc('financial', 'huf'), {
        startValue: 0, targetValue: 50000, startDate: '2026-09-01', targetDate: '2026-12-31', direction: 'up',
      }),
    ],
  },
  {
    id: 'lg-baratno',
    title: 'Az utolsó barátnő',
    whyText: 'Olyan ember lenni, aki mellett jó lenni — és akkor jön, akinek jó.',
    frame: 'intrinsic',
    dimension: 'relationships',
    secondaryDimension: 'positive_emotion',
    status: 'active',
    startDate: '2026-08-01',
    activatedAt: '2026-08-01T07:00:00Z',
    obstacleText: 'Hétvégi terv nélküli napok',
    ifThenPlans: BARATNO_PLANS,
    pillars: [
      pillar('pil-baratno-0', 0, 'Társas élet', 'connection', 'baseline', 2, { type: 'social_mentions' }, base()),
      pillar('pil-baratno-1', 1, 'Tudatos ismerkedés', 'connection', 'habit', 1, activitySrc('connection', 'count'), habit(1, 1)),
      pillar('pil-baratno-2', 2, 'Egészséges életmód', 'recovery', 'average', 1, ring('mozgas'), avg(60)),
    ],
  },
  {
    id: 'lg-spanyol',
    title: 'Spanyol B2',
    whyText: 'Hogy a nyaralás ne fordítóval menjen.',
    frame: 'intrinsic',
    dimension: 'engagement',
    status: 'parked',
    startDate: '2026-06-01',
    ifThenPlans: [],
    pillars: [],
  },
]

// ── Signal catalog (SignalCatalog.java's 28 ENTRIES, minus the Java-only `id` — the
// SignalCatalogEntry response DTO does not serialize `id`; see SignalCatalogEntry.java) ──
export const MOCK_SIGNAL_CATALOG: SignalCatalogEntry[] = [
  { source: metric('SLEEP_DURATION_H'), label: 'Alváshossz', group: 'Alvás', kinds: ['habit', 'average', 'baseline'], unit: 'óra', defaultSkillKey: 'recovery' },
  { source: metric('SLEEP_QUALITY'), label: 'Alvásminőség', group: 'Alvás', kinds: ['average', 'baseline'], unit: '1–10', defaultSkillKey: 'recovery' },
  { source: metric('BEDTIME_VARIABILITY'), label: 'Lefekvés-szórás', group: 'Alvás', kinds: ['average', 'baseline'], unit: 'perc', defaultSkillKey: 'recovery' },
  { source: metric('DAILY_PROTEIN_G'), label: 'Fehérje', group: 'Fuel', kinds: ['habit', 'average', 'baseline'], unit: 'g', defaultSkillKey: 'cooking' },
  { source: metric('DAILY_KCAL'), label: 'Kalória', group: 'Fuel', kinds: ['average', 'baseline'], unit: 'kcal', defaultSkillKey: 'cooking' },
  { source: metric('DAILY_WATER_ML'), label: 'Víz', group: 'Fuel', kinds: ['habit', 'average'], unit: 'ml', defaultSkillKey: 'recovery' },
  { source: metric('LATE_MEAL_HOUR'), label: 'Utolsó étkezés ideje', group: 'Fuel', kinds: ['habit', 'average'], unit: 'óra', defaultSkillKey: 'mindset' },
  { source: metric('MEAL_SCORE'), label: 'Étkezés-pontszám', group: 'Fuel', kinds: ['average', 'baseline'], unit: 'pont', defaultSkillKey: 'cooking' },
  { source: metric('GYM_VOLUME_KG'), label: 'Gym-volumen', group: 'Edzés', kinds: ['habit', 'average', 'baseline'], unit: 'kg', defaultSkillKey: 'max_strength' },
  { source: metric('SPORT_LOAD_MIN'), label: 'Sportterhelés', group: 'Edzés', kinds: ['habit', 'average', 'baseline'], unit: 'perc', defaultSkillKey: 'aerobic_capacity' },
  { source: metric('ACWR'), label: 'Akut:krónikus terhelés', group: 'Edzés', kinds: ['average'], unit: 'arány', defaultSkillKey: 'recovery' },
  { source: metric('RUN_HR_RECOVERY_S'), label: 'Pulzus-visszaállás', group: 'Edzés', kinds: ['average', 'baseline'], unit: 'mp', defaultSkillKey: 'aerobic_capacity' },
  { source: { type: 'weight_goal' }, label: 'Súlycél · ütem', group: 'Edzés', kinds: ['linked'], unit: 'ítélet', defaultSkillKey: 'recovery' },
  { source: metric('CHECKIN_ENERGY'), label: 'Check-in energia', group: 'Elme', kinds: ['average', 'baseline'], unit: '1–10', defaultSkillKey: 'mindset' },
  { source: metric('CHECKIN_MENTAL'), label: 'Check-in hangulat', group: 'Elme', kinds: ['average', 'baseline'], unit: '1–10', defaultSkillKey: 'mindfulness' },
  { source: metric('CHECKIN_STRESS'), label: 'Stressz', group: 'Elme', kinds: ['average', 'baseline'], unit: '1–10', defaultSkillKey: 'mindfulness' },
  { source: metric('HABITS_DONE'), label: 'Kész szokások', group: 'Elme', kinds: ['habit', 'average'], unit: 'db', defaultSkillKey: 'mindset' },
  { source: metric('RITUAL_CLOSED'), label: 'Napzárás', group: 'Elme', kinds: ['habit'], unit: 'igen/nem', defaultSkillKey: 'mindset' },
  { source: metric('DAILY_XP'), label: 'Napi XP', group: 'Elme', kinds: ['average', 'baseline'], unit: 'XP', defaultSkillKey: 'mindset' },
  { source: activitySrc('productivity', 'minutes'), label: 'Produktivitás · perc', group: 'Activity', kinds: ['habit', 'baseline', 'target'], unit: 'perc', defaultSkillKey: 'productivity' },
  { source: activitySrc('learning', 'count'), label: 'Tanulás · alkalom', group: 'Activity', kinds: ['habit', 'baseline', 'target'], unit: 'alkalom', defaultSkillKey: 'learning' },
  { source: activitySrc('financial', 'huf'), label: 'Pénzügy · Ft', group: 'Activity', kinds: ['target', 'baseline'], unit: 'Ft', defaultSkillKey: 'financial' },
  { source: activitySrc('connection', 'count'), label: 'Kapcsolatok · alkalom', group: 'Activity', kinds: ['habit', 'baseline', 'target'], unit: 'alkalom', defaultSkillKey: 'connection' },
  { source: activitySrc('cooking', 'count'), label: 'Konyha · alkalom', group: 'Activity', kinds: ['habit', 'baseline', 'target'], unit: 'alkalom', defaultSkillKey: 'cooking' },
  { source: { type: 'social_mentions' }, label: 'Társas említések', group: 'Emberek', kinds: ['habit', 'average', 'baseline'], unit: 'ember', defaultSkillKey: 'connection' },
  { source: ring('mozgas'), label: 'Mozgás-gyűrű', group: 'Életjel', kinds: ['average', 'baseline'], unit: '%', defaultSkillKey: 'recovery' },
  { source: ring('pihenes'), label: 'Pihenés-gyűrű', group: 'Életjel', kinds: ['average', 'baseline'], unit: '%', defaultSkillKey: 'recovery' },
  { source: ring('lelek'), label: 'Lélek-gyűrű', group: 'Életjel', kinds: ['average', 'baseline'], unit: '%', defaultSkillKey: 'mindfulness' },
]

// ── Template proposer (mirrors LifeGoalTemplateProposer.java) ──

function dimensionOf(t: string): string {
  if (t.includes('kockahas') || t.includes('fogy') || t.includes('egészség') || t.includes('maraton') || t.includes('alv')) return 'health'
  if (t.includes('barát') || t.includes('kapcsolat') || t.includes('társ') || t.includes('család')) return 'relationships'
  if (t.includes('hustle') || t.includes('bevétel') || t.includes('karrier') || t.includes('projekt') || t.includes('app')) return 'accomplishment'
  if (t.includes('tanul') || t.includes('zene') || t.includes('flow') || t.includes('olvas')) return 'engagement'
  if (t.includes('hangulat') || t.includes('nyugodt') || t.includes('öröm')) return 'positive_emotion'
  return 'meaning'
}

function proposalAvg(id: string, label: string, skillKey: string, threshold: number): LifeGoalPillarInput {
  return { label, skillKey, kind: 'average', weight: 1, active: true, source: signalSource(id), rule: { threshold, comparator: 'gte', windowDays: 7 } }
}
function proposalHabit(id: string, label: string, skillKey: string, daysPerWeek: number): LifeGoalPillarInput {
  return { label, skillKey, kind: 'habit', weight: 1, active: true, source: signalSource(id), rule: { daysPerWeek } }
}
function proposalBase(id: string, label: string, skillKey: string): LifeGoalPillarInput {
  return { label, skillKey, kind: 'baseline', weight: 1, active: true, source: signalSource(id), rule: { windowDays: 28, minDataDays: 14 } }
}
// Signal ids used by the template proposer, mapped to their catalog source — mirrors the
// SignalCatalog#id lookups the Java proposer's PillarProposal ids are validated against.
function signalSource(id: string): PillarSource {
  const table: Record<string, PillarSource> = {
    sleep_duration: metric('SLEEP_DURATION_H'),
    protein: metric('DAILY_PROTEIN_G'),
    gym_volume: metric('GYM_VOLUME_KG'),
    ritual_closed: metric('RITUAL_CLOSED'),
    activity_productivity: activitySrc('productivity', 'minutes'),
    activity_learning: activitySrc('learning', 'count'),
    social_mentions: { type: 'social_mentions' },
    activity_connection: activitySrc('connection', 'count'),
    ring_mozgas: ring('mozgas'),
    checkin_mental: metric('CHECKIN_MENTAL'),
  }
  return table[id]
}

const PILLARS_BY_DIMENSION: Record<string, LifeGoalPillarInput[]> = {
  health: [
    proposalAvg('sleep_duration', 'Alvás', 'recovery', 7.0),
    proposalAvg('protein', 'Fehérje', 'cooking', 160),
    proposalHabit('gym_volume', 'Edzés', 'max_strength', 4),
    proposalHabit('ritual_closed', 'Fegyelem · napzárás', 'mindset', 6),
  ],
  accomplishment: [
    proposalBase('activity_productivity', 'Fejlesztés', 'productivity'),
    proposalHabit('activity_learning', 'Tanulás', 'learning', 2),
    proposalHabit('ritual_closed', 'Napzárás', 'mindset', 5),
  ],
  relationships: [
    proposalBase('social_mentions', 'Társas élet', 'connection'),
    proposalHabit('activity_connection', 'Tudatos találkozó', 'connection', 1),
    proposalAvg('ring_mozgas', 'Mozgás-gyűrű', 'recovery', 60),
  ],
  engagement: [
    proposalBase('activity_learning', 'Elmélyülés', 'learning'),
    proposalHabit('ritual_closed', 'Napzárás', 'mindset', 5),
  ],
  positive_emotion: [
    proposalAvg('checkin_mental', 'Hangulat', 'mindfulness', 7),
    proposalAvg('sleep_duration', 'Alvás', 'recovery', 7.0),
  ],
  meaning: [
    proposalHabit('ritual_closed', 'Napzárás', 'mindset', 5),
    proposalAvg('checkin_mental', 'Hangulat', 'mindfulness', 7),
  ],
}

export function mockPropose(req: LifeGoalProposeRequest): LifeGoalProposeResponse {
  const t = `${req.title ?? ''} ${req.whyText ?? ''}`.toLowerCase()
  const dimension = dimensionOf(t) as LifeGoalProposeResponse['dimension']
  const extrinsic = t.includes('nézzek ki') || t.includes('kinéz') || t.includes('strand') || t.includes('pénz') || t.includes('státusz')
  return {
    dimension,
    frame: extrinsic ? 'extrinsic' : 'intrinsic',
    frameNote: extrinsic
      ? 'Ez külső keret — a belső (egészség, képesség) tartósabb motiváció.'
      : 'Belső keret — ez tartós motiváció.',
    ...(extrinsic ? { reframedWhy: 'Erősebb, egészségesebb leszek — a kinézet ennek a jele, nem a célja.' } : {}),
    pillars: PILLARS_BY_DIMENSION[dimension],
    obstacles: ['Fáradt esték, kimaradó napzárás'],
    ifThenPlans: [
      { ha: 'kimarad a napzárás', akkor: 'másnap reggel 2 percben pótolom', trigger: { source: 'ritual_missed', delayHours: 10 } },
    ],
    source: 'template',
  }
}

// ── Progress / Today mocks (mezo-iizd.5) ──
// Deterministic 28-day mock progress: a hash of (goalId, pillarId/​'goal', dayIndex) drives the
// EARLY (days 0..20) status mix so real/mock diffing never depends on Math.random. The LAST 7
// days use a fixed per-arrow pattern instead of the hash, so the arrow's story is guaranteed by
// construction rather than by luck of the hash: the first seed goal (kockahas) trends 'up' and
// always shows at least one 'hit' in its last 7 days; the second (hustle) trends 'down' with
// missingHitDays=2; every other goal (incl. the pillarless, parked 'spanyol') is 'insufficient'.

const WINDOW_DAYS = 28

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const EARLY_CYCLE: PillarDayStatus[] = ['hit', 'partial', 'miss', 'no_data']
const RECENT_STATUS_UP: PillarDayStatus[] = ['hit', 'partial', 'hit', 'miss', 'hit', 'no_data', 'partial']
const RECENT_STATUS_DOWN: PillarDayStatus[] = ['miss', 'miss', 'partial', 'miss', 'no_data', 'partial', 'miss']
const RECENT_STATUS_INSUFFICIENT: PillarDayStatus[] = ['no_data', 'no_data', 'miss', 'no_data', 'partial', 'no_data', 'no_data']

function arrowFor(goalIndex: number): TrendArrow {
  if (goalIndex === 0) return 'up'
  if (goalIndex === 1) return 'down'
  return 'insufficient'
}

function recentPatternFor(goalIndex: number): PillarDayStatus[] {
  if (goalIndex === 0) return RECENT_STATUS_UP
  if (goalIndex === 1) return RECENT_STATUS_DOWN
  return RECENT_STATUS_INSUFFICIENT
}

function statusFor(goalIndex: number, dayIndex: number, hashValue: number): PillarDayStatus {
  if (dayIndex >= WINDOW_DAYS - 7) return recentPatternFor(goalIndex)[dayIndex - (WINDOW_DAYS - 7)]
  return EARLY_CYCLE[hashValue % EARLY_CYCLE.length]
}

// hit/partial/miss/no_data → the point value that maps back to the SAME status under the
// LifeGoalTodaySummary#days7 doc-comment thresholds (≥0.66 hit, ≥0.33 partial, <0.33 miss).
const STATUS_TO_POINT: Record<PillarDayStatus, number | undefined> = {
  hit: 0.8, partial: 0.5, miss: 0.15, no_data: undefined,
}

function buildPillarProgress(goalId: string, pillarId: string, goalIndex: number, from: string): PillarProgress {
  const arrow = arrowFor(goalIndex)
  const days: PillarDayEntry[] = Array.from({ length: WINDOW_DAYS }, (_, dayIndex) => {
    const day = addDays(from, dayIndex)
    const status = statusFor(goalIndex, dayIndex, hash(`${goalId}:${pillarId}:${dayIndex}`))
    const value = STATUS_TO_POINT[status]
    return value === undefined ? { day, status } : { day, status, value }
  })
  return { pillarId, arrow, ...(arrow === 'down' ? { missingHitDays: 2 } : {}), days }
}

function buildGoalDays(goalId: string, goalIndex: number, from: string): GoalDayEntry[] {
  return Array.from({ length: WINDOW_DAYS }, (_, dayIndex) => {
    const day = addDays(from, dayIndex)
    const status = statusFor(goalIndex, dayIndex, hash(`${goalId}:goal:${dayIndex}`))
    const point = STATUS_TO_POINT[status]
    return point === undefined ? { day } : { day, point }
  })
}

function weeklyPctOf(days: GoalDayEntry[]): number | undefined {
  const points = days.slice(-7).map((d) => d.point).filter((p): p is number => p !== undefined)
  if (points.length === 0) return undefined
  return Math.round((points.reduce((a, b) => a + b, 0) / points.length) * 100)
}

function last7StatusFromPoints(days: GoalDayEntry[]): PillarDayStatus[] {
  return days.slice(-7).map((d) => {
    if (d.point === undefined) return 'no_data'
    if (d.point >= 0.66) return 'hit'
    if (d.point >= 0.33) return 'partial'
    return 'miss'
  })
}

/** Determinisztikus 28 napos mock-progress a seed-célokhoz: a (goalId, pillarId, dayIndex) hash
 *  dönti a státuszt úgy, hogy legyen hit/partial/miss/no_data vegyesen, az első seed-cél nyila 'up',
 *  a másodiké 'down' (missingHitDays=2), a többi 'insufficient'. */
export function mockProgress(goalId: string): LifeGoalProgressResponse {
  const goalIndex = MOCK_LIFE_GOALS.findIndex((g) => g.id === goalId)
  const goal = goalIndex >= 0 ? MOCK_LIFE_GOALS[goalIndex] : undefined
  const to = localDateString()
  const from = addDays(to, -(WINDOW_DAYS - 1))
  const days = buildGoalDays(goalId, goalIndex, from)
  const pillars = (goal?.pillars ?? []).map((p) => buildPillarProgress(goalId, p.id, goalIndex, from))
  const weeklyPct = weeklyPctOf(days)
  return {
    goalId, from, to, arrow: arrowFor(goalIndex),
    ...(weeklyPct === undefined ? {} : { weeklyPct }),
    days, pillars, conflicts: [],
  }
}

export function mockToday(): LifeGoalTodayResponse {
  const goals = MOCK_LIFE_GOALS
    .filter((g) => g.status === 'active')
    .map((g) => {
      const progress = mockProgress(g.id)
      return {
        goalId: g.id,
        title: g.title,
        dimension: g.dimension,
        arrow: progress.arrow,
        days7: last7StatusFromPoints(progress.days),
        pillarsTotal: progress.pillars.length,
        pillarsHitToday: progress.pillars.filter((p) => p.days[p.days.length - 1]?.status === 'hit').length,
      }
    })
  return { goals }
}
