# Karakter · Konzílium — UX újratervezés (döntés-első nézet)

**Állapot:** jóváhagyva (Daniel, 2026-09-07)
**Driving bd:** mezo-sp9w
**Előzmény:** `2026-09-06-karakter-konzilium-szal-nezet-design.md` (mezo-xlvr) — a szál-nézet
strukturált tárolást és kereszt-vita kört hozott; ez a spec a **felületét** tervezi újra.

---

## 1. A probléma

Daniel a leszállított szál-nézetbe belépve nem érti, mi történik. Hat konkrét panasz, mind
reprodukálva élőben (mock mód, `?id=w2`) és visszavezetve a kódra:

| Panasz | Kódbeli ok |
|---|---|
| „egyszerre tudok visszalépni a listára és a fő karakter oldalra" | `KonziliumPage.tsx:151` (`PageHead onBack → /me/karakter`) és `:180` (`‹ vissza a listához`) egyszerre látszik a részletnézeten |
| „nem látom a kereszt-vita kört" | a reakciók csak az `ItemChain` belsejében élnek (`ConferenceThreadCard.tsx:95-104`); a szálfejléc és az oldal teteje semmivel nem jelzi, volt-e vita |
| „nem az ikonokat látom, hanem kis pöttyöket" | `ChainStep` egy 11px-es színes kört rajzol (`.kr-thdot`, `character.css:507`), miközben a fejlécben `PersonaOrb` van (`ConferenceThreadCard.tsx:141`) |
| „tök béna a listázás" | a lista sorai csak dátumot és típus-badge-et hordoznak (`KonziliumPage.tsx:166-176`), mert a `CharacterConferenceSummary` séma (`api/feature/character/character.yml:365`) nem ad vissza kimenetet |
| „nem értem a funkcióját az egésznek" | a szál-nézet kidobta a fázis-címkéket; sehol nem derül ki, hogy a konzílium javaslat → kereszt-vita → szkeptikus → döntés körökből áll, és hogy mire jó |
| „a Kimenet 2/1/1 nem stimmel a 4 kártyával" | a fejléc a `changes[]`-ből számol, a kártyák a `deliberation`-ből — két külön forrás, magyarázat nélkül egymás mellett |

**A közös gyökér:** a felület a *folyamatot* tette az elsődleges tartalommá (négy egyforma,
összecsukott szál), és elhagyta mind a *kontextust* (mi ez), mind az *eredményt* (mi változott),
mind a *dramaturgiát* (ki kire reagált).

---

## 2. Prior art

A `researcher` recon-ügynök jelentése (2026-09-07), szűrve:

- **Anthropic Claude Research — orkesztrátor + szintézis-kör.**
  <https://blog.bytebytego.com/p/how-anthropic-built-a-multi-agent>
  A vezető ügynök 3–5 alügynököt futtat, de a nyers kimenetüket **sosem** mutatja a
  felhasználónak tranzskriptként: külön szintézis-kör állít elő egy jelentést, az egyedi
  alügynök-munka opcionális, másodlagos réteg.
  **Átvéve:** a landolónézet a döntés és a változás, a folyamat a második réteg.

- **„Chat is a terrible interface for agents".**
  <https://hackernoon.com/chat-is-a-terrible-interface-for-agentsand-2026-will-prove-it>
  Amikor minden kimenet ugyanabban a betűsúlyban, ugyanolyan buborékban, kronologikusan
  jelenik meg, semmi nem olvasható ki belőle.
  **Átvéve:** a különböző artefaktumok (javaslat / állásfoglalás / szkeptikus verdikt / döntés)
  kapjanak **eltérő vizuális kezelést**, ne csak eltérő behúzást. Ez a mi bajunk diagnózisa is:
  az egyforma összecsukott akkordeon strukturálisan ugyanaz a hiba, mint a chat-tranzskript.

