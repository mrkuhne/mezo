# Mezo-kalauz — oldalankénti in-app tutorial rendszer a béta-onboardinghoz

> Driving bd issue: `mezo-gb1s` (epic). Brainstorm: 2026-09-02, Claude Code.
> Prototípus: [`docs/design_2.0/prototypes/kalauz.html`](../../design_2.0/prototypes/kalauz.html) ·
> artifact: https://claude.ai/code/artifact/aff4eff9-775c-4222-82cf-487d143479bf

## 1. Miért

Az app béta-userek felé nyílik. A tesztelők **teljesen laikusok**: sem a fitness-fogalmakat
(makró, mezociklus, RIR), sem a Mezo saját modelljét (Életjel, Napzárás, társ-memória) nem
ismerik. Az app ~95 routolt oldal + ~6 jelentős overlay, öt tab mögött; a design-handoff
kimondottan „nincs onboarding-funnel" alapon készült (egyfelhasználós), ez most megváltozik.

Cél: minden oldal **első belépéskor** elmondja, mi ez a hely, mire jó, hogyan használjuk,
mikor nézzük, és mivel függ össze — aztán ugyanez bármikor visszanézhető a fejléc **?**
gombjából. A kalauz Mezo (az Orb) hangján szól, többes szám első személyben (IDENT-1).

Nem cél: teljes kezelési kézikönyv. A kalauz annyit mond, hogy mi ez a hely és mikor érdemes
ide jönni; a többit az oldal mutatja meg, amikor van benne adat.

## 2. Döntések (a brainstormban rögzítve)

| # | Döntés | Indok |
|---|---|---|
| D1 | **Forma: lapozó bottom sheet** (A) minden kalauzhoz; az oldal látszik mögötte | NN/G: coach-mark láncot mobilon nem lehet olvasva használni; a kontextus (az oldal) maradjon szem előtt |
| D2 | **Első indítás** (T0) teljes képernyős, hat lépés, ugyanaz az anatómia | még nincs oldal, amire mutasson |
| D3 | **Kalauz-oldal** (B, jobbról becsúszó) elvetve alapértelmezésnek; referenciaként a prototípusban marad | eltakarja azt, amiről beszél |
| D4 | **Narrátor: Mezo, az Orb**, minden kártyán | IDENT-1; a laikus rögtön megismeri a társat |
| D5 | **Szintezés:** T0+T1+T2 auto, T3 csak a ?-ból | 95 oldalon a felugrás 3 oldal után reflex-lecsapás lenne |
| D6 | **Öt kérdés, mindig ugyanabban a sorrendben** | a user a 3. oldal után „ismeri a műfajt" |
| D7 | **Spotlight csak egy elemre, gombra** („Mutasd meg a képernyőn"); bárhova koppintva a sheet visszajön | nem lánc; a kalauz nem záródik be véletlenül |
| D8 | **‹ Vissza / Tovább** lapozás + koppintható pöttyök | Daniel visszajelzése (2. kör) |
| D9 | **Seen-állapot backendben, per user, most** — a mai `created_by` seamre | a multi-user auth ugyanezt a seamet cseréli, nem kell rá várni |
| D10 | **Fejléc:** dátum · **?** · napszak-váltó · Mezo-üzenetek · harang · Orb-gömb; a ? a gombsor bal szélén, minden oldalon ugyanott | a napszak-váltó jelenléte ne tolja el |
| D11 | Éjszakai mód és Napzárás **nem kap** kalauzt; az aktív edzés a hub kalauzából kap előzetest + mini ? a prep-fázisban | rituális felületek; a chrome hiányzik |

## 3. Scope és szintek

Teljes leltár: `frontend/src/app/router.tsx:123-320` (a recon-riport tabonkénti táblája a
bd issue-ban). Szint-hozzárendelés:

| Szint | Mi | Db | Auto | Mélység |
|---|---|---|---|---|
| **T0** | Első indítás (regisztráció utáni első `/nap`) | 1 | egyszer | 6 lépés |
| **T1** | Hubok: `/nap` · `/train` · `/fuel` · `/mezo` · `/me` | 5 | igen | 5 kártya |
| **T2** | Fő aloldalak — Nap: üzenetek, rutin, küldetések, check-in, Életjel · Edzés: mai, heti, sport, futás, gyakorlatok, medálok, mezociklus-hub, aktív edzés (prep), review · Fuel: log, log/uj, terv, stack, receptek, kamra, gyógyszer, napló · Mezo: chat, minták, memoár, tudástár, előrejelzések, kísérletek, diagnózis, memória · Én: beállítások, growth, napló, heti hub, cél, súly, alvás, emberek, értesítések, karakter hub · Gyors logolás sheet (nem route: a `QuickInputSheet` első megnyitása triggereli, id `quickinput`) | ~32 | igen | 3–5 kártya |
| **T3** | Detail-oldalak (`:id`), szerkesztők, builderek, meso planner/overview/report/compare/sablonok, futás-builder, Gépterem 6 oldala, heti/emberek/karakter alnézetek, AI-napló, rutin-szerkesztő, slots | ~55 | **nem** — ? + arany pont | 1–2 kártya |
| — | Éjszakai mód, Napzárás, LevelUp-képernyő, egyszerű sheet-ek | — | nincs | — |

In-page variánsok: `?dp=` (Nap napszak-panelek) és `?view=` (Tudástár) **egy** kalauzt
kapnak, a napszakot/nézetet a „Hogyan" kártya említi. Az aktív edzés fázisai (prep → active
→ summary) komponens-eseményből: csak a prep kap kalauzt.

