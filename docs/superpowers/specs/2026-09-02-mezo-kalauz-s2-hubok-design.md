# Mezo-kalauz S2a — öt hub-kalauz + a közös `fogalmak.ts` szótár

> Driving bd issue: `mezo-gb1s.3` (az `mezo-gb1s` epic alatt). Brainstorm: 2026-09-02, Claude Code.
> Szülő-spec: [`2026-09-02-mezo-kalauz-tutorial-design.md`](2026-09-02-mezo-kalauz-tutorial-design.md)
> (D1–D11, §4 UX-nyelv, §5 architektúra, §7 trigger-szemantika — mind érvényben marad).
> Feature-doc az S1 után: [`docs/features/tutorial.md`](../../features/tutorial.md).

## 1. Miért ez a szelet, és miért csak ennyi

A szülő-spec §10 `S2` sora három dolgot fogott össze: a T0 első indítást, az öt hub kalauzát
és a `fogalmak.ts`-t. A brainstormban ezt **kettévágtuk**:

- **S2a (ez a spec):** `fogalmak.ts` + öt T1 hub-kalauz. Tiszta registry-tartalom, egy kis
  típus-varrat, teszt-higiénia. **Frontend-only.**
- **S2b (külön spec, külön szelet):** a T0 welcome flow — az egyetlen valóban új komponens,
  és az egyetlen rész, amit a prior art érdemben megkérdőjelez (§6).

Az ok: a welcome a kockázatos rész (új full-screen dialógus, fókusz-csapda, interaktív demók,
z-index-vita a specen belül), és nincs oka magával rántania 25 kártyányi tartalmat, ami a
`fuel.ts` már bizonyított mintáját másolja.

**A backend nem változik.** A `tutorial_progress` jsonb map kulcs-agnosztikus
(`docs/features/tutorial.md:181-184`), tehát nincs contract, nincs migráció, nincs IT.

## 2. Döntések

| # | Döntés | Indok |
|---|---|---|
| S2a-1 | **A szelet kettévágva**: hubok+szótár előbb, welcome utána | a welcome a kockázat; ne blokkolja a tartalmat |
| S2a-2 | **A szótár kulcs szerint hivatkozott, de a registry-ben feloldott** | a `KalauzSheet` szándékosan újradeklarálja a kártya-uniót, hogy a `shared/ui` domain-mentes maradjon (`KalauzSheet.tsx:20-25`); egy `FogalomKey` a kártya-típusban ezt megtörné |
| S2a-3 | **Egy fogalom = egy megfogalmazás**, felülírás nélkül | Polaris: a szinonima-variancia a kezdő-szótárak fő bukása (§6) |
| S2a-4 | **A szótár csak azt tartalmazza, amit a hubok hivatkoznak** (5 kulcs) | YAGNI; a T2-fogalmak akkor születnek, amikor a kontextusuk is ismert (S3) |
| S2a-5 | **A `/nap` kalauz arc-semleges**, és maga a napszakosság a fogalom-kártya | a `NapHubPage` három arcot rendel; egy kártya, ami csak a „nap" arcban igaz, hazugság reggel 7-kor |
| S2a-6 | **A `data-kalauz-anchor` minden hős-variánsra kikerül**, nem wrapper-divbe | `measureAnchor` `getBoundingClientRect`-et hív: `display:contents` nullát mér, valódi wrapper a `mz-panel-stack` gap-jét kockáztatja |
| S2a-7 | **`seedAllKalauzSeen()` teszt-helper a `KALAUZ_REGISTRY`-ből származtatva** | az S3 ~32 kalauza így nem söpri végig újra a shell-teszteket |

## 3. Amit hozzáad

