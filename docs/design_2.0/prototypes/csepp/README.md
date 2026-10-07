# Csepp prototype — domain files

`klinikai-iranyok.html` is the **shell**: tokens (dark + pure-white light), the élő csepp,
the steel-tinted Titanium/clay sprites, the MuscleChip anatomy, header + bottom nav, sheets,
toasts, the hash router and the notes column. Each domain lives in **one file**,
`csepp/<domain>.js`, and registers its routes on `window.K`. One agent owns one file; never
edit the shell or another domain's file.

Open it: `python3 -m http.server 8731 --bind 127.0.0.1` in `docs/design_2.0/prototypes/`
(one may already be running — check with `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8731/klinikai-iranyok.html`),
then `http://127.0.0.1:8731/klinikai-iranyok.html?v=N#a-<domain>-<route>` (`?v=N` cache-bust,
`&vilagos` light theme, `&still` reduced motion). `#j-<domain>-<route>` shows the **living
prototype** `elo/<domain>.html#<route>` in the same frame — the owner compares the two, so
**use the same route names as the living prototype** (its `V`/`VW` route table near the end
of the file; e.g. Nap: `mai checkin hatasok napom eletjel kuldetesek rutin uzenetek gyors
napzaras ikonok nap maieste rutin-epites lanc szokasok szokas szerk rutin-uj`).

## Registering a domain

```js
(function(){
const {I,T,csepp,ring,page,sec,back,wkBars,register,mchp,muscleColor,css,toast,openSheet,closeSheet,esc}=K;
function mai(arg){ return page(`...inner html...`,'fuel','mai'); }
function log(arg){ return page(`${back('Mai','mai')}...`,'fuel','log',{pad:'170px'}); }
register('fuel',{
  mark:'i-bowl',
  tabs:[['Mai','i-bowl','mai'],['Napló','i-cal','naplo'],['Kamra','i-grid','kamra'],['Tudás','i-book','tudas']], // = the app's navModel tabs
  routes:{mai,log,naplo,...},     // route name → (arg)=>html ; `mai` is mandatory
  sheets:{ etkezes:(arg)=>`<h2 class="t">…</h2>…` }, // opened by data-sheet="etkezes" data-arg="…"
  after:(route,arg)=>{},          // optional: start timers etc. after render
  css:`...domain-only CSS, prefixed .phone[data-v="ajanlott"][data-d="fuel"] …`,
  notes:`<h2>Fuel</h2><p>…Hungarian, owner-facing…</p>`  // what to click, what changed, which principle
});
})();
```

- `page(inner, domain, activeTabRoute, {pad})` wraps the inner HTML with aurora, header,
  the domain's bottom nav (active tab highlighted), toast, sheet + scrim.
- Navigation attributes (delegated by the shell): `data-go="route"` or `data-go="route.arg"`,
  `data-back` (history back inside the phone), `data-sheet="name" data-arg="x"`,
  `data-close`, `data-toast="…"` (for out-of-scope taps). `K.go(route)` from code.
- Hash: `#a-fuel-log.photo` → route `log`, arg `photo`. Only `[a-z0-9_-]` in route names.
- `K.D/K.R/K.ARG/K.LIGHT` are read-only getters.

## Kit (CSS classes already in the shell — use them, do not reinvent)

