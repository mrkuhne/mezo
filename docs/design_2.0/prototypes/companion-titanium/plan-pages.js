// Terv — the running mesocycle is the page, not a row in a library (owner decision 2026-09-13).
// Landing = the block's state; from it a day, the week's muscle review, and one muscle's story.
import {
  MESO, DAY_ORDER, DAY_NAMES, TIERS, phaseOf, isDeloadWeek, ceilingOf, setsAt, currentSets,
  peakWeek, nextRollover, bandPosition, dayByToken, dayLoad, daySets, whereItWorks, weekTotal,
  adjacencyNotes,
} from './plan-state.js';
import { icon, safe } from './nap.js';
import { muscleIcon, muscleLabel, muscleColor } from './muscles.js';

const n = v => v.toLocaleString('hu-HU', { maximumFractionDigits: 1 });
const dateLabel = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
const route = (...parts) => `data-route="train/1${parts.length ? '/' + parts.join('/') : ''}"`;

/* ── shared pieces ───────────────────────────────────────────────────────────────────── */

/** The block's ramp: one bar per week, this week lit, the deload hatched. */
function weekArc(meso, muscle = null) {
  const values = Array.from({ length: meso.weeks }, (_, i) =>
    (muscle ? setsAt(muscle, i + 1) : weekTotal(meso, i + 1)));
  // Scaled from the block's own floor, so a +2 ramp is visible instead of five near-equal bars.
  const low = Math.min(...values), high = Math.max(...values), span = high - low || 1;
  return `<div class="pl-arc" aria-hidden="true">${values.map((value, i) => {
    const week = i + 1;
    const state = isDeloadWeek(meso, week) ? 'is-deload' : week === meso.currentWeek ? 'is-now' : week < meso.currentWeek ? 'is-past' : '';
    return `<i class="${state}" style="--h:${Math.round(22 + (value - low) / span * 78)}%"><b>${week}</b></i>`;
  }).join('')}</div>`;
}

/** Where a muscle stands between its landmarks, with the ceiling marked. */
function band(muscle) {
  const p = bandPosition(muscle);
  return `<span class="pl-band" style="--mus-color:${muscleColor(muscle.key)}">
   <i class="zone" style="--a:${p.mev * 100}%;--b:${p.mav * 100}%"></i>
   <i class="fill" style="--w:${p.share * 100}%"></i>
   <u class="ceil" style="--at:${p.ceiling / muscle.mrv * 100}%"></u>
  </span>`;
}

const tierChip = muscle => `<span class="pl-tier is-${muscle.tier}">${TIERS[muscle.tier].label}</span>`;

/* ── landing: the running block ──────────────────────────────────────────────────────── */

