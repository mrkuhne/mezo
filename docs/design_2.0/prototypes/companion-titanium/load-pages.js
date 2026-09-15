// Terhelés — the week's work as a living picture: what happened, what tonight asks, what is left.
// Details live behind the group glass and clay info buttons; the page itself stays one story.
import {
  WEEK_LOG, weekLoad, groupLoad, weekProgress, weekDays, loadStory,
  mapHeat, untouched, sportTouched, movementWeek,
} from './load-state.js';
import { MESO, phaseOf, dayByToken } from './plan-state.js';
import { icon, safe } from './nap.js';
import { muscleIcon, muscleLabel, muscleColor, bodyMap, bodyMapDuo, muscleMapHtml } from './muscles.js';

const info = (title, copy, art = 'info') =>
  `<button class="pl-info" data-detail="${safe(title)}" data-copy="${safe(copy)}" data-art="${art}" aria-label="${safe(title)} — mit jelent?">${icon('info')}</button>`;

/* ── the hero: how deep into the week you are ────────────────────────────────────────── */

function loadHero() {
  const progress = weekProgress(), story = loadStory(), phase = phaseOf(MESO);
  const lit = weekLoad().filter(r => r.done > 0);
  const shown = lit.length ? lit : weekLoad().filter(r => r.planned > 0);
  const map = bodyMap(shown.map(r => r.key), { className: 'body-map ld-hero-body', weights: Object.fromEntries(shown.map(r => [r.key, r.done || r.planned])) });
  return `<header class="ld-hero" data-reveal>
   <span class="ld-hero-wash"></span>
   <div class="ld-hero-art">${map}<i></i><i></i></div>
   <span class="overline">TERHELÉS · ${MESO.currentWeek}. HÉT · ${phase.label.toUpperCase()}</span>
   <h2><b data-fuel-count="${story.percent}">0</b><em>%</em></h2>
   <p class="ld-hero-sub">a heti munkádból megvan — <b data-fuel-count="${progress.done}">0</b> szett a ${progress.planned}-ből</p>
   <div class="ld-hero-bar"><i style="--w:${story.percent}%"><em></em></i></div>
   <p class="pl-say">${story.say} ${info('Miből áll össze a szám?', 'A futó terved e heti szettjeit számoljuk: amit már elvégeztél, osztva azzal, amit a hét kér. A sport perceit külön mutatjuk — az a pihenésed része, nem a szetteké.')}</p>
  </header>`;
}

/* ── the muscle groups, each openable into its glass ─────────────────────────────────── */

function groupCards() {
  return `<h3 class="pl-h3">Izomcsoportok ezen a héten ${info('Mit mutat a sáv?', 'A színes rész az elvégzett szett, a halvány a hét teljes kérése. Egy csoportra koppintva látod, melyik része mennyit kapott, és melyik napokon.')}</h3>
  <div class="ld-groups">${groupLoad().map(group => `
   <button class="ld-group" style="--mus-color:${group.color}" data-load-group="${group.key}" data-reveal>
    <span class="ld-group-head">${muscleIcon(group.heads[0].key)}<strong>${group.label}</strong>
     <b>${group.done} / ${group.planned} <small>szett</small></b></span>
    <span class="ld-group-bar"><i style="--w:${Math.round(group.share * 100)}%"></i></span>
    <small class="ld-group-note">${group.done >= group.planned && group.planned ? 'Ez a hét itt már megvan.' : group.done ? `Még ${group.planned - group.done} szett van hátra.` : 'Erre a hét második fele épül.'}</small>
   </button>`).join('')}</div>`;
}

/** The glass behind a group: its heads, their week, and the days that touch them. */
export function groupGlass(key) {
  const group = groupLoad().find(g => g.key === key);
  if (!group) return '';
  const days = MESO.days
    .map(day => ({ day, sets: day.exercises.filter(e => group.heads.some(h => h.key === e.muscle)) }))
    .filter(row => row.sets.length);
  return `<div class="ld-glass" style="--mus-color:${group.color}">
   <div class="ld-glass-rows">${group.heads.filter(h => h.planned || h.done).map(h => `
    <div class="ld-glass-row">
     ${muscleIcon(h.key)}
     <span class="ld-glass-name"><strong>${muscleLabel(h.key)}</strong><small>${h.done} / ${h.planned} szett</small></span>
     <span class="ld-group-bar"><i style="--w:${h.planned ? Math.round(Math.min(1, h.done / h.planned) * 100) : 0}%"></i></span>
    </div>`).join('')}</div>
   <h4 class="ld-glass-h">Mikor éred el a héten</h4>
   ${days.map(({ day, sets }) => `<div class="ld-glass-day">
     <strong>${day.type}</strong>
     <span>${sets.map(e => `${safe(e.name)} · ${e.sets} szett`).join(' — ')}</span>
    </div>`).join('') || '<p class="ld-glass-empty">Ezen a héten nincs rá külön nap.</p>'}
  </div>`;
}

/* ── the sport that also happened ────────────────────────────────────────────────────── */

/* ── the two doorways: the body map and the combined movement ────────────────────────── */

