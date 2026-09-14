// Building a new mesocycle: a draft you shape step by step, then stamp into a queued run.
// Pure state and math — the pages live in plan-wizard.js.
import { DAY_ORDER, LIBRARY, MESO, TIERS, template } from './plan-state.js';

/** A small catalog to pick from — name plus the muscle it works. */
export const CATALOG = [
  { name: 'Fekvenyomás', muscle: 'chest-mid', kg: 60 },
  { name: 'Ferde padnyomás', muscle: 'chest-upper', kg: 45 },
  { name: 'Tárogatás kábelen', muscle: 'chest-mid', kg: 15 },
  { name: 'Húzódzkodás', muscle: 'back-wide', kg: 0 },
  { name: 'Evezés csigán', muscle: 'back-mid', kg: 45 },
  { name: 'Lehúzás széles fogással', muscle: 'back-wide', kg: 50 },
  { name: 'Vállból nyomás', muscle: 'shoulder-side', kg: 20 },
  { name: 'Oldalemelés', muscle: 'shoulder-side', kg: 8 },
  { name: 'Hátsó váll gépen', muscle: 'shoulder-rear', kg: 30 },
  { name: 'Bicepsz hajlítás', muscle: 'biceps-short', kg: 14 },
  { name: 'Tricepsz letolás', muscle: 'triceps-lateral', kg: 25 },
  { name: 'Guggolás', muscle: 'quad', kg: 80 },
  { name: 'Lábtolás', muscle: 'quad', kg: 120 },
  { name: 'Román felhúzás', muscle: 'ham', kg: 70 },
  { name: 'Csípőemelés', muscle: 'glute', kg: 60 },
  { name: 'Vádli gépben', muscle: 'calf', kg: 60 },
  { name: 'Plank sorozat', muscle: 'core', kg: 0 },
];
export const catalogItem = name => CATALOG.find(c => c.name === name) ?? null;

const exerciseOf = item => ({ name: item.name, muscle: item.muscle, sets: 3, warmup: 1, repMin: 8, repMax: 12, rir: 2, kg: item.kg });

export function newDraft() {
  return { source: 'blank', name: '', weeks: 6, days: [], focus: {} };
}

/** A draft prefilled from a template: its own plan copies its days, the rest get a spread. */
export function draftFromTemplate(key) {
  const t = template(key);
  if (!t) return newDraft();
  const draft = { source: key, name: t.name, weeks: t.weeks, days: [], focus: {} };
  if (key === LIBRARY.active.from) {
    draft.days = MESO.days.map(d => ({ day: d.day, type: d.type, exercises: d.exercises.map(e => ({ ...e })) }));
  } else {
    const slots = ['Hét', 'Sze', 'P', 'K', 'Cs'].slice(0, t.daysPerWeek).sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
    const picks = t.muscles.map(m => CATALOG.find(c => c.muscle === m)).filter(Boolean);
    draft.days = slots.map((day, i) => ({
      day, type: `${i + 1}. nap`,
      exercises: picks.filter((_, j) => j % slots.length === i).map(exerciseOf),
    }));
  }
  for (const m of draftMuscles(draft)) draft.focus[m.key] = 'grow';
  return draft;
}

const dayIndex = token => DAY_ORDER.indexOf(token);
export const draftDay = (draft, token) => draft.days.find(d => d.day === token) ?? null;

/** A weekday joins or leaves the plan; the week keeps its natural order. */
export function toggleDay(draft, token) {
  const found = draftDay(draft, token);
  if (found) draft.days = draft.days.filter(d => d !== found);
  else {
    draft.days.push({ day: token, type: `${draft.days.length + 1}. nap`, exercises: [] });
    draft.days.sort((a, b) => dayIndex(a.day) - dayIndex(b.day));
  }
  return draft;
}

export function addExercise(draft, token, name) {
  const item = catalogItem(name), day = draftDay(draft, token);
  if (!item || !day) return draft;
  day.exercises.push(exerciseOf(item));
  if (!draft.focus[item.muscle]) draft.focus[item.muscle] = 'grow';
  return draft;
}