function planHome() {
  const meso = MESO, phase = phaseOf(meso), soon = nextRollover(meso);
  const total = weekTotal(meso), lastWeek = weekTotal(meso, meso.currentWeek - 1);
  const delta = total - lastWeek;
  const climbing = soon.rows.filter(r => r.move === 'up').length;

  const poster = `<section class="pl-poster">
   <span class="pl-poster-glow" aria-hidden="true"></span>
   <span class="pl-poster-top"><span class="overline">AKTÍV MEZOCIKLUS</span><span class="pl-phase is-${phase.key}">${phase.label}</span></span>
   <h2>${meso.name}</h2>
   <p>${meso.goal}</p>
   ${weekArc(meso)}
   <div class="pl-poster-foot"><span>${meso.currentWeek}. hét / ${meso.weeks}</span><span>${dateLabel(meso.start)} – ${dateLabel(meso.end)}</span><span>${meso.split}</span></div>
  </section>`;

  const decider = `<div class="pl-decider">${icon('chat')}<p>A múlt heti célt hoztad, darálás nélkül — ezért ${climbing} izom szettszáma nőtt erre a hétre. ${
    isDeloadWeek(meso, meso.currentWeek + 1) ? 'A jövő hét már deload: mindenből visszaveszünk.' : `A csúcshét az ${peakWeek(meso)}. lesz.`}</p></div>`;

  const week = `<button class="pl-card is-tappable" ${route('week')}>
   <span class="pl-card-head"><span class="overline">HETI VIZSGÁLAT</span><strong>${total} szett ezen a héten</strong><small>${delta >= 0 ? `+${delta}` : delta} szett a múlt héthez · ${climbing} izom rámpázik</small></span>
   <span class="pl-mini">${meso.muscles.slice(0, 5).map(m => `<i style="--mus-color:${muscleColor(m.key)};--h:${Math.round(currentSets(m) / m.mrv * 100)}%"></i>`).join('')}</span>
   <b>↗</b></button>`;

  const days = `<div class="food-list-heading"><h2>A heted</h2><span>KOPPINTS EGY NAPRA</span></div>
   <div class="pl-days">${DAY_ORDER.map(token => {
    const day = dayByToken(token);
    if (!day) return `<div class="pl-day is-rest"><small>${token}</small>${icon('moon')}<span>pihenő</span></div>`;
    const load = dayLoad(day);
    return `<button class="pl-day ${token === 'Sze' ? 'is-now' : ''}" ${route('day', token)}>
     <small>${token}</small>
     <strong>${day.type}</strong>
     <span class="pl-day-meta">${daySets(day)} szett · ~${day.minutes}′</span>
     <span class="pl-day-bars">${load.map(r => `<i style="--mus-color:${muscleColor(r.key)};--h:${Math.min(100, r.sets / 8 * 100)}%"></i>`).join('')}</span>
    </button>`;
  }).join('')}</div>`;

  const rollover = `<div class="pl-card is-quiet">
   <span class="pl-card-head"><span class="overline">HÉTFŐN JÖN</span><strong>${soon.deload ? 'Deload hét' : `${climbing} izom lép feljebb`}</strong><small>A heti görgetés hajnalban fut. Ez előrejelzés, nem gomb.</small></span>
   <span class="pl-chips">${soon.rows.filter(r => r.move !== 'hold').slice(0, 5).map(r =>
    `<span class="pl-chip is-${r.move}">${muscleIcon(r.key)}${r.name}<b>${r.move === 'deload' ? `${r.next}` : `+${r.delta}`}</b></span>`).join('')
    || '<span class="pl-chip is-hold">Minden izom tart</span>'}</span>
  </div>`;

  const library = `<button class="pl-library" ${route('library')}>${icon('stack')}<span><strong>Sablonok és korábbi futamok</strong><small>Amiből indíthatsz, és amit már lezártál</small></span><b>›</b></button>`;

  const close = `<button class="pl-close" data-detail="Meso lezárása" data-copy="A lezárás pillanatában készül el a befagyasztott zárójelentés: kitartás, volumen-ív, erőnövekedés, rekordok. Utána a blokk az archívumba kerül, és indíthatsz újat." data-art="stack">${icon('tick')}<span>Meso lezárása</span></button>`;

  return `${poster}${decider}${week}${days}${rollover}${library}${close}`;
}

/* ── a day of the block ──────────────────────────────────────────────────────────────── */

