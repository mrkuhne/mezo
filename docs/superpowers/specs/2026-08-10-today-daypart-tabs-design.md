# Today „Napszak-tabok” redesign — design spec

- **Dátum:** 2026-08-10
- **Driving bd:** `mezo-puci`
- **Előzmény:** a három-sziget kompozíció ([`2026-08-07-today-three-islands-design.md`](2026-08-07-today-three-islands-design.md), [ADR 0022](../../decisions/0022-today-three-islands.md)). Ez a spec **ugyanazt a render-réteget** tervezi újra harmadszor; a mögötte lévő nap-modell (`dayFace.ts`), normalizáló (`todayItems.ts`), tény-derivációk (`islandFacts.ts`), akció-táblák (`habitAction`/`questAction`) és a teljes sheet-réteg **változatlanul megmaradnak**.
- **Mockup (a validált irány):** [`assets/2026-08-10-today-daypart-tabs-mockup.html`](assets/2026-08-10-today-daypart-tabs-mockup.html) — a valódi `prototype.css`-t és `fonts.css`-t betöltő, valódi osztályokra épülő statikus mockup, benne a működő tabváltóval. Böngészőben a repo gyökeréből kiszolgálva pontos (a `/fonts/` abszolút útvonalak miatt csak fájlból megnyitva esik vissza rendszerfontra).

## 1. Cél

A három-sziget kompozíció a **rejtésre** optimalizált: egyszerre pontosan egy sziget nagy, a másik kettő kapszula, és a nagy szigeten belül is csak hero + 1–2 tény + 1 CTA látszik — a briefing, a habitek és minden teendő egy réteggel lejjebb, az L1 lista mögött ül. A használatban ez azt jelenti, hogy a napi rutinhoz **két interakció** (sziget kiválaszt → `még N ›` nyit) kell, mielőtt bármit tenni lehetne, és a companion üzenete alapból egyáltalán nem látszik.

Az új képernyő ezt fordítja meg:

1. **Semmi nincs elrejtve.** A kiválasztott napszak teljes tartalma — hero, tények, minden csoport minden sora — egyetlen felületen, kinyitás nélkül látszik. Az egyetlen összecsukott elem a már **kész** tételek hajtása.
2. **A mezo üzenete állandó.** Full-bleed sávban, avatar nélkül, **sosem csonkolva**, közvetlenül a chrome alatt — bármelyik napszakot nézed.
3. **A Reggel · Nap · Este tagolás megmarad**, de nem térbeli (nem három sziget, nem három egymás alatti szekció): egy **szegmentált tabváltó** cserél közöttük, így egyszerre mindig pontosan egy napszak van a képen.
4. **Kevesebb doboz.** A napszak tartalmának nincs külső kártyakerete: a hero, a csoportfejlécek és a CTA-k közvetlenül a vásznon ülnek. Doboz csak ott van, ahol tartalmat kell elkülöníteni (ténystrip, `ItemRow`, warn-chip, creed-chip, reflexió).

Ami **nem** cél: új adatforrás, backend- vagy API-változás, a nap-modell vagy az act-anywhere elv megbontása.

## 2. A képernyő anatómiája

Fentről lefelé, a `.screen-content` normál görgetésében (a nem-görgethető ég szabálya megszűnik):

```
AppHero                       (változatlan chrome; Today a ✨ Insights linket adja utilities-ként)
VulnerabilityCard?            (változatlan, ?vulnerable=on)
DaypartTabs                   ÚJ — .segtabs: 🌅 Reggel | ☀️ Nap | 🌙 Este, a MOST arany pöttyével
MezoMessage                   ÚJ forma — full-bleed CoachBubble sáv, avatar nélkül, teljes szöveggel
DayView(selected)             ÚJ — a kiválasztott napszak TELJES tartalma, külső kártyakeret nélkül
  ├─ hero (szám + egység + alsor)
  ├─ IslandFactsStrip         (változatlan komponens)
  ├─ warn-chip?               (nap: niggle)
  ├─ CTA-sor?                 (nap: Indítsuk / Saját edzés · este: Napzárás)
  ├─ companion-jegyzet?       (nap/este — a napszak saját coach-hangja, a lista fölött)
  ├─ csoportok               (Étkezés / Napi küldetések / Reggeli rutin / Fókusz / Esti rutin / Reflexió)
  │    └─ ItemRow-k           (változatlan komponens, változatlan act() útvonalak)
  └─ kész-hajtás              az EGYETLEN összecsukott elem: „✓ N kész · +M XP ▾”
mai-logrow                    (változatlan Fuel belépő)
TabBar                        (változatlan chrome)
```

