import type {
  Briefing,
  FuelSlot,
  TodayMeta,
  UserMeta,
  VolleyballSession,
  Workout,
} from './types'

export const today: TodayMeta = {
  dayLabel: 'Csütörtök',
  dateLabel: 'Máj 22',
  workoutType: 'Pull Day',
  workoutTime: '07:30',
  retaDay: 3,
  mesoPhase: 'MAV',
}

export const user: UserMeta = {
  weekInMeso: 3,
  dayInWeek: 4,
  mesoLabel: 'Hypertrophy 04 · Tavasz',
}

export const briefing: Briefing = {
  eyebrow: 'Reggeli briefing · 06:30',
  body: [
    {
      type: 'p',
      text: 'Jó reggelt — Week 3, Day 4, és érzed a tempót. Tegnap Push Day-en a Lat Pulldown 105 kg × 9 ment RIR 1-re, a Reta beadás óta vagyunk 72h-nál, étvágy ma még magas lesz.',
    },
    {
      type: 'p',
      text: 'Ma Pull Day, és a Chest Supported Row 105.8 kg PR-t március óta húzzuk magunk után. Ma megdönthetjük 5 kg-mal — múlt héten 102.5 × 9 @ RIR 2 volt, és a hátunk pumpája akkor friss volt.',
    },
    {
      type: 'p',
      text: 'Egy dolog: 18:00 volleyball után 2 órán belül lesz az utolsó étkezés. Próbáljuk a vacsorát 21:30 előtt becsukni — péntek reggeli RPE-re közvetlen hatással van.',
    },
  ],
  refs: [
    { kind: 'Workout', id: 'w-2026-05-21', label: 'Push Day · Tegnap' },
    { kind: 'PR', id: 'pr-2026-03-04', label: 'Chest Row 105.8 · Márc 4' },
    { kind: 'Pattern', id: 'p-late-carb-sleep', label: 'Késő szénhidrát ↔ alvás' },
    { kind: 'Medication', id: 'reta-2026-05-19', label: 'Reta · Hétfő' },
  ],
  confidence: 0.88,
}

export const briefingVariants: {
  good: Partial<Briefing>
  medium: null
  rough: Partial<Briefing>
} = {
  good: {
    eyebrow: 'Reggeli briefing · 06:30',
    tone: 'energetic',
    body: [
      {
        type: 'p',
        text: 'Jó reggelt — két napja 8.2h alvás, a HRV szépen ül, és a péntek volleyball után stabilan vagyunk. Ma Pull Day, és **azt érzem hogy ma jön egy PR**.',
      },
      {
        type: 'p',
        text: 'Chest Supported Row a következő logikus emelés: 105.8 kg óta vártuk, ma mehet a 110 — de csak ha az első warm-up szet könnyű.',
      },
    ],
    confidence: 0.92,
  },
  medium: null,
  rough: {
    eyebrow: 'Reggeli check · 06:45',
    tone: 'supportive',
    body: [
      {
        type: 'p',
        text: 'Tegnap éjszaka 5.2h volt, és ezen a héten ez a harmadik ilyen. Nem leszek annál a Pull Day-nél amit terveztünk, és ezt most te is érzed.',
      },
      {
        type: 'p',
        text: '**Maradjunk a horgonyoknál ma**: víz, egy fehérje-étkezés, és egy 10 perces sétálás. A volleyball-t kihagyhatjuk — nem büntetés, hanem értelmes válasz.',
      },
    ],
    confidence: 0.94,
  },
}

