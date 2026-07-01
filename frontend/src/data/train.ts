import type {
  Mesocycle, WorkoutPlan, GymSchedule, GymScheduleSlot, Sport, ExerciseLibraryItem,
  GoalPreset, SplitOption, MesoPhase,
} from '@/data/types'
import type { IconName } from '@/components/ui/Icon'

// --- label / colour maps (mesocycles.jsx module constants) ---
export const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Mell', back: 'Hát', 'back-mid': 'Hát (közép)', lats: 'Lat', shoulder: 'Váll',
  'rear-delt': 'Hátsó váll', biceps: 'Bicep', triceps: 'Tricep',
  quad: 'Comb', ham: 'Lábhajlító', glute: 'Far', calf: 'Vádli',
  core: 'Core', traps: 'Trapéz',
}
export const DAY_LABELS: Record<string, string> = {
  Hét: 'Hétfő', Kedd: 'Kedd', Sze: 'Szerda', Csü: 'Csütörtök', Pén: 'Péntek', Szo: 'Szombat', Vas: 'Vasárnap',
}
export const DAY_ORDER = ['Hét', 'Kedd', 'Sze', 'Csü', 'Pén', 'Szo', 'Vas'] as const

// Cross-load system labels (sport.jsx SYSTEM_LABELS): label + token colour + icon name
export const SYSTEM_LABELS: Record<string, { label: string; color: string; icon: IconName }> = {
  Train: { label: 'Edzés', color: 'var(--brand-glow)', icon: 'train' },
  Fuel: { label: 'Étkezés', color: 'var(--info, var(--brand-primary))', icon: 'fuel' },
  Sleep: { label: 'Alvás', color: 'var(--cat-preference)', icon: 'today' },
  Weight: { label: 'Súly', color: 'var(--text-secondary)', icon: 'me' },
  Insights: { label: 'Patterns', color: 'var(--cat-physiology)', icon: 'insights' },
}

export const MESOCYCLE_PHASE_COLORS: Record<MesoPhase, string> = {
  MEV: 'var(--brand-deep, var(--brand-primary))',
  MAV: 'var(--brand-primary)',
  MRV: 'var(--brand-glow)',
  Deload: 'var(--text-tertiary)',
}
// Bar heights per phase, used by the phase-curve mini bars (small variant).
export function phaseBarHeight(p: MesoPhase): number {
  return { MEV: 12, MAV: 24, MRV: 36, Deload: 8 }[p]
}