## 4. UX-nyelv (a prototípus a forrás)

**Sheet-anatómia** (Mozaik sheet-minta, `Sheet.tsx` + `.bsheet` recept):
grab · `KALAUZ · <oldal>` tag + `n / N` + ✕ · kártya-sáv · pöttyök · láb: `Kihagyom` (link) ·
`‹ Vissza` (ghost, 1. kártyán tiltva) · `Tovább` / utolsón `Értem, kezdjük` (CTA).

**Kártya-anatómia:** kérdés-eyebrow (`1 · MI EZ?`, coral, 0.2em) · cím (15 px, 700) ·
art-zóna (Orb 56–78 px + az oldal clay-spotja; light top-left, ground shadow) · coach-hang
(Geist 300, 12 px, max 2 mondat) · opcionális blokk a típus szerint:

| Kártya-típus | Blokk |
|---|---|
| `intro` (Mi ez?) | — |
| `fogalom` (Mire jó?) | **fogalom-doboz**: Fraunces-dőlt term + 1 mondat definíció, meleg wash, coral hairline |
| `hogyan` | opcionális `◎ Mutasd meg a képernyőn` (arany ghost) → peek |
| `mikor` | — |
| `kapcsolat` (Mivel függ össze?) | **kereszthatás-chipek**: clay-ikon + oldalnév + rövid „→ hatás"; koppintva odavisz |

**Peek/spotlight:** a sheet 64 px-es sávvá húzódik (Orb-figyel + 1 mondat + `Vissza`), a
`data-kalauz-anchor` elem `z-index` a hátlap fölé + arany gyűrű (`0 0 0 3px #C9962E` + lágy
pulzus, reduced-motion alatt statikus). **Bármilyen** koppintás (hátlap, elem, sáv) visszahozza
a sheetet; a kalauz nem záródik be.

**Fejléc ?:** `.nap-roundbtn`, Fraunces-dőlt „?", coral; állapotok: alap · **arany pont**
(T3 route, nem látott kalauz — a `nap-offnow` pötty recept) · nyitva (coral wash).

**Első indítás:** teljes képernyő (`.welcome`, z 12, a fejléc alatt), lépések: 1 Szia, Mezo
vagyok · 2 Egy nap, három szakasz (Reggel/Nap/Este spotok, alcímmel, mi történik) · 3 Öt
hely (koppintható demó-tabbar, per-fül 1 mondat) · 4 Logolni bárhonnan (FAB + létra: fotó /
egy mondat / hang / koppintás) · 5 A fejléc (koppintható demó: ?, napszak-váltó nyitott
popoverrel, üzenetek, harang, Orb) · 6 Ha bármikor elakadsz (pulzáló ?). Láb: Kihagyom ·
‹ Vissza · Tovább / Induljunk.

**Hang-szabályok** (lintelhető, `registry/lint.test.ts`): többes szám első személy; tiltott
szavak: *kell, muszáj, hiba, elbukik, rossz*; nincs piros, nincs szám-ígéret; kártya ≤ 2
mondat; fogalom ≤ 25 szó; HU címkék a glossary szerint verbatim.

