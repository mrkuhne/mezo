// Terv — the running mesocycle is the page, not a row in a library (owner decision 2026-09-13).
// Landing = the block's state; from it a day, the week's muscle review, and one muscle's story.
import {
  MESO, DAY_ORDER, DAY_NAMES, TIERS, phaseOf, isDeloadWeek, ceilingOf, setsAt, currentSets,
  peakWeek, nextRollover, bandPosition, dayByToken, dayLoad, daySets, whereItWorks, weekTotal,
  adjacencyNotes,
} from './plan-state.js';
import { icon, safe } from './nap.js';
import { muscleIcon, muscleLabel, muscleColor, bodyMap } from './muscles.js';

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
   <u class="ceil" style="--at:${Math.min(99, p.ceiling / muscle.mrv * 100)}%"></u>
  </span>`;
}

const tierChip = muscle => `<span class="pl-tier is-${muscle.tier}">${TIERS[muscle.tier].label}</span>`;


/** Everything on these pages says its meaning in words first; the numbers only back it up. */
const room = muscle => ceilingOf(muscle) - currentSets(muscle);

function verdict(muscle) {
  if (muscle.tier === 'maintain') return 'Ezt most szinten tartod.';
  const left = room(muscle);
  if (left <= 0) return 'Elérte a maximumot ebben a tervben.';
  if (left <= 2) return `Majdnem a maximumon — még ${left} szett fér bele.`;
  return `Még ${left} szett fér bele.`;
}

const plural = (count, one, many) => (count === 1 ? one : many);

/* ── landing: the running block ──────────────────────────────────────────────────────── */

function planHome() {
  const meso = MESO, soon = nextRollover(meso);
  const total = weekTotal(meso), last = weekTotal(meso, meso.currentWeek - 1), delta = total - last;
  const weeksToDeload = meso.weeks - meso.currentWeek;
  const done = (meso.currentWeek - 1) / meso.weeks * 100;

  const headline = `A hat hétből a ${meso.currentWeek}. héten jársz.`;
  const line = `${delta > 0 ? `Ez a hét ${delta} szettel több, mint a múlt heti` : delta < 0 ? `Ez a hét ${-delta} szettel kevesebb` : 'Ez a hét ugyanannyi, mint a múlt heti'} — összesen ${total} szett, ${meso.days.length} edzésnapra osztva.${
    weeksToDeload === 1 ? ' A jövő hét már pihenőhét.' : weeksToDeload > 0 ? ` ${weeksToDeload} hét múlva jön a pihenőhét.` : ''}`;

  const poster = `<section class="pl-poster">
   <span class="pl-poster-glow" aria-hidden="true"></span>
   <span class="pl-poster-sheen" aria-hidden="true"></span>
   <div class="pl-poster-top">
    <div class="pl-week"><strong data-fuel-count="${meso.currentWeek}">0</strong><small>. hét</small><i>/ ${meso.weeks}</i></div>
    <div class="pl-ring" style="--p:${done}" aria-hidden="true">
     <svg viewBox="0 0 72 72"><circle class="t" cx="36" cy="36" r="31" pathLength="100"/><circle class="f" cx="36" cy="36" r="31" pathLength="100"/></svg>
     <b>${icon('stack')}</b>
    </div>
   </div>
   <h2>${meso.name}</h2>
   <p class="pl-say">${headline}</p>
   <p class="pl-sub-say">${line}</p>
   ${weekArc(meso)}
  </section>`;

  const days = `<h3 class="pl-h3">A heted</h3>
   <div class="pl-days">${DAY_ORDER.map((token, i) => {
    const day = dayByToken(token);
    if (!day) return `<div class="pl-day is-rest" data-reveal style="--i:${i}"><span class="pl-day-tag">${token}</span><span class="pl-day-rest">${icon('moon')}pihenőnap</span></div>`;
    const load = dayLoad(day);
    const today = token === 'Sze';
    return `<button class="pl-day ${today ? 'is-now' : ''}" data-reveal style="--i:${i}" ${route('day', token)}>
     <span class="pl-day-tag">${today ? 'MA' : DAY_NAMES[token]}</span>
     <span class="pl-day-body">
      <strong>${day.type}</strong>
      <small>${daySets(day)} szett · ${day.minutes} perc · ${day.exercises.length} gyakorlat</small>
      <span class="pl-day-bars">${load.map(r => `<i style="--mus-color:${muscleColor(r.key)};--w:${Math.min(100, r.sets / 8 * 100)}%"></i>`).join('')}</span>
     </span>
     <b>›</b></button>`;
  }).join('')}</div>`;

  const climbing = soon.rows.filter(r => r.move === 'up').length;
  const dest = `<div class="pl-dests">
   <button class="pl-dest is-muscle" data-reveal ${route('week')}>
    <span class="pl-dest-art">${muscleIcon('back-mid')}</span>
    <strong>Melyik izmod hol tart</strong>
    <small>${climbing} izom kap többet hétfőtől</small>
    <b>↗</b></button>
   <button class="pl-dest is-plans" data-reveal ${route('library')}>
    <span class="pl-dest-art">${icon('stack')}</span>
    <strong>Edzéstervek</strong>
    <small>Amiből indíthatsz</small>
    <b>↗</b></button>
  </div>
  <button class="pl-row is-quiet" data-detail="Edzésterv lezárása" data-copy="Lezáráskor elkészül az összegzés: mennyit edzettél, mennyivel lettél erősebb, milyen rekordokat döntöttél. Utána indíthatsz újat." data-art="stack">
   <span><strong>Edzésterv lezárása</strong><small>Ha ezt a hat hetet végigcsináltad</small></span><b>›</b></button>`;

  return `${poster}${days}${dest}`;
}

/* ── a day of the block ──────────────────────────────────────────────────────────────── */

/** A quiet ⓘ that hands the explanation to the usual detail sheet instead of the page. */
const info = (title, copy, art = 'info') =>
  `<button class="pl-info" data-detail="${safe(title)}" data-copy="${safe(copy)}" data-art="${art}" aria-label="${safe(title)} — mit jelent?">${icon('info')}</button>`;

function planDay(token) {
  const day = dayByToken(token);
  if (!day) return `<div class="pl-empty"><h2>Ezen a napon nem edzel.</h2><p>A ${DAY_NAMES[token] ?? token} pihenőnap ebben a tervben.</p><button class="pl-back" ${route()}>Vissza</button></div>`;

  const load = dayLoad(day).sort((a, b) => b.sets - a.sets);
  const lead = load[0];
  const today = token === 'Sze';
  const share = Math.round(daySets(day) / weekTotal(MESO) * 100);

  // Poster anatomy: eyebrow, one spot graphic, one dominant numeral.
  const poster = `<section class="pl-dhero" style="--mus-color:${muscleColor(lead.key)}">
   <span class="pl-dhero-wash" aria-hidden="true"></span>
   <span class="pl-dhero-art ${load.length > 2 ? 'is-wide' : ''}" aria-hidden="true"><i></i><i></i><i></i>${bodyMap(load.map(r => r.key))}</span>
   <span class="pl-dhero-tag">${today ? 'MA' : DAY_NAMES[token].toLocaleUpperCase('hu-HU')} · A TERV ${MESO.currentWeek}. HETE</span>
   <h2>${day.type}</h2>
   <div class="pl-dhero-number"><strong data-fuel-count="${daySets(day)}">0</strong><small>szett</small></div>
   <div class="pl-dhero-pills"><span>${day.minutes} perc</span><span>${day.exercises.length} gyakorlat</span><span>a heted ${share}%-a</span></div>
   <span class="pl-dhero-constel">${load.map(r => `<i style="--mus-color:${muscleColor(r.key)}">${muscleIcon(r.key)}</i>`).join('')}</span>
  </section>`;

  const muscles = `<h3 class="pl-h3">Mit terhel ez a nap ${info('Miért nyolcnál a jelölés?',
    'Egy izomra egy edzésen belül nagyjából nyolc szett fölött már nem hoz többet a munka. Nem tiltás — csak egy jelölés, hogy lásd, hol jársz.')}</h3>
   <div class="pl-mrows">${load.map((r, i) => `<div class="pl-mrow" data-reveal style="--mus-color:${muscleColor(r.key)};--i:${i}">
     <span class="pl-mrow-art">${muscleIcon(r.key)}</span>
     <span class="pl-mrow-name">${muscleLabel(r.key)}</span>
     <span class="pl-mrow-bar"><i style="--w:${Math.min(100, r.sets / 10 * 100)}%"></i><u style="--at:80%"></u></span>
     <span class="pl-mrow-count">${r.sets}<i>szett</i></span>
    </div>`).join('')}</div>`;

  const exercises = `<h3 class="pl-h3">A nap gyakorlatai ${info('Mikortól él a változtatás?',
    'Amit itt átírsz, a következő edzésedtől számít. A most futó edzésedet nem írja át — azt végigviszed úgy, ahogy elkezdted.')}</h3>
   <div class="pl-exs">${day.exercises.map((e, i) => `<div class="pl-ex" data-reveal style="--ex-color:${muscleColor(e.muscle)};--i:${i}">
     <span class="pl-ex-index">${String(i + 1).padStart(2, '0')}</span>
     <span class="pl-ex-art">${muscleIcon(e.muscle)}</span>
     <span class="pl-ex-copy">
      <strong>${e.name}</strong>
      <small>${muscleLabel(e.muscle)}</small>
     </span>
     <span class="pl-ex-move">
      <button ${i === 0 ? 'disabled' : ''} data-detail="Sorrend" data-copy="A gyakorlatok ebben a sorrendben jönnek az edzésen. Fel-le nyilakkal rendezed át." data-art="stack" aria-label="Előrébb">↑</button>
      <button ${i === day.exercises.length - 1 ? 'disabled' : ''} data-detail="Sorrend" data-copy="A gyakorlatok ebben a sorrendben jönnek az edzésen. Fel-le nyilakkal rendezed át." data-art="stack" aria-label="Hátrébb">↓</button>
     </span>
     <span class="pl-ex-grid">
      <span class="is-main"><b>${e.sets} × ${e.repMin ? `${e.repMin}–${e.repMax}` : 'tartás'}</b><i>szett × ismétlés</i></span>
      <span><b>${e.rir}</b><i>RIR</i></span>
      <span><b>${e.kg ? n(e.kg) : '—'}</b><i>${e.kg ? 'kg induló' : 'testsúly'}</i></span>
      <span><b>${e.warmup || '—'}</b><i>bemelegítő</i></span>
     </span>
    </div>`).join('')}</div>
   <button class="pl-add" data-detail="Gyakorlat hozzáadása" data-copy="A katalógusból választasz: kereséssel, izomcsoport szerint szűrve, demóképpel és videóval. Egy megnyitásból többet is hozzáadhatsz." data-art="book">＋ Gyakorlat hozzáadása</button>`;

  return `<div class="pl-sub">
   <button class="pl-back" ${route()}>‹ Vissza</button>
   ${poster}${muscles}${exercises}
  </div>`;
}

/* ── the week's muscle review ────────────────────────────────────────────────────────── */

function planWeek() {
  const meso = MESO;
  const growing = meso.muscles.filter(m => m.tier !== 'maintain' && room(m) > 0);
  const maxed = meso.muscles.filter(m => m.tier !== 'maintain' && room(m) <= 0);
  const held = meso.muscles.filter(m => m.tier === 'maintain');

  // Most room first — the ones with something still to give are the ones worth looking at.
  const ordered = [...meso.muscles].sort((a, b) => room(b) - room(a));

  const parts = [];
  if (growing.length) parts.push(`${growing.length} izomban van még hova nőni`);
  if (maxed.length) parts.push(`${maxed.length} elérte a maximumot`);
  if (held.length) parts.push(`${held.length} izmot csak szinten tartasz`);

  return `<div class="pl-sub">
   <button class="pl-back" ${route()}>‹ Vissza</button>
   <section class="pl-whero">
    <span class="pl-whero-art" aria-hidden="true">${bodyMap(meso.muscles.map(m => m.key))}</span>
    <h2>Melyik izmod hol tart</h2>
    <p class="pl-say">${meso.muscles.length} izomcsoportot edzel ezen a héten. ${parts.join(', ')}.</p>
   </section>

   <div class="pl-list">${ordered.map((muscle, i) => {
    const p = bandPosition(muscle);
    return `<button class="pl-item" data-reveal style="--mus-color:${muscleColor(muscle.key)};--i:${i}" ${route('muscle', muscle.key)}>
     <span class="pl-item-art">${muscleIcon(muscle.key)}</span>
     <span class="pl-item-name">${muscle.name}</span>
     <span class="pl-item-count">${p.now}<i>szett</i></span>
     <span class="pl-item-bar"><i style="--w:${p.now / p.ceiling * 100}%"></i></span>
     <span class="pl-item-say">${verdict(muscle)}</span>
     <b>›</b></button>`;
  }).join('')}</div>

   <p class="pl-foot-say">A sáv azt mutatja, hol tartasz ahhoz képest, ameddig ebben a blokkban elmész. Koppints egy izomra, ha érdekel, miért pont ennyi.</p>
  </div>`;
}

/* ── one muscle's whole story ────────────────────────────────────────────────────────── */

function planMuscle(key) {
  const muscle = MESO.muscles.find(m => m.key === key);
  if (!muscle) return `<div class="pl-empty"><h2>Ezt az izmot nem edzed ebben a blokkban.</h2><button class="pl-back" ${route('week')}>Vissza</button></div>`;

  const p = bandPosition(muscle), rows = whereItWorks(key);
  const soon = nextRollover(MESO).rows.find(r => r.key === key);
  const top = setsAt(muscle, peakWeek(MESO)), previous = muscle.previous;

  const say = muscle.tier === 'maintain'
    ? `Hetente ${p.now} szett megy a ${muscle.name.toLowerCase()}ra, és ez így is marad. Most máshol építesz — ez az izom közben megtartja, amit tud.`
    : room(muscle) > 0
      ? `Hetente ${p.now} szett megy a ${muscle.name.toLowerCase()}ra. Még ${room(muscle)} belefér, aztán a terv végéig ${p.ceiling} marad a felső érték.`
      : `Hetente ${p.now} szett megy a ${muscle.name.toLowerCase()}ra — ennél többet ez a terv már nem ad. A következő tervben indulsz majd magasabbról.`;

  const next = soon?.move === 'up' ? `Hétfőn ${soon.delta} szettel többet kapsz.`
    : soon?.move === 'deload' ? `Hétfőtől pihenőhét: ${soon.next} szettre esik vissza.`
      : 'Hétfőn nem változik.';

  return `<div class="pl-sub" style="--mus-color:${muscleColor(key)}">
   <button class="pl-back" ${route('week')}>‹ Vissza</button>
   <section class="pl-mhero">
    <span class="pl-mhero-art" aria-hidden="true">${bodyMap([key])}</span>
    <h2>${muscle.name}</h2>
    <p class="pl-say">${say}</p>
    <p class="pl-sub-say">${next}</p>
   </section>

   <div class="pl-gauge">
    <span class="pl-gauge-bar"><i style="--w:${p.now / p.ceiling * 100}%"></i></span>
    <span class="pl-gauge-ends"><i>most ${p.now}</i><i>felső érték ${p.ceiling}</i></span>
   </div>

   <h3 class="pl-h3">A hat hét</h3>
   ${weekArc(MESO, muscle)}
   <p class="pl-foot-say">Az 1. héten ${setsAt(muscle, 1)} szettel indultál, a legtöbb ${top} lesz, a pihenőhéten ${setsAt(muscle, MESO.weeks)}.</p>

   <h3 class="pl-h3">Hol edzed</h3>
   <div class="pl-list">${rows.map(row => `<button class="pl-item is-flat" ${route('day', row.day)}>
     <span class="pl-item-name">${DAY_NAMES[row.day]}</span>
     <span class="pl-item-say">${row.exercises.map(e => e.name).join(', ')}</span>
     <span class="pl-item-count">${row.sets}<i>szett</i></span>
     <b>›</b></button>`).join('')}</div>

   ${previous ? `<h3 class="pl-h3">Az előző tervhez képest</h3>
   <p class="pl-foot-say">Akkor ${previous.start} szettről ${previous.peak}-ig jutottál. Most ${setsAt(muscle, 1)}-ről indultál, és ${top}-ig mész — ${
    top > previous.peak ? `${top - previous.peak} szettel magasabbra` : top === previous.peak ? 'ugyanoda' : 'lejjebb, mert most más izom kapja a hangsúlyt'}.</p>` : ''}
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

/**
 * Nothing plays off-screen: a row only runs its entrance when it is actually scrolled into view.
 * Rows already visible on arrival intersect immediately, so the top of the page still greets you.
 */
export function animatePlan(root = document) {
  const targets = root.querySelectorAll('[data-reveal]:not(.is-in)');
  if (!targets.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('is-in'));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }
  }, { root: document.querySelector('#app-scroll'), rootMargin: '0px 0px -8% 0px', threshold: 0.15 });
  targets.forEach(el => observer.observe(el));
}
