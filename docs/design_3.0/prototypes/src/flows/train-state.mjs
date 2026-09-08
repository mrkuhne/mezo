export const DAYS = [
  "Hétfő",
  "Kedd",
  "Szerda",
  "Csütörtök",
  "Péntek",
  "Szombat",
  "Vasárnap",
];
export const EXERCISES = [
  {
    id: "bench",
    name: "Fekvenyomás rúddal",
    muscle: "Mell",
    equipment: "gym",
    asset: "barbell-bench-press",
    best: "65 kg × 8",
    sessions: 18,
    cues: [
      "Talpak stabilan a talajon.",
      "Lapockák a padon, kontrollált leengedés.",
      "Nyomj egyenletesen, a törzs maradjon stabil.",
    ],
  },
  {
    id: "pulldown",
    name: "Lehúzás felső csigán",
    muscle: "Hát",
    equipment: "gym",
    asset: "lat-pulldown-neutral",
    best: "55 kg × 10",
    sessions: 22,
    cues: [
      "Stabil ülés, mellkas enyhén kiemelve.",
      "A könyököt vezesd lefelé, ne lendületből húzz.",
      "Lassan engedd vissza a kart.",
    ],
  },
  {
    id: "squat",
    name: "Guggolás rúddal",
    muscle: "Láb",
    equipment: "gym",
    asset: "barbell-squat",
    best: "80 kg × 6",
    sessions: 16,
    cues: [
      "Stabil, kényelmes terpesz.",
      "Csípő és térd együtt hajlik.",
      "A talp egészén támaszkodva emelkedj fel.",
    ],
  },
  {
    id: "rdl",
    name: "Román felhúzás",
    muscle: "Láb",
    equipment: "home",
    asset: "romanian-deadlift",
    best: "60 kg × 10",
    sessions: 12,
    cues: [
      "A térd enyhén hajlított.",
      "A csípőt told hátra, a súly maradjon közel.",
      "Kontrolláltan térj vissza állásba.",
    ],
  },
  {
    id: "raise",
    name: "Oldalemelés",
    muscle: "Váll",
    equipment: "home",
    asset: "lateral-raise",
    best: "8 kg × 14",
    sessions: 24,
    cues: [
      "Kis súllyal, enyhén hajlított könyökkel indulj.",
      "Emelj kontrolláltan vállmagasságig.",
      "Lassan engedd vissza, ne lendíts.",
    ],
  },
  {
    id: "row",
    name: "Evezés ülve",
    muscle: "Hát",
    equipment: "gym",
    asset: "seated-cable-row-neutral",
    best: "50 kg × 12",
    sessions: 14,
    cues: [
      "Stabil törzs, kényelmes ülés.",
      "A könyököt vezesd hátra a törzs mellett.",
      "Kontrolláltan engedd előre a kart.",
    ],
  },
  {
    id: "dbpress",
    name: "Nyomás kézisúlyzóval",
    muscle: "Mell",
    equipment: "home",
    asset: "db-bench-press",
    best: "22 kg × 10",
    sessions: 10,
    cues: [
      "A talp és a hát stabilan támaszkodik.",
      "A csukló a könyök felett marad.",
      "Egyenletesen engedd le és nyomd fel a súlyt.",
    ],
  },
];
const clone = (value) => JSON.parse(JSON.stringify(value));
const uid = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const finite = (value, min, max) =>
  Number.isFinite(Number(value)) &&
  Number(value) >= min &&
  Number(value) <= max;
