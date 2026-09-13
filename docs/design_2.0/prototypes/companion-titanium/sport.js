// Sport logging as its own full-screen flow: pick the sport, fill in what that sport actually
// asks, then the same star ceremony and breakdown the gym session ends with.
import {
  SPORTS, sportById, fieldsFor, defaultValues, estimate, sportStars, metFor, ATHLETE,
} from './sport-state.js';
import { icon, safe, closeSheet, react, toast } from './nap.js';
import { muscleIcon, muscleLabel, muscleColor } from './muscles.js';

const $ = s => document.querySelector(s);
const n = v => v.toLocaleString('hu-HU', { maximumFractionDigits: 1 });

let step = 'pick';          // pick → form → ceremony → details
let chosen = null, mode = null, values = {}, kcalOverride = null, callbacks;

const overlay = document.createElement('section');
overlay.className = 'sp';
overlay.hidden = true;
overlay.setAttribute('aria-label', 'Sport naplózása');
$('.device').append(overlay);

export function openSport() {
  closeSheet();
  step = 'pick';
  chosen = null; mode = null; values = {}; kcalOverride = null;
  overlay.hidden = false;
  $('.device').classList.add('in-workout');
  render();
}

function leave() {
  overlay.hidden = true;
  $('.device').classList.remove('in-workout');
  callbacks?.refresh();
}

function choose(id) {
  chosen = sportById(id);
  mode = chosen.modes?.[0]?.id ?? null;
  values = defaultValues(chosen);
  kcalOverride = null;
  step = 'form';
  render();
}

const current = () => estimate(chosen, values, mode, ATHLETE);
const kcal = () => kcalOverride ?? current().kcal;

/* ── step one: which sport ───────────────────────────────────────────────────────────── */

function pickStep() {
  return `<div class="sp-page">
   <header class="sp-head">
    <button data-sport-leave aria-label="Vissza">‹</button>
    <span><small>NAPLÓZÁS</small><strong>Mi volt ma mozgás?</strong></span>
   </header>
   <p class="sp-lead">Válaszd ki, mit csináltál. A következő lapon csak azt kérdezem, ami annál a sportnál tényleg számít.</p>
   <div class="sp-grid">${SPORTS.map(sport => `<button class="sp-tile" data-sport-pick="${sport.id}" style="--sp-color:${sport.color}">
     <span class="sp-tile-art">${icon(sport.art)}</span>
     <strong>${sport.name}</strong>
    </button>`).join('')}</div>
  </div>`;
}

/* ── step two: the sport's own numbers ───────────────────────────────────────────────── */

function field(spec) {
  const value = values[spec.key];
  if (spec.type === 'chips') {
    return `<div class="sp-field"><label>${spec.label}</label>
     <div class="sp-chips">${spec.options.map(option =>
      `<button type="button" data-sport-chip="${spec.key}:${safe(option)}" aria-pressed="${option === value}">${option}</button>`).join('')}</div></div>`;
  }
  if (spec.type === 'scale') {
    return `<div class="sp-field"><label for="sp-${spec.key}">${spec.label}<b>${value} ${spec.unit}</b></label>
     <input id="sp-${spec.key}" class="sp-range" type="range" name="${spec.key}" min="${spec.min}" max="${spec.max}" step="1" value="${value}"></div>`;
  }
  if (spec.type === 'text') {
    return `<div class="sp-field"><label for="sp-${spec.key}">${spec.label}</label>
     <input id="sp-${spec.key}" class="sp-text" type="text" name="${spec.key}" maxlength="40" value="${safe(value ?? '')}" placeholder="${spec.placeholder ?? ''}"></div>`;
  }
  return `<div class="sp-field"><label for="sp-${spec.key}">${spec.label}</label>
   <div class="sp-number">
    <button type="button" data-sport-step="${spec.key}:${-spec.step}" aria-label="${spec.label} csökkentése">−</button>
    <input id="sp-${spec.key}" type="number" name="${spec.key}" min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${value}" required>
    <span>${spec.unit}</span>
    <button type="button" data-sport-step="${spec.key}:${spec.step}" aria-label="${spec.label} növelése">＋</button>
   </div></div>`;
}