A görgetés a lap sajátja (`.screen-content`), nincs beágyazott scroller. A `.screen-content:has(.sky-islands)` flex-flip **megszűnik** a Today-on (a Fuel `.sky-flow` használata érintetlen).

## 3. A napszak-váltó

**A házi `.segtabs` / `.segtab` kontroll** (a Sport és a Futás oldal precedense, `prototype.css` §segtabs) — nem épül új váltó-nyelv. Három szegmens, `aria-pressed`, a kiválasztott a primary rampot beszéli.

- **A MOST jelzése** egy kicsi arany pötty (`--accent-base` + halo) a **kronológiailag aktuális** napszak szegmensében, **függetlenül attól, melyik van kiválasztva** — a `DayFaceStrip` dual-signal öröksége: „hol tartok” és „mit nézek” nem mosódhat össze.
- **Belépéskor** az aktuális napszak tabja aktív (`dayFace(now, sleepGoal)`).
- **`?dp=reggel|nap|este`** marad a kiválasztás egyetlen forrása: URL-ből derivált, sosem tükrözve state-be; `null` / `''` / ismeretlen érték → az óra napszaka; az aktuálisra váltás **törli** a paramot; írás `{ replace: true }`. Ez a `TodayPage` mai `selected`/`selectFace` logikája, változatlanul.
- **Tabváltáskor** a lap a tetejére ugrik (a régi „face switch closes L1” szabály helyére lép), és a kész-hajtás alapállapotba (összecsukva) kerül.

## 4. A mezo üzenete

A mai `BriefingCard` → `CoachBubble` kompozíció **marad**, három módosítással:

| | Ma (L1-ben) | Új (a sávban) |
|---|---|---|
| Elhelyezés | a kiválasztott sziget L1 listájának feje | fix sáv a tabok alatt, minden napszakon ugyanaz |
| Keret | `margin: 0 24px 16px`, 2px coral bal szegély, lekerekített | **full-bleed**: `margin: 0`, nincs bal szegély, nincs rádiusz, alul hajszálvonal |
| Avatar | 32px coral karika | **nincs** — az eyebrow hordozza az identitást |
| Szöveg | 3 sorra csonkolva + `bővebben` | **teljes**: vezető bekezdés Geist 200-on, a többi törzsszövegben, alatta a `Hivatkozott` chipek |

**A sáv tartalma mindig a napi briefing** (felhasználói döntés), tabtól függetlenül. A Nap és az Este companion-jegyzete nem tűnik el: a saját tabján belül, a lista fölött jelenik meg — így két coach-hang sosem verseng ugyanazon a soron.

Real módban a briefing prózája demó tartalom → az őszinte `Demo tartalom` címke marad; a `confidence` % viselkedése változatlan. A `bővebben`/`összecsuk` kapcsoló **megszűnik** (nincs mit kinyitni).

## 5. A napszak-nézet (`DayView`)

**Nincs külső kártya.** Se keret, se `surface-1` háttér, se árnyék, se halo-blob — a tartalom a vásznon ül, ahogy az üzenetsáv is. Ez a felhasználó explicit döntése („a fő dobozt vegyük ki, azon belül lehetnek kisebbek”).

**Hero** — a napszak egyetlen nagy száma, balra igazítva (nem középre, mint a szigetben), Geist 200, ~30px, alatta egy halk alsor. Forrás változatlanul az `islandFacts.ts`:

| Napszak | Hero | Alsor | CTA |
|---|---|---|---|
| 🌅 Reggel | `morningHero` — az éjszakai alvás órái (`fallbackHero`, ha nincs éjszaka) | cél-eltérés + heti adósság | **nincs** — a lánc első lépése amúgy is ott a listában (a promotált CTA duplikáció volt) |
| ☀️ Nap | a session indulása + címe (`13:00 · Pull A`), pihenőnapon `Pihenő` | hossz · mezó-hét · gyakorlatszám | `Indítsuk` → `/train`, ill. `Logold` (sport) · pihenőnapon `Saját edzés` |
| 🌙 Este | élő visszaszámlálás a villanyoltásig (`bedCountdown`) | napzárás-ablak + lámpaoltás | `Napzárás` (lavendula — az app egyetlen nem-coral CTA-ja) |

**Ténystrip** — az `IslandFactsStrip` komponens változatlanul (súly/HRV · fehérje/energia · napi mérleg/alvás-kilátás). A „nincs forrás → nincs cella” szabály érintetlen.

**Csoportok és sorok** — a mai `IslandList` csoportosítási logikája (első-megjelenés sorrend, `isl-grouph` fejléc darabszámmal, a küldetés-fejléc `/me/growth` linkje) változatlan, de **nincs `összecsuk` gomb** és nincs belső scroller.