## 5. Architektúra

```
AppLayout (egyszer mountol)
 └ TutorialProvider                       features/tutorial/TutorialProvider.tsx
     ├ registry lookup: pathname → entry  features/tutorial/registry/{index,nap,train,fuel,mezo,me,welcome}.ts
     ├ seen-állapot: useTutorialProgress  data/tutorial/tutorialProgressHooks.ts (useDualQuery, ghost)
     │    └ localStorage tükör            shared/lib/tutorialSeen.ts  (`mezo.kalauz.<userId>` JSON)
     ├ session-guard (Set<tutorialId>)    in-memory
     └ render: <KalauzSheet/> | <KalauzWelcome/>   shared/ui/kalauz/  (domain-mentes)
AppHeader
 └ ? gomb → ctx.open(currentId)  + arany pont: ctx.isUnseen(currentId) && tier === 'T3'
BeallitasokPage
 └ „Kalauzok" sor → ctx.resetAll()  (DELETE /api/tutorial/progress + localStorage törlés)
```

- **`TutorialProvider`** — a `MezoThreadProvider` mintája (`features/today/MezoThreadProvider.tsx`):
  React state + localStorage watermark, hogy a badge/sheet azonnal reagáljon. Context API:
  `{ current, open(id), close(), markSeen(id, {completed?, dismissedAtStep?}), isUnseen(id), resetAll() }`.
- **Registry** — tiszta adat, `RouteMatcher`-rel (react-router `matchPath`), a `router.tsx`
  útvonalaival egyeztetve egy teszt által (`registry.test.ts`: minden T0–T2 route-nak van
  entry-je; minden entry route-ja létezik).
- **`KalauzSheet`** — `shared/ui/kalauz/KalauzSheet.tsx`, a meglévő `Sheet` (portál a
  `.phone-screen`-be, Escape, backdrop) + `EntranceGroup`; **nem** importál `@/data/*`.
  Spotlight: `document.querySelector('[data-kalauz-anchor="<id>"]')`; ha nincs, a
  „Mutasd meg" gomb nem renderel (honest state, nincs törött spotlight).
- **`KalauzWelcome`** — `shared/ui/kalauz/KalauzWelcome.tsx`, `role=dialog aria-modal`,
  fókusz-csapda + visszaadás (`LevelUpScreen` recept), z a LogFlow-sávban (60): a chrome
  fölött, a sheet-ek (200) és a LevelUp (250) alatt.
- **Chrome-mentes oldalak:** `ActiveWorkoutPage` prep-fázisa saját `?`-t renderel
  (`KalauzButton` komponens, ugyanaz a ctx), id: `train.session.prep`.

## 6. Adatmodell és API

**Backend** — a FuelSettings singleton-recept másolata (`feature/tutorial/`):

- Tábla `tutorial_progress` (`OwnedEntity`, soft-delete, house-oszlopok; partial-unique
  `(created_by) where is_deleted=false`), egyetlen `jsonb progress` oszlop:
  `{ "<tutorialId>": { "version": 1, "seenAt": "...", "completedAt": "...|null", "dismissedAtStep": 2|null } }`.
  Egy sor userenként; a kalauz-id-k a frontend registry-ből jönnek, a backend nem validálja
  a kulcsokat (a registry a forrás, a backend csak tárol).
- Contract `api/feature/tutorial/tutorial-progress.yml`: `GET /api/tutorial/progress`
  (soha-404, üres `{}` ghost) · `PUT /api/tutorial/progress` (teljes csere, upsert) ·
  `DELETE /api/tutorial/progress` (reset → soft-delete + üres). Regisztráció a `merge.yml`-ben,
  `npm run generate:api` + `pnpm generate:api`.
- Kapcsoló `mezo.feature.tutorial.enabled` (`@ConditionalOnProperty`, `FeaturesConfiguration`),
  Liquibase `1.0.0/script/<ts>_mezo-gb1s_create_tutorial_progress.sql` + `1.0.0_master.yml`,
  `ResetDatabase` TRUNCATE-lista, `ArchitectureTest` rétegek (`controller/service/entity/repository`,
  generált `TutorialProgressApi` implementálása).