```
frontend/src/features/tutorial/registry/
  fogalmak.ts        ÚJ — FOGALMAK: Record<FogalomKey, Fogalom> + fogalom(key) helper
  nap.ts             ÚJ — NAP_KALAUZ
  train.ts           ÚJ — TRAIN_KALAUZ
  mezo.ts            ÚJ — MEZO_KALAUZ
  me.ts              ÚJ — ME_KALAUZ
  fuel.ts            MÓD — a `makró` fogalom-kártya átáll a helperre
  index.ts           MÓD — a négy új tömb a spreadbe
  registry.test.ts   MÓD — szótár-lint (kulcs létezik, nincs árva kulcs)
frontend/src/test/
  kalauz.ts          ÚJ — seedAllKalauzSeen()
```

Plusz négy `data-kalauz-anchor` attribútum a hub-oldalakon, hat shell-teszt seedelése, és a
`visual.spec.ts` init-scriptjének átállítása.

**Nem** ad hozzá: welcome/T0-t, semmilyen T2/T3 tartalmat, semmilyen Provider-viselkedésváltozást.

## 4. A szótár

```ts
export type FogalomKey = 'napszak' | 'mezociklus' | 'makro' | 'minta' | 'szint'
export interface Fogalom { term: string; def: string }
export const FOGALMAK: Record<FogalomKey, Fogalom> = { … }
/** Registry-időben old fel — a KalauzCard továbbra is {term, def}-et hordoz. */
export const fogalom = (key: FogalomKey): Fogalom => FOGALMAK[key]
```

A `fogalom`-kártya így épül a registry-fájlban:

```ts
{ kind: 'fogalom', spot: 's-reggel', orb: 's-orb',
  title: 'Az oldal veled együtt változik.',
  voice: '…',
  ...fogalom('napszak') }
```

Minden bejegyzés provenance-kommentet visel — a `sleepEducation.ts` és a
`HowItWorksView.tsx:13-20` mintája szerint, ahol a HU copy-táblák már így hordozzák a forrásukat.

| kulcs | `term` | forrás |
|---|---|---|
| `napszak` | napszak | `features/today/logic/dayFace.ts:12-20` — három **alvás-horgonyzott** ablak (`MORNING_SPAN_MIN`, `EVENING_LEAD_MIN`), nem fix óra |
| `mezociklus` | mezociklus | `docs/features/train.md` §Planner; `MesocyclePlannerPage.tsx` |
| `makro` | makró | `docs/features/fuel.md` §1–§3 — a mai `fuel.ts` szövege költözik ide változatlanul |
| `minta` | minta | `docs/features/insights.md` §2.1, `companion.md`; `features/insights/logic/{lifecycle,verdicts}.ts` |
| `szint` | szint | `docs/features/growth.md` + [ADR 0010](../../decisions/0010-gamified-growth-xp-feedback-not-payment.md) — *az XP visszajelzés, nem fizetség* |

**Lint-csapda:** a `minta` definíciója nem használhatja a „rossz alvás" fordulatot — a `rossz`
tiltott tő a hang-lintben (`registry.test.ts:7`); „kevés alvás" a helyes megfogalmazás. Ugyanez
a stem-alapú regex a `hiba`/`hibázni` szóra is tüzel, ami fitness-copyban természetesen adódna.

## 5. Az öt kalauz

Mind T1, `version: 1`, öt kártya a D6 rögzített sorrendjében (intro → fogalom → hogyan →
mikor → kapcsolat). A `label` a tab neve verbatim.

| id / label | fogalom | anchor | kapcsolat-chipek |
|---|---|---|---|
| `nap` / **Nap** | `napszak` | `nap-hero` | `/nap/eletjel` · `/nap/kuldetesek` · `/nap/rutin` · `/fuel` |
| `train` / **Edzés** | `mezociklus` | `train-hero` | `/train/week` · `/train/mesocycles` · `/fuel` (edzésnap → +keret) · `/train/medals` |
| `fuel` / **Fuel** | `makro` *(refaktor)* | `fuel-log` *(kész)* | változatlan |
| `mezo` / **Mezo** | `minta` | `mezo-chat` | `/mezo/chat` · `/mezo/patterns` · `/mezo/memoir` · `/mezo/knowledge` |
| `me` / **Én** | `szint` | `me-idhero` | `/me/weight` · `/me/sleep` · `/me/growth` · `/me/beallitasok` |

