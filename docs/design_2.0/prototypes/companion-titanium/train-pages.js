// Edzés (Train) — Titanium pages. Owner decision 2026-09-12: the four tabs are
// Mai · Terv · Terhelés · Gyakorlatok. The live session stays a full-screen overlay (workout.js).
import { icon, safe } from './nap.js';

import { workoutContent } from './workout.js';
import { EXERCISES as exercises, currentSession, metrics, doneCount } from './session-state.js';

const PLANNED = exercises.reduce((n, e) => n + e.target.sets, 0);

const fmt = value => Math.round(value).toLocaleString('hu-HU');

const gauge = (progress, size = '') =>
  `<div class="fuel-gauge ${size}" style="--fuel-progress:${progress}"><svg class="fuel-gauge-rings" viewBox="0 0 160 160" aria-hidden="true"><circle class="fuel-gauge-base" cx="80" cy="80" r="69" pathLength="100"/><circle class="fuel-gauge-progress" cx="80" cy="80" r="69" pathLength="100"/></svg><span class="fuel-gauge-art">${icon('dumbbell')}</span></div>`;

const tapChip = (label, attr = '') =>
  `<span class="fuel-tapchip" ${attr}><span>${label}</span><b>›</b><u class="chip-sheen"></u></span>`;

const detail = (name, copy, art = 'dumbbell') =>
  `data-detail="${safe(name)}" data-copy="${safe(copy)}" data-art="${art}"`;

/** One muscle ring per exercise of the day — the Train answer to Fuel's macro rings. */
const muscleRing = (name, art, done, plan, color) =>
  `<div class="macro-cell"><span class="macro-ico">${icon(art)}</span><div class="fuel-ring" style="--macro-color:${color};--ring-progress:${Math.min(100, done / plan * 100)}"><svg viewBox="0 0 80 80" aria-hidden="true"><circle class="fuel-ring-track" cx="40" cy="40" r="34" pathLength="100"/><circle class="fuel-ring-progress" cx="40" cy="40" r="34" pathLength="100"/></svg><span aria-label="${name}: ${done} / ${plan} szett"><strong data-fuel-count="${done}">0</strong><b>/ ${plan}<i>szett</i></b></span></div><span class="macro-name">${name}</span></div>`;

/** Impact of the day's movement on each muscle region — plain words, never set counts. */
const REGIONS = [
  { name: 'Mell', art: 'chest', color: '#c8e895', planned: 72, exercise: 0 },
  { name: 'Hát', art: 'back', color: '#8ed2e8', planned: 72, exercise: 1 },
  { name: 'Váll', art: 'shoulder', color: '#bca6f1', planned: 55, exercise: 2 },
  { name: 'Láb', art: 'leg', color: '#e0bd8a', planned: 0, exercise: null },
];
const impactWord = value => value === 0 ? 'ma nem kap' : value >= 65 ? 'erős' : value >= 35 ? 'közepes' : 'enyhe';

function muscleImpact(session) {
  return `<div class="tr-card">
   <div class="tr-card-head"><span class="overline">HATÁS AZ IZOMZATODRA</span><strong>Mit terhel a mai mozgásod</strong></div>
   <div class="tr-mus">${REGIONS.map(r => {
    const logged = r.exercise === null ? 0 : doneCount(session, exercises[r.exercise].id);
    const done = Math.round(r.planned * logged / 3);
    return `<div class="tr-mus-row" style="--mus-color:${r.color}">
     <span class="tr-mus-art">${icon(r.art)}</span>
     <span class="tr-mus-name">${r.name}</span>
     <span class="tr-mus-track"><i class="plan" style="--w:${r.planned}%"></i><i class="done" style="--w:${done}%"></i></span>
     <span class="tr-mus-word">${r.planned === 0 ? 'ma nem kap' : done ? impactWord(done) : `tervben ${impactWord(r.planned)}`}</span></div>`;
   }).join('')}</div>
   <p class="tr-card-note">A halvány sáv a tervezett terhelés, a világos a már megszolgált. Becslés, nem mérés.</p></div>`;
}

