// The running mesocycle, the way the production model actually works: a blueprint stamped into a
// run with dates, a weekly ramp per muscle between its landmarks, and a deload closing week.
// Pure functions only — the pages live in plan-pages.js.

export const DAY_ORDER = ['Hét', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
export const DAY_NAMES = { 'Hét': 'Hétfő', K: 'Kedd', Sze: 'Szerda', Cs: 'Csütörtök', P: 'Péntek', Szo: 'Szombat', V: 'Vasárnap' };

/** maintain → the lower landmark, grow → the middle one, emphasize → the ceiling. */
export const TIERS = {
  maintain: { label: 'Tartás', short: 'tart' },
  grow: { label: 'Építés', short: 'épít' },
  emphasize: { label: 'Hangsúly', short: 'hangsúly' },
};

export const MESO = {
  name: 'Alapból erő',
  goal: 'Fokozatos erőépítés, heti három gym nap, a röplabda mellé.',
  weeks: 6,
  currentWeek: 3,
  start: '2026-08-24',
  end: '2026-10-04',
  phaseCurve: ['MEV', 'MEV+', 'MAV', 'MAV+', 'MRV', 'Deload'],
  split: 'Felső / alsó',
  days: [
    { day: 'Hét', type: 'Felsőtest B', minutes: 48, exercises: [
      { name: 'Vállból nyomás', muscle: 'shoulder-side', sets: 3, warmup: 2, repMin: 8, repMax: 12, rir: 2, kg: 20 },
      { name: 'Húzódzkodás', muscle: 'back-wide', sets: 3, warmup: 1, repMin: 6, repMax: 10, rir: 2, kg: 0 },
      { name: 'Ferde padnyomás', muscle: 'chest-upper', sets: 3, warmup: 2, repMin: 8, repMax: 12, rir: 2, kg: 45 },
      { name: 'Bicepsz hajlítás', muscle: 'biceps-short', sets: 3, warmup: 0, repMin: 10, repMax: 14, rir: 1, kg: 14 },
    ] },
    { day: 'Sze', type: 'Felsőtest A', minutes: 45, exercises: [
      { name: 'Fekvenyomás', muscle: 'chest-mid', sets: 3, warmup: 2, repMin: 8, repMax: 12, rir: 2, kg: 60 },
      { name: 'Evezés csigán', muscle: 'back-mid', sets: 3, warmup: 1, repMin: 10, repMax: 14, rir: 2, kg: 45 },
      { name: 'Vállból nyomás', muscle: 'shoulder-side', sets: 3, warmup: 1, repMin: 8, repMax: 12, rir: 2, kg: 20 },
    ] },
    { day: 'P', type: 'Alsótest', minutes: 52, exercises: [
      { name: 'Guggolás', muscle: 'quad', sets: 4, warmup: 3, repMin: 6, repMax: 10, rir: 2, kg: 80 },
      { name: 'Román felhúzás', muscle: 'ham', sets: 3, warmup: 2, repMin: 8, repMax: 12, rir: 2, kg: 70 },
      { name: 'Vádli gépben', muscle: 'calf', sets: 4, warmup: 0, repMin: 12, repMax: 16, rir: 1, kg: 60 },
      { name: 'Plank sorozat', muscle: 'core', sets: 3, warmup: 0, repMin: 0, repMax: 0, rir: 1, kg: 0 },
    ] },
  ],
  muscles: [
    { previous: { start: 8, peak: 12, ceiling: 14 }, key: 'chest-mid', name: 'Mell', tier: 'grow', mev: 8, mav: 14, mrv: 18, series: [8, 10, 12, 14, 14, 7], freq: 2 },
    { previous: { start: 10, peak: 16, ceiling: 18 }, key: 'back-mid', name: 'Hát', tier: 'emphasize', mev: 10, mav: 16, mrv: 20, series: [12, 14, 16, 18, 20, 10], freq: 2 },
    { previous: { start: 6, peak: 10, ceiling: 12 }, key: 'shoulder-side', name: 'Váll', tier: 'grow', mev: 6, mav: 12, mrv: 16, series: [6, 8, 10, 12, 12, 6], freq: 2 },
    { previous: { start: 8, peak: 12, ceiling: 14 }, key: 'quad', name: 'Comb', tier: 'grow', mev: 8, mav: 14, mrv: 18, series: [8, 10, 12, 14, 14, 7], freq: 1 },
    { previous: { start: 6, peak: 6, ceiling: 6 }, key: 'ham', name: 'Lábhajlító', tier: 'maintain', mev: 6, mav: 12, mrv: 16, series: [6, 6, 6, 6, 6, 4], freq: 1 },
    { previous: { start: 4, peak: 8, ceiling: 10 }, key: 'biceps-short', name: 'Bicepsz', tier: 'grow', mev: 6, mav: 10, mrv: 14, series: [6, 8, 8, 10, 10, 5], freq: 1 },
    { previous: null, key: 'calf', name: 'Vádli', tier: 'maintain', mev: 6, mav: 10, mrv: 14, series: [6, 6, 6, 6, 6, 4], freq: 1 },
  ],
};

export const isDeloadWeek = (meso, week) => meso.phaseCurve[week - 1] === 'Deload';

/** Rámpa while the curve climbs, Csúcs at the top, Deload at the close. */
export function phaseOf(meso, week = meso.currentWeek) {
  const phase = meso.phaseCurve[week - 1];
  if (phase === 'Deload') return { key: 'deload', label: 'Deload' };
  if (phase === 'MRV') return { key: 'peak', label: 'Csúcs' };
  return { key: 'ramp', label: 'Rámpa' };
}

/** The ceiling this muscle may climb to, from its focus. */
export const ceilingOf = muscle =>
  muscle.tier === 'maintain' ? muscle.mev : muscle.tier === 'emphasize' ? muscle.mrv : muscle.mav;

export const setsAt = (muscle, week) => muscle.series[week - 1] ?? 0;
export const currentSets = (muscle, meso = MESO) => setsAt(muscle, meso.currentWeek);

/** The last week before the deload — the top of the ramp. */
export function peakWeek(meso) {
  for (let week = meso.weeks; week >= 1; week -= 1) if (!isDeloadWeek(meso, week)) return week;
  return meso.weeks;
}

/**
 * What Monday's rollover will do to each muscle: climb by the step while there is room under the
 * ceiling, hold at it, and halve into the deload week.
 */
export function nextRollover(meso = MESO, step = 2) {
  const nextWeek = meso.currentWeek + 1;
  if (nextWeek > meso.weeks) return { week: null, rows: [] };
  const deload = isDeloadWeek(meso, nextWeek);
  return {
    week: nextWeek,
    deload,
    rows: meso.muscles.map(muscle => {
      const now = currentSets(muscle, meso), next = setsAt(muscle, nextWeek);
      const move = deload ? 'deload' : next > now ? 'up' : 'hold';
      return { ...muscle, now, next, move, delta: next - now, step };
    }),
  };
}

/** Where the current number sits on the muscle's own band, as a 0..1 share of the MRV scale. */
export function bandPosition(muscle, meso = MESO) {
  const now = currentSets(muscle, meso), scale = muscle.mrv || 1;
  return {
    now,
    ceiling: ceilingOf(muscle),
    share: Math.min(1, now / scale),
    mev: muscle.mev / scale,
    mav: muscle.mav / scale,
    mrv: 1,
    inZone: now >= muscle.mev && now <= ceilingOf(muscle),
    atCeiling: now >= ceilingOf(muscle),
  };
}

export const dayByToken = (token, meso = MESO) => meso.days.find(d => d.day === token) ?? null;
export const isTrainingDay = (token, meso = MESO) => Boolean(dayByToken(token, meso));

/** Working sets a day asks of each muscle — warmups never count as work. */
export function dayLoad(day) {
  const rows = new Map();
  for (const exercise of day.exercises) {
    rows.set(exercise.muscle, (rows.get(exercise.muscle) ?? 0) + exercise.sets);
  }
  return [...rows].map(([key, sets]) => ({ key, sets }));
}

export const daySets = day => day.exercises.reduce((total, e) => total + e.sets, 0);

/** Every day this muscle is worked in the week, with the exercises that do it. */
export function whereItWorks(muscleKey, meso = MESO) {
  return meso.days
    .map(day => ({
      day: day.day,
      type: day.type,
      exercises: day.exercises.filter(e => e.muscle === muscleKey),
    }))
    .filter(row => row.exercises.length)
    .map(row => ({ ...row, sets: row.exercises.reduce((total, e) => total + e.sets, 0) }));
}

export const weekTotal = (meso = MESO, week = meso.currentWeek) =>
  meso.muscles.reduce((total, muscle) => total + setsAt(muscle, week), 0);

/** Two muscles worked on back-to-back days is worth mentioning — never blocking, never red. */
export function adjacencyNotes(meso = MESO) {
  const notes = [];
  const index = day => DAY_ORDER.indexOf(day.day);
  for (const a of meso.days) {
    for (const b of meso.days) {
      if (index(b) !== index(a) + 1) continue;
      const shared = dayLoad(a).map(r => r.key).filter(key => dayLoad(b).some(r => r.key === key));
      for (const key of shared) notes.push({ key, from: a.day, to: b.day });
    }
  }
  return notes;
}

/* ── the library: templates, the queued run, and the closed ones ─────────────────────── */
// A template is a blueprint; stamping it makes a run with dates; a closed run keeps its story.

/** Shorthand for a template exercise row — same shape the running plan speaks. */
const ex = (name, muscle, sets, kg, repMin = 8, repMax = 12, rir = 2, warmup = 1) =>
  ({ name, muscle, sets, warmup, repMin, repMax, rir, kg });

export const LIBRARY = {
  active: { from: 'alap-ero' },
  planned: [
    { key: 'osz-ero', name: 'Erő ősszel', from: 'alap-ero', start: '2026-10-12', weeks: 6, daysPerWeek: 3, split: 'Felső / alsó' },
  ],
  templates: [
    { key: 'alap-ero', name: 'Alapból erő', split: 'Felső / alsó', weeks: 6, daysPerWeek: 3, minutes: 48,
      muscles: ['chest-mid', 'back-mid', 'shoulder-side', 'quad', 'ham', 'biceps-short', 'calf'],
      days: MESO.days },
    { key: 'vall-hat', name: 'Váll és hát', split: 'Húzó / toló', weeks: 5, daysPerWeek: 4, minutes: 55,
      muscles: ['shoulder-side', 'shoulder-rear', 'back-wide', 'back-mid', 'traps', 'biceps-short'],
      days: [
        { day: 'Hét', type: 'Húzó A', exercises: [
          ex('Húzódzkodás', 'back-wide', 3, 0, 6, 10), ex('Evezés csigán', 'back-mid', 3, 45, 10, 14),
          ex('Vállvonogatás', 'traps', 3, 40, 10, 15, 1, 0), ex('Bicepsz hajlítás', 'biceps-short', 3, 14, 10, 14, 1, 0)] },
        { day: 'K', type: 'Toló A', exercises: [
          ex('Vállból nyomás', 'shoulder-side', 3, 20), ex('Oldalemelés', 'shoulder-side', 3, 8, 12, 16, 1, 0),
          ex('Hátsó váll gépen', 'shoulder-rear', 3, 30, 12, 16, 1, 0)] },
        { day: 'Cs', type: 'Húzó B', exercises: [
          ex('Lehúzás széles fogással', 'back-wide', 3, 50, 10, 14), ex('Evezés csigán', 'back-mid', 3, 45, 10, 14),
          ex('Bicepsz hajlítás', 'biceps-short', 3, 14, 10, 14, 1, 0)] },
        { day: 'P', type: 'Toló B', exercises: [
          ex('Vállból nyomás', 'shoulder-side', 3, 20), ex('Hátsó váll gépen', 'shoulder-rear', 3, 30, 12, 16, 1, 0),
          ex('Vállvonogatás', 'traps', 2, 40, 10, 15, 1, 0)] },
      ] },
    { key: 'nyari-tomeg', name: 'Nyári tömegelés', split: 'Teljes test', weeks: 6, daysPerWeek: 4, minutes: 58,
      muscles: ['chest-mid', 'back-wide', 'shoulder-side', 'quad', 'ham', 'glute', 'triceps-long'],
      days: [
        { day: 'Hét', type: '1. nap', exercises: [
          ex('Guggolás', 'quad', 4, 80, 6, 10, 2, 2), ex('Fekvenyomás', 'chest-mid', 3, 60, 8, 12, 2, 2),
          ex('Lehúzás széles fogással', 'back-wide', 3, 50, 10, 14)] },
        { day: 'Sze', type: '2. nap', exercises: [
          ex('Román felhúzás', 'ham', 3, 70), ex('Vállból nyomás', 'shoulder-side', 3, 20),
          ex('Francia nyomás', 'triceps-long', 3, 25, 10, 14, 1, 0)] },
        { day: 'P', type: '3. nap', exercises: [
          ex('Lábtolás', 'quad', 3, 120, 10, 14), ex('Húzódzkodás', 'back-wide', 3, 0, 6, 10),
          ex('Tárogatás kábelen', 'chest-mid', 3, 15, 12, 16, 1, 0)] },
        { day: 'Szo', type: '4. nap', exercises: [
          ex('Csípőemelés', 'glute', 3, 60, 10, 14), ex('Oldalemelés', 'shoulder-side', 3, 8, 12, 16, 1, 0),
          ex('Francia nyomás', 'triceps-long', 2, 25, 10, 14, 1, 0)] },
      ] },
  ],
  closed: [
    { key: 'hyper-nyar', name: 'Hypertrophy · Nyár', from: 'nyari-tomeg', start: '2026-06-15', end: '2026-07-26',
      weeks: 6, done: 22, planned: 24, stars: 4.5, records: 7, volumeKg: 128400,
      say: 'A hátad vitte a legtöbbet — a végére húsz szettet is bírt hetente.',
      muscles: [
        { key: 'back-wide', start: 10, peak: 20, note: 'végig bírta az emelést' },
        { key: 'chest-mid', start: 8, peak: 12, note: 'a negyedik héten állt meg' },
        { key: 'quad', start: 8, peak: 12, note: 'stabilan hozta' },
        { key: 'shoulder-side', start: 6, peak: 10, note: 'új rekordig jutott' },
      ] },
    { key: 'tavasz-alap', name: 'Tavaszi alapozás', from: 'alap-ero', start: '2026-03-02', end: '2026-04-12',
      weeks: 6, done: 15, planned: 18, stars: 3, records: 3, volumeKg: 84600,
      say: 'Egy beteg hét kimaradt, mégis hoztad a terv nagyját.',
      muscles: [
        { key: 'chest-mid', start: 8, peak: 12, note: 'két hét kellett a ritmushoz' },
        { key: 'back-mid', start: 10, peak: 14, note: 'egyenletesen nőtt' },
        { key: 'quad', start: 8, peak: 12, note: 'a kihagyás itt látszott' },
      ] },
  ],
};

export const template = key => LIBRARY.templates.find(t => t.key === key) ?? null;
export const closedRun = key => LIBRARY.closed.find(r => r.key === key) ?? null;

/** Every run stamped from this template, newest first — the running and queued ones included. */
export function templateStory(key, library = LIBRARY, meso = MESO) {
  return {
    activeNow: library.active.from === key ? meso : null,
    planned: library.planned.filter(r => r.from === key),
    closed: library.closed.filter(r => r.from === key),
  };
}

/** How much of the planned work a closed run actually delivered, 0..1. */
export const closedShare = run => (run.planned ? Math.min(1, run.done / run.planned) : 0);
