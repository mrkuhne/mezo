// The week's training load, honestly: what the plan asked, what already happened, what is left.
// Fixture-frozen to the demo week (Mon 2026-09-07 … Sun 2026-09-13, "today" Wed 2026-09-09).
import { MESO, DAY_ORDER, DAY_NAMES, dayByToken, dayLoad, currentSets, phaseOf } from './plan-state.js';
import { REGIONS, MUSCLES, muscleLabel } from './muscle-taxonomy.js';

export const TODAY = 'Sze';

/** What already happened this week: the finished gym days and the logged sports. */
export const WEEK_LOG = {
  doneDays: ['Hét'],
  sports: [
    { name: 'Röplabda', icon: 'volley', day: 'K', minutes: 95, kcal: 610, note: 'váll és láb is dolgozott' },
  ],
};

export const regionOfMuscle = key => MUSCLES.find(m => m.key === key)?.region ?? null;

/**
 * Per muscle: the week's plan, what is already done, and what is left. The tracked muscles
 * bring their weekly series; a muscle only the days know (the wide back of a pull-up week)
 * still counts — its plan is simply what the days deliver. Work never disappears.
 */
export function weekLoad(meso = MESO, log = WEEK_LOG) {
  const planned = new Map(meso.muscles.map(m => [m.key, currentSets(m, meso)]));
  for (const day of meso.days) for (const row of dayLoad(day)) {
    if (!planned.has(row.key)) planned.set(row.key, 0);
  }
  for (const day of meso.days) for (const row of dayLoad(day)) {
    if (!meso.muscles.some(m => m.key === row.key)) planned.set(row.key, planned.get(row.key) + row.sets);
  }
  const done = new Map();
  for (const token of log.doneDays) {
    const day = dayByToken(token, meso);
    if (day) for (const row of dayLoad(day)) done.set(row.key, (done.get(row.key) ?? 0) + row.sets);
  }
  return [...planned].map(([key, ask]) => {
    const got = done.get(key) ?? 0;
    const tracked = meso.muscles.find(m => m.key === key);
    return { key, name: tracked?.name ?? muscleLabel(key), planned: ask, done: got, left: Math.max(0, ask - got) };
  });
}

/** The same story at the group level, the heads kept for the glass. */
export function groupLoad(meso = MESO, log = WEEK_LOG) {
  const groups = new Map();
  for (const row of weekLoad(meso, log)) {
    const region = regionOfMuscle(row.key);
    if (!region) continue;
    const meta = REGIONS.find(r => r.key === region);
    const group = groups.get(region) ?? { key: region, label: meta?.label ?? region, color: meta?.color ?? '#9c96b0', planned: 0, done: 0, heads: [] };
    group.planned += row.planned;
    group.done += row.done;
    group.heads.push(row);
    groups.set(region, group);
  }
  return [...groups.values()]
    .map(g => ({ ...g, share: g.planned ? Math.min(1, g.done / g.planned) : 0 }))
    .sort((a, b) => b.planned - a.planned);
}

/** The whole week in three numbers — done, planned, and the share between them. */
export function weekProgress(meso = MESO, log = WEEK_LOG) {
  const rows = weekLoad(meso, log);
  const done = rows.reduce((t, r) => t + r.done, 0);
  const planned = rows.reduce((t, r) => t + r.planned, 0);
  return { done, planned, share: planned ? Math.min(1, done / planned) : 0, phase: phaseOf(meso) };
}

/** Which day does what for the rest of the week, seen from the frozen today. */
export function weekDays(meso = MESO, log = WEEK_LOG, today = TODAY) {
  const at = token => DAY_ORDER.indexOf(token);
  return DAY_ORDER.map(token => {
    const day = dayByToken(token, meso);
    const state = log.doneDays.includes(token) ? 'done'
      : at(token) < at(today) ? (day ? 'missed' : 'rest')
      : at(token) === at(today) ? (day ? 'today' : 'rest-today')
      : day ? 'ahead' : 'rest';
    const sport = log.sports.find(s => s.day === token) ?? null;
    return { token, name: DAY_NAMES[token], type: day?.type ?? null, sets: day ? dayLoad(day).reduce((t, r) => t + r.sets, 0) : 0, state, sport };
  });
}

/** The strongest sentence the page can honestly say right now. */
export function loadStory(meso = MESO, log = WEEK_LOG) {
  const progress = weekProgress(meso, log);
  const groups = groupLoad(meso, log);
  const lead = groups.filter(g => g.done > 0).sort((a, b) => b.done - a.done)[0] ?? null;
  const today = weekDays(meso, log).find(d => d.state === 'today') ?? null;
  return {
    percent: Math.round(progress.share * 100),
    lead,
    today,
    say: lead
      ? `A ${lead.label.toLocaleLowerCase('hu')} vitte eddig a legtöbbet${today ? ` — ma este a ${today.type} jön` : ''}.`
      : 'Ez a hét még előtted áll.',
  };
}