| What | Markup |
|---|---|
| Open section (no box) | `<section class="open rise" style="--i:3"><span class="eb">Címke</span>…</section>` |
| Row | `<div class="ln">${I('i-bowl')}<span class="g">Title<small>sub</small></span><span class="v"><b>148</b> / 220 g</span>${I('i-chev','chev')}</div>` |
| Glass hero (1–2 per screen!) | `<section class="card hg rise" …>` ; Edzés hero: `<section class="hero hg rise">` |
| Big numeral | `<div class="big"><span class="num">2 060</span><span class="v">/ 3 100 kcal</span></div>` |
| Bar | `<div class="bar q"><b style="--w:66%"></b></div>` (grey = fine) · `<div class="bar" style="--c:var(--protein)">` (category) |
| Status pill | `<span class="st plan|ok|warn|bad|q">Tervezett</span>` |
| Buttons | `<button class="btn">` primary (accent, one per screen) · `btn sm` · `btn ghost` · `<button class="lk">` text link |
| Chips (sparingly) | `<span class="chip">…</span>` |
| Verdict sentence | `<p class="verdict">Ma jó nap egy közepes edzéshez.</p>` · body `<p class="txt">` / `txt sub` · footnote `<p class="fn">` |
| Section header | `sec('Címke','jobb oldali címke')` |
| Quick actions | `<div class="qrow"><button>${I('i-pulse')}Check-in</button>…<button class="more">Több ›</button></div>` |
| Day strip | `.ds` (see edzes.js) · weekly macro bars `wkBars()` · set rows `.sets` · rest dock `.rest` (edzes.js) |
| Csepp | `csepp(state,fill,{s,val,label,form,alive,color,cls})` — states `ok/warn/bad`; **only for the user's day / a day-state**, never for other metrics |
| Muscle chip | `mchp('back-wide','sm')`, colour `muscleColor(key)` (keys in the shell's MUSCLES list) |
| Icons | `I('i-…')` = line icon with steel 3D mapping (see `TD` in the shell: gear mail bell sun cal chat list dumb layers bars book pulse plus pen steps bowl check chev flame muscle run ball clock skip warn bed mood bolt moon grid). Any other Titanium/clay symbol directly: `T('t-avocado')`, `T('c-i-fuel')` — ids: `grep -o 'id="t-[a-z-]*"' ../elo/<domain>.html | sort -u` (t-meat t-carb t-fat t-water t-fiber t-plate t-pot t-basket t-camera t-mic t-scroll t-pattern t-orb t-people t-person t-heart t-weight t-trend t-score t-spark t-star t-quest t-chain t-journal t-sleep t-rested t-soreness t-motivation t-pain t-ill t-travel t-kimelo t-record t-up t-down t-hold t-swap t-addex t-template t-compare t-history t-pin t-link t-info t-note t-send t-trash t-tick …). **Never emoji.** |
| Theme tokens | `--page --card --card2 --hair --ink --sub --faint --acc --acc-ink --ok --warn --bad --protein --carb --fat --dom` (both themes set them; never hard-code a colour) |

## The rules (owner decisions 2026-10-07 — spec `docs/superpowers/specs/2026-10-07-csepp-irany-design.md`)

1. **Four text roles:** title (`h1.t`/`h2.t`), body (`.txt`), small mono label (`.eb`, `.v`), big numeral (`.num`). No chips/footnotes unless irreplaceable.
2. **A box only for glass.** 1–2 `hg` cards per screen carry the most important thing; everything else is `.open` sections with `.ln` rows. No other borders or backgrounds.
3. **Two shades:** ground + hairline.
4. **Colour = meaning, otherwise grey.** State colours (`--ok/--warn/--bad`) only where something asks for attention; category colours (`--protein/--carb/--fat`, `muscleColor`) are stable and muted; accent only on the one primary action and the active tab. A bar for something that is fine is grey (`bar q`).
5. **Say a thing once.** No descriptive heading above a card that says the same; a **verdict sentence** replaces it where a judgement exists.
6. **The csepp means the day.** Never a progress indicator for anything else. The team personas are **sibling forms** (`csepp('ok',fill,{form:'pebble|bean|drop|leaf|crystal',color})`): Szunya pebble `#AB9FD2` (alvás), Mocor bean `#7FB2D0` (mozgás), Falat drop `#8FB49A` (étel), Derű leaf `#D9B67E` (kedv), Mezo crystal `#9AA3A8`. They are the sender of a message; the text is the voice. No faces, no Boop creatures anywhere.
7. **Behaviour frozen:** every control, state, data field and sheet of the live screen stays (read the living prototype's route and the page components under `frontend/src/features/<domain>`; the feature doc `docs/features/<domain>.md` lists them). Never invent features. Out-of-scope taps get `data-toast`.
8. **Both themes** must look right (`&vilagos`). 320px wide must not overflow. Reduced motion (`&still`) must be fine (motion only via the shell's `.rise`, csepp, bars).
9. Real-looking **Hungarian** content of the real record types; never production rows.

## Principles borrowed from MacroFactor and Built With Science (apply where the domain fits)

- **Hat + lists (MF):** one hero at the top (the day's / week's at-a-glance), ordered open sections below, each row opens an inner page.
- **Target met → neutral (MF):** a metric that reached its target loses its colour (grey), no tick, no praise; see `wkBars()`.
- **Adherence-neutral, no streaks (MF):** colour identifies *which*, never good/bad; wording observational ("nézd", not "figyelj!"); smoothed **trend as the headline**, raw points as texture (weight, sleep, HRV).
- **Weekly check-in as a guided conversation (MF):** short modules (why this now → what happened → proposal), each skippable; a dot marks when it is due.
- **Plate + actions ribbon + 24-hour timeline (MF, Fuel):** all entry methods one tap away (photo, search, quick add, voice/AI describe, recipes, usuals), a minified basket while searching, a time-based log (default: now; "ilyenkor szoktál" suggestions), not meal buckets — but **keep the app's existing meal slots** where they are part of the behaviour (eating-time control, `mezo-yhhvg`).
- **Three-field set row → auto rest (BWS, Edzés):** weight · reps · effort; the prescribed target in the row with last week beside it; rest timer starts on the third field; technique sheet with a fixed structure **Beállás · Végrehajtás · Gyakori hibák**; alternatives/swaps from the exercise.
- **Science as tap-through, not inline (BWS):** short lessons / a question to the team behind a row, never paragraphs on the working screen.
- **Progressive disclosure in three tiers (Oura/Whoop):** overview answers "what now?", a trends page "am I improving?", raw data only on demand.

## Verification before hand-back (mandatory)

1. `node -e "new Function(require('fs').readFileSync('csepp/<domain>.js','utf8'))"` parses.
2. Load every route in a real browser and check the console. If you have no browser tool, use
   Playwright from `frontend/` (it is installed): a small script that opens
   `http://127.0.0.1:8731/klinikai-iranyok.html?v=N#a-<domain>-<route>` for each route, in
   both themes and at 390px and 320px, screenshots to the scratchpad and fails on any console
   error. Fix until clean.
3. Report: the route list (all working), which live controls map where, which principles
   you applied, and anything you could not map (say it plainly).
