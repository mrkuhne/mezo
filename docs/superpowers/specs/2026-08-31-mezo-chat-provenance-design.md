# Mezo chat 2.0 — provenance rétegek + élő fejléc (mezo-vdf4)

**Dátum:** 2026-08-31 · **Prototípus (visual truth):**
[`docs/design_2.0/prototypes/mezo-chat.html`](../../design_2.0/prototypes/mezo-chat.html)
(artifact `ae02e856-1e3d-4c60-aad5-842e75190538`) · **Driving bd:** mezo-vdf4

## Probléma

A chat provenance-rétegei nyers pill-halmok: a tool-hívások 5 külön teljes szélességű
monospace pillként állnak a válasz felett (`get_weight_log(days=7)`), a Hivatkozott lábléc
wrappelő pill-felhő, az Emlékek kinyitva egy képernyőnyi szövegfal, a fejléc lapos kétsoros
(backbtn + két szürke chip + chsub). A Segített/Nem talált chipek a composerre lógnak, a
korall FAB rátakar a küldés korongra.

## Megoldás — a prototípus anatómiája

Minden vizuális részlet forrása a prototípus; ez a spec a viselkedési kontraktusokat és a
komponenshatárokat rögzíti. Ez **re-face + strukturálás**, nem rewrite: a meglévő adat- és
viselkedési kontraktusok (subtitle-precedencia, votable-only-persisted, Memory-ref dedupe,
blank-answer elnevezés, hidden-when-empty) változatlanok.

### 1 · Orb-vezette fejléc (ChatPage)

A `PageHead` + `mzc-chsub` kétsoros pár helyett egyetlen élő sor (ADR 0032 továbbra is áll:
ez az oldal SAJÁT fejléce, a shell AppHeader marad felette):

- **‹ vissza-korong** (32px, fehér, árnyék) → `/mezo`.
- **Lélegző orb** (`s-orb` ClaySpot, ~34px, `orbbreathe` 4,5s; reduced-motion-guarded).
  Streamelés közben (`turn` él) gyorsabb pulzus + halo-gyűrű.
- **Név + státuszsor**: `Mezo` (13px bold) alatt pont + szöveg. Precedencia változatlan:
  degraded → `a társ most nem elérhető` (borostyán pont) · új → `új beszélgetés` (lav) ·
  mode → `élő · Gemini` (zöld, pulzáló) / `demo beszélgetés` (szürke). Streamelés közben a
  szöveg `dolgozom rajta…`, a pont lav pulzáló.
- **Jobbra két ikonos korong**: ☰ Beszélgetések (sheet, mint ma), ＋ Új. 32px vizuál,
  44pt touch-target (padding/hit-area), aria-label, disabled-viselkedés változatlan
  (degraded ill. isNew).

### 2 · Munkacsík (új komponens: `ToolWorkStrip`)

A chatben a `ToolChipRow` helyére (a ToolChipRow maradó többi fogyasztója — fuel/train —
érintetlen). Két állapot:

- **Csukva (alap)**: pill — átlapolt domain clay-ikon korongok (max ~6, fölötte +n) +
  `UTÁNANÉZETT` eyebrow + `n forrás` + ⌄. Koppintásra nyílik.
- **Nyitva**: fehér panel, forrásonként egy sor: domain-wash ikonkocka + emberi név +
  nyers args subline (`days=7, scope=sleep` — honest, nem fordítjuk) + jobb szélen ✓.
- **Élő (streamelés)**: a `turn.tools` épülő listájával ugyanez a csík renderel, label
  `UTÁNANÉZ…`, az utolsó (futó) forrás ikonja pulzál, a panelban `● fut` státusszal.
  A csík streamelés közben is nyitható. A ThinkingDots a csík ALATT marad, amíg nincs draft
  (mezo-280 Finding 3 gating változatlan).

**Domain-térkép** (`toolDomains.ts`, insights/logic): tool-név → `{ label, icon, wash }`.
A 17 valós tool: get_weight_log/get_weight_trend → Súlynapló/Súlytrend (sky, i-suly) ·
get_recovery → Alvás & pihenés (lav, i-alvas) · get_fuel_log → Fuel napló (sage, i-fuel) ·
get_pantry → Kamra (sage, i-kamra) · get_recipes → Receptek (sage, i-recept) ·
get_training_log → Edzésnapló (coral, i-edzes) · get_training_plan → Edzésterv (coral,
i-meso) · get_exercise_records → Rekordok (coral, i-sport) · get_goal → Cél (gold, i-cel) ·
get_growth → Growth (gold, i-growth) · get_insights → Összefüggések (lav, i-minta) ·
get_medication → Gyógyszer (rose, i-injekcio) · get_protocol → Stack (sage, i-stack) ·
get_daily_practice → Napi gyakorlat (gold, i-nap) · find_similar_past_days → Emlékek (lav,
i-retegek) · compare_periods → Időszak-összevetés (lav, i-idozito). **Ismeretlen név →
nyers név, semleges wash, `i-mezo` ikon** — honest fallback, semmi kitalálás.