Minden chip-`to` a `router.tsx` valódi útvonala (a `registry.test.ts:18` `matchRoutes`-gate
csak az entry `route`-ját ellenőrzi, a chipeket nem — ezért a lint-teszt **kiterjed** a
`kapcsolat` linkekre is, hogy egy elgépelt `/mezo/memoar` ne csússzon át).

### Anchor-helyek

| hub | attribútum | hely |
|---|---|---|
| `/nap` | `nap-hero` | mind a **négy** `.nap-hero` node: `NapHubPage.tsx:222` (anchor-mód), `:274` (reggel), `:323` (nap), `:387` (este) |
| `/train` | `train-hero` | mind a **hat** `.eh-hero` variáns: `EdzesHubPage.tsx:109,129,163,185,215,235` |
| `/fuel` | `fuel-log` | `FuelMaiPage.tsx:132` — kész |
| `/mezo` | `mezo-chat` | `MezoHubPage.tsx:160` — a composer-alakú chat-nyitó, feltétel nélkül renderel |
| `/me` | `me-idhero` | `EnHubPage.tsx:183` — az identitás-hős, feltétel nélkül renderel |

A `/mezo` döntéskártyája (`:174`) és a `/me` cél-kártyája (`:108-140`) adat-feltételes, ezért
nem anchor: a „Mutasd meg" gomb némán eltűnne (`KalauzSheet.tsx:64`).

### A `/nap` arc-semlegessége

A `NapHubPage` napszaktól függően három különböző hőst és csempe-készletet rendel, plusz van
egy anchor-mód variáns (`:220-266`). Az Életjel-gyűrű **csak** a „nap" arcban létezik
(`:346-354`). Ezért:

- egyetlen kártya sem állít olyat, ami csak egy arcban igaz;
- a fogalom-kártya témája maga a napszakosság — ez egyszerre igaz és a Mezo egyik legsajátabb
  fogalma;
- a „hogyan" kártya a hősre mutat, ami mindhárom arcban ott van, csak mást mond;
- az Életjel a `kapcsolat`-chipek közé kerül (`/nap/eletjel` mindig létező route), nem a
  törzsszövegbe.

## 6. Prior art

Forrás: researcher recon (5 forrás), szűrve. A hubokra vonatkozó rész:

- **Adoptálva — Polaris: egy fogalom, egy kanonikus címke, sosem szinonimákkal váltogatva.**
  A saját kitalált szókincs olyan zsargon, amit még senki nem mond; a szótár, a hub-kártya,
  a tab-címke és a UI ugyanazt a szót kell hogy használja. Ez a S2a-3 döntés indoka.
  https://polaris-react.shopify.com/content/fundamentals