const dateValid = (d) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d || "") && !Number.isNaN(Date.parse(d));
export function buildMesoDraft(input) {
  if (
    !finite(input.frequency, 2, 5) ||
    !Number.isInteger(Number(input.frequency))
  )
    throw Error("Válassz heti 2–5 edzést.");
  const frequency = Number(input.frequency),
    equipment = input.equipment || "gym",
    goal = input.goal || "muscle",
    sportLoad = input.sportLoad || "medium";
  const pool = EXERCISES.filter(
    (e) => equipment === "gym" || e.equipment === "home",
  );
  const dayIndices = {
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 5],
    5: [0, 1, 3, 4, 5],
  }[frequency];
  return {
    title:
      goal === "strength"
        ? "Erő, biztos alapokon"
        : goal === "balance"
          ? "Erő és szabad mozgás"
          : "Építkező hetek",
    goal,
    frequency,
    equipment,
    sportLoad,
    weeks: Number(input.weeks) || 6,
    currentWeek: 1,
    status: "draft",
    days: dayIndices.map((day, i) => ({
      id: `day-${i}`,
      day,
      name:
        frequency <= 3
          ? `Teljes test ${String.fromCharCode(65 + i)}`
          : ["Húzás", "Nyomás", "Láb", "Felsőtest", "Teljes test"][i],
      duration: sportLoad === "high" ? 40 : 55,
      exercises: Array.from({ length: Math.min(4, pool.length) }, (_, j) => ({
        id: pool[(i + j) % pool.length].id,
        sets: sportLoad === "high" ? 2 : 3,
        reps: goal === "strength" ? 6 : 10,
      })),
    })),
  };
}
export function editDraftExercise(draft, dayId, exerciseId, changes) {
  if (
    changes.sets !== undefined &&
    (!finite(changes.sets, 1, 6) || !Number.isInteger(Number(changes.sets)))
  )
    throw Error("1–6 sorozat adható meg.");
  if (changes.reps !== undefined && !finite(changes.reps, 1, 30))
    throw Error("1–30 ismétlés adható meg.");
  return {
    ...draft,
    days: draft.days.map((d) =>
      d.id === dayId
        ? {
            ...d,
            exercises: d.exercises.map((e) =>
              e.id === exerciseId
                ? {
                    ...e,
                    ...changes,
                    sets: Number(changes.sets ?? e.sets),
                    reps: Number(changes.reps ?? e.reps),
                  }
                : e,
            ),
          }
        : d,
    ),
  };
}
export function activateDraft(state, id = uid("cycle")) {
  if (!state.draft || !state.draft.days.length)
    throw Error("Előbb készíts egy tervet.");
  return {
    ...state,
    draft: null,
    cycles: [
      { ...clone(state.draft), id, status: "active" },
      ...state.cycles.map((c) =>
        c.status === "active" ? { ...c, status: "archived" } : c,
      ),
    ],
  };
}
export function saveSportSlot(state, input) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time || ""))
    throw Error("Adj meg érvényes időpontot.");
  if (!finite(input.duration, 5, 300))
    throw Error("Az időtartam 5–300 perc lehet.");
  if (
    !finite(input.day, 0, 6) ||
    !["Röplabda", "TRX", "Cross"].includes(input.sport)
  )
    throw Error("Válassz napot és sportot.");
  const slot = {
    ...input,
    id: input.id || uid("slot"),
    duration: Number(input.duration),
    day: Number(input.day),
  };
  return {
    ...state,
    schedule: [...state.schedule.filter((x) => x.id !== slot.id), slot].sort(
      (a, b) => a.day - b.day || a.time.localeCompare(b.time),
    ),
  };
}
export function logSport(state, input) {
  if (!finite(input.duration, 1, 600))
    throw Error("Az időtartam 1–600 perc lehet.");
  if (!finite(input.rpe, 1, 10)) throw Error("Az erőkifejtés 1–10 lehet.");
  if (!dateValid(input.date)) throw Error("Adj meg érvényes dátumot.");
  if (
    input.slotId &&
    state.sportLogs.some(
      (x) => x.slotId === input.slotId && x.date === input.date,
    )
  )
    throw Error("Ezt az alkalmat már naplóztad.");
  return {
    ...state,
    sportLogs: [
      {
        ...input,
        id: input.id || uid("sportlog"),
        duration: Number(input.duration),
        rpe: Number(input.rpe),
      },
      ...state.sportLogs,
    ],
  };
}
export function buildRunPlan(input) {
  if (
    !finite(input.frequency, 2, 3) ||
    !Number.isInteger(Number(input.frequency)) ||
    !finite(input.minutes, 15, 90) ||
    !finite(input.weeks, 2, 8)
  )
    throw Error("Heti 2–3 alkalom, 15–90 perc és 2–8 hét választható.");
  const titles = [
    "Könnyű, beszélgetős futás",
    "Ritmusváltás",
    "Hosszabb, laza kör",
  ];
  const rounds = Math.min(6, Math.floor((Number(input.minutes) - 8) / 2));
  return {
    title:
      input.goal === "5k" ? "Magabiztos 5 kilométer" : "Könnyed állóképesség",
    goal: input.goal,
    weeks: Number(input.weeks),
    currentWeek: 1,
    status: "draft",
    sessions: Array.from({ length: Number(input.frequency) }, (_, i) => ({
      id: `session-${i}`,
      name: titles[i],
      day: [3, 6, 1][i],
      duration: Number(input.minutes) + (i === 2 ? 10 : 0),
      intervals:
        i === 1
          ? [
              { label: "Bemelegítés", minutes: 5 },
              {
                label: `${rounds} × 1 perc élénk / 1 perc séta`,
                minutes: rounds * 2,
              },
              {
                label: "Levezetés",
                minutes: Number(input.minutes) - 5 - rounds * 2,
              },
            ]
          : [
              {
                label: "Kényelmes futás / séta",
                minutes: Number(input.minutes) + (i === 2 ? 10 : 0),
              },
            ],
    })),
  };
}
export function activateRunPlan(state, plan, id = uid("runplan")) {
  return {
    ...state,
    runDraft: null,
    runPlans: [
      { ...clone(plan), id, status: "active" },
      ...state.runPlans.map((p) => ({ ...p, status: "archived" })),
    ],
  };
}
export function logRun(state, input) {
  if (!finite(input.distance, 0.1, 100)) throw Error("A táv 0,1–100 km lehet.");
  if (!finite(input.duration, 1, 600) || !finite(input.rpe, 1, 10))
    throw Error("Adj meg érvényes időtartamot és erőkifejtést.");
  if (!dateValid(input.date)) throw Error("Adj meg érvényes dátumot.");
  if (
    state.runLogs.some(
      (x) =>
        input.sessionId &&
        x.planId === input.planId &&
        x.sessionId === input.sessionId &&
        x.date === input.date,
    )
  )
    throw Error("Ezt a futást már naplóztad.");
  const paceSeconds = Math.round(
    (Number(input.duration) * 60) / Number(input.distance),
  );
  const log = {
    ...input,
    id: input.id || uid("runlog"),
    distance: Number(input.distance),
    duration: Number(input.duration),
    rpe: Number(input.rpe),
    pace: `${Math.floor(paceSeconds / 60)}:${String(paceSeconds % 60).padStart(2, "0")}`,
  };
  return { ...state, runLogs: [log, ...state.runLogs] };
}
export function crossLoad(state) {
  const sport = state.sportLogs
    .filter((x) => x.date >= "2026-09-07" && x.date <= "2026-09-13")
    .reduce((n, x) => n + x.duration * x.rpe, 0);
  const running = state.runLogs
    .filter((x) => x.date >= "2026-09-07" && x.date <= "2026-09-13")
    .reduce((n, x) => n + x.duration * x.rpe, 0);
  return { gym: 280, sport, running, total: 280 + sport + running };
}
const normalize = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function searchExercises(query = "", muscle = "all") {
  return EXERCISES.filter(
    (e) =>
      (muscle === "all" || e.muscle === muscle) &&
      normalize(`${e.name} ${e.muscle}`).includes(normalize(query)),
  );
}
export function createTrainState() {
  const cycle = buildMesoDraft({
    goal: "muscle",
    frequency: 3,
    equipment: "gym",
    sportLoad: "medium",
    weeks: 6,
  });
  return {
    draft: null,
    cycles: [
      {
        ...cycle,
        id: "cycle-current",
        title: "Erős alapok · ősz",
        status: "active",
        currentWeek: 3,
      },
    ],
    schedule: [
      {
        id: "sport-tue",
        day: 1,
        sport: "Röplabda",
        time: "19:00",
        duration: 75,
        location: "Városmajor",
      },
      {
        id: "sport-wed",
        day: 2,
        sport: "Röplabda",
        time: "18:30",
        duration: 60,
        location: "Sportközpont",
      },
      {
        id: "sport-sat",
        day: 5,
        sport: "TRX",
        time: "10:00",
        duration: 40,
        location: "Margitsziget",
      },
    ],
    sportLogs: [
      {
        id: "sport-history",
        sport: "TRX",
        date: "2026-09-07",
        duration: 35,
        rpe: 5,
        notes: "Kellemes átmozgatás, jólesett a végén a nyújtás.",
      },
      {
        id: "sport-history2",
        sport: "Röplabda",
        date: "2026-09-05",
        duration: 80,
        rpe: 7,
        notes: "Sok hosszú labdamenet. A végére elfáradt a vállam.",
      },
    ],
    runDraft: null,
    runPlans: [
      {
        ...buildRunPlan({ goal: "5k", frequency: 2, minutes: 30, weeks: 6 }),
        id: "run-current",
        status: "active",
        currentWeek: 2,
      },
    ],
    runLogs: [
      {
        id: "run-history",
        planId: "run-current",
        sessionId: "session-0",
        date: "2026-09-07",
        distance: 4.1,
        duration: 29,
        rpe: 4,
        pace: "7:04",
        notes: "Beszélgetős kör a szigeten. Jólesett lassítani.",
      },
    ],
    favorites: ["pulldown", "bench"],
    medals: [
      {
        id: "medal-bench",
        name: "Új súlyrekord",
        exerciseId: "bench",
        value: 65,
        target: 65,
        unit: "kg",
        previous: "62,5 kg",
        date: "2026-09-04",
        earned: true,
      },
      {
        id: "medal-pull",
        name: "Tíz tiszta ismétlés",
        exerciseId: "pulldown",
        value: 10,
        target: 10,
        unit: "ismétlés",
        previous: "8 ismétlés · 55 kg",
        date: "2026-09-02",
        earned: true,
      },
      {
        id: "medal-squat",
        name: "Következő súlylépcső",
        exerciseId: "squat",
        value: 80,
        target: 85,
        unit: "kg",
        earned: false,
      },
    ],
    gymHistory: [
      {
        id: "gym-1",
        name: "Teljes test A",
        date: "2026-09-07",
        duration: 48,
        sets: 12,
        volume: "3 240",
      },
      {
        id: "gym-2",
        name: "Teljes test C",
        date: "2026-09-04",
        duration: 52,
        sets: 12,
        volume: "3 680",
      },
      {
        id: "gym-3",
        name: "Teljes testes edzés",
        date: "2026-09-02",
        duration: 45,
        sets: 12,
        volume: "3 120",
      },
    ],
  };
}

