# Fuel · Múltbeli napra logolás — design spec

- **Dátum:** 2026-08-31
- **bd:** mezo-1j3z
- **Előzmény:** `2026-08-31-fuel-logolas-2.0-design.md` (mezo-byo1, PR #326) — a /fuel/log
  oldal, a WindowBlock + MealComposer és a FuelLogHeroTile ott születtek. Ez a slice a
  `docs/features/fuel.md` §9 deferred hiányát zárja: *„no meal-window log path exists for a
  past day — the /fuel/log doors all write `nowOffsetIso()`"*.
- **Vizuális forrás (jóváhagyott interaktív mockup):** `docs/design_2.0/prototypes/fuel-log-multinap.html`
  (a session WIP-jéből véglegesítve; hű másolat kötelező — design-2.0 fidelity szabály).

## 1. Mit épít

A `/fuel/log` oldal **nap-léptetőt** kap, és a teljes ablak-blokk + composer gépezet a
**választott napra** működik: múltbeli napon minden be nem logolt ablak „kimaradt · még
pótolható", a mentés a választott nap dátumával (`loggedAt` offset-hordozó ISO) íródik, és
ugyanúgy pontszámot kap. A hubon a Logolás hős-csempe alján egy csali-chip jelzi, ha
tegnapról maradt pótolható ablak.

**Backend-változás nincs.** A `MealRequest.loggedAt` már ma is tetszőleges időpontot elfogad
(`MealService.applyHeader`: `mealDate = loggedAt.toLocalDate()`), a `GET /api/fuel/day/{date}`
dátum-paraméteres, a scoring a mentéskor fut a meal saját napjára.

## 2. UX — a jóváhagyott mockup szerint

### Nap-léptető a /fuel/log hero-ban
- A hero tetején `‹  [nap-pirula]  ›` sor. A pirula **mindig a dátumot mutatja** (pl.
  „aug 30."), alatta kicsiben a nap neve („szerda"); a MAI napnál a kis sor „csütörtök · ma".
  **Nincs „Ma/Tegnap" fő-felirat** — user-döntés.
- `‹` egy napot lép vissza, **max 7 napot** (offset 0..7); `›` vissza a ma felé. A határon a
  gomb `disabled`.
- Nap-váltáskor a nyitott composer bezárul (state reset), a lista a tetejére áll.

### Pótlás-hangulat múltbeli napon
- Az oldal tone-ja `coral` → **`gold`** wash-re vált (MozaikPage tone), az eyebrow
  „Logolás" → **„Pótlás"** (gold szín).
- A hero számláló a **választott nap** kcal/target + kész-számlálóját mutatja.
- A számláló alatt őszinte jegyzet-sor: „Amit itt logolsz, erre a napra könyvelődik —
  pontszámot is kap." (borostyán pötty + szöveg; csak múltbeli napon).
- A fejléc jobb oldali stamp a dátumot mutatja (ma: a szokásos óra).

### Ablak-blokkok múltbeli napon
- Nincs MOST és nincs jövőbeli: a lane **múlt-normalizálást** kap — `now`/`future` állapotú
  tile → `missed` („KIMARADT · még pótolható", a meglévő szaggatott borostyán stílus),
  `done` marad done. Soha nem büntető hang.
- A Pótold ugyanúgy **helyben** nyitja a MealComposert (fixedSlot = az ablak slotKey-e,
  mezo-bnsf változatlan), a terv-recept előtöltéssel; ✨ AI ugyanúgy.
- A mentés-CTA felirata múltbeli napon: **„✓ Pótlás · aug 30."** (dátummal; ma a meglévő
  felirat marad).
- Ha a múltbeli nap MINDEN ablaka kész: a lista tetején kis zsálya „lezárt nap" kártya
  („Minden ablak kész ✓ · Ez a nap le van zárva — alul még pótolhatsz, ha valami
  kimaradt."), a blokkok csak nézegethetők (done-blokk eddig sem hordozott CTA-t).
- Az „Ablakon kívül" záró blokk múltbeli napon is él; meta-sora: „ami még kimaradt erről
  a napról".

### Hub-csali (FuelMaiPage / FuelLogHeroTile)
- Ha a TEGNAPI nap múlt-normalizált lane-jében van `missed` ablak, a Logolás hős-csempe
  alján borostyán chip: **„↺ aug 30. · 3 ablak pótolható"**. Koppintás → `/fuel/log?d=<tegnap>`
  (a csempe többi része továbbra is a mai napra nyit). 0 pótolhatónál a chip nem renderel.
- A chip a csempén belül külön gomb (stopPropagation), fókuszálható, aria-label-lel.

### Deep link
- `/fuel/log?d=YYYY-MM-DD` — a `d` query-param a kezdő napot adja; érvénytelen vagy a
  [ma−7 .. ma] ablakon kívüli érték → ma (csendes clamp, nem hiba).

## 3. Architektúra — pure VM-fegyelem megtartva

### Dátum-átfűzés (nincs új hook, nincs új endpoint)
- `FuelLogPage`: `offset` state (0..7) + `?d=` inicializálás; `date = addDays(localDateString(), -offset)`
  (`@/shared/lib/dates`). `useFuelDay(date)` + `useFuelTimeline(date)` — mindkettő már
  dátum-paraméteres. Mock módban a seed nap minden dátumra ugyanaz (a mock write a
  `['fuelDay', date]` cache-kulcsra ír, tehát a pótlás demóban is napra-helyesen viselkedik).
- **`asPastDayLane(vm: WindowLaneVM): WindowLaneVM`** — új pure helper a
  `fuelSwimlane.ts`-ben: tiles `now|future → missed`, `nowKey → null`, minden más mező
  változatlan. A `buildDayPlan`/`buildWindowLane` NEM változik (a state-forrás ott marad).
  A page múltbeli napon (`offset > 0`) ezen átfuttatva rendereli a lane-t.

### MealComposer — két új opcionális prop
```ts
/** Melyik napra könyvelődik a mentés (ISO local date). Absent = ma (nowOffsetIso, byte-azonos). */
logDate?: string
/** A loggedAt idő-komponense HH:mm (ablak-indítás: az ablak ideje). Absent = slot-alap idő. */
logTime?: string
/** A mentés-CTA felirata (múltbeli nap: „✓ Pótlás · aug 30."). Absent = a meglévő felirat. */
saveLabel?: string
```
- `logDate` jelenlétekor: `loggedAt = offsetIso(logDate, logTime ?? SLOT_DEFAULT_TIME[slot])`
  (a mezo-g8qm offset-hordozó helper), `useMealActions(logDate)` + `useFuelDay(logDate)`
  (a „nap eddig" összesítő-kontextus a választott napról szól). `SLOT_DEFAULT_TIME`:
  breakfast 08:00 · lunch 13:00 · dinner 19:00 · snack 16:00 (modul-konstans a composerben,
  a szabad blokk MIKOR-választásához).
- `logDate` nélkül minden hívóhely (LogFlowPage overlay-doorok!) **byte-azonosan** viselkedik.
- A FuelLogPage ablak-blokkja `logTime = tile.time`-ot ad át; a szabad blokk csak `logDate`-et.

### FuelLogHeroTile — csali-chip prop
```ts
/** Tegnapi pótolható ablakok csali-chipje; null = nincs chip. */
pastHint?: { dateLabel: string; count: number; onOpen: () => void } | null
```
- A FuelMaiPage számolja: `useFuelDay(yesterday)` + `useFuelTimeline(yesterday)` →
  `asPastDayLane` → missed count; `onOpen: () => navigate('/fuel/log?d=' + yesterday)`.
  (Egy plusz nap-kompozíció a hubon; real módban egy plusz `GET /api/fuel/day/{date}`.)

### Honest states
- Múltbeli üres nap (nincs ablak): a meglévő üres-nap ajtó jelenik meg, de a „＋ tervezz"
  CTA NEM visz a mai tervezőre múlt-kontextusban — helyette a meta mondja ki őszintén:
  „ezen a napon nem volt étkezési ablak", és csak az „Ablakon kívül" blokk aktív.
- Nincs kitalált 0: a hero a választott nap valós consumed-jét mutatja (real módban a
  `FUELDAY_EMPTY` üres nap = 0 kcal, ami múltbeli üres napra igaz állítás).

## 4. Stílus (prototype.css — a mockup CSS-e verbatim, mz-tokenekre fordítva)
- `.flog-daysw` (+ gombok, `.flog-dlbl`) — a mockup `.daysw` blokkja; token-színek
  (`--text-secondary`, `--surface-*`), NINCS hardcodeolt világos hex a tokenguard miatt.
- `.flog-pastnote` — borostyán pötty + jegyzet-sor.
- `.fh-lt-past` — a hub-csali chip (borostyán wash, `var(--gold)`-származék tokenek).
- `.flog-dayclosed` — a lezárt-nap kártya (zsálya).
- Reduced-motion: az új elemek nem hoznak új animációt (a meglévő rise/pulse guardok érintik
  őket); a tone-váltás sima background — a `.page` transition a MozaikPage-ben már guardolt.

## 5. Tesztek
- `fuelSwimlane.test.ts`: `asPastDayLane` — now/future→missed, done marad, nowKey null,
  üres lane identitás.
- `FuelLogPage.test.tsx` (bővítés): stepper léptet és clampel (0..7); múltbeli napon Pótlás
  eyebrow + jegyzet + minden nem-done blokk Pótold; mentés múltbeli napon → a `logMeal`
  inputja `loggedAt`-ja a választott nappal kezdődik és az ablak idejét hordozza; szabad
  blokk múltbeli napon slot-alap időt ír; `?d=` deep link + érvénytelen érték clamp;
  nap-váltás zárja a nyitott composert; lezárt múltbeli nap kártya.
- `FuelMaiPage.test.tsx` (bővítés): chip renderel tegnapi missed-del (szöveg: dátum + darab),
  navigál `?d=`-vel, 0 missednél nincs chip.
- `MealComposer` (a FuelLogPage teszteken keresztül + LogFlowPage regression: `logDate`
  nélkül `loggedAt` továbbra is a mai `nowOffsetIso` — meglévő tesztek zöldje bizonyítja).
- Mindkét mód: `VITE_USE_MOCK=true` ÉS `=false`.
- Vizuális: a mai /fuel/log golden változik (stepper sor) → darwin + linux re-baseline;
  `layout.spec.ts` invariánsok változatlanul zöldek kell legyenek.

## 6. Ami tudatosan NEM része
- Naptár-ugrás (7 napnál messzebb), múltbeli meal SZERKESZTÉSE/törlése ezen az oldalon,
  a Napló/Insights heti nézetek érintése, backend-változás, notification a pótolhatókról.

## 7. Prototípus-műtermék
- A jóváhagyott mockup bekerül a prototípus-családba: `src/fuel-log-multinap-head.html` +
  `src/fuel-log-multinap-body.html`, `build.sh` sor (`fuel-log-multinap.html`, 17 fájl),
  README-sor. A `.WIP.html` munkafájl törlődik.
