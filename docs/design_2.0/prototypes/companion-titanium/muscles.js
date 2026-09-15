// The clay symbols and the body map for the taxonomy in muscle-taxonomy.js.
import { icon } from './nap.js';
import { REGIONS, MUSCLES, muscle, muscleLabel, muscleColor, TOKEN_SHAPES } from './muscle-taxonomy.js';
import { BODY } from './body-geometry.js';
export { REGIONS, MUSCLES, muscle, muscleLabel, muscleColor };

export const muscleIcon = key => icon(`m-${key}`);

/** The whole family, grouped by region — the map you can point at. */
export function muscleMapHtml(active = []) {
  const live = new Set(active);
  return `<section class="mm">
   <div class="mm-head"><span class="overline">IZOMTÉRKÉP</span><strong>Minden izomcsoport, saját jellel</strong><small>Egy régió — egy sziluett. A kiemelt rész mondja meg, melyik fejről van szó.</small></div>
   ${REGIONS.map(region => `<div class="mm-region" style="--mm-color:${region.color}">
     <div class="mm-region-head"><strong>${region.label}</strong><span>${MUSCLES.filter(m => m.region === region.key).length} izom</span></div>
     <div class="mm-grid">${MUSCLES.filter(m => m.region === region.key).map(m =>
       `<span class="mm-cell ${live.has(m.key) ? 'is-live' : ''}">${muscleIcon(m.key)}<small>${m.label}</small></span>`).join('')}</div>
   </div>`).join('')}
  </section>`;
}

/* ── the body map: real anatomy from the MIT MuscleMap geometry (see NOTICE.md) ───────── */

const silhouette = view =>
  `<g fill="url(#mg-body)" opacity=".42">${Object.values(BODY[view].p).flat().map(d => `<path d="${d}"/>`).join('')}</g>`;

/** Collapse tokens onto drawable shapes for one view; shared shapes sum their tokens. */
function shapeRows(view, entries) {
  const rows = new Map();
  for (const { key, value } of entries) {
    for (const [shapeView, slug] of TOKEN_SHAPES[key] ?? []) {
      if (shapeView !== view) continue;
      const row = rows.get(slug) ?? { slug, color: muscleColor(key), value: 0 };
      row.value += value;
      rows.set(slug, row);
    }
  }
  return [...rows.values()];
}

const heatPaths = (view, rows, alpha) => rows.map(row =>
  `<g fill="${row.color}" stroke="#ffffff33" stroke-width="1.5" opacity="${alpha(row.value).toFixed(2)}">${
    (BODY[view].p[row.slug] ?? []).map(d => `<path d="${d}"/>`).join('')}</g>`).join('');

const bodySvg = (view, inner, className) =>
  `<svg class="${className}" viewBox="${BODY[view].vb}" aria-hidden="true">${silhouette(view)}${inner}</svg>`;

/**
 * Every trained area lit on ONE figure. When the work spans both sides of the body we show the
 * side that carries the most of it — by sets when we know them, by count otherwise — because two
 * bodies side by side read as decoration; one reads as you.
 */
export function bodyMap(keys, { className = 'body-map', weights = null } = {}) {
  const entries = keys.filter(key => TOKEN_SHAPES[key]).map(key => ({ key, value: weights?.[key] ?? 1 }));
  if (!entries.length) return '';
  const weigh = view => entries.filter(e => TOKEN_SHAPES[e.key].some(([v]) => v === view)).reduce((t, e) => t + e.value, 0);
  const view = weigh('back') > weigh('front') ? 'back' : 'front';
  const rows = shapeRows(view, entries);
  const top = Math.max(1, ...rows.map(r => r.value));
  return bodySvg(view, heatPaths(view, rows, v => 0.4 + v / top * 0.55), className);
}

/**
 * Both views side by side with a heat per muscle — the load map. Each area keeps its region
 * color; how much of the week it already carries sets its strength. An untouched muscle stays
 * a faint outline: honestly empty, never invisible.
 */
export function bodyMapDuo(rows, { className = 'body-duo' } = {}) {
  const strength = state => state === 'none' ? 0.13 : state === 'started' ? 0.42 : state === 'ontrack' ? 0.7 : 1;
  const view = which => {
    const entries = rows.map(row => ({
      key: row.key,
      value: row.state === 'planned' ? 0.3 + row.value * 0.65 : strength(row.state),
    }));
    const shapes = shapeRows(which, entries).map(r => ({ ...r, value: Math.min(1, r.value) }));
    return bodySvg(which, heatPaths(which, shapes, v => v), 'body-duo-view');
  };
  return `<span class="${className}">${view('front')}${view('back')}</span>`;
}