- **Avatar-stack + állásfoglalás-chip a „ki kire reagált"-ra.**
  <https://www.subframe.com/tips/comment-thread-design-examples>
  Résztvevő-avatarok egymásra csúsztatva, a reakció egy sorban idézett szülővel és
  típus-chippel.
  **Átvéve:** a SUPPORT/CHALLENGE/NUANCE állásfoglalás színes chip a beszélő neve mellett;
  a kereszt-vita szekcióban a reakció fölött egysoros idézet arról, **mire** reagált.
  **Elvetve:** gráf/hálózat-vizualizáció — 440px-en és 8 állandó szereplőnél fölösleges.

- **GitHub PR review-szálak — verdikt-badge összecsukva is, plusz index.**
  <https://github.blog/changelog/2021-05-25-new-tools-to-discover-and-resolve-pull-request-conversations-beta/>
  A szál állapota badge-ként látszik, mielőtt bármit kinyitnál; felül index az állapotok szerint.
  A GitHub saját dokumentált hibája viszont, hogy index nélkül összecsukni „ásásra" kényszerít.
  **Átvéve:** a szálfejléc mondja meg vita nélkül is, mi lett a sorsa és **volt-e vita**.
  **Elvetve:** az index nélküli összecsukás — pont ez a mai állapotunk.

- **Üres-állapot / első-belépés tanító fejléc.**
  <https://www.eleken.co/blog-posts/empty-state-ux>
  Nem magától értetődő funkciónál a belépő állapot egy mondatban elmondja, mi ez és mi fog
  történni.
  **Átvéve:** állandó (nem elrejthető, nem csak első alkalommal látszó) „Mi ez" kártya egy
  mondattal. **Elvetve:** többlépcsős onboarding-túra — heti visszatérő funkciónál túlzás.

---

## 3. Codebase terrain

*(Ezt a szakaszt ebben a menetben a controller saját, közvetlen kódolvasása adta — a
`brainstorm-recon` `investigator` ága nem futott, mert a terep a mezo-xlvr szeletből
frissen ismert. Minden állítás alatta path:line hivatkozás van.)*

**Frontend**
- `frontend/src/features/character/pages/KonziliumPage.tsx` (212 sor) — lista + részlet egy
  komponensben, `useSearchParams` `?id=`-vel. Ez a fő átírandó fájl.
- `frontend/src/features/character/components/ConferenceThreadCard.tsx` (165 sor) — a szálkártya.
  `ChainStep` (`:76-86`) a pötty forrása; `outcomeBadge` (`:44-48`) és a `speakers`/`acceptedCount`
  segédek megtarthatók.
- `frontend/src/features/character/components/PersonaOrb.tsx` — kész orb-komponens, a láncba
  be kell húzni.
- `frontend/src/features/character/character.css:483-509` — `.kr-thread*` osztályok.
- `frontend/src/features/character/expertColors.ts` — a szakértő-szín térkép; a lánc, az orb
  és az érettség-gyűrű ugyanebből dolgozik, ne ágazzon el.
- `frontend/src/shared/ui/Sheet.tsx` — a ház alsó-lap idiómája. **Csapda (memória:
  `portal-target-gotcha-mezo-ugqb`):** a `.phone-screen` portál-célt csak *feltételesen*
  mountolt komponensben szabad `useState` inicializálóban feloldani; az archívum lap
  feltételesen mountolódik, tehát az idióma ahogy van, jó.
- `frontend/src/app/router.tsx:317` — egyetlen route, `me/karakter/konzilium`. Marad.
  Mélylinkek: `RunPage.tsx:175` (`?id=<conferenceId>`), `KarakterHubPage.tsx:133,237` és
  `CharacterFeedPage.tsx:203` (id nélkül).
- `frontend/src/data/character/characterMock.ts:464` — `DELIBERATION_W2`. A mock ma **négy szál,
  egyenként egy állítással, mindegyik elfogadva** — ezért néz ki a képernyő négy egyforma
  kártyaként. A mockot dúsítani kell (lásd §8).

**Backend**
- `backend/.../character/service/CharacterService.java:252-261` — `conferences()`, a lista
  végpont. `:284-289` — a `deliberation` legacy-fallbackje: ha a jsonb oszlop null,
  `LegacyTranscriptParser.parse(...)` derivál. **Következmény:** a FE ma nem tudja
  megkülönböztetni a tárolt és a visszafejtett szálakat.
