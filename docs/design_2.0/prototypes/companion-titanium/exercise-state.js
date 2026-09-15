// The exercise library: every move the app knows, joined with the records you earned on it.
// Pure functions only — the pages live in gyak-pages.js.
import { CATALOG, searchCatalog } from './plan-wizard-state.js';
import { EXERCISES } from './session-state.js';
import { MESO, LIBRARY } from './plan-state.js';

/** Accent-blind kebab slug, stable enough for a hash route. */
export const slugOf = name =>
  name.toLocaleLowerCase('hu').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const recordsByName = new Map(EXERCISES.map(e => [e.name, e]));

/** One row per catalog move: its muscle, and the logged story when there is one. */
export function exerciseList(query = '', region = '') {
  return searchCatalog(query, region).map(item => {
    const logged = recordsByName.get(item.name) ?? null;
    return { key: slugOf(item.name), name: item.name, muscle: item.muscle, kg: item.kg, logged };
  });
}

export const exerciseBySlug = key => exerciseList().find(row => row.key === key) ?? null;

/** Where the move shows up: the running plan's days and the templates on the shelf. */
export function whereUsed(name, meso = MESO, library = LIBRARY) {
  const days = meso.days
    .filter(day => day.exercises.some(e => e.name === name))
    .map(day => ({ day: day.day, type: day.type }));
  const templates = library.templates
    .filter(t => t.key !== library.active.from && (t.days ?? []).some(day => day.exercises.some(e => e.name === name)))
    .map(t => ({ key: t.key, name: t.name }));
  return { days, templates };
}

/** The library's headline numbers — only what is really there. */
export function libraryCounts() {
  const rows = exerciseList();
  const logged = rows.filter(r => r.logged);
  return {
    total: rows.length,
    logged: logged.length,
    medals: logged.reduce((t, r) => t + r.logged.history.medals.length, 0),
  };
}
