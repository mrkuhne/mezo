// Terhelés — the week's work as a living picture: what happened, what tonight asks, what is left.
// Details live behind the group glass and clay info buttons; the page itself stays one story.
import { WEEK_LOG, weekLoad, groupLoad, weekProgress, weekDays, loadStory } from './load-state.js';
import { MESO, phaseOf, dayByToken } from './plan-state.js';
import { icon, safe } from './nap.js';
import { muscleIcon, muscleLabel, muscleColor, bodyMap, muscleMapHtml } from './muscles.js';

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

/* ── the week, day by day ────────────────────────────────────────────────────────────── */

const DAY_STATE = {
  done: { icon: 'tick', word: 'megvolt' },
  today: { icon: 'bolt', word: 'ma este' },
  missed: { icon: 'skip', word: 'kimaradt' },
  ahead: { icon: 'clock', word: 'még jön' },
  rest: { icon: 'moon', word: 'pihenő' },
  'rest-today': { icon: 'moon', word: 'ma pihenő' },
};

function weekStrip() {
  return `<h3 class="pl-h3">A heted napról napra</h3>
  <div class="ld-days">${weekDays().map(day => {
    const state = DAY_STATE[day.state];
    return `<div class="ld-day is-${day.state}" data-reveal>
     <span class="ld-day-name">${day.name}${day.state === 'today' ? '<b class="ld-ma">MA</b>' : ''}</span>
     <span class="ld-day-what">${day.type ? `<strong>${day.type}</strong><small>${day.sets} szett</small>` : day.sport ? '' : `<small>pihenőnap</small>`}
      ${day.sport ? `<span class="ld-sport-chip">${icon(day.sport.icon)}${day.sport.name} · ${day.sport.minutes} perc</span>` : ''}
     </span>
     <span class="ld-day-state">${icon(state.icon)}<small>${state.word}</small></span>
    </div>`;
  }).join('')}</div>`;
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

export function loadContent() {
  const view = location.hash.slice(1).split('/')[2] ?? '';
  if (view === 'map') return `<div class="pl-sub">
   <button class="pl-back" data-route="train/2">‹ Terhelés</button>
   ${muscleMapHtml(weekLoad().filter(r => r.done > 0).map(r => r.key))}
  </div>`;
  return `${loadHero()}<div class="ld-body">
   ${weekStrip()}
   ${groupCards()}
   ${sportCard()}
   <button class="pl-row is-quiet" data-route="train/2/map">
    <span><strong>Izomtérkép</strong><small>Minden izom, saját jellel — a héten dolgozók kiemelve</small></span><b>›</b></button>
  </div>`;
}

export function initLoad({ dialog }) {
  document.addEventListener('click', event => {
    const el = event.target.closest('[data-load-group]');
    if (!el) return;
    const key = el.dataset.loadGroup;
    const group = groupLoad().find(g => g.key === key);
    if (group) dialog(`${group.label.toUpperCase()} · EZEN A HÉTEN`, `<h2 class="sheet-title">${group.label}</h2><p class="sheet-sub">${group.done} szett megvan a ${group.planned}-ből.</p>${groupGlass(key)}`);
  });
}