function formStep() {
  const { met } = current();
  const label = chosen.id === 'other' && values.name ? values.name : chosen.name;
  const extra = chosen.summary?.(values);
  return `<div class="sp-page" style="--sp-color:${chosen.color}">
   <header class="sp-head">
    <button data-sport-back aria-label="Vissza a sportválasztóhoz">‹</button>
    <span class="sp-head-art">${icon(chosen.art)}</span>
    <span><small>NAPLÓZÁS · MA</small><strong>${safe(label)}</strong></span>
   </header>

   ${chosen.modes ? `<div class="sp-modes">${chosen.modes.map(m =>
    `<button data-sport-mode="${m.id}" aria-pressed="${m.id === mode}">${m.label}</button>`).join('')}</div>` : ''}

   <form class="sp-form" id="sport-form">${fieldsFor(chosen, mode).map(field).join('')}</form>

   <button class="sp-kcal" data-sport-kcal>
    <span class="sp-kcal-art">${icon('bowl')}</span>
    <span class="sp-kcal-main"><b>≈</b><strong>${n(kcal())}</strong><small>kcal</small></span>
    <span class="sp-kcal-copy"><strong>Ennyit becsülünk erre a mozgásra</strong><small>${n(met)} MET · ${n(ATHLETE.weightKg)} kg · ${ATHLETE.age} év · ${ATHLETE.bodyFatPct}% testzsír${extra ? ` · ${extra}` : ''}</small></span>
    <b>✎</b></button>
   ${kcalOverride !== null ? '<p class="sp-note">Saját értéket adtál meg — ezt mentjük, nem a becslést.</p>' : ''}

   <div class="sp-foot">
    <button class="wo-close-cta" data-sport-save><span class="wo-close-art">${icon('star')}</span><span><strong>Naplózom</strong><small>${values.minutes} perc · ${n(kcal())} kcal</small></span><u class="chip-sheen"></u></button>
   </div>
  </div>`;
}

/* ── step three and four: the same ceremony the gym session ends with ─────────────────── */

function ceremonyStep() {
  const { stars } = sportStars(chosen, values);
  const full = Math.floor(stars), half = stars - full >= .5;
  const label = chosen.id === 'other' && values.name ? values.name : chosen.name;
  return `<div class="wo-summary cer-screen sp-cer" style="--ex-color:${chosen.color}">
   <section class="cer" data-cer style="--p:0">
    <span class="cer-sky" aria-hidden="true"></span>
    <span class="overline">${safe(label).toLocaleUpperCase('hu-HU')} · MA</span>
    <div class="cer-stars" aria-hidden="true">${[0, 1, 2, 3, 4].map(i => `<i data-cer-star="${i}"><b class="cer-aura"></b>${icon('star')}</i>`).join('')}</div>
    <div class="cer-bar"><i class="cer-fill"></i><span class="cer-comet"></span>${[1, 2, 3, 4].map(i => `<u style="--at:${i * 20}%"></u>`).join('')}</div>
    <div class="cer-counters">
     <span><i>${icon('clock')}</i><strong data-cer-count="minutes">0</strong><small>perc</small></span>
     <span><i>${icon('bolt')}</i><strong data-cer-count="intensity">0</strong><small>terhelés</small></span>
     <span><i>${icon('bowl')}</i><strong data-cer-count="kcal">0</strong><small>kcal</small></span>
    </div>
   </section>
   <section class="cer-result">
    <h1 class="sr-only" tabindex="-1">${String(stars).replace('.', ',')} csillag</h1>
    <div class="cer-stats">
     <span><strong>${chosen.target}<i>′</i></strong><small>ennyi a szokásos</small></span>
     <span><strong>+${Math.round(values.minutes / 2)}</strong><small>szerzett XP</small></span>
    </div>
   </section>
   <div class="cer-foot">
    <button class="wo-close-cta" data-sport-details><span class="wo-close-art">${icon('journal')}</span><span><strong>Részletek</strong><small>Izomcsoportok és a nyert kalória</small></span><u class="chip-sheen"></u></button>
   </div>
  </div>`;
}

