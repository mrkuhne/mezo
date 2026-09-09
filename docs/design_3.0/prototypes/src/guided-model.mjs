// Guided-day study state (mezo-tiy8). Design 2.0 domain colors + clay icon ids;
// dock mechanics inherited from the presence study, visual language does not.
export const SPACES = {
  nap: {
    name: "Nap",
    short: "Nap",
    icon: "i-nap",
    color: "#D4A853",
    deep: "#8E6E1F",
    wash: "#FDF8EC",
    tabs: [
      ["ma", "Ma", "i-nap"],
      ["het", "Hét", "i-heti"],
    ],
  },
  train: {
    name: "Edzés",
    short: "Edzés",
    icon: "i-edzes",
    color: "#FF6B4A",
    deep: "#A84A26",
    wash: "#FFF4EF",
    tabs: [
      ["ma", "Ma", "i-edzes"],
      ["naplo", "Napló", "i-naplo"],
    ],
  },
  fuel: {
    name: "Fuel",
    short: "Fuel",
    icon: "i-fuel",
    color: "#7FA48A",
    deep: "#4A6A3D",
    wash: "#EEF5EC",
    tabs: [
      ["keret", "Keret", "i-fuel"],
      ["naplo", "Napló", "i-naplo"],
    ],
  },
  mezo: {
    name: "Mezo",
    short: "Mezo",
    icon: "i-mezo",
    color: "#6FA7D8",
    deep: "#3A5F86",
    wash: "#EFF6FC",
    tabs: [["mintak", "Minták", "i-minta"]],
  },
  en: {
    name: "Én",
    short: "Én",
    icon: "i-eletjel",
    color: "#9B8FC4",
    deep: "#7A6DA8",
    wash: "#F3F0FA",
    tabs: [
      ["ma", "Ma", "i-eletjel"],
      ["suly", "Súly", "i-suly"],
    ],
  },
};
export function createGuided() {
  return {
    space: "nap",
    tabs: { nap: "ma", train: "ma", fuel: "keret", mezo: "mintak", en: "ma" },
    greeted: false,
    water: 1500,
    waterTarget: 2500,
    baseKcal: 2400,
    sleep: { hours: "7ó 42p", quality: 82 },
    weight: { kg: 81.4, delta: -0.3, series: [82.6, 82.4, 82.1, 81.9, 81.8, 81.6, 81.4] },
    meals: [
      { id: "m1", name: "Zabkása bogyókkal", kcal: 460, protein: 28, time: "07:20", icon: "i-reggeli" },
      { id: "m2", name: "Csirkés bowl", kcal: 620, protein: 52, time: "12:40", icon: "i-ebed" },
    ],
    workout: {
      status: "planned", // planned | active | done
      name: "Pull A",
      cycle: "Őszi építkezés · 3/6. hét",
      time: "17:30",
      sets: [
        { id: "s1", exercise: "Húzódzkodás", detail: "3 × 8 · testsúly", done: false },
        { id: "s2", exercise: "Döntött törzsű evezés", detail: "3 × 10 · 60 kg", done: false },
        { id: "s3", exercise: "Lehúzás", detail: "3 × 12 · 55 kg", done: false },
        { id: "s4", exercise: "Bicepsz kötéllel", detail: "3 × 12 · 24 kg", done: false },
      ],
    },
    celebration: false,
    insight: {
      title: "Az esti séta +34 perc alvással jár együtt",
      body: "12 megfigyelt nap alapján. Együttjárás, nem ok-okozat — de ma este belefér egy kör.",
    },
    week: {
      summary:
        "Erős heted volt: három edzés, stabil alvás, és a súlyod tovább ereszkedik. A csütörtöki mélypont után magadtól visszataláltál a ritmusba.",
      workouts: 3,
      km: 18.4,
      avgSleep: "7ó 28p",
      energy: [62, 74, 58, 41, 66, 78, 84],
    },
  };
}
export function selectSpace(s, space) {
  return SPACES[space] ? { ...s, space } : s;
}
export function selectTab(s, tab) {
  return SPACES[s.space].tabs.some(([id]) => id === tab)
    ? { ...s, tabs: { ...s.tabs, [s.space]: tab } }
    : s;
}
export function greet(s) {
  return { ...s, greeted: true };
}
export function addWater(s, ml = 250) {
  return { ...s, water: Math.min(s.waterTarget, s.water + ml) };
}
export function logMeal(s, meal) {
  if (!meal?.name || !meal?.kcal) return s;
  return { ...s, meals: [...s.meals, { protein: 0, time: "Most", icon: "i-snack", ...meal }] };
}
export function startWorkout(s) {
  return s.workout.status === "planned"
    ? { ...s, workout: { ...s.workout, status: "active" } }
    : s;
}
export function toggleSet(s, id) {
  if (s.workout.status !== "active") return s;
  return {
    ...s,
    workout: {
      ...s.workout,
      sets: s.workout.sets.map((x) => (x.id === id ? { ...x, done: !x.done } : x)),
    },
  };
}
export function finishWorkout(s) {
  return s.workout.status === "active"
    ? { ...s, workout: { ...s.workout, status: "done" }, celebration: true }
    : s;
}
export function dismissCelebration(s) {
  return { ...s, celebration: false };
}
export function foodBudget(s) {
  const logged = s.meals.reduce((n, m) => n + m.kcal, 0);
  const sport = 350; // ma edzésnap — a keret a tervezett terheléshez tartozik
  const target = s.baseKcal + sport;
  return { logged, target, remaining: Math.max(0, target - logged) };
}
export function doneSets(s) {
  return s.workout.sets.filter((x) => x.done).length;
}
