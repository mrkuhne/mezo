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
