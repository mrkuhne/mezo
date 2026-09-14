// Terv — the running mesocycle is the page, not a row in a library (owner decision 2026-09-13).
// Landing = the block's state; from it a day, the week's muscle review, and one muscle's story.
import {
  MESO, DAY_ORDER, DAY_NAMES, TIERS, phaseOf, isDeloadWeek, ceilingOf, setsAt, currentSets,
  peakWeek, nextRollover, bandPosition, dayByToken, dayLoad, daySets, whereItWorks, weekTotal,
  adjacencyNotes, LIBRARY, template, closedRun, templateStory, closedShare,
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
    const today = token === 'Sze';
    if (!day) return `<div class="pl-day is-rest" data-reveal style="--i:${i}">
     <span class="pl-day-tag">${DAY_NAMES[token]}</span>${today ? '<span class="pl-today">MA</span>' : ''}
     <span class="pl-day-rest">${icon('moon')}pihenőnap</span></div>`;
    const load = dayLoad(day);
    return `<button class="pl-day ${today ? 'is-now' : ''}" data-reveal style="--i:${i}" ${route('day', token)}>
     <span class="pl-day-head">
      <span class="pl-day-tag">${DAY_NAMES[token]}</span>${today ? '<span class="pl-today">MA</span>' : ''}
      <strong>${day.type}</strong><b>›</b>
     </span>
     <span class="pl-day-facts">
      <i>${icon('dumbbell')}<b>${daySets(day)}</b><small>szett</small></i>
      <i>${icon('clock')}<b>${day.minutes}</b><small>perc</small></i>
      <i>${icon('stack')}<b>${day.exercises.length}</b><small>gyakorlat</small></i>
     </span>
     <span class="pl-day-bars">${load.map(r => `<i style="--mus-color:${muscleColor(r.key)};--w:${Math.min(100, r.sets / 8 * 100)}%"></i>`).join('')}</span>
    </button>`;
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
   <span class="pl-dhero-art ${load.length > 2 ? 'is-wide' : ''}" aria-hidden="true"><i></i><i></i><i></i>${bodyMap(load.map(r => r.key), { weights: Object.fromEntries(load.map(r => [r.key, r.sets])) })}</span>
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
    <span class="pl-whero-art" aria-hidden="true">${bodyMap(meso.muscles.map(m => m.key), { weights: Object.fromEntries(meso.muscles.map(m => [m.key, currentSets(m)])) })}</span>
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
  if (!muscle) return `<div class="pl-empty"><h2>Ezt az izmot nem edzed ebben a tervben.</h2><button class="pl-back" ${route('week')}>Vissza</button></div>`;

  const p = bandPosition(muscle), rows = whereItWorks(key);
  const soon = nextRollover(MESO).rows.find(r => r.key === key);
  const start = setsAt(muscle, 1), top = setsAt(muscle, peakWeek(MESO)), previous = muscle.previous;
  const scale = Math.max(muscle.mrv, top);

  const say = muscle.tier === 'maintain'
    ? `Hetente ${p.now} szett megy a ${muscle.name.toLowerCase()}ra, és ez így is marad. Most máshol építesz — ez az izom közben megtartja, amit tud.`
    : room(muscle) > 0
      ? `Hetente ${p.now} szett megy a ${muscle.name.toLowerCase()}ra. Még ${room(muscle)} belefér, aztán a terv végéig ${p.ceiling} marad a felső érték.`
      : `Hetente ${p.now} szett megy a ${muscle.name.toLowerCase()}ra — ennél többet ez a terv már nem ad. A következő tervben indulsz majd magasabbról.`;

  const next = soon?.move === 'up' ? `Hétfőn ${soon.delta} szettel többet kapsz.`
    : soon?.move === 'deload' ? `Hétfőtől pihenőhét: ${soon.next} szettre esik vissza.`
      : 'Hétfőn nem változik.';

  const hero = `<section class="pl-mhero">
   <span class="pl-mhero-art" aria-hidden="true">${bodyMap([key])}</span>
   <h2>${muscle.name}</h2>
   <p class="pl-say">${say}</p>
   <p class="pl-sub-say">${next}</p>
  </section>`;

  const stats = `<div class="pl-mstats">
   <span><strong data-fuel-count="${muscle.freq}">0</strong><small>edzés hetente</small></span>
   <span><strong data-fuel-count="${start}">0</strong><small>szett az 1. héten</small></span>
   <span><strong data-fuel-count="${top}">0</strong><small>a legtöbb lesz</small></span>
  </div>`;

  // A muscle you only hold has its threshold and its ceiling in the same place — one label, not two.
  const mevPct = muscle.mev / scale * 100, topPct = p.ceiling / scale * 100;
  const together = Math.abs(topPct - mevPct) < 7;
  const nudge = at => (at > 86 ? '-84%' : at < 14 ? '-16%' : '-50%');
  const gauge = `<h3 class="pl-h3">Hol tartasz ${info('Mit jelentenek a jelölések?',
    `A ${muscle.mev} alatt nincs elég inger ahhoz, hogy ez az izom fejlődjön. A felső érték az, ameddig ebben a tervben elmész — ezt a fókuszod szabja meg. Fölötte a több munka már nem hoz többet.`)}</h3>
   <div class="pl-scale-wrap" data-reveal>
    <span class="pl-scale-bar">
     <i class="fill" style="--w:${p.now / scale * 100}%"></i>
     ${together ? '' : `<u class="mark is-mev" style="--at:${mevPct}%"></u>`}
     <u class="mark is-top" style="--at:${topPct}%"></u>
     <b class="pin" style="--at:${p.now / scale * 100}%;--nudge:${nudge(p.now / scale * 100)}">${p.now}</b>
    </span>
    <span class="pl-scale-legend">
     ${together
      ? `<i style="--at:${topPct}%;--nudge:${nudge(topPct)}">${p.ceiling}<small>ennyitől fejlődik — és itt tartod</small></i>`
      : `<i style="--at:${mevPct}%;--nudge:${nudge(mevPct)}">${muscle.mev}<small>ennyitől fejlődik</small></i>
     <i style="--at:${topPct}%;--nudge:${nudge(topPct)}">${p.ceiling}<small>eddig mész el</small></i>`}
    </span>
   </div>`;

  const arc = `<h3 class="pl-h3">A hat hét</h3>
   ${weekArc(MESO, muscle)}
   <div class="pl-weekvals">${Array.from({ length: MESO.weeks }, (_, i) => {
    const week = i + 1;
    return `<i class="${week === MESO.currentWeek ? 'is-now' : ''}">${setsAt(muscle, week)}</i>`;
  }).join('')}</div>
   <p class="pl-foot-say">${isDeloadWeek(MESO, MESO.weeks) ? `Az utolsó hét pihenőhét — ott ${setsAt(muscle, MESO.weeks)} szettre esik vissza, hogy kipihend a hat hetet.` : ''}</p>`;

  const where = `<h3 class="pl-h3">Hol edzed</h3>
   <div class="pl-exs">${rows.map((row, i) => `<button class="pl-ex is-link" data-reveal style="--ex-color:${muscleColor(key)};--i:${i}" ${route('day', row.day)}>
     <span class="pl-ex-index">${row.day}</span>
     <span class="pl-ex-art">${muscleIcon(key)}</span>
     <span class="pl-ex-copy"><strong>${row.type}</strong><small>${row.exercises.map(e => e.name).join(', ')}</small></span>
     <span class="pl-ex-sets">${row.sets}<i>szett</i></span>
    </button>`).join('')}</div>`;

  const history = previous ? `<h3 class="pl-h3">Az előző tervhez képest</h3>
   <div class="pl-versus" data-reveal>
    <div class="pl-versus-row">
     <span>Akkor</span>
     <span class="pl-versus-bar"><i style="--w:${previous.peak / scale * 100}%"></i></span>
     <b>${previous.start} → ${previous.peak}</b>
    </div>
    <div class="pl-versus-row is-now">
     <span>Most</span>
     <span class="pl-versus-bar"><i style="--w:${top / scale * 100}%"></i></span>
     <b>${start} → ${top}</b>
    </div>
   </div>
   <p class="pl-foot-say">${top > previous.peak
    ? `Ez a terv ${top - previous.peak} szettel visz magasabbra, mint az előző.`
    : top === previous.peak ? 'Ez a terv ugyanoda visz, mint az előző — ez tartás, nem visszaesés.'
      : 'Az előző terv magasabbra vitt — most más izom kapja a hangsúlyt.'}</p>`
    : '<h3 class="pl-h3">Az előző tervhez képest</h3><p class="pl-foot-say">Ehhez az izomhoz még nincs korábbi terved — ez az első, amiben számon tartjuk.</p>';

  return `<div class="pl-sub" style="--mus-color:${muscleColor(key)}">
   <button class="pl-back" ${route('week')}>‹ Vissza</button>
   ${hero}${stats}${gauge}${arc}${where}${history}
  </div>`;
}

