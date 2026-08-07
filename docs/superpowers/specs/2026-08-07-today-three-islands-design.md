# Today „Három sziget” redesign — design spec

- **Dátum:** 2026-08-07
- **Driving bd:** `mezo-euze`
- **Előzmény:** a daypart-faces kompozíció ([`2026-07-29-today-daypart-redesign-design.md`](2026-07-29-today-daypart-redesign-design.md), [ADR 0014](../../decisions/0014-today-daypart-faces.md)) és a DS-migráció P4 Today-restyle-ja (`mezo-setx.5.1`). Ez a spec a **render-réteget** tervezi újra; a mögötte lévő nap-modell (`dayFace.ts`) és normalizáló (`todayItems.ts`) **változatlanul megmarad**.
- **Mockupok (a validált irány):** [`assets/2026-08-07-today-three-islands-mockup.html`](assets/2026-08-07-today-three-islands-mockup.html) (v3 — interaktív prototípus: szigetváltás, esti fázisok, horgony-összeolvadás); a három induló irányvariáció: [`assets/2026-08-07-today-redesign-directions-mockup.html`](assets/2026-08-07-today-redesign-directions-mockup.html). A brainstorm-iteráció (v1→v3) a felhasználóval böngészős mockupokon zajlott; a v3 minden döntést tükröz.

## 1. Cél

A mai Today három „arca” jó tagolás, de az arcokon belül a tartalom **egyenrangú kártyahalom** — sok CTA, kevés vezetés, nulla DS-Hero. Az új képernyő:

1. **szigorúan a Mezo-edition DS-en ül** — halo-gradiens **Hero** (eyebrow nélkül, lásd §3), Geist 200 hős-szám, StatStrip-idióma, ListItem/ItemRow nyelv, DS ramp-ok;
2. **rétegekben bontja ki az információt** — L0 színpad (hero + 1–2 tény + 1 CTA), L1 lista, L2 sheetek; a főfelületen soha nincs kint minden;
3. **él** — organikus, lassan morfolódó halo-szigetek, lebegő kapszulák, folyamatos buborék-morf váltás, esti lavendula-hűlés;
4. **megtartja** a Reggel · Nap · Este tagolást, az act-anywhere elvet és a teljes meglévő adat/sheet-réteget.

## 2. A modell — tér-szabályok

A `/today` tartalma három **sziget** egy nem görgethető égen (`.sky`), az `AppHero` (változatlan) és a tab-bar között.

- **Mindig pontosan egy nagy sziget van**; a másik kettő kapszula. Kiválasztás koppintással vagy `?dp=`-vel.
- **A sorrend mindig kronologikus** (Reggel → Nap → Este); a nagy sziget a saját idősávjában nő meg — a tér stabil, elem nem ugrik át másik pozícióba.
- **L0 nem görgethető.** Görgetés csak a kinyitott L1 listán belül van (a lista saját belső scrollja).
- **„Hol tartok” ≠ „mit nézek”:** a kronologikusan aktuális sziget kapszulaként arany `MOST` tagot + arany gyűrűt visel akkor is, ha másik sziget van kinagyítva (a mai `DayFaceStrip` `.now`/`.sel` kettős jelzésének öröklése).
- **Act-anywhere változatlan:** minden akció működik kiválasztott (nem aktuális) szigeten is; visszamenőleges pipa este, korai esti log délután.
- **Alapállapot:** app-nyitáskor a `dayFace(new Date(), sleepGoal)` szerinti sziget a nagy; `?dp=reggel|nap|este` felülírja (URL-derivált, state-be sosem tükrözve — a mai szabály él tovább; ismeretlen/üres érték = aktuális sziget; a param törlődik, ha a kiválasztott == aktuális).

## 3. A nagy sziget anatómiája (L0)

Felülről lefelé — **nincs köszöntés, nincs státusz-eyebrow, nincs coach-sor** (user-döntés, v3): a sziget identitását a pozíció + a blob-szín + a hero hordozza.