**Kész-hajtás** — a `done` tételek egyetlen halk sor mögött (`✓ N kész · +M XP ▾`), kattintásra lenyílik ugyanabban a nyelvben (`ItemRow done`), az este a végén hozza a `Ma összesen +N XP` sort.

**Az esti négy fázis** (`useWindDownPhase`) **változatlanul él**, csak a hero/CTA-sávban játszódik nagy hero-blokk helyett:

| Fázis | Mi változik a nézetben |
|---|---|
| 🌙 normál | countdown-hero + tények + lavendula CTA |
| 🌘 ráhangolódás | a tények a REM/hűvös-szoba evidenciára váltanak, alsor: fény &lt;30 lux · ~18 °C |
| 🌒 leállás | a CTA-sor mellé belép a `Leállás megvolt ✓` ghost; a `wind_down` sor **csak ekkor** hiányzik a listából (offered-exactly-once szabály, változatlanul) |
| 🌑 éjszaka | a **nézet** sötétedik (nem a kártya — nincs kártya): a `DayView` `data-night` állapota adja a theme-invariáns sötét szövegpárokat; countdown `elmúlt`; egyetlen `Éjszakai mód megnyitása ›` sor; nincs tény, nincs CTA |

A ritual-birtokolt sorok (`ritual:day`, `habit:evening_ritual`) továbbra is ki vannak szűrve az esti listából — a CTA birtokolja azt az aktust.

## 6. Rossz nap — horgony-mód

`?day=rough` **változatlan szemantika**, változatlan guard-sorrend (`anchorMode` mindenki előtt, szinkron az URL-ből, skeleton-villanás nélkül). Az `AnchorIsland` tartalma marad; az „ég összeolvadása” animáció helyére egyszerű csere lép, mert nincs többé ég: a tabok és az üzenetsáv elrejtve, a horgony-tartalom tölti ki a lapot.

## 7. Mozgás-nyelv

A buborék-morf (`isl-morph`), a lebegés (`isl-floaty`) és az L1 stagger-létra (`isl-rowin`) **kikerül a Today-ból** — nincs kapszula, nincs kinyíló réteg. Ami marad:

- tabváltáskor a `DayView` finom keresztfade + 8px felúszás (az `isl-phasein` mintája, újrahasznált keyframe),
- az esti fázisváltás keresztfade-je változatlanul,
- a kész-hajtás magasság-animációja.

**A cascade-guard szabály él tovább:** minden új animáció-módosító `:where()`-be csomagolva, hogy a reduce-blokk source-order tie-breakerrel nyerjen — a `todayReducedMotion.test.ts` strukturálisan ellenőrzi, és az új `.dv*` családra át kell címezni.

## 8. Színvilág

Változatlan Napív rampok. A napszak identitását eddig a sziget blob-tintje hordozta; blob nélkül a jelölés a **tab** (emoji + kiválasztott állapot primary tintje) és a **circadián vászon** (`[data-day]`, app-szintű) marad. Ez elfogadott veszteség: a napszakok színkódját a chrome hordozza, nem a tartalom.

## 9. Komponens-terv

**Változatlan (újrafelhasznált):** `dayFace.ts`, `todayItems.ts` (+ dedup / `isFillableSlot`), `islandFacts.ts`, `questAction`/`habitAction`, `windDown.ts` + `useWindDownPhase`, `growthToday.ts`, `useChainCelebration`/`ChainCelebrations`, minden data-hook, mind a hét sheet, `AppHero`, `VulnerabilityCard`, `IntentionBanner`, `CompanionNoteCard`, `IslandFactsStrip`, `ItemRow`, `CoachBubble`, `AnchorIsland`, `useLevelUp`, a scenario-paramok.

**Új / átalakuló (`features/today/`):**
- `components/DaypartTabs.tsx` — a `.segtabs` váltó + MOST-pötty; propokból dolgozik (`selected`, `current`, `onSelect`), domain-mentes a nap-modellen túl.
- `components/MezoMessage.tsx` — a full-bleed sáv (a `BriefingCard` utódja: ugyanaz a `CoachBubble`, avatar nélkül, `cb-band` modifierrel, csonkolás nélkül).
- `components/DayView.tsx` — a közös váz: hero-slot, ténystrip, CTA-sor, jegyzet-slot, csoportok, kész-hajtás. A három napszak ennek a konfigurációja.
- `components/ViewMorning|ViewDay|ViewEvening.tsx` — a mai `IslandMorning`/`IslandDay`/`IslandEvening` tartalmi utódai, ugyanabban a névmintában (`ViewEvening` viszi tovább a négy fázist és a saját ritual/habit wiring-et).
- `components/DayGroups.tsx` — az `IslandList` csoportosító logikája `összecsuk` és belső scroller nélkül + a kész-hajtás.

