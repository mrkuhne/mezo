// Gyakorlatok — every move with the records you earned on it; the detail page tells one
// exercise's whole story: records, the strength curve, medals, and where it appears.
import { exerciseList, exerciseBySlug, whereUsed, libraryCounts, slugOf } from './exercise-state.js';
import { DAY_NAMES } from './plan-state.js';
import { REGIONS } from './muscle-taxonomy.js';
import { icon, safe } from './nap.js';
import { muscleIcon, muscleLabel, muscleColor } from './muscles.js';

const n = v => v.toLocaleString('hu-HU', { maximumFractionDigits: 1 });
const dateLabel = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
const info = (title, copy, art = 'info') =>
  `<button class="pl-info" data-detail="${safe(title)}" data-copy="${safe(copy)}" data-art="${art}" aria-label="${safe(title)} — mit jelent?">${icon('info')}</button>`;

/* ── the library page ────────────────────────────────────────────────────────────────── */

let filter = { query: '', region: '' };

const gyChips = () => `<button class="wz-chip ${filter.region ? '' : 'is-on'}" data-gy-region="">Mind</button>` +
  REGIONS.map(r => `<button class="wz-chip ${filter.region === r.key ? 'is-on' : ''}" style="--mus-color:${r.color}" data-gy-region="${r.key}">${r.label}</button>`).join('');

function gyRows() {
  const rows = exerciseList(filter.query, filter.region);
  if (!rows.length) return '<p class="wz-pick-none">Nincs ilyen gyakorlat a tárban.</p>';
  return rows.map(row => `<button class="gy-card" style="--mus-color:${muscleColor(row.muscle)}" data-route="train/3/${row.key}">
   ${muscleIcon(row.muscle)}
   <span class="gy-card-name"><strong>${safe(row.name)}</strong><small>${muscleLabel(row.muscle)}</small></span>
   ${row.logged
     ? `<span class="gy-card-best"><b>${n(row.logged.history.e1rm)} kg</b><small>becsült 1RM</small>
        <span class="gy-medals">${icon('record')}${row.logged.history.medals.length}</span></span>`
     : '<span class="gy-card-empty">még nincs naplózva</span>'}
   <b class="gy-card-go">›</b>
  </button>`).join('');
}

function gyHome() {
  const counts = libraryCounts();
  return `<div class="pl-sub gy">
   <header class="pl-dhero pl-lhero" style="--mus-color:#e0bd8a" data-reveal>
    <span class="pl-dhero-wash"></span>
    <div class="pl-lhero-art">${icon('book')}<i></i><i></i></div>
    <span class="overline">GYAKORLATOK</span>
    <h2>A mozdulataid</h2>
    <p class="pl-say">Minden gyakorlat egy helyen — a rekordjaiddal és a medáljaiddal együtt.</p>
    <div class="pl-poster-foot"><span>${counts.total} gyakorlat</span><span>${counts.logged} rekorddal</span><span>${counts.medals} medál</span></div>
   </header>
   <label class="wz-pick-search gy-search"><input id="gy-search" type="search" placeholder="Keresés névre vagy izomra…" autocomplete="off" value="${safe(filter.query)}"></label>
   <div class="wz-chips wz-pick-chips" id="gy-chips" role="group" aria-label="Izomcsoport-szűrő">${gyChips()}</div>
   <div id="gy-list" class="gy-list">${gyRows()}</div>
  </div>`;
}

/* ── one exercise's story ────────────────────────────────────────────────────────────── */

/** The strength curve: the estimated max so far, and where the plan expects it to go. */
function curve(history) {
  const points = [...history.trajectory, ...history.projected];
  const low = Math.min(...points), span = Math.max(...points) - low || 1;
  const w = 300, h = 76, step = w / (points.length - 1);
  const at = (v, i) => `${(i * step).toFixed(1)},${(h - 8 - (v - low) / span * (h - 20)).toFixed(1)}`;
  const solid = history.trajectory.map((v, i) => at(v, i)).join(' ');
  const dashed = points.map((v, i) => at(v, i)).slice(history.trajectory.length - 1).join(' ');
  const [lx, ly] = at(history.trajectory.at(-1), history.trajectory.length - 1).split(',');
  return `<svg class="gy-curve" viewBox="0 0 ${w} ${h}" role="img" aria-label="Becsült maximum: ${n(history.e1rm)} kg, emelkedő ív">
   <polyline class="gy-curve-was" points="${solid}"/>
   <polyline class="gy-curve-will" points="${dashed}"/>
   <circle class="gy-curve-now" cx="${lx}" cy="${ly}" r="4"/>
  </svg>`;
}