function mapCard() {
  const waiting = untouched();
  return `<h3 class="pl-h3">A tested térképe</h3>
  <button class="ld-map-card" data-route="train/2/map" data-reveal>
   ${bodyMapDuo(mapHeat('done'), { className: 'body-duo ld-map-mini' })}
   <span class="ld-map-copy"><strong>Elöl és hátul, ami már dolgozott</strong>
    <small>${waiting.length ? `${waiting.length} izom még munkára vár ezen a héten.` : 'Minden izmod sorra került ezen a héten.'}</small></span>
   <b>›</b></button>`;
}

function movementCard() {
  const m = movementWeek();
  return `<button class="ld-move-card" data-route="train/2/mozgas" data-reveal>
   <span class="ld-sport-art">${icon('bolt')}</span>
   <span class="ld-map-copy"><strong>Minden mozgásod a héten</strong>
    <small>${m.totalMin} perc gym és sport együtt · ~${m.totalKcal.toLocaleString('hu-HU')} kcal</small></span>
   <b>›</b></button>`;
}

function sportCard() {
  if (!WEEK_LOG.sports.length) return '';
  return `<h3 class="pl-h3">Sport a héten</h3>${WEEK_LOG.sports.map(s => `
  <div class="ld-sport" data-reveal>
   <span class="ld-sport-art">${icon(s.icon)}</span>
   <span class="ld-sport-copy"><strong>${s.name}</strong><small>${s.minutes} perc · ${s.kcal} kcal · ${s.note}</small></span>
   ${info('A sport és a szettek', 'A sportod a heti mozgásod és a pihenésed része — a szettszámokba nem számít bele, mert ott a terved emelkedését követjük. A regenerációnál viszont figyelembe vesszük.', 'volley')}
  </div>`).join('')}`;
}

/* ── entry ───────────────────────────────────────────────────────────────────────────── */

let mapMode = 'done';

const MAP_LEGEND = [
  { state: 'none', word: 'még vár' },
  { state: 'started', word: 'elkezdted' },
  { state: 'ontrack', word: 'jó úton' },
  { state: 'done', word: 'megvan' },
];

export function mapFigure() {
  const rows = mapHeat(mapMode);
  const legend = mapMode === 'done'
    ? `<div class="ld-legend">${MAP_LEGEND.map(l => `<span class="is-${l.state}"><i></i>${l.word}</span>`).join('')}</div>`
    : '<div class="ld-legend"><span class="is-planned"><i></i>minél többet kér a hét, annál erősebb a szín</span></div>';
  return `${bodyMapDuo(rows, { className: 'body-duo ld-map-big' })}
   <div class="ld-map-sides"><span>elölről</span><span>hátulról</span></div>${legend}`;
}

function mapScreen() {
  const waiting = untouched();
  const sport = sportTouched();
  return `<div class="pl-sub ld-map-page">
   <button class="pl-back" data-route="train/2">‹ Terhelés</button>
   <header class="pl-dhero pl-lhero is-slim" style="--mus-color:#c8e895" data-reveal>
    <span class="pl-dhero-wash"></span>
    <span class="overline">IZOMTÉRKÉP</span>
    <h2>Hol tart a tested?</h2>
    <p class="pl-say">Amit már megmozgattál, erősebben világít — ami még vár, az csak körvonal. ${info('Miből rajzoljuk?', 'A futó terved e heti szettjeiből: minden izom annyira fénylik, amennyi a heti munkájából már megvan. A terv nézet azt festi fel, mit kér a hét — ott az erősebb szín többet kérő izmot jelent.')}</p>
   </header>
   <div class="wz-chips" id="ld-map-modes" role="group" aria-label="Nézet">
    <button class="wz-chip ${mapMode === 'done' ? 'is-on' : ''}" data-load-mode="done" aria-pressed="${mapMode === 'done'}">Eddig megvolt</button>
    <button class="wz-chip ${mapMode === 'planned' ? 'is-on' : ''}" data-load-mode="planned" aria-pressed="${mapMode === 'planned'}">A heti terv</button>
   </div>
   <div class="ld-map-stage" id="ld-map-fig" data-reveal>${mapFigure()}</div>
   ${waiting.length ? `<h3 class="pl-h3">Még munkára vár</h3>
   <div class="ld-wait" data-reveal>${waiting.map(r => `<span class="ld-wait-row" style="--mus-color:${muscleColor(r.key)}">
    ${muscleIcon(r.key)}<strong>${r.name}</strong><small>${r.planned} szett vár a héten</small></span>`).join('')}</div>` : ''}
   ${sport.length ? `<p class="ld-sport-note" data-reveal>${icon('volley')} A röplabda ezeken is dolgozott: ${sport.map(k => muscleLabel(k)).join(', ')}. <i>Becslés, nem mérés — a szettszámokba nem számít bele.</i></p>` : ''}
   <button class="pl-row is-quiet" data-route="train/2/jelek">
    <span><strong>Minden izomjel</strong><small>A 21 izom, saját jellel, régiónként</small></span><b>›</b></button>
  </div>`;
}

