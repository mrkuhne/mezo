// Live session model for the Hevy/RP-style active workout: every exercise is a card with as
// many set rows as the plan (or the user) asks for. Pure functions only — the UI lives in session.js.

export const EXERCISES = [
  {
    id: 'bench', name: 'Fekvenyomás', muscle: 'Mell', art: 'chest', color: '#c8e895',
    target: { sets: 3, kg: 60, reps: 10, rir: 2, range: [8, 12], rest: 150 },
    cue: 'Talpak lent. Stabil lapockák. Maradjon két ismétlés tartalékban.',
    video: 'Fekvenyomás · lapockazárás és rúdút',
    last: [{ kg: 57.5, reps: 10, rir: 2 }, { kg: 57.5, reps: 9, rir: 1 }, { kg: 55, reps: 9, rir: 1 }],
    history: {
      sessions: 12, since: '2026-06-03',
      e1rm: 76.5, e1rmPrev: 74, best: { kg: 62.5, reps: 8, date: '2026-08-26' },
      volume: 18240, lastVolume: 1667,
      nextRecord: { kg: 62.5, reps: 9, note: 'egy ismétléssel a legjobb szetted fölé' },
      trajectory: [68, 69.5, 71, 72.5, 74, 76.5], projected: [78, 79.5, 81],
      medals: [
        { kind: 'Súlyrekord', value: '62,5 kg × 8', date: '2026-08-26' },
        { kind: 'Becsült 1RM', value: '76,5 kg', date: '2026-09-02' },
        { kind: 'Legtöbb volumen', value: '1 840 kg × rep', date: '2026-08-19' },
      ],
    },
  },
  {
    id: 'row', name: 'Evezés csigán', muscle: 'Hát', art: 'back', color: '#8ed2e8',
    target: { sets: 3, kg: 45, reps: 12, rir: 2, range: [10, 14], rest: 90 },
    cue: 'Vidd hátra a könyököd. A visszaengedés is legyen kontrollált.',
    video: 'Evezés csigán · könyökvezetés',
    last: [{ kg: 45, reps: 11, rir: 2 }, { kg: 45, reps: 11, rir: 1 }, { kg: 42.5, reps: 12, rir: 1 }],
    history: {
      sessions: 14, since: '2026-05-20',
      e1rm: 58, e1rmPrev: 57, best: { kg: 47.5, reps: 11, date: '2026-08-12' },
      volume: 21160, lastVolume: 1502,
      nextRecord: { kg: 47.5, reps: 12, note: 'a legjobb szettednél egy ismétléssel több' },
      trajectory: [52, 53.5, 54, 55.5, 57, 58], projected: [59, 60, 61],
      medals: [
        { kind: 'Súlyrekord', value: '47,5 kg × 11', date: '2026-08-12' },
        { kind: 'Sorozat', value: '6 hét kihagyás nélkül', date: '2026-09-02' },
      ],
    },
  },
  {
    id: 'press', name: 'Vállból nyomás', muscle: 'Váll', art: 'shoulder', color: '#bca6f1',
    target: { sets: 3, kg: 20, reps: 10, rir: 2, range: [8, 12], rest: 90 },
    cue: 'Nyugodt tempó, stabil törzs. A súly egy kézisúlyzóra értendő.',
    video: 'Vállból nyomás · törzsstabilitás',
    last: [{ kg: 20, reps: 10, rir: 2 }, { kg: 20, reps: 9, rir: 1 }, { kg: 18, reps: 10, rir: 1 }],
    history: {
      sessions: 9, since: '2026-06-24',
      e1rm: 26.5, e1rmPrev: 26.5, best: { kg: 22, reps: 9, date: '2026-08-05' },
      volume: 7420, lastVolume: 758,
      nextRecord: { kg: 22, reps: 10, note: 'ugyanaz a súly, egy ismétléssel több' },
      trajectory: [24, 24.5, 25, 26, 26.5, 26.5], projected: [27, 27.5, 28],
      medals: [{ kind: 'Súlyrekord', value: '22 kg × 9', date: '2026-08-05' }],
    },
  },
];

export const exerciseById = id => EXERCISES.find(e => e.id === id) ?? null;

const row = (target, extra = false) => ({ kg: target.kg, reps: target.reps, rir: target.rir, done: false, extra });

export function createSession(exercises = EXERCISES) {
  return {
    status: 'ready',
    startedAt: null,
    finishedAt: null,
    order: exercises.map(e => e.id),
    rows: Object.fromEntries(exercises.map(e => [e.id, Array.from({ length: e.target.sets }, () => row(e.target))])),
    notes: Object.fromEntries(exercises.map(e => [e.id, ''])),
  };
}

const valid = ({ kg, reps, rir }) =>
  Number.isFinite(kg) && kg >= 0 && kg <= 500 &&
  Number.isInteger(reps) && reps >= 1 && reps <= 100 &&
  Number.isInteger(rir) && rir >= 0 && rir <= 10;