1. **Hős-szám** — DS Hero számjegy: 52/Geist 200/−0.04em, unit 19/300.
2. **Subtitle** — 12/500, maga is adat (cél-távolság, ablak-idők), nem hangulat-szöveg.
3. **Tény-sáv** — 2 cella a DS StatStrip idiómán, **delta-sorral bővítve**: érték (19/700) + eyebrow-label (8.5/700/0.18em) + delta (10/600, success/warning/muted tónus). A tények **kontextualizált adatok** (trend, delta, cél-táv, előrejelzés), sosem nyers számok.
4. *(opcionális)* **1 figyelmeztető chip** — csak biztonsági-jellegű infó (pl. váll-niggle) kaphat helyet; minden más L1-be megy.
5. **Akció-sor** — **egyetlen** gradient-CTA (a napszak promotált akciója) + a **„még N ›”** ghost-fogantyú (L1-nyitó).
6. **Csendes kész-sor** — `✓ N kész ma · +XP` (szintén L1-nyitó, a done-csoporthoz).

### Szigetenként (a v3-ban validált tartalom)

| Sziget | Hős-szám | Subtitle | Tény-cellák | Promotált CTA |
|---|---|---|---|---|
| 🌅 Reggel | alvás-óra (`7,2 óra alvás`) | cél-távolság + heti alvás-adósság | Súly (heti trend ↘ + cél-táv) · HRV (± az átlagodhoz) | a reggeli lánc első nyitott lépése |
| ☀️ Nap | edzés-időpont (`13:00 · Pull A · 55′`) | mezó-hét + deload-táv | Edzés a héten (n/N + heti tonna) · Fehérje ma (g + cél-táv + napszak-kontextus) | `Indítsuk` → `/train` (pihenőnap: `Saját edzés` → CustomWorkoutSheet) |
| 🌙 Este | **villanyoltásig hátralévő idő** (`1:45`, percenként frissül) | napzárás-ablak + villanyoltás | Nap mérlege (+XP · n/N tétel · heti rang) · Alvás-kilátás („ha 22:30-kor fekszel → 7,9 óra”) | `Zárjuk le a napot` → `/ritual` (lavendula CTA) |

**Tény-katalógus** (cserealap, szigetenként válogatható): reggel — pihenőpulzus, 🔥 sorozat, reggeli fehérje-cél; nap — kcal-egyenleg, lépés/aktivitás, tegnapi e1RM-csúcs, vízcél-állás; este — energia-átlag a check-inekből, képernyő-idő, holnapi első esemény.

### A kapszula anatómiája

Emoji + napszak-név (13/700) + **egysoros esszencia** (11/muted: a következő tétel vagy horgony-időpont) + jobbra `N ›` számláló (kész napszakon `✓ kész`, üresen `—`). A kronologikusan aktuális kapszulán `MOST` tag + arany gyűrű.

## 4. Rétegek

| Réteg | Mi él ott | Hogyan nyílik |
|---|---|---|
| **L0 · színpad** | 3 sziget; a nagyon: hero + 2 tény + 1 CTA + fogantyúk | — |
| **L1 · lista** | a sziget **teljes** tétel-listája a meglévő ItemRow-nyelven, kis-kapitális csoportfejlécekkel (rutin / check-in / küldetések / fuel / edzés / napzárás / **fókusz**) + a done-tételek (este: „Ahogy a nap telt” + `Ma összesen +N XP`) | „még N ›” vagy a `✓ kész`-sor; a hero-tartalom átadja a helyét, a sorok 50 ms lépcsővel érkeznek; belül görgethető; `összecsuk ↑` zár |
| **L2 · sheet** | CheckInSheet, ActivityLogSheet, LogMealSheet, SleepLogSheet, IntentionSheet, ReflectSheet, CustomWorkoutSheet, CreedSheet — **mind változatlan** | egy L1-sor (vagy a promotált CTA) akciójából |

