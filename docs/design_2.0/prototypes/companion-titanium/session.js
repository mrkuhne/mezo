// Active workout, Hevy/RP idiom: one card per exercise in the order you keep, every set a row you
// tick. The rest countdown is a fixed dock that is always present, so nothing on the page ever
// shifts under your thumb.
import {
  EXERCISES, exerciseById, createSession, logSet, undoSet, addSet, removeSet, moveExercise,
  setNote, finishSession, metrics, doneCount, setVerdict, inRange, nextOpen, e1rm, currentSession,
  skipExercise, isSkipped, pendingCount, starsFor, sessionScore,
} from './session-state.js';
import { icon, safe, closeSheet, react, toast } from './nap.js';
import { animateFuelDashboard } from './fuel-dashboard.js';
import { loadRows } from './workout-state.js';
import { legacyShape } from './session-state.js';
import { muscleIcon, muscleLabel, muscleColor } from './muscles.js';

/** An exercise's mark: the real-anatomy muscle chip when it has one, a clay icon otherwise. */
const exArt = e => (e.art.startsWith('m-') ? muscleIcon(e.art.slice(2)) : icon(e.art));

const $ = s => document.querySelector(s);
const n = v => v.toLocaleString('hu-HU', { maximumFractionDigits: 1 });
const clock = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const dateLabel = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });

const session = currentSession();
let callbacks;
let glass = null;            // { kind: 'history' | 'video', id }
let restUntil = 0, restTotal = 0, restFor = null;

const overlay = document.createElement('section');
overlay.className = 'wo';
overlay.hidden = true;
overlay.setAttribute('aria-label', 'Aktív edzés');
$('.device').append(overlay);


export const sessionSnapshot = () => ({ complete: session.status === 'complete', xp: metrics(session).xp });

export function openSession() {
  closeSheet();
  glass = null;
  view = session.status === 'complete' ? 'recap' : 'list';
  session.startedAt ??= Date.now();
  if (session.status === 'ready') session.status = 'active';
  overlay.hidden = false;
  $('.device').classList.add('in-workout');
  render();
}

function leave() {
  overlay.hidden = true;
  glass = null;
  $('.device').classList.remove('in-workout');
  callbacks?.refresh();
  requestAnimationFrame(() => document.querySelector('[data-workout]')?.focus());
}

const VERDICT = {
  record: ['record', 'Rekord'],
  up: ['up', 'Jobb, mint múltkor'],
  down: ['down', 'Kevesebb, mint múltkor'],
  hold: ['hold', 'Ugyanannyi, mint múltkor'],
  new: ['hold', 'Első alkalom'],
};

function verdictCell(exercise, index, row) {
  if (!row.done) return '<span class="wo-verdict" aria-hidden="true"></span>';
  const [kind, label] = VERDICT[setVerdict(exercise, index, row)];
  const range = inRange(exercise, row) ? ' · a javasolt sávban' : ' · a javasolt sávon kívül';
  return `<span class="wo-verdict is-${kind}" title="${label}${range}" aria-label="${label}${range}">${icon(kind === 'record' ? 'record' : kind)}</span>`;
}

function setRow(exercise, index, row) {
  const label = row.extra ? '＋' : index + 1;
  return `<form class="wo-row ${row.done ? 'is-done' : ''}" data-row="${exercise.id}:${index}">
   <span class="wo-idx">${label}</span>
   <label class="wo-field"><input name="kg" type="number" step="0.5" min="0" max="500" value="${row.kg}" required aria-label="${exercise.name}, ${index + 1}. szett, súly kilogrammban"></label>
   <label class="wo-field"><input name="reps" type="number" step="1" min="1" max="100" value="${row.reps}" required aria-label="${exercise.name}, ${index + 1}. szett, ismétlés"></label>
   <label class="wo-field small"><input name="rir" type="number" step="1" min="0" max="10" value="${row.rir}" required aria-label="${exercise.name}, ${index + 1}. szett, RIR"></label>
   <button class="wo-check" type="submit" aria-pressed="${row.done}" aria-label="${index + 1}. szett ${row.done ? 'visszavonása' : 'mentése'}">✓</button>
   ${verdictCell(exercise, index, row)}</form>`;
}

