// The clay symbols and the body map for the taxonomy in muscle-taxonomy.js.
import { icon } from './nap.js';
import { REGIONS, MUSCLES, muscle, muscleLabel, muscleColor } from './muscle-taxonomy.js';
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

/* ── the body map: one figure, every trained area lit at once ─────────────────────────── */

const FIGURE = '<circle cx="32" cy="8.5" r="5.4"/>'
  + '<path d="M25 15h14l6 3 2.4 11-5 1.2-2.4-7 .8 12-2 10H25.2l-2-10 .8-12-2.4 7-5-1.2L19 18Z"/>'
  + '<path d="M18.4 19.6 14 22l-3 12.4 4.2 1.2 3.2-11Z"/><path d="M14.9 36.2 12.6 48l4.2 1.2 3.2-11.8Z"/>'
  + '<path d="M45.6 19.6 50 22l3 12.4-4.2 1.2-3.2-11Z"/><path d="M49.1 36.2 51.4 48l-4.2 1.2-3.2-11.8Z"/>'
  + '<path d="M25 42h6.2l-.8 9.4.8 11.6h-6.2l-.8-11.6Z"/><path d="M32.8 42H39l.8 9.4-.8 11.6h-6.2l-.8-11.6Z"/>';

const SPINE = '<path d="M32 16.5v25" stroke="#00000070" stroke-width="1.6" stroke-linecap="round" fill="none"/>'
  + '<path d="M27 19.6c1.4 2.8 2.8 4.4 4.6 5.4M37 19.6c-1.4 2.8-2.8 4.4-4.6 5.4" fill="none" stroke="#00000055" stroke-width="1.3" stroke-linecap="round"/>';

const blob = (cx, cy, rx, ry, rot = 0) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''}/>`;
const pair = (cx, cy, rx, ry, rot = 0) => blob(cx, cy, rx, ry, rot) + blob(64 - cx, cy, rx, ry, -rot);

/** Where each muscle sits on the figure, and which way the figure has to be facing. */
const AREAS = {
  'chest-upper': ['front', blob(32, 19.5, 8.6, 2.4)],
  'chest-mid': ['front', blob(32, 23.5, 9.2, 2.8)],
  'chest-lower': ['front', blob(32, 27.5, 8.2, 2.4)],
  traps: ['back', blob(32, 16.8, 9.4, 2.6) + pair(25, 18.6, 3.4, 2)],
  'back-wide': ['back', pair(26, 25, 4, 6.6, 12)],
  'back-mid': ['back', blob(32, 26, 7.6, 4)],
  'back-lower': ['back', blob(32, 35.5, 6.4, 3.4)],
  'shoulder-front': ['front', pair(22.6, 19.4, 3.6, 3.2)],
  'shoulder-side': ['front', pair(19.4, 21.4, 3.2, 3.8, 18)],
  'shoulder-rear': ['back', pair(21.4, 20.6, 3.4, 3.2, -12)],
  'biceps-long': ['front', pair(16.6, 26, 2.6, 4.2, 14)],
  'biceps-short': ['front', pair(15.6, 31, 2.6, 3.6, 14)],
  'biceps-brachialis': ['front', pair(14.6, 35.6, 2.4, 3, 14)],
  'triceps-long': ['back', pair(17.4, 25.4, 2.6, 4.2, 14)],
  'triceps-lateral': ['back', pair(16.2, 31, 2.6, 3.6, 14)],
  'triceps-medial': ['back', pair(15, 36, 2.4, 3, 14)],
  quad: ['front', pair(27.8, 46.8, 3.2, 5.6)],
  ham: ['back', pair(27.8, 47.6, 3, 5.2)],
  glute: ['back', pair(28, 41.4, 3.8, 3.2)],
  calf: ['back', pair(27.6, 57, 2.8, 4.2)],
  core: ['front', blob(32, 31, 5.6, 3) + blob(32, 36.5, 5.2, 2.8) + blob(32, 41, 4.6, 2.4)],
};

const figure = (keys, view, dx = 0) => `<g transform="translate(${dx} 0)">
  <g fill="url(#mg-body)" filter="url(#shadow)" opacity=".5">${FIGURE}${view === 'back' ? SPINE : ''}</g>
  ${keys.map(key => `<g fill="${muscleColor(key)}" stroke="#ffffff70" stroke-width=".5" opacity=".92">${AREAS[key][1]}</g>`).join('')}
 </g>`;

/**
 * Every trained area lit on ONE figure. When the work spans both sides of the body we show the
 * side that carries the most of it — by sets when we know them, by count otherwise — because two
 * silhouettes side by side read as two icons rather than one picture.
 */
export function bodyMap(keys, { className = 'body-map', weights = null } = {}) {
  const known = keys.filter(key => AREAS[key]);
  if (!known.length) return '';
  const front = known.filter(key => AREAS[key][0] === 'front');
  const back = known.filter(key => AREAS[key][0] === 'back');
  const weigh = list => list.reduce((total, key) => total + (weights?.[key] ?? 1), 0);
  const view = weigh(back) > weigh(front) ? 'back' : 'front';
  const shown = view === 'back' ? back : front;
  return `<svg class="${className}" viewBox="0 0 64 64" aria-hidden="true">${figure(shown, view)}</svg>`;
}

/**
 * Both views side by side with a heat per muscle — the load map. Each area keeps its region
 * color; how much of the week it already carries sets its strength. An untouched muscle stays
 * a faint outline: honestly empty, never invisible.
 */
export function bodyMapDuo(rows, { className = 'body-duo' } = {}) {
  const strength = row =>
    row.state === 'planned' ? 0.3 + row.value * 0.65
    : row.state === 'none' ? 0.14
    : row.state === 'started' ? 0.45
    : row.state === 'ontrack' ? 0.72 : 1;
  const view = (which, dx) => `<g transform="translate(${dx} 0)">
   <g fill="url(#mg-body)" filter="url(#shadow)" opacity=".5">${FIGURE}${which === 'back' ? SPINE : ''}</g>
   ${rows.filter(row => AREAS[row.key]?.[0] === which).map(row =>
     `<g fill="${muscleColor(row.key)}" stroke="#ffffff55" stroke-width=".4" opacity="${strength(row).toFixed(2)}">${AREAS[row.key][1]}</g>`).join('')}
  </g>`;
  return `<svg class="${className}" viewBox="0 0 132 64" aria-hidden="true">${view('front', 0)}${view('back', 68)}</svg>`;
}
