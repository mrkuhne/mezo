# Emberek S3 — csempés hub UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Az egyoldalas PeoplePage helyett a jóváhagyott `emberek.html` prototípus hub→aloldal IA-ja: hub-mozaik egy képernyőn + A köröm / Említések / Heti kép / részletek teljes oldalak, S1–S2 élő adataira, 1:1 vizuális hűséggel.

**Architecture:** A WeekHub-precedens szerint a hub (`/me/people`) csempéi testvér-route-okra navigálnak (`/me/people/kor`, `/me/people/emlitesek`, `/me/people/heti`, `/me/people/jeloltek` stub, `/me/people/:id` részletek). Minden derivált adat (heti ritmus, tónus-mix, irány, kontextus-bontás, hét pillanata, csendben maradtak) egy tiszta `peopleDerive.ts` logic-modulban él; a vizuális meta (tónus/kontextus/forrás színek-ikonok-címkék) egy `peopleVisuals.ts` konstans-modulban. A CSS a meglévő `ppl-` család bővítése a prototípusból ×1,18 skálával, `--mz-*`/új `--ppl-*` tokenekkel.

**Tech Stack:** React + TypeScript, react-router (testvér-route-ok), TanStack Query dual-mode (`usePeople`), Mozaik-primitívek (`MozaikPage/PageHead/PageHero/PageBody`, `StatStrip/StatCell`, `EntranceGroup`, `ClayIcon`), Vitest + MSW.

**bd issue:** `mezo-06o0.2` (parent: mezo-06o0). Branch: `feat/emberek-s3-hub-ui`.

## Global Constraints