/* ── the library: what runs, what waits, what closed ─────────────────────────────────── */

const LIB_COLOR = '#bca6f1';

/** Five clay stars, halves included — the same scale the ceremony hands out. */
const starRow = value => `<span class="pl-stars" role="img" aria-label="${n(value)} csillag az ötből">${
  Array.from({ length: 5 }, (_, i) => icon(value >= i + 1 ? 'star' : value >= i + 0.5 ? 'star-half' : 'star-empty')).join('')}</span>`;

const rangeLabel = run => `${dateLabel(run.start)} – ${dateLabel(run.end)}`;

function planLibrary() {
  const lib = LIBRARY, meso = MESO;

  const hero = `<header class="pl-dhero pl-lhero" style="--mus-color:${LIB_COLOR}" data-reveal>
   <span class="pl-dhero-wash"></span>
   <div class="pl-lhero-art">${icon('stack')}<i></i><i></i></div>
   <span class="overline">EDZÉSTERVEK</span>
   <h2>A terveid</h2>
   <p class="pl-say">Ami most fut, ami következik, és amit már végigcsináltál — egy helyen.</p>
   <div class="pl-poster-foot">
    <span>1 fut</span><span>${lib.planned.length} következik</span>
    <span>${lib.templates.length} sablon</span><span>${lib.closed.length} lezárva</span>
   </div>
  </header>`;

  const now = `<h3 class="pl-h3">Most fut</h3>
  <button class="pl-lib-card is-now" data-reveal ${route()}>
   <span class="pl-lib-head"><strong>${meso.name}</strong><em>${meso.currentWeek}. hét a ${meso.weeks}-ból</em><b>›</b></span>
   ${weekArc(meso)}
  </button>`;

  const queued = lib.planned.map(run => `<button class="pl-lib-card is-queued" data-reveal ${route('library', 'template', run.from)}>
   <span class="pl-lib-head"><strong>${run.name}</strong><em>${dateLabel(run.start)}-től</em><b>›</b></span>
   <span class="pl-day-facts">
    <i>${icon('history')}<b>${run.weeks}</b><small>hét</small></i>
    <i>${icon('dumbbell')}<b>${run.daysPerWeek}</b><small>nap hetente</small></i>
    <i>${icon('stack')}<b class="is-word">${run.split}</b></i>
   </span>
   <small class="pl-lib-note">Akkor indul, amikor a mostani terved lezárul.</small>
  </button>`).join('');
  const queuedSec = lib.planned.length ? `<h3 class="pl-h3">Következik</h3>${queued}` : '';

  const create = `<button class="pl-lib-new" data-reveal data-detail="Új terv összeállítása" data-art="stack"
   data-copy="Lépésről lépésre raksz össze egy tervet: napok, gyakorlatok, és hogy melyik izmod kapjon többet. Indulhatsz egy sablonból is — az gyorsabb, és utána bármit átírhatsz.">
   <span class="pl-lib-new-art">${icon('stack')}</span>
   <span><strong>Új terv összeállítása</strong><small>Sablonból indulsz, vagy nulláról építed</small></span>
   <b>＋</b></button>`;

  const templates = `<h3 class="pl-h3">Sablonjaid</h3>${lib.templates.map(t => {
    const story = templateStory(t.key);
    const uses = story.closed.length + (story.activeNow ? 1 : 0);
    const use = story.activeNow ? 'Ebből fut a mostani terved'
      : uses ? `${uses} ${plural(uses, 'futam indult', 'futam indult')} belőle` : 'Még nem indítottál belőle';
    return `<button class="pl-lib-card" data-reveal ${route('library', 'template', t.key)}>
    <span class="pl-lib-head"><strong>${t.name}</strong><em>${t.split}</em><b>›</b></span>
    <span class="pl-day-facts">
     <i>${icon('history')}<b>${t.weeks}</b><small>hét</small></i>
     <i>${icon('dumbbell')}<b>${t.daysPerWeek}</b><small>nap hetente</small></i>
     <i>${icon('clock')}<b>~${t.minutes}</b><small>perc</small></i>
    </span>
    <span class="pl-lib-mus">${t.muscles.map(key => `<i style="--mus-color:${muscleColor(key)}">${muscleIcon(key)}</i>`).join('')}</span>
    <small class="pl-lib-note">${use}</small>
   </button>`;
  }).join('')}`;

  const closed = `<h3 class="pl-h3">Lezárt futamaid</h3>${lib.closed.map(run => `<button class="pl-lib-card is-closed" data-reveal ${route('library', 'closed', run.key)}>
   <span class="pl-lib-head"><strong>${run.name}</strong><em>${rangeLabel(run)}</em><b>›</b></span>
   <span class="pl-lib-closed-row">${starRow(run.stars)}
    <span class="pl-lib-meta">${icon('tick')}${run.done} edzés a ${run.planned}-ból</span>
    <span class="pl-lib-meta">${icon('record')}${run.records} rekord</span>
   </span>
  </button>`).join('')}`;

  return `<div class="pl-sub pl-lib">
   <button class="pl-back" ${route()}>‹ A terved</button>
   ${hero}${now}${queuedSec}${create}${templates}${closed}
  </div>`;
}