- **Creed / Mai fókusz:** az L1 „Fókusz” csoportja (reggel és este) — a creed-szöveg sor (CreedSheet-nyitó) + `+ Fókusz` akció + este a reflexió-kérdés (`Igen / Részben / Nem`). L0-n nem foglal helyet.
- **Briefing:** a generált reggeli briefing a **reggeli L1 tetején** él **CoachBubble**-ként (lead a Geist 200 coach-hangon, `bővebben` → teljes szöveg + refs + „Demo tartalom”/konfidencia — a mai BriefingCard viselkedés a bubble-ben). A companion déli/esti jegyzete ugyanígy a Nap/Este L1 tetején. L0-ra próza nem kerül.
- A `TodoCard` fejléc-linkje örökül: az L1 „Napi küldetések” csoportfejléce jobbra `{d}/{t} · +XP ›` → `/me/growth`.
- **Row-akciók változatlanok:** `questAction`/`habitAction` mapping, `servableAction`-elv, quest-pill saját címkéje, fuel in-place log, `habitPending`-visszavonás, dedup-szabályok — a `todayItems.ts` és a `TodayPage.act()` érintetlen marad.

## 5. Az esti sziget négy fázisa

Egy sziget, egy hero-hely — a tartalma a meglévő `windDown.ts` fázisai szerint **puha kereszt-úszással** cserélődik (a hős-szám mindig a countdown):

| Fázis | Ablak | Eltérés a normáltól |
|---|---|---|
| 🌙 normál | este eleje (`phase === 'none'`, de a face már `este`) | a §3 táblázat szerinti tartalom |
| 🌘 ráhangolódás (dim) | `[bed−90, bed−60)` | tény-cellák cserélődnek: REM-hűvösben (+18%) · Alvás-kilátás; subtitle: fény &lt;30 lux · szoba ~18 °C |
| 🌒 leállás (winddown) | `[bed−60, bed)` | a CTA mellé belép a **„Leállás megvolt ✓”** ghost-pipa (a `wind_down` MANUAL habit — ugyanaz a `['habitDay', date]` cache, mint az L1-sor; amíg a fázis él, az L1-ből a sor kiszűrve, a mai `OWNED_BY_RITUAL_HERO`-szabály mintájára) |
| 🌑 éjszaka (night) | `[bed, wake−30)` | **a sziget maga elsötétül** (dark-violet felület, világos szöveg); tartalma: countdown-hero („22:30 elmúlt”) + egyetlen `Éjszakai mód megnyitása ›` sor → `/me/sleep/night`; tény-cellák nincsenek |

A `WindDownBanner` és a `RitualCard` mint önálló kártyák **megszűnnek** — a viselkedésük (fázis-logika, ritual-ablak háromállapota) a sziget fázisaiba és a Napzárás L1-sorába olvad. A `ritualWindowState` + `?ritual=` override él tovább (a `MÉG VÁR`/nyitva/kész állapot a CTA-t és a Napzárás-sort vezérli).

## 6. Rossz nap — összeolvadás (AnchorMode)

`?day=rough` esetén nem külön képernyő: a kapszulák behúzódnak és a három sziget **egyetlen meleg, rózsás horgony-szigetté olvad össze** (flex-collapse + opacity, ~600 ms). Tartalma az AnchorMode öröksége: 🫧 horgony-eyebrow, meleg egysoros üzenet (ez az egy hely, ahol marad megszólító mondat — ez a mód lényege), `3 apró horgony` hero, 3 gyengéd sor (`Megvolt ✓`), és a `Kilépés` ghost, ami visszaolvasztja a szigeteket. Számláló, XP, elvárás nincs. Az `AnchorModeView` teljes-képernyős csere és a hozzá tartozó korai return **megszűnik**; a szinkron `?day=` derivációs szabály (skeleton előtt ellenőrizve) átöröklődik az olvadás-állapotra.

## 7. Mozgás-nyelv