**Visszavonul (Today-oldalról):** `IslandSky`, `IslandMorning`, `IslandDay`, `IslandEvening`, `IslandList`, `BriefingCard`. **A `shared/ui/Island.tsx` MARAD** — a Fuel „Mai” ablak-folyója a második fogyasztója (`mezo-jgh9`); csak a Today hagyja ott.

**`TodaySkeleton`** az új layoutra igazodik (tab-sor + sáv + egy nézet vázlata); az `.apphero` **azonos DOM-node** szabály minden ágban él tovább.

**CSS:** új Today-scoped `.daytabs` / `.dayview` / `.dv-*` család + a `.coach-bubble.cb-band` modifier.

- **Megmarad, mert az új nézet is használja:** `.isl-facts`/`.isl-fact*` (az `IslandFactsStrip`), `.isl-grouph*` (a csoportfejlécek), `.isl-cta` (+ `is-lav`), `.isl-more` (a `mai-logrow` és a másodlagos CTA-k), `.isl-warnchip`.
- **Retirálandó, ha és amint az egyenkénti ellenőrzés kimondja, hogy a Fuel nem használja:** `.sky-islands`, `.screen-content:has(.sky-islands)`, `.isl-l1*`, `.isl-doneline`, `.isl-openhead`, `.isl-bigview`, `.isl-hero-*`, `.isl-nightrow*`, `.isl-phase`, és az `isl-morph`/`isl-floaty`/`isl-rowin` keyframe-ek.
- **Nem nyúlunk hozzá:** `.isl`, `.isl-big`, `.isl-blob`, `.isl-cap*`, `.isl-nowtag`, `.sky-flow`, `.isl-mealchip*` — a `shared/ui/Island` héj és a Fuel „Mai” élő fogyasztói.

## 10. A11y

- A váltó `role="group"` + magyar `aria-label="Napszak"`, a szegmensek `aria-pressed`-et viselnek (a Sport/Futás precedens); a MOST-pötty `aria-label="most"`-tal beszél, az emoji dekoratív (`aria-hidden`).
- Tabváltáskor a fókusz a megnyomott szegmensen marad (nem ugrik a tartalomba) — a `.segtabs` bevett viselkedése; a lap tetejére görgetés `scroll-behavior` szerint, reduced-motion esetén ugrás.
- Minden sor és CTA elérhető marad tab-renddel; a „nincs olyan kontroll, ami semmit nem csinál” doktrína (`servableAction` + `habitHint`) **változatlanul** érvényes.
- Az éjszakai állapot világos-szöveg párjai AA-ra ellenőrizve.

## 11. Tesztelés

- **Pure logika:** érintetlen — `dayFace`, `todayItems`, `islandFacts`, `windDown`, `questAction`, `habitAction`, `growthToday` tesztjei egy sort sem változnak. Ez a bizonyíték, hogy a modell megint túlélte a render-cserét.
- **Komponens:** `DaypartTabs.test` (kiválasztás, MOST-pötty a kiválasztástól függetlenül, `onSelect` payload), `MezoMessage.test` (nincs avatar, nincs csonkolás/`bővebben`, a teljes szöveg + refek renderelnek), `DayView.test` (hero/tény/CTA slot, kész-hajtás nyit-zár, csoport-sorrend, a küldetés-fejléc growth linkje), `EveningView.test` (a négy fázis + a `wind_down` offered-exactly-once trió + a ritual-sor szűrés).
- **Kompozíció:** a `TodayPage.test.tsx` és `TodayPage.dispatch.test.tsx` **átcímzése** — minden viselkedési állítás megmarad, de eltűnik belőlük az „előbb nyisd ki az L1-et” lépés; új állítások: minden sor és a briefing **kinyitás nélkül** látszik, tabváltás a lap tetejére görget, a retirált felületek (`.isl-l1`, `.sky-islands`, `még N ›`, `összecsuk`) hiánya. A skeleton `.apphero` node-azonosság teszt és az `anchorMode`-wins-over-pending teszt változatlan.
- **Mindkét mód:** `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- **Vizuális goldenek:** `today-{reggel,nap,este}-{light,dark}` újragenerálása darwinon (a `?dp=` most tabot választ, a nevek/órák változatlanok); a linux baseline-ok az `update-visual-baselines.yml` workflow-val.

## 12. Scope-on kívül

- Backend/API-változás nincs (frontend-only re-kompozíció).
- Új adatforrás nem épül (a HRV-cella továbbra is real módban null).
- A Fuel „Mai” ablak-folyója és a `shared/ui/Island` héj **nem változik**.
- A `docs/features/today.md` + `_platform-design-system.md` frissítése és az **ADR 0022-t leváltó ADR** az implementációs feladat része, nem ezé a specé.