/** What the day's movement gives back to the energy budget — the bridge to Fuel. */
function energyCard(planned, done) {
  return `<button class="tr-card is-tappable" data-route="fuel/0" aria-label="A mai kereted a Fuelben">
   <div class="tr-card-head"><span class="overline">A MAI KERETEDHEZ</span><strong>Amit a mozgásod hozzáad</strong></div>
   <div class="tr-energy">
    <span class="tr-energy-main"><b>+</b><strong data-fuel-count="${planned}">0</strong><small>kcal</small></span>
    <span class="tr-energy-split"><span><i class="done"></i>${done} kcal már megszolgálva</span><span><i class="plan"></i>${Math.max(0, planned - done)} kcal a tervben</span></span>
   </div>
   <span class="fuel-tapchip"><span>Megnézem a mai keretem</span><b>›</b><u class="chip-sheen"></u></span></button>`;
}

/** Tomorrow, and anything else that touches the day without being on it. */
const ahead = () => `<button class="tr-block is-ahead" ${detail('Holnap: röplabda', 'Csütörtök 18:00 · röplabda a csapattal. A vállad és a lábad terhelése miatt a mai edzés után a pihenésed is számít. A röplabdát saját sportként tartjuk meg — nem váltjuk át gym szettekre.', 'bolt')}>
    <span class="tr-block-art">${icon('volley')}</span>
    <span class="tr-block-copy"><span class="overline">HOLNAP 18:00 · SPORT</span><strong>Röplabda</strong><small>A vállad és a lábad is kap belőle</small></span>
    <b>›</b></button>`;

function trainToday() {
  const session = currentSession();
  const m = metrics(session);
  const done = session.status === 'complete';
  const share = Math.min(1, m.count / PLANNED);
  const plannedKcal = 260;
  const doneKcal = Math.round(plannedKcal * share);

  const status = done ? '✓ LEZÁRVA' : m.count ? 'FOLYAMATBAN' : 'BETERVEZVE';
  const poster = `<section class="tr-day ${done ? 'is-done' : m.count ? 'is-live' : ''}">
   <span class="tr-day-status">${status}</span>
   <span class="overline">SZERDA 17:00 · GYM</span>
   <h2>Felsőtest A</h2>
   <p>A 6 hetes „Alapból erő" blokk 3. hete.</p>
   <span class="tr-day-art">${icon('dumbbell')}</span>
   <div class="tr-pills"><span>~45 perc</span><span>felsőtest</span><span>3. hét / 6</span></div>
  </section>`;

  const cta = `<button class="tr-start ${done ? 'is-done' : ''}" data-workout>
   <span class="tr-start-art">${icon(done ? 'gem' : 'dumbbell')}</span>
   <span><strong>${done ? 'Visszanézem az edzésemet' : m.count ? 'Folytatom az edzést' : 'Kezdjük az edzést'}</strong><small>${done ? 'A mai edzésed számai' : 'A mai tervezett edzésed'}</small></span>
   <b>${done ? '↗' : '→'}</b></button>`;

  const quick = `<div class="food-list-heading"><h2>Bármi más, ami ma mozgás</h2><span>GYORS INDÍTÁS</span></div>
   <div class="tr-quick">
    <button class="tr-quick-tile" data-custom><span>${icon('kettle')}</span><strong>Egyedi edzés</strong><small>Terv nélkül, most</small><b>＋</b></button>
    <button class="tr-quick-tile" data-sport><span>${icon('run')}</span><strong>Sport naplózása</strong><small>Röplabda · futás · más</small><b>＋</b></button>
   </div>`;

  const more = `<details class="fuel-more flat"><summary>További részletek <span>TERHELÉS · REGENERÁCIÓ · TERV</span></summary>
   <button class="fuel-secondary" data-route="train/2">${icon('ring')}<span><strong>A heti terhelésed</strong></span><b>↗</b></button>
   <button class="fuel-secondary" data-route="me/2">${icon('moon')}<span><strong>Alvás és regeneráció</strong></span><b>↗</b></button>
   <button class="fuel-secondary" data-route="train/1">${icon('stack')}<span><strong>A futó terved</strong></span><b>↗</b></button></details>`;

  return `${poster}${cta}${quick}${energyCard(plannedKcal, doneKcal)}${muscleImpact(session)}${ahead()}${more}`;
}

