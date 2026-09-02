import type {
  Mesocycle, WorkoutPlan, GymSchedule, GymScheduleSlot, Sport, ExerciseLibraryItem,
  GoalPreset, SplitOption, MesoPhase, CustomWorkout, MesoVolumeArc, MuscleVolumeArc, VolumeArcWeek,
  MesoTemplate, MuscleTier, MusclePriorities,
} from '@/data/types'
import type { IconName } from '@/shared/ui/Icon'

// --- label / colour maps (mesocycles.jsx module constants) ---
// The 21 live per-exercise tokens (mezo-wu1s head/zone-specific taxonomy) PLUS the coarse
// legacy keys still used by muscle_group_volume_log / MesoVolume (chest, back, shoulder,
// biceps, triceps) and older summaries (lats, rear-delt).
export const MUSCLE_LABELS: Record<string, string> = {
  // Mell
  'chest-upper': 'Mell (felső)', 'chest-mid': 'Mell (közép)', 'chest-lower': 'Mell (alsó)',
  // Hát
  'back-wide': 'Hát (széles)', 'back-mid': 'Hát (közép)', 'back-lower': 'Hát (alsó)', traps: 'Trapéz',
  // Váll
  'shoulder-front': 'Váll (első)', 'shoulder-side': 'Váll (oldalsó)', 'shoulder-rear': 'Váll (hátsó)',
  // Kar
  'biceps-long': 'Bicepsz (hosszú fej)', 'biceps-short': 'Bicepsz (rövid fej)', 'biceps-brachialis': 'Brachialis',
  'triceps-long': 'Tricepsz (hosszú fej)', 'triceps-lateral': 'Tricepsz (oldalsó fej)', 'triceps-medial': 'Tricepsz (mediális fej)',
  // Láb + Core
  quad: 'Comb', ham: 'Lábhajlító', glute: 'Far', calf: 'Vádli', core: 'Core',
  // Legacy coarse keys (volume log + old summaries)
  chest: 'Mell', back: 'Hát', lats: 'Lat', shoulder: 'Váll',
  'rear-delt': 'Hátsó váll', biceps: 'Bicep', triceps: 'Tricep',
}
export const DAY_LABELS: Record<string, string> = {
  Hét: 'Hétfő', Kedd: 'Kedd', Sze: 'Szerda', Csü: 'Csütörtök', Pén: 'Péntek', Szo: 'Szombat', Vas: 'Vasárnap',
}
export const DAY_ORDER = ['Hét', 'Kedd', 'Sze', 'Csü', 'Pén', 'Szo', 'Vas'] as const

// Cross-load system labels (sport.jsx SYSTEM_LABELS): label + token colour + icon name
export const SYSTEM_LABELS: Record<string, { label: string; color: string; icon: IconName }> = {
  Train: { label: 'Edzés', color: 'var(--coral)', icon: 'train' },
  Fuel: { label: 'Étkezés', color: 'var(--info, var(--coral))', icon: 'fuel' },
  Sleep: { label: 'Alvás', color: 'var(--cat-preference)', icon: 'today' },
  Weight: { label: 'Súly', color: 'var(--text-secondary)', icon: 'me' },
  Insights: { label: 'Patterns', color: 'var(--cat-physiology)', icon: 'insights' },
}

// Prototype fidelity (meso-body.html PSTYLE): the tappable phase curve must read at a
// glance, so each phase carries a visually distinct hue — sage (ramp-up) → coral
// (progression) → deep coral (peak) → amber (deload) — instead of three near-identical
// coral tones that would defeat the point of a scannable curve (mezo-d20.3.7).
export const MESOCYCLE_PHASE_COLORS: Record<MesoPhase, string> = {
  MEV: 'var(--sage)',
  MAV: 'var(--coral)',
  MRV: 'var(--coral-deep, var(--coral))',
  Deload: 'var(--amber)',
}
// Bar heights per phase, used by the phase-curve mini bars (small variant).
export function phaseBarHeight(p: MesoPhase): number {
  return { MEV: 12, MAV: 24, MRV: 36, Deload: 8 }[p]
}

