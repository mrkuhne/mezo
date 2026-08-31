# Edzés-review · kontextus-riport (F7.2)

- **bd:** `mezo-d20.8.2` (design kör) → `mezo-d20.8.2.1` (dev)
- **Prototípus:** [`docs/design_2.0/prototypes/edzes-review.html`](../../design_2.0/prototypes/edzes-review.html)
  ([artifact](https://claude.ai/code/artifact/66f5a4de-8afe-48ff-b04f-e861b3ba22ee))
- **Érintett feature-doc:** [`docs/features/train.md`](../../features/train.md)
- **Vonatkozó ADR-ek:** [0033](../../decisions/0033-mozaik-2-tile-language.md) (Mozaik 2.0),
  [0010](../../decisions/0010-gamified-growth-xp-feedback-not-payment.md) (XP = visszajelzés,
  a riport sosem büntet)

## 1. Mit oldunk meg

A `/train/review/:workoutId` a Design 2.0 utolsó olyan first-class felülete, amelynek **nem volt
tervezői köre**. Az F2.8/F2.9 az élő session-folyamatot tervezte meg, és a `WorkoutSummary` héja
onnan örökölt egy `closed` módot — ami azonban **a lezáráskori riport színcseréje**, nem a
visszanézés saját felülete.

A kör négy konkrét leletre válaszol:

1. **A `closed` mód nem tud semmit, amit a `closing` ne tudna.** Egy három hete volt Pull A
   visszanézése más munka: ott a kérdés az, hogy *mihez képest*, nem az, hogy *mi történt*.
2. **A szett nem olvasható.** A gyakorlat-térkép öt majdnem azonos fehér kártya, mindegyiken egy
   sor csaknem megkülönböztethetetlen chip (`72 × 10 @2` · `72 × 9 @2` · `70 × 10 @1`). A szemnek
   nincs horgonya, és ez a leghosszabb szekció az oldalon.
3. **A `.wsum-*` család (85 szabály) a Design 2.0 *előttről* való** (`mezo-w943`, 2026-08-10):
   lapos pillek, saját 4-cellás sáv, 🏅 emoji medál-korong, semmilyen oldal-tónus, és **nulla
   belépő koreográfia** — az F9 audit „A) egyáltalán nincs belépő koreográfia" osztálya.
4. **Az edzés-jegyzet mező halott.** A `closing` mód `<textarea>`-ja se `value`-t, se `onChange`-et
   nem kap, a `finishWorkout(workoutId, opts)` nem visz jegyzetet, és a `WorkoutDetailResponse`-ban
   nincs `note` mező. Beírod, elveszik.

## 2. A döntés: a visszanézés kontextus-riport

A héj **egy marad, két móddal** — a leltár invariánsai azonosak, és két külön komponens
garantáltan szét fog csúszni. Amit a `closed` mód pluszban kap, az mind **kontextus**:

| Elem | `closing` | `closed` |
|---|---|---|
| Hero, izompirulák, statisztika-sáv, medálok, kihívások, gyakorlat-swimlane, elv-mondat | ✓ | ✓ |
| **„Mihez képest" csempe** | — | ✓ |
| **Léptetés a template-nap láncán** | — | ✓ |
| Gyakorlat-oldal „előzőleg" cellája | — | ✓ |
| Lezáró CTA + „Vissza az edzéshez" | ✓ | — |
| Oldal-tónus | `.mz-p-coral` | `.mz-p-sage` |

**A kör FE-only.** Az összevetés meglévő végpontokon ül: a `WorkoutSummaryResponse` hordozza a
`templateSessionId`-t, tehát a `GET /api/train/workouts?from&to` listából kikereshető az előző
ugyanilyen nap, és a `GET /api/train/workouts/{id}` lehozza a részleteit. Kontraktus-változás
nincs.

## 3. Építőelemek

### 3.1 A „Mihez képest" csempe

`.wr-cmp`, a hero és a statisztika-sáv **között**. Szemöldök `MIHEZ KÉPEST`, alatta a megnevezett
referencia és három delta-cella, pontosan a statstrip celláinak tükrében: **volumen · célszett ·
Ø RIR**. Mindegyik cella alatt ott van a nyers korábbi érték is (`7,5 t volt`), hogy a delta ne
követeljen fejszámolást.

**Referencia:** a **legutóbbi ugyanilyen template-nap**, függetlenül attól, hány hét telt el.
Nem „pontosan egy héttel korábban": ha kimaradt egy hét, attól még van mihez hasonlítani, és
hazugság lenne úgy tenni, mintha heti ritmus lenne.

**A referencia kora a két session távolsága, nem a mához mért kor.** „Előző Pull A · aug. 12. ·
2 héttel korábban" — visszalépve az aug. 12-i napra ugyanez a mondat a júl. 29-iről is helyes,
míg a „2 hete" a mához mérve visszalépés után félreolvasható.

**A delta-hangnem ADR 0010 alatt áll.** A szám mindig előjeles és őszinte (`−0,9 t`), de a *szín*
nem büntet:

- **felfelé** → zsálya (`--mz-cell-sage-ink`),
- **lefelé** → semleges grafit,
- **korall és piros ezen a csempén nem létezik.**

**A Ø RIR cella mindig semleges**, mert ott a kevesebb a keményebb — egy automatikus zöld/szürke
tónus ezen a cellán hazudna.

**Kapuk (nincs kitalált adat):** ha nincs korábbi ugyanilyen nap, a csempe **nem renderel** —
nincs „nincs adat" helykitöltő. Ugyanez a saját (custom) edzésekre, amelyeknek nincs
`templateSessionId`-juk.

### 3.2 Gyakorlat-swimlane

A görgetős gyakorlat-lista helyére **vízszintes sáv** kerül (`.wr-lane`), a Fuel hub
ablak-sávjának mintájára. Egy csempe egy gyakorlat, az izomcsalád saját wash-ében:

- **monogram-korong** (a név kezdőbetűje) a család mély színében,
- `REKORD` bélyeg, ha a gyakorlat szettjei között van medál,
- **egy horgony-szám nagyban: a top munkaszett** (`90 × 8`) — ez az, amit vissza akarsz olvasni,
- **szett-sávok**: tömör = naplózva · **arany = medál** · halvány = bemelegítő ·
  szaggatott = kimaradt,
- láb: `4/4 szett` és — ha van — `· 1 jegyzet`.

A top szett a **legnehezebb munkaszett**, azonos súlynál a több ismétléses.

### 3.3 Gyakorlat-oldal

A mélység nem a görgetésben van, hanem a gyakorlat saját nézetében (`csempe → saját oldal`, a
Huawei-minta, ami minden Design 2.0 prototípuson végigfut).

**Lokális nézet, nem útvonal.** Ez a spec először `/train/review/:workoutId/:exerciseId`-t írt,
de a lezáráskori riport az `ActiveWorkoutPage` fázis-gépében él, és nincs saját útvonala — egy
útvonalas változat két mechanizmust jelentene ugyanarra a képernyőre, és a nehezebben elérhető
csúszna el. A `prep` csempe-oldalak precedensét követi (`prepTile` state, egy URL).

- **Hero**: monogram, név, izompirula, `4/4 szett`, `cél 6–10 ism.`
- **Statisztika-sáv**: `top szett · kg volumen · Ø RIR` + (csak visszanézésben, csak ha van
  referencia) **`előzőleg`** — az előző session ugyanezen gyakorlatának top szettje. Ez a cella
  **ugyanazt a kaput követi, mint a kontextus-csempe**: lezáráskor nincs ott, és a sáv
  háromcellássá szűkül. Az összevetés nem szivároghat be a hátsó ajtón egy olyan képernyőre,
  ahol nem lenne helye.
- **Medál-kártya**, ha ez a gyakorlat termelt rekordot.
- **Szettenként egy csempe** — itt oldódik meg az olvashatóság, mert a szám végre helyet kap:
  `1 · **90** kg × **8** · RIR 2 · CÉLSÁVBAN · 720 kg`. A bemelegítő `B` indexet kap és halkabb;
  a medál-szett arany wash-t; a **kimaradt szett szellem-csempét** (`3 · — kimaradt`).
- **A szett-jegyzet a saját szettje alatt.** Ez már ma is megérkezik a payloadban
  (`ExerciseSetResponse.note`), csak sehol nem látszik — a kör legolcsóbb nyeresége.
- **A célsáv-címke** (`célsávban` zsálya / `sávon kívül` semleges) minden munkaszetten. Ettől lesz
  a szett igazán olvasható: nemcsak azt látod, mit emeltél, hanem hogy az számított-e. Büntetés
  itt sincs — a sávon kívüli szett semleges, nem piros.

### 3.4 Léptetés a template-nap láncán

Az oldal alján `← Előző Pull A` / `Következő Pull A →`, a szomszéd dátumával. **Ugyanazon a
tengelyen lépked, amin az összevetés is fut** — a template-nap láncán, nem naptári sorrendben.
Egy mentális modell, nem kettő. A lánc végén a gomb kikapcsol (`nincs korábbi` /
`ez a legutóbbi`), nem tűnik el — a lánc léte így is látszik.

Ez **oldal-szintű** felelősség (`WorkoutReviewPage`), nem a héjé: a `WorkoutSummary` nem tud és
nem is kell hogy tudjon az útvonalról.

### 3.5 Mozaik-fordítás

| Most | Cél |
|---|---|
| gyökér `<div>` osztály nélkül, **nincs oldal-tónus** | `.mz-p-coral` / `.mz-p-sage` |
| `.wsum-strip` saját 4-cellás sáv | `.mz-statstrip` + `.mz-statcell` (már a stíluslapban van, ez a felület nem használta) |
| `.wsum-medal .disc` = 🏅 emoji | clay `s-medal` spot, ahogy a session-prototípus is |
| lapos `.wsum-sec` blokkok | mosott csempék, `--r-lg` sarkok, tokenizált árnyékok |
| **nulla belépő koreográfia** | `EntranceGroup` + `.rise`, staggerrel |

## 4. Ami szándékosan NEM változik

- **A kihívás-jelek `✓ ◯ ⊘ ◌`.** Ezek nem elmaradt emojik: a prototípus `challengeOutcome()`-ja
  pontosan ezeket a geometrikus jeleket adja, tehát ez a tervezett nyelv.
- **Az izomcsalád-színezés** (`muscleColor` / `regionColor` sín–wash–deep hármas) és a
  `deriveSummaryStats` teljes matematikája — beleértve azt, hogy a `rir` őszintén nullázható és
  az átlag csak a valódi RIR-eket veszi.
- **Minden magyar szöveg** és a záró elv-mondat.
- **Az őszinteség-szerződés**: a kimaradt szett szellem, a kihagyott kihívás tompított, piros
  nincs.

## 5. Amit eltávolítunk

**A `closing` mód halott `<textarea>`-ja.** Nem ígérünk olyat, amit nem tartunk meg. Az
edzés-szintű jegyzet valódivá tétele önálló slice — `POST /workouts/{id}/finish` request body,
oszlop, `note` a `WorkoutDetailResponse`-ban, és a visszaolvasás a review oldalon. Külön bd
issue viszi (`mezo-d20.8.2.2`), és a helye a review oldalon már ki van jelölve.

## 6. Tesztelés

- **Meglévő tesztek**: a `WorkoutSummary` gyakorlat-térképére épülő assertek a swimlane-re és a
  gyakorlat-oldalra váltanak.
- **Új guard** (`workoutReviewTokens.test.ts`): a delta-tónus szabálya kódban is kikényszerítve —
  a delta-cella stílusa **nem hivatkozhat korall/terrakotta tokenre**. Ez pontosan az a
  hibaosztály, amit a panel-ritmus esete tanított: egy érték felületenként másolódik, és az
  ötödik felület csendben mást kap. A guard szubjektuma itt a *tiltott érték*, nem a használatszám.
- **Reduced-motion**: a meglévő `reducedMotionGuard.test.ts` automatikus parser — magától
  számonkéri az új `.wr-*` animációkat.
- **Vizuális goldenek**: a `/train/review` eddig **egyáltalán nem szerepelt** a vizuális
  készletben. Három felvétel kerül be: a riport (a kontextus-csempével), a **swimlane**
  (görgetve — a hajtás alatt van, és épp ez a kör átalakítása), és a **gyakorlat-nézet**, ahol
  eldől, hogy a szett tényleg olvasható lett-e. A készlet 21 → 24 képernyőre nő
  (48 golden/platform).

## 7. Nyitott, a következő körre

- **Az edzés-szintű jegyzet** (lásd §5) — `mezo-d20.8.2.2`.
- **A kontextus-csempe helye** (hero alatt vs. statstrip alatt), a **referencia megnevezésének
  bőbeszédűsége**, az **„előzőleg" cella sorsa** és a **léptetés helye** (lap alja vs. fejléc):
  a prototípus aszidéjében fel vannak téve, és a mostani változat mind a négyre a fenti választ
  adja. Ha egy használat közben rossznak bizonyul, önálló, olcsó változtatás mindegyik.
- **A saját (custom) edzések összevetése.** Nincs `templateSessionId`-juk, tehát nincs láncuk sem;
  a csempe és a léptetés náluk nem jelenik meg. Egy „hasonló custom edzés" heurisztika
  elképzelhető, de az saját döntés — most nem valósul meg.
