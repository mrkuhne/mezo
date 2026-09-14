// The plan wizard: full pages, never drawers; arrows, never drag; notes, never blockers.
// State lives in plan-wizard-state.js — these pages only draw it and route between steps.
import {
  CATALOG, wizardDraft, startWizard, dropWizard, draftDay, toggleDay, addExercise, removeExercise,
  moveExercise, changeSets, dayMinutes, draftMuscles, rampSeries, lintDraft, stampRun,
} from './plan-wizard-state.js';
import { LIBRARY, MESO, TIERS, DAY_ORDER, DAY_NAMES, daySets } from './plan-state.js';
import { icon, safe, toast } from './nap.js';
import { muscleIcon, muscleLabel, muscleColor, bodyMap, REGIONS, MUSCLES } from './muscles.js';

const WIZ_COLOR = '#bca6f1';
const hashTo = (...parts) => { location.hash = ['#train/1/new', ...parts].join('/'); };
const route = (...parts) => `data-route="train/1/new${parts.length ? '/' + parts.join('/') : ''}"`;

/** Where you stand in the build — four short words, the current one lit. */
function stepsBar(active) {
  const steps = ['Alapok', 'Napok', 'Izmok', 'Indítás'];
  return `<div class="wz-steps" aria-label="${active + 1}. lépés a négyből">${steps.map((label, i) =>
    `<span class="${i === active ? 'is-now' : i < active ? 'is-done' : ''}"><i></i><small>${label}</small></span>`).join('')}</div>`;
}

const heroHead = (overline, title, say) => `<header class="pl-dhero pl-lhero is-slim" style="--mus-color:${WIZ_COLOR}" data-reveal>
  <span class="pl-dhero-wash"></span>
  <span class="overline">${overline}</span>
  <h2>${title}</h2>
  <p class="pl-say">${say}</p>
 </header>`;

/* ── step 0: what to start from ──────────────────────────────────────────────────────── */

function sourceStep() {
  const rows = LIBRARY.templates.map(t => `<button class="pl-lib-card" data-reveal data-wiz="from:${t.key}">
   <span class="pl-lib-head"><strong>${t.name}</strong><em>${t.split}</em><b>›</b></span>
   <span class="pl-lib-mus">${t.muscles.map(key => `<i style="--mus-color:${muscleColor(key)}">${muscleIcon(key)}</i>`).join('')}</span>
   <small class="pl-lib-note">${t.weeks} hét · hetente ${t.daysPerWeek} nap · minden átírható</small>
  </button>`).join('');
  return `<div class="pl-sub pl-lib wz">
   <button class="pl-back" ${`data-route="train/1/library"`}>‹ Edzéstervek</button>
   ${heroHead('ÚJ TERV', 'Miből induljunk?', 'Egy sablon a gyors út — de indulhatsz teljesen üres lappal is.')}
   ${rows}
   <button class="pl-lib-card is-blank" data-reveal data-wiz="from:blank">
    <span class="pl-lib-head"><strong>Üres lappal</strong><em>mindent te raksz össze</em><b>›</b></span>
    <small class="pl-lib-note">Napok, gyakorlatok, heti emelés — lépésről lépésre.</small>
   </button>
  </div>`;
}

/* ── step 1: the basics ──────────────────────────────────────────────────────────────── */

/** The weeks strip: every week a bar, the closing one always the rest week. */
const weekStrip = weeks => `<div class="pl-arc wz-arc" aria-hidden="true">${Array.from({ length: weeks }, (_, i) =>
  `<i class="${i === weeks - 1 ? 'is-deload' : ''}" style="--h:${Math.round(30 + i / Math.max(1, weeks - 2) * 70)}%"><b>${i + 1}</b></i>`).join('')}</div>`;