function planDay(token) {
  const day = dayByToken(token);
  if (!day) return `<div class="pl-empty">${icon('moon')}<h2>Ez a nap nincs a blokkban.</h2><p>A ${DAY_NAMES[token] ?? token} pihenőnap ebben a mezociklusban.</p><button class="pl-back" ${route()}>Vissza a blokkhoz</button></div>`;
  const load = dayLoad(day);
  return `<div class="pl-sub">
   <button class="pl-back" ${route()}>‹ A blokk</button>
   <header class="pl-sub-head"><span class="overline">${DAY_NAMES[token]} · ${MESO.currentWeek}. HÉT</span><h2>${day.type}</h2>
    <p>${daySets(day)} szett · ~${day.minutes} perc · ${day.exercises.length} gyakorlat</p>
    <small>A szerkesztés a következő edzéstől él — a mai futó edzésedet nem írja át.</small></header>

   <div class="wo-sum-section"><strong>Amit ez a nap kér</strong></div>
   <div class="pl-dayload">${load.map(r => `<div class="pl-dayload-row" style="--mus-color:${muscleColor(r.key)}">
     ${muscleIcon(r.key)}<span>${muscleLabel(r.key)}</span>
     <span class="pl-dayload-track"><i style="--w:${Math.min(100, r.sets / 8 * 100)}%"></i></span>
     <b>${r.sets}<i>/8</i></b></div>`).join('')}</div>
   <p class="pl-note">A nyolc szett egy izomra egy edzésen belül nem tiltás, csak jelzés: efölött romlik a megtérülés.</p>

   <div class="wo-sum-section"><strong>A nap gyakorlatai</strong></div>
   <div class="pl-exs">${day.exercises.map((e, i) => `<div class="pl-ex" style="--ex-color:${muscleColor(e.muscle)}">
     <span class="pl-ex-art">${muscleIcon(e.muscle)}</span>
     <span class="pl-ex-copy"><strong>${e.name}</strong><small>${muscleLabel(e.muscle)}</small></span>
     <span class="pl-ex-move"><button data-detail="Sorrend" data-copy="A gyakorlatok sorrendje a nap sorrendje. Az új felületen fel-le nyilakkal rendezed, nem húzással." data-art="stack" ${i === 0 ? 'disabled' : ''} aria-label="Előrébb">↑</button><button data-detail="Sorrend" data-copy="A gyakorlatok sorrendje a nap sorrendje. Az új felületen fel-le nyilakkal rendezed, nem húzással." data-art="stack" ${i === day.exercises.length - 1 ? 'disabled' : ''} aria-label="Hátrébb">↓</button></span>
     <span class="pl-ex-recipe">
      <span><b>${e.sets}</b><small>éles</small></span>
      <span><b>${e.warmup}</b><small>bemelegítő</small></span>
      <span><b>${e.repMin ? `${e.repMin}–${e.repMax}` : '—'}</b><small>ismétlés</small></span>
      <span><b>${e.rir}</b><small>RIR</small></span>
      <span><b>${e.kg ? `${n(e.kg)} kg` : 'auto'}</b><small>kiinduló</small></span>
     </span>
    </div>`).join('')}</div>
   <button class="pl-add" data-detail="Gyakorlat hozzáadása" data-copy="A katalógusból választasz: keresés, izomcsoport-szűrő, demókép és videó. Egy megnyitásból többet is hozzáadhatsz." data-art="book">＋ Gyakorlat hozzáadása</button>
  </div>`;
}

/* ── the week's muscle review ────────────────────────────────────────────────────────── */

function planWeek() {
  const meso = MESO, total = weekTotal(meso), last = weekTotal(meso, meso.currentWeek - 1);
  const soon = nextRollover(meso);
  const notes = adjacencyNotes(meso);
  return `<div class="pl-sub">
   <button class="pl-back" ${route()}>‹ A blokk</button>
   <header class="pl-sub-head"><span class="overline">${meso.currentWeek}. HÉT · ${phaseOf(meso).label.toLocaleUpperCase('hu-HU')}</span><h2>Heti vizsgálat</h2>
    <p>${total} szett ezen a héten · ${total - last >= 0 ? `+${total - last}` : total - last} a múlt héthez képest</p></header>

   <div class="pl-legend"><span><i class="k-zone"></i>optimális sáv</span><span><i class="k-fill"></i>most</span><span><i class="k-ceil"></i>a te plafonod</span></div>

   <div class="pl-muscles">${meso.muscles.map((muscle, i) => {
    const p = bandPosition(muscle), row = soon.rows.find(r => r.key === muscle.key);
    return `<button class="pl-muscle" style="--mus-color:${muscleColor(muscle.key)};--i:${i}" ${route('muscle', muscle.key)}>
     <span class="pl-muscle-head">${muscleIcon(muscle.key)}<strong>${muscle.name}</strong>${tierChip(muscle)}<span class="pl-muscle-freq">${muscle.freq}× / hét</span></span>
     <span class="pl-muscle-count"><b>${p.now}</b><i>/ ${p.ceiling} szett</i></span>
     ${band(muscle)}
     <span class="pl-muscle-foot">${p.atCeiling ? 'A plafonodon vagy — innen tartás.' : `Még ${p.ceiling - p.now} szett fér bele.`}${row && row.move === 'up' ? ` Hétfőn +${row.delta}.` : ''}</span>
    </button>`;
  }).join('')}</div>

   <div class="pl-lint">${icon('chat')}<p>${notes.length
    ? `${notes.map(note => `${muscleLabel(note.key)}: ${note.from} és ${note.to} egymás után.`).join(' ')} Nem hiba — csak érdemes tudni.`
    : 'Nincs két egymást követő nap ugyanarra az izomra. A pihenőnapok jó helyen vannak.'}</p></div>
  </div>`;
}

/* ── one muscle's whole story ────────────────────────────────────────────────────────── */