- **Buborék-morf (szigetváltás):** a héj **végig ugyanaz a buborék** — kapszula 29 px → sziget 34 px rádiusz; a magasság (flex-grow/basis) és a rádiusz **ugyanazon** az ~550 ms-os, enyhén rugós görbén (`cubic-bezier(.3,.9,.35,1)`) megy. A kapszula-sor abszolút rétegként ül a héjon és gyorsan kiúszik (150 ms); a nagy tartalom ~140 ms késéssel úszik be — nincs üres pillanat, nincs „ovális megtorpanás” (v2-ben validált javítás).
- **Blob-morf:** a nagy sziget halo-blobja 9 s-os ciklusban morfol (border-radius keyframes + 1.05 scale), `blur(2px)`, sosem vibrál.
- **Lebegés:** kapszulák ±4 px, 5.4 s, eltolt fázisokkal.
- **L1 kibomlás:** a hero-elemek eltűnnek, a sorok 50 ms lépcsővel, 6 px-es emelkedéssel érkeznek; `összecsuk` visszaad.
- **Esti fázis-csere:** 450 ms fade + 12 px emelkedés.
- **Pipálás:** a sor zölden nyugtázódik és kiúszik; számlálók (kapszula `N ›`, AppHero ⚡) frissülnek; lánc-teljesítés ünneplő toastja és a `useLevelUp` overlay változatlan.
- **prefers-reduced-motion:** morfolás, lebegés, lépcsőzés kikapcsol; a váltások áttűnésre szelídülnek. Strukturális garancia a mai mintára: minden motion-szabály `:where()`-be csomagolt modifier-szelektoron.

## 8. Színvilág

- **Reggel:** amber halo-blob (`--halo-amber` család), arany MOST-gyűrű.
- **Nap:** korall-amber blob; CTA a `--gradient-cta` (coral UI-ban mindig primary — D4).
- **Este:** a képernyő-háttér lavendulába hűl (`#F3EFF7` → surface-page gradiens), a blob violet, az esti CTA **lavendula-gradiens** — az egyetlen nem-korall CTA, átvezetés a windDown/dark témához. Night-fázisban a sziget dark-violet, a környezet változatlan.
- **Horgony:** rózsás-meleg blob és felület.
- Minden érték DS-token vagy abból képzett `color-mix`; hardcode csak a mockupban.

## 9. Komponens-terv

**Változatlan (újrafelhasznált):** `dayFace.ts`, `todayItems.ts` (+ dedup/`isFillableSlot`), `questAction`/`habitAction`, `windDown.ts` + `useWindDownPhase`, `ritualWindowState`, minden data-hook és sheet, `AppHero` (+ utilities ✨), `useChainCelebration`/`ChainCelebrations`, `useLevelUp`, scenario-paramok (`?dp= ?day= ?niggle= ?vulnerable= ?retaDay= ?ritual=`).

**Új / átalakuló (`features/today/`):**
- `components/IslandSky.tsx` — az ég: elrendezés, kiválasztás, anchor-olvadás állapot.
- `components/Island.tsx` — a héj (kapszula↔nagy morf, blob, MOST-gyűrű) + `IslandCapsule` tartalom.
- `components/IslandMorning|Day|Evening.tsx` — a három bigview (hero + tények + CTA); `IslandEvening` a négy fázissal.
- `components/IslandList.tsx` — az L1 (csoportosított ItemRow-k + CoachBubble-fej + done-csoport) — a mai `TodoCard`+`DoneFold` renderlogika utódja.
- `components/AnchorIsland.tsx` — a horgony-sziget (az `AnchorModeView` tartalmi utódja).
- `logic/islandFacts.ts` — **pure** tény-deriváció (trend/delta/cél-táv/kilátás számítások hook-kimenetekből; §10).

**Visszavonul:** `DayFaceStrip`, `GreetingHeader`, `FaceMorning/FaceDay/FaceEvening`, `FaceHeroCard`, `BriefingCard` (CoachBubble-fejjé alakul), `TodoCard`/`DoneFold` (IslandList-be olvad), `WindDownBanner`, `RitualCard` (fázisokba/L1-be olvad), `AnchorModeView` (AnchorIsland). A `VulnerabilityCard` a fix chrome-ban marad (AppHero alatt, az ég felett). `TodaySkeleton` az új layoutra igazodik (AppHero-azonosság-szabály marad).

