# Today „iOS-nyelvű lap" redesign + mezo üzenet-chip/sheet — design spec

- **Dátum:** 2026-08-11
- **Driving bd:** `mezo-e26w`
- **Előzmény:** a napszak-tabos re-kompozíció ([`2026-08-10-today-daypart-tabs-design.md`](2026-08-10-today-daypart-tabs-design.md), `mezo-puci`), előtte a három-sziget ([`2026-08-07-today-three-islands-design.md`](2026-08-07-today-three-islands-design.md), [ADR 0022](../../decisions/0022-today-three-islands.md)). Ez a spec **negyedszer** tervezi újra ugyanazt a render-réteget; a mögötte lévő nap-modell (`dayFace.ts`), normalizáló (`todayItems.ts`), tény-derivációk (`islandFacts.ts`), akció-táblák (`habitAction`/`questAction`), wind-down fázisok és a teljes sheet-réteg **változatlanul megmaradnak**.
- **Mockup (a validált irány):** [`assets/2026-08-11-today-ios-redesign-mockup.html`](assets/2026-08-11-today-ios-redesign-mockup.html) — a valódi `prototype.css`-t és `fonts.css`-t betöltő statikus mockup, mind a három napszakkal és a megnyitott üzenet-sheettel. A repo gyökeréből kiszolgálva pontos (a `/fonts/` abszolút útvonalak miatt fájlból megnyitva rendszerfontra esik vissza).
- **Döntés-előzmény:** [`assets/2026-08-11-today-message-variants-mockup.html`](assets/2026-08-11-today-message-variants-mockup.html) — a mezo-üzenet három vizsgált változata (A: helyben nyíló buborék · B: chip → sheet · C: napszakra szűrt buborék). A választás **B**.

## 1. Cél

Az előző iteráció két, egymással összefüggő panaszt hagyott maga után:

1. **A briefing mindenhol ott áll.** A `MezoMessage` full-bleed sáv a tabok alatt ül, ugyanaz mind a három napszakon, csonkolás nélkül — a mock adatokon ~600px, vagyis a Nap és az Este tabon is a *reggeli* briefing tölti ki az első képernyőt, és a napszak tényleges tartalma csak alatta kezdődik.
2. **Az előző spec „kevesebb doboz" célja túllőtt.** A külső kártyakeret eltávolítása után nem egy nyelv maradt, hanem **öt párhuzamos**, egyik sem beszél a másikkal: korall szövegsáv · csupasz hero a vásznon · keretes ténystrip · egyenként lebegő fehér sorkártyák árnyékkal · sárga warn-doboz · levendula creed-doboz · szürke akció-pirulák. Ehhez jön két másodlagos zaj: a lánc **minden sora ugyanazt a napszak-emojit** viseli nagy csempében (öt 🌅, négy 🌙), és a szekciócímkék (24px) meg a sorkártyák (48px) bal éle **nem áll egy vonalban**.

Az új képernyő célja:

1. **A mezo hangja egy 44px-es chipbe költözik**, és minden generált üzenetnek **egyetlen otthona** lesz: az üzenet-sheet. A briefing nem tolakszik, de nem is tűnik el.
2. **Egyetlen doboznyelv az egész lapon** — az iOS „inset grouped list": szekciónként egy lekerekített doboz, hajszálvonalas belső elválasztókkal, **mindent egyetlen 16px-es bal sínre** igazítva.
3. **Nincs több értelmetlen ismétlés** — a habit-sorok ikonja a szokáshoz tartozik, nem a napszakhoz.

Ami **nem** cél: új adatforrás, backend- vagy API-változás, a nap-modell vagy az act-anywhere elv megbontása, és **a `shared/ui/ItemRow` bármilyen módosítása** (lásd §7).

## 2. A képernyő anatómiája

Fentről lefelé, a `.screen-content` normál görgetésében:

```
AppHero                     változatlan chrome (Today a ✨ Insights linket adja utilities-ként)
VulnerabilityCard?          változatlan (?vulnerable=on)
DaypartTabs                 ÚJ FORMA — egy vályú + csúszó bélyeg; az arany MOST-pötty marad
MezoChip                    ÚJ — 44px-es chip; koppintásra MezoMessagesSheet. Üzenet nélkül NEM renderel.
DaypartPanel(selected)      a kiválasztott napszak teljes tartalma, az új listanyelven
  ├─ ChainCelebrations      változatlan komponens
  ├─ DaypartHero            a napszak egyetlen nagy száma + alsor (a `.dv-hero` utódja)
  ├─ TodayStats             EGY doboz, függőleges hajszálvonallal (az `IslandFactsStrip` utódja)
  ├─ CTA?                   teljes szélességű teli gomb (nap: Indítsuk/Saját edzés · este: Napzárás)
  ├─ lábjegyzet?            a niggle-figyelmeztetés — `.td-foot` szöveg, nem sárga doboz
  ├─ szekciók               fejléc (a sínen kívül) + EGY TodayList csoportonként
  │    └─ TodayRow-k        ikon · cím + horgony-alsor · kísérő (karika / szöveggomb / chevron)
  └─ kész-hajtás            az EGYETLEN összecsukott elem: „✓ N kész ma · +M XP ▾"
mai-logrow                  változatlan Fuel belépő
TabBar                      változatlan chrome
```

A görgetés a lap sajátja (`.screen-content`), nincs beágyazott scroller. A `?dp=` marad a kiválasztás egyetlen forrása, változatlan derivációval.

## 3. A mezo hangja — `MezoChip` + `MezoMessagesSheet`

### 3.1 A chip

Egyetlen 44px magas sor a tabok alatt: **avatar** (26px, coral gradiens, `✦`) · **„Mezo"** · a **legfrissebb üzenet első mondata** egy sorban, ellipszissel csonkolva · **darabszám-plecsni** · **chevron**.

- **Honest absence:** ha a napnak egyetlen üzenete sincs, a chip **egyáltalán nem renderel** — nincs üres állapot, nincs placeholder. (Mock módban ma csak a briefing van, tehát a plecsni `1`.)
- **Olvasatlan-jelzés:** a chip avatarja korall pöttyöt visel, amíg a nap **legfrissebb** üzenetét meg nem nyitottad. Állapot: `localStorage`, **dátumra kulcsolva** (`mezo.msgseen.<YYYY-MM-DD>` → a legutóbb látott üzenet id-je), a sheet megnyitásakor íródik. Nincs backend, nincs API, nincs szerveroldali read-state. Napváltáskor a kulcs magától elavul.
- A chip **teljes szélességében** gomb (`aria-haspopup="dialog"`), nem csak a chevron.

### 3.2 A sheet

A házi `shared/ui/Sheet`-en ül. Fejléc: „Mezo üzenetei" + `Kész`. Alatta `Ma` napelválasztó, majd a nap üzenetei **buborékban**, mindegyik saját eyebrow-val (a forrás neve) és időbélyeggel, kronologikus sorrendben — a legfrissebb alul.

**Nincs új adatforrás.** A szál a lapon **már meglévő két hookból** áll össze:

| Forrás | Hook | Eyebrow | Idő |
|---|---|---|---|
| Napi briefing | `useToday().briefing` (ill. `resolveBriefing(scenario.dayState)`) | `briefing.eyebrow`, fallback `Reggeli briefing` | az eyebrow-ban lévő óra, ha van; különben nincs |
| Napközi jegyzet / napzárás | `useCompanionNote()` | `kind === 'closing'` → `Napzárás`, különben `Napközi jegyzet` | `note.window` |

A briefing buborékja viszi tovább a mai `MezoMessage` teljes tartalmát: a bekezdéseket `SafeMarkdown`-nal, a `Hivatkozott` `RefTag` chipeket, és az őszinte `Demo tartalom` / `Confidence N%` lábat. **Csonkolás sehol nincs** — a sheet görgethető.

A szál összeállítása pure függvény: `logic/mezoMessages.ts` → `buildMezoMessages({ briefing, note })` → `MezoMessage[]` (`{ id, eyebrow, time, paragraphs, refs, meta }`). Saját teszttel; ide fűződik be minden jövőbeli generált üzenet, a chip és a sheet érintése nélkül.

## 4. A lapnyelv