### 3 · Hivatkozások — domain-csoportok (ChatMessage)

A `visibleRefs` (a Memory-dedupe UTÁN, változatlan logika) kind szerint csoportosul:

- **> 3 ref összesen**: kind-onként egy wash-chip `ikon + magyar kind + ×n`; koppintásra
  az adott csoport teljes chipjei (kind + `chatRefDisplay` label) nyílnak ki alatta —
  egyszerre egy csoport nyitva. `aria-expanded`.
- **≤ 3 ref**: rögtön a teljes chipek, ikonnal + wash-sal (nincs csoportosítás).
- Kind → domain ugyanabból a térképből (kind-oldali kulcsokkal: Workout/PR → coral,
  Sleep/SleepLog → lav… GraphNode → lav i-minta, Memory → lav i-retegek); ismeretlen kind
  → semleges. Az eyebrow `Amire épült · L3` lesz (a prototípus szövege).

### 4 · Emlékek — vízszintes kártyasor (RecalledMemoriesRow)

- Csukva alapból, `✦ Emlékek · n` toggler (kontraktus változatlan, title-tooltip marad).
- Nyitva: oldalra görgethető lav kártyák (148px): típus-ikon (napi összefoglaló i-nap ·
  heti összefoglaló i-heti · korábbi beszélgetés i-mezo · check-in jegyzet i-checkin ·
  napló i-naplo · ismeretlen i-retegek) + label + dátum + hasonlóság-gyűrű (conic, % a
  közepén) + 4 sorra clampelt gist.
- Kártya-koppintás: a kártya kiszélesedik (~232px) és a clamp felenged. Gomb-szemantika,
  focus-visible.

### 5 · Feedback + composer + FAB

- **FeedbackChips**: csak CSS — kisebb (7,5→), halványabb, fehér-áttetsző alap; a chat
  oldali változat nem lóghat a composer alá. API/viselkedés változatlan.
- **Composer**: lav sheen gradient háttér, rec-állapot korall pulzus; minden viselkedés
  (autosize, Enter/Shift+Enter, IME, maxHeight, placeholder-precedencia) változatlan.
- **FAB**: a `/mezo/chat` útvonalon a QuickLogFab nem renderel (AppLayout: `hideFab =
  hideChrome || pathname === '/mezo/chat'`). A többi chrome (AppHeader, TabBar) marad.

## Komponenshatárok

| Egység | Változás |
|---|---|
| `ChatPage.tsx` | fejléc-csere (PageHead+chsub → új fejléc-blokk), élő munkacsík a turn-höz, FAB-gating nem itt |
| `ChatMessage.tsx` | ToolChipRow → ToolWorkStrip; reffoot → csoportosított render |
| `ToolWorkStrip.tsx` (új) | csík + panel + élő állapot; props: `tools: Tool[]`, `live?: boolean` |
| `toolDomains.ts` (új) | tool-név ÉS ref-kind → domain (label/icon/wash); egyetlen térkép |
| `RecalledMemoriesRow.tsx` | lista → kártyasor; disclosure-kontraktus marad |
| `AppLayout.tsx` | FAB elrejtése a chat útvonalon |
| `prototype.css` | mzc-* blokk bővítés/átírás a prototípus CSS-éből portolva (tokenizálva) |

## Tesztelés

- `ChatMessage.test.tsx`: csoportosítás (>3 → csoportchipek + kinyitás; ≤3 → teljes
  chipek), Memory-dedupe változatlanul, ismeretlen kind fallback.
- Új `ToolWorkStrip.test.tsx`: csukva/nyitva, élő állapot (utolsó fut), ismeretlen tool-név
  fallback, n forrás felirat.
- `RecalledMemoriesRow` tesztek: toggler kontraktus + kártya-expand.
- `ChatPage.test.tsx`: fejléc-státusz precedencia (degraded/new/mode/busy), gombok
  disabled-viselkedése — a meglévő tesztek igazítása az új DOM-hoz.
- AppLayout/navigation teszt: FAB nincs a `/mezo/chat`-on, máshol van.
- Gate-ek: frontend tesztek mindkét módban + build (VITE_USE_MOCK figyelem!).

## Nem cél

Conversation rename/delete UX, retry az error-bubble-ön (design-doc "still open", külön
kör), backend-változás (nincs), ToolChipRow többi fogyasztója.