- ITs: `TutorialProgressApiIT` (ghost, upsert, ownership-izoláció két user között, reset)
  + `TutorialProgressSwitchOffApiIT`.

**Frontend adatréteg** — `data/tutorial/{tutorialProgressApi,tutorialProgressHooks}.ts`,
`useDualQuery` ghost `{}`-vel, `realStaleTime: DEFAULT_QUERY_STALE_TIME_MS` (shell-ben mountol),
mock-mód: `setQueryData`; MSW handler mindkét módra. Re-export a `data/hooks.ts` barrelből.

**Írás-sorrend:** `markSeen` → localStorage azonnal (React state is) → PUT optimistic; PUT-hiba
→ a lokális marad az igazság, `queryClient.invalidateQueries` a következő route-váltáson.
GET-hiba (401/404/5xx) → csak a lokális tükör; a kalauz **soha nem blokkol** oldalt.

## 7. Trigger-szemantika

1. Route-váltás (`useLocation`) → registry match → `entry`.
2. Ha `entry.tier ∈ {T1, T2}` és `!seen(entry.id, entry.version)` és `!sessionGuard.has(id)`
   → `sessionGuard.add(id)`; az `EntranceGroup` után (~600 ms, reduced-motion: 0) `open(id)`.
3. **Seen = megjelent:** `open` pillanatában `markSeen(id)` (`seenAt`, `version`). Kihagyom / ✕ /
   Escape → `dismissedAtStep`; „Értem, kezdjük" → `completedAt`. Egyik sem hozza vissza.
4. T0: a Provider első mountján, ha `!seen('welcome')` és `pathname === '/nap'` → welcome
   előbb, a `/nap` hub kalauza a welcome bezárása után (a session-guard ezt engedi, mert más id).
5. Verzió-bump: `entry.version++` → T1/T2 újra felugrik; T3-on csak az arany pont jön vissza.
6. Route-váltás nyitott kalauz alatt → a sheet bezár (mint minden sheet), `dismissedAtStep`.
7. Egy route-váltásra legfeljebb egy auto-kalauz; a `?` mindig nyithat (session-guard nem vonatkozik rá).

## 8. Tartalom-modell és előállítás

```ts
type KalauzCard =
  | { kind: 'intro';    title: string; voice: string; spot: ClaySpotName | ClayIconName; orb?: OrbState }
  | { kind: 'fogalom';  title: string; voice: string; spot: ...; term: FogalomKey }
  | { kind: 'hogyan';   title: string; voice: string; spot: ...; anchor?: string }
  | { kind: 'mikor';    title: string; voice: string; spot: ... }
  | { kind: 'kapcsolat'; title: string; voice: string; links: { to: string; label: string; icon: ClayIconName; effect?: string }[] }
type KalauzEntry = { id: string; route: string; tier: 'T1'|'T2'|'T3'; version: number; label: string; cards: KalauzCard[] }
```

- Registry-fájl tabonként + `welcome.ts`; **`fogalmak.ts`** közös szótár (makró, keret,
  mezociklus, RIR, MEV/MAV/MRV, Életjel, Napzárás, streak, stack, kreed, minta, tudás-tény,
  memoár…) — egy fogalom egyszer van megírva, a kártyák kulccsal hivatkoznak.
- T1/T2 másolat forrása: a feature-doc §1 Summary + §2 User-facing behavior, a glossary
  (handoff §13) és az identitás-axiómák. T3: egy-kártyás sablon (`intro` + opcionális `kapcsolat`).
- A tartalom-review Daniel köre szeletenként (termék-hang, nem kód): a PR-leírásban a
  kalauz-szövegek táblázatban.
- Új spot-grafika (ha kell) először `docs/design_2.0/assets/` sprite-ba, majd
  `frontend/scripts/sync-clay-assets.sh`.

## 9. Tesztelés

- **Registry:** minden T0–T2 route lefedett; minden entry route létezik a `router.tsx`-ben;
  hang-lint (tiltott szavak, mondatszám, fogalom-hossz, `fogalmak` kulcs létezik).
- **Provider (Vitest, mindkét mód):** auto-open T1/T2, nem T3; seen-on-open; session-guard;
  verzió-bump; GET-hiba → lokális; PUT-hiba → lokális marad; welcome-then-hub sorrend.