function detailsStep() {
  const { stars } = sportStars(chosen, values);
  return `<div class="wo-summary cer-details-screen sp-details" style="--ex-color:${chosen.color}">
   <section class="cer-muscles">
    <div class="wo-sum-section"><strong>Amit ez a mozgás megterhelt</strong></div>
    <div class="wo-mstars">${chosen.muscles.map((key, i) => {
    const share = Math.min(1, (values.minutes ?? 0) / chosen.target) * (i === 0 ? 1 : 0.72 - i * 0.12);
    return `<div class="wo-mstar" style="--ex-color:${muscleColor(key)};--i:${i}">
      <span class="wo-mstar-art">${muscleIcon(key)}</span>
      <span class="wo-mstar-copy"><strong>${muscleLabel(key)}</strong><small>becsült terhelés · nem mért adat</small></span>
      <span class="wo-mstar-track"><i class="fill" style="--w:${Math.round(share * 100)}%"></i></span>
     </div>`;
  }).join('')}</div>
   </section>

   <button class="cer-kcal" data-go-fuel>
    <span class="cer-kcal-line">${icon('bowl')}<b>+</b><strong>${n(kcal())}</strong><small>kcal</small></span>
    <span class="cer-kcal-copy">Ennyit nyertél a mai mozgással</span>
    <i class="cer-kcal-go">›</i></button>

   <div class="sp-keep">${icon('bolt')}<p>A sportot saját mozgásként tartjuk meg — nem váltjuk át gym szettekre. A heti terhelésedben külön sorként jelenik meg.</p></div>

   <div class="cer-cta">
    <button class="wo-close-cta is-done" data-sport-leave><span class="wo-close-art">${icon('tick')}</span><span><strong>Kész, vissza a mai napra</strong><small>${String(stars).replace('.', ',')} csillag · ${values.minutes} perc · ${n(kcal())} kcal</small></span><u class="chip-sheen"></u></button>
   </div>
   <p class="wo-glass-note">Mintaadat · a kalóriabecslés MET-táblából és a testadataidból számol, nem AI.</p>
  </div>`;
}

/* ── plumbing ────────────────────────────────────────────────────────────────────────── */

function render() {
  const body = step === 'pick' ? pickStep()
    : step === 'form' ? formStep()
      : step === 'ceremony' ? ceremonyStep() : detailsStep();
  overlay.innerHTML = body;
  if (step === 'ceremony') requestAnimationFrame(runCeremony);
  if (step === 'details') requestAnimationFrame(() => {
    overlay.querySelector('.cer-details-screen')?.classList.add('is-told');
    overlay.querySelector('.wo-sum-section strong')?.focus();
  });
}