function basicsStep(draft) {
  return `<div class="pl-sub pl-lib wz">
   <button class="pl-back" ${`data-route="train/1/new"`}>‹ Vissza</button>
   ${stepsBar(0)}
   ${heroHead('ALAPOK', 'Adj neki nevet és hosszt', 'A terv hetekben él — az utolsó hét mindig pihenőhét.')}
   <label class="form-field wz-name">A terv neve
    <input id="wz-name" maxlength="32" placeholder="Pl. Erő télen" value="${safe(draft.name)}"></label>
   <div class="wz-weeks" data-reveal>
    <div class="wz-weeks-head"><strong>Hossz</strong>
     <span class="wz-step"><button data-wiz="weeks:-1" aria-label="Egy héttel rövidebb">−</button><b id="wz-weeks-value">${draft.weeks} hét</b><button data-wiz="weeks:1" aria-label="Egy héttel hosszabb">＋</button></span>
    </div>
    <div id="wz-weeks-strip">${weekStrip(draft.weeks)}</div>
    <small class="pl-lib-note">Az utolsó, csíkozott hét a pihenőhét: fele annyi szett, hogy kipihend a csúcsot.</small>
   </div>
   <button class="pl-lib-new is-start" data-reveal ${route('days')}>
    <span class="pl-lib-new-art">${icon('dumbbell')}</span>
    <span><strong>Tovább: a napok</strong><small>Melyik napokon edzel, és mit</small></span><b>›</b></button>
  </div>`;
}

/* ── step 2: the days of the week ────────────────────────────────────────────────────── */

function dayCards(draft) {
  const chips = DAY_ORDER.map(token => {
    const on = Boolean(draftDay(draft, token));
    return `<button class="wz-chip ${on ? 'is-on' : ''}" data-wiz="day:${token}" aria-pressed="${on}">${DAY_NAMES[token]}</button>`;
  }).join('');
  const cards = draft.days.map(day => `<button class="pl-lib-card wz-day" ${route('day', day.day)}>
   <span class="pl-lib-head"><strong>${DAY_NAMES[day.day]}</strong><em>${safe(day.type)}</em><b>›</b></span>
   ${day.exercises.length ? `<span class="pl-day-facts">
    <i>${icon('stack')}<b>${day.exercises.length}</b><small>gyakorlat</small></i>
    <i>${icon('dumbbell')}<b>${daySets(day)}</b><small>szett</small></i>
    <i>${icon('clock')}<b>~${dayMinutes(day)}</b><small>perc</small></i>
   </span>` : '<small class="pl-lib-note">Még üres — nyisd meg, és tedd bele a gyakorlatokat.</small>'}
  </button>`).join('');
  return `<div class="wz-chips" role="group" aria-label="Edzésnapok">${chips}</div>${cards}`;
}

function daysStep(draft) {
  return `<div class="pl-sub pl-lib wz">
   <button class="pl-back" ${route('basics')}>‹ Vissza</button>
   ${stepsBar(1)}
   ${heroHead('NAPOK', 'Melyik napokon edzel?', 'Jelöld be a napokat, aztán nyisd meg őket egyenként a gyakorlatokért.')}
   <div id="wz-days-body">${dayCards(draft)}</div>
   <button class="pl-lib-new is-start" data-reveal ${route('focus')}>
    <span class="pl-lib-new-art">${icon('ring')}</span>
    <span><strong>Tovább: az izmok</strong><small>Melyik kapjon többet hétről hétre</small></span><b>›</b></button>
  </div>`;
}

/* ── step 3: one day's exercises ─────────────────────────────────────────────────────── */

function loadBars(day) {
  const rows = new Map();
  for (const e of day.exercises) rows.set(e.muscle, (rows.get(e.muscle) ?? 0) + e.sets);
  if (!rows.size) return '<small class="pl-lib-note">A nap terhelése itt rajzolódik ki, ahogy pakolod a gyakorlatokat.</small>';
  return [...rows].map(([key, sets]) => `<span class="wz-load-row" style="--mus-color:${muscleColor(key)}">
   ${muscleIcon(key)}<small>${muscleLabel(key)}</small>
   <i style="--w:${Math.min(100, sets / 8 * 100)}%"></i><b>${sets}</b>
  </span>`).join('');
}

