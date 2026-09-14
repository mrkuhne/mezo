// The muscle taxonomy the production app already speaks: 21 live catalog muscles in six regions.
// Each one has its own clay symbol (#i-m-<key>) — same family silhouette per region, the specific
// head lit — so a glance says "shoulder" and a second glance says "which part of it".
import { icon } from './nap.js';

export const REGIONS = [
  { key: 'chest', label: 'Mell', color: '#e08a7c' },
  { key: 'back', label: 'Hát', color: '#78cfe7' },
  { key: 'shoulder', label: 'Váll', color: '#bca6f1' },
  { key: 'arm', label: 'Kar', color: '#e79ab8' },
  { key: 'leg', label: 'Láb', color: '#b3d97e' },
  { key: 'core', label: 'Core', color: '#e0bd8a' },
];

export const MUSCLES = [
  { key: 'chest-upper', label: 'Mell (felső)', region: 'chest' },
  { key: 'chest-mid', label: 'Mell (közép)', region: 'chest' },
  { key: 'chest-lower', label: 'Mell (alsó)', region: 'chest' },
  { key: 'back-wide', label: 'Hát (széles)', region: 'back' },
  { key: 'back-mid', label: 'Hát (közép)', region: 'back' },
  { key: 'back-lower', label: 'Hát (alsó)', region: 'back' },
  { key: 'traps', label: 'Trapéz', region: 'back' },
  { key: 'shoulder-front', label: 'Váll (első)', region: 'shoulder' },
  { key: 'shoulder-side', label: 'Váll (oldalsó)', region: 'shoulder' },
  { key: 'shoulder-rear', label: 'Váll (hátsó)', region: 'shoulder' },
  { key: 'biceps-long', label: 'Bicepsz (hosszú fej)', region: 'arm' },
  { key: 'biceps-short', label: 'Bicepsz (rövid fej)', region: 'arm' },
  { key: 'biceps-brachialis', label: 'Brachialis', region: 'arm' },
  { key: 'triceps-long', label: 'Tricepsz (hosszú fej)', region: 'arm' },
  { key: 'triceps-lateral', label: 'Tricepsz (oldalsó fej)', region: 'arm' },
  { key: 'triceps-medial', label: 'Tricepsz (mediális fej)', region: 'arm' },
  { key: 'quad', label: 'Comb', region: 'leg' },
  { key: 'ham', label: 'Lábhajlító', region: 'leg' },
  { key: 'glute', label: 'Far', region: 'leg' },
  { key: 'calf', label: 'Vádli', region: 'leg' },
  { key: 'core', label: 'Core', region: 'core' },
];

const byKey = Object.fromEntries(MUSCLES.map(m => [m.key, m]));
const regionByKey = Object.fromEntries(REGIONS.map(r => [r.key, r]));

export const muscle = key => byKey[key] ?? null;
export const muscleLabel = key => byKey[key]?.label ?? key;
export const muscleColor = key => regionByKey[byKey[key]?.region]?.color ?? '#9c96b0';
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
 * Every area the session trains, lit on one figure — and on two when the work spans both sides of
 * the body, because a quad and a hamstring cannot honestly share a silhouette.
 */
export function bodyMap(keys, { className = 'body-map' } = {}) {
  const known = keys.filter(key => AREAS[key]);
  const front = known.filter(key => AREAS[key][0] === 'front');
  const back = known.filter(key => AREAS[key][0] === 'back');
  if (!front.length && !back.length) return '';
  if (!back.length) return `<svg class="${className}" viewBox="0 0 64 64" aria-hidden="true">${figure(front, 'front')}</svg>`;
  if (!front.length) return `<svg class="${className}" viewBox="0 0 64 64" aria-hidden="true">${figure(back, 'back')}</svg>`;
  return `<svg class="${className} is-pair" viewBox="0 0 132 64" aria-hidden="true">${figure(front, 'front')}${figure(back, 'back', 68)}</svg>`;
}