- **KalauzSheet:** lapozás (Tovább/Vissza/pöttyök), Escape = dismiss, peek → bármely
  koppintás visszahoz, anchor hiányában nincs „Mutasd meg", `aria-modal` + fókusz-visszaadás,
  reduced-motion (`matchMedia` stub).
- **AppHeader:** a `?` az első gomb — `hubHeaders.test.tsx` és `AppHeader.test.tsx`
  index-asszertjai frissülnek; arany pont T3 + unseen esetén.
- **Visual goldenek:** `tests/visual/visual.spec.ts` init-scriptje a `mezo-theme` mellé
  seedeli a „minden látva" localStorage-t (a userId a mock owner-é); a Linux-goldenek az
  `update-visual-baselines.yml` workflow-val frissülnek, ha a `?` gomb miatt kell.
- **Teszt-izoláció:** a Vitest csak a sessionStorage-t üríti — a `setup.ts` a
  `mezo.kalauz.*` kulcsokat is törli tesztek között.
- **Backend:** ApiIT + SwitchOff IT; `./mvnw test` ArchUnit-tal, Testcontainers-móddal.
- **Docs mandate:** `docs/features/tutorial.md` (10 szakasz), `today.md` §fejléc és
  `_platform-design-system.md` §10 „öt elem" → hat; `docs/CODEMAP.md` regenerálva ugyanabban a PR-ben.

## 10. Szeletek (egy bd issue + `feat/` branch szeletenként, az epic alatt)

| # | Szelet | Tartalom | Bizonyíték |
|---|---|---|---|
| S1 | **Motor + ? + seen-store** | Provider, registry-váz, KalauzSheet, backend `tutorial_progress`, hooks, MSW, header `?`, a **Fuel hub** egyetlen kalauzával | mock+real tesztek, visual golden seed, `/fuel` első belépés → sheet |
| S2 | **Első indítás + hubok** | `KalauzWelcome` 6 lépés, T1 × 5 kalauz, `fogalmak.ts` alap | welcome → `/nap` kalauz sorrend |
| S3a–d | **T2 tartalom** | Nap+Edzés · Fuel · Mezo · Én registry-k (~32 kalauz), anchorok a „Hogyan" kártyákhoz | registry-lefedettség teszt zöld |
| S4 | **T3 + arany pont + Beállítások** | ~55 egy-kártyás, `isUnseen` pont, „Kalauzok újranézése" sor + DELETE | reset → welcome újra |
| S5 | **Béta-mérés** (opcionális) | `dismissedAtStep` összesítő az AI-napló mintájára | — |

## 11. Prior art

Forrás: researcher recon (5 forrás), szűrve.

- **Adoptálva — kontextuális, oldalankénti trigger, nem launch-kori kártyapakli.** NN/G
  mobil-onboarding: a launch-kori deck „nem javította a feladat-teljesítést", a just-in-time
  segítség igen; mindig legyen látható Kihagyom. https://www.nngroup.com/articles/mobile-app-onboarding/
- **Adoptálva — Duolingo-elhelyezés:** illusztrált modál természetes szünetben, nagy grafika +
  1–2 mondat + egy CTA; az üres állapotok végzik a „mi ez" munka egy részét.
  https://userguiding.com/blog/duolingo-onboarding-ux
- **Adoptálva — Appcues seen-szemantika:** modál = látva a megjelenéskor; per-user szerver-oldali
  rekord; verzió-bump újra-jogosultság. https://docs.appcues.com/flows/setting-up-flow-frequency
- **Elvetve — coach-mark lánc mint fő hordozó.** NN/G instructional overlay: mobilon „nem
  lehet egyszerre olvasni és használni", 20 mp alatt elfelejtik; egy tipp/képernyő.
  https://www.nngroup.com/articles/mobile-instructional-overlay/ — nálunk: egy elem, gombra.
- **Elvetve — driver.js/react-joyride mint konténer** (anchor-centrikus, a „miért/mikor"
  narratívának nincs helye; mobilon nincs hely a popovernek). Az `onDone` vs `onClose`
  megkülönböztetést átvettük (`completedAt` vs `dismissedAtStep`). https://driverjs.com/docs/configuration

## 12. Codebase terrain

Forrás: investigator recon, szűrve. Útvonalak a worktree gyökerétől.