function exRows(day) {
  if (!day.exercises.length) return '<p class="pl-foot-say">Még nincs itt gyakorlat — kezdd a hozzáadással.</p>';
  return day.exercises.map((e, i) => `<div class="wz-ex" style="--mus-color:${muscleColor(e.muscle)}">
   ${muscleIcon(e.muscle)}
   <span class="wz-ex-name"><strong>${safe(e.name)}</strong><small>${muscleLabel(e.muscle)}</small></span>
   <span class="wz-step"><button data-wiz="sets:${i}:-1" aria-label="Kevesebb szett">−</button><b>${e.sets}</b><button data-wiz="sets:${i}:1" aria-label="Több szett">＋</button></span>
   <span class="wz-ex-tools">
    <button data-wiz="move:${i}:-1" aria-label="Feljebb">↑</button>
    <button data-wiz="move:${i}:1" aria-label="Lejjebb">↓</button>
    <button data-wiz="drop:${i}" aria-label="Törlés">✕</button>
   </span>
  </div>`).join('');
}

function dayStep(draft, token) {
  const day = draftDay(draft, token);
  if (!day) return daysStep(draft);
  return `<div class="pl-sub pl-lib wz" data-wz-day="${token}">
   <button class="pl-back" ${route('days')}>‹ A napok</button>
   ${heroHead(DAY_NAMES[token].toUpperCase(), safe(day.type), 'Sorrend a nyilakkal, szettek a léptetővel — a nap terhelése alul követi.')}
   <div id="wz-exlist">${exRows(day)}</div>
   <button class="pl-lib-new" data-reveal data-wiz="pick">
    <span class="pl-lib-new-art">${icon('dumbbell')}</span>
    <span><strong>Gyakorlat hozzáadása</strong><small>A katalógusból, izomcsoport szerint</small></span><b>＋</b></button>
   <h3 class="pl-h3">A nap terhelése</h3>
   <div id="wz-load" class="wz-load" data-reveal>${loadBars(day)}</div>
  </div>`;
}

/* ── step 4: which muscle gets more ──────────────────────────────────────────────────── */

const rampArc = (series, weeks) => `<div class="pl-arc wz-arc is-mini" aria-hidden="true">${series.map((v, i) =>
  `<i class="${i === weeks - 1 ? 'is-deload' : ''}" style="--h:${Math.round(20 + v / Math.max(...series) * 80)}%"></i>`).join('')}</div>`;

function focusCard(draft, row) {
  const tier = draft.focus[row.key] ?? 'grow';
  const series = rampSeries(row.sets, tier, draft.weeks);
  const words = { maintain: 'marad ennyi', grow: `${row.sets} → ${Math.max(...series)} szett`, emphasize: `${row.sets} → ${Math.max(...series)} szett` };
  return `<div class="wz-mus" data-wz-mus="${row.key}" style="--mus-color:${muscleColor(row.key)}" data-reveal>
   <span class="wz-mus-head">${muscleIcon(row.key)}<strong>${muscleLabel(row.key)}</strong><small>heti ${row.sets} szettről indul</small></span>
   <span class="wz-seg" role="group" aria-label="${muscleLabel(row.key)} — mennyit kapjon">${Object.entries(TIERS).map(([key, t]) =>
    `<button class="${key === tier ? 'is-on' : ''}" data-wiz="focus:${row.key}:${key}" aria-pressed="${key === tier}">${t.label}</button>`).join('')}</span>
   <span class="wz-mus-ramp">${rampArc(series, draft.weeks)}<small>${words[tier]}</small></span>
  </div>`;
}