/* ── one template ────────────────────────────────────────────────────────────────────── */

function planLibraryTemplate(key) {
  const t = template(key);
  if (!t) return planLibrary();
  const story = templateStory(key);

  const hero = `<header class="pl-dhero pl-lhero" style="--mus-color:${LIB_COLOR}" data-reveal>
   <span class="pl-dhero-wash"></span>
   <div class="pl-lhero-map">${bodyMap(t.muscles, { className: 'body-map pl-lhero-body' })}</div>
   <span class="overline">SABLON</span>
   <h2>${t.name}</h2>
   <p class="pl-say">${t.weeks} hét, hetente ${t.daysPerWeek} edzésnap — ${t.split.toLowerCase()} felosztásban.</p>
   <div class="pl-poster-foot"><span>~${t.minutes} perc egy edzés</span><span>${t.muscles.length} izomcsoport</span></div>
  </header>`;

  const muscles = `<h3 class="pl-h3">Amit edz ${info('Mit jelent a lista?', 'Ezek az izmok kapnak saját heti szettszámot a sablonban. Amikor futamot indítasz belőle, hétről hétre ez emelkedik.')}</h3>
  <div class="pl-lib-muslist" data-reveal>${t.muscles.map(mkey => `<span class="pl-lib-musrow" style="--mus-color:${muscleColor(mkey)}">
    ${muscleIcon(mkey)}<strong>${muscleLabel(mkey)}</strong>
   </span>`).join('')}</div>`;

  const runRow = (label, sub, to, mod = '') => `<button class="pl-row ${mod}" data-reveal ${to}>
   <span><strong>${label}</strong><small>${sub}</small></span><b>›</b></button>`;
  const runs = [
    story.activeNow ? runRow(story.activeNow.name, `Most fut — ${story.activeNow.currentWeek}. hét a ${story.activeNow.weeks}-ból`, route(), 'is-live') : '',
    ...story.planned.map(run => runRow(run.name, `${dateLabel(run.start)}-től következik`, route('library'), '')),
    ...story.closed.map(run => runRow(run.name, `${rangeLabel(run)} · ${n(run.stars)} csillag`, route('library', 'closed', run.key), '')),
  ].filter(Boolean).join('');
  const runsSec = runs ? `<h3 class="pl-h3">Futamok ebből a sablonból</h3>${runs}`
    : `<h3 class="pl-h3">Futamok ebből a sablonból</h3><p class="pl-foot-say" data-reveal>Ebből a sablonból még nem indítottál futamot.</p>`;

  const start = `<button class="pl-lib-new is-start" data-reveal data-detail="Futam indítása ebből" data-art="stack"
   data-copy="Kezdőnapot választasz, és a sablonból kész terv lesz: dátumokkal, heti emeléssel, pihenőhéttel a végén. A sablon maga nem változik — abból bármikor indíthatsz újat.">
   <span class="pl-lib-new-art">${icon('bolt')}</span>
   <span><strong>Futam indítása ebből</strong><small>A sablon marad, a terv a tiéd lesz</small></span>
   <b>›</b></button>`;

  return `<div class="pl-sub pl-lib">
   <button class="pl-back" ${route('library')}>‹ Edzéstervek</button>
   ${hero}${muscles}${runsSec}${start}
  </div>`;
}