function card(id, position, total) {
  const exercise = exerciseById(id), rows = session.rows[id], note = session.notes[id];
  const skipped = isSkipped(session, id), all = doneCount(session, id) === rows.length;
  return `<section class="wo-card ${skipped ? 'is-skipped' : all ? 'is-complete' : ''}" style="--ex-color:${exercise.color}" aria-label="${exercise.name}">
   <header class="wo-card-head">
    <span class="wo-card-art">${exArt(exercise)}</span>
    <span class="wo-card-copy"><strong>${exercise.name}</strong>${skipped ? '<small>KIHAGYVA</small>' : ''}</span>
    <button class="wo-card-log" data-history="${id}" aria-label="${exercise.name} · előzmények és rekordok">${icon('journal')}</button>
    <button class="wo-card-menu" data-menu="${id}" aria-haspopup="dialog" aria-label="${exercise.name} · további műveletek">⋮</button>
   </header>
   ${note ? `<button class="wo-note" data-note="${id}">${icon('tick')}<span>${safe(note)}</span></button>` : ''}
   ${skipped ? '' : `<div class="wo-cue">${icon('chat')}<p>${exercise.cue}</p></div>
   <div class="wo-rows">
    <div class="wo-rows-head"><span></span><span>KG</span><span>REP</span><span>RIR</span><span></span><span></span></div>
    ${rows.map((row, index) => setRow(exercise, index, row)).join('')}
   </div>`}
  </section>`;
}

/** One menu per card: everything that is not "log this set" lives here. */
function menuGlass(id) {
  const exercise = exerciseById(id), rows = session.rows[id];
  const skipped = isSkipped(session, id), position = session.order.indexOf(id);
  const item = (action, art, label, hint, disabled = false) =>
    `<button class="wo-menu-row" ${disabled ? 'disabled' : action}>${icon(art)}<span><strong>${label}</strong><small>${hint}</small></span><b>›</b></button>`;
  return `<div class="wo-glass" data-glass style="--ex-color:${exercise.color}">
   <div class="wo-glass-card is-menu" role="dialog" aria-label="${exercise.name} műveletei">
    <header class="wo-glass-head">
     <span class="wo-card-art">${exArt(exercise)}</span>
     <span><small>${exercise.muscle.toUpperCase()}</small><strong>${exercise.name}</strong></span>
     <button data-glass-close aria-label="Bezárás">×</button>
    </header>
    <div class="wo-menu">
     ${item(`data-video="${id}"`, 'play', 'Videó', 'A gyakorlathoz csatolt felvétel')}
     ${item(`data-note="${id}"`, 'tick', 'Jegyzet', note(exercise, id))}
     ${item(`data-add="${id}"`, 'dumbbell', 'Szett hozzáadása', `Most ${rows.length} szett van`, skipped)}
     ${item(`data-remove="${id}"`, 'dumbbell', 'Szett elvétele', 'Csak bepipálatlan utolsó szett', skipped || rows.length <= 1 || rows[rows.length - 1].done)}
     ${item(`data-move="${id}:-1"`, 'stack', 'Előrébb', 'Egy hellyel korábban', position === 0)}
     ${item(`data-move="${id}:1"`, 'stack', 'Hátrébb', 'Egy hellyel később', position === session.order.length - 1)}
     ${item(`data-skip="${id}"`, 'skip', skipped ? 'Visszavesszük' : 'Gyakorlat kihagyása', skipped ? 'Újra bekerül a mai munkába' : 'A már logolt szettjeid megmaradnak')}
    </div>
   </div>
  </div>`;
}
const note = (exercise, id) => session.notes[id] ? 'Megírt jegyzet szerkesztése' : 'Ami a következő alkalomra számít';

/**
 * The one way out of the list, in three honest states: nothing logged is a skip, a partial
 * session is the gold road to the rating, a complete one is green.
 */
function finishCta() {
  const m = metrics(session), pending = pendingCount(session);
  const state = m.count === 0 ? 'skip' : pending === 0 ? 'full' : 'partial';
  const label = state === 'skip' ? 'Edzés kihagyása' : 'Edzés befejezése';
  const art = state === 'skip' ? 'skip' : state === 'full' ? 'tick' : 'star';
  return `<button class="wo-finish is-${state}" data-session-summary>
   <span class="wo-finish-glow" aria-hidden="true"></span>
   <span class="wo-finish-art">${icon(art)}</span>
   <strong>${label}</strong>
   <u class="chip-sheen"></u></button>`;
}

/** The dock never changes height, so the list under it never jumps. */
function dock() {
  const m = metrics(session), resting = restUntil > Date.now();
  const exercise = restFor ? exerciseById(restFor) : null;
  const progress = m.planned ? m.count / m.planned * 100 : 0;
  return `<div class="wo-dock ${resting ? 'is-resting' : ''}" role="status" aria-live="polite">
   <span class="wo-dock-ring" style="--ring:${resting ? 0 : progress}"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="track" cx="22" cy="22" r="18" pathLength="100"/><circle class="fill" cx="22" cy="22" r="18" pathLength="100" data-rest-ring/></svg><b data-rest-icon>${resting ? '' : m.count}</b></span>
   <span class="wo-dock-copy">
    <small>${resting ? `PIHENŐ · ${exercise ? exercise.name.toUpperCase() : ''}` : 'ELVÉGZETT MUNKA'}</small>
    <strong data-rest-clock>${resting ? clock(Math.ceil((restUntil - Date.now()) / 1000)) : `${m.count} / ${m.planned} szett`}</strong>
   </span>
   ${resting
    ? `<span class="wo-dock-acts"><button data-rest-add>+30s</button><button data-rest-skip>Kész</button></span>`
    : `<button class="wo-dock-finish" data-finish ${m.count ? '' : 'disabled'}>Lezárás →</button>`}
  </div>`;
}