**Egyetlen doboznyelv.** Szekciónként **egy** lekerekített doboz (`--r-lg`, `--surface-card`, `.5px` `--divider` keret, **árnyék nélkül**), belül hajszálvonallal elválasztott sorokkal. Az elválasztó **52px-től** indul (a vezető ikon szélessége + a belső padding), nem a doboz élétől — ez az iOS-listák jellegzetes bevágása.

**Egyetlen sín.** Minden vízszintes él ugyanaz a **16px** (`--td-gut`): a szekciófejléc, a listadoboz, a hero, a statisztika-csoport, a CTA és a kész-hajtás. A mai 20/24/48px-es keveredés megszűnik.

**Kizárólag meglévő DS-tokenekből épül** — `--surface-card`, `--surface-recess`, `--divider`, `--text-*`, `--r-lg`/`--r-full`, `--gradient-cta`, `--shadow-cta`, `--sp-*`, `--dv-*`. **Nincs új szín, nincs új token**; a Napív rampák érintetlenek.

**Elemek:**

| Elem | Forma |
|---|---|
| Napszak-váltó | egy `--surface-recess` vályú + fehér csúszó bélyeg (`--shadow` helyett `.5px` kontúr); arany MOST-pötty a kronológiailag aktuális szegmensen, a kiválasztástól függetlenül |
| Hero | 36px Geist 250, tabular-nums, balra; mellette 15px-es egység, alatta 12,5px-es alsor |
| Statisztika-csoport | EGY doboz, cellánként 21px-es érték + halk egység + nagybetűs címke + delta-sor; a cellák között függőleges hajszálvonal; a „nincs forrás → nincs cella" szabály változatlan |
| CTA | teljes szélességű, 50px magas teli gomb (`--gradient-cta`); az este lavendula variánsa marad az app egyetlen nem-korall elsődleges gombja |
| Figyelmeztetés | a CTA alatt **lábjegyzet-szöveg** `--warning-hover` színben, doboz nélkül |
| Szekciófejléc | 11px/700 nagybetűs, `--text-muted`, a doboz **fölött**, a sínen; jobbra opcionális tintás link (küldetés → `/me/growth`, fuel → napló) |
| Kész-hajtás | szaggatott `.5px` keretű halk sor, `--success-hover` szöveggel |

## 5. A sor (`TodayRow`)

`[ikon 28px] [cím + horgony-alsor] [kísérő]`, min. 56px magas, a tap target mindenütt ≥44px.

### 5.1 A kísérő

A `TodayItem`-ből **három** alak derivál, egy pure függvénnyel — `logic/rowAccessory.ts` → `rowAccessory(item): 'tick' | 'button' | 'none'`:

| Kísérő | Mikor | Mai megfelelő |
|---|---|---|
| **Pipáló karika** (26px, üres → `--success-base` telt ✓) | `item.action.kind === 'habit'` **és** `action.habit.mode === 'MANUAL'` | a `Pipa` feliratú szürke pirula |
| **Tintás szöveggomb** (a `label` szövegével: `Logolás` / `Naplózz` / `Koppints` / `Logold` / `Pótold` / `Zárjuk le`) | minden más `item.action` | a szürke akció-pirula |
| **semmi** | `item.action == null` (a `servableAction` lecsupaszította, vagy sosem volt) | változatlan |

**Sosem a címke szövegéből dolgozik** — a `TodayAction` minden változata *mindig* visel `label`-t (`todayItems.ts:168,194,217,239,256`), tehát a „nincs címke" nem megkülönböztető jel; a `mode === 'MANUAL'` az.

Egy **negyedik** alak, a **chevron `›`**, a `TodayRow` propja, nem derivált érték: a nézet által közvetlenül renderelt, sheetet nyitó olvasható sorok viselik (esti `Reflexió`, `Fókusz`), amelyek nem `TodayItem`-ből jönnek.

### 5.2 Amit a `TodayRow` szó szerint átvesz az `ItemRow`-tól

Ezek nem stílusjegyek, hanem kiharcolt viselkedési szabályok — a `TodayRow`-nak mindet vinnie kell:

- **`linkUrl` → trailing `↗`** az akció **mellett**, sosem helyette, és **sosem a sor saját `<button>`-jén belül** (érvénytelen HTML + kattintás-ütközés).
- **`disabled` (repülő írás) → a kontroll VISSZAVONÓDIK**, nem elhalványul; nem marad kattintható felület, így dupla koppintás nem indít második mutációt.
- **`actionLabel` `onAction` nélkül → inert szöveg**, sosem halott gomb.
- **`done` sor:** a cím áthúzva + `--text-muted`, az ikon 45%-os. Az ikon **NEM** cserélődik `✓`-ra (ahogy ma az `ItemRow`-ban) — a pipálást a karika hordozza.

### 5.3 Az ikon-létra

A `todayItems.ts` mai `emoji: DAYPART_EMOJI[chain.daypart]` sora egy létrát hív (`logic/itemIcon.ts`, pure, saját teszttel):

1. **`habitKey` → kurált emoji** — a beépített szokásokra egy explicit tábla (`pushups → 💪`, `mushroom_coffee → ☕`, `morning_video → 🎬`, …).
2. **`skillKey` → a life-skill emojija** — a chain `defs`-éből (`HabitChainInfo.defs`, `habitKey` egyezéssel) olvasva. A `LifeSkillKey` **zárt, 8 értékű** enum (`mindfulness · mindset · cooking · financial · productivity · learning · connection · recovery`), tehát minden jövőbeli, AI-generált szokásra van találat.
3. **Napszak-emoji** — végső tartalék, a mai viselkedés.

A nem-habit sorok forrás-emojija (`⚡` küldetés, `💗` check-in, `🍶` fuel, a session sajátja) **változatlan** — azok forrás-jelölők, nem szokás-identitás.

## 6. Napszakok

A három napszak-nézet tartalmi felosztása **változatlan** (`DaypartMorning` / `DaypartDay` / `DaypartEvening`), csak az új nyelven renderel:

| Napszak | Hero | CTA |
|---|---|---|
| 🌅 Reggel | `morningHero` — az éjszakai alvás órái (`fallbackHero`, ha nincs éjszaka) | **nincs** — a lánc első lépése ott a listában |
| ☀️ Nap | a session indulása + címe (`17:00 · Pull Day`), pihenőnapon `Pihenő` | `Indítsuk` / `Logold`, pihenőnapon `Saját edzés` |
| 🌙 Este | élő visszaszámlálás a villanyoltásig (`bedCountdown`) | `Napzárás` (lavendula) |

**Az esti négy fázis** (`useWindDownPhase`) változatlanul él, és változatlanul a hero/CTA sávban játszódik; a `leállás` fázis ghost gombja (`Leállás megvolt ✓`) a CTA alá kerül. Az `éjszaka` fázisban a `DaypartPanel` `data-night` állapota adja a theme-invariáns sötét szövegpárokat, ahogy ma.

**Horgony-mód (`?day=rough`):** teljesen változatlan — szemantika, guard-sorrend (`anchorMode` mindenki előtt, szinkron az URL-ből, skeleton-villanás nélkül), és az `AnchorIsland` tartalma is. A melt tabok és chip nélkül tölti ki a lapot, és **tovább használja a `shared/ui/ItemRow`-t**.

## 7. Hatósugár — a `shared/ui/ItemRow` érintetlen

A `TodayRow` **új, Today-lokális komponens**; a `shared/ui/ItemRow` egyetlen sorral sem változik. Ez tudatos döntés: az `ItemRow`-t a Today-n kívül a Fuel „Mai" ablak-folyója (`features/fuel/components/WindowIsland.tsx`) és a rutin-szerkesztő (`features/me/pages/RoutineEditorPage.tsx`) is rendereli, és ebben a változásban egyiket sem akarjuk vizuálisan megbolygatni.

Following: két képernyő **átmenetileg két sornyelvet** beszél. Ezt elfogadjuk, és **külön bd-issue** viszi tovább az új nyelvet a Fuelre és a Me-re; ha ott is beválik, akkor promotálódik a `shared/ui`-ba.

A Today **sheetjei** (`CheckInSheet`, `AnchorIsland`) szintén az `ItemRow`-n maradnak — a sheet nem a lap, és nem a lap nyelvét beszéli.

## 8. Komponens-terv