/* ── one closed run: the story it left behind ────────────────────────────────────────── */

function planLibraryClosed(key) {
  const run = closedRun(key);
  if (!run) return planLibrary();

  const hero = `<header class="pl-dhero pl-lhero is-closed" style="--mus-color:${LIB_COLOR}" data-reveal>
   <span class="pl-dhero-wash"></span>
   <span class="overline">LEZÁRT FUTAM · ${rangeLabel(run).toUpperCase()}</span>
   <h2>${run.name}</h2>
   <div class="pl-lhero-stars">${starRow(run.stars)}</div>
   <p class="pl-say">${run.say}</p>
  </header>`;

  const share = Math.round(closedShare(run) * 100);
  const facts = `<div class="pl-day-facts pl-lib-facts" data-reveal>
   <i>${icon('tick')}<b>${run.done}</b><small>edzés a ${run.planned}-ból</small></i>
   <i>${icon('record')}<b>${run.records}</b><small>megdöntött rekord</small></i>
   <i>${icon('kettle')}<b>${Math.round(run.volumeKg / 1000)} t</b><small>összsúly</small></i>
  </div>
  <p class="pl-foot-say" data-reveal>A tervezett edzéseid ${share}%-át végigcsináltad.</p>`;

  const peakMax = Math.max(...run.muscles.map(m => m.peak));
  const muscles = `<h3 class="pl-h3">Izmaid ebben a futamban ${info('Mit mutat a sáv?', 'Honnan indult és meddig jutott az izom heti szettszáma a futam alatt. A csúcs a pihenőhét előtti utolsó hét.')}</h3>
  <div class="pl-lib-muslist is-bars" data-reveal>${run.muscles.map(m => `<span class="pl-lib-musrow" style="--mus-color:${muscleColor(m.key)}">
    ${muscleIcon(m.key)}
    <span class="pl-lib-mustext"><strong>${muscleLabel(m.key)}</strong><small>${m.note}</small></span>
    <span class="pl-lib-musbar"><i style="--a:${m.start / peakMax * 100}%;--w:${m.peak / peakMax * 100}%"></i></span>
    <b>${m.start} → ${m.peak}</b>
   </span>`).join('')}</div>`;

  const shared = run.muscles.filter(m => MESO.muscles.some(mm => mm.key === m.key));
  const versus = shared.length ? `<h3 class="pl-h3">A mostani tervedhez képest</h3>
  <p class="pl-foot-say" data-reveal>Ugyanazok az izmok — mennyit bírtak akkor a csúcson, és mennyit bírnak majd most.</p>
  <div class="pl-versus pl-lib-versus" data-reveal>${shared.map(m => {
    const nowMuscle = MESO.muscles.find(mm => mm.key === m.key);
    const nowPeak = setsAt(nowMuscle, peakWeek(MESO));
    const top = Math.max(m.peak, nowPeak) || 1;
    return `<div class="pl-versus-pair" style="--mus-color:${muscleColor(m.key)}">
     <span class="pl-versus-name">${muscleIcon(m.key)}${muscleLabel(m.key)}</span>
     <div class="pl-versus-row"><span>akkor</span><span class="pl-versus-bar"><i style="--w:${m.peak / top * 100}%"></i></span><b>${m.peak}</b></div>
     <div class="pl-versus-row is-now"><span>most</span><span class="pl-versus-bar"><i style="--w:${nowPeak / top * 100}%"></i></span><b>${nowPeak}</b></div>
    </div>`;
  }).join('')}</div>` : '';

  return `<div class="pl-sub pl-lib">
   <button class="pl-back" ${route('library')}>‹ Edzéstervek</button>
   ${hero}${facts}${muscles}${versus}
  </div>`;
}

/* ── entry ───────────────────────────────────────────────────────────────────────────── */

export function planContent() {
  const [, , view = '', id = ''] = location.hash.slice(1).split('/');
  if (view === 'day') return planDay(decodeURIComponent(id));
  if (view === 'week') return planWeek();
  if (view === 'muscle') return planMuscle(id);
  if (view === 'library') {
    const [, , , sub = '', subId = ''] = location.hash.slice(1).split('/');
    if (sub === 'template') return planLibraryTemplate(decodeURIComponent(subId));
    if (sub === 'closed') return planLibraryClosed(decodeURIComponent(subId));
    return planLibrary();
  }
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