**CSS:** új Today-scoped család a `prototype.css`-ben (`.sky` `.isl` `.capview` `.bigview` `.strip3`-delta `.l1` `.anchorisl` + keyframes), a retirált családok (`.dfs*`, `.greet*`, `.brief*`, `.fhc*`, `.tdc*`, `.wdb*`, ritual-maradványok) törlésével.

## 10. Tények — adatforrás és őszinte állapotok

`logic/islandFacts.ts` pure függvényei hook-kimenetekből dolgoznak; **minden cellának definiált üres-állapota van** (strip-filozófia: nincs forrás → nincs cella, nem `—`-hamisítás; 1 cella is lehet, 0 cellánál a sáv ghostol):

| Tény | Forrás (meglévő) | Real-mode megjegyzés |
|---|---|---|
| alvás-óra + adósság | `useSleep` log + `useSleepGoal` | adósság = 7 napos cél-eltérés összege |
| súly + heti trend + cél-táv | `useWeight` + goal | trend = 7 napos delta |
| HRV vs átlag | — | **mock-only** (nincs real forrás — a cella real módban nem renderel, a mai QuickStats-döntés öröklése) |
| heti edzés n/N + tonna | `useTrain` hét + `weeklyLoad` logika | |
| fehérje ma / cél | fuel timeline/log összegzés | ha nincs mai log: cél-cella logolás-CTA-subtitle-lel |
| nap mérlege (XP, n/N, heti rang) | `growthTodaySummary` + activities | heti rang: az utolsó 7 nap XP-jéből, pure |
| alvás-kilátás | pure: villanyoltás-cél vs wake-cél | |
| countdown | pure: `now` vs `bedTime`, percenkénti tick (a `WindDownBanner` 30 s tick-mintája) | |

## 11. A11y

- Az ég `role="tablist"`-analógiát **nem** visel (nem tab-idióma többé): a kapszulák `button`-ök teljes magyar `aria-label`-lel („Este · 2 nyitott tétel · megnyitás”), a nagy sziget `aria-current="true"`-t hordoz; a MOST-állapot az aria-labelben („most van”).
- A szigetváltás fókuszt ad a nagy sziget elejére; az L1 nyitás a lista első sorára; `Escape`/`összecsuk` visszaadja a fogantyúnak.
- Emoji dekoratív (`aria-hidden`), a számláló-jelentés szövegesen a labelben — a mai `DayFaceStrip` aria-mintájának öröklése.
- Kontraszt: minden szöveg-token AA (a night-fázis világos-szöveg párjait ellenőrizni).

## 12. Tesztelés

- **Pure logika:** `islandFacts` táblás tesztek (trend/adósság/kilátás/rang, üres-forrás ágak); a meglévő `dayFace`/`todayItems`/`windDown` tesztek változatlanul zöldek maradnak (nem nyúlunk hozzájuk).
- **Komponens:** szigetváltás URL-deriváció (a mai `?dp=` tesztek átcímzése), L1 nyit/zár + csoport-sorrend, esti fázis-render (`useWindDownPhase` mockolt órával), horgony-olvadás (`?day=rough`), skeleton AppHero-azonosság, reduced-motion.
- **Mindkét mód:** mock (determinisztikus seed) + real (MSW-s hookok) — a gate: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- **Vizuális goldenek:** a `today-*` baseline-ok újragenerálása (linux is), új state-ek: 3 sziget × zárva/nyitva, 4 esti fázis, horgony.

## 13. Scope-on kívül

- Backend/API-változás **nincs** (frontend-only re-kompozíció, a Slice T mintájára).
- Új adatforrás (HRV, képernyő-idő, lépés) nem épül — a katalógus jelöltjei akkor kapnak cellát, amikor a forrásuk létezik.
- A Train/Fuel/Me/Insights felületek nem változnak; a `docs/features/today.md` + `_platform-design-system.md` frissítése az implementációs feladat része, ADR készül a kompozíció-váltásról (ADR 0014 utódja).