- **1:1 hűség** a prototípushoz (`docs/design_2.0/prototypes/src/emberek-head.html` a CSS-forrás, `emberek-body.html` a DOM/viselkedés-forrás): színek, gradiens-stopok, méretek, árnyékok, motion-időzítések verbatim; **px-értékek ×1,18-cal skálázva** (330→390 viewport). Eltérés csak ott, ahol valós adat/kontraktus kényszeríti — a PR-ben jelezve.
- **Nincs inline szín-literál** — minden szín token (`--mz-*` vagy az e tervben definiált `--ppl-*` család); minden új `--ppl-*` token MINDKÉT `:root` blokkban (light + dark) deklarálva (a `mozaikCssTokens.test.ts` guard buktat, ha csak az egyikben).
- A `prototype.css`-ben a Mozaik-szekció a Today-szekció ELŐTT marad (a `todayCssTokens.test.ts` pinning); az új `ppl-` szabályok a meglévő ppl-szekcióba/annak folytatásába kerülnek.
- Minden `.rise` elemnek `EntranceGroup` ős kell (különben némán statikus); minden végtelen animáció `prefers-reduced-motion: reduce` guarddal.
- Ikonok: kizárólag clay sprite (`ClayIcon`/`ClaySpot` a `@/shared/ui/clay`-ből), emoji sehol. Használt symbol-ok: `i-emberek`, `i-kristaly`, `i-naplo`, `i-mezo`, `i-heti`, `i-mikrofon`.
- **Becsületes állapotok (spec §5)**: tone-nélküli automata mention → semleges jelzés + láb-jegyzet („az éjszakai kör tölti"); üres jelölt-inbox → „Nincs több jelölt — az éjszakai kör hajnalban néz újra."; szűrésre üres feed → „Erre a szűrésre nincs említés — próbáld tágabban."; hét említés nélkül → „Csendben maradt", nem vádló hangnem. Null statisztika `—`-t renderel, sosem hamis 0-t.
- Dual-mode szabályok: real mód SOHA nem kap mock seedet (useDualQuery már kezeli); a `{ data = seed } = useQuery` minta tilos (dualMode.guard buktat).
- FE kapu (worktree-ben mindkét mód explicit): `cd frontend && pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test`.
- Commit-subjectek: conventional + bd id, pl. `feat(fe): Emberek hub-mozaik (mezo-06o0.2)`.
- **Szelet-határok**: a Jelöltek oldal S3-ban CSAK az üres állapot (adat/decision-flow = S4); a „Kapcsolt események · gráf" kártya a részleteknél NEM épül meg (S5); a Mezo-észrevétel sáv S3-ban determinisztikus derivált mondat + chat-handoff (companion message kind = S6).
- Enum-térképek (a `peopleVisuals.ts` az egyetlen forrás, Task 1): tónus `positive/neutral/mixed/negative` ↔ prototípus `jo/ok/vegyes/nehez`; kontextus FE `MentionContext` (8 érték: munka, csalad, baratok, edzes, konfliktus, kozos_program, segitseg, egyeb) — a prototípus 6 kulcsa ide képződik (`kozos`→`kozos_program`); forrás FE `MentionSource` (voice/camera/chip/text/chat) — `text`→napló-ikon (`i-naplo`), `chat`→mezo-ikon (`i-mezo`), `chip`→`check` Icon, voice→`mic`, camera→`camera`.

## Fájltérkép

| Fájl | Szerep |
|---|---|
| `frontend/src/features/me/logic/peopleVisuals.ts` (új) | TONE_META / CTX_META / SRC_META (szín-token-név, magyar címke, ikon) |
| `frontend/src/features/me/logic/peopleDerive.ts` (új) | weeklyRhythm, toneMix, directionFor, contextBreakdown, quietPeople, weekMoment, hubLines, trendHeights |
| `frontend/src/features/me/pages/PeoplePage.tsx` | ÁTÍRÁS: hub (statstrip + 4 csempe + Mezo-sáv) |
| `frontend/src/features/me/pages/PeopleKorPage.tsx` (új) | személy-rács (spark + kontextus-pöttyök) |
| `frontend/src/features/me/pages/PersonDetailPage.tsx` (új) | részletek-oldal (statok, hangulat-ív, kontextus-bontás, tények, idővonal, Log most, Szerkesztés) |
| `frontend/src/features/me/pages/PeopleEmlitesekPage.tsx` (új) | hét ritmusa + szűrőchipek + feed + ✕ |
| `frontend/src/features/me/pages/PeopleHetiPage.tsx` (új) | tónus-mix + irányok + hét pillanata + csendben maradt |
| `frontend/src/features/me/pages/PeopleJeloltekPage.tsx` (új) | S3: becsületes üres állapot |
| `frontend/src/features/me/components/PersonCard.tsx` | + spark + ctxdots |
| `frontend/src/features/me/components/MentionRow.tsx` | ÁTÍRÁS a prototípus eml-sorára (srcdisc + mini-avatar + ctxch + tonedot + ✕) |
| `frontend/src/features/me/sheets/PersonDetailSheet.tsx` | TÖRLÉS (a PersonDetailPage váltja) |
| `frontend/src/app/router.tsx` | + 5 route |
| `frontend/src/styles/prototype.css` | ppl-szekció bővítés + `--ppl-*` tokenek mindkét :root-ban |
| `docs/features/me.md`, `docs/CODEMAP.md` | doksi |

## Token-térkép (Task 1 vezeti be, minden későbbi task ezt fogyasztja)

Mindkét `:root` blokkba (light érték = prototípus hex; dark érték = a szomszédos --mz-* tokenek dark-flip mintája szerint, világosított/telítettség-csökkentett változat — a ppl-szekció meglévő dark-kezelését kövesd):

```css
--ppl-tone-jo: #7FA06C;      /* positive */
--ppl-tone-ok: #9C8F80;      /* neutral (a prototípus tonedot 'ok' szürkéje) */
--ppl-tone-vegyes: #C9962E;  /* mixed */
--ppl-tone-nehez: #C4694F;   /* negative */
--ppl-ctx-munka: #4E8FB8;
--ppl-ctx-csalad: #8FAF7E;
--ppl-ctx-baratok: #C46FA0;
--ppl-ctx-edzes: #FF7A55;
--ppl-ctx-konfliktus: #C4694F;
--ppl-ctx-kozos: #C46FA0;
--ppl-ctx-segitseg: #6C5FA3;
--ppl-ctx-egyeb: #9C8F80;
```

(A prototípus JS `TONES`/`CTX` objektumaiból; `baratok`/`egyeb` a FE-többlet — a rose/szürke rokonszínt kapják. Ha a pontos hexek a prototípus szkriptjében minimálisan eltérnek, a prototípus értéke nyer — olvasd ki onnan.)

---

### Task 1: peopleVisuals + peopleDerive logic-modulok

**Files:**
- Create: `frontend/src/features/me/logic/peopleVisuals.ts`
- Create: `frontend/src/features/me/logic/peopleDerive.ts`
- Modify: `frontend/src/styles/prototype.css` (csak a `--ppl-*` tokenek, mindkét :root)
- Test: `frontend/src/features/me/logic/peopleDerive.test.ts`

**Interfaces:**
- Consumes: `Mention`, `PersonEntry`, `Affect`, `MentionContext`, `MentionSource` a `@/data/types`-ból; `IconName` a `@/shared/ui/Icon`-ból.
- Produces (a későbbi taskok pontosan ezeket importálják):

```ts
// peopleVisuals.ts
export interface ToneMeta { label: string; cssVar: string }            // pl. { label: 'Jó', cssVar: '--ppl-tone-jo' }
export const TONE_META: Record<Affect, ToneMeta>
export const TONE_ORDER: Affect[]                                      // ['negative','mixed','positive','neutral'] — "legrosszabb elöl" a ritmus-oszlop színéhez
export interface CtxMeta { label: string; cssVar: string }             // pl. { label: 'munka', cssVar: '--ppl-ctx-munka' }
export const CTX_META: Record<MentionContext, CtxMeta>
export interface SrcMeta { label: string; clay?: 'i-naplo' | 'i-mezo'; icon?: IconName }  // text/chat → clay; chip/voice/camera → Icon
export const SRC_META: Record<MentionSource, SrcMeta>                  // text:{label:'napló',clay:'i-naplo'}, chat:{label:'Mezo-chat',clay:'i-mezo'}, chip:{label:'kézi',icon:'check'}, voice:{label:'hang',icon:'mic'}, camera:{label:'kamera',icon:'camera'}

// peopleDerive.ts — mind tiszta függvény, Date-et paraméterként kap (tesztelhetőség)
export interface RhythmDay { label: string; count: number; worstTone: Affect | null; isToday: boolean }
export function weeklyRhythm(mentions: Mention[], now: Date): RhythmDay[]        // 7 elem, [ma-6 .. ma], label = 'H','K','SZE','CS','P','SZO','V' a nap szerint, az utolsó isToday
export interface ToneSlice { tone: Affect; count: number; pct: number }
export function toneMix(mentions: Mention[]): ToneSlice[]                        // csak a tone-os sorokból; üres → []
export type Direction = 'up' | 'down' | 'flat'
export function directionFor(trend: number[]): Direction                          // utolsó 2 átlaga vs. előző pontok átlaga; |diff| < 0.4 → 'flat'; <3 pont → 'flat'
export interface CtxSlice { ctx: MentionContext; count: number; pct: number }
export function contextBreakdown(mentions: Mention[]): CtxSlice[]                 // contextLabel-es sorokból, pct = count/összes címkézett, csökkenő; üres → []
export function quietPeople(people: PersonEntry[]): PersonEntry[]                 // mentionsThisWeek === 0
export function weekMoment(weekMentions: Mention[]): Mention | null               // determinisztikus: első flagged; különben első negative/mixed tone-ú; különben a leghosszabb excerptű; üres → null
export function trendHeights(trend: number[], maxPx: number): number[]            // 1–5 skálát px-magasságokra: v/5*maxPx, kerekítve; üres → []
export interface HubLines { mentionsThisWeek: number; topName: string | null; downName: string | null; upName: string | null; flagCount: number }
export function hubLines(people: PersonEntry[], mentions: Mention[], now: Date): HubLines
// topName = legtöbb mentionsThisWeek (szám szerint, döntetlennél név ABC); downName/upName = az első 'down'/'up' irányú személy (directionFor(affectTrend)), nincs → null; flagCount = e heti flagged mentionök
```

- [ ] **Step 1: Failing tesztek** (`peopleDerive.test.ts`) — táblázatos esetek, kézzel számolt elvárásokkal:

```ts
// weeklyRhythm: 3 mention (ma: positive+negative, tegnapelőtt: mixed), now=2026-08-31 (hétfő):
//   → 7 elem; utolsó: {count:2, worstTone:'negative', isToday:true}; [4]: {count:1, worstTone:'mixed'}; többi count:0, worstTone:null
//   → a 8 napnál régebbi mention nem számít
// toneMix: [positive, positive, negative, tone:undefined] → [{positive,2,67},{negative,1,33}] (pct kerekítve, undefined kimarad)
// directionFor: [3,3,3,4,5] → 'up'; [4,4,3,2] → 'down'; [3,3,3,3] → 'flat'; [4] → 'flat'; [] → 'flat'
// contextBreakdown: [munka, munka, edzes, undefined] → [{munka,2,67},{edzes,1,33}]
// weekMoment: flagged nyer; flagged nélkül a negative; anélkül a leghosszabb excerpt; [] → null
// trendHeights: [5,1] maxPx 42 → [42, 8]
// hubLines: topName számítás + döntetlen ABC; downName az affectTrend [4,4,2,2]-s személy; flagCount csak e hét
```

- [ ] **Step 2: Futtatás — bukik.** Run: `pnpm --dir frontend test -- peopleDerive` → FAIL (modul nincs).
- [ ] **Step 3: Implementáció** a fenti szignatúrákkal; `weeklyRhythm` nap-label: `['V','H','K','SZE','CS','P','SZO'][d.getDay()]`; worstTone a TONE_ORDER első jelenlévő eleme.
- [ ] **Step 4: Tokenek** a `prototype.css` MINDKÉT `:root` blokkjába (a fenti Token-térkép; a hexeket a prototípus `TONES`/`CTX` JS-objektumaiból ellenőrizd). Run: `pnpm --dir frontend test -- mozaikCssTokens` → PASS.
- [ ] **Step 5: Zöld + commit.** Run: `pnpm --dir frontend test -- peopleDerive` → PASS.

```bash
git add frontend/src/features/me/logic/peopleVisuals.ts frontend/src/features/me/logic/peopleDerive.ts frontend/src/features/me/logic/peopleDerive.test.ts frontend/src/styles/prototype.css
git commit -m "feat(fe): people derive + visuals logic-modulok, ppl tokenek (mezo-06o0.2)"
```

---

### Task 2: Route-váz + PeoplePage → hub

**Files:**
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/features/me/pages/PeoplePage.tsx` (teljes átírás hubbá)
- Create: `frontend/src/features/me/pages/PeopleJeloltekPage.tsx` (üres állapot)
- Modify: `frontend/src/styles/prototype.css` (hub-szekció: facepile, badge, hub-csempe variánsok, Mezo-sáv)
- Test: `frontend/src/features/me/pages/PeoplePage.test.tsx` (átírás)

**Interfaces:**
- Consumes: `usePeople()` (`people, mentions, isPending`), `hubLines`/`directionFor` (Task 1), `MozaikPage/PageHead/PageHero/PageBody`, `StatStrip/StatCell`, `EntranceGroup`, `ClayIcon`, `useChatHandoff` (`@/features/me/logic/useChatHandoff` — nézd meg a szignatúrát és úgy hívd, ahogy a meglévő fogyasztói).
- Produces: route-ok — `me/people` (hub), `me/people/jeloltek`, és Task 3–5 oldalainak helye; a hub csempéi `navigate('/me/people/<slug>')`-ot hívnak (WeekHub-minta: testvér-oldal, nem lokális show/hide).

- [ ] **Step 1: Failing tesztek** (PeoplePage.test.tsx átírás, MemoryRouter + createMemoryRouter ahol navigációt assertálsz):
  - hero: `Kapcsolatok` név + aktív személyek száma bignumként + `N említés e héten` sub;
  - statstrip 3 cellája: `N említés · hét`, top név `legtöbbet említett`, down név `↘ hangulat-lejtő` (nincs down → `—`);
  - 4 csempe: Jelöltek (S3-ban badge nélkül), A köröm (facepile: első 4 személy iniciáléja), Említések (flagCount badge, ha >0), Heti kép — mindegyik kattintásra a saját route-jára navigál;
  - Mezo-sáv: derivált mondat renderel, kattintásra chat-handoff (a useChatHandoff meglévő teszt-mintája szerint assertálva);
  - Jelöltek csempe → `/me/people/jeloltek` → az üres állapot szövege: `Nincs több jelölt — az éjszakai kör hajnalban néz újra.`
- [ ] **Step 2: Futtatás — bukik.** Run: `pnpm --dir frontend test -- PeoplePage`
- [ ] **Step 3: Router.** A `me/people` mellé (elé!) regisztráld: `me/people/jeloltek`, `me/people/kor`, `me/people/emlitesek`, `me/people/heti`, `me/people/:id` — a statikus path-ok a `:id` ELŐTT. A Task 3–5 oldalakig a kor/emlitesek/heti route-ok még nem léteznek — CSAK a jeloltek + hub kerül be most, a többit a saját taskja adja hozzá (ne csinálj stub-komponenseket).
- [ ] **Step 4: Hub-implementáció.** `MozaikPage tone="rose"` → `PageHead onBack={() => navigate('/me')} label="‹ Én"` + jobb-akciók: `Log` (PersonLogSheet nyitás — a mai PeoplePage mintája) és `＋ Új személy` (PersonEditSheet); `PageHero icon=i-emberek big={people.length} name="Kapcsolatok" sub={...}`; `PageBody` + `EntranceGroup`: `StatStrip` (3 `StatCell`), majd a mozaik. A 4 csempe saját `ppl-hub*` variáns-osztályokkal épül (a WeekHub `wkh-` precedense: a generikus `Tile` nem tudja a facepile-t/tile-line-t) — a prototípus `.tile/.t-gold/.t-rose/.t-sky/.t-lav/.tile-line/.spotwrap/.badge/.facepile` szabályait portold `ppl-hub-tile/ppl-hub-{gold|rose|sky|lav}/ppl-hub-line/ppl-hub-spot/ppl-hub-badge/ppl-facepile` néven, ×1,18, tokenekkel (a wash-hátterek: a legközelebbi `--mz-wash-*`/`--mz-cell-*` tokenek; badge-pulse keyframe reduced-motion guarddal). Mezo-sáv: `.hwide/.snip` → `ppl-hub-wide/ppl-hub-snip`; mondata: ha van down-irányú személy → `„<név> hangulata lejt az utóbbi hetekben — ránézel?"`, különben ha van top → `„<top> volt e héten a legtöbbet veled — jó ránézni, mit adott."`, különben az üres-kör mondat `„Ahogy írsz, magától épül itt a kapcsolati kép."`.
- [ ] **Step 5: JeloltekPage.** `MozaikPage tone="gold"` + `PageHead onBack → /me/people label="‹ Kapcsolatok"` + `PageHero icon=i-kristaly big={0} name="Jelöltek"` + `PageBody`: a prototípus `.empty9` üres-kártyája (`ppl-empty` osztályként portolva) a becsületes mondattal + `.foot9`→`ppl-foot` lábjegyzet („Az éjszakai kör ismeretlen, visszatérő neveket figyel — innen egy koppintással felveheted őket."). Semmi más — az adat-flow S4.
- [ ] **Step 6: Zöld + kapu.** Run: `pnpm --dir frontend test -- PeoplePage` PASS, majd `pnpm --dir frontend build`.
- [ ] **Step 7: Commit** — `feat(fe): Emberek hub-mozaik + jelölt üres-oldal (mezo-06o0.2)`

---

### Task 3: A köröm oldal + PersonCard spark/ctxdots

**Files:**
- Create: `frontend/src/features/me/pages/PeopleKorPage.tsx`
- Modify: `frontend/src/features/me/components/PersonCard.tsx`
- Modify: `frontend/src/app/router.tsx` (+ `me/people/kor`)
- Modify: `frontend/src/styles/prototype.css` (ppl-spark, ppl-ctxdots + a meglévő ppl-tile kiegészítései)
- Test: `frontend/src/features/me/pages/PeopleKorPage.test.tsx`, `PersonCard` esetei a meglévő teszt-fájlában

**Interfaces:**
- Consumes: `usePeople()`, `trendHeights`/`contextBreakdown`/`CTX_META` (Task 1), Mozaik-primitívek.
- Produces: `PersonCard` új propok: `spark?: number[]` (px-magasságok), `ctxDots?: MentionContext[]` (max 3); kattintás → `navigate('/me/people/' + person.id)` (a mai onClick-sheet helyett — a hívó adja).

- [ ] **Step 1: Failing tesztek.** KorPage: rács renderel minden személyt; kártyán a `N× e héten · N említés` sor; kattintás a személy route-jára navigál; személy spark-ja annyi `<i>` elem, ahány affectTrend-pont (üres trend → nincs spark-konténer); ctxdots max 3 pötty a személy mentionjeinek kontextus-bontásából. PersonCard: spark/ctxDots prop nélkül nem renderel üres konténert.
- [ ] **Step 2: Futtatás — bukik.**
- [ ] **Step 3: Implementáció.** KorPage: `MozaikPage tone="rose"` + `PageHead ‹ Kapcsolatok` + `＋ Új személy` akció (PersonEditSheet — a hub mellett itt is, a prototípus newBtn2-je szerint) + `PageHero icon=i-emberek big={people.length} name="A köröm"` + `PageBody`+`EntranceGroup`: `ppl-grid` a PersonCard-okkal. PersonCard: a `.pspark/.pspark i` + `.ctxdots/.ctxdots i` prototípus-szabályok portja `ppl-spark/ppl-ctxdots` néven (×1,18; `sparkup` keyframe scaleY-growth, reduced-motion guard; pötty-színek `CTX_META[ctx].cssVar`); spark = `trendHeights(person.affectTrend, 19)` (16px×1,18≈19), opacity-rámpa a prototípus szerint. A ctxDots forrása: `contextBreakdown(personMentions).slice(0,3).map(s => s.ctx)`.
- [ ] **Step 4: Zöld + commit** — `feat(fe): A köröm oldal — személy-rács spark-kal és kontextus-pöttyökkel (mezo-06o0.2)`

---

### Task 4: PersonDetailPage (a sheet kivezetése)

**Files:**
- Create: `frontend/src/features/me/pages/PersonDetailPage.tsx`
- Delete: `frontend/src/features/me/sheets/PersonDetailSheet.tsx` + `PersonDetailSheet.test.tsx`
- Modify: `frontend/src/app/router.tsx` (+ `me/people/:id`)
- Modify: `frontend/src/styles/prototype.css` (ppl-det szekció: trendcard/ctxcard/factcard/avat-lg/affbars/ctxbar)
- Test: `frontend/src/features/me/pages/PersonDetailPage.test.tsx`

**Interfaces:**
- Consumes: `usePeople()`, `trendHeights` (maxPx 50 = 42×1,18), `contextBreakdown`, `weekMoment` NEM (az a heti), `TONE_META/CTX_META/SRC_META`, `PersonLogSheet` (Log most), `PersonEditSheet` (Szerkesztés), `useParams`.
- Produces: a `/me/people/:id` oldal; a KorPage/HetiPage `navigate`-je ide mutat.

- [ ] **Step 1: Failing tesztek.** Ismeretlen id → visszanavigál `/me/people/kor`-ra (isPending alatt NEM — a query-guard szabály: pending ≠ hiányzó adat!); hero: avatar-iniciálé + név + `kapcsolat · cadence` sub; statstrip magyarul: `összes` / `e héten` / `hangulat` (a hangulat cellája az affect_baseline magyar címkéje a TONE_META-ból, nincs → `—`); hangulat-ív: affectTrend-pontonként egy oszlop (üres → a kártya helyén `—`-os üres állapot); „Milyen helyzetekben": kontextus-sávok pct-vel (címkézett mention nélkül a kártya kimarad); „Amit Mezo tud": knownFacts pillek (üres → kimarad); idővonal: a személy mentionjei (max 8) tonedot-tal — tone-nélküli sor semleges pöttyöt kap ÉS a lista alján a lábjegyzet: `A tónust az éjszakai kör tölti.` (csak ha van tone-nélküli sor); `Log most` gomb PersonLogSheet-et nyit előre kiválasztott személlyel; `Szerkesztés` PersonEditSheet-et nyit; NINCS „Kapcsolt események" szekció (S5).
- [ ] **Step 2: Futtatás — bukik.**
- [ ] **Step 3: Implementáció.** `MozaikPage tone="rose"` + `PageHead onBack={() => navigate(-1)} label="‹ A köröm"` + jobb-akció `Szerkesztés`; hero kézzel (a WeekHub-precedens: PageHero convenience, nem kötelező): `ppl-avat-lg` (58px×1,18≈68) + név + sub. Kártyák: a prototípus `.trendcard/.affbars/.affax/.ctxcard/.ctxbar/.factcard/.fact` szabályai `ppl-trendcard/ppl-affbars/ppl-affax/ppl-ctxcard/ppl-ctxbar/ppl-factcard/ppl-fact` néven ×1,18 (affbars magasság-skála `trendHeights(trend, 50)`; ctxbar sáv-szélesség `--w` custom prop, szín `CTX_META`). Idővonal-sor: az átírt MentionRow-t még NE használd (Task 5) — a prototípus det-idővonal sora egyszerűbb (`srcb`+idő+tonedot+ctxch+idézet): építsd lokális `DetTimelineRow` komponensként a fájlban a `ppl-mrowt` meglévő osztályaira. Sheet-integrációk a mai PeoplePage-ből költöznek (detailPerson state törlődik onnan).
- [ ] **Step 4: PersonDetailSheet törlés** + minden importőr frissítése (grep `PersonDetailSheet`).
- [ ] **Step 5: Zöld + commit** — `feat(fe): személy-részletek oldal a sheet helyett (mezo-06o0.2)`

---

### Task 5: Említések oldal + MentionRow átírás

**Files:**
- Create: `frontend/src/features/me/pages/PeopleEmlitesekPage.tsx`
- Modify: `frontend/src/features/me/components/MentionRow.tsx` (átírás a prototípus sorára)
- Modify: `frontend/src/app/router.tsx` (+ `me/people/emlitesek`)
- Modify: `frontend/src/styles/prototype.css` (ppl-rhythm szekció + mrowt-bővítés: srcdisc, mini-avat, ctxch, tonedot-wash)
- Test: `frontend/src/features/me/pages/PeopleEmlitesekPage.test.tsx` + MentionRow teszt-frissítés

**Interfaces:**
- Consumes: `usePeople()` (`mentions, undoMention`), `weeklyRhythm`, `TONE_META/CTX_META/SRC_META`, Mozaik-primitívek.
- Produces: `MentionRow` új prop-felülete: `{ mention: Mention; person?: PersonEntry; onUndo?: (m: Mention) => void; delayMs?: number }` — tone-wash osztály (`ppl-tw-{jo|vegyes|nehez}` a TONE_META kulcsból, neutral/nincs → nincs wash), forrás-korong, mini-avatar iniciáléval, kontextus-chip, FIGYELEM pulse, ✕ csak automata forráson.

- [ ] **Step 1: Failing tesztek.** Oldal: „A hét ritmusa" 7 oszlop (a mai nap jelölt; szín a nap legrosszabb tónusából; üres nap alacsony sáv); szűrőchipek: Mind/Hét scope (set), Jó/Nehéz tónus (toggle — aktívra kattintva kikapcsol), 4 kontextus-chip (toggle); szűrt üres → `Erre a szűrésre nincs említés — próbáld tágabban.`; automata soron ✕ → undoMention hívódik; tone-nélküli sor: nincs wash, semleges jelzés, és az oldal lábjegyzete jelzi az éjszakai kört (csak ha van ilyen sor). MentionRow: wash-osztály a tónusból; forrás-korong text→naplóikon, chat→mezoikon; FIGYELEM csak flagged-en.
- [ ] **Step 2: Futtatás — bukik.**
- [ ] **Step 3: Implementáció.** Oldal: `MozaikPage tone="sky"` + `PageHead ‹ Kapcsolatok` + `Log` akció + `PageHero icon=i-naplo big={heti szám} name="Említések"` + `PageBody`+`EntranceGroup replayKey={szűrő-állapot}` (a prototípus replay-e szűrőváltásra = replayKey-váltás). Ritmus: a `.rhythm/.rcols/.rcol/.bar/.rax` szabályok `ppl-rhythm/ppl-rcols/ppl-rcol/ppl-rbar/ppl-rax` néven ×1,18 (oszlop-magasság: 9px + count*15px, üres 4px — a prototípus 8+n*13 és 3 ×1,18-cal). Szűrő-state: `{ scope: 'mind'|'het', tone: Affect|null, ctx: MentionContext|null }`. Chipek a meglévő `ppl-fchip` osztályokon + `cdot` színpötty (`ppl-fchip-dot`, CTX/TONE_META szín). MentionRow: a meglévő `ppl-mrowt` szerkezet bővül — `ppl-srcdisc` (26px korong, clay/Icon), `ppl-mavat` (26px mini-avatar iniciáléval), `ppl-ctxch` (színes chip), `ppl-figy` pulse keyframe (a prototípus `figypulse`-a, reduced-motion guard), wash-osztályok `ppl-tw-*` (a prototípus `.mrowt.tw-*` háttér-gradiensei tokenizálva). A ✕ (`ppl-mundo`) marad az S2-es viselkedéssel.
- [ ] **Step 4: Zöld + commit** — `feat(fe): Említések oldal — hét ritmusa, szűrők, tónus-washed sorok (mezo-06o0.2)`

---

### Task 6: Heti kép oldal

**Files:**
- Create: `frontend/src/features/me/pages/PeopleHetiPage.tsx`
- Modify: `frontend/src/app/router.tsx` (+ `me/people/heti`)
- Modify: `frontend/src/styles/prototype.css` (ppl-heti szekció: tonemix, dirgrid, momentt, quiett)
- Test: `frontend/src/features/me/pages/PeopleHetiPage.test.tsx`

**Interfaces:**
- Consumes: `usePeople()`, `toneMix`/`directionFor`/`quietPeople`/`weekMoment`/`trendHeights`, `TONE_META`, Mozaik-primitívek, `PersonLogSheet` (a „Csendben maradt" sor `Írok neki` → Log sheet előre kiválasztott személlyel — a prototípus toast-ja helyett ez a valós akció).
- Produces: a `/me/people/heti` oldal.

- [ ] **Step 1: Failing tesztek.** Tónus-mix: rakott sáv szeletei a heti tónus-arányokból + jelmagyarázat (`N jó` …); tone-os heti mention nélkül a kártya helyén becsületes sor (`Még nincs tónusozott említés ezen a héten.`); Irányok: csak heti-említéses személyek, sorrend ↘, ↗, → (down elöl), kártyán nyíl + spark + `N× E HÉTEN`, kattintás a személy oldalára; „A hét pillanata": a weekMoment mention idézete (nincs → a szekció kimarad); „Csendben maradt": mentionsThisWeek===0 személyek, `Írok neki` → PersonLogSheet az adott személlyel (nincs csendes → a szekció kimarad).
- [ ] **Step 2: Futtatás — bukik.**
- [ ] **Step 3: Implementáció.** `MozaikPage tone="lav"` + `PageHead ‹ Kapcsolatok` + `PageHero icon=i-heti big={heti mention szám} name="Heti kép"`. CSS-port ×1,18: `.tonemixc/.tonemix/.mixleg` → `ppl-tonemixc/ppl-tonemix/ppl-mixleg` (`mixgrow` scaleX keyframe guarddal), `.dirgrid/.dirt/.arr2/.why2/.wk` → `ppl-dirgrid/ppl-dirt(.up/.down)/ppl-arr2/ppl-why2/ppl-wk`, `.momentt/.bigq` → `ppl-momentt/ppl-bigq` (Fraunces-idézet — a display-font tokent használd, ahogy a prototípus), `.quiett/.nm3/.q3` → `ppl-quiett/ppl-qnm/ppl-qtx`. A `why` sor (irány-ok magyarázat) S3-ban determinisztikus: `„többször nehéz tónus"` ha a személy heti mentionjei közt negative többség, `„sok jó pillanat"` ha positive többség, különben `„változó hetek"` — az LLM-prózát S4 hozza (jelezd kommentben).
- [ ] **Step 4: Zöld + commit** — `feat(fe): Heti kép oldal — tónus-mix, irányok, hét pillanata, csendben maradt (mezo-06o0.2)`

---

### Task 7: Kapuk, doksi, ship

**Files:**
- Modify: `docs/features/me.md` (People-szakasz: hub-IA, oldalak, derive-modul, becsületes állapotok)
- Modify: `docs/CODEMAP.md` (regen: `node scripts/gen-codemap.mjs`)
- Test: teljes kapu

**Steps:**
- [ ] **Step 1:** Teljes FE kapu: `cd frontend && pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test` — zöld; a guard-teszteket külön is: `pnpm --dir frontend test -- mozaikCssTokens prototypeCssStructure dualMode.guard` — zöld.
- [ ] **Step 2:** Élő nézet-ellenőrzés: `pnpm dev` + böngésző 440×956-on — hub → mind a 4 oldal + részletek bejárása, entrance-animációk lejátszódnak (a `.rise`+EntranceGroup csapda vizuális ellenőrzése), dark módban is (tokenek).
- [ ] **Step 3:** `docs/features/me.md` People-szakasz frissítése (S3 valóság; S4/S5/S6 jelölve jövőként), CODEMAP regen.
- [ ] **Step 4:** Commit — `docs(me): Emberek S3 hub-IA dokumentálása + codemap (mezo-06o0.2)`

---

## Self-review

- **Spec §4 lefedés**: hero+mini-cellák (hub statstrip) T2; mozaik 4 csempéje T2 (Jelöltek üres-oldal T2, adat S4); köröm-rács T3; részletek T4 (események-kártya S5-re jelölve, magyar statok igen); Említések T5 (ritmus, chipek, washed kártyák, ✕); Heti kép T6 (tonemix, irányok, pillanat, csendben); Mezo-sáv T2 (derivált mondat, S6 hozza a companion-t); sheetek: meglévő Log/Edit sheetek maradnak; ikonográfia clay-only.
- **Spec §5 becsületes állapotok**: mind lefedve (T2 jelölt-üres, T4/T5 tone-nélküli lábjegyzet, T5 szűrt-üres, T6 csendben maradt + üres-szekciók).
- **Placeholder-szken**: a CSS-portok a prototípus konkrét szelektor-listáira mutatnak ×1,18 szabállyal + token-térképpel — a forrás-értékek a prototípus-fájlban élnek (design-system doktrína szerint az a source of truth); minden derivációnak pontos szabálya van.
- **Típus-konzisztencia**: peopleDerive/peopleVisuals szignatúrák a T2–T6-ban azonosan hivatkozva; MentionRow új prop-felülete T5-ben definiált és csak ott fogyasztott; PersonCard propok T3.