- **Adoptálva — GOV.UK Details: a definíció a folyamban, nem hoverben és nem modálban.**
  A komponens dokumentált kizárása („ne rejtsd el azt, amire a többségnek szüksége van")
  itt döntő: laikusnak a *makró/mezociklus* első találkozáskor többség-igény, ezért a
  fogalom-doboz kiírva látszik, nem csukva. https://design-system.service.gov.uk/components/details/
- **Adoptálva — Duolingo: a karakter-hang és a definíció szétválasztása.** A kabala viszi a
  köszönést, az átvezetést és a bátorítást; a definíció maradjon hangtalan és sima. A
  karakter-hangba csomagolt definíció felfújja a szószámot és elmossa a fogalmat — ezért a
  `voice` mező Mezo hangján szól, a `def` mező viszont nem.
  https://design.duolingo.com/writing/duo
- **Elvetve — Duolingo streak-nyomás.** Kifejezetten in-brand kivétel náluk; a mi
  nyomásmentes hang-szabályunkkal (`registry.test.ts:7`) összeegyeztethetetlen.

**Az S2b-t érintő, itt csak rögzített megállapítások** (a welcome szelet specje veszi elő):

- **NN/G 70 fős kontrollált mérése**: a lapozós intro-kártyapakli nézői nem lettek sikeresebbek
  (91% vs 94%) és nem lettek gyorsabbak, viszont **nehezebbnek élték meg** ugyanazokat a
  feladatokat (4,92 vs 5,49 hétfokú skálán). A mérés statikus kártyapaklikat vizsgált standard
  UI-mintákkal; a koppintható, valós UI-t begyakoroltató lépések és a kitalált fogalmakra
  való felkészítés evidencia-hézagban vannak, nem cáfoltak.
  https://www.nngroup.com/articles/mobile-tutorials/
- **NN/G onboarding-taxonómia**: „röviden, opcionálisan, a minimumot"; a standard minták
  (tabbar, fejléc-ikonok) magyarázó kártyaként gyengén indokoltak, koppintható gyakorlásként
  erősen. Kifejezetten ellenzi a welcome → azonnal auto-felugró `/nap` kalauz láncot: a
  második sheet még nem *actionable*, csak egy második falnyi szöveg.
  https://www.nngroup.com/articles/mobile-app-onboarding/

Evidencia-minőségi megjegyzés a researchertől: az „interaktív túrák 50%-kal emelik az
aktivációt" típusú számok onboarding-gyártók önpublikált marketingjéből származnak,
módszertan nélkül — szándékosan kihagyva.

## 7. Codebase terrain

Forrás: investigator recon, szűrve. Útvonalak a worktree gyökerétől.

**Az S1 motor, amit másolunk:**
- `frontend/src/features/tutorial/registry/types.ts:3-25` — a teljes megengedett tartalom-modell:
  `KalauzTier = 'T1'|'T2'|'T3'` (nincs `T0`), négy `OrbState`, `KalauzArt = ClayIconName | ClaySpotName`,
  öt kártya-fajta. A `fogalom` ma **inline** `term: string; def: string`.
- `registry/fuel.ts:3-46` — az egyetlen leszállított kalauz; a literális sablon (`**bold**` a
  `voice`-ban, `effect` a chipeken).
- `registry/index.ts:8-16` — `findKalauz` az **első** `matchPath({path, end:true})` találatot adja
  vissza (sorrend-érzékeny, ha két entry ugyanarra a route-ra mutat).
- `shared/ui/kalauz/KalauzSheet.tsx:20-25` (a szándékosan újradeklarált kártya-unió), `:40`
  (a `s-` prefix dönti el, `ClaySpot` vagy `ClayIcon` renderel — sose adj át olyan nevet, ami
  nincs a `clay/index.tsx` unióiban), `:49-56` (`measureAnchor`, a `.phone-screen`-hez mérve),
  `:64` (`anchorPresent` kapu), `:131-136` (a fogalom-doboz `term`/`def` renderje).
- `registry.test.ts:7` (tiltott-tő regex), `:16-24` (route-létezés + egyedi id + `version ≥ 1`),
  `:26-34` (≤ 2 mondat, ≤ 25 szavas `def`).

**A hub-oldalak, amiket a szöveg leír** (a kalauz-copy forrása a feature-doc, nem a kód):
- `/nap` → `features/today/pages/NapHubPage.tsx` — arc-ágas (`:272` reggel, `:321` nap, `:385` este),
  `questTile`/`checkTile` (`:127`, `:145`) **minden** arcban renderel. Dokumentáció:
  `docs/features/today.md`, `needs.md` (Életjel), `habit.md` (rutin), `intention.md` (kreed),
  `ritual.md` (Napzárás).
- `/train` → `features/train/pages/EdzesHubPage.tsx` — a hős hat számított variáns, egyszer
  renderelve (`:302`); alatta hat csempe (Heti / Mezociklus / Sport / Futás / Gyakorlatok / Medálok).
  Dok: `docs/features/train.md`.
- `/fuel` → `features/fuel/pages/FuelMaiPage.tsx:120-155`. Dok: `docs/features/fuel.md`.
- `/mezo` → `features/insights/pages/MezoHubPage.tsx:148-156` orb-hős, `:160-165` chat-nyitó,
  `:167-199` minta-döntéskártya, `:203-226` mozaik, `:229+` memória-sáv.
  Dok: `docs/features/insights.md`, `companion.md`, `character.md`.
- `/me` → `features/me/pages/EnHubPage.tsx:183-217` identitás-hős (XP-gyűrű, szint, cím, streak,
  érme), `:108-140` cél-kártya, `:223-236` mozaik. Dok: `docs/features/me.md`, `growth.md`, `journal.md`.

**Art-leltár:** `shared/ui/clay/index.tsx:14-33` — 48 ikon, 22 spot. **Nincs `s-nap` / `s-mezo` /
`s-en` spot**, tehát a hub-kártyák ikonokból építkeznek (`i-nap`, `i-mezo`, `i-emberek`,
`i-eletjel`, `i-minta`, `i-meso`, `i-growth`, `i-erme`, `i-checkin`, `i-idozito` …) és a meglévő
spotokból (`s-reggel`, `s-este`, `s-energia`, `s-edzes`, `s-hajtas`, `s-medal`, `s-orb*`).
**Új art nem születik ebben a szeletben** — ha kellene, előbb a `docs/design_2.0/assets/`
sprite-okba kell landolnia (`clay/index.tsx:1-8`).

**Követendő minták:** registry-per-tab, tiszta adat, semmi React; modul-szintű HU copy-tábla
provenance-kommenttel (`HowItWorksView.tsx:13-20`, `me/logic/sleepEducation.ts:11+`).

## 8. Tesztelés

**Registry-lint bővítés** (`registry.test.ts`):
- minden `fogalom`-kártya feloldott `term`/`def`-je megegyezik egy `FOGALMAK`-bejegyzéssel;
- nincs árva `FOGALMAK`-kulcs (minden kulcsot hivatkoz legalább egy kártya) — ez tartja
  betartatva az S2a-4 YAGNI-döntést;
- minden `kapcsolat`-chip `to`-ja létező route (`matchRoutes`), nem csak az entry `route`-ja;
- a meglévő hang-lint és `def ≤ 25 szó` kapu változatlanul fut az új szövegeken.

**Per-hub anchor-teszt** (új): mind az öt hubot renderelve létezik a saját
`[data-kalauz-anchor]`-ja. A `/nap` esetében mindhárom arcra, a `/train` esetében a hős
elérhető variánsaira — ez fogja el, ha egy variánsról lemarad az attribútum.

**Teszt-fallout — `seedAllKalauzSeen()`.** Az öt új T1 kalauz miatt minden `AppLayout`-ot mountoló
hub-route auto-felugró sheetet kap 600 ms után. Érintett fájlok:
`app/navigation.test.tsx`, `app/notificationRoutes.test.tsx`, `app/hubHeaders.test.tsx`,
`features/train/pages/train.nav.test.tsx`, `features/train/pages/train.emptyStates.test.tsx`,
`features/insights/pages/insights.nav.test.tsx`. Mindegyik `beforeEach`-e a helperre áll,
ami a `KALAUZ_REGISTRY`-ből *generálja* a teljes progress-mapet — nem duplikálja a tartalmat,
és az S3 kalauz-hulláma nem töri újra.

A dedikált `TutorialProvider.test.tsx` **nem** seedel — az továbbra is a valódi auto-open utat
gyakorolja (fake timerek `shouldAdvanceTime`-mal, StrictMode-iker render minden auto-open ághoz).

**Két header-teszt szándékosan törik és átíródik:**
- `hubHeaders.test.tsx:36-44` azt asszerteli, hogy `/nap`, `/train`, `/mezo`, `/me` fejlécén
  `labels[0] === 'Napszak váltása'` — pontosan az a négy hub, ami most kalauzt kap. A `?`
  megjelenésével ez a `/fuel`-ág (`:46-53`) alakjára áll át.
- `AppHeader.test.tsx:73-80` („kalauz nélküli oldalon nincs ? gomb") a `/mezo`-t használja
  ellenpéldának — más, kalauz nélküli route kell (pl. `/nap/rutin`).

**Vizuális goldenek:** `tests/visual/visual.spec.ts:97-102` ma egyetlen `fuel` bejegyzést seedel
egy `page.addInitScript` törzsében. Az init-script a böngészőben fut, tehát **nem** importálhatja
a registry-t; a mapet a Node-oldali teszt-fájl számolja ki (a helper `KALAUZ_REGISTRY`-ből
generáló felét importálva), és `addInitScript` **argumentumaként** adja át — a mai `theme`
argumentum mellé. A `SCREENS` listában több hub is szerepel, ezek különben sheettel a képen
készülnének. A Linux-baseline-ok az `update-visual-baselines.yml` workflow-val frissülnek, ha a
`?` gomb miatt szükséges.

Ezért a helper két exportot ad: egy tiszta `buildAllSeenProgress()`-t (Node-ból és böngészőből
egyaránt hívható, adatot ad vissza) és a `seedAllKalauzSeen()`-t, ami ezt írja a
`localStorage`-ba a Vitest-tesztekben.

**Kapuk:** `VITE_USE_MOCK=true pnpm test` **és** `VITE_USE_MOCK=false pnpm test` + `pnpm build`.
A registry/lint tesztek mód-függetlenek, a hub- és shell-tesztek nem. Backend nem érintett.

## 9. Dokumentáció

- `docs/features/tutorial.md`: §7 (a recept mostantól a szótárt is említi), §9 (a
  „`fogalmak.ts` deliberately not built yet — YAGNI until a second `fogalom` term appears"
  bekezdés kikerül; a „Deferred to later slices" sor a welcome-ra szűkül), §10 fájltérkép.
- `docs/CODEMAP.md` regenerálva **ugyanabban a commitban** (`node scripts/gen-codemap.mjs`) —
  a `tutorial` blokk ma „root: TutorialProvider.tsx, fuel.ts, index.ts, types.ts" listát mutat
  (`docs/CODEMAP.md:1142-1143`), az öt új fájl ezt megváltoztatja, és a CI `--check` kapuja bukik nélküle.
- A szülő-spec két elavulása javítva ugyanitt (ma hazudik):
  `2026-09-02-mezo-kalauz-tutorial-design.md:98` a localStorage-kulcsot `mezo.kalauz.<userId>`-nak
  írja, a kód `mezo.kalauz.v1` user-prefix nélkül (`shared/lib/tutorialSeen.ts:9`); a `:109` sor
  `markSeen`-t tartalmazó context API-t ír le, a leszállított API
  `{ current, openId, open, close(reason, step), isUnseen, resetAll }` (`TutorialProvider.tsx:23-30`).

## 10. Nyitott kérdések

1. **Napszak-váltó láthatósága** (szülő-spec §13.1) — a kód minden route-on rendereli
   (`AppHeader.tsx:98`), a design szerint Nap-only. Az S2a-t **nem** blokkolja: egyik hub-kártya
   sem állít semmit a napszak-váltó *gombról* (a `napszak` fogalom magáról a napszakról szól,
   nem a fejléc-vezérlőről). Az S2b welcome 5. lépése viszont pontosan ezen ül, és ott el kell dőlnie.
2. **A welcome → `/nap` hub-kalauz lánc** (S2b) — a NN/G taxonómia ellenzi. Az S2a azzal, hogy
   a `/nap` kalauzt önállóan, kontextusban szállítja, nyitva hagyja mindkét utat: a welcome
   végén auto-felugorhat, vagy egyszerűen a `?` mögött várhat.
3. **localStorage user-prefix** (szülő-spec §13.2) — a multi-user szelet dolga, változatlanul.