/** Terv — the plan: the running block, its days, templates, sport and run schedules. Old language, next round. */
function tervPage() {
  const row = (art, name, sub, action = '') =>
    `<button class="sheet-row" ${action}><span>${icon(art)}</span><span><strong>${name}</strong><small>${sub}</small></span><span class="row-end">↗</span></button>`;
  return `<div class="tr-soon">${icon('stack')}<span class="overline">KÖVETKEZŐ KÖR</span><strong>Ez a lap még a régi nyelven van.</strong><p>A Mai után ez jön: a futó mezociklusod íve, a nap-szerkesztő, a sablonok, a tervező, a saját edzés, valamint a sport- és futásbeosztásod.</p></div>
  ${row('stack', 'Alapból erő · aktív', '3. hét / 6 · hypertrophy', detail('Alapból erő', 'Hat hét, heti három gym nap. Aktív mezociklus és heti volumenív.', 'stack'))}
  ${row('stack', 'Mezociklusok és sablonok', 'Aktív, tervezett és lezárt ciklusok', detail('Mezociklusok', 'Alapból erő · aktív. Felső / alsó · sablon. Új ciklus építése itt kap helyet.', 'stack'))}
  ${row('run', 'Sport- és futóterv', 'Röplabda · futóblokkok', detail('Sporttervek', 'Kedd és csütörtök 18:00 · röplabda. A futóblokkok és a gym-időpontok is ide tartoznak.', 'run'))}
  ${row('dumbbell', 'Saját edzés', 'Terv nélküli, ismételhető edzés', detail('Saját edzés', 'Egy ad-hoc, elmentett edzés, amit bármikor újra elindíthatsz.', 'dumbbell'))}`;
}

/** Gyakorlatok — the library: catalogue, records, medals. Old language, later round. */
function gyakorlatokPage() {
  const row = (art, name, sub, action = '') =>
    `<button class="sheet-row" ${action}><span>${icon(art)}</span><span><strong>${name}</strong><small>${sub}</small></span><span class="row-end">↗</span></button>`;
  return `<div class="tr-soon">${icon('book')}<span class="overline">KÖVETKEZŐ KÖRÖK</span><strong>Ez a lap még a régi nyelven van.</strong><p>Ide kerül a gyakorlattár, a gyakorlatonkénti rekordjaid, a medálkabinet és a saját gyakorlataid.</p></div>
  ${row('book', 'Gyakorlattár', '166 alap + a sajátjaid', detail('Gyakorlattár', 'Böngészés izomcsoport szerint, demóképekkel és videóval.', 'book'))}
  ${row('gem', 'Rekordjaid', 'Legjobb szett · becsült 1RM · összvolumen', detail('Rekordok', 'Gyakorlatonként a legjobb szetted és a becsült egyismétléses maximumod.', 'gem'))}
  ${row('ring', 'Medálkabinet', 'Dátumozott rekordtörténet', detail('Medálok', 'Minden megdöntött rekord egy medál, a dátumával és azzal, mit vert meg.', 'ring'))}`;
}

export function trainPagesContent(domain, page, date = '2026-09-09') {
  if (domain !== 'train') return null;
  if (page === 0) return date === '2026-09-09' ? trainToday(date) : workoutContent('train', 0, date);
  if (page === 1) return tervPage();
  if (page === 2) return workoutContent('train', 1, date);
  if (page === 3) return gyakorlatokPage();
  return null;
}