- `backend/.../character/repository/CharacterConferenceRepository.java:31-39` — `Summary`
  projekció, kifejezetten azért, hogy a lista **ne** töltse be a tranzskriptet. Az `outcome`
  külön jsonb oszlop (`CharacterConferenceEntity:55-56`), tehát a projekcióhoz hozzávenni olcsó:
  a nagy `transcript`/`deliberation` oszlop továbbra sem töltődik.
- `backend/.../character/entity/ConferenceOutcomeEnvelope.java` — `Change(kind, dimensionKey,
  claimId, summary)`.

**Kapuk és csapdák (memóriából, érvényesek erre a szeletre)**
- Fókuszált BE kapu: `-Dtest='*Character*,DetectorTest,Konzilium*,ClaimLifecycleIT,ArchitectureTest'
  -Dmezo.test.use-testcontainers=true`.
- FE kapu **két módban**, explicit `VITE_USE_MOCK`-kal; a `--` utáni fájlnév nem szűkít.
- Contract-változás: fragment + `openapi.yml` + `api.gen.ts` **egy commitban**.
- A `docs/CODEMAP.md` regenerálása a `origin/main` merge **után**.

---

## 4. A megoldás alakja

Egyetlen oldal, három réteg, ebben a sorrendben:

1. **Kontextus** — mi ez, és hogyan zajlott (két kártya, valódi számokkal).
2. **Eredmény** — mi változott a dossziéban.
3. **A vita** — a szálak, összecsukva, de beszédes fejléccel.

Fölötte egy **léptető** vált tanácskozást, alatta egy **archívum lap** ugrik bárhová.
Nézetváltó (`Áttekintés / Beszélgetés`) adja a kronologikus kör-nézetet.

A lista-oldal **megszűnik**: a `?id=` nélküli belépés a legutóbbi konzíliumot nyitja.
Ezzel a dupla visszalépés is megszűnik — `‹ Karakter` az egyetlen kilépés, mert az archívum
lap és a nézetváltó nem oldalt vált.

---

## 5. Fejléc és navigáció (A1)

```
[‹ Karakter]                     ← az egyetlen visszalépés

          Konzílium
   ‹   szeptember 6. · heti ⌄   ›
```

- **Nyilak:** egy koppintás az időben előző / következő tanácskozásra. A legutóbbin a jobb
  nyíl `disabled` (halvány), a legrégebbin a bal. A sorrend a lista-végpont
  `generatedAt DESC` sorrendje.
- **Dátum-gomb:** megnyitja az archívum lapot. `aria-haspopup="dialog"`.
- **Fix magasság** — 5 és 500 konzíliumnál is ugyanaz. Ez váltotta ki az elvetett hét-chipeket
  (nem skálázódik egy év után).

**Archívum lap** (`Sheet`, alulról):

```
━━
Korábbi tanácskozások            61
──────────────────────────────────
2026 · SZEPTEMBER
  szeptember 6.   3 bekerült · 1 nyugdíjazva   [HETI] ●
  szeptember 1.   5 bekerült                   [HAVI]
2026 · AUGUSZTUS
  augusztus 30.   2 bekerült · 1 portré        [HETI]
  …
────────────── 2025 ──────────────
```

- Hónap-fejlécek, év-elválasztó; a lap belseje görgethető, a lap maga nem nő.
- Az aktuálisan nyitott sor kiemelve.
- A sor **kimenete** a bővített lista-végpontból jön (§7). Csak a nem-nulla tételek látszanak;
  ha egyik sem nulla fölötti, a sor kimenet-része üresen marad — **nem** írunk oda `0`-t és
  nem találunk ki szöveget.
- Választás után a lap becsukódik és az oldal az adott konzíliumra vált (`setParams({id})`).

---

## 6. A három réteg

### 6.1 „Mi ez" kártya

Állandó, egy bekezdés, kézzel írt (nem modell-generált) szöveg:

> Hetente a nyolcfős csapat átnézi az adataidat, megvitatja egymás felvetéseit, a Szkeptikus
> kikérdezi őket, és **Mezo dönt** arról, mi kerül be a rólad szóló dossziéba.

`MONTHLY` és `BOOTSTRAP` konzíliumnál a „Hetente" szó a típusnak megfelelően változik
(`Havonta` / az első beolvasáskor). Három rögzített szöveg, nem sablonozott mondat.

### 6.2 „Hogyan zajlott" — a kör-térkép

Négy cella egy sorban, mindegyik **a megnyitott konzílium valódi adatából** számolva:

| # | Címke | Szám | Forrás |
|---|---|---|---|
| 1 | Javaslat | `N felvetés` | `deliberation` összes `item` |
| 2 | Kereszt-vita | `N hozzászólás` | az összes `item.reactions` összege |
| 3 | Szkeptikus | `N vizsgálat` | `item.skeptic != null` darabszám |
| 4 | Mezo dönt | `N be · M el` | `item.chair.accepted` igaz / hamis darabszám |

**Őszinteség-szabályok:**
- A 2. cella kiemelt (korall), **ha volt** hozzászólás — ez a válasz a „nem látom a kereszt-vita
  kört"-re.
- Ha a konzílium **a kereszt-vita kör bevezetése előtt** zajlott (a `deliberation` visszafejtett,
  nem tárolt), a 2. cella szövege `nem volt ilyen kör`, halványan — **nem** `0 hozzászólás`,
  mert az azt sugallná, hogy lefutott és senki nem szólt hozzá. Ehhez kell a §7-beli
  `deliberationSource` mező.
- Ha egy kör tárolt, de nulla eredményt hozott, `0` látszik. Egy kör, ami nem hozott semmit,
  úgy jelenik meg, hogy nem hozott semmit.
- Egyik cella sem kattintható a 6.4 nézetváltón kívül — a szám nem link.

### 6.3 „Mi változott a dossziédban"

Változatlan forrás: `changes[]`. A mai zavart nem a szám okozta, hanem hogy „Kimenet" névvel
állt egy másik forrásból számoló kártyalista mellett. Feloldás **címkézéssel**:

- ez a kártya `MI VÁLTOZOTT A DOSSZIÉDBAN` (a `changes[]` = tartós hatás),
- a kör-térkép 4. cellája `Mezo dönt · N be · M el` (a `deliberation` = a tanácskozás döntései).

Kettő különböző, mindkettő igaz dolog; a címkék elmondják, melyik melyik. Nem vonjuk össze
és nem számoljuk újra egyiket a másikból.

### 6.4 Nézetváltó — `Áttekintés / Beszélgetés`

Szegmentált vezérlő a fejléc alatt. Nem route, nem `searchParam` — komponens-állapot, minden
konzílium-váltáskor visszaáll `Áttekintés`-re.

### 6.5 Áttekintés (alapnézet) — a szálak

A `ConferenceThreadCard` marad, három változtatással:

**a) A fejléc mondja meg, volt-e vita.** A mai `N állítás · M elfogadva` alsorát felváltja:

- ha van reakció: `N állítás · ` + korall chip `M hozzászólás`
- ha nincs, de a kereszt-vita kör lefutott: `N állítás · nem vitatták`
- ha a kör nem is létezett (visszafejtett szál): `N állítás · M elfogadva` (a mai szöveg)

**b) A lánc orb-okat kap.** `ChainStep` a `.kr-thdot` pötty helyett `PersonaOrb`-ot rajzol,
ugyanabban a méretben, mint a fejléc arcai (22–23px), a szereplő színéből vetett árnyékkal.
A függőleges összekötő vonal marad, az orb közepéhez igazítva.

**c) Állásfoglalás-chipek.** A reakció-lépés fejléce `Doki` + `támogatja` chip, nem szabad
szöveg a névbe olvasztva. Színkód: SUPPORT zsálya, CHALLENGE terrakotta, NUANCE homok.
A Szkeptikus (`meghagyta` / `kukázta`) és Mezo (`elfogadta · biztos` / `elvetette`) ugyanilyen
chipet kap. A bizonyosság továbbra is **kizárólag szó** (`confidenceWord`), sosem szám.