function focusStep(draft) {
  const rows = draftMuscles(draft);
  const body = rows.length ? rows.map(row => focusCard(draft, row)).join('')
    : '<p class="pl-foot-say" data-reveal>Előbb tegyél gyakorlatokat a napokba — az izmok abból rajzolódnak ki.</p>';
  return `<div class="pl-sub pl-lib wz">
   <button class="pl-back" ${route('days')}>‹ Vissza</button>
   ${stepsBar(2)}
   ${heroHead('IZMOK', 'Melyik kapjon többet?', 'Hétről hétre emelünk — itt döntöd el, melyik izomnál meddig megyünk.')}
   ${body}
   <button class="pl-lib-new is-start" data-reveal ${route('review')}>
    <span class="pl-lib-new-art">${icon('bolt')}</span>
    <span><strong>Tovább: az indítás</strong><small>Áttekintés és kezdőnap</small></span><b>›</b></button>
  </div>`;
}

/* ── step 5: look it over, pick a Monday, stamp it ───────────────────────────────────── */

/** The first few Mondays after the running block ends. */
function mondays(count = 3) {
  const date = new Date(`${MESO.end}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(date); d.setUTCDate(d.getUTCDate() + i * 7);
    return d.toISOString().slice(0, 10);
  });
}
const dateLabel = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });

function reviewStep(draft) {
  const muscles = draftMuscles(draft);
  const weekSets = muscles.reduce((t, r) => t + r.sets, 0);
  const notes = lintDraft(draft);
  if (!draft.start) draft.start = mondays()[0];
  const poster = `<header class="pl-dhero pl-lhero" style="--mus-color:${WIZ_COLOR}" data-reveal>
   <span class="pl-dhero-wash"></span>
   <div class="pl-lhero-map">${bodyMap(muscles.map(r => r.key), { className: 'body-map pl-lhero-body', weights: Object.fromEntries(muscles.map(r => [r.key, r.sets])) })}</div>
   <span class="overline">INDÍTÁS</span>
   <h2>${safe(draft.name) || 'Névtelen terv'}</h2>
   <p class="pl-say">Nézd át még egyszer — aztán mehet a polcra, és indul, amikor jön az ideje.</p>
   <div class="pl-poster-foot"><span>${draft.weeks} hét</span><span>hetente ${draft.days.length} nap</span><span>heti ${weekSets} szett indulásnak</span></div>
  </header>`;
  const noteRows = notes.length ? `<h3 class="pl-h3">Észrevételek ${''}</h3>
  <div class="wz-notes" data-reveal>${notes.map(x => `<p>${icon('info')}${x.say}</p>`).join('')}
   <small class="pl-lib-note">Ezek csak jelzések — a terv így is indítható.</small></div>` : '';
  const starts = `<h3 class="pl-h3">Mikor induljon?</h3>
  <div class="wz-chips" id="wz-starts" data-reveal>${mondays().map(iso =>
   `<button class="wz-chip ${draft.start === iso ? 'is-on' : ''}" data-wiz="start:${iso}" aria-pressed="${draft.start === iso}">${dateLabel(iso)} · hétfő</button>`).join('')}</div>
  <small class="pl-lib-note">A mostani terved ${dateLabel(MESO.end)}-ig tart — utána ez veszi át.</small>`;
  return `<div class="pl-sub pl-lib wz">
   <button class="pl-back" ${route('focus')}>‹ Vissza</button>
   ${stepsBar(3)}
   ${poster}${noteRows}${starts}
   <button class="pl-lib-new is-start is-stamp" data-reveal data-wiz="stamp">
    <span class="pl-lib-new-art">${icon('bolt')}</span>
    <span><strong>A polcra teszem</strong><small>Bekerül a következő futamok közé</small></span><b>›</b></button>
  </div>`;
}

/* ── entry + wiring ──────────────────────────────────────────────────────────────────── */

export function wizardContent(step, id) {
  const draft = wizardDraft();
  if (!step) return sourceStep();
  if (!draft) return sourceStep();
  if (step === 'basics') return basicsStep(draft);
  if (step === 'days') return daysStep(draft);
  if (step === 'day') return dayStep(draft, decodeURIComponent(id));
  if (step === 'focus') return focusStep(draft);
  if (step === 'review') return reviewStep(draft);
  return sourceStep();
}

export function initPlanWizard({ dialog, closeSheet }) {
  const currentDayToken = () => document.querySelector('[data-wz-day]')?.dataset.wzDay ?? null;

  const redrawDay = token => {
    const draft = wizardDraft(), day = draftDay(draft, token);
    const list = document.querySelector('#wz-exlist'), load = document.querySelector('#wz-load');
    if (list) list.innerHTML = exRows(day);
    if (load) load.innerHTML = loadBars(day);
  };

  const pickSheet = () => {
    const groups = REGIONS.map(region => {
      const rows = CATALOG.filter(c => MUSCLES.find(m => m.key === c.muscle)?.region === region.key);
      if (!rows.length) return '';
      return `<div class="wz-pick-group" style="--mus-color:${region.color}"><span class="overline">${region.label.toUpperCase()}</span>${rows.map(c =>
        `<button class="sheet-row" data-wiz="add:${safe(c.name)}"><span>${muscleIcon(c.muscle)}</span><span><strong>${safe(c.name)}</strong><small>${muscleLabel(c.muscle)}</small></span><span class="row-end">＋</span></button>`).join('')}</div>`;
    }).join('');
    dialog('GYAKORLAT HOZZÁADÁSA', `<h2 class="sheet-title">Mit tegyünk a napba?</h2><div class="wz-pick">${groups}</div>`);
  };

  document.addEventListener('click', event => {
    const el = event.target.closest('[data-wiz]');
    if (!el) return;
    const [action, a, b] = el.dataset.wiz.split(':');
    const draft = wizardDraft();

    if (action === 'from') { startWizard(a); hashTo('basics'); return; }
    if (!draft) return;

    if (action === 'weeks') {
      draft.weeks = Math.min(8, Math.max(4, draft.weeks + Number(a)));
      document.querySelector('#wz-weeks-value').textContent = `${draft.weeks} hét`;
      document.querySelector('#wz-weeks-strip').innerHTML = weekStrip(draft.weeks);
    }
    if (action === 'day') {
      toggleDay(draft, a);
      document.querySelector('#wz-days-body').innerHTML = dayCards(draft);
    }
    if (action === 'pick') pickSheet();
    if (action === 'add') { addExercise(draft, currentDayToken(), a); closeSheet(); redrawDay(currentDayToken()); }
    if (action === 'sets') { changeSets(draft, currentDayToken(), Number(a), Number(b)); redrawDay(currentDayToken()); }
    if (action === 'move') { moveExercise(draft, currentDayToken(), Number(a), Number(b)); redrawDay(currentDayToken()); }
    if (action === 'drop') { removeExercise(draft, currentDayToken(), Number(a)); redrawDay(currentDayToken()); }
    if (action === 'focus') {
      draft.focus[a] = b;
      const row = draftMuscles(draft).find(r => r.key === a);
      const card = document.querySelector(`[data-wz-mus="${a}"]`);
      if (card && row) card.outerHTML = focusCard(draft, row).replace(' data-reveal', ' data-reveal class-keep');
    }
    if (action === 'start') {
      draft.start = a;
      document.querySelectorAll('#wz-starts .wz-chip').forEach(chip => {
        const on = chip.dataset.wiz === `start:${a}`;
        chip.classList.toggle('is-on', on); chip.setAttribute('aria-pressed', String(on));
      });
    }
    if (action === 'stamp') {
      const run = stampRun(draft, draft.start);
      dropWizard();
      toast(`${run.name} · a polcra került, ${dateLabel(run.start)}-én indul`);
      location.hash = '#train/1/library';
    }
  });

  document.addEventListener('input', event => {
    if (event.target.id !== 'wz-name') return;
    const draft = wizardDraft();
    if (draft) draft.name = event.target.value;
  });
}