**Változatlan (újrafelhasznált):** `dayFace.ts`, `todayItems.ts` (a §5.3 egysoros ikon-hívásán kívül), `islandFacts.ts`, `questAction`/`habitAction` + `habitHint`, `windDown.ts` + `useWindDownPhase`, `growthToday.ts`, `useChainCelebration` + `ChainCelebrations`, minden data-hook, mind a hét sheet, `AppHero`, `VulnerabilityCard`, `AnchorIsland`, `CoachBubble`, `RefTag`, `SafeMarkdown`, `Sheet`, `useLevelUp`, a scenario-paramok, a `servableAction` + `?dp=` logika a `TodayPage`-ben.

**Új (`features/today/`):**
- `components/MezoChip.tsx` — a 44px-es chip + olvasatlan-pötty.
- `components/MezoMessagesSheet.tsx` — a szál a házi `Sheet`-en.
- `logic/mezoMessages.ts` — `buildMezoMessages({ briefing, note })`, pure.
- `logic/itemIcon.ts` — a habitKey → skillKey → napszak ikon-létra, pure.
- `logic/rowAccessory.ts` — `'tick' | 'button' | 'chevron' | 'none'`, pure.
- `components/TodayList.tsx` + `TodayRow.tsx` — a csoportos listadoboz és a sor.
- `components/TodayStats.tsx` — az egydobozos statisztika-csoport.

**Új (`shared/lib/`):** `seenMessages.ts` — a `localStorage` olvasatlan-állapot (dátumra kulcsolt, defenzív `try/catch`, private-mode-biztos). Domain-mentes, ezért nem a feature alatt.

**Átalakul:** `DaypartTabs` (vályú + bélyeg), `DaypartPanel` + `DaypartHero`, `DayGroups` (a `TodayList`-re épül; a csoportosítás első-megjelenés sorrendben és a kész-hajtás **változatlan**), `DaypartMorning` / `DaypartDay` / `DaypartEvening`, `IntentionBanner` (a creed a listadoboz feje lesz, a fókuszok sorok), `TodaySkeleton` (az új layoutra), `TodayPage` (a `MezoMessage` helyére a chip + a sheet-state).

**Visszavonul a Today-ról:** `MezoMessage.tsx`, `IslandFactsStrip.tsx`, `CompanionNoteCard.tsx` (a jegyzet a sheetbe költözik), és a `.dv-*` + `.cb-band` CSS-család.

**CSS:** új, Today-scoped `.td-*` család a `prototype.css`-ben. Az `.isl-*` család **érintetlen** — a Fuel szigetjei és a `shared/ui/Island` héj élő fogyasztói (ezt az előző spec §9 táblázata soronként megállapította).

## 9. Mozgás-nyelv

- **Tabváltás:** a `DaypartPanel` `key={tone}` keresztfade-je + 8px felúszás — változatlan (`isl-phasein`, újrahasznált keyframe).
- **A bélyeg csúszása** a szegmentált kapcsolóban: `background`/`color` átmenet `--duration-fast` + `--ease-out`.
- **Sheet:** a házi `Sheet` saját mozgása, változatlan.
- **Kész-hajtás:** magasság-animáció, változatlan.
- **A cascade-guard szabály él tovább:** minden új animáció-módosító `:where()`-be csomagolva, hogy a reduce-blokk source-order tie-breakerrel nyerjen. A `todayReducedMotion.test.ts` strukturálisan ellenőrzi, és **az új `.td-*` családra át kell címezni**.

## 10. A11y