export function removeExercise(draft, token, index) {
  const day = draftDay(draft, token);
  if (day) day.exercises.splice(index, 1);
  return draft;
}

/** Reorder by arrows only — the ends simply do nothing. */
export function moveExercise(draft, token, index, dir) {
  const day = draftDay(draft, token), to = index + dir;
  if (!day || to < 0 || to >= day.exercises.length) return draft;
  const [row] = day.exercises.splice(index, 1);
  day.exercises.splice(to, 0, row);
  return draft;
}

export function changeSets(draft, token, index, delta) {
  const day = draftDay(draft, token);
  if (!day || !day.exercises[index]) return draft;
  day.exercises[index].sets = Math.min(8, Math.max(1, day.exercises[index].sets + delta));
  return draft;
}

/** Rough honest guess: warm-in plus about four minutes per working set. */
export const dayMinutes = day => (day.exercises.length ? 8 + day.exercises.reduce((t, e) => t + e.sets, 0) * 4 : 0);

/** Every muscle the draft touches, with its weekly working sets and how many days reach it. */
export function draftMuscles(draft) {
  const rows = new Map();
  for (const day of draft.days) for (const e of day.exercises) {
    const row = rows.get(e.muscle) ?? { key: e.muscle, sets: 0, days: 0, seen: new Set() };
    row.sets += e.sets;
    if (!row.seen.has(day.day)) { row.seen.add(day.day); row.days += 1; }
    rows.set(e.muscle, row);
  }
  return [...rows.values()].map(({ seen, ...row }) => row).sort((a, b) => b.sets - a.sets);
}

/** Week one is what the days say; the focus decides how far it may climb; the last week rests. */
export function rampSeries(startSets, tier, weeks) {
  const ceiling = tier === 'maintain' ? startSets : tier === 'emphasize' ? startSets + 10 : startSets + 6;
  const series = [];
  for (let week = 1; week < weeks; week += 1) series.push(Math.min(ceiling, startSets + (week - 1) * 2));
  series.push(Math.max(1, Math.ceil(series[series.length - 1] / 2)));
  return series;
}

/** Notes, never blockers — the plan starts even if every one of them stands. */
export function lintDraft(draft) {
  const notes = [];
  if (!draft.days.length) return [{ say: 'Még nincs edzésnap a tervben.' }];
  for (const day of draft.days) if (!day.exercises.length) notes.push({ say: `A ${day.day} napra még nem tettél gyakorlatot.` });
  const byDay = new Map(draft.days.map(d => [dayIndex(d.day), new Set(d.exercises.map(e => e.muscle))]));
  const shared = new Set();
  for (const [i, muscles] of byDay) {
    const next = byDay.get(i + 1);
    if (next) for (const m of muscles) if (next.has(m)) shared.add(m);
  }
  if (shared.size) notes.push({ say: `${shared.size} izom két egymás utáni napon is dolgozik — pihenőnap nélkül nehezebben épül.` });
  for (const row of draftMuscles(draft)) {
    if (draft.focus[row.key] === 'emphasize' && row.days < 2)
      notes.push({ say: 'Van izom, ami hangsúlyt kap, de hetente csak egyszer éred el — két alkalom többet hozna.' });
  }
  return notes.slice(0, 4);
}

/** The draft becomes a queued run on the library shelf; the draft itself is spent. */
export function stampRun(draft, startIso, library = LIBRARY) {
  const run = {
    key: `draft-${library.planned.length + 1}`,
    name: draft.name || 'Névtelen terv',
    from: draft.source === 'blank' ? null : draft.source,
    start: startIso, weeks: draft.weeks, daysPerWeek: draft.days.length,
    split: template(draft.source)?.split ?? `${draft.days.length} napos hét`,
  };
  library.planned.push(run);
  return run;
}

/* the one draft being shaped right now */
let draft = null;
export const wizardDraft = () => draft;
export const startWizard = source => { draft = source === 'blank' ? newDraft() : draftFromTemplate(source); return draft; };
export const dropWizard = () => { draft = null; };