function runCeremony() {
  const root = overlay.querySelector('.cer-screen'), stage = overlay.querySelector('[data-cer]');
  if (!root || !stage) return;
  const { ratio } = sportStars(chosen, values);
  const fields = { minutes: values.minutes ?? 0, intensity: values.intensity ?? 0, kcal: kcal() };
  const paint = progress => {
    stage.style.setProperty('--p', String(progress * ratio));
    stage.querySelectorAll('[data-cer-count]').forEach(el => {
      el.textContent = n(Math.round(fields[el.dataset.cerCount] * progress));
    });
    stage.querySelectorAll('[data-cer-star]').forEach(star => {
      const threshold = (Number(star.dataset.cerStar) + 1) / 5;
      star.classList.toggle('is-lit', progress * ratio >= threshold - .001);
      star.classList.toggle('is-half', progress * ratio >= threshold - .1 && progress * ratio < threshold - .001);
    });
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { paint(1); root.classList.add('is-told'); return; }
  const started = performance.now(), duration = 2200;
  const frame = now => {
    const t = Math.min(1, (now - started) / duration);
    paint(1 - (1 - t) ** 3);
    if (t < 1 && stage.isConnected) requestAnimationFrame(frame);
    else { root.classList.add('is-told'); react('celebrate'); }
  };
  requestAnimationFrame(frame);
}

const clamp = (spec, value) => Math.min(spec.max, Math.max(spec.min, value));

overlay.addEventListener('click', event => {
  const el = event.target.closest('button');
  if (!el) return;
  if (el.hasAttribute('data-sport-leave')) return leave();
  if (el.hasAttribute('data-sport-back')) { step = 'pick'; return render(); }
  if (el.dataset.sportPick) return choose(el.dataset.sportPick);
  if (el.dataset.sportMode) { mode = el.dataset.sportMode; kcalOverride = null; return render(); }
  if (el.dataset.sportChip) {
    const [key, option] = el.dataset.sportChip.split(':');
    values[key] = option;
    kcalOverride = null;
    return render();
  }
  if (el.dataset.sportStep) {
    const [key, delta] = el.dataset.sportStep.split(':');
    const spec = chosen.fields.find(f => f.key === key);
    values[key] = clamp(spec, Math.round((Number(values[key]) + Number(delta)) * 100) / 100);
    kcalOverride = null;
    return render();
  }
  if (el.hasAttribute('data-sport-kcal')) return askKcal();
  if (el.hasAttribute('data-sport-save')) {
    if (!values.minutes) { toast('Adj meg időtartamot.'); return; }
    step = 'ceremony';
    return render();
  }
  if (el.hasAttribute('data-sport-details')) { step = 'details'; return render(); }
  if (el.hasAttribute('data-go-fuel')) { leave(); return callbacks.go('fuel', 0); }
});

overlay.addEventListener('input', event => {
  const input = event.target;
  if (!input.name || step !== 'form') return;
  const spec = chosen.fields.find(f => f.key === input.name);
  if (!spec) return;
  values[input.name] = spec.type === 'text' ? input.value : Number(input.value);
  kcalOverride = null;
  if (spec.type === 'scale') {
    input.previousElementSibling.querySelector('b').textContent = `${input.value} ${spec.unit}`;
    overlay.querySelector('.sp-kcal-main strong').textContent = n(kcal());
    return;
  }
  if (spec.type === 'number') {
    overlay.querySelector('.sp-kcal-main strong').textContent = n(kcal());
    overlay.querySelector('[data-sport-save] small').textContent = `${values.minutes} perc · ${n(kcal())} kcal`;
  }
});

/** The estimate is ours; the last word is the athlete's. */
function askKcal() {
  callbacks.dialog('KALÓRIABECSLÉS', `<h2 class="sheet-title">Sokat vagy keveset mondtunk?</h2>
   <p class="sheet-sub">A becslés MET-táblából, a te súlyodból, korodból, nemedből és testzsírodból jön — nem AI. Ha tudod, hogy máshogy volt, írd felül.</p>
   <form id="sport-kcal-form"><label class="form-field">Kalória<input name="kcal" type="number" min="0" max="5000" step="10" value="${kcal()}" required></label>
   <button class="sheet-action">Ezt mentem ✓</button></form>`);
}

export function initSport(options) {
  callbacks = options;
  document.addEventListener('submit', event => {
    if (event.target.id !== 'sport-kcal-form') return;
    event.preventDefault();
    kcalOverride = Number(new FormData(event.target).get('kcal'));
    closeSheet();
    toast('Saját kalóriaérték elmentve.');
    render();
  });
}