export const workout: Workout = {
  title: 'Pull Day',
  tag: 'Week 3 · MAV',
  durationEst: 78,
  exercises: [
    { id: 'ex1', name: 'Chest Supported Row', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound', muscle: 'back-mid' },
    { id: 'ex2', name: 'Lat Pulldown · Pronated', sets: 3, targetReps: '10-12', targetRIR: 2, type: 'compound', muscle: 'lats' },
    { id: 'ex3', name: 'Cable Pull-Around', sets: 3, targetReps: '12-15', targetRIR: 1, type: 'isolation', muscle: 'back-mid' },
    { id: 'ex4', name: 'Hammer Curl', sets: 3, targetReps: '10-12', targetRIR: 1, type: 'isolation', muscle: 'biceps' },
    { id: 'ex5', name: 'Face Pull', sets: 3, targetReps: '15-20', targetRIR: 1, type: 'isolation', muscle: 'rear-delt' },
  ],
  niggleWarning: {
    muscle: 'right-shoulder',
    muscleLabel: 'Jobb váll',
    detail: 'Március 18 óta enyhe niggle. Múlt héten szépen érezhető lett, ezért a Cable Pull-Around-ot előrébb hozzuk és a Lat Pulldown-nál pronated griffel megyünk (csukló kíméletesebb).',
  },
}

export const volleyballSessions: VolleyballSession[] = [
  { day: 'Hét', time: '18:15', duration: 90, court: 'BVSC csarnok', intensity: 'közepes', role: 'edzés' },
  { day: 'Kedd', time: '17:00', duration: 90, court: 'BVSC csarnok', intensity: 'közepes', role: 'edzés' },
  { day: 'Sze', time: '18:15', duration: 90, court: 'BVSC csarnok', intensity: 'közepes', role: 'edzés' },
  { day: 'Pén', time: '18:15', duration: 90, court: 'BVSC csarnok', intensity: 'közepes', role: 'edzés' },
  { day: 'Szo', time: '10:00', duration: 120, court: 'Kőbánya Sport', intensity: 'magas', role: 'meccs/scrim' },
]

export const fuelToday: { slots: FuelSlot[] } = {
  slots: [
    {
      time: '05:50',
      kind: 'wake',
      label: 'Ébresztő',
      state: 'done',
      items: [{ done: true }, { done: true }],
    },
    {
      time: '06:20',
      kind: 'snack',
      label: 'Pre-workout snack',
      state: 'done',
      mealName: 'Banán + 20g whey · vízben',
      mezoNote: 'T-70p gym előtt · gyors-szénhidrát + protein az aminósav-rendelkezésre álláshoz. Reta D3 reggel az étvágy még magas — könnyen lemegy.',
      items: [],
    },
    {
      time: '06:50',
      kind: 'preworkout',
      label: 'Pre-workout stack',
      state: 'done',
      mezoNote: 'Reggeli stack · koffein már a wake-időben volt (kávé), AAKG 30 perccel a gym előtt. Pull Day-en a pump segít a Chest Row PR-attempt-en.',
      items: [{ done: true }, { done: true }],
    },
    {
      time: '07:30',
      kind: 'workout',
      label: 'Pull Day · gym',
      state: 'done',
    },
    {
      time: '09:15',
      kind: 'meal',
      label: 'Reggeli · post-workout',
      state: 'done',
      mealName: 'Túrós zabkása · áfonyával',
      mezoNote: 'Post-workout ablakban · slow-release C + komplett protein. A pre-workout snack az anyagcserét bekapcsolta, most a glikogén-pótlás megy.',
      items: [],
    },
    {
      time: '12:00',
      kind: 'midday',
      label: 'Délutáni stack',
      state: 'done',
      items: [{ done: true }, { done: true }],
    },
    {
      time: '13:00',
      kind: 'meal',
      label: 'Ebéd',
      state: 'done',
      mealName: 'Csirke + édesburgonya + spenót',
      mezoNote: 'Whole-foods ebéd · mikrótápanyag-density a hét egyik legjobbja.',
      items: [],
    },
    {
      time: '16:00',
      kind: 'snack',
      label: 'Délutáni snack',
      state: 'now',
      mealName: 'Túró · áfonya · méz quick',
      mezoNote: 'Casein-súlyos snack · 220g/nap protein-target tartására. Reta D3 délután az étvágy lefelé indul, ez egy könnyen lemenő opció.',
      items: [],
    },
    {
      time: '19:00',
      kind: 'meal',
      label: 'Vacsora',
      state: 'pending',
      mealName: 'Lazac + barna rizs + brokkoli (tervezett)',
      mezoNote: 'Omega-3 vacsora · 21:30 kitchen close előtt. Csü nincs volleyball · sleep onset előrébb hozható.',
      items: [],
    },
    {
      time: '21:00',
      kind: 'evening',
      label: 'Esti stack',
      state: 'pending',
      mezoNote: 'Pattern P2 megerősítve · 21:00 magnézium → első deep sleep ciklus tisztább.',
      items: [{ done: false }, { done: false }],
    },
  ],
}