function movementScreen() {
  const m = movementWeek();
  const touched = sportTouched();
  return `<div class="pl-sub">
   <button class="pl-back" data-route="train/2">‹ Terhelés</button>
   <header class="pl-dhero pl-lhero is-slim" style="--mus-color:#78cfe7" data-reveal>
    <span class="pl-dhero-wash"></span>
    <span class="overline">MINDEN MOZGÁSOD</span>
    <h2><b data-fuel-count="${m.totalMin}">0</b> perc ezen a héten</h2>
    <p class="pl-say">Gym és sport együtt — a kettő máshogy számít, ezért külön is mutatjuk. ${info('Miért becslés?', 'A gym percei a szettjeidből becsültek, a röplabdát te naplóztad. A kalória mindkettőnél becslés a mozgás jellegéből — nem mérés.')}</p>
    <div class="pl-poster-foot"><span>~${m.totalKcal.toLocaleString('hu-HU')} kcal a mozgásból</span></div>
   </header>
   <div class="ld-move-split" data-reveal>
    <div class="ld-move-box" style="--mus-color:#c8e895">
     ${icon('dumbbell')}<strong>${m.gymMin} perc</strong><small>gym · ~${m.gymKcal.toLocaleString('hu-HU')} kcal</small>
     <em>becslés a szettjeidből</em>
    </div>
    <div class="ld-move-box" style="--mus-color:#78cfe7">
     ${icon('volley')}<strong>${m.sportMin} perc</strong><small>sport · ${m.sportKcal.toLocaleString('hu-HU')} kcal</small>
     <em>naplóztad</em>
    </div>
   </div>
   <h3 class="pl-h3">Izomcsoportok, sporttal együtt ${info('Hogyan olvasd?', 'A sáv a gym szettjeidet mutatja a heti tervhez képest. A kék jel azt jelzi, hogy a sport is dolgoztatta a csoportot — ez becslés, és nem adódik hozzá a szettekhez.')}</h3>
   <div class="ld-groups" data-reveal>${groupLoad().map(group => {
     const sporty = group.heads.some(h => touched.includes(h.key));
     return `<div class="ld-group is-flat" style="--mus-color:${group.color}">
      <span class="ld-group-head">${muscleIcon(group.heads[0].key)}<strong>${group.label}</strong>
       ${sporty ? '<span class="ld-sport-chip">' + icon('volley') + 'sport is</span>' : ''}
       <b>${group.done} / ${group.planned} <small>szett</small></b></span>
      <span class="ld-group-bar"><i style="--w:${Math.round(group.share * 100)}%"></i></span>
     </div>`;
   }).join('')}</div>
  </div>`;
}

export function loadContent() {
  const view = location.hash.slice(1).split('/')[2] ?? '';
  if (view === 'map') return mapScreen();
  if (view === 'mozgas') return movementScreen();
  if (view === 'jelek') return `<div class="pl-sub">
   <button class="pl-back" data-route="train/2/map">‹ Izomtérkép</button>
   ${muscleMapHtml(weekLoad().filter(r => r.done > 0).map(r => r.key))}
  </div>`;
  return `${loadHero()}<div class="ld-body">
   ${mapCard()}
   ${groupCards()}
   ${sportCard()}
   ${movementCard()}
  </div>`;
}

export function initLoad() {
  let layer = null;
  const close = () => { layer?.remove(); layer = null; };

  const open = key => {
    const group = groupLoad().find(g => g.key === key);
    if (!group) return;
    close();
    layer = document.createElement('div');
    layer.className = 'ld-glass-layer';
    layer.innerHTML = `<div class="wo-glass" data-glass style="--ex-color:${group.color}">
     <div class="wo-glass-card" role="dialog" aria-label="${group.label} — ezen a héten">
      <header class="wo-glass-head">
       ${muscleIcon(group.heads[0].key)}
       <div><small>EZEN A HÉTEN</small><strong>${group.label}</strong></div>
       <button data-glass-close aria-label="Bezárás">×</button>
      </header>
      <div class="wo-glass-hero">
       <span class="wo-glass-main"><strong>${group.done}</strong><small>/ ${group.planned} szett</small></span>
      </div>
      ${groupGlass(key)}
     </div>
    </div>`;
    document.querySelector('.device').append(layer);
    layer.addEventListener('click', event => {
      if (event.target.closest('[data-glass-close]') || !event.target.closest('.wo-glass-card')) close();
    });
    layer.querySelector('[data-glass-close]').focus();
  };

  document.addEventListener('click', event => {
    const el = event.target.closest('[data-load-group]');
    if (el) open(el.dataset.loadGroup);
    const mode = event.target.closest('[data-load-mode]');
    if (mode) {
      mapMode = mode.dataset.loadMode;
      document.querySelectorAll('#ld-map-modes .wz-chip').forEach(chip => {
        const on = chip.dataset.loadMode === mapMode;
        chip.classList.toggle('is-on', on); chip.setAttribute('aria-pressed', String(on));
      });
      const fig = document.querySelector('#ld-map-fig');
      if (fig) fig.innerHTML = mapFigure();
    }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && layer) close(); });
  window.addEventListener('hashchange', close);
}
