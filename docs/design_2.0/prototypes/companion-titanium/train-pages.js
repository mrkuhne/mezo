// Edzés (Train) — Titanium pages. Owner decision 2026-09-12: the four tabs are
// Mai · Terv · Terhelés · Gyakorlatok. The live session stays a full-screen overlay (workout.js).
import { icon, safe } from './nap.js';
import { exercises, metrics } from './workout-state.js';
import { workoutContent, workoutSnapshot, currentWorkout } from './workout.js';

const PLANNED = exercises.length * 3;

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

/** What else touches the day — only things the hero does not already say. */
const blocks = () => `<div class="tr-blocks">
   <button class="tr-block is-ahead" ${detail('Holnap: röplabda', 'Csütörtök 18:00 · röplabda a csapattal. A vállad és a lábad terhelése miatt a mai edzés után a pihenésed is számít. A röplabdát saját sportként tartjuk meg — nem váltjuk át gym szettekre.', 'bolt')}>
    <span class="tr-block-art">${icon('bolt')}</span>
    <span class="tr-block-copy"><span class="overline">HOLNAP 18:00 · SPORT</span><strong>Röplabda</strong><small>A vállad és a lábad is kap belőle</small></span>
    <b>›</b></button>
  </div>`;

function trainToday(date) {
  const workout = currentWorkout();
  const m = metrics(workout);
  const done = workout.status === 'complete';
  const left = Math.max(0, PLANNED - m.count);
  const progress = Math.min(100, m.count / PLANNED * 100);
  const hero = `<button class="fuel-focus v-h1" ${detail('A mai edzésed', `Felsőtest A · a 6 hetes „Alapból erő" blokk 3. hete. ${exercises.length} gyakorlat, ${PLANNED} tervezett munkasorozat, 2 ismétlés tartalékkal. A becsült ${45} perc a saját eddigi tempódból jön.`)} aria-label="A mai edzés részletei">
   <div class="hero-pair"><div class="hero-side"><strong data-fuel-count="${m.count}">0</strong><small>SZETT KÉSZ</small></div>${gauge(progress, 'small')}<div class="hero-side lead"><strong data-fuel-count="${left}">0</strong><small>${done ? 'MARADT KI' : 'MÉG HÁTRA'}</small></div></div>
   ${tapChip('Miből áll a mai?')}</button>`;

  const title = `<div class="tr-title"><span class="overline">3. HÉT / 6 · ALAPBÓL ERŐ</span><h2>Felsőtest A</h2><div class="tr-pills"><span>17:00</span><span>${exercises.length} gyakorlat</span><span>${PLANNED} szett</span><span>~45 perc</span><span>2 RIR</span></div></div>`;

  const arts = ['chest', 'back', 'shoulder'];
  const rings = `<section class="fuel-rings three" aria-label="A mai izomcsoportok">${exercises.map((e, i) =>
    muscleRing(e.muscle, arts[i] || 'dumbbell', workout.sets[i].filter(Boolean).length, 3, e.color)).join('')}</section>`;

  const cta = `<button class="tr-start ${done ? 'is-done' : ''}" data-workout>
   <span class="tr-start-art">${icon(done ? 'gem' : 'dumbbell')}</span>
   <span><strong>${done ? 'Visszanézem az edzésemet' : m.count ? 'Folytatom az edzést' : 'Kezdjük az edzést'}</strong><small>${done ? `${m.count} szett · ${fmt(m.volume)} kg × rep` : 'Súly · ismétlés · RIR · pihenőóra'}</small></span>
   <b>${done ? '↗' : '→'}</b></button>`;

  const lineup = `<div class="food-list-heading"><h2>A mai három</h2><span>FÓKUSZ: FELSŐTEST</span></div>
   <div class="tr-lineup">${exercises.map((e, i) => {
    const logged = workout.sets[i].filter(Boolean).length;
    return `<button class="tr-ex" data-workout-exercise="${i}" style="--ex-color:${e.color}">
     <span class="tr-ex-index">0${i + 1}</span>
     <span class="tr-ex-copy"><strong>${e.name}</strong><small>3 × ${e.reps} · ${e.kg} kg · ${e.rir} RIR</small><em>Múlt alkalom: ${e.last}</em></span>
     <span class="tr-ex-ticks" aria-label="${logged} / 3 szett kész">${[0, 1, 2].map(s => `<i class="${workout.sets[i][s] ? 'done' : ''}"></i>`).join('')}</span></button>`;
  }).join('')}</div>`;

  const log = `<button class="fuel-log-action" data-sport><span class="fuel-log-icon">${icon('bolt')}</span><span><strong>Sport naplózása</strong><small>Röplabda · futás · bármi, ami nem a gym</small></span><b>＋</b></button>`;

  const more = `<details class="fuel-more flat"><summary>További részletek <span>TERHELÉS · REGENERÁCIÓ · KERET</span></summary>
   <button class="fuel-secondary" data-route="train/2">${icon('bolt')}<span><strong>A heti terhelésed</strong></span><b>↗</b></button>
   <button class="fuel-secondary" data-route="me/2">${icon('moon')}<span><strong>Alvás és regeneráció</strong></span><b>↗</b></button>
   <button class="fuel-secondary" data-route="fuel/0">${icon('bowl')}<span><strong>A mai kereted</strong></span><b>↗</b></button></details>`;

  return `${hero}${title}${rings}${cta}${blocks()}${lineup}${log}${more}`;
}

/** Terv — the plan: the running block, its days, templates, sport and run schedules. Old language, next round. */
function tervPage() {
  const row = (art, name, sub, action = '') =>
    `<button class="sheet-row" ${action}><span>${icon(art)}</span><span><strong>${name}</strong><small>${sub}</small></span><span class="row-end">↗</span></button>`;
  return `<div class="tr-soon">${icon('stack')}<span class="overline">KÖVETKEZŐ KÖR</span><strong>Ez a lap még a régi nyelven van.</strong><p>A Mai után ez jön: a futó mezociklusod íve, a nap-szerkesztő, a sablonok, a tervező, a saját edzés, valamint a sport- és futásbeosztásod.</p></div>
  ${row('stack', 'Alapból erő · aktív', '3. hét / 6 · hypertrophy', detail('Alapból erő', 'Hat hét, heti három gym nap. Aktív mezociklus és heti volumenív.', 'stack'))}
  ${row('stack', 'Mezociklusok és sablonok', 'Aktív, tervezett és lezárt ciklusok', detail('Mezociklusok', 'Alapból erő · aktív. Felső / alsó · sablon. Új ciklus építése itt kap helyet.', 'stack'))}
  ${row('bolt', 'Sport- és futóterv', 'Röplabda · futóblokkok', detail('Sporttervek', 'Kedd és csütörtök 18:00 · röplabda. A futóblokkok és a gym-időpontok is ide tartoznak.', 'bolt'))}
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

export { workoutSnapshot };