// Default only when no identity was supplied; a stale link must never select another record.
export function resolveCycle(state, id) {
  return id === undefined
    ? state.cycles.find((c) => c.status === "active")
    : state.cycles.find((c) => c.id === id);
}
export function resolveRunPlan(state, id) {
  return id === undefined
    ? state.runPlans.find((p) => p.status === "active")
    : state.runPlans.find((p) => p.id === id);
}
export function resolveCycleDay(cycle, id) {
  return id === undefined
    ? cycle?.days[0]
    : cycle?.days.find((d) => d.id === id);
}
export function hubAppointments(state) {
  const byUpcoming = (a, b) =>
    ((a.day - 1 + 7) % 7) - ((b.day - 1 + 7) % 7) ||
    String(a.time || "").localeCompare(String(b.time || ""));
  const slot = [...state.schedule].sort(byUpcoming)[0];
  const sport = slot
    ? {
        slot,
        log: state.sportLogs.find(
          (l) =>
            l.slotId === slot.id &&
            l.date === `2026-09-${String(7 + slot.day).padStart(2, "0")}`,
        ),
      }
    : undefined;
  const plan = resolveRunPlan(state),
    session = plan ? [...plan.sessions].sort(byUpcoming)[0] : undefined;
  const run = session
    ? {
        plan,
        session,
        log: state.runLogs.find(
          (l) =>
            l.planId === plan.id &&
            l.sessionId === session.id &&
            l.date === `2026-09-${String(7 + session.day).padStart(2, "0")}`,
        ),
      }
    : undefined;
  return { sport, run };
}
