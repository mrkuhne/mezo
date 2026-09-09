import { EXERCISES } from "./flows/train-state.mjs";
import { ROLES } from "./presence-model.mjs";
export const RPG_ROLES = Object.fromEntries(
  Object.entries(ROLES).map(([id, r], i) => [
    id,
    {
      ...r,
      color: ["#3858ee", "#3858ee", "#eb642f", "#8450da", "#087f82"][i],
      light: ["#dce4ff", "#dce4ff", "#fff0d9", "#eee1ff", "#d9f4f1"][i],
      shadow: "#172344",
      ...(id === "home"
        ? {
            name: "Bázis",
            short: "Bázis",
            description: "Napi adatok, naplózás és fejlődés.",
            tabs: [
              ["today", "Ma", "sun"],
              ["talk", "Boop", "message"],
              ["capture", "Naplózás", "plus"],
            ],
          }
        : {}),
      ...(id === "understanding"
        ? {
            name: "Elemzés",
            short: "Elemzés",
            description: "Minták, tudástár és a személyes profilod.",
          }
        : {}),
    },
  ]),
);
export function storageFor(variant) {
  return variant === "rpg" ? "boop-rpg-v1" : "mezo-presence-v1";
}
export function levelProgress(xp) {
  const n = Math.max(0, Number(xp) || 0);
  return {
    level: Math.floor(n / 100) + 1,
    current: n % 100,
    next: 100,
    percent: n % 100,
  };
}
const sum = (rows, key) =>
  rows.reduce(
    (n, r) =>
      n +
      (Number(
        String(r[key] ?? 0)
          .replace(/\s/g, "")
          .replace(",", "."),
      ) || 0),
    0,
  );
export function rpgStats(s) {
  const f = s.full,
    meals = f.meals || [],
    training = f.training.gymHistory || [],
    week = training.filter(
      (x) => x.date >= "2026-09-07" && x.date <= "2026-09-13",
    );
  const ids = new Set();
  for (const [kind, rows] of Object.entries({
    meal: meals,
    gym: training,
    sleep: f.personal.sleep.logs,
    weight: f.personal.weight.logs,
  }))
    for (const r of rows) ids.add(`${kind}:${r.id || r.date}`);
  s.checkins.forEach((_, i) => ids.add(`checkin:${i}`));
  if (s.journal?.trim()) ids.add("journal:today");
  if (s.gratitude?.trim()) ids.add("gratitude:today");
  const xp = ids.size * 10,
    kcal = sum(meals, "kcal"),
    target = f.fuel.targets.kcal;
  return {
    xp,
    ...levelProgress(xp),
    kcal,
    target,
    remaining: target - kcal,
    mealCount: meals.length,
    macros: {
      protein: sum(meals, "protein"),
      carbs: sum(meals, "carbs"),
      fat: sum(meals, "fat"),
    },
    sessions: week.length,
    sets: sum(week, "sets"),
    volume: sum(week, "volume"),
    allVolume: sum(training, "volume"),
    minutes: sum(week, "duration"),
    latestWeight: f.personal.weight.logs[0]?.value ?? null,
    latestSleep: f.personal.sleep.logs[0] || null,
    cycle: f.training.cycles.find((c) => c.status === "active") || null,
    logged: ids.size,
  };
}
export const RPG_TITLES = {
  fuel: "Étkezési napló",
  "fuel-log": "Étkezés naplózása",
  "fuel-review": "Adagok ellenőrzése",
  "fuel-pantry": "Kamra",
  "fuel-recipes": "Receptek",
  "fuel-evaluation": "Étkezési score",
  train: "Edzésközpont",
  "train-gym": "Edzésnapló",
  "train-cycles": "Mezociklusok",
  "train-build": "Új mezociklus",
  "train-exercises": "Gyakorlatok",
  "train-medals": "Eredményeid",
  "me-weight": "Testsúly",
  "me-weight-log": "Súlymérés",
  "me-sleep": "Alvás",
  "me-sleep-log": "Alvás naplózása",
  "me-people": "Emberek",
  goals: "Életcélok",
  patterns: "Minták",
  knowledge: "Tudástár",
  predictions: "Előrejelzések",
  character: "Személyes profil",
};

export function rpgRecords(s) {
  return EXERCISES.map((e) => {
    const [kg, reps] = e.best.match(/[0-9.]+/g).map(Number);
    let best = { weight: kg, reps },
      source = "Demó előzmény";
    for (const h of s.full.training.gymHistory)
      for (const exercise of h.exercises || [])
        if (exercise.name === e.name)
          for (const set of exercise.sets || [])
            if (
              Number(set.weight) > best.weight ||
              (Number(set.weight) === best.weight &&
                Number(set.reps) > best.reps)
            ) {
              best = { weight: Number(set.weight), reps: Number(set.reps) };
              source = "Naplózott rekord";
            }
    return { ...e, best: `${best.weight} kg × ${best.reps}`, source };
  });
}