/** Check the box ⇒ the set is saved. Returns false on invalid input or an unknown row. */
export function logSet(session, id, index, input) {
  const rows = session.rows[id];
  if (session.status === 'complete' || !rows || !rows[index] || !valid(input)) return false;
  rows[index] = { ...rows[index], ...input, done: true };
  session.status = 'active';
  session.startedAt ??= Date.now();
  return true;
}

/** Unchecking keeps the numbers but drops the set out of every total. */
export function undoSet(session, id, index) {
  const target = session.rows[id]?.[index];
  if (session.status === 'complete' || !target?.done) return false;
  target.done = false;
  return true;
}

export function addSet(session, id) {
  const rows = session.rows[id], exercise = exerciseById(id);
  if (session.status === 'complete' || !rows || !exercise || rows.length >= 12) return false;
  const previous = rows[rows.length - 1];
  rows.push({ kg: previous?.kg ?? exercise.target.kg, reps: previous?.reps ?? exercise.target.reps, rir: previous?.rir ?? exercise.target.rir, done: false, extra: true });
  return true;
}

/** Only an unchecked trailing set can go; a saved set is never silently thrown away. */
export function removeSet(session, id) {
  const rows = session.rows[id];
  if (session.status === 'complete' || !rows || rows.length <= 1 || rows[rows.length - 1].done) return false;
  rows.pop();
  return true;
}

export function moveExercise(session, id, delta) {
  const from = session.order.indexOf(id), to = from + delta;
  if (from < 0 || to < 0 || to >= session.order.length) return false;
  session.order.splice(to, 0, ...session.order.splice(from, 1));
  return true;
}

export function setNote(session, id, text) {
  if (!(id in session.notes)) return false;
  session.notes[id] = String(text ?? '').slice(0, 280);
  return true;
}

export function finishSession(session) {
  if (session.status === 'complete' || metrics(session).count === 0) return false;
  session.status = 'complete';
  session.finishedAt = Date.now();
  return true;
}

export function metrics(session) {
  const all = session.order.flatMap(id => session.rows[id].filter(r => r.done));
  const planned = session.order.reduce((n, id) => n + session.rows[id].length, 0);
  return {
    count: all.length,
    planned,
    reps: all.reduce((n, r) => n + r.reps, 0),
    volume: all.reduce((n, r) => n + r.kg * r.reps, 0),
    xp: all.length * 10,
  };
}

export const doneCount = (session, id) => session.rows[id].filter(r => r.done).length;

/** Epley, the same estimator the history card shows. */
export const e1rm = ({ kg, reps }) => Math.round(kg * (1 + reps / 30) * 10) / 10;

/**
 * What the row-end icon says once the set is saved:
 * 'record' beats the all-time best set, 'up' / 'down' compare with the same set last time,
 * 'hold' means the same work as last time.
 */
export function setVerdict(exercise, index, current) {
  const best = exercise.history.best;
  if (current.kg > best.kg || (current.kg === best.kg && current.reps > best.reps)) return 'record';
  const previous = exercise.last[index];
  if (!previous) return 'new';
  const now = current.kg * current.reps, was = previous.kg * previous.reps;
  if (now > was + 0.5) return 'up';
  if (now < was - 0.5) return 'down';
  return 'hold';
}

export const inRange = (exercise, current) =>
  current.reps >= exercise.target.range[0] && current.reps <= exercise.target.range[1];

/** The next exercise that still has an unchecked set, starting after the given one. */
export function nextOpen(session, afterId) {
  const start = session.order.indexOf(afterId);
  const wheel = [...session.order.slice(start + 1), ...session.order.slice(0, start + 1)];
  return wheel.find(id => session.rows[id].some(r => !r.done)) ?? null;
}

/** Legacy shape for the pages that still speak the old three-by-three array. */
export const legacyShape = session => ({
  status: session.status,
  startedAt: session.startedAt,
  finishedAt: session.finishedAt,
  sets: session.order.map(id => session.rows[id].map(r => (r.done ? { kg: r.kg, reps: r.reps, rir: r.rir } : null))),
});

// The one live session of the demo. Mutated in place, so holders keep a valid reference.
const live = createSession();
export const currentSession = () => live;

/**
 * Skipping an exercise keeps whatever you already logged and drops the rest of it out of the
 * "still pending" count. Toggling it back leaves the logged sets exactly where they were.
 */
export function skipExercise(session, id, skipped = true) {
  if (session.status === 'complete' || !(id in session.rows)) return false;
  session.skipped ??= {};
  session.skipped[id] = Boolean(skipped);
  return true;
}

export const isSkipped = (session, id) => Boolean(session.skipped?.[id]);

/** Unchecked rows that are neither done nor skipped — what a close would turn into "kihagyott". */
export const pendingCount = session =>
  session.order.filter(id => !isSkipped(session, id))
    .reduce((total, id) => total + session.rows[id].filter(r => !r.done).length, 0);