- A váltó `role="group"` + `aria-label="Napszak"`, a szegmensek `aria-pressed`-et viselnek; a MOST-pötty `aria-label="most"`-tal beszél, az emoji dekoratív (`aria-hidden`).
- A chip `<button>` `aria-haspopup="dialog"`-gal; a plecsni számát a gomb akadálymentes neve tartalmazza (pl. „Mezo üzenetei, 3 üzenet, 1 olvasatlan").
- A pipáló karika **valódi gomb**, kötelező `aria-label`-lel (a sor címét tartalmazza — „50 fekvőtámasz kipipálása"), mert a karikának nincs látható szövege.
- A sorelválasztók dekoratívak (`::before`), nem `<hr>`.
- Minden sor és CTA elérhető marad tab-renddel; a „nincs olyan kontroll, ami semmit nem csinál" doktrína (`servableAction` + `habitHint`) **változatlanul** érvényes.
- Az éjszakai állapot világos-szöveg párjai AA-ra ellenőrizve; a tintás szöveggomb `--primary-hover`-t használ (a `--primary-base` szövegként 2,8:1, megbukik — [ADR 0018](../../decisions/0018-adopt-exist-zen-design-system.md)).

## 11. Tesztelés

- **Pure logika — érintetlen:** `dayFace`, `todayItems`, `islandFacts`, `windDown`, `questAction`, `habitAction`, `growthToday` tesztjei egy sort sem változnak. (A `todayItems.test.ts` a habit-emojira nem állít semmit, így az ikon-létra bevezetése nem érinti.) Ez a bizonyíték, hogy a nap-modell a **negyedik** render-cserét is túlélte.
- **Új pure tesztek:** `mezoMessages.test.ts` (sorrend, hiányzó jegyzet, üres nap → üres tömb), `itemIcon.test.ts` (mindhárom létrafok + ismeretlen kulcs), `rowAccessory.test.ts` (mind a négy alak), `seenMessages.test.ts` (dátumváltás, sérült/hiányzó `localStorage`).
- **Komponens:** `MezoChip.test` (üzenet nélkül nem renderel · plecsni-szám · olvasatlan-pötty megjelenik és megnyitás után eltűnik · a teljes chip gomb), `MezoMessagesSheet.test` (a briefing bekezdései + refek + `Demo tartalom` · a jegyzet buborékja · kronológia), `TodayRow.test` (mind a négy kísérő · `linkUrl` az akció mellett és nem benne · `disabled` visszavonja a kontrollt · `done` nem cseréli az ikont), `TodayList.test` (csoport-sorrend, fejléc-darabszám, a küldetés-fejléc `/me/growth` linkje, kész-hajtás nyit-zár), `DaypartTabs.test` (kiválasztás · MOST-pötty a kiválasztástól függetlenül · `onSelect` payload).
- **Kompozíció:** a `TodayPage.test.tsx` és `TodayPage.dispatch.test.tsx` **minden viselkedési állítása megmarad**, csak a lekérdezések címződnek át; új állítások: a briefing **nem** a lapon áll, a chip megnyitja a sheetet, a sheet tartalmazza a briefinget. A skeleton `.apphero` node-azonosság teszt és az `anchorMode`-wins-over-pending teszt **változatlan**.
- **Regresszió-őr:** egy strukturális teszt állítja, hogy a `features/today/components/Today*.tsx` egyetlen fájlja sem importálja a `shared/ui/ItemRow`-t — ez a §7 hatósugár őre, ugyanabban a nyelvben, ahogy a `todayReducedMotion.test.ts` őrzi a cascade-guardot. A Fuel és a Me `ItemRow`-tesztjei érintetlenül maradnak (nem kell hozzájuk nyúlni; ha egy is elmozdul, a hatósugarat sértettük meg).
- **Mindkét mód:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- **Vizuális goldenek:** `today-{reggel,nap,este}-{light,dark}` újragenerálása darwinon (12 fájl a `frontend/tests/visual/visual.spec.ts-snapshots/` alatt); a linux baseline-ok az `update-visual-baselines.yml` workflow-val.

## 12. Scope-on kívül

- **Backend/API-változás nincs** — frontend-only re-kompozíció.
- **Új adatforrás nincs** — az üzenet-szál a meglévő `briefing` + `companionNote` hookokból áll össze; a HRV-cella továbbra is real módban null.
- **A `shared/ui/ItemRow` nem változik**, és vele a Fuel „Mai" + a rutin-szerkesztő sem (§7). Az átvitelük külön bd-issue.
- **Szerveroldali read-state nincs** — az olvasatlan-jelzés `localStorage`, dátumra kulcsolva.
- **Ikon mező az adatmodellben nincs** — a habit-ikon frontend-oldali létra (§5.3). Az `icon` mező + rutin-szerkesztő ikonválasztó külön bd-issue.
- A `docs/features/today.md` + `_platform-design-system.md` frissítése és az **ADR 0022-t leváltó ADR** az implementációs feladat része, nem ezé a specé.
