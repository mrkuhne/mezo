import { initialState, exercises, logSet, finishWorkout, claimReward, buyAura, totals } from './state.mjs';
import { icon, art } from './art.mjs';

let state = initialState();
let view = 'home';
let restEnd = 0;
let startedAt = 0;
let elapsed = 0;
let sound = false;
let audioContext;
let toastTimer;
let lastLevel = 12;
const app = document.querySelector('#app');
const dialog = document.querySelector('#detail');
const fmt = n => n.toLocaleString('hu-HU');
const bar = (pct, color = '') => `<div class="bar ${color}"><span style="width:${Math.min(100, pct)}%"></span></div>`;
const action = (name, text, cls = '', extra = '') => `<button type="button" class="${cls}" data-action="${name}" ${extra}>${text}</button>`;
const skillData = [ ['Erő', 'gym', 18, 68, ''], ['Állóképesség', 'bolt', 14, 42, 'cyan'], ['Kitartás', 'shield', 21, 81, 'purple'] ];

function shell(content) {
  const t = totals(state);
  return `<div class="shell ${state.aura ? 'aurora' : ''}">
    <aside class="sidebar"><div class="logo"><span class="logo-mark">${icon('bolt', 32)}</span>mezo<small>®</small></div>
      <div><div class="nav-caption">A te univerzumod</div><nav class="nav" aria-label="Prototípus navigáció">
        ${action('home', `${icon('gym')}<span>Train</span><i class="dot"></i>`, 'active')}
        ${action('skills', `${icon('chart')}<span>Képességek</span>`)}
        ${action('quests', `${icon('target')}<span>Küldetések</span>`)}
        ${action('rewards', `${icon('trophy')}<span>Gyűjtemény</span>`)}
        ${action('shop', `${icon('shop')}<span>Forge Shop</span>`)}
      </nav></div>
      <div class="sidebar-bottom"><div class="season-mini">${art('gem', 'mini-art')}<div class="eyebrow">Season 04</div><h3>RISE & REBUILD</h3>${bar(62, 'purple')}<p>18 nap a szezonból</p></div>
        <div class="profile"><div class="avatar">D</div><div><b>Dani</b><small>Forge atléta · LVL ${t.level}</small></div><i class="online"></i></div>
      </div>
    </aside>
    <main class="main"><header class="topbar"><div class="breadcrumb">mezo <span>/</span> <b>Train</b><span class="desktop-only">/ NEON FORGE</span></div>
      <div class="wallet">${action('shop', `${icon('coin', 17)}<span>${fmt(state.coins)}</span><span>+</span>`, 'wallet-item gold', 'aria-label="Forge Shop, érmeegyenleg"')}
        <div class="wallet-item purple">${icon('gem', 16)} 24</div>
        ${action('sound', icon('sound', 17), `icon-btn ${sound ? 'sound-on' : ''}`, `aria-label="Hang ${sound ? 'kikapcsolása' : 'bekapcsolása'}" aria-pressed="${sound}"`)}
      </div></header>
      <div class="view">${content}</div>
      <footer class="footer"><span>${icon('bolt', 12)} NEON FORGE <span class="desktop-only">/ DESIGN LAB 001</span> · MOCK PROTOTÍPUS</span>${action('reset', 'Demo újraindítása')}</footer>
    </main></div>`;
}
function heading(kicker, title, description, right = '') {
  return `<div class="page-heading"><div><div class="title-kicker">${kicker}</div><h1>${title}</h1><p>${description}</p></div>${right}</div>`;
}
function levelCard() {
  const t = totals(state);
  return `<section class="panel level-card"><div class="level-top"><div><div class="eyebrow">A karaktered</div><h2>${t.level > 12 ? 'FORGE ELITE' : 'FORGE ATLÉTA'}</h2><p>${t.level > 12 ? 'Új szint. Ugyanaz a tűz.' : 'Minden ismétlés épít.'}</p></div><div class="rank-badge">${t.level}</div></div>
    <div class="xp-row"><b>${fmt(state.xp % 1200)} XP</b><span>1 200 XP · LVL ${t.level + 1}</span></div>${bar(t.progress, 'purple')}
    <div class="level-bottom">${icon('bolt', 12)} ${1200 - state.xp % 1200} XP a következő szintig</div></section>`;
}
function skillsCard() {
  return `<section class="panel skills"><div class="section-head"><h2>KÉPESSÉGEID</h2>${icon('chart', 17)}</div>
    ${skillData.map(([name, glyph, lv, progress, color], i) => `<button class="skill" data-action="skill" data-index="${i}"><span class="skill-ico">${icon(glyph, 18)}</span><span class="skill-text"><span class="skill-label"><b>${name}</b><small>LVL ${lv + (state.claimed ? 1 : 0)}</small></span>${bar(state.claimed ? 15 : progress + state.logs.length * 1.5, color)}</span><span class="skill-gain">+${state.logs.length * (i + 2)}</span></button>`).join('')}
    ${action('skills', `Képességfa megnyitása ${icon('arrow', 14)}`, 'text-btn')}</section>`;
}
function quests() {
  const n = state.logs.length;
  const items = [ ['gym', '', 'Lépj be az arénába', 'Teljesíts egy edzést', state.finished ? 100 : n / 9 * 100, state.finished ? 'TELJESÍTVE' : '200 XP'],
    ['bolt', 'purple', 'Egy sorozattal erősebb', `${n}/9 sorozat · sorozatonként +35 XP`, n / 9 * 100, `${n * 35} XP`],
    ['target', 'cyan', 'Minden nap egy lépés', state.finished ? 'A mai láncszem a helyén. 8 napos streak!' : '7 napos streak · ma rajtad a sor', state.finished ? 100 : 85, state.finished ? '8 NAP' : '7 NAP'] ];
  return `<div class="quests">${items.map(([glyph, color, title, subtitle, progress, reward]) => `<div class="quest"><div class="quest-icon ${color}">${icon(progress === 100 ? 'check' : glyph, 19)}</div><div class="quest-copy"><b>${title}</b><p>${subtitle}</p><div class="quest-progress">${bar(progress, color)}</div></div><div class="quest-reward">${reward}</div></div>`).join('')}</div>`;
}
function home() {
  const t = totals(state);
  return heading('A fejlődés a te játékod', 'MAKE EVERY REP COUNT.', 'Új nap. Új küldetés. Egy erősebb verzió belőled.', '<div class="date-tag">SZERDA<b>2026. szeptember 9.</b></div>') +
    `<div class="dashboard"><div class="left-column">
      <div class="week" aria-label="Heti aktivitás">${['H', 'K', 'SZE', 'CS', 'P', 'SZO', 'V'].map((d, i) => `<div class="day ${i < 2 ? 'done' : ''} ${i === 2 ? 'current' : ''}"><small>${d}</small><strong>${7 + i}</strong><div class="day-status">${i < 2 || (i === 2 && state.finished) ? icon('check', 12) : i === 2 ? icon('bolt', 13) : '·'}</div></div>`).join('')}</div>
      <section class="hero"><div class="hero-copy"><span class="pill">${icon(state.finished ? 'check' : 'target', 12)} ${state.finished ? 'KÜLDETÉS TELJESÍTVE' : 'MAI FŐKÜLDETÉS'}</span>
        <h2>${state.finished ? 'EZT MA<br><em>ODATETTED.</em>' : 'FELSŐTEST.<br><em>KÖVETKEZŐ SZINT.</em>'}</h2>
        <p>${state.finished ? `${state.logs.length} sorozat. ${fmt(t.volume)} kg megmozgatva. A mai munkád már a karaktered része.` : 'Építs erőt. Gyűjts XP-t.<br>A következő szinted itt kezdődik.'}</p>
        <div class="hero-meta"><span>${icon('gym', 13)} 3 gyakorlat</span><span>${icon('clock', 13)} ~35 perc</span></div>
        ${action(state.finished ? 'summary' : 'start', `${state.finished ? 'Eredményem' : state.logs.length ? 'Edzés folytatása' : 'Induljon az edzés'} ${icon('arrow', 18)}`, 'primary')}</div>
        <div class="hero-art"><div class="orbit"></div><div class="orbit two"></div>${art(state.finished ? 'medal' : 'bell')}</div><div class="hero-sticker">${state.finished ? `+${t.earnedXP} XP` : '+515 XP'}<small>${state.finished ? 'MEGSZERZETT FEJLŐDÉS' : 'TELJES EDZÉS + JUTALOM'}</small></div>
      </section>
      <div class="metrics"><div class="metric">${icon('flame', 21)}<span class="trend">ON FIRE</span><div class="value">${state.finished ? 8 : 7} <small>nap</small></div><p>AKTÍV STREAK</p><div class="tiny-bars">${[10, 15, 12, 21, 18, 24, 28].map(h => `<i style="height:${h}px"></i>`).join('')}</div></div>
        <div class="metric cyan">${icon('gym', 21)}<span class="trend">${state.finished ? 'CÉL ELÉRVE' : '+1 A MÚLT HÉTHEZ'}</span><div class="value">${state.finished ? 3 : 2}<small> / 3</small></div><p>HETI EDZÉS</p></div>
        <div class="metric purple">${icon('bolt', 21)}<span class="trend">${state.logs.length ? `+${t.earnedXP} MA` : 'SZÉP TEMPÓ'}</span><div class="value">${fmt(1480 + t.earnedXP)}</div><p>HETI XP</p></div></div>
      <section id="quests"><div class="section-head"><h2>A MAI KÜLDETÉSEID</h2><small>${nComplete()} / 3 TELJESÍTVE</small></div>${quests()}</section>
    </div><aside class="right-column">${levelCard()}${skillsCard()}<section class="panel reward-preview"><div class="eyebrow">${icon('gem', 12)} EPIC DROP</div><h3>A MUNKA<br>MEGHOZZA<br>A JUTALMÁT.</h3><p>${state.claimed ? 'A Forge jelvényed már a gyűjteményedben.' : 'Zárd le az edzést, és nyisd ki a Forge ládát.'}</p>${action('rewards', `Jutalmak ${icon('arrow', 13)}`, 'text-btn')}${art(state.claimed ? 'medal' : 'chest')}</section></aside></div>`;
}
const nComplete = () => (state.finished ? 2 : 0) + (state.logs.length === 9 ? 1 : 0);
function workout() {
  const count = state.logs.length;
  const index = Math.min(2, Math.floor(count / 3));
  const ex = exercises[index];
  const complete = count === 9;
  return heading('Az aréna a tiéd', 'BUILD. REP. REPEAT.', 'Felsőtest A · Erőépítés · 3. hét', action('home', `${icon('back', 15)} Áttekintő`, 'secondary')) +
    `<div class="workout-layout"><div class="left-column"><div class="session-strip"><span class="live-dot"></span><b>EDZÉS FOLYAMATBAN</b><span id="elapsed">${time(elapsed)}</span><span>${count}/9 sorozat</span></div>
      <section class="exercise-stage"><div class="exercise-top"><span class="pill">${icon('gym', 13)} ${complete ? 'MIND A 9 MEGVAN' : `0${index + 1} / 03 GYAKORLAT`}</span><span class="overload">${icon('chart', 13)} ${complete ? 'SZÉP MUNKA' : 'OVERLOAD +2,5 KG'}</span></div>
        <div class="exercise-intro"><div><h2>${complete ? 'TISZTA MUNKA.' : ex.name.toUpperCase()}</h2><p>${complete ? 'Az összes tervezett sorozatod teljesítve.' : ex.muscle}</p><div class="previous">${icon('chart', 14)} Előző edzés <b>${ex.previous}</b></div></div>${art(complete ? 'medal' : 'bell', 'exercise-art')}</div>
        <div class="set-track">${Array.from({ length: 3 }, (_, i) => `<div class="set-node ${count > index * 3 + i ? 'logged' : !complete && count === index * 3 + i ? 'current' : ''}">${count > index * 3 + i ? icon('check', 16) : `<b>${i + 1}</b>`}<small>SOROZAT</small></div>`).join('')}</div>
        ${complete ? `<div class="all-done"><h3>9/9. MINDENT BELETETTÉL.</h3><p>A jutalmad már vár. Zárd le az edzést!</p>${action('finish', `Edzés lezárása ${icon('trophy', 18)}`, 'primary wide')}</div>` :
        `<div class="logging"><div class="input-card"><label for="kg">SÚLY <span>KG</span></label><div class="stepper">${action('less-weight', icon('minus', 17), 'step-btn', 'aria-label="Súly csökkentése"')}<input id="kg" type="number" inputmode="decimal" min="0" max="500" step="2.5" value="${ex.kg}" aria-label="Súly kilogrammban">${action('more-weight', icon('plus', 17), 'step-btn', 'aria-label="Súly növelése"')}</div></div>
          <div class="input-card"><label for="reps">ISMÉTLÉS <span>DB</span></label><div class="stepper">${action('less-reps', icon('minus', 17), 'step-btn', 'aria-label="Ismétlés csökkentése"')}<input id="reps" type="number" inputmode="numeric" min="1" max="100" step="1" value="${ex.reps}" aria-label="Ismétlések száma">${action('more-reps', icon('plus', 17), 'step-btn', 'aria-label="Ismétlés növelése"')}</div></div></div>
          <div class="rest-box" id="rest-box" ${restEnd > Date.now() ? '' : 'hidden'}><div>${icon('clock', 18)}<span>PIHENŐ <b id="rest-time">${time(Math.max(0, Math.ceil((restEnd - Date.now()) / 1000)))}</b></span></div>${action('skip-rest', `Pihenő kihagyása ${icon('arrow', 16)}`, 'text-btn')}</div>
          ${action('log', `${icon('check', 20)} Sorozat kész <span class="button-reward">+35 XP</span>`, 'primary wide log-button', restEnd > Date.now() ? 'disabled' : '')}<p class="input-hint">Minden rögzített sorozat: +35 XP és +5 Forge-érme.</p>`}
      </section>
      <section class="panel session-log"><div class="section-head"><h2>EDDIG AZ ARÉNÁBAN</h2><small>${fmt(totals(state).volume)} KG ÖSSZVOLUMEN</small></div>${count ? state.logs.map((s, i) => `<div class="log-row"><span class="log-check">${icon('check', 13)}</span><span>${exercises[s.exercise].name}<small>${i % 3 + 1}. sorozat</small></span><b>${s.kg} kg × ${s.reps}</b><em>+35 XP</em></div>`).join('') : '<p class="empty">Az első sorozatoddal kezdődik a történet.</p>'}</section>
    </div><aside class="right-column">${levelCard()}<section class="panel workout-list"><div class="section-head"><h2>A MAI PÁLYÁD</h2><small>FELSŐTEST A</small></div>${exercises.map((e, i) => `<div class="plan-row ${i === index ? 'selected' : ''}"><span class="plan-number">${count >= (i + 1) * 3 ? icon('check', 16) : `0${i + 1}`}</span><div><b>${e.name}</b><p>3 × ${e.reps} · ${e.kg} kg</p></div></div>`).join('')}</section>${skillsCard()}${!complete ? action('finish', `Edzés lezárása ${icon('arrow', 15)}`, 'secondary wide', count ? '' : 'disabled') : ''}</aside></div>`;
}
function summary() {
  const t = totals(state);
  return heading(state.claimed ? 'Jutalom megszerezve' : 'Küldetés teljesítve', state.claimed ? (t.level > 12 ? 'WELCOME TO YOUR NEXT LEVEL.' : 'YOUR WORK. YOUR REWARD.') : 'YOU SHOWED UP. NOW POWER UP.', 'Ez nem csak egy edzés. Ez egy újabb lépés előre.') +
    `<div class="summary-layout"><section class="victory"><div class="victory-lines"></div><div class="pill">${icon('check', 14)} FELSŐTEST A · TELJESÍTVE</div><div class="victory-art">${art(state.claimed ? 'medal' : 'chest')}<div class="orbit"></div></div>
      <div class="eyebrow">${state.claimed ? 'A KÖVETKEZŐ VERZIÓD' : 'MEGDOLGOZTÁL ÉRTE'}</div><h2>${state.claimed ? `LEVEL ${t.level}.` : 'A JUTALMAD VÁR.'}</h2><p>${state.claimed ? 'Erősebb lettél. És ez most már látszik is.' : 'Nyisd ki a Forge ládát, és gyűjtsd be az edzésbónuszt.'}</p>
      <div class="loot-row"><div>${icon('bolt', 20)}<b>+${state.claimed ? t.earnedXP : 200}</b><small>${state.claimed ? 'ÖSSZES XP' : 'BÓNUSZ XP'}</small></div><div>${icon('coin', 20)}<b>+${state.claimed ? t.earnedCoins : 60}</b><small>FORGE-ÉRME</small></div><div>${icon('shield', 20)}<b>${state.claimed ? '+1' : 'EPIC'}</b><small>${state.claimed ? 'SKILL SZINT' : 'JELVÉNY'}</small></div></div>
      ${action(state.claimed ? 'home' : 'claim', `${state.claimed ? 'Vissza az áttekintőre' : 'Lássuk a jutalmam!'} ${icon(state.claimed ? 'arrow' : 'gem', 19)}`, 'primary wide')}
    </section><aside class="right-column"><section class="panel"><div class="section-head"><h2>AZ EDZÉSED SZÁMOKBAN</h2>${icon('chart', 18)}</div><div class="recap-stat"><span>Sorozatok</span><b>${state.logs.length}<small> / 9</small></b></div><div class="recap-stat"><span>Megmozgatott súly</span><b>${fmt(t.volume)}<small> kg</small></b></div><div class="recap-stat"><span>Összes ismétlés</span><b>${state.logs.reduce((n, s) => n + s.reps, 0)}</b></div><div class="recap-stat"><span>Edzésidő</span><b>${time(elapsed)}</b></div><div class="recap-stat"><span>Streak</span><b class="lime">8<small> nap</small></b></div></section>${levelCard()}${skillsCard()}</aside></div>`;
}
function render() {
  app.innerHTML = shell(view === 'workout' ? workout() : view === 'summary' ? summary() : home());
}
function navigate(next) { view = next; render(); window.scrollTo({ top: 0, behavior: 'instant' }); }
function time(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }

function toast(message) {
  clearTimeout(toastTimer);
  const el = document.querySelector('#toast');
  el.textContent = message; el.classList.add('show');
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
function chime(big = false) {
  if (!sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    (big ? [392, 494, 587, 784] : [523, 784]).forEach((f, i) => {
      const osc = audioContext.createOscillator(), gain = audioContext.createGain();
      osc.type = 'sine'; osc.frequency.value = f;
      gain.gain.setValueAtTime(0, audioContext.currentTime + i * .09);
      gain.gain.linearRampToValueAtTime(.06, audioContext.currentTime + i * .09 + .02);
      gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + i * .09 + .4);
      osc.connect(gain); gain.connect(audioContext.destination); osc.start(audioContext.currentTime + i * .09); osc.stop(audioContext.currentTime + i * .09 + .45);
    });
  } catch { toast('A hang ebben a böngészőben nem érhető el.'); }
}
function burst(big = false, xp = 35, coins = 5) {
  chime(big);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const effects = document.querySelector('#effects');
  const container = document.createElement('div'); container.className = big ? 'burst big' : 'burst';
  container.innerHTML = `<div class="shockwave"></div><div class="xp-popup">${big ? 'LEVEL UP!' : `+${xp} XP`}<small>${big ? 'ÚJ ERŐ. ÚJ SZINT.' : `+${coins} FORGE-ÉRME`}</small></div>` + Array.from({ length: big ? 55 : 24 }, (_, i) => `<i class="particle" style="--angle:${Math.random() * 360}deg;--distance:${100 + Math.random() * (big ? 500 : 240)}px;--delay:${Math.random() * .15}s;--color:${['#ceff65', '#b596ff', '#73dfef', '#f4cc76'][i % 4]}"></i>`).join('');
  effects.append(container); setTimeout(() => container.remove(), 1700);
}
function modal(title, content) {
  dialog.innerHTML = `<div class="modal-top"><span class="eyebrow">NEON FORGE / ${title}</span>${action('close', icon('close', 20), 'icon-btn', 'aria-label="Bezárás"')}</div>${content}`;
  if (!dialog.open) dialog.showModal();
}
function showSkill(i) {
  const [name, glyph, lv, progress, color] = skillData[i];
  modal('KÉPESSÉG', `<div class="modal-emblem">${icon(glyph, 42)}</div><h2>${name.toUpperCase()}</h2><p>Minden edzéssel épül. A mai sorozataid ${state.logs.length * (i + 2)} skill-pontot adtak hozzá.</p><div class="skill-map"><span class="unlocked">${lv - 1}</span><i></i><span class="unlocked">${lv}</span><i></i><span class="${state.claimed ? 'unlocked' : ''}">${lv + 1}</span></div>${bar(state.claimed ? 15 : progress + state.logs.length * 1.5, color)}<p class="muted">${state.claimed ? 'Új skill-szint feloldva.' : 'Következő feloldás: edzés lezárása + jutalom átvétele.'}</p>${action('close', 'Vissza az arénába', 'primary wide')}`);
}
function showShop() {
  modal('FORGE SHOP', `${art('gem', 'shop-art')}<span class="pill">KOZMETIKAI FELOLDÁS</span><h2>AURORA AURA</h2><p>Violet fénymező a karaktered körül. Csak stílus. Tisztán energia.</p><div class="shop-price">${icon('coin', 21)} 250 <small>EGYENLEG: ${fmt(state.coins)}</small></div>${action('buy', state.aura ? 'Felszerelve' : 'Feloldom az aurát', 'primary wide', state.aura ? 'disabled' : '')}<p class="muted">A 24 kristály a demo gyűjthető valutája; itt Forge-érmével vásárolsz.</p>`);
}
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const name = button.dataset.action;
  try {
    if (name === 'home') navigate('home');
    else if (name === 'start') { if (!startedAt) startedAt = Date.now(); navigate('workout'); }
    else if (name === 'summary') navigate('summary');
    else if (name === 'log') {
      if (restEnd > Date.now()) return;
      const kg = document.querySelector('#kg'), reps = document.querySelector('#reps');
      if (!kg.value.trim() || !reps.value.trim()) throw new Error('Add meg a súlyt és az ismétlések számát.');
      state = logSet(state, Number(kg.value), Number(reps.value));
      restEnd = state.logs.length < 9 ? Date.now() + 90000 : 0;
      render(); burst(); toast(`${state.logs.length}. sorozat rögzítve · +35 XP · +5 érme`);
    } else if (name === 'skip-rest') { restEnd = 0; updateTimers(); toast('Jöhet a következő sorozat.'); }
    else if (name === 'finish') {
      if (state.logs.length < 9) modal('EDZÉS LEZÁRÁSA', `<h2>ENNYI VOLT MÁRA?</h2><p>${state.logs.length}/9 sorozatot rögzítettél. Az elvégzett munkád és jutalmad megmarad.</p>${action('confirm-finish', 'Igen, lezárom az edzést', 'primary wide')}${action('close', 'Folytatom az edzést', 'secondary wide')}`);
      else finish();
    } else if (name === 'confirm-finish') { dialog.close(); finish(); }
    else if (name === 'claim') { const before = totals(state).level; state = claimReward(state); navigate('summary'); burst(totals(state).level > before, 200, 60); toast(`Jutalom begyűjtve · +200 XP · +60 érme${totals(state).level > lastLevel ? ' · SZINTLÉPÉS!' : ''}`); lastLevel = totals(state).level; }
    else if (name === 'skill') showSkill(Number(button.dataset.index));
    else if (name === 'skills') modal('KÉPESSÉGFA', `<h2>A TE FEJLŐDÉSI FÁD.</h2><p>Válassz egy képességet a szintek és az edzésből szerzett pontok megtekintéséhez.</p>${skillsCard()}`);
    else if (name === 'quests') { navigate('home'); document.querySelector('#quests').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    else if (name === 'rewards') modal('GYŰJTEMÉNY', `${art(state.claimed ? 'medal' : 'chest', 'shop-art')}<h2>${state.claimed ? 'FORGE INITIATE' : 'A KÖVETKEZŐ TRÓFEÁD.'}</h2><p>${state.claimed ? 'A mai edzés emléke. A jelvényt megszerezted, a skilljeid szintet léptek.' : 'A mai edzés lezárásával 200 bónusz XP, 60 érme és a Forge Initiate jelvény vár.'}</p>${action('close', 'Vissza', 'primary wide')}`);
    else if (name === 'shop') showShop();
    else if (name === 'buy') { state = buyAura(state); render(); showShop(); chime(true); toast('Aurora aura feloldva és felszerelve!'); }
    else if (name === 'close') dialog.close();
    else if (name === 'sound') { sound = !sound; render(); chime(); toast(sound ? 'Jutalomhangok bekapcsolva' : 'Jutalomhangok kikapcsolva'); }
    else if (name === 'reset') modal('DEMO ÚJRAINDÍTÁSA', `<h2>ÚJ KÖR?</h2><p>A mock edzés, XP és vásárlások visszaállnak a kezdőállapotra.</p>${action('confirm-reset', 'Demo újraindítása', 'primary wide')}${action('close', 'Még maradok', 'secondary wide')}`);
    else if (name === 'confirm-reset') { state = initialState(); restEnd = 0; startedAt = 0; elapsed = 0; lastLevel = 12; dialog.close(); navigate('home'); toast('Tiszta pálya. Mehet a következő kör!'); }
    else if (['less-weight', 'more-weight', 'less-reps', 'more-reps'].includes(name)) {
      const input = document.querySelector(name.includes('weight') ? '#kg' : '#reps');
      const delta = name.includes('weight') ? 2.5 : 1;
      input.value = Math.max(Number(input.min), Math.min(Number(input.max), Number(input.value) + (name.startsWith('less') ? -delta : delta)));
    }
  } catch (error) { toast(error.message); }
});
function finish() { state = finishWorkout(state); elapsed = Math.floor((Date.now() - startedAt) / 1000); restEnd = 0; navigate('summary'); chime(true); }
function updateTimers() {
  if (startedAt && !state.finished) elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const timer = document.querySelector('#elapsed'); if (timer) timer.textContent = time(elapsed);
  const rest = document.querySelector('#rest-box');
  if (rest) {
    const remaining = Math.max(0, Math.ceil((restEnd - Date.now()) / 1000));
    rest.hidden = remaining === 0;
    document.querySelector('#rest-time').textContent = time(remaining);
    const log = document.querySelector('[data-action="log"]'); if (log) log.disabled = remaining > 0;
  }
}
setInterval(updateTimers, 500);
render();