Változatlanul marad: alapból minden szál összecsukva; `null` szkeptikus/elnök esetén a
„Ez a kör nem adott választ erre az állításra." mondat; a kind-tudatos elfogadás-címkék
(Bekerült / Megerősítve / Gyengítve / Nyugdíjazva).

### 6.6 Beszélgetés nézet — a négy kör időrendben

Ugyanabból a `deliberation` adatból, más tagolással. Négy szekció, mindegyik számozott
fejléccel:

1. **Javaslatok** — soronként egy `item`: orb, szakértő neve, a felvetés szövege.
2. **Kereszt-vita** — csak az `item`-ek, amikhez tartozik reakció. Minden blokk tetején
   **egysoros idézet** arról, mire reagálnak (`„A hétvégi lefekvés két órával kitolódik…" —
   Szomnológus`), alatta a reakciók orbbal és állásfoglalás-chippel.
3. **Szkeptikus** — a nem-null verdiktek.
4. **Mezo dönt** — a nem-null döntések, korall keretes kártyákon.

Üres kör esetén a szekció **látszik**, a törzse pedig egy mondat mondja meg, hogy ez a kör
nem hozott semmit — vagy hogy nem is létezett még (`deliberationSource: DERIVED`). A kör
sosem tűnik el némán.

---

## 7. Contract-változás

Két bővítés, mindkettő additív, migráció nélkül.

**a) `CharacterConferenceSummary` — kimenet a lista sorokban.**

```yaml
CharacterConferenceSummary:
  required: [id, kind, generatedAt, outcome]
  properties:
    # … meglévők …
    outcome:
      $ref: '#/components/schemas/ConferenceOutcomeCounts'

ConferenceOutcomeCounts:
  type: object
  required: [accepted, retired, portraitRewritten, other]
  properties:
    accepted:          { type: integer }   # CLAIM_ACCEPTED
    retired:           { type: integer }   # CLAIM_RETIRED
    portraitRewritten: { type: integer }   # PORTRAIT_REWRITTEN
    other:             { type: integer }   # minden más kind darabszáma
```

Backend: a `CharacterConferenceRepository.Summary` projekció kap egy
`ConferenceOutcomeEnvelope getOutcome()` getter-t (a `transcript`/`deliberation` oszlop
továbbra sem töltődik), a `CharacterService.conferences()` pedig `kind` szerint számol.
Az `other` létezik, hogy a felület sose hazudjon teljességet — de a sorban nem jelenik meg,
csak a három nevesített szám.

**b) `CharacterConferenceResponse.deliberationSource` — tárolt vagy visszafejtett.**

```yaml
deliberationSource:
  type: string
  enum: [STORED, DERIVED]
  nullable: true      # null, ha nincs deliberation egyáltalán
```

`STORED`, ha a `deliberation` jsonb oszlop nem null; `DERIVED`, ha a
`LegacyTranscriptParser` fejtette vissza. Ezen múlik a §6.2 „nem volt ilyen kör" szöveg.

Mindkettő ugyanabban a commitban: `api/feature/character/character.yml` +
`api/openapi.yml` + `frontend/src/data/_client/api.gen.ts`.

---

## 8. Mock és teszt-fixtúrák

A mai `DELIBERATION_W2` (négy szál × egy állítás × mind elfogadva) **maga is része a
problémának**: a képernyő nem tudja megmutatni azt, amit tervezünk. Bővítendő úgy, hogy a
mock lefedje az összes állapotot, amit a felület kezel:

- egy szál **két** állítással, ebből egy elvetve,
- egy szál **három reakcióval** (SUPPORT + CHALLENGE + NUANCE) egyetlen állításon,
- egy szál reakció nélkül (`nem vitatták`),
- egy állítás `skeptic: null`-lal és egy `chair: null`-lal (a „nem adott választ" ág),
- egy `RETIRE` kind-ú elfogadott állítás (a `Nyugdíjazva` címke),
- legalább hat konzílium-összefoglaló a listában, két különböző hónapból és egy előző évből,
  hogy az archívum lap hónap- és év-tagolása látszódjon,
- egy `deliberationSource: 'DERIVED'` konzílium (a „nem volt ilyen kör" ág).

Ezek a fixtúrák egyben a komponens-tesztek bemenetei.

---

## 9. Tesztelés

**Frontend (vitest + RTL), új és bővített fájlok**
- `ConferenceThreadCard.test.tsx` — a fejléc alsora mindhárom ágon; a lenyitott lánc
  `PersonaOrb`-ot rajzol (nem `.kr-thdot`); az állásfoglalás-chipek szövege és tone-ja;
  a `RETIRE` címke; a `null` verdikt mondata.
- `KonziliumPage.test.tsx` — `?id=` nélkül a legutóbbi konzílium nyílik; **egyetlen**
  visszalépő vezérlő van a dokumentumban; a léptető nyilai a széleken `disabled`-ek;
  a kör-térkép négy száma a fixtúra adatából számolódik; `DERIVED` forrásnál a 2. cella
  szövege `nem volt ilyen kör`.
- `ConferenceArchiveSheet.test.tsx` (új) — hónap- és év-fejlécek; a nyitott sor kiemelése;
  választáskor `setParams` és lapzárás; nulla kimenetnél nem ír `0`-t.
- `KonziliumConversationView.test.tsx` (új) — a négy szekció mindig látszik; üres körnél
  a magyarázó mondat; a kereszt-vita blokk idézete a szülő állítás szövegét mutatja.

**Backend (JUnit + Testcontainers)**
- `CharacterServiceIT` (bővítés) — a `conferences()` kimenet-számai a `changes[]` kind-jaiból;
  az `other` a nem nevesített kindeket számolja; a lista lekérés **nem** tölt tranzskriptet
  (a projekció megmarad).
- `CharacterConferenceApiIT` (bővítés) — `deliberationSource` `STORED` a tárolt oszlopnál,
  `DERIVED` a visszafejtettnél, `null` ha nincs szál.

**Kapuk** — a §3-ban felsorolt fókuszált BE parancs, a FE mindkét módban, `pnpm build`,
`gen-codemap --check`, `lint-docs --errors-only`, `lint-liquibase`.

---

## 10. Amit szándékosan NEM csinálunk

- **Nincs gráf/hálózat-vizualizáció** a reakciókról — 440px-en olvashatatlan, és 8 állandó
  szereplőnél az avatar-stack elég.
- **Nincs onboarding-túra**, csak az állandó egymondatos „Mi ez" kártya.
- **Nem vonjuk össze** a `changes[]`-t és a `deliberation`-t egyetlen számsorrá.
- **Nem generáljuk modellel** a „Mi ez" szöveget — kézzel írt, három rögzített változat.
- **Nincs keresés/szűrés** az archívumban. Léptető + hónapokra tagolt lista elég; ha egyszer
  száz fölé nő és fájni kezd, akkor kap keresőt.
- **Nem nyúlunk a konzílium tartalmához** — sem a promptokhoz, sem a körök logikájához,
  sem a tárolt struktúrához. Ez a szelet a felület és két additív contract-mező.

---

## 11. Nyitott kockázatok

- A `deliberationSource` mező bevezetése után a **régi konzíliumok** kör-térképe két cellán
  („Kereszt-vita", részben „Szkeptikus") halvány lesz. Ez szándékos és őszinte, de vizuálisan
  szegényebb — a legrégebbi tanácskozásokat megnyitva ez a normál látvány.
- Az archívum-kimenet a `changes[]`-ből számol, tehát egy konzílium, ami csak elvetett
  állításokat termelt, **üres kimenetű sorként** jelenik meg. Ez pontos (a dossziéban tényleg
  nem változott semmi), de első ránézésre hiányzó adatnak tűnhet. Elfogadva: inkább üres, mint
  kitalált.