function gyDetail(row) {
  const h = row.logged?.history;
  const used = whereUsed(row.name);
  const usedRows = [
    ...used.days.map(d => `<button class="pl-row" data-route="train/1/day/${encodeURIComponent(d.day)}">
      <span><strong>${d.type}</strong><small>A futó tervedben · ${DAY_NAMES[d.day]}</small></span><b>›</b></button>`),
    ...used.templates.map(t => `<button class="pl-row" data-route="train/1/library/template/${t.key}">
      <span><strong>${safe(t.name)}</strong><small>Sablon a polcodon</small></span><b>›</b></button>`),
  ].join('');
  const usedSec = usedRows ? `<h3 class="pl-h3">Hol szerepel</h3>${usedRows}` : '';

  const hero = `<header class="pl-dhero gy-hero" style="--mus-color:${muscleColor(row.muscle)}" data-reveal>
   <span class="pl-dhero-wash"></span>
   <div class="gy-hero-art">${muscleIcon(row.muscle)}<i></i><i></i></div>
   <span class="overline">${muscleLabel(row.muscle).toUpperCase()}</span>
   <h2>${safe(row.name)}</h2>
   ${h ? `<p class="pl-say">${row.logged.cue}</p>
   <div class="pl-poster-foot"><span>${h.sessions} alkalom</span><span>${dateLabel(h.since)} óta</span><span>${n(h.volume / 1000)} t összsúly</span></div>`
   : '<p class="pl-say">Ezzel a gyakorlattal még nincs naplózott alkalmad — az első edzés után itt gyűlnek a rekordjaid.</p>'}
  </header>`;

  if (!h) return `<div class="pl-sub gy">
   <button class="pl-back" data-route="train/3">‹ Gyakorlatok</button>
   ${hero}${usedSec}
  </div>`;

  const recs = `<h3 class="pl-h3">Rekordjaid ${info('Mi számít rekordnak?', 'A legjobb szett a legnagyobb súly a hozzá tartozó ismétléssel. A becsült maximum egy képletből jön a szettjeidből — becslés, nem mérés. A volumen egy alkalom összes megmozgatott súlya.')}</h3>
  <div class="gy-recs" data-reveal>
   <div class="gy-rec"><span class="overline">BECSÜLT 1RM</span><strong>${n(h.e1rm)} <small>kg</small></strong>
    <i class="gy-rec-bar"><b style="--w:${Math.min(100, h.e1rm / (h.projected.at(-1) || h.e1rm) * 100)}%"></b></i>
    <small>${h.e1rmPrev < h.e1rm ? `+${n(h.e1rm - h.e1rmPrev)} kg a múltkori óta` : 'tartod a szinted'}</small></div>
   <div class="gy-rec"><span class="overline">LEGJOBB SZETT</span><strong>${n(h.best.kg)} <small>kg × ${h.best.reps}</small></strong>
    <i class="gy-rec-bar"><b style="--w:100%"></b></i><small>${dateLabel(h.best.date)}</small></div>
   <div class="gy-rec"><span class="overline">LEGTÖBB VOLUMEN</span><strong>${n(h.maxVolume.value)} <small>kg × rep</small></strong>
    <i class="gy-rec-bar"><b style="--w:${Math.min(100, h.lastVolume / h.maxVolume.value * 100)}%"></b></i>
    <small>legutóbb ${n(h.lastVolume)} — ${dateLabel(h.maxVolume.date)} a csúcs</small></div>
  </div>
  <p class="gy-next" data-reveal>${icon('record')} Következő cél: <b>${n(h.nextRecord.kg)} kg × ${h.nextRecord.reps}</b> — ${h.nextRecord.note}.</p>`;

  const growth = `<h3 class="pl-h3">Az erőd íve ${info('Mit mutat a vonal?', 'A becsült egyismétléses maximumod alakulása alkalomról alkalomra. A szaggatott rész a terv várakozása a következő hetekre — becslés, nem ígéret.')}</h3>
  <div class="gy-curve-box" data-reveal>
   <span class="gy-curve-val"><b data-fuel-count="${h.e1rm}">0</b><small>kg most</small></span>
   ${curve(h)}
   <span class="gy-curve-cap"><i>eddig</i><i class="is-will">a terv várakozása</i></span>
  </div>`;

  const medals = `<h3 class="pl-h3">Medáljaid</h3>
  <div class="gy-medal-rows" data-reveal>${h.medals.map(m => `<span class="gy-medal">
   ${icon('record')}<span><strong>${m.kind}</strong><small>${m.value}</small></span><small class="gy-medal-date">${dateLabel(m.date)}</small></span>`).join('')}</div>`;

  return `<div class="pl-sub gy">
   <button class="pl-back" data-route="train/3">‹ Gyakorlatok</button>
   ${hero}${recs}${growth}${medals}${usedSec}
  </div>`;
}

/* ── entry + wiring ──────────────────────────────────────────────────────────────────── */

export function gyakContent() {
  const key = location.hash.slice(1).split('/')[2] ?? '';
  if (key) {
    const row = exerciseBySlug(decodeURIComponent(key));
    if (row) return gyDetail(row);
  }
  return gyHome();
}

export function initGyak() {
  document.addEventListener('input', event => {
    if (event.target.id !== 'gy-search') return;
    filter.query = event.target.value;
    document.querySelector('#gy-list').innerHTML = gyRows();
  });
  document.addEventListener('click', event => {
    const el = event.target.closest('[data-gy-region]');
    if (!el) return;
    filter.region = el.dataset.gyRegion;
    document.querySelector('#gy-chips').innerHTML = gyChips();
    document.querySelector('#gy-list').innerHTML = gyRows();
  });
}