// --- mesocycles (data.js:19-247) — the 4 objects verbatim ---
export const mesocycles: Mesocycle[] = [
  {
    id: 'meso-hyp-04',
    title: 'Hypertrophy 04 · Tavasz',
    shortTitle: 'Hypertrophy 04',
    status: 'active',
    goal: 'Felsőtest hypertrophy · izomtömeg építés',
    startDate: 'Máj 1',
    endDate: 'Jún 12',
    weeks: 6,
    currentWeek: 3,
    split: 'Pull / Push / Legs · 5×/hét',
    style: 'RP · 6 hét',
    phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
    volumeRecompute: {
      lastRun: 'Vasárnap · Máj 18 · 21:00',
      nextRun: 'Vasárnap · Máj 25 · 21:00',
      trigger: 'Heti pattern engine batch',
      changes: [
        { muscle: 'back', change: 'MRV +2 (20 → 22)', reason: 'Pull Day pumpa-tolerancia 4 héten át stabil RIR 1-en' },
        { muscle: 'shoulder', change: 'MRV -2 (20 → 18)', reason: 'Jobb váll niggle reaktivált · Máj 14', warning: true },
        { muscle: 'chest', change: 'MAV +2 (12 → 14)', reason: 'Bench Press progresszió Q1 retro óta' },
      ],
    },
    volumePerMuscle: {
      chest: {
        mev: 8, mav: 14, mrv: 20, current: 14,
        source: {
          baseline: { name: 'RP guidelines · intermediate', mev: 8, mav: 12, mrv: 18 },
          adjustments: [
            { kind: 'pattern', label: 'Múlt Q1 retro: pumpa 18-20 szet körül stabil maradt', delta: { mrv: +2 } },
            { kind: 'recovery', label: '7.2h alvás átlag · stabil', delta: { mav: +2 } },
          ],
          confidence: 0.78,
          note: 'Daniel-personalizált MRV. Bench Press + Incline DB + Cable Fly historikusan jól tolerál — 22-re is felmehetnénk, de Reta cycle alatt 20 a felső limit.',
        },
      },
      back: {
        mev: 10, mav: 16, mrv: 22, current: 16,
        source: {
          baseline: { name: 'RP guidelines · intermediate', mev: 10, mav: 14, mrv: 20 },
          adjustments: [
            { kind: 'pattern', label: 'Pull Day konzisztencia 14 hete · magas hát-tolerancia', delta: { mrv: +2, mav: +2 } },
            { kind: 'sport-cross', label: 'Volleyball pull-mozgások (smash, set) +load', delta: { mav: 0 } },
          ],
          confidence: 0.85,
          note: 'A legjobban tolerált izomcsoportod — Chest Row + Lat Pulldown stim/fatigue ratio kiváló.',
        },
      },
      shoulder: {
        mev: 8, mav: 12, mrv: 18, current: 12,
        source: {
          baseline: { name: 'RP guidelines · intermediate', mev: 8, mav: 14, mrv: 20 },
          adjustments: [
            { kind: 'niggle', label: 'Jobb váll niggle · márc 18 óta intermittent', delta: { mav: -2, mrv: -2 }, warning: true },
            { kind: 'sport-cross', label: 'Volleyball szervák + smashek shoulder volumen', delta: { mav: 0 } },
          ],
          confidence: 0.62,
          note: 'A niggle miatt lejjebb húzzuk az MRV-t. Lateral Raise OK, Overhead Press kerülve.',
        },
      },
      biceps: {
        mev: 6, mav: 10, mrv: 14, current: 10,
        source: {
          baseline: { name: 'RP guidelines · intermediate', mev: 8, mav: 14, mrv: 20 },
          adjustments: [
            { kind: 'pattern', label: 'Direct bicep work jobban reagált alacsonyabb volumenre', delta: { mev: -2, mav: -4, mrv: -6 } },
          ],
          confidence: 0.71,
          note: 'Korábbi mesókban észrevettük: 14 szet/hét + Pull Day indirect = pumpa szintje stagnál. Daniel-specifikus alacsonyabb MRV.',
        },
      },
      triceps: {
        mev: 6, mav: 10, mrv: 14, current: 10,
        source: {
          baseline: { name: 'RP guidelines · intermediate', mev: 6, mav: 10, mrv: 14 },
          adjustments: [],
          confidence: 0.74,
          note: 'Standard RP range — Push Day indirect + Pushdown direct work bevált.',
        },
      },
      quad: {
        mev: 8, mav: 12, mrv: 18, current: 12,
        source: {
          baseline: { name: 'RP guidelines · intermediate', mev: 8, mav: 14, mrv: 20 },
          adjustments: [
            { kind: 'sport-cross', label: 'Volleyball ugrás-volumen · jump count', delta: { mav: -2, mrv: -2 } },
          ],
          confidence: 0.68,
          note: 'Heti 5×100+ ugrás a volleyball-ról a quad-fáradtságot megemeli — direct leg-volumen kicsit alacsonyabb.',
        },
      },
      ham: {
        mev: 6, mav: 10, mrv: 14, current: 10,
        source: {
          baseline: { name: 'RP guidelines · intermediate', mev: 6, mav: 12, mrv: 16 },
          adjustments: [
            { kind: 'sport-cross', label: 'Sprintek + ugrások hamstring eccentric load', delta: { mav: -2, mrv: -2 } },
          ],
          confidence: 0.72,
        },
      },
      glute: {
        mev: 8, mav: 12, mrv: 18, current: 12,
        source: {
          baseline: { name: 'RP guidelines · intermediate', mev: 8, mav: 12, mrv: 16 },
          adjustments: [
            { kind: 'pattern', label: 'Hip Thrust + Squat stim ratio kiváló · MRV bővíthető', delta: { mrv: +2 } },
          ],
          confidence: 0.69,
        },
      },
    },
    days: [
      {
        day: 'Hét', type: 'Push', muscle: 'chest+shoulder+tricep',
        exerciseCount: 5,
        exercises: [
          { id: 'ex-mo-1', name: 'Barbell Bench Press', muscle: 'chest', sets: 4, targetReps: '6-8', targetRIR: 1, type: 'compound' },
          { id: 'ex-mo-2', name: 'Incline DB Press', muscle: 'chest', sets: 3, targetReps: '8-10', targetRIR: 1, type: 'compound' },
          { id: 'ex-mo-3', name: 'Overhead Press', muscle: 'shoulder', sets: 3, targetReps: '8-10', targetRIR: 2, type: 'compound', warning: 'Niggle-kíméletes verzió · cable variánssal helyettesítve' },
          { id: 'ex-mo-4', name: 'Lateral Raise', muscle: 'shoulder', sets: 3, targetReps: '12-15', targetRIR: 1, type: 'isolation' },
          { id: 'ex-mo-5', name: 'Tricep Pushdown', muscle: 'triceps', sets: 3, targetReps: '10-12', targetRIR: 1, type: 'isolation' },
        ],
      },
      {
        day: 'Kedd', type: 'Legs A', muscle: 'quad+ham+glute',
        exerciseCount: 4,
        exercises: [
          { id: 'ex-tu-1', name: 'Front Squat', muscle: 'quad', sets: 3, targetReps: '8-10', targetRIR: 2, type: 'compound' },
          { id: 'ex-tu-2', name: 'Leg Curl', muscle: 'ham', sets: 3, targetReps: '10-12', targetRIR: 1, type: 'isolation' },
          { id: 'ex-tu-3', name: 'Walking Lunge', muscle: 'quad', sets: 3, targetReps: '12 / oldal', targetRIR: 1, type: 'compound' },
          { id: 'ex-tu-4', name: 'Standing Calf Raise', muscle: 'calf', sets: 3, targetReps: '12-15', targetRIR: 0, type: 'isolation' },
        ],
        note: 'Reggeli 07:30 gym · este 17:00 volleyball',
      },
      {
        day: 'Sze', type: 'Legs', muscle: 'quad+ham+glute',
        exerciseCount: 6,
        exercises: [
          { id: 'ex-we-1', name: 'Barbell Squat', muscle: 'quad', sets: 4, targetReps: '6-8', targetRIR: 1, type: 'compound' },
          { id: 'ex-we-2', name: 'Romanian Deadlift', muscle: 'ham', sets: 3, targetReps: '8-10', targetRIR: 1, type: 'compound' },
          { id: 'ex-we-3', name: 'Leg Press', muscle: 'quad', sets: 3, targetReps: '10-12', targetRIR: 1, type: 'compound' },
          { id: 'ex-we-4', name: 'Leg Curl', muscle: 'ham', sets: 3, targetReps: '10-12', targetRIR: 1, type: 'isolation' },
          { id: 'ex-we-5', name: 'Hip Thrust', muscle: 'glute', sets: 3, targetReps: '8-10', targetRIR: 1, type: 'compound' },
          { id: 'ex-we-6', name: 'Standing Calf Raise', muscle: 'calf', sets: 3, targetReps: '12-15', targetRIR: 0, type: 'isolation' },
        ],
      },
      {
        day: 'Csü', type: 'Pull', muscle: 'back+bicep', muscleAccent: true,
        exerciseCount: 5, current: true,
        exercises: [
          { id: 'ex1', name: 'Chest Supported Row', muscle: 'back-mid', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound' },
          { id: 'ex2', name: 'Lat Pulldown · Pronated', muscle: 'lats', sets: 3, targetReps: '10-12', targetRIR: 2, type: 'compound', warning: 'Pronated grif · csukló-kíméletes' },
          { id: 'ex3', name: 'Cable Pull-Around', muscle: 'back-mid', sets: 3, targetReps: '12-15', targetRIR: 1, type: 'isolation' },
          { id: 'ex4', name: 'Hammer Curl', muscle: 'biceps', sets: 3, targetReps: '10-12', targetRIR: 1, type: 'isolation' },
          { id: 'ex5', name: 'Face Pull', muscle: 'rear-delt', sets: 3, targetReps: '15-20', targetRIR: 1, type: 'isolation' },
        ],
      },
      {
        day: 'Pén', type: 'Push · light', muscle: 'chest+shoulder',
        exerciseCount: 4,
        exercises: [
          { id: 'ex-fr-1', name: 'Incline DB Press', muscle: 'chest', sets: 3, targetReps: '10-12', targetRIR: 2, type: 'compound' },
          { id: 'ex-fr-2', name: 'Cable Fly', muscle: 'chest', sets: 3, targetReps: '12-15', targetRIR: 1, type: 'isolation' },
          { id: 'ex-fr-3', name: 'Lateral Raise', muscle: 'shoulder', sets: 3, targetReps: '12-15', targetRIR: 1, type: 'isolation' },
          { id: 'ex-fr-4', name: 'Overhead Tricep Ext', muscle: 'triceps', sets: 3, targetReps: '10-12', targetRIR: 1, type: 'isolation' },
        ],
      },
      {
        day: 'Szo', type: 'Volleyball · meccs', muscle: 'sport',
        exerciseCount: 0,
        exercises: [],
        note: 'Szombati volleyball · random idő · gym day off',
      },
      {
        day: 'Vas', type: 'Rest', muscle: '',
        exerciseCount: 0,
        exercises: [],
        note: 'Pihenőnap · weekly memoir 19:00',
      },
    ],
  },
  {
    id: 'meso-str-02',
    title: 'Strength 02 · Nyár',
    shortTitle: 'Strength 02',
    status: 'planned',
    goal: 'Maximális erő · 1RM növelés Squat/Bench/Deadlift',
    startDate: 'Jún 16',
    endDate: 'Aug 4',
    weeks: 7,
    currentWeek: 0,
    split: 'Upper / Lower · 4×/hét',
    style: 'Linear · 7 hét',
    phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'MRV', 'Deload'],
    notes: "Daniel: 'Idő egy erő-blokkra is.' Reta cycle befejezésével szinkronban indul.",
  },
  {
    id: 'meso-maint-01',
    title: 'Pre-cut maintenance · Aug',
    shortTitle: 'Maintenance',
    status: 'planned',
    goal: 'Karbantartás · zsírvesztés-előkészítés',
    startDate: 'Aug 7',
    endDate: 'Aug 28',
    weeks: 3,
    currentWeek: 0,
    split: 'Full body · 4×/hét',
    style: 'Maintenance · 3 hét',
    phaseCurve: ['MAV', 'MAV', 'MAV'],
    notes: 'Reta cycle vége — kalória deficit nélkül erő- és izom-tartás.',
  },
  {
    id: 'meso-rec-03',
    title: 'Recovery rebuild · Tél',
    shortTitle: 'Recovery 03',
    status: 'archived',
    goal: 'Január niggle után · izolációs munka',
    startDate: 'Feb 12',
    endDate: 'Ápr 23',
    weeks: 8,
    currentWeek: 8,
    split: 'Push / Pull / Legs · 3-4×/hét',
    style: 'RP · 8 hét',
    phaseCurve: ['MEV', 'MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'MRV', 'Deload'],
    summary: '8/10 — Chest Row +12.5kg, jobb váll niggle stabilizálva, alvás 7.2h átlag.',
  },
]

export const activeMeso: Mesocycle = mesocycles.find((m) => m.status === 'active')!

// --- active workout (data.js:626-701; challenges 642-700) ---
export const workout: WorkoutPlan = {
  title: 'Pull Day',
  tag: 'Week 3 · MAV',
  durationEst: 78,
  exercises: [
    { id: 'ex1', name: 'Chest Supported Row', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound', muscle: 'back-mid', lastWeek: { weight: 102.5, reps: 9, rir: 2 } },
    { id: 'ex2', name: 'Lat Pulldown · Pronated', sets: 3, targetReps: '10-12', targetRIR: 2, type: 'compound', muscle: 'lats', lastWeek: { weight: 72, reps: 11, rir: 2 } },
    { id: 'ex3', name: 'Cable Pull-Around', sets: 3, targetReps: '12-15', targetRIR: 1, type: 'isolation', muscle: 'back-mid', lastWeek: { weight: 22, reps: 13, rir: 1 } },
    { id: 'ex4', name: 'Hammer Curl', sets: 3, targetReps: '10-12', targetRIR: 1, type: 'isolation', muscle: 'biceps', lastWeek: { weight: 18, reps: 11, rir: 1 } },
    { id: 'ex5', name: 'Face Pull', sets: 3, targetReps: '15-20', targetRIR: 1, type: 'isolation', muscle: 'rear-delt', lastWeek: { weight: 27, reps: 17, rir: 1 } },
  ],
  niggleWarning: {
    muscle: 'right-shoulder',
    muscleLabel: 'Jobb váll',
    detail: 'Március 18 óta enyhe niggle. Múlt héten szépen érezhető lett, ezért a Cable Pull-Around-ot előrébb hozzuk és a Lat Pulldown-nál pronated griffel megyünk (csukló kíméletesebb).',
  },
  challenges: [
    {
      id: 'ch1',
      type: 'PR',
      typeLabel: 'PR-attempt',
      exerciseId: 'ex1',
      exercise: 'Chest Supported Row',
      target: '107.5 kg × 8',
      confidence: 0.72,
      risk: 'low',
      why: 'Március 4 óta 102.5 a stabil ablak. Múlt heti RIR 2 + Reta D3 alacsony étvágy + 7.2h alvás — historikusan ezek a kombináció 3/4-szer +5kg-os emelést támogatott.',
      refs: [
        { kind: 'PR', label: 'Chest Row 105.8 · Márc 4' },
        { kind: 'Pattern', label: 'Reta-D3 + 7h+ alvás → PR window' },
      ],
      tools: [
        { type: 'read', name: 'get_pr_history(ex=chest_row)' },
        { type: 'compute', name: 'predictPRWindow()' },
      ],
      glory: 'Új csúcs · 8 hét óta első PR',
    },
    {
      id: 'ch2',
      type: 'Depth',
      typeLabel: 'Mélység',
      exerciseId: 'ex2',
      exercise: 'Lat Pulldown · Pronated',
      target: 'Az utolsó szet RIR 0-ig',
      confidence: 0.81,
      risk: 'low',
      why: 'Múlt héten RIR 2-vel zártuk — Week 3 MAV-on a 3. szet RIR 0 logikus volumen-step. A pronated grif a vállat kíméli, így biztonságos.',
      refs: [
        { kind: 'Workout', label: 'Lat Pulldown · Máj 15' },
        { kind: 'MesoPhase', label: 'Week 3 MAV' },
      ],
      tools: [
        { type: 'read', name: 'get_recent_sets(ex=lat_pulldown, n=4)' },
      ],
      glory: 'Mélyebb stim · Week 4-re alap',
    },
    {
      id: 'ch3',
      type: 'Volume',
      typeLabel: 'Volumen',
      exerciseId: 'ex5',
      exercise: 'Face Pull',
      target: '+1 szet · 4×15-20',
      confidence: 0.68,
      risk: 'low',
      why: 'A rear-delt MAV nálad 12 szet/hét, és ezen a héten csak 9-en vagyunk. A Face Pull alacsony fáradtság/szet — kockázat nélkül beékelhető.',
      refs: [
        { kind: 'Pattern', label: 'Rear-delt MAV = 12 szet/hét' },
      ],
      tools: [
        { type: 'compute', name: 'computeMAVDelta(muscle=rear_delt)' },
      ],
      glory: 'Heti volumen target teljesítve',
    },
  ],
}

// --- weekly gym schedule (data.js:324-334) ---
export const gymSchedule: GymSchedule = {
  weeklyTimes: [
    { day: 'Hét', type: 'Push Day', time: '07:30', duration: 75, active: true },
    { day: 'Kedd', type: 'Legs', time: '07:30', duration: 75, active: true },
    { day: 'Sze', type: 'Pull Day', time: '07:30', duration: 75, active: true },
    { day: 'Csü', type: 'Pull Day', time: '07:30', duration: 78, active: true, today: true },
    { day: 'Pén', type: 'Push · light', time: '07:30', duration: 60, active: true },
    { day: 'Szo', type: null, time: null, duration: null, active: false },
    { day: 'Vas', type: null, time: null, duration: null, active: false },
  ],
}

// Standalone weekly gym slots (dayOfWeek 0=Hét..6=Vas) — the WHEN that
// `deriveGymSchedule` joins onto the active meso's gym days in mock mode.
export const gymScheduleMock: GymScheduleSlot[] = [
  { dayOfWeek: 1, time: '18:30' }, // Kedd
  { dayOfWeek: 3, time: '18:30' }, // Csü
]

// --- sport (data.js:250-322) — ADD jumpCount to each session (port fix) ---
export const sport: Sport = {
  schedule: {
    volleyball: {
      team: 'BVSC · Felnőtt II.',
      sessions: [
        { day: 'Hét', time: '18:15', duration: 90, court: 'BVSC csarnok', intensity: 'közepes', role: 'edzés' },
        { day: 'Kedd', time: '17:00', duration: 90, court: 'BVSC csarnok', intensity: 'közepes', role: 'edzés' },
        { day: 'Sze', time: '18:15', duration: 90, court: 'BVSC csarnok', intensity: 'közepes', role: 'edzés' },
        { day: 'Pén', time: '18:15', duration: 90, court: 'BVSC csarnok', intensity: 'közepes', role: 'edzés' },
        { day: 'Szo', time: '10:00', duration: 120, court: 'Kőbánya Sport', intensity: 'magas', role: 'meccs/scrim', flex: true },
      ],
      season: 'Tavasz · 2026 · Április - Június',
      weeklyHours: 7.5,
    },
  },
  sessions: [
    { id: 'vb-2026-05-20', sport: 'volleyball', date: 'Máj 20 · Kedd', time: '18:00', duration: 90, setsPlayed: 5, intensity: 7, rpe: 6.8, shoulderStrain: 6, jumpCount: 38, notes: 'Smashek tisztábbak, jobb váll után érzem délután' },
    { id: 'vb-2026-05-18', sport: 'volleyball', date: 'Máj 18 · Szo', time: '10:00', duration: 120, setsPlayed: 6, intensity: 8, rpe: 7.2, shoulderStrain: 7, jumpCount: 52, notes: 'Hosszú meccs · maradt erő utána' },
    { id: 'vb-2026-05-15', sport: 'volleyball', date: 'Máj 15 · Csü', time: '19:30', duration: 90, setsPlayed: 4, intensity: 7, rpe: 6.5, shoulderStrain: 5, jumpCount: 31, notes: null },
    { id: 'vb-2026-05-13', sport: 'volleyball', date: 'Máj 13 · Kedd', time: '18:00', duration: 90, setsPlayed: 5, intensity: 7, rpe: 6.9, shoulderStrain: 6, jumpCount: 35, notes: null },
    { id: 'vb-2026-05-11', sport: 'volleyball', date: 'Máj 11 · Szo', time: '10:00', duration: 120, setsPlayed: 6, intensity: 8, rpe: 7.5, shoulderStrain: 8, jumpCount: 48, notes: 'Sok smash · vasárnap pihentem' },
  ],
  week: {
    label: 'Hét 21 · Máj 18-24',
    sessions: 4,
    hoursPlayed: 6.5,
    avgRPE: 7.1,
    avgShoulderStrain: 6.5,
    shoulderLoadTrend: 'stabil',
  },
  crossLoad: [
    {
      target: 'Edzés · Quad MAV',
      impact: '−2',
      why: 'Heti 5-6h vertikális ugrás (smash/blocking) a quad-fáradtságot felemeli — direct leg-volument visszavesszük.',
      system: 'Train',
    },
    {
      target: 'Edzés · Váll volumen',
      impact: '−2 MRV',
      why: 'Smashek heti váll-load. Niggle reaktiválódás kockázata · Overhead Press → Cable variánssal.',
      system: 'Train',
      warning: true,
    },
    {
      target: 'Étkezés · Pre-session ablak',
      impact: 'T-2h carb',
      why: 'Pre-volleyball 60-80g szénhidrát 2h-val előbb · stabilabb 4. set teljesítmény.',
      system: 'Fuel',
    },
    {
      target: 'Alvás · Post-session',
      impact: '−24 perc',
      why: 'Késő-esti volleyball (19:30) historikusan kitolja az alvás kezdetét. Vacsorát 21:30 előtt csukjuk.',
      system: 'Sleep',
    },
    {
      target: 'Súly · Folyadékvesztés',
      impact: 'Kalibrálás',
      why: 'Szombat reggeli súly nem reprezentatív — péntek-szombat edzés után másnap reggel +/-1kg fluktuáció.',
      system: 'Weight',
    },
    {
      target: 'Pattern engine',
      impact: 'Beépítve',
      why: 'Hetente vasárnap újraszámolja: sport RPE × alvás → másnap reggeli RPE.',
      system: 'Insights',
    },
  ],
}

// --- exercise library (data.js:538-560) — all 21 items verbatim ---
export const exerciseLibrary: ExerciseLibraryItem[] = [
  { id: 'exl-1', name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound', stim: 0.92, fatigue: 0.55 },
  { id: 'exl-2', name: 'Lat Pulldown · Pronated', muscle: 'lats', type: 'compound', stim: 0.84, fatigue: 0.4 },
  { id: 'exl-3', name: 'Lat Pulldown · Neutral', muscle: 'lats', type: 'compound', stim: 0.82, fatigue: 0.4 },
  { id: 'exl-4', name: 'T-Bar Row', muscle: 'back-mid', type: 'compound', stim: 0.88, fatigue: 0.65 },
  { id: 'exl-5', name: 'Cable Pull-Around', muscle: 'back-mid', type: 'isolation', stim: 0.72, fatigue: 0.25 },
  { id: 'exl-6', name: 'Hammer Curl', muscle: 'biceps', type: 'isolation', stim: 0.68, fatigue: 0.2 },
  { id: 'exl-7', name: 'Incline DB Curl', muscle: 'biceps', type: 'isolation', stim: 0.74, fatigue: 0.22 },
  { id: 'exl-8', name: 'Face Pull', muscle: 'rear-delt', type: 'isolation', stim: 0.7, fatigue: 0.18 },
  { id: 'exl-9', name: 'Reverse Pec Deck', muscle: 'rear-delt', type: 'isolation', stim: 0.66, fatigue: 0.18 },
  { id: 'exl-10', name: 'Barbell Bench Press', muscle: 'chest', type: 'compound', stim: 0.94, fatigue: 0.7 },
  { id: 'exl-11', name: 'Incline DB Press', muscle: 'chest', type: 'compound', stim: 0.86, fatigue: 0.5 },
  { id: 'exl-12', name: 'Cable Fly', muscle: 'chest', type: 'isolation', stim: 0.74, fatigue: 0.25 },
  { id: 'exl-13', name: 'Overhead Press', muscle: 'shoulder', type: 'compound', stim: 0.86, fatigue: 0.55 },
  { id: 'exl-14', name: 'Lateral Raise', muscle: 'shoulder', type: 'isolation', stim: 0.72, fatigue: 0.2 },
  { id: 'exl-15', name: 'Tricep Pushdown', muscle: 'triceps', type: 'isolation', stim: 0.7, fatigue: 0.2 },
  { id: 'exl-16', name: 'Overhead Tricep Ext', muscle: 'triceps', type: 'isolation', stim: 0.74, fatigue: 0.22 },
  { id: 'exl-17', name: 'Barbell Squat', muscle: 'quad', type: 'compound', stim: 0.94, fatigue: 0.85 },
  { id: 'exl-18', name: 'Leg Press', muscle: 'quad', type: 'compound', stim: 0.84, fatigue: 0.6 },
  { id: 'exl-19', name: 'Romanian Deadlift', muscle: 'ham', type: 'compound', stim: 0.9, fatigue: 0.75 },
  { id: 'exl-20', name: 'Leg Curl', muscle: 'ham', type: 'isolation', stim: 0.74, fatigue: 0.25 },
  { id: 'exl-21', name: 'Hip Thrust', muscle: 'glute', type: 'compound', stim: 0.86, fatigue: 0.55 },
]

// --- planner presets (meso-planner.jsx GOAL_PRESETS + SPLITS) ---
export const GOAL_PRESETS: GoalPreset[] = [
  { id: 'hypertrophy', label: 'Hypertrophy', sub: 'Izomtömeg építés', defaultWeeks: 6, split: 'Pull / Push / Legs', days: 5, style: 'RP', phaseTemplate: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'], color: 'var(--brand-glow)', icon: 'train', description: 'Volumen-driven · MAV/MRV progresszió · klasszikus RP hypertrophy blokk' },
  { id: 'strength', label: 'Strength', sub: '1RM növelés', defaultWeeks: 7, split: 'Upper / Lower', days: 4, style: 'Linear', phaseTemplate: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'MRV', 'Deload'], color: 'var(--info, var(--brand-primary))', icon: 'train', description: 'Intenzitás-driven · 3-6 reps · alacsonyabb volumen · hosszabb pihenő' },
  { id: 'cut-prep', label: 'Pre-cut prep', sub: 'Karbantartás · zsírvesztés előtt', defaultWeeks: 3, split: 'Full body', days: 4, style: 'Maintenance', phaseTemplate: ['MAV', 'MAV', 'MAV'], color: 'var(--warning)', icon: 'fuel', description: 'Volumen-tartás · izom-megőrzés · deficit nélkül' },
  { id: 'recovery', label: 'Recovery', sub: 'Niggle után · újraépítés', defaultWeeks: 4, split: 'Custom', days: 3, style: 'Rehab', phaseTemplate: ['MEV', 'MEV', 'MAV', 'MAV'], color: 'var(--anchor-accent, var(--cat-preference))', icon: 'anchor', description: 'Isoláció-fokú · alacsony fatigue · niggle-aware substitúció' },
  { id: 'sport', label: 'Sport-specific', sub: 'Volleyball-driven blokk', defaultWeeks: 5, split: 'Upper / Lower / Sport', days: 5, style: 'Conjugate', phaseTemplate: ['MEV', 'MAV', 'MAV', 'MRV', 'Deload'], color: 'var(--cat-tendency)', icon: 'today', description: 'Vertikális teljesítmény · vállstabilitás · plyo-integráció' },
]
export const SPLITS: SplitOption[] = [
  { label: 'Pull / Push / Legs', days: [4, 5, 6], best: 'hypertrophy' },
  { label: 'Upper / Lower', days: [3, 4], best: 'strength' },
  { label: 'Full body', days: [3, 4, 5], best: 'cut-prep' },
  { label: 'Upper / Lower / Sport', days: [4, 5], best: 'sport' },
  { label: 'Custom split', days: [3, 4, 5, 6], best: null },
]