// --- mesocycles (data.js:19-247) — the 4 objects verbatim ---
export const mesocycles: Mesocycle[] = [
  {
    id: 'meso-hyp-04',
    // Links to the template derived from this same run's days (mesoTemplatesMock below) —
    // mirrors backend reality (every run started from a template carries its id) and lets
    // mock-mode rerun resolve without materializing a throwaway template (mezo-meyc.1 fix).
    templateId: 'a10e0000-0000-4000-8000-000000000000',
    title: 'Hypertrophy 04 · Tavasz',
    shortTitle: 'Hypertrophy 04',
    status: 'active',
    goal: 'Felsőtest hypertrophy · izomtömeg építés',
    // Shoulder is tagged 'maintain' (mezo-3m5m) — narratively the same niggle the
    // volumePerMuscle.shoulder adjustments below already talk about; the rest stay
    // unset (grow default). Exercises both non-default tiers for the mock-arc ceiling
    // parity pin (train.test.ts): grow -> MAV peak, maintain -> flat MEV.
    musclePriorities: { shoulder: 'maintain' },
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
          note: 'Daniel-personalizált MRV. Bench Press + Incline DB + Cable Fly historikusan jól tolerál — 22-re is felmehetnénk, de mély deficitben 20 a felső limit.',
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
          { id: 'ex-mo-1', name: 'Barbell Bench Press', muscle: 'chest-mid', warmupSets: 2, workingSets: 4, repMin: 6, repMax: 8, targetRIR: 1, type: 'compound' },
          { id: 'ex-mo-2', name: 'Incline DB Press', muscle: 'chest-upper', warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' },
          { id: 'ex-mo-3', name: 'Overhead Press', muscle: 'shoulder-front', warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 2, type: 'compound', warning: 'Niggle-kíméletes verzió · cable variánssal helyettesítve' },
          { id: 'ex-mo-4', name: 'Lateral Raise', muscle: 'shoulder-side', warmupSets: 2, workingSets: 3, repMin: 12, repMax: 15, targetRIR: 1, type: 'isolation' },
          { id: 'ex-mo-5', name: 'Tricep Pushdown', muscle: 'triceps-medial', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'isolation' },
        ],
      },
      {
        day: 'Kedd', type: 'Legs A', muscle: 'quad+ham+glute',
        exerciseCount: 4,
        exercises: [
          { id: 'ex-tu-1', name: 'Front Squat', muscle: 'quad', warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 2, type: 'compound' },
          { id: 'ex-tu-2', name: 'Leg Curl', muscle: 'ham', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'isolation' },
          { id: 'ex-tu-3', name: 'Walking Lunge', muscle: 'quad', warmupSets: 2, workingSets: 3, repMin: 12, repMax: 12, targetRIR: 1, type: 'compound' },
          { id: 'ex-tu-4', name: 'Standing Calf Raise', muscle: 'calf', warmupSets: 2, workingSets: 3, repMin: 12, repMax: 15, targetRIR: 0, type: 'isolation' },
        ],
        note: 'Reggeli 07:30 gym · este 17:00 volleyball',
      },
      {
        day: 'Sze', type: 'Legs', muscle: 'quad+ham+glute',
        exerciseCount: 6,
        exercises: [
          { id: 'ex-we-1', name: 'Barbell Squat', muscle: 'quad', warmupSets: 2, workingSets: 4, repMin: 6, repMax: 8, targetRIR: 1, type: 'compound' },
          { id: 'ex-we-2', name: 'Romanian Deadlift', muscle: 'ham', warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' },
          { id: 'ex-we-3', name: 'Leg Press', muscle: 'quad', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'compound' },
          { id: 'ex-we-4', name: 'Leg Curl', muscle: 'ham', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'isolation' },
          { id: 'ex-we-5', name: 'Hip Thrust', muscle: 'glute', warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' },
          { id: 'ex-we-6', name: 'Standing Calf Raise', muscle: 'calf', warmupSets: 2, workingSets: 3, repMin: 12, repMax: 15, targetRIR: 0, type: 'isolation' },
        ],
      },
      {
        day: 'Csü', type: 'Pull', muscle: 'back+bicep', muscleAccent: true,
        exerciseCount: 5, current: true,
        exercises: [
          { id: 'ex1', name: 'Chest Supported Row', muscle: 'back-mid', warmupSets: 2, workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' },
          { id: 'ex2', name: 'Lat Pulldown · Pronated', muscle: 'back-wide', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 2, type: 'compound', warning: 'Pronated grif · csukló-kíméletes' },
          { id: 'ex3', name: 'Cable Pull-Around', muscle: 'back-mid', warmupSets: 2, workingSets: 3, repMin: 12, repMax: 15, targetRIR: 1, type: 'isolation' },
          { id: 'ex4', name: 'Hammer Curl', muscle: 'biceps-brachialis', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'isolation' },
          { id: 'ex5', name: 'Face Pull', muscle: 'shoulder-rear', warmupSets: 2, workingSets: 3, repMin: 15, repMax: 20, targetRIR: 1, type: 'isolation' },
        ],
      },
      {
        day: 'Pén', type: 'Push · light', muscle: 'chest+shoulder',
        exerciseCount: 4,
        exercises: [
          { id: 'ex-fr-1', name: 'Incline DB Press', muscle: 'chest-upper', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 2, type: 'compound' },
          { id: 'ex-fr-2', name: 'Cable Fly', muscle: 'chest-mid', warmupSets: 2, workingSets: 3, repMin: 12, repMax: 15, targetRIR: 1, type: 'isolation' },
          { id: 'ex-fr-3', name: 'Lateral Raise', muscle: 'shoulder-side', warmupSets: 2, workingSets: 3, repMin: 12, repMax: 15, targetRIR: 1, type: 'isolation' },
          { id: 'ex-fr-4', name: 'Overhead Tricep Ext', muscle: 'triceps-long', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'isolation' },
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
    musclePriorities: null,
    startDate: 'Jún 16',
    endDate: 'Aug 4',
    weeks: 7,
    currentWeek: 0,
    split: 'Upper / Lower · 4×/hét',
    style: 'Linear · 7 hét',
    phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'MRV', 'Deload'],
    notes: "Daniel: 'Idő egy erő-blokkra is.' A deficit-szakasz lezárásával szinkronban indul.",
  },
  {
    id: 'meso-maint-01',
    title: 'Pre-cut maintenance · Aug',
    shortTitle: 'Maintenance',
    status: 'planned',
    goal: 'Karbantartás · zsírvesztés-előkészítés',
    musclePriorities: null,
    startDate: 'Aug 7',
    endDate: 'Aug 28',
    weeks: 3,
    currentWeek: 0,
    split: 'Full body · 4×/hét',
    style: 'Maintenance · 3 hét',
    phaseCurve: ['MAV', 'MAV', 'MAV'],
    notes: 'Deficit-szakasz vége — kalória deficit nélkül erő- és izom-tartás.',
  },
  {
    id: 'meso-rec-03',
    title: 'Recovery rebuild · Tél',
    shortTitle: 'Recovery 03',
    status: 'archived',
    goal: 'Január niggle után · izolációs munka',
    musclePriorities: null,
    startDate: 'Feb 12',
    endDate: 'Ápr 23',
    weeks: 8,
    currentWeek: 8,
    split: 'Push / Pull / Legs · 3-4×/hét',
    style: 'RP · 8 hét',
    phaseCurve: ['MEV', 'MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'MRV', 'Deload'],
    summary: '8/10 — Chest Row +12.5kg, jobb váll niggle stabilizálva, alvás 7.2h átlag.',
    closedAt: '2026-04-23T19:40:00Z',
    hasReport: true,
  },
  // The SECOND closed run with a report (mezo-meyc.4) — mock mode needs two of them or the
  // compare view (/train/mesocycles/compare?a=&b=) has nothing to line up. Deliberately
  // UNLIKE `meso-rec-03`: a shorter (6 vs 8 weeks), higher-volume block with worse adherence
  // and worse lifestyle numbers, so every compare row shows a real difference — and its
  // report's strength list shares only PART of rec-03's exercises (see mesoReportHyp03Mock).
  {
    id: 'meso-hyp-03',
    // A legacy/direct run like meso-rec-03 — it predates the template split, so a rerun
    // materializes a template for it (mezo-meyc.1) instead of resolving one.
    templateId: null,
    title: 'Hypertrophy 03 · Ősz',
    shortTitle: 'Hypertrophy 03',
    status: 'archived',
    goal: 'Felsőtest hypertrophy · magas volumen',
    musclePriorities: null,
    startDate: 'Okt 2',
    endDate: 'Nov 13',
    weeks: 6,
    currentWeek: 6,
    split: 'Push / Pull / Legs · 4×/hét',
    style: 'RP · 6 hét',
    phaseCurve: ['MEV', 'MAV', 'MAV', 'MRV', 'MRV', 'Deload'],
    summary: '7/10 — nagy volumen, de az alvás 6,8h-ra esett és +1,4 kg jött vissza.',
    closedAt: '2025-11-13T20:10:00Z',
    hasReport: true,
  },
  // A THIRD closed run (mezo-meyc.4 fix wave) — deliberately minimal and with NO report:
  // exists only so `MesocycleLibraryPage`'s selection mode has a third card to prove it
  // refuses a third pick (the compare view is strictly pairwise). No report fixture needed —
  // `hasReport: false` keeps this run out of every compare-page test.
  {
    id: 'meso-cut-02',
    title: 'Cut prep · Nyár',
    shortTitle: 'Cut 02',
    status: 'archived',
    goal: 'Zsírvesztés · fenntartó erő',
    musclePriorities: null,
    startDate: 'Jún 4',
    endDate: 'Júl 16',
    weeks: 6,
    currentWeek: 6,
    split: 'Full body · 4×/hét',
    style: 'Maintenance · 6 hét',
    phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MAV', 'Deload'],
    closedAt: '2026-07-16T18:00:00Z',
    hasReport: false,
  },
]

export const activeMeso: Mesocycle = mesocycles.find((m) => m.status === 'active')!

// --- meso templates (mezo-meyc): reusable blueprints the wizard saves before starting a
// run. Mirrors the backend's per-write invariants so mock parity holds: every exercise
// carries a non-null id (fixed literal uuids here — the backend regenerates them on every
// full update), every day's `muscle` is a string (never undefined; '' on rest days), and
// `exercises` is always an array (never null), even on a day with none.
export const mesoTemplatesMock: MesoTemplate[] = [
  // Derived from the active `meso-hyp-04` fixture's days — the same PPL block, already run once.
  {
    id: 'a10e0000-0000-4000-8000-000000000000',
    title: 'Hypertrophy 04 · Tavasz',
    shortTitle: 'Hypertrophy 04',
    goal: 'Felsőtest hypertrophy · izomtömeg építés',
    weeks: 6,
    split: 'Pull / Push / Legs · 5×/hét',
    style: 'RP · 6 hét',
    phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
    notes: null,
    volumePerMuscle: null,
    runCount: 1,
    days: [
      {
        day: 'Hét', type: 'Push', muscle: 'chest+shoulder+tricep',
        exerciseCount: 5,
        exercises: [
          { id: 'a10e0000-0000-4000-8000-000000000001', name: 'Barbell Bench Press', muscle: 'chest-mid', warmupSets: 2, workingSets: 4, repMin: 6, repMax: 8, targetRIR: 1, type: 'compound' },
          { id: 'a10e0000-0000-4000-8000-000000000002', name: 'Incline DB Press', muscle: 'chest-upper', warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' },
          { id: 'a10e0000-0000-4000-8000-000000000003', name: 'Overhead Press', muscle: 'shoulder-front', warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 2, type: 'compound', warning: 'Niggle-kíméletes verzió · cable variánssal helyettesítve' },
          { id: 'a10e0000-0000-4000-8000-000000000004', name: 'Lateral Raise', muscle: 'shoulder-side', warmupSets: 2, workingSets: 3, repMin: 12, repMax: 15, targetRIR: 1, type: 'isolation' },
          { id: 'a10e0000-0000-4000-8000-000000000005', name: 'Tricep Pushdown', muscle: 'triceps-medial', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'isolation' },
        ],
      },
      {
        day: 'Kedd', type: 'Legs A', muscle: 'quad+ham+glute',
        exerciseCount: 4,
        exercises: [
          { id: 'a10e0000-0000-4000-8000-000000000006', name: 'Front Squat', muscle: 'quad', warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 2, type: 'compound' },
          { id: 'a10e0000-0000-4000-8000-000000000007', name: 'Leg Curl', muscle: 'ham', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'isolation' },
          { id: 'a10e0000-0000-4000-8000-000000000008', name: 'Walking Lunge', muscle: 'quad', warmupSets: 2, workingSets: 3, repMin: 12, repMax: 12, targetRIR: 1, type: 'compound' },
          { id: 'a10e0000-0000-4000-8000-000000000009', name: 'Standing Calf Raise', muscle: 'calf', warmupSets: 2, workingSets: 3, repMin: 12, repMax: 15, targetRIR: 0, type: 'isolation' },
        ],
      },
      {
        day: 'Sze', type: 'Legs', muscle: 'quad+ham+glute',
        exerciseCount: 6,
        exercises: [
          { id: 'a10e0000-0000-4000-8000-000000000010', name: 'Barbell Squat', muscle: 'quad', warmupSets: 2, workingSets: 4, repMin: 6, repMax: 8, targetRIR: 1, type: 'compound' },
          { id: 'a10e0000-0000-4000-8000-000000000011', name: 'Romanian Deadlift', muscle: 'ham', warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' },
          { id: 'a10e0000-0000-4000-8000-000000000012', name: 'Leg Press', muscle: 'quad', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'compound' },
          { id: 'a10e0000-0000-4000-8000-000000000013', name: 'Leg Curl', muscle: 'ham', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'isolation' },
          { id: 'a10e0000-0000-4000-8000-000000000014', name: 'Hip Thrust', muscle: 'glute', warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' },
          { id: 'a10e0000-0000-4000-8000-000000000015', name: 'Standing Calf Raise', muscle: 'calf', warmupSets: 2, workingSets: 3, repMin: 12, repMax: 15, targetRIR: 0, type: 'isolation' },
        ],
      },
      {
        day: 'Csü', type: 'Pull', muscle: 'back+bicep', muscleAccent: true,
        exerciseCount: 5,
        exercises: [
          { id: 'a10e0000-0000-4000-8000-000000000016', name: 'Chest Supported Row', muscle: 'back-mid', warmupSets: 2, workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' },
          { id: 'a10e0000-0000-4000-8000-000000000017', name: 'Lat Pulldown · Pronated', muscle: 'back-wide', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 2, type: 'compound', warning: 'Pronated grif · csukló-kíméletes' },
          { id: 'a10e0000-0000-4000-8000-000000000018', name: 'Cable Pull-Around', muscle: 'back-mid', warmupSets: 2, workingSets: 3, repMin: 12, repMax: 15, targetRIR: 1, type: 'isolation' },
          { id: 'a10e0000-0000-4000-8000-000000000019', name: 'Hammer Curl', muscle: 'biceps-brachialis', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'isolation' },
          { id: 'a10e0000-0000-4000-8000-000000000020', name: 'Face Pull', muscle: 'shoulder-rear', warmupSets: 2, workingSets: 3, repMin: 15, repMax: 20, targetRIR: 1, type: 'isolation' },
        ],
      },
      {
        day: 'Pén', type: 'Push · light', muscle: 'chest+shoulder',
        exerciseCount: 4,
        exercises: [
          { id: 'a10e0000-0000-4000-8000-000000000021', name: 'Incline DB Press', muscle: 'chest-upper', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 2, type: 'compound' },
          { id: 'a10e0000-0000-4000-8000-000000000022', name: 'Cable Fly', muscle: 'chest-mid', warmupSets: 2, workingSets: 3, repMin: 12, repMax: 15, targetRIR: 1, type: 'isolation' },
          { id: 'a10e0000-0000-4000-8000-000000000023', name: 'Lateral Raise', muscle: 'shoulder-side', warmupSets: 2, workingSets: 3, repMin: 12, repMax: 15, targetRIR: 1, type: 'isolation' },
          { id: 'a10e0000-0000-4000-8000-000000000024', name: 'Overhead Tricep Ext', muscle: 'triceps-long', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'isolation' },
        ],
      },
      { day: 'Szo', type: 'Volleyball · meccs', muscle: 'sport', exerciseCount: 0, exercises: [] },
      { day: 'Vas', type: 'Rest', muscle: '', exerciseCount: 0, exercises: [] },
    ],
  },
  // A fresh, never-started template — no run yet.
  {
    id: 'b20f0000-0000-4000-8000-000000000000',
    title: 'Upper/Lower Power',
    shortTitle: 'Power Block',
    goal: 'Erő + hypertrophy kombinált blokk',
    goalPreset: 'strength',
    // Demonstrates carry in mock mode (mezo-3m5m): duplicating this template or starting a
    // run from it must stamp `back: emphasize` onto the copy/run, not silently drop it.
    musclePriorities: { back: 'emphasize' },
    weeks: 5,
    split: 'Upper / Lower · 4×/hét',
    style: 'Linear · 5 hét',
    phaseCurve: ['MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
    notes: null,
    volumePerMuscle: null,
    runCount: 0,
    days: [
      {
        day: 'Hét', type: 'Upper A', muscle: 'chest+back',
        exerciseCount: 3,
        exercises: [
          { id: 'b20f0000-0000-4000-8000-000000000001', name: 'Barbell Bench Press', muscle: 'chest-mid', warmupSets: 2, workingSets: 4, repMin: 5, repMax: 7, targetRIR: 1, type: 'compound' },
          { id: 'b20f0000-0000-4000-8000-000000000002', name: 'Chest Supported Row', muscle: 'back-mid', warmupSets: 2, workingSets: 4, repMin: 6, repMax: 8, targetRIR: 1, type: 'compound' },
          { id: 'b20f0000-0000-4000-8000-000000000003', name: 'Overhead Press', muscle: 'shoulder-front', warmupSets: 2, workingSets: 3, repMin: 6, repMax: 8, targetRIR: 2, type: 'compound' },
        ],
      },
      {
        day: 'Kedd', type: 'Lower A', muscle: 'quad+ham',
        exerciseCount: 3,
        exercises: [
          { id: 'b20f0000-0000-4000-8000-000000000004', name: 'Barbell Squat', muscle: 'quad', warmupSets: 2, workingSets: 4, repMin: 5, repMax: 7, targetRIR: 1, type: 'compound' },
          { id: 'b20f0000-0000-4000-8000-000000000005', name: 'Romanian Deadlift', muscle: 'ham', warmupSets: 2, workingSets: 3, repMin: 6, repMax: 8, targetRIR: 1, type: 'compound' },
          { id: 'b20f0000-0000-4000-8000-000000000006', name: 'Standing Calf Raise', muscle: 'calf', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'isolation' },
        ],
      },
      { day: 'Sze', type: 'Rest', muscle: '', exerciseCount: 0, exercises: [] },
      {
        day: 'Csü', type: 'Upper B', muscle: 'shoulder+bicep+tricep',
        exerciseCount: 3,
        exercises: [
          { id: 'b20f0000-0000-4000-8000-000000000007', name: 'Incline DB Press', muscle: 'chest-upper', warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' },
          { id: 'b20f0000-0000-4000-8000-000000000008', name: 'Lat Pulldown · Pronated', muscle: 'back-wide', warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' },
          { id: 'b20f0000-0000-4000-8000-000000000009', name: 'Hammer Curl', muscle: 'biceps-brachialis', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'isolation' },
        ],
      },
      {
        day: 'Pén', type: 'Lower B', muscle: 'glute+calf',
        exerciseCount: 3,
        exercises: [
          { id: 'b20f0000-0000-4000-8000-000000000010', name: 'Hip Thrust', muscle: 'glute', warmupSets: 2, workingSets: 4, repMin: 6, repMax: 8, targetRIR: 1, type: 'compound' },
          { id: 'b20f0000-0000-4000-8000-000000000011', name: 'Leg Press', muscle: 'quad', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'compound' },
          { id: 'b20f0000-0000-4000-8000-000000000012', name: 'Standing Calf Raise', muscle: 'calf', warmupSets: 2, workingSets: 3, repMin: 12, repMax: 15, targetRIR: 0, type: 'isolation' },
        ],
      },
      { day: 'Szo', type: 'Rest', muscle: '', exerciseCount: 0, exercises: [] },
      { day: 'Vas', type: 'Rest', muscle: '', exerciseCount: 0, exercises: [] },
    ],
  },
]

// --- volume arc mock derivation (Phase B, Task B3; tier ceiling mezo-3m5m/AD4) ---
// Same planned-scaffold algorithm as the backend (VolumeArcService, spec DA7): week 1 starts
// at MEV, deload weeks drop to round(ceiling * MOCK_DELOAD_FRACTION) (ramp untouched), every
// other week ramps by MOCK_STEP up to the muscle's TIER ceiling — Emphasize MRV / Grow MAV
// (default) / Maintain MEV (flat) — mirrors the backend's PriorityTier.ceiling.
const MOCK_STEP = 2
const MOCK_DELOAD_FRACTION = 0.5

// Coarse volume-group -> color-family region key. Mirrors features/train/logic/muscleColors'
// REGION_BY_GROUP, inlined here rather than imported: data/ must not import from features/
// (docs/references/frontend_conventions.md — the four-layer boundary runs one way only).
const MOCK_REGION_BY_MUSCLE: Record<string, string> = {
  chest: 'coral', back: 'sky', shoulder: 'lav', biceps: 'rose', triceps: 'rose',
  quad: 'sage', ham: 'sage', glute: 'sage', calf: 'sage', core: 'amber',
}

/** Sparse-map resolve: null map, absent key, or (defensively) unknown value all mean GROW. Mirrors the backend's `PriorityTier.of`. */
function resolveMuscleTier(musclePriorities: MusclePriorities | null | undefined, muscle: string): MuscleTier {
  return musclePriorities?.[muscle] ?? 'grow'
}

/** Which volume landmark is "100%" for a tier's weekly ramp. Mirrors the backend's `PriorityTier.ceiling`. */
function tierCeiling(tier: MuscleTier, vp: { mev: number; mav: number; mrv: number }): number {
  switch (tier) {
    case 'emphasize': return vp.mrv
    case 'maintain': return vp.mev
    default: return vp.mav
  }
}

// Derives a whole-mesocycle volume arc from the `mesocycles` fixture's `volumePerMuscle`
// landmarks — a planned scaffold for every week, plus a realistic `actual`: past weeks hit
// the planned target, the current week shows `vp.current`, future weeks are null (undrawn).
// A mesocycle with no `volumePerMuscle` (planned/archived fixtures carry none) yields null,
// matching the backend's "absent muscle -> absent from response" rule (DA5).
/**
 * One muscle's week-by-week scaffold + actuals. Extracted from `mesoVolumeArcMock` so the
 * FROZEN arc baked into `mesoReportMock` (mezo-meyc.2) is generated by the very same math
 * as the live one — a report arc that drifted from the overview arc would be a lie.
 */
function mockMuscleArc(
  muscle: string,
  vp: { mev: number; mav: number; mrv: number; current: number },
  phaseCurve: MesoPhase[],
  weeks: number,
  currentWeek: number,
  tier: MuscleTier,
): MuscleVolumeArc {
  const ceiling = tierCeiling(tier, vp)
  const weekList: VolumeArcWeek[] = []
  let ramp = vp.mev
  for (let w = 1; w <= weeks; w++) {
    const phase = phaseCurve[w - 1] ?? 'MEV'
    let planned: number
    if (w === 1) {
      planned = vp.mev
      ramp = vp.mev
    } else if (phase === 'Deload') {
      planned = Math.round(ceiling * MOCK_DELOAD_FRACTION)
    } else {
      ramp = Math.min(ramp + MOCK_STEP, ceiling)
      planned = ramp
    }
    const actual = w < currentWeek ? planned : w === currentWeek ? vp.current : null
    weekList.push({ week: w, phase, planned, actual, isCurrent: w === currentWeek })
  }
  // The response's `mrv` caption stays the row's RAW mrv untouched — only the internal
  // scaffold shifts with the tier (mirrors the backend's MuscleVolumeArc#getMrv() comment).
  return { muscle, region: MOCK_REGION_BY_MUSCLE[muscle] ?? 'neutral', mrv: vp.mrv, weeks: weekList }
}

export function mesoVolumeArcMock(id: string | null): MesoVolumeArc | null {
  const meso = mesocycles.find((m) => m.id === id)
  if (!meso || !meso.volumePerMuscle) return null
  const { volumePerMuscle, phaseCurve, currentWeek, weeks, musclePriorities } = meso

  const muscles: MuscleVolumeArc[] = Object.entries(volumePerMuscle).map(([muscle, vp]) =>
    mockMuscleArc(muscle, vp, phaseCurve, weeks, currentWeek, resolveMuscleTier(musclePriorities, muscle)),
  )

  return {
    mesocycleId: meso.id,
    title: meso.title,
    currentWeek,
    weeks,
    startDate: meso.startDate,
    endDate: meso.endDate,
    status: meso.status,
    phaseCurve: meso.phaseCurve,
    muscles,
  }
}

// --- run report (mezo-meyc.2) ---
// The offline report for the ONE archived fixture run (`meso-rec-03`), shaped exactly like
// the backend's frozen `MesocycleReportResponse` so /train/mesocycles/meso-rec-03/report
// renders end-to-end without a backend. Frozen means literal: the numbers below are the
// close-time snapshot, never recomputed from the live fixtures.
const REC03_PHASES: MesoPhase[] = ['MEV', 'MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'MRV', 'Deload']
// mev/mrv/current per muscle — `current` is the week-8 (Deload) actual, so the frozen arc
// reads "hit the plan to the last week" rather than trailing off. `mav` is set equal to
// `mrv` here on purpose: this is a FROZEN close-time snapshot predating the priority-tier
// feature (mezo-3m5m) — the run itself carries no `musclePriorities`, so tier resolves to
// the Grow default (ceiling = mav) and mav==mrv keeps this pinned snapshot's numbers
// byte-identical to before the tier ceiling landed.
const REC03_LANDMARKS: [string, { mev: number; mav: number; mrv: number; current: number }][] = [
  ['chest', { mev: 6, mav: 16, mrv: 16, current: 8 }],
  ['back', { mev: 8, mav: 20, mrv: 20, current: 10 }],
  ['shoulder', { mev: 6, mav: 14, mrv: 14, current: 7 }],
  ['biceps', { mev: 6, mav: 14, mrv: 14, current: 7 }],
  ['quad', { mev: 8, mav: 18, mrv: 18, current: 9 }],
  ['ham', { mev: 6, mav: 14, mrv: 14, current: 7 }],
]

export const mesoReportMock = {
  mesocycleId: 'meso-rec-03',
  // A legacy/direct run — it was never stamped from a template (mirrors the fixture).
  templateId: null,
  title: 'Recovery rebuild · Tél',
  startDate: '2026-02-12',
  endDate: '2026-04-23',
  closedAt: '2026-04-23T19:40:00Z',
  weeks: 8,
  // The archived fixture's own summary line — on the backend this is the note captured by
  // MesoCloseSheet at close time.
  selfEval: '8/10 — Chest Row +12.5kg, jobb váll niggle stabilizálva, alvás 7.2h átlag.',
  // S3 (mezo-meyc.3): the generated Hungarian narrative — paragraphs are split on a blank
  // line by the page (no markdown lib), so keep the `\n\n` separators literal.
  aiEval:
    'A Recovery rebuild blokk összességében stabil, kontrollált progressziót hozott: a 8 hét alatt az edzések 88%-át teljesítetted, ami kifejezetten jó arány egy olyan blokkban, ami eleve a regenerációra és a jobb vállad niggle-jének kezelésére épült.\n\n' +
    'Az alvásod átlagosan 7,4 óra volt, ami a cél fölött van, és jól látszik, hogy a jobban alvó heteken (4. és 8. hét) az energiaszinted és a stresszed is kedvezőbben alakult. A 3. héten hiányzó alvásadat, illetve az 5. héten megszakadt kcal-naplózás rontja kicsit a kép élességét — érdemes ezt elkerülni a következő blokkban.\n\n' +
    'Az erő oldalán a Chest Supported Row +12,5 kg-os, 17,2%-os e1RM-javulása kiemelkedő, és a Lateral Raise-en is valós progressziót értél el változatlan súly mellett. Az Overhead Pressen látott visszalépés a tudatos váll-menedzsment ára volt, nem visszaesés.\n\n' +
    'Összességében a testsúlyod 1,1 kg-mal csökkent a mért napokon, a stressz-szint a deload hétre látványosan mérséklődött, a sport-terhelés pedig végig stabil maradt. Jó alapot ad ez a blokk a következő, magasabb volumenű ciklushoz.',
  aiEvalStatus: 'ready',
  aiEvalGeneratedAt: '2026-04-23T19:45:00Z',
  // S3 (mezo-meyc.3): the feature is on and the narrative above is generated — the page
  // renders the ready card. `mockClose` (trainHooks) keeps its OWN seeded report at
  // pending/false on purpose (a freshly closed run has nothing to evaluate yet).
  aiEvalEnabled: true,
  adherence: {
    plannedSessions: 24, completedSessions: 21, plannedWeeks: 8, completedWeeks: 8, completionPct: 88,
  },
  volume: {
    mesocycleId: 'meso-rec-03',
    title: 'Recovery rebuild · Tél',
    currentWeek: 8,
    weeks: 8,
    startDate: '2026-02-12',
    endDate: '2026-04-23',
    status: 'archived',
    phaseCurve: REC03_PHASES,
    muscles: REC03_LANDMARKS.map(([muscle, vp]) => mockMuscleArc(muscle, vp, REC03_PHASES, 8, 8, 'grow')),
  },
  // Sorted the way the backend sorts: deltaPct (e1RM-based) descending, nulls last. The list
  // deliberately mixes every rendering case: a load+e1RM gain, a load-flat/reps-only e1RM gain,
  // a fully flat lift (both deltas 0), a regression, and a weightless lift with no e1RM at all.
  strength: [
    {
      exerciseName: 'Chest Supported Row', muscle: 'back-mid', firstWeek: 1, lastWeek: 8,
      firstTopKg: 72.5, firstTopReps: 8, lastTopKg: 85, lastTopReps: 8,
      firstE1rm: 91.83, lastE1rm: 107.67, deltaKg: 12.5, deltaPct: 17.2,
    },
    {
      exerciseName: 'Lat Pulldown · Pronated', muscle: 'back-wide', firstWeek: 1, lastWeek: 8,
      firstTopKg: 60, firstTopReps: 10, lastTopKg: 70, lastTopReps: 10,
      firstE1rm: 80, lastE1rm: 93.33, deltaKg: 10, deltaPct: 16.7,
    },
    {
      // Same load, more reps — 0 kg but a real e1RM gain, so only the % pill may show.
      exerciseName: 'Lateral Raise', muscle: 'shoulder-side', firstWeek: 2, lastWeek: 8,
      firstTopKg: 12, firstTopReps: 12, lastTopKg: 12, lastTopReps: 16,
      firstE1rm: 16.8, lastE1rm: 18.4, deltaKg: 0, deltaPct: 9.5,
    },
    {
      // Genuinely flat — same load, same reps. Both deltas are 0, so NEITHER pill may show
      // (a `0% e1RM` badge would read as a verdict where there is no movement at all).
      exerciseName: 'Leg Press', muscle: 'quad', firstWeek: 1, lastWeek: 8,
      firstTopKg: 120, firstTopReps: 12, lastTopKg: 120, lastTopReps: 12,
      firstE1rm: 168, lastE1rm: 168, deltaKg: 0, deltaPct: 0,
    },
    {
      // The niggle-managed press — a deliberate regression (both pills go negative).
      exerciseName: 'Overhead Press', muscle: 'shoulder-front', firstWeek: 1, lastWeek: 5,
      firstTopKg: 45, firstTopReps: 8, lastTopKg: 42.5, lastTopReps: 8,
      firstE1rm: 57, lastE1rm: 53.83, deltaKg: -2.5, deltaPct: -5.6,
    },
    {
      // Weightless: no load to diff and no e1RM to quote — reps movement is the whole story.
      exerciseName: 'Chin-up', muscle: 'back-wide', firstWeek: 1, lastWeek: 7,
      firstTopReps: 6, lastTopReps: 10,
    },
  ],
  records: {
    medalCount: 7,
    top: [
      { exerciseName: 'Hammer Curl', kind: 'WEIGHT', date: '2026-04-09', value: 22.5 },
      { exerciseName: 'Face Pull', kind: 'E1RM', date: '2026-04-02', value: 41.3 },
      { exerciseName: 'Leg Curl', kind: 'REPS_AT_WEIGHT', date: '2026-03-26', value: 16 },
    ],
  },
  // Lifestyle context (S3, mezo-meyc.3): weekly buckets + totals correlated to the run's
  // window. A couple of deliberate holes (week 3's sleep, week 5's kcal, week 8's runs —
  // deload week, no runs logged) exercise the report page's "–" null-cell rendering.
  context: {
    weeks: [
      { week: 1, sleepAvgH: 7.1, sleepQualityAvg: 7, kcalAvg: 2380, kcalTargetAvg: 2450, mealCoverageDays: 6, waterAvgMl: 2400, energyAvg: 6.2, stressAvg: 4.8, weightDeltaKg: -0.2, sportMinutes: 90, sportSessions: 2, runSessions: 1, gymRpeAvg: 7.0 },
      { week: 2, sleepAvgH: 7.4, sleepQualityAvg: 7.5, kcalAvg: 2410, kcalTargetAvg: 2450, mealCoverageDays: 7, waterAvgMl: 2500, energyAvg: 6.6, stressAvg: 4.5, weightDeltaKg: -0.1, sportMinutes: 120, sportSessions: 3, runSessions: 1, gymRpeAvg: 7.2 },
      // Sleep data missing this week (device sync gap) — sleepAvgH/sleepQualityAvg render "–".
      { week: 3, sleepAvgH: null, sleepQualityAvg: null, kcalAvg: 2390, kcalTargetAvg: 2450, mealCoverageDays: 5, waterAvgMl: 2350, energyAvg: 6.0, stressAvg: 5.2, weightDeltaKg: -0.3, sportMinutes: 100, sportSessions: 2, runSessions: 1, gymRpeAvg: 7.4 },
      { week: 4, sleepAvgH: 7.6, sleepQualityAvg: 8, kcalAvg: 2420, kcalTargetAvg: 2500, mealCoverageDays: 7, waterAvgMl: 2600, energyAvg: 7.0, stressAvg: 4.1, weightDeltaKg: -0.2, sportMinutes: 110, sportSessions: 2, runSessions: 2, gymRpeAvg: 7.1 },
      // Fuel logging lapsed this week — kcalAvg/kcalTargetAvg render "–".
      { week: 5, sleepAvgH: 7.2, sleepQualityAvg: 7, kcalAvg: null, kcalTargetAvg: null, mealCoverageDays: 3, waterAvgMl: 2300, energyAvg: 6.4, stressAvg: 5.5, weightDeltaKg: 0.1, sportMinutes: 80, sportSessions: 1, runSessions: 1, gymRpeAvg: 7.6 },
      { week: 6, sleepAvgH: 7.0, sleepQualityAvg: 6.5, kcalAvg: 2460, kcalTargetAvg: 2500, mealCoverageDays: 6, waterAvgMl: 2400, energyAvg: 5.8, stressAvg: 6.0, weightDeltaKg: -0.1, sportMinutes: 95, sportSessions: 2, runSessions: 1, gymRpeAvg: 7.8 },
      { week: 7, sleepAvgH: 7.5, sleepQualityAvg: 7.5, kcalAvg: 2440, kcalTargetAvg: 2500, mealCoverageDays: 7, waterAvgMl: 2550, energyAvg: 6.8, stressAvg: 4.6, weightDeltaKg: -0.2, sportMinutes: 105, sportSessions: 2, runSessions: 2, gymRpeAvg: 7.3 },
      // Deload week — no runs logged; runSessions renders "–" (not 0: absence, not a zero count).
      { week: 8, sleepAvgH: 7.9, sleepQualityAvg: 8.5, kcalAvg: 2500, kcalTargetAvg: 2550, mealCoverageDays: 7, waterAvgMl: 2600, energyAvg: 7.4, stressAvg: 3.8, weightDeltaKg: -0.1, sportMinutes: 60, sportSessions: 1, runSessions: null, gymRpeAvg: 5.5 },
    ],
    totals: {
      daysTotal: 56,
      sleepAvgH: 7.4,
      kcalAvg: 2429,
      energyAvg: 6.5,
      stressAvg: 4.8,
      // Sum of the measured, consecutive-day deltas across the window — NOT "start minus end".
      weightChangeKg: -1.1,
      sportMinutes: 760,
      sportSessions: 15,
      runSessions: 9,
      mealCoverageDays: 48,
    },
  },
} satisfies import('@/data/train/trainApi').MesocycleReportResponse

// The SECOND frozen report (mezo-meyc.4) — the compare view's other column. Same shape,
// deliberately different numbers everywhere so `/train/mesocycles/compare?a=meso-rec-03&
// b=meso-hyp-03` renders a comparison with actual contrast: 6 weeks against 8, worse
// adherence, a higher-volume arc, worse lifestyle averages.
//
// The strength list is the load-bearing part: it shares exactly THREE exercise identities
// with rec-03 (Chest Supported Row, Lateral Raise, Leg Press) and adds two of its own
// (Barbell Bench Press, Romanian Deadlift), while rec-03 keeps three it does not have
// (Lat Pulldown, Overhead Press, Chin-up). So `sharedStrengthDeltas` has a real overlap
// AND real non-overlap on both sides — the two states the compare list must handle.
const HYP03_PHASES: MesoPhase[] = ['MEV', 'MAV', 'MAV', 'MRV', 'MRV', 'Deload']
// Higher landmarks than rec-03's rebuild block, plus `triceps` (which rec-03 has no arc for)
// and no `biceps`/`ham` (which it does) — so the compare grid's muscle union is genuinely
// wider than either side. `mav` == `mrv` for the same frozen-snapshot reason as REC03_LANDMARKS.
const HYP03_LANDMARKS: [string, { mev: number; mav: number; mrv: number; current: number }][] = [
  ['chest', { mev: 8, mav: 20, mrv: 20, current: 10 }],
  ['back', { mev: 10, mav: 22, mrv: 22, current: 11 }],
  ['shoulder', { mev: 8, mav: 18, mrv: 18, current: 9 }],
  ['quad', { mev: 10, mav: 20, mrv: 20, current: 10 }],
  ['triceps', { mev: 6, mav: 16, mrv: 16, current: 8 }],
]

export const mesoReportHyp03Mock = {
  mesocycleId: 'meso-hyp-03',
  templateId: null,
  title: 'Hypertrophy 03 · Ősz',
  startDate: '2025-10-02',
  endDate: '2025-11-13',
  closedAt: '2025-11-13T20:10:00Z',
  weeks: 6,
  selfEval: '7/10 — a volumen ment, az életmód nem.',
  aiEval:
    'A Hypertrophy 03 blokk volumenben az eddigi legmagasabb volt, és a vállon, combon és háton valós erő-progressziót hozott — a Lateral Raise +14,5%-os és a Leg Press +12,5%-os e1RM-javulása a blokk két legerősebb eredménye.\n\n' +
    'Az árát viszont az életmód fizette meg: az alvás 6,8 órára esett, a stressz 5,4-re emelkedett, és a mért napokon +1,4 kg jött vissza. Az edzések 79%-a teljesült — a kihagyott öt edzés túlnyomó része a 4. és 5. hétre esett, épp a legmagasabb volumenű szakaszra.',
  aiEvalStatus: 'ready',
  aiEvalGeneratedAt: '2025-11-13T20:15:00Z',
  aiEvalEnabled: true,
  adherence: {
    plannedSessions: 24, completedSessions: 19, plannedWeeks: 6, completedWeeks: 6, completionPct: 79,
  },
  volume: {
    mesocycleId: 'meso-hyp-03',
    title: 'Hypertrophy 03 · Ősz',
    currentWeek: 6,
    weeks: 6,
    startDate: '2025-10-02',
    endDate: '2025-11-13',
    status: 'archived',
    phaseCurve: HYP03_PHASES,
    muscles: HYP03_LANDMARKS.map(([muscle, vp]) => mockMuscleArc(muscle, vp, HYP03_PHASES, 6, 6, 'grow')),
  },
  // Backend order: deltaPct (e1RM) descending, nulls last.
  strength: [
    {
      exerciseName: 'Lateral Raise', muscle: 'shoulder-side', firstWeek: 1, lastWeek: 6,
      firstTopKg: 10, firstTopReps: 14, lastTopKg: 12, lastTopReps: 12,
      firstE1rm: 14.67, lastE1rm: 16.8, deltaKg: 2, deltaPct: 14.5,
    },
    {
      exerciseName: 'Leg Press', muscle: 'quad', firstWeek: 2, lastWeek: 6,
      firstTopKg: 140, firstTopReps: 10, lastTopKg: 150, lastTopReps: 12,
      firstE1rm: 186.67, lastE1rm: 210, deltaKg: 10, deltaPct: 12.5,
    },
    {
      exerciseName: 'Chest Supported Row', muscle: 'back-mid', firstWeek: 1, lastWeek: 6,
      firstTopKg: 65, firstTopReps: 8, lastTopKg: 72.5, lastTopReps: 8,
      firstE1rm: 82.33, lastE1rm: 91.83, deltaKg: 7.5, deltaPct: 11.5,
    },
    {
      exerciseName: 'Romanian Deadlift', muscle: 'ham', firstWeek: 1, lastWeek: 6,
      firstTopKg: 90, firstTopReps: 8, lastTopKg: 100, lastTopReps: 8,
      firstE1rm: 114, lastE1rm: 126.67, deltaKg: 10, deltaPct: 11.1,
    },
    {
      exerciseName: 'Barbell Bench Press', muscle: 'chest-mid', firstWeek: 1, lastWeek: 6,
      firstTopKg: 80, firstTopReps: 6, lastTopKg: 87.5, lastTopReps: 6,
      firstE1rm: 96, lastE1rm: 105, deltaKg: 7.5, deltaPct: 9.4,
    },
  ],
  records: {
    medalCount: 4,
    top: [
      { exerciseName: 'Barbell Bench Press', kind: 'WEIGHT', date: '2025-11-06', value: 87.5 },
      { exerciseName: 'Leg Press', kind: 'E1RM', date: '2025-10-30', value: 210 },
    ],
  },
  // `energyAvg` is deliberately null in the totals: the compare view's context table must
  // render "–" for a metric only ONE of the two runs measured (never a fabricated 0).
  context: {
    weeks: [
      { week: 1, sleepAvgH: 7.0, sleepQualityAvg: 6.5, kcalAvg: 2650, kcalTargetAvg: 2600, mealCoverageDays: 6, waterAvgMl: 2300, energyAvg: null, stressAvg: 4.9, weightDeltaKg: 0.3, sportMinutes: 120, sportSessions: 2, runSessions: 1, gymRpeAvg: 7.6 },
      { week: 2, sleepAvgH: 6.9, sleepQualityAvg: 6.5, kcalAvg: 2700, kcalTargetAvg: 2600, mealCoverageDays: 6, waterAvgMl: 2250, energyAvg: null, stressAvg: 5.1, weightDeltaKg: 0.4, sportMinutes: 110, sportSessions: 2, runSessions: 1, gymRpeAvg: 7.9 },
      { week: 3, sleepAvgH: 6.7, sleepQualityAvg: 6, kcalAvg: 2720, kcalTargetAvg: 2650, mealCoverageDays: 5, waterAvgMl: 2200, energyAvg: null, stressAvg: 5.6, weightDeltaKg: 0.3, sportMinutes: 100, sportSessions: 2, runSessions: 1, gymRpeAvg: 8.1 },
      { week: 4, sleepAvgH: 6.5, sleepQualityAvg: 5.5, kcalAvg: 2690, kcalTargetAvg: 2650, mealCoverageDays: 5, waterAvgMl: 2150, energyAvg: null, stressAvg: 6.0, weightDeltaKg: 0.2, sportMinutes: 90, sportSessions: 2, runSessions: null, gymRpeAvg: 8.4 },
      { week: 5, sleepAvgH: 6.6, sleepQualityAvg: 6, kcalAvg: 2660, kcalTargetAvg: 2650, mealCoverageDays: 4, waterAvgMl: 2100, energyAvg: null, stressAvg: 5.8, weightDeltaKg: 0.1, sportMinutes: 100, sportSessions: 2, runSessions: 1, gymRpeAvg: 8.2 },
      { week: 6, sleepAvgH: 7.1, sleepQualityAvg: 7, kcalAvg: 2640, kcalTargetAvg: 2600, mealCoverageDays: 6, waterAvgMl: 2400, energyAvg: null, stressAvg: 5.0, weightDeltaKg: 0.1, sportMinutes: 100, sportSessions: 2, runSessions: null, gymRpeAvg: 6.4 },
    ],
    totals: {
      daysTotal: 42,
      sleepAvgH: 6.8,
      kcalAvg: 2680,
      // Never aggregated for this (older) run — the compare table shows "–" on this side.
      energyAvg: null,
      stressAvg: 5.4,
      weightChangeKg: 1.4,
      sportMinutes: 620,
      sportSessions: 12,
      runSessions: 4,
      mealCoverageDays: 32,
    },
  },
} satisfies import('@/data/train/trainApi').MesocycleReportResponse

// --- active workout (data.js:626-701; challenges 642-700) ---
export const workout: WorkoutPlan = {
  title: 'Pull Day',
  tag: 'Week 3 · MAV',
  durationEst: 78,
  overloadSummary: { weightUp: 2, repUp: 1, hold: 0 },
  exercises: [
    {
      id: 'ex1', name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound',
      warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 0, anchorWeightKg: null,
      sets: 5,
      rationale: 'Múlt hét 9 × 102.5 kg → +2.5 kg',
      prescribedSets: [
        { kind: 'warmup', targetWeightKg: 52.5, targetReps: 8, targetRIR: null },
        { kind: 'warmup', targetWeightKg: 80, targetReps: 3, targetRIR: null },
        { kind: 'working', targetWeightKg: 105, targetReps: 10, targetRIR: 0 },
        { kind: 'working', targetWeightKg: 105, targetReps: 10, targetRIR: 0 },
        { kind: 'working', targetWeightKg: 105, targetReps: 10, targetRIR: 0 },
      ],
      lastWeek: { weight: 102.5, reps: 9, rir: 2 },
      progression: { lever: 'weight', deltaKg: 2.5, deltaReps: null, targetWeightKg: 105, targetReps: 10, rationale: 'Múlt hét 9 × 102,5 kg → +2,5 kg' },
    },
    {
      id: 'ex2', name: 'Lat Pulldown · Pronated', muscle: 'back-wide', type: 'compound',
      warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, anchorWeightKg: null,
      sets: 5,
      imageStartUrl: '/exercises/lat-pulldown-pronated-a.jpg',
      imageEndUrl: '/exercises/lat-pulldown-pronated-b.jpg',
      rationale: 'Múlt hét 11 × 72 kg → +2.5 kg',
      prescribedSets: [
        { kind: 'warmup', targetWeightKg: 37.5, targetReps: 8, targetRIR: null },
        { kind: 'warmup', targetWeightKg: 55, targetReps: 3, targetRIR: null },
        { kind: 'working', targetWeightKg: 74.5, targetReps: 12, targetRIR: 1 },
        { kind: 'working', targetWeightKg: 74.5, targetReps: 12, targetRIR: 1 },
        { kind: 'working', targetWeightKg: 74.5, targetReps: 12, targetRIR: 1 },
      ],
      lastWeek: { weight: 72, reps: 11, rir: 2 },
      progression: { lever: 'weight', deltaKg: 2.5, deltaReps: null, targetWeightKg: 74.5, targetReps: 12, rationale: 'Múlt hét 11 × 72 kg → +2,5 kg' },
    },
    {
      id: 'ex3', name: 'Cable Pull-Around', muscle: 'back-mid', type: 'isolation',
      warmupSets: 1, workingSets: 3, repMin: 12, repMax: 15, targetRIR: 1, anchorWeightKg: null,
      sets: 4,
      rationale: 'Múlt hét 13 × 22 kg → cél 15 ism.',
      prescribedSets: [
        { kind: 'warmup', targetWeightKg: 15, targetReps: 4, targetRIR: null },
        { kind: 'working', targetWeightKg: 22, targetReps: 15, targetRIR: 1 },
        { kind: 'working', targetWeightKg: 22, targetReps: 15, targetRIR: 1 },
        { kind: 'working', targetWeightKg: 22, targetReps: 15, targetRIR: 1 },
      ],
      lastWeek: { weight: 22, reps: 13, rir: 1 },
      progression: { lever: 'rep', deltaKg: null, deltaReps: 1, targetWeightKg: 22, targetReps: 15, rationale: 'Múlt hét könnyen ment → +1 rep' },
    },
    {
      id: 'ex4', name: 'Hammer Curl', muscle: 'biceps-brachialis', type: 'isolation',
      warmupSets: 1, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, anchorWeightKg: null,
      sets: 4,
      imageStartUrl: '/exercises/hammer-curl-a.jpg',
      imageEndUrl: '/exercises/hammer-curl-b.jpg',
      rationale: 'Múlt hét 11 × 18 kg → cél 12 ism.',
      prescribedSets: [
        { kind: 'warmup', targetWeightKg: 12.5, targetReps: 4, targetRIR: null },
        { kind: 'working', targetWeightKg: 18, targetReps: 12, targetRIR: 1 },
        { kind: 'working', targetWeightKg: 18, targetReps: 12, targetRIR: 1 },
        { kind: 'working', targetWeightKg: 18, targetReps: 12, targetRIR: 1 },
      ],
      lastWeek: { weight: 18, reps: 11, rir: 1 },
    },
    {
      id: 'ex5', name: 'Face Pull', muscle: 'shoulder-rear', type: 'isolation',
      warmupSets: 1, workingSets: 3, repMin: 15, repMax: 20, targetRIR: 1, anchorWeightKg: null,
      sets: 4,
      rationale: 'Múlt hét 17 × 27 kg → cél 20 ism.',
      prescribedSets: [
        { kind: 'warmup', targetWeightKg: 20, targetReps: 4, targetRIR: null },
        { kind: 'working', targetWeightKg: 27, targetReps: 20, targetRIR: 1 },
        { kind: 'working', targetWeightKg: 27, targetReps: 20, targetRIR: 1 },
        { kind: 'working', targetWeightKg: 27, targetReps: 20, targetRIR: 1 },
      ],
      lastWeek: { weight: 27, reps: 17, rir: 1 },
    },
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
      why: 'Március 4 óta 102.5 a stabil ablak. Múlt heti RIR 2 + alacsony étvágy + 7.2h alvás — historikusan ezek a kombináció 3/4-szer +5kg-os emelést támogatott.',
      refs: [
        { kind: 'PR', label: 'Chest Row 105.8 · Márc 4' },
        { kind: 'Pattern', label: 'Alacsony étvágy + 7h+ alvás → PR window' },
      ],
      tools: [
        { type: 'read', name: 'get_pr_history(ex=chest_row)' },
        { type: 'compute', name: 'predictPRWindow()' },
      ],
      glory: 'Új csúcs · 8 hét óta első PR',
    },
    {
      id: 'ch-overload',
      type: 'overload',
      typeLabel: '⚡ Túlterhelés',
      exerciseId: 'ex1',
      exercise: 'Chest Supported Row',
      target: '107.5 kg × 8',
      confidence: null, // deterministic — renders "tanulom" (DC8)
      risk: 'low',
      why: 'A mai ajánlott terhelés: +2.5 kg a múlt heti 105-höz képest (RIR 2 stabil).',
      refs: [],
      glory: 'Teljesítsd a mai ajánlott terhelést.',
      targetWeightKg: 107.5,
      targetReps: 8,
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

// Saved custom (saját) workout templates — mock parity for the entry sheet/composer (mezo-ws2x).
export const customWorkoutsMock: CustomWorkout[] = [
  {
    id: 'custom-1',
    name: 'Pihenőnapi felső',
    exercises: [
      { id: 'cw1-1', name: 'Incline DB Press', muscle: 'chest-upper', warmupSets: 1, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' },
      { id: 'cw1-2', name: 'Lat Pulldown', muscle: 'back-wide', warmupSets: 1, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'compound' },
      { id: 'cw1-3', name: 'Lateral Raise', muscle: 'shoulder-side', warmupSets: 0, workingSets: 3, repMin: 12, repMax: 15, targetRIR: 1, type: 'isolation' },
    ],
  },
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
    { id: 'vb-2026-05-20', sport: 'volleyball', date: 'Máj 20 · Kedd', isoDate: '2026-05-20', time: '18:00', duration: 90, setsPlayed: 5, rounds: null, intensity: 7, rpe: 6.8, shoulderStrain: 6, jumpCount: 38, notes: 'Smashek tisztábbak, jobb váll után érzem délután' },
    { id: 'vb-2026-05-18', sport: 'volleyball', date: 'Máj 18 · Szo', isoDate: '2026-05-18', time: '10:00', duration: 120, setsPlayed: 6, rounds: null, intensity: 8, rpe: 7.2, shoulderStrain: 7, jumpCount: 52, notes: 'Hosszú meccs · maradt erő utána' },
    { id: 'vb-2026-05-15', sport: 'volleyball', date: 'Máj 15 · Csü', isoDate: '2026-05-15', time: '19:30', duration: 90, setsPlayed: 4, rounds: null, intensity: 7, rpe: 6.5, shoulderStrain: 5, jumpCount: 31, notes: null },
    { id: 'vb-2026-05-13', sport: 'volleyball', date: 'Máj 13 · Kedd', isoDate: '2026-05-13', time: '18:00', duration: 90, setsPlayed: 5, rounds: null, intensity: 7, rpe: 6.9, shoulderStrain: 6, jumpCount: 35, notes: null },
    { id: 'vb-2026-05-11', sport: 'volleyball', date: 'Máj 11 · Szo', isoDate: '2026-05-11', time: '10:00', duration: 120, setsPlayed: 6, rounds: null, intensity: 8, rpe: 7.5, shoulderStrain: 8, jumpCount: 48, notes: 'Sok smash · vasárnap pihentem' },
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
  { id: 'exl-1', name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound', stim: 0.92, fatigue: 0.55, videoUrl: 'https://youtu.be/GZTvxN5fPBc', editable: false },
  { id: 'exl-2', name: 'Lat Pulldown · Pronated', muscle: 'back-wide', type: 'compound', stim: 0.84, fatigue: 0.4, imageStartUrl: '/exercises/lat-pulldown-pronated-a.jpg', imageEndUrl: '/exercises/lat-pulldown-pronated-b.jpg' },
  { id: 'exl-3', name: 'Lat Pulldown · Neutral', muscle: 'back-wide', type: 'compound', stim: 0.82, fatigue: 0.4 },
  { id: 'exl-4', name: 'T-Bar Row', muscle: 'back-mid', type: 'compound', stim: 0.88, fatigue: 0.65, imageStartUrl: '/exercises/t-bar-row-a.jpg', imageEndUrl: '/exercises/t-bar-row-b.jpg' },
  { id: 'exl-5', name: 'Cable Pull-Around', muscle: 'back-mid', type: 'isolation', stim: 0.72, fatigue: 0.25 },
  { id: 'exl-6', name: 'Hammer Curl', muscle: 'biceps-brachialis', type: 'isolation', stim: 0.68, fatigue: 0.2 },
  { id: 'exl-7', name: 'Incline DB Curl', muscle: 'biceps-long', type: 'isolation', stim: 0.74, fatigue: 0.22 },
  { id: 'exl-8', name: 'Face Pull', muscle: 'shoulder-rear', type: 'isolation', stim: 0.7, fatigue: 0.18 },
  { id: 'exl-9', name: 'Reverse Pec Deck', muscle: 'shoulder-rear', type: 'isolation', stim: 0.66, fatigue: 0.18 },
  { id: 'exl-10', name: 'Barbell Bench Press', muscle: 'chest-mid', type: 'compound', stim: 0.94, fatigue: 0.7 },
  { id: 'exl-11', name: 'Incline DB Press', muscle: 'chest-upper', type: 'compound', stim: 0.86, fatigue: 0.5 },
  { id: 'exl-12', name: 'Cable Fly', muscle: 'chest-mid', type: 'isolation', stim: 0.74, fatigue: 0.25 },
  { id: 'exl-13', name: 'Overhead Press', muscle: 'shoulder-front', type: 'compound', stim: 0.86, fatigue: 0.55 },
  { id: 'exl-14', name: 'Lateral Raise', muscle: 'shoulder-side', type: 'isolation', stim: 0.72, fatigue: 0.2 },
  { id: 'exl-15', name: 'Tricep Pushdown', muscle: 'triceps-medial', type: 'isolation', stim: 0.7, fatigue: 0.2 },
  { id: 'exl-16', name: 'Overhead Tricep Ext', muscle: 'triceps-long', type: 'isolation', stim: 0.74, fatigue: 0.22 },
  { id: 'exl-17', name: 'Barbell Squat', muscle: 'quad', type: 'compound', stim: 0.94, fatigue: 0.85 },
  { id: 'exl-18', name: 'Leg Press', muscle: 'quad', type: 'compound', stim: 0.84, fatigue: 0.6 },
  { id: 'exl-19', name: 'Romanian Deadlift', muscle: 'ham', type: 'compound', stim: 0.9, fatigue: 0.75 },
  { id: 'exl-20', name: 'Leg Curl', muscle: 'ham', type: 'isolation', stim: 0.74, fatigue: 0.25 },
  { id: 'exl-21', name: 'Hip Thrust', muscle: 'glute', type: 'compound', stim: 0.86, fatigue: 0.55 },
]

// --- planner presets (meso-planner.jsx GOAL_PRESETS + SPLITS) ---
export const GOAL_PRESETS: GoalPreset[] = [
  { id: 'hypertrophy', label: 'Hypertrophy', sub: 'Izomtömeg építés', defaultWeeks: 6, split: 'Pull / Push / Legs', days: 5, style: 'RP', phaseTemplate: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'], color: 'var(--coral)', icon: 'train', description: 'Volumen-driven · MAV/MRV progresszió · klasszikus RP hypertrophy blokk' },
  { id: 'strength', label: 'Strength', sub: '1RM növelés', defaultWeeks: 7, split: 'Upper / Lower', days: 4, style: 'Linear', phaseTemplate: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'MRV', 'Deload'], color: 'var(--info, var(--coral))', icon: 'train', description: 'Intenzitás-driven · 3-6 reps · alacsonyabb volumen · hosszabb pihenő' },
  { id: 'cut-prep', label: 'Pre-cut prep', sub: 'Karbantartás · zsírvesztés előtt', defaultWeeks: 3, split: 'Full body', days: 4, style: 'Maintenance', phaseTemplate: ['MAV', 'MAV', 'MAV'], color: 'var(--warning)', icon: 'fuel', description: 'Volumen-tartás · izom-megőrzés · deficit nélkül' },
  { id: 'recovery', label: 'Recovery', sub: 'Niggle után · újraépítés', defaultWeeks: 4, split: 'Custom', days: 3, style: 'Rehab', phaseTemplate: ['MEV', 'MEV', 'MAV', 'MAV'], color: 'var(--anchor-accent, var(--cat-preference))', icon: 'anchor', description: 'Isoláció-fokú · alacsony fatigue · niggle-aware substitúció' },
  { id: 'sport', label: 'Sport-specific', sub: 'Volleyball-driven blokk', defaultWeeks: 5, split: 'Upper / Lower / Sport', days: 5, style: 'Conjugate', phaseTemplate: ['MEV', 'MAV', 'MAV', 'MRV', 'Deload'], color: 'var(--cat-tendency)', icon: 'today', description: 'Vertikális teljesítmény · vállstabilitás · plyo-integráció' },
  { id: 'erohipertrofia', label: 'Erő-Hipertrófia', sub: '6-8 rep · failure', defaultWeeks: 6, split: 'Láb+Plyo / Felső', days: 4, style: 'RP', phaseTemplate: ['MEV', 'MAV', 'MAV', 'MRV', 'MRV', 'Deload'], color: 'var(--coral)', icon: 'train', description: 'Kevés gyakorlat · 6-8 rep RIR 0 · plyo-vezérelt láb + felső' },
]
export const SPLITS: SplitOption[] = [
  { label: 'Pull / Push / Legs', days: [4, 5, 6], best: 'hypertrophy' },
  { label: 'Upper / Lower', days: [3, 4], best: 'strength' },
  { label: 'Full body', days: [3, 4, 5], best: 'cut-prep' },
  { label: 'Upper / Lower / Sport', days: [4, 5], best: 'sport' },
  { label: 'Láb+Plyo / Felső', days: [4], best: 'erohipertrofia' },
  { label: 'Custom split', days: [3, 4, 5, 6], best: null },
]

// Done-day review fixture (mock mode) — lets /train/review/:id render offline.
// Each ExerciseSetResponse carries the required `skipped` flag (contract: default
// false, but the generated type keeps it required).
// mock timing (mezo-1jm8): minutesAgo(74)..minutesAgo(3) is a plain, honest overrun (71 measured
// vs the 62 estimated) — the mock's main fixture exercises the combined "terv ~62 · tény 71 perc"
// render branch (WorkoutSummary), which real mode almost never shows since `duration_est` has no
// writer there.
const minutesAgo = (n: number): string => new Date(Date.now() - n * 60_000).toISOString()

export const workoutDetailMock = {
  id: 'wd-mock-1',
  templateSessionId: 'ts-mock-1',
  date: new Date().toISOString().slice(0, 10),
  status: 'completed',
  title: 'Pull Day',
  dayLabel: 'Hét',
  durationEst: 62,
  startedAt: minutesAgo(74),
  finishedAt: minutesAgo(3),
  activeSeconds: 3300,
  // The workout-level closing note (mezo-d20.8.2.2). Seeded HERE and deliberately NOT on
  // workoutDetailPrevMock: stepping back to the reference must reach a session with no note, so
  // the `＋ Jegyzet ehhez az edzéshez` path is reachable offline too.
  note: 'Öt órát aludtam, mégis vitt a lendület. A húzódzkodás az utolsó szettnél fogyott el.',
  exercises: [
    {
      exerciseId: 'ex0', name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound',
      warmupSets: 2, workingSets: 3, repMin: 6, repMax: 9, targetRIR: 1, skipped: false,
      sets: [
        { id: 's1', exerciseId: 'ex0', setIndex: 0, weightKg: 60, reps: 10, kind: 'warmup', skipped: false },
        { id: 's2', exerciseId: 'ex0', setIndex: 1, weightKg: 80, reps: 8, rir: 2, kind: 'working', skipped: false },
        { id: 's3', exerciseId: 'ex0', setIndex: 2, weightKg: 85, reps: 8, rir: 1, kind: 'working', skipped: false },
      ],
    },
    {
      exerciseId: 'ex1', name: 'Lat Pulldown', muscle: 'back-wide', type: 'compound',
      warmupSets: 1, workingSets: 3, repMin: 8, repMax: 12, targetRIR: 1, skipped: true, sets: [],
    },
  ],
} satisfies import('@/data/train/trainApi').WorkoutDetailResponse

// The template-day chain behind the review page's comparison and stepping (mezo-d20.8.2.1).
// Mock mode has no persisted instances, so the chain is seeded: three completed instances of
// the SAME template day (ts-mock-1), two weeks apart, date-ascending.
const chainDate = (weeksBack: number): string => {
  const d = new Date()
  d.setDate(d.getDate() - weeksBack * 14)
  return d.toISOString().slice(0, 10)
}

export const workoutChainMock = [
  { id: 'wd-mock-first', templateSessionId: 'ts-mock-1', date: chainDate(2), status: 'completed', origin: 'meso', title: 'Pull Day' },
  { id: 'wd-mock-prev', templateSessionId: 'ts-mock-1', date: chainDate(1), status: 'completed', origin: 'meso', title: 'Pull Day' },
  { id: workoutDetailMock.id, templateSessionId: 'ts-mock-1', date: workoutDetailMock.date, status: 'completed', origin: 'meso', title: 'Pull Day' },
] satisfies import('@/data/train/trainApi').WorkoutSummaryResponse[]

// The reference instance's detail. Deliberately NOT a copy of workoutDetailMock: a comparison
// against itself would show ±0 everywhere and prove nothing about the tone rule. This one is
// heavier in volume, lighter in RIR terms and carries no TARGET medal, so the tile reads
// "volumen down (neutral) · célszett up (sage) · Ø RIR down (neutral)" — the whole ADR 0010
// point on one screen.
// Auto-closed (abandoned) scenario (mezo-1jm8): startedAt present, finishedAt deliberately
// ABSENT even though status is 'completed' — actualMinutes then falls back to activeSeconds
// (50 measured vs the 58 estimated), exercising the fallback render branch offline.
export const workoutDetailPrevMock = {
  id: 'wd-mock-prev',
  templateSessionId: 'ts-mock-1',
  date: chainDate(1),
  status: 'completed',
  title: 'Pull Day',
  dayLabel: 'Hét',
  durationEst: 58,
  startedAt: minutesAgo(65),
  activeSeconds: 3000,
  exercises: [
    {
      exerciseId: 'ex0', name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound',
      warmupSets: 2, workingSets: 3, repMin: 6, repMax: 9, targetRIR: 1, skipped: false,
      sets: [
        { id: 'p1', exerciseId: 'ex0', setIndex: 0, weightKg: 60, reps: 10, kind: 'warmup', skipped: false },
        { id: 'p2', exerciseId: 'ex0', setIndex: 1, weightKg: 80, reps: 9, rir: 3, kind: 'working', skipped: false },
        { id: 'p3', exerciseId: 'ex0', setIndex: 2, weightKg: 80, reps: 9, rir: 2, kind: 'working', skipped: false },
      ],
    },
    {
      exerciseId: 'ex1', name: 'Lat Pulldown', muscle: 'back-wide', type: 'compound',
      warmupSets: 1, workingSets: 3, repMin: 8, repMax: 12, targetRIR: 1, skipped: false,
      sets: [
        { id: 'p4', exerciseId: 'ex1', setIndex: 0, weightKg: 55, reps: 11, rir: 3, kind: 'working', skipped: false },
      ],
    },
  ],
} satisfies import('@/data/train/trainApi').WorkoutDetailResponse

// The chain-opening instance: nothing precedes it, so the review page renders NEITHER the
// comparison tile NOR an "Előzőleg" cell for it. It exists in the seed precisely so that
// honest-absence state is reachable offline (and in the tests) rather than only in theory.
// Backfilled-history scenario (mezo-1jm8): no timing at all — startedAt/finishedAt/activeSeconds
// are absent on rows created before this feature. actualMinutes returns null, so the review page
// falls back to the pre-existing durationMin-only render branch, unchanged.
export const workoutDetailFirstMock = {
  ...workoutDetailPrevMock,
  id: 'wd-mock-first',
  date: chainDate(2),
  durationEst: 54,
  startedAt: undefined,
  finishedAt: undefined,
  activeSeconds: undefined,
} satisfies import('@/data/train/trainApi').WorkoutDetailResponse

/** Mock-mode detail lookup; anything not listed falls back to the one review fixture. */
export const workoutDetailsMock: Record<string, import('@/data/train/trainApi').WorkoutDetailResponse> = {
  [workoutDetailMock.id]: workoutDetailMock,
  [workoutDetailPrevMock.id]: workoutDetailPrevMock,
  [workoutDetailFirstMock.id]: workoutDetailFirstMock,
}