function historyGlass(id) {
  const e = exerciseById(id), h = e.history, rows = session.rows[id];
  const logged = rows.filter(r => r.done);
  const bestToday = logged.length ? logged.reduce((a, b) => (e1rm(b) > e1rm(a) ? b : a)) : null;
  const volumeToday = logged.reduce((total, r) => total + r.kg * r.reps, 0);

  /** One record: where it stands, and how close today already is to it. */
  const record = (art, label, value, since, now, target, nowLabel, gap) => {
    const share = target ? Math.min(100, now / target * 100) : 0;
    const beaten = now > target;
    return `<div class="rec ${beaten ? 'is-beaten' : ''}">
     <span class="rec-art">${icon(art)}</span>
     <span class="rec-head"><small>${label}</small><strong>${value}</strong></span>
     <span class="rec-since">${since}</span>
     <span class="rec-track"><i style="--w:${share}%"></i></span>
     <span class="rec-now">${beaten ? '<b>MA MEGDÖNTVE</b>' : now ? `ma ${nowLabel}${gap ? ` · ${gap}` : ''}` : ''}</span>
    </div>`;
  };

  const points = [...h.trajectory], all = [...points, ...h.projected];
  const min = Math.min(...all) - 2, max = Math.max(...all) + 2;
  const x = i => 14 + i * (300 / (all.length - 1));
  const y = v => 116 - (v - min) / (max - min) * 96;
  const past = points.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const future = [points.at(-1), ...h.projected].map((v, i) => `${x(points.length - 1 + i)},${y(v)}`).join(' ');

  return `<div class="wo-glass" data-glass style="--ex-color:${e.color}">
   <div class="wo-glass-card" role="dialog" aria-label="${e.name} előzményei és rekordjai">
    <header class="wo-glass-head">
     <span class="wo-card-art">${exArt(e)}</span>
     <span><small>${e.muscle.toLocaleUpperCase('hu-HU')} · ${h.sessions} ALKALOM</small><strong>${e.name}</strong></span>
     <button data-glass-close aria-label="Bezárás">×</button>
    </header>

    <h3 class="wo-glass-title">A múltkori alkalom<span>${dateLabel(h.lastDate)} · ${e.last.length} szett · ${n(e.last.reduce((total, set) => total + set.kg * set.reps, 0))} kg × rep</span></h3>
    <div class="last">
     <div class="last-head"><span></span><span>KG</span><span>REP</span><span>RIR</span></div>
     ${e.last.map((set, i) => `<div class="last-row"><span>${i + 1}</span><strong>${n(set.kg)}</strong><strong>${set.reps}</strong><span>${set.rir}</span></div>`).join('')}
    </div>

    <h3 class="wo-glass-title">Megdönthető rekordok</h3>
    ${bestToday ? '' : '<p class="rec-empty">Ma még nem logoltál ehhez szettet — a sávok üresen állnak.</p>'}
    <div class="recs">
     ${record('peak', 'BECSÜLT 1RM', `${n(h.e1rm)} kg`, `${n(h.nextRecord.kg)} kg × ${h.nextRecord.reps} viszi feljebb`,
       bestToday ? e1rm(bestToday) : 0, h.e1rm, bestToday ? `${n(e1rm(bestToday))} kg` : '',
       bestToday ? `${n(Math.max(0, h.e1rm - e1rm(bestToday)))} kg kell` : '')}
     ${record('record', 'LEGJOBB SZETT', `${n(h.best.kg)} kg × ${h.best.reps}`, `${dateLabel(h.best.date)} óta áll`,
       bestToday ? e1rm(bestToday) : 0, e1rm(h.best), bestToday ? `${n(bestToday.kg)} × ${bestToday.reps}` : '', '')}
     ${record('kettle', 'LEGTÖBB VOLUMEN', `${n(h.maxVolume.value)} kg × rep`, `${dateLabel(h.maxVolume.date)} óta áll`,
       volumeToday, h.maxVolume.value, `${n(volumeToday)} kg × rep`, `még ${n(Math.max(0, h.maxVolume.value - volumeToday))}`)}
    </div>

    <details class="wo-glass-more">
     <summary><span class="wo-glass-more-art">${icon('journal')}</span><span><strong>Hosszabb táv</strong><small>A becsült maximum íve és a medáljaid</small></span><b>⌄</b></summary>
     <figure class="wo-glass-chart">
      <figcaption><span>BECSÜLT 1RM ÍVE</span><small>folytonos: eddig · szaggatott: ha így haladsz</small></figcaption>
      <svg viewBox="0 0 328 132" role="img" aria-label="Becsült egyismétléses maximum eddigi és előrejelzett íve">
       <path d="M14 116H314" stroke="#ffffff1a"/>
       <polyline points="${past}" fill="none" stroke="var(--ex-color)" stroke-width="3" stroke-linejoin="round"/>
       <polyline points="${future}" fill="none" stroke="var(--ex-color)" stroke-width="2.4" stroke-dasharray="5 5" opacity=".62"/>
       ${points.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="var(--ex-color)"/>`).join('')}
      </svg>
      <p>Ha a mostani tempó tart, három blokk múlva ${n(h.projected.at(-1))} kg körüli becsült maximum jön ki. Ez vetítés, nem ígéret.</p>
     </figure>
     <div class="wo-glass-medals">${h.medals.map(medal => `<span>${icon('record')}<strong>${medal.value}</strong><small>${medal.kind} · ${dateLabel(medal.date)}</small></span>`).join('')}</div>
    </details>
    <p class="wo-glass-note">Mintaadatok. A becsült maximum Epley-képlettel számol.</p>
   </div>
  </div>`;
}

function videoGlass(id) {
  const e = exerciseById(id);
  return `<div class="wo-glass" data-glass style="--ex-color:${e.color}">
   <div class="wo-glass-card is-video" role="dialog" aria-label="${e.name} demóvideó">
    <header class="wo-glass-head">
     <span class="wo-card-art">${exArt(e)}</span>
     <span><small>DEMÓVIDEÓ</small><strong>${e.name}</strong></span>
     <button data-glass-close aria-label="Bezárás">×</button>
    </header>
    <div class="wo-video-frame">${icon('play')}<span>${e.video}</span><i></i></div>
    <div class="wo-cue">${icon('chat')}<p>${e.cue}</p></div>
    <p class="wo-glass-note">A prototípusban a videó helyét mutatjuk. Élesben a gyakorlathoz csatolt felvétel játszódik le.</p>
   </div>
  </div>`;
}


/** Closing with unticked sets is allowed — but never silently. */
function confirmGlass() {
  const pending = pendingCount(session), m = metrics(session);
  const perExercise = session.order.filter(id => !isSkipped(session, id))
    .map(id => [exerciseById(id), session.rows[id].filter(r => !r.done).length])
    .filter(([, left]) => left > 0);
  return `<div class="wo-glass" data-glass style="--ex-color:#d9c395">
   <div class="wo-glass-card is-confirm" role="dialog" aria-label="Lezárás megerősítése">
    <span class="wo-confirm-art">${icon('skip')}</span>
    <h2>${m.count ? `Van még ${pending} bepipálatlan szetted.` : 'Egy szettet sem rögzítettél ma.'}</h2>
    <p>Ha most befejezed az edzést, ${m.count ? `ezek <strong>kihagyott</strong> státusszal rögzülnek. A már elmentett ${m.count} szetted természetesen megmarad.` : 'a mai edzés egésze <strong>kihagyott</strong> lesz. Ez is része a ritmusnak — a terv megvár.'}</p>
    <div class="wo-confirm-list">${perExercise.map(([e, left]) => `<span style="--ex-color:${e.color}">${exArt(e)}<strong>${e.name}</strong><b>${left} szett</b></span>`).join('')}</div>
    <button class="wo-close-cta" data-cer-go><span class="wo-close-art">${icon('tick')}</span><span><strong>${m.count ? 'Befejezem így' : 'Kihagyom a mai edzést'}</strong><small>${m.count} elvégzett · ${pending} kihagyott</small></span><u class="chip-sheen"></u></button>
    <button class="wo-secondary" data-glass-close>Mégse, visszamegyek</button>
   </div>
  </div>`;
}

function closeSession() {
  if (finishSession(session)) { react('celebrate'); toast('Edzés lezárva a demóban.'); }
  leave();
}

const starRow = (value, size = '') => {
  const full = Math.floor(value), half = value - full >= .5;
  return `<span class="stars ${size}" aria-label="${String(value).replace('.', ',')} csillag az ötből">${[0, 1, 2, 3, 4].map(i =>
    `<i style="--s:${i}">${icon(i < full ? 'star' : i === full && half ? 'star-half' : 'star-empty')}</i>`).join('')}</span>`;
};

const VERDICTS = [
  [5, 'Hibátlan nap.'], [4, 'Erős nap.'], [3, 'Rendben volt.'], [1.5, 'Elindult.'], [0, 'Ma nem jött össze.'],
];
const verdictFor = stars => VERDICTS.find(([min]) => stars >= min)[1];

/** Weekly muscle load turned into stars: where the week stands against the mesocycle plan. */
function muscleStarRows() {
  return loadRows(legacyShape(session)).map(row => {
    const ratio = row.plan ? Math.min(1, row.done / row.plan) : 0;
    return { ...row, ratio, stars: starsFor(ratio), muscleKey: { chest: 'chest-mid', back: 'back-mid', shoulder: 'shoulder-side', leg: 'quad' }[row.key] };
  });
}

/** Step one: the ceremony owns the screen, and ends with the way on. */
function summary() {
  const m = metrics(session), done = session.status === 'complete', pending = pendingCount(session);
  const minutes = Math.max(1, Math.round(((session.finishedAt || Date.now()) - (session.startedAt || Date.now())) / 60000));
  const score = sessionScore(session);

  const records = session.order.flatMap(id => {
    const e = exerciseById(id);
    const beating = session.rows[id].filter((r, i) => r.done && setVerdict(e, i, r) === 'record');
    if (!beating.length) return [];
    const best = beating.reduce((a, b) => (e1rm(b) > e1rm(a) ? b : a));
    return [{ name: e.name, art: e.art, color: e.color, value: `${n(best.kg)} kg × ${best.reps}`, e1rm: e1rm(best) }];
  });

  return `<div class="wo-summary cer-screen">
   <section class="cer" data-cer style="--p:0">
    <span class="cer-sky" aria-hidden="true"></span>
    <span class="overline">${done ? 'EDZÉS LEZÁRVA' : 'A MAI EDZÉSED'}</span>
    <div class="cer-stars" aria-hidden="true">${[0, 1, 2, 3, 4].map(i => `<i data-cer-star="${i}"><b class="cer-aura"></b>${icon('star')}</i>`).join('')}</div>
    <div class="cer-bar">
     <i class="cer-fill"></i><span class="cer-comet"></span>
     ${[1, 2, 3, 4].map(i => `<u style="--at:${i * 20}%"></u>`).join('')}
    </div>
    <div class="cer-counters">
     <span><i>${icon('dumbbell')}</i><strong data-cer-count="sets">0</strong><small>szett</small></span>
     <span><i>${icon('repeat')}</i><strong data-cer-count="reps">0</strong><small>ismétlés</small></span>
     <span><i>${icon('kettle')}</i><strong data-cer-count="volume">0</strong><small>kg × rep</small></span>
    </div>
   </section>

   <section class="cer-result">
    <h1 class="sr-only" tabindex="-1">${String(score.stars).replace('.', ',')} csillag</h1>
    <div class="cer-stats">
     <span><strong>${minutes}<i>′</i></strong><small>a pulton töltött idő</small></span>
     <span><strong>+${m.xp}</strong><small>szerzett XP</small></span>
    </div>
    ${records.length ? `<div class="cer-record" style="--ex-color:${records[0].color}">${icon('record')}<span><strong>${records.length === 1 ? 'Új rekord' : `${records.length} új rekord`}</strong><small>${records.map(r => `${r.name} · ${r.value}`).join(' · ')}</small></span></div>` : ''}
   </section>

   <div class="cer-foot">
    <button class="wo-close-cta" data-cer-next><span class="wo-close-art">${icon('journal')}</span><span><strong>Részletek</strong><small>Izomcsoportok és a nyert kalória</small></span><u class="chip-sheen"></u></button>
   </div>
  </div>`;
}

/** Step two: what the session did to the week, and the way out. */
function detailsStep() {
  const m = metrics(session), done = session.status === 'complete', pending = pendingCount(session);
  const kcal = Math.round(260 * (m.planned ? m.count / m.planned : 0));
  return `<div class="wo-summary cer-details-screen">
   <section class="cer-muscles">
    <div class="wo-sum-section"><strong>Izomcsoportok fejlődése a mai edzésen</strong></div>
    <div class="wo-mstars">${muscleStarRows().map((row, i) => `<div class="wo-mstar" style="--ex-color:${muscleColor(row.muscleKey)};--i:${i}">
      <span class="wo-mstar-art">${muscleIcon(row.muscleKey)}</span>
      <span class="wo-mstar-copy"><strong>${row.name}</strong><small>${row.done} / ${row.plan} szett${row.added ? ` · ma +${row.added}` : ''}</small></span>
      ${starRow(row.stars, 'mini')}
      <span class="wo-mstar-track"><i class="zone" style="--a:${row.low / row.plan * 100}%;--b:${Math.min(100, row.high / row.plan * 100)}%"></i><i class="fill" style="--w:${row.ratio * 100}%"></i></span>
     </div>`).join('')}</div>
   </section>

   <button class="cer-kcal" data-go-fuel>
    <span class="cer-kcal-line">${icon('bowl')}<b>+</b><strong>${kcal}</strong><small>kcal</small></span>
    <span class="cer-kcal-copy">Ennyit nyertél a mai mozgással</span>
    <i class="cer-kcal-go">›</i></button>

   <div class="cer-cta">${done
    ? `<button class="wo-close-cta is-done" data-session-leave><span class="wo-close-art">${icon('tick')}</span><span><strong>Vissza a mai napra</strong><small>Az edzés lezárva és elmentve</small></span><u class="chip-sheen"></u></button>`
    : `<button class="wo-close-cta" data-finish-confirm><span class="wo-close-art">${icon('tick')}</span><span><strong>Edzés lezárása</strong><small>${pending ? `${m.count} elvégzett · ${pending} még bepipálatlan` : `Mind a ${m.count} szetted megvan`}</small></span><u class="chip-sheen"></u></button><button class="wo-secondary" data-cer-back>Vissza az értékeléshez</button>`}</div>
   <p class="wo-glass-note">Mintaedzés · a csillagok a tervezett szettből, ismétlésből és súlyból számolnak, nem AI-értékelés.</p>
  </div>`;
}

/** The finished session, read back: the rating and the breakdown on one settled page. */
function recap() {
  const m = metrics(session), pending = pendingCount(session);
  const minutes = Math.max(1, Math.round(((session.finishedAt || Date.now()) - (session.startedAt || Date.now())) / 60000));
  const kcal = Math.round(260 * (m.planned ? m.count / m.planned : 0));
  const score = sessionScore(session);
  const full = Math.floor(score.stars), half = score.stars - full >= .5;

  const records = session.order.flatMap(id => {
    const e = exerciseById(id);
    const beating = session.rows[id].filter((r, i) => r.done && setVerdict(e, i, r) === 'record');
    if (!beating.length) return [];
    const best = beating.reduce((a, b) => (e1rm(b) > e1rm(a) ? b : a));
    return [{ name: e.name, color: e.color, value: `${n(best.kg)} kg × ${best.reps}` }];
  });

  return `<div class="wo-summary cer-details-screen is-told wo-recap">
   <section class="cer is-settled" style="--p:${score.ratio}">
    <span class="cer-sky" aria-hidden="true"></span>
    <span class="overline">EDZÉS LEZÁRVA</span>
    <div class="cer-stars" aria-label="${String(score.stars).replace('.', ',')} csillag az ötből">${[0, 1, 2, 3, 4].map(i =>
      `<i class="${i < full ? 'is-lit' : i === full && half ? 'is-half' : ''}"><b class="cer-aura"></b>${icon('star')}</i>`).join('')}</div>
    <div class="cer-bar"><i class="cer-fill"></i>${[1, 2, 3, 4].map(i => `<u style="--at:${i * 20}%"></u>`).join('')}</div>
    <div class="cer-counters">
     <span><i>${icon('dumbbell')}</i><strong>${m.count}</strong><small>szett</small></span>
     <span><i>${icon('repeat')}</i><strong>${m.reps}</strong><small>ismétlés</small></span>
     <span><i>${icon('kettle')}</i><strong>${n(m.volume)}</strong><small>kg × rep</small></span>
    </div>
   </section>

   <div class="cer-stats">
    <span><strong>${minutes}<i>′</i></strong><small>a pulton töltött idő</small></span>
    <span><strong>+${m.xp}</strong><small>szerzett XP</small></span>
   </div>
   ${records.length ? `<div class="cer-record" style="--ex-color:${records[0].color}">${icon('record')}<span><strong>${records.length === 1 ? 'Új rekord' : `${records.length} új rekord`}</strong><small>${records.map(r => `${r.name} · ${r.value}`).join(' · ')}</small></span></div>` : ''}
   ${pending ? `<p class="wo-recap-note">${pending} szett kihagyott státusszal zárult.</p>` : ''}

   <section class="cer-muscles">
    <div class="wo-sum-section"><strong>Izomcsoportok fejlődése a mai edzésen</strong></div>
    <div class="wo-mstars">${muscleStarRows().map((row, i) => `<div class="wo-mstar" style="--ex-color:${muscleColor(row.muscleKey)};--i:${i}">
      <span class="wo-mstar-art">${muscleIcon(row.muscleKey)}</span>
      <span class="wo-mstar-copy"><strong>${row.name}</strong><small>${row.done} / ${row.plan} szett${row.added ? ` · ma +${row.added}` : ''}</small></span>
      ${starRow(row.stars, 'mini')}
      <span class="wo-mstar-track"><i class="zone" style="--a:${row.low / row.plan * 100}%;--b:${Math.min(100, row.high / row.plan * 100)}%"></i><i class="fill" style="--w:${row.ratio * 100}%"></i></span>
     </div>`).join('')}</div>
   </section>

   <button class="cer-kcal" data-go-fuel>
    <span class="cer-kcal-line">${icon('bowl')}<b>+</b><strong>${kcal}</strong><small>kcal</small></span>
    <span class="cer-kcal-copy">Ennyit nyertél a mai mozgással</span>
    <i class="cer-kcal-go">›</i></button>

   <div class="cer-cta"><button class="wo-close-cta is-done" data-session-leave><span class="wo-close-art">${icon('tick')}</span><span><strong>Vissza a mai napra</strong><small>Az edzés lezárva és elmentve</small></span><u class="chip-sheen"></u></button></div>
  </div>`;
}

/** Runs the closing ceremony once: the bar fills, the counters run with it, the stars ignite. */
function runCeremony() {
  const root = overlay.querySelector('.cer-screen'), stage = overlay.querySelector('[data-cer]');
  if (!root || !stage) return;
  const score = sessionScore(session);
  const fields = { sets: score.done.sets, reps: score.done.reps, volume: score.done.volume };
  const paint = progress => {
    stage.style.setProperty('--p', String(progress * score.ratio));
    stage.querySelectorAll('[data-cer-count]').forEach(el => {
      const value = fields[el.dataset.cerCount] * progress;
      el.textContent = el.dataset.cerCount === 'volume' ? n(Math.round(value)) : String(Math.round(value));
    });
    stage.querySelectorAll('[data-cer-star]').forEach(star => {
      const threshold = (Number(star.dataset.cerStar) + 1) / 5;
      star.classList.toggle('is-lit', progress * score.ratio >= threshold - .001);
      star.classList.toggle('is-half', progress * score.ratio >= threshold - .1 && progress * score.ratio < threshold - .001);
    });
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    paint(1); root.classList.add('is-told'); return;
  }
  const started = performance.now(), duration = 2400;
  const frame = now => {
    const t = Math.min(1, (now - started) / duration);
    paint(1 - (1 - t) ** 3);
    if (t < 1 && stage.isConnected) requestAnimationFrame(frame);
    else {
      root.classList.add('is-told');
      react('celebrate');

    }
  };
  requestAnimationFrame(frame);
}

let view = 'list';

function render() {
  const keep = overlay.querySelector('.wo-scroll')?.scrollTop ?? 0;
  const m = metrics(session);
  const head = `<header class="wo-head">
   <button data-session-leave aria-label="Vissza az Edzés Mai oldalára">‹</button>
   <span><small>FELSŐTEST A · 3. HÉT / 6</small><strong>${m.count} / ${m.planned} szett</strong></span>
   <span class="wo-clock" data-session-clock>0:00</span></header>`;
  const body = view === 'recap'
    ? recap()
    : view === 'details'
    ? detailsStep()
    : view === 'summary'
    ? summary()
    : `<div class="wo-list">${session.order.map((id, i) => card(id, i, session.order.length)).join('')}
       ${finishCta()}</div>`;
  overlay.innerHTML = `${head}<div class="wo-scroll ${view === 'list' ? '' : 'is-plain'}">${body}</div>${view === 'list' ? dock() : ''}${glass ? (glass.kind === 'history' ? historyGlass(glass.id) : glass.kind === 'menu' ? menuGlass(glass.id) : glass.kind === 'confirm' ? confirmGlass() : videoGlass(glass.id)) : ''}`;
  const scroller = overlay.querySelector('.wo-scroll');
  if (scroller) scroller.scrollTop = view === 'summary' ? 0 : keep;
  updateTimers();
  if (view === 'summary') requestAnimationFrame(() => { runCeremony(); overlay.querySelector('h1')?.focus(); });
  if (view === 'recap') requestAnimationFrame(() => overlay.querySelector('.wo-sum-section strong')?.focus());
  if (view === 'details') requestAnimationFrame(() => {
    // Step two plays too: the bars grow and the stars land, row by row.
    overlay.querySelector('.cer-details-screen')?.classList.add('is-told');
    overlay.querySelector('.wo-sum-section strong')?.focus();
  });
}

function updateTimers() {
  if (overlay.hidden) return;
  const elapsed = Math.max(0, Math.floor(((session.finishedAt || Date.now()) - (session.startedAt || Date.now())) / 1000));
  overlay.querySelectorAll('[data-session-clock]').forEach(el => { el.textContent = clock(elapsed); });
  const left = Math.max(0, Math.ceil((restUntil - Date.now()) / 1000));
  const dockEl = overlay.querySelector('.wo-dock');
  if (!dockEl) return;
  if (left) {
    dockEl.querySelector('[data-rest-clock]').textContent = clock(left);
    dockEl.querySelector('.wo-dock-ring')?.style.setProperty('--ring', String(100 - left / restTotal * 100));
  } else if (dockEl.classList.contains('is-resting')) {
    restFor = null;
    render();
  }
}
setInterval(updateTimers, 250);

function startRest(id) {
  const exercise = exerciseById(id);
  restTotal = exercise.target.rest;
  restUntil = Date.now() + restTotal * 1000;
  restFor = id;
}

function noteSheet(id) {
  const exercise = exerciseById(id);
  callbacks.dialog(`${exercise.name.toLocaleUpperCase('hu-HU')} · JEGYZET`,
    `<h2 class="sheet-title">Mit vigyünk tovább?</h2><p class="sheet-sub">A jegyzet a gyakorlathoz tapad, és a következő alkalommal is előjön.</p><form id="wo-note-form" data-exercise="${id}"><label class="form-field">Jegyzet<textarea name="note" maxlength="280" rows="4" placeholder="Pl. a jobb vállam feszült a harmadik szettben.">${safe(session.notes[id])}</textarea></label><button class="sheet-action">Megjegyzem ✓</button></form>`);
}

overlay.addEventListener('click', event => {
  const el = event.target.closest('button');
  if (!el) return;
  if (el.hasAttribute('data-glass-close')) { glass = null; return render(); }
  if (el.dataset.menu) { glass = { kind: 'menu', id: el.dataset.menu }; return render(); }
  if (el.dataset.skip) {
    const id = el.dataset.skip;
    skipExercise(session, id, !isSkipped(session, id));
    toast(isSkipped(session, id) ? 'Gyakorlat kihagyva.' : 'Gyakorlat visszavéve.');
    glass = null;
    return render();
  }
  if (el.dataset.history) { glass = { kind: 'history', id: el.dataset.history }; return render(); }
  if (el.dataset.video) { glass = { kind: 'video', id: el.dataset.video }; return render(); }
  if (el.dataset.note) { glass = null; render(); return noteSheet(el.dataset.note); }
  if (el.dataset.add) { addSet(session, el.dataset.add); glass = null; return render(); }
  if (el.dataset.remove) { removeSet(session, el.dataset.remove); glass = null; return render(); }
  if (el.dataset.move) {
    const [id, delta] = el.dataset.move.split(':');
    if (moveExercise(session, id, Number(delta))) { toast('Sorrend módosítva.'); glass = null; render(); }
    return;
  }
  if (el.hasAttribute('data-rest-skip')) { restUntil = 0; restFor = null; return render(); }
  if (el.hasAttribute('data-rest-add')) { restUntil += 30_000; restTotal += 30; return updateTimers(); }
  if (el.hasAttribute('data-finish') || el.hasAttribute('data-session-summary')) {
    if (pendingCount(session)) { glass = { kind: 'confirm' }; return render(); }
    view = 'summary';
    return render();
  }
  if (el.hasAttribute('data-cer-go')) { glass = null; view = 'summary'; return render(); }
  if (el.hasAttribute('data-session-back')) { view = 'list'; return render(); }
  if (el.hasAttribute('data-finish-confirm')) return closeSession();
  if (el.hasAttribute('data-cer-next')) { view = 'details'; return render(); }
  if (el.hasAttribute('data-cer-back')) { view = 'summary'; return render(); }
  if (el.hasAttribute('data-go-fuel')) { leave(); return callbacks.go('fuel', 0); }
  if (el.hasAttribute('data-session-leave')) return leave();
});

overlay.addEventListener('submit', event => {
  const form = event.target.closest('[data-row]');
  if (!form) return;
  event.preventDefault();
  const [id, index] = form.dataset.row.split(':');
  const row = session.rows[id][Number(index)];
  if (row.done) { undoSet(session, id, Number(index)); return render(); }
  const data = new FormData(form);
  const input = { kg: Number(data.get('kg')), reps: Number(data.get('reps')), rir: Number(data.get('rir')) };
  if (!logSet(session, id, Number(index), input)) { toast('Ellenőrizd a számokat: súly, ismétlés, RIR.'); return; }
  if (session.rows[id].some(r => !r.done)) startRest(id);
  else {
    const next = nextOpen(session, id);
    if (next) startRest(id);
    else restUntil = 0;
  }
  react('connect');
  render();
  const nextRow = overlay.querySelector(`[data-row="${id}:${Number(index) + 1}"] input[name=kg]`);
  nextRow?.focus({ preventScroll: true });
});

export function initSession(options) {
  callbacks = options;
  document.addEventListener('submit', event => {
    const form = event.target;
    if (form.id !== 'wo-note-form') return;
    event.preventDefault();
    setNote(session, form.dataset.exercise, new FormData(form).get('note'));
    closeSheet();
    toast('Jegyzet elmentve a demóban.');
    if (!overlay.hidden) render();
  });
}

export { EXERCISES };
