import { createExplorationState } from "./exploration-model.mjs";
import { EXERCISES } from "./flows/train-state.mjs";
const copy = (value) => JSON.parse(JSON.stringify(value));
export function hydrateComplete(s) {
  if (s.full) {
    const c = s.full.training.cycles.find((c) => c.status === "active");
    return {
      ...s,
      training: {
        ...s.training,
        cycle: {
          ...s.training.cycle,
          name: c?.title || "Nincs aktív mezociklus",
          week: c?.currentWeek || 1,
          weeks: c?.weeks || 1,
          session: c?.days[0]?.name || "Saját edzés",
        },
      },
    };
  }
  const full = createExplorationState();
  full.baseKcal = 2400;
  full.fuel.targets.kcal = 2400 + (s.training.sportActive ? 350 : 0);
  full.lifeGoals = [
    {
      id: "goal-calm",
      title: "Erősen jelen lenni a saját életemben",
      dimension: "lelki",
      status: "active",
      note: "Legyen hely a mozgásnak és a kapcsolataimnak.",
      pillars: [
        {
          id: "pillar-walk",
          title: "Esti séta",
          target: 3,
          value: 1,
          unit: "alkalom / hét",
        },
        {
          id: "pillar-social",
          title: "Közös idő",
          target: 2,
          value: 0,
          unit: "alkalom / hét",
        },
      ],
    },
  ];
  full.templates = [];
  full.cycleReports = {};
  full.session = null;
  full.training.cycles[0].title = s.training.cycle.name;
  return hydrateComplete({ ...s, full });
}
export function updateComplete(s, domain, updater) {
  s = hydrateComplete(s);
  let full = {
    ...s.full,
    [domain]: typeof updater === "function" ? updater(s.full[domain]) : updater,
  };
  if (domain === "fuel" && full.fuel.targets.kcal !== s.full.fuel.targets.kcal)
    full.baseKcal = Math.max(
      0,
      full.fuel.targets.kcal - (s.training.sportActive ? 350 : 0),
    );
  const c = full.training.cycles.find((c) => c.status === "active");
  return {
    ...s,
    full,
    training: {
      ...s.training,
      ...(c
        ? {
            cycle: {
              ...s.training.cycle,
              name: c.title,
              week: c.currentWeek,
              weeks: c.weeks,
              session: c.days[0]?.name || "Saját edzés",
            },
          }
        : {
            cycle: {
              ...s.training.cycle,
              name: "Nincs aktív mezociklus",
              week: 1,
              weeks: 1,
              session: "Saját edzés",
            },
          }),
    },
  };
}
export function saveLifeGoal(
  full,
  input,
  id = input.id || crypto.randomUUID(),
) {
  if (!input.title?.trim()) throw Error("Adj nevet a célodnak.");
  if (
    !input.pillars?.length ||
    input.pillars.some(
      (p) =>
        !p.title?.trim() ||
        !Number.isFinite(Number(p.target)) ||
        Number(p.target) <= 0,
    )
  )
    throw Error(
      "Legalább egy megnevezett, pozitív célértékű pillér szükséges.",
    );
  const g = {
    ...input,
    id,
    title: input.title.trim(),
    status: input.status || "active",
    pillars: input.pillars.map((p) => ({
      ...p,
      id: p.id || crypto.randomUUID(),
      target: Number(p.target),
      value: Number(p.value) || 0,
    })),
  };
  return {
    ...full,
    lifeGoals: full.lifeGoals.some((x) => x.id === id)
      ? full.lifeGoals.map((x) => (x.id === id ? g : x))
      : [...full.lifeGoals, g],
  };
}
export function startSession(full, params = {}) {
  if (full.session?.status === "active") return full;
  const cycle = params.custom
    ? null
    : full.training.cycles.find((c) => c.id === params.id) ||
      full.training.cycles.find((c) => c.status === "active");
  const day = cycle?.days.find((d) => d.id === params.day) || cycle?.days[0];
  const items =
    day?.exercises ||
    EXERCISES.slice(0, 3).map((e) => ({ id: e.id, sets: 3, reps: 10 }));
  return {
    ...full,
    workoutFinished: false,
    session: {
      id: crypto.randomUUID(),
      cycleId: cycle?.id,
      title: day?.name || "Saját edzés",
      status: "active",
      startedAt: Date.now(),
      notes: "",
      restUntil: null,
      exercises: items.map((e) => ({
        ...e,
        name: EXERCISES.find((x) => x.id === e.id)?.name || e.id,
        records: Array.from({ length: e.sets }, () => ({
          kg: 0,
          reps: e.reps,
          rir: 2,
          done: false,
        })),
      })),
    },
  };
}
export function logSessionSet(full, exercise, index, value) {
  if (!full.session || full.session.status !== "active")
    throw Error("Nincs aktív edzés.");
  if (
    ![value.kg, value.reps, value.rir].every((v) =>
      Number.isFinite(Number(v)),
    ) ||
    value.kg < 0 ||
    value.reps < 0 ||
    value.rir < 0 ||
    value.rir > 10
  )
    throw Error("Ellenőrizd a kg, ismétlés és RIR értékét.");
  const session = copy(full.session);
  session.exercises[exercise].records[index] = {
    ...value,
    kg: Number(value.kg),
    reps: Number(value.reps),
    rir: Number(value.rir),
  };
  if (value.done) session.restUntil = Date.now() + 90000;
  return { ...full, session };
}
export function finishSession(full) {
  if (!full.session || full.session.status === "completed") return full;
  const session = {
    ...full.session,
    status: "completed",
    endedAt: Date.now(),
    restUntil: null,
  };
  const records = session.exercises.flatMap((e) =>
    e.records.filter((r) => r.done).map((r) => ({ ...r, name: e.name })),
  );
  if (!records.length)
    throw Error("Legalább egy sorozatot rögzíts a lezáráshoz.");
  const item = {
    id: session.id,
    cycleId: session.cycleId,
    date: "2026-09-08",
    title: session.title,
    name: session.title,
    exercises: session.exercises.map((e) => ({
      name: e.name,
      sets: e.records
        .filter((r) => r.done)
        .map((r) => ({ ...r, weight: r.kg })),
    })),
    sets: records.length,
    volume: records.reduce((n, r) => n + r.kg * r.reps, 0),
    duration: Math.max(
      1,
      Math.round((session.endedAt - session.startedAt) / 60000),
    ),
    notes: session.notes,
    records,
  };
  return {
    ...full,
    workoutFinished: true,
    session,
    training: {
      ...full.training,
      gymHistory: [item, ...full.training.gymHistory],
    },
  };
}
export function closeCycle(full, id, note = "") {
  const c = full.training.cycles.find((c) => c.id === id);
  if (!c || c.status === "archived") return full;
  return {
    ...full,
    cycleReports: {
      ...full.cycleReports,
      [id]: {
        cycle: copy(c),
        note,
        closedAt: "2026-09-08",
        workouts: copy(
          full.training.gymHistory.filter((x) => x.cycleId === id),
        ),
      },
    },
    training: {
      ...full.training,
      cycles: full.training.cycles.map((c) =>
        c.id === id ? { ...c, status: "archived" } : c,
      ),
    },
  };
}

export function removeBodyLog(full, domain, id) {
  const body = full.personal[domain],
    logs = body.logs.filter((l) => l.id !== id);
  return {
    ...full,
    personal: {
      ...full.personal,
      [domain]: {
        ...body,
        logs,
        latest:
          domain === "weight" ? (logs[0]?.value ?? null) : (logs[0] ?? null),
      },
    },
  };
}