- **Shell:** `frontend/src/app/AppLayout.tsx:16-70` (Provider mount-pont, chrome-mentes lista
  `:30`, FAB-rejtés `:36`); `AppHeader.tsx:77-142` (gombsor; **nincs** route→cím leképezés,
  a registry lesz az első); `TabBar.tsx:10-16` (tab-id → clay ikon); `ScreenContent.tsx:12-14`
  (scroll-to-top route-váltásra — anchor-keresés ez után).
- **Minták:** `features/today/MezoThreadProvider.tsx:1-19` (localStorage + state);
  `shared/lib/seenMessages.ts` (seen-idióma); `shared/ui/Sheet.tsx:19-150` (portál, Escape,
  requestClose); `features/progression/LevelUpScreen.tsx:50-95` (dialog + fókusz);
  `shared/ui/mozaik/{index,motion}.tsx` (Tile/PageHero/EntranceGroup/useCountUp);
  `shared/ui/clay/index.tsx:13-34` (48 ikon, 22 spot, Orb-állapotok);
  `features/insights/components/HowItWorksView.tsx:11-18` és `features/me/logic/sleepEducation.ts`
  (modul-szintű HU copy-táblák — a registry ugyanígy).
- **Backend precedens:** `api/feature/fuel-settings/fuel-settings.yml`,
  `feature/fuel/{entity/FuelSettingsEntity,service/FuelSettingsService,controller/FuelSettingsController}.java`,
  DDL `db/changelog/1.0.0/script/202607231933_mezo-53su_create_fuel_settings.sql`,
  ITs `FuelSettingsApiIT` + `FuelSettingsSwitchOffApiIT`; FE `data/fuel/fuelSettingsHooks.ts:7-40`.
- **Auth seam:** `techcore/security/CurrentUserId.java` — `created_by` a JWT subjectből; a
  multi-user session ezt cseréli, a tutorial-tábla nem tud róla.
- **Csapdák:** header-tesztek index szerint (`hubHeaders.test.tsx:31-39`, `AppHeader.test.tsx:61-65`);
  visual goldenek (`tests/visual/visual.spec.ts:41,97`); Vitest csak sessionStorage-t ürít
  (`src/test/setup.ts:41-47`); MSW 173 handler (`src/test/msw/handlers.ts`); CODEMAP-frissesség
  gate (`scripts/gen-codemap.mjs`); contract-drift gate; `prototype.css` merge-törékeny,
  `--mz-*` tokenek mindkét `:root`-ban; `.rise` `EntranceGroup` nélkül néma; öt-tabos sáv,
  nincs szabad slot; `useDualQuery` `realStaleTime` nélkül mindig stale.
- **Elavult doksik, amiket a szelet érint:** `_platform-design-system.md` §2/§3/§10 (4 tab +
  FAB, `SettingsSheet`), `frontend_conventions.md` §3/§7 (`*Section`/`AppHero`),
  `features/README.md` route-térkép (pre-2.0) — a S1 PR a fejléc-részt javítja, a többi külön issue.

## 13. Nyitott kérdések

1. **Napszak-váltó láthatósága.** ~~A kód minden oldalon rendereli; a handoff és Daniel
   szerint Nap-only.~~ **ELDŐLT (S3a, `mezo-gb1s.5`): a kód a helyes — a váltó minden
   route-on marad.** A `mezo-atry` egy-fejléc óta a váltó nem Nap-állapot-kijelző, hanem
   navigációs affordance (bárhonnan a `/nap`-ra visz a választott napszakkal), a félrevezető
   állapot már ki van védve (off-now pötty `onNap`-scoped), és D10 pont ezért tette a `?`-t
   a sor bal szélére. A welcome fejléc-lépése S2b-ben kiesett, tehát copy-módosulás nincs.
   Indoklás bővebben: `docs/features/tutorial.md` §9.
2. **T0 trigger a multi-user flow-ban.** A regisztráció utáni első `/nap` betöltés — ha a
   multi-user session saját onboarding-lépést (profil, cél) tesz elé, a welcome az után jöjjön;
   a Provider `!seen('welcome')` feltétele ettől független.
3. **Béta-mérés** (S5): kell-e a `dismissedAtStep` összesítő, vagy elég a nyers tábla.