function planMuscle(key) {
  const muscle = MESO.muscles.find(m => m.key === key);
  if (!muscle) return `<div class="pl-empty">${icon('chat')}<h2>Ez az izom nincs a heti vizsgálatban.</h2><p>Csak azok szerepelnek, amikhez a blokkod tartozik terhelést rendel.</p><button class="pl-back" ${route('week')}>Vissza a heti vizsgálathoz</button></div>`;
  const p = bandPosition(muscle), rows = whereItWorks(key), soon = nextRollover(MESO).rows.find(r => r.key === key);
  return `<div class="pl-sub" style="--mus-color:${muscleColor(key)}">
   <button class="pl-back" ${route('week')}>‹ Heti vizsgálat</button>
   <header class="pl-sub-head pl-muscle-head-page">
    <span class="pl-muscle-art">${muscleIcon(key)}</span>
    <span><span class="overline">${TIERS[muscle.tier].label.toLocaleUpperCase('hu-HU')} · ${muscle.freq}× / HÉT</span><h2>${muscle.name}</h2>
    <p><b>${p.now}</b> szett most · a plafonod ${p.ceiling}</p></span></header>

   <div class="wo-sum-section"><strong>Hol tartasz a sávban</strong></div>
   ${band(muscle)}
   <div class="pl-scale"><span>alsó határ ${muscle.mev}</span><span>optimum ${muscle.mav}</span><span>felső határ ${muscle.mrv}</span></div>

   <div class="wo-sum-section"><strong>A blokk íve</strong></div>
   ${weekArc(MESO, muscle)}
   <p class="pl-note">${muscle.tier === 'maintain'
    ? 'Tartáson van: ezt az izmot nem rámpázzuk, csak megtartjuk, amíg máshol építesz.'
    : soon?.move === 'up' ? `Hétfőn +${soon.delta} szett jön, ha a hét célja megvan és nem volt darálós.`
      : 'A plafonodon áll — innen a következő blokk visz tovább.'}</p>

   <div class="wo-sum-section"><strong>Hol dolgozik ezen a héten</strong></div>
   <div class="pl-where">${rows.map(row => `<button class="pl-where-row" ${route('day', row.day)}>
     <span class="pl-where-day">${row.day}</span>
     <span><strong>${row.type}</strong><small>${row.exercises.map(e => e.name).join(' · ')}</small></span>
     <b>${row.sets} szett</b></button>`).join('')}</div>

   <div class="wo-sum-section"><strong>Honnan jön ez a szám</strong></div>
   <ol class="pl-steps">
    <li><span>Alapérték</span><b>${muscle.mev} szett</b><small>ennyitől kezd el fejlődni</small></li>
    <li><span>A fókuszod</span><b>${TIERS[muscle.tier].label}</b><small>ezért ${p.ceiling} a plafonod</small></li>
    <li><span>Heti rámpa</span><b>+2 / hét</b><small>amíg a cél megvan és nincs darálás</small></li>
    <li><span>Most</span><b>${p.now} szett</b><small>${MESO.currentWeek}. hét</small></li>
   </ol>
  </div>`;
}

/* ── the quiet library ───────────────────────────────────────────────────────────────── */

const planLibrary = () => `<div class="pl-sub">
  <button class="pl-back" ${route()}>‹ A blokk</button>
  <header class="pl-sub-head"><span class="overline">MÁSODLAGOS BELÉPŐ</span><h2>Sablonok és futamok</h2>
   <p>Ritkán kell — ezért került a futó blokkod mögé.</p></header>
  <div class="tr-soon">${icon('stack')}<span class="overline">KÖVETKEZŐ KÖR</span><strong>Ez a lap még nem épült át.</strong><p>Ide kerül a sablonkönyvtár, a tervező-varázsló, a tervezett futamok és a lezárt blokkok a zárójelentésükkel és az összevetéssel.</p></div>
 </div>`;

/* ── entry ───────────────────────────────────────────────────────────────────────────── */

export function planContent() {
  const [, , view = '', id = ''] = location.hash.slice(1).split('/');
  if (view === 'day') return planDay(decodeURIComponent(id));
  if (view === 'week') return planWeek();
  if (view === 'muscle') return planMuscle(id);
  if (view === 'library') return planLibrary();
  return planHome();
}

/** The landing keeps the tab's page heading; the subpages carry their own. */
export const planHasOwnHead = () => location.hash.slice(1).split('/')[2] !== undefined && location.hash.slice(1).split('/')[2] !== '';
