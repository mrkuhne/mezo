# A záró edzés-jegyzet a társ és a Memoár kontextusában

**bd**: `mezo-d20.13` · **Epic**: `mezo-d20` (Design 2.0) · **Előzmény**: `mezo-d20.8.2.2`
**Dátum**: 2026-09-01

## 1. A probléma

A [záró edzés-jegyzet](2026-09-01-edzes-jegyzet-design.md) (`workout_session.closing_note`)
azóta valódi, de **zsákutca**: leírod, visszaolvasod a review oldalon, és ennyi. Sem a társ
fordulónkénti kontextus-pillanatképe, sem a heti Memoár nem látja.

Ez a legmagasabb jel/zaj arányú anyag, ami az edzésekről keletkezik. Egy edzés számokban
elmondható; hogy *milyen volt*, csak a te mondatodból derül ki — és az adatokból
visszafejthetetlen.

## 2. Prior art

A `researcher` sub-agent jelentéséből, szűrve:

- **Átvéve — verbatim, sosem összefoglalva.** A compaction (token-törlés) és a summarization
  (átíratás) szembeállítása szerint az összefoglalás elsőként a **konkrét értékeket** veszíti el
  („a retry limit 3" → „a retry-ok konfigurálva voltak"). Az „öt órát aludtam, **mégis** vitt a
  lendület" pontosan így esik szét: az „öt óra", a „mégis" hedge és a konkrét gyakorlat maga a
  jel. Az összefoglalt változat („fáradt volt, de jól edzett") egyszerre semmitmondóbb **és**
  egy értelmezés, amit ez az alkalmazás elvből nem tehet meg. Heti pár mondatnál az
  összefoglalás gyakorlatilag nulla tokent spórol. Kifejezett ajánlásuk: a **felhasználó
  idézeteit** verbatim tárold, a narratívát és az érvelési láncokat foglald össze.
  ([morphllm.com/compaction-vs-summarization](https://www.morphllm.com/compaction-vs-summarization))
- **Átvéve — apró mindig-jelen-lévő szelet + just-in-time lekérés.** A cél „a lehető legkisebb
  magas jelértékű token-halmaz"; a teljes szöveget akkor húzd be, amikor a forduló tényleg
  kéri, ne előre. Ez adja a mi rétegzésünket: a pillanatképbe a mai jegyzet kerül vágva, a
  teljes szöveg az eszköz-hívás mögött marad.
  ([anthropic.com — effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents))
- **Átvéve — karakter-plafon, nem „utolsó N".** A memória-blokk minta minden blokkhoz explicit
  karakterhatárt és `read_only` szemantikát rendel. Az „utolsó N bejegyzés" pont az a
  felállás, ahol egyetlen 900 karakteres jegyzet kiszorít négy rövidet; ezért **per-bejegyzés
  ÉS összesített** plafon kell. A `read_only` itt is érvényes: a társ olvashatja a szavaidat,
  de sosem írhatja át a tárolt jegyzetet.
  ([letta.com/blog/memory-blocks](https://www.letta.com/blog/memory-blocks/))
- **Átvéve — a nyom a bizalom karja.** Egy vizsgálat szerint a felidézés nem attól válik
  kellemetlenné, hogy pontos, hanem ha **elszámoltathatatlan**: a felhasználók átláthatóságot,
  kontrollt és **forrásmegjelölést** várnak, épp mert félnek a félreidézéstől. Ezért a Memoár
  a jegyzetet **horgony-jelöltként** is megkapja: a fejezet a saját hangján ír, de a „Miből
  íródott" sorban visszakövethető, honnan jött. A jelzés nélküli, néma beolvasztás az, amit a
  vizsgálat kockázatosnak talál. ([arXiv 2508.07664](https://arxiv.org/pdf/2508.07664))
- **Figyelembe véve — a túl-értelmezés a valódi hibamód.** Egy empátia-vizsgálat szerint a
  modell válaszai a humán normához képest „túl intenzívek", és a javulás a *konkrét* élményre
  hivatkozásból jött, nem az általános érzelmi mintákból. Prompt-szinten ez annyit jelent: a
  generátor használja a szavaidat és a tényeket, de **ne következtessen ki nem mondott
  érzésekre**. ([arXiv 2409.15550](https://arxiv.org/pdf/2409.15550))
- **Elvetve — beágyazás-alapú visszakeresés.** Heti pár mondatnál a frissesség + karakter-plafon
  dominálja, és a RAG új hibamódot hoz: egy szemantikailag illeszkedő, de **elavult** jegyzet
  kerülne elő a tegnapi helyett.

## 3. Codebase terrain

Az `investigator` sub-agent jelentéséből, szűrve. Érintett feature-ök: **companion**,
**proactive**, **train**. Frontend-felület csak a horgony-chip címkéje.

### 3.1 A bd issue premisszája téves volt — és a javasolt port okozná a bajt

Az eredeti leírás (amit ez a session írt a `mezo-d20.8.2.2` zárásakor) azt állította, hogy
fogyasztói port kell (ADR 0012), mert a közvetlen `companion → train` olvasás megbuktatná a
`feature_slices_are_cycle_free` szabályt. **Fordítva igaz:**

- `feature/companion` **már ma is** közvetlenül olvassa a train-t, épp az érintett osztályokban:
  `ContextSnapshotAssembler.java:101` és a 45–58. sorok importjai (hét train repository + három
  train service), `TrainTools.java:11-25`, `DailySummaryService.java:26-30`.
- `feature/proactive` szintén: `MemoirGenerator.java:288` kommentben rögzíti is —
  *„New `proactive → train` read edge; cycle-checked by `ArchitectureTest`."*
- `feature/train` viszont **semmit** nem importál a companionból vagy a proactive-ból; egyetlen
  feature-közti importjai az `auth` és a `progression`.

Egy companion-tulajdonú port, amit a `train` implementál, ezért a **legelső `train → companion`
élt** hozná létre, és a meglévő sűrű ellenirányú élekkel **új 2-szeletes ciklust** — a
`FreezingArchRule` store-jában pedig egyetlen fagyasztott ciklus van (`biometrics ↔ goal`).
Az ADR 0012 idióma akkor alkalmazandó, ha a fogyasztó a szolgáltató **alatt** van (pantry →
companion, journal → companion); itt a companion/proactive **fölötte** van, tehát a
sima olvasás *maga* az idióma.

### 3.2 Becsatlakozási pontok

- `ContextSnapshotAssembler.java:74-83` — `@Service`, `@ConditionalOnProperty(COMPANION_SWITCH)`,
  „meglévő feature-olvasások read-only kompozíciója; a hiányzó adat explicit `nincs adat`,
  sosem kitalált; sehol nincs LLM."
  - `:289-315` `todayLoggedLine` — a „mi történt ma" sor. A **mai** jegyzet helye.
  - `:230-279` `trainBlock`, ezen belül `:264-277` az „elmúlt N nap" digest, ami ma **csak
    dátumokat** listáz (`findDoneInstanceDates`, `:266`).
  - `:120-133` `render` **és** `:141-151` `renderWithoutBiometrics` — két összeállítási pont;
    az új mező **blokkba** kerüljön, ne a join-listába, különben a reggeli üzenet változata
    némán eltér.
  - `:541-552` `checkInValues` — **a szabadszöveg-vágás precedense**: `checkinNoteMaxChars`
    a configból, `…` túlcsorduláskor. `CompanionProperties.java:55-61` a `Snapshot` record.
- `TrainTools.java:101-131` `renderGymLog` — már ma is `findDoneInstancesBetween` entitásokat
  renderel. Ez a just-in-time réteg, és ezt a felületet éri el a „hogy ment kedden?" kérdés.
- `MemoirGenerator.java:184-260` `gather(...)` — tiszta kódú payload-építő; `:70-108` a
  **memoár-prompt v2** (`mezo-uajy`), package-visible, mert a `MemoirPromptTest` pinneli.
  `:194 / :305` a **horgony-jelölt** mechanizmus (`Memory`, `Pattern`, `LifeEvent`, `PR` fajták).
- `WorkoutSessionRepository.java:80-94` `findDoneInstancesBetween(createdBy, from, to)` —
  a befejezett gym **példányok**, dátum szerint növekvő.

### 3.3 Követendő minták

- **`nincs adat`, sosem kitalált** (`ContextSnapshotAssembler.NO_DATA:84`). Üres jegyzet
  semmit ne rendereljen — ADR 0010: „üres jegyzetre soha semmilyen megjegyzés".
- **A szabadszöveg vágott, és a vágás validált config-gomb** — `checkinNoteMaxChars`,
  `WeeklyReviewContextSources` `*_CLIP`/`MAX_*` konstansai, `MemoirGenerator.NOTE_CLIP = 60`.
- **Mindkét render-változat** — `render` és `renderWithoutBiometrics`.
- **A prompt-fogyasztó bean-ek `@ConditionalOnProperty`-sek.**

### 3.4 Csapdák

1. **`note` ≠ `closing_note`.** Ugyanaz a tábla hordozza a terv-nap jegyzetét (`note`, amit a
   `MesoDay.note` publikál) és a példány záró jegyzetét (`closing_note`). Rossz oszlopot
   olvasva **terv-szöveg szivárogna a „mi történt" narratívába**.
2. **A saját (custom) edzések kiesnének.** `findDoneInstancesBetween` csak
   `templateSessionId IS NOT NULL` sorokat ad; egy saját edzésre írt jegyzet **némán eltűnne**.
   Ez elfogadhatatlan — dátum-tartományos finder kell a custom példányokra is.
3. **Prompt-költségvetés.** A pillanatkép **minden** fordulóban megy; a `closing_note` a
   szerződés szerint 1000 karakter lehet. Hét nap × 1 kB vágatlanul valós regresszió.
4. **Az ArchUnit nincs a fókuszált teszt-halmazban** — csak CI-n (vagy teljes `./mvnw test`)
   derül ki. A CODEMAP-kapu ugyanígy: új osztály/IT esetén regenerálni kell.
5. **`FakeCompanionLlm` prompt-markerre dispatchel** (`MemoirGenerator.MEMOIR_MARKER`) — a
   marker közeli prompt-szerkesztés elrontja a fake-et.
6. **`MemoirGeneratorIT`-nek nincs osztály-szintű `@Transactional`-je** (szándékos:
   `AppNotificationEmitter` `REQUIRES_NEW` deadlock, `mezo-gzhp.1`). Ne „javítsuk".
7. **`TrainPopulator`-nak nincs `closingNote` beállítási útja** — overload kell.

### 3.5 Elavult, amit ez a kör javít

- `docs/features/train.md:137` zárómondata: *„Deliberately NOT included: … feeding the note
  into the companion/Memoár context (its own issue)"* — ez a kör teszi valóra.
- `MemoirGeneratorIT` osztály-javadocja rögzíti: *„a jegyzet NINCS a memoár gather-ben, ezért a
  sentinel egy daily-summary NARRATÍVÁN át kerül be"* — ez a mondat változik.
- `ArchitectureTest.java:70` javadocja két fagyasztott ciklust említ, a store egyet tartalmaz
  (a `meal ↔ recipe` feloldódott, a komment nem követte). Ártalmatlan, de félrevezető.

## 4. Döntések

### 4.1 Nincs port — közvetlen, verbatim olvasás
A §3.1 miatt. A jegyzet az olvasás helyén, változatlan szöveggel kerül a promptba.

### 4.2 Elvetve: a „legkisebb diff" a `DailySummaryService`-en át
Kínálkozna a `DailySummaryService.addTrain` (a futás-jegyzetet már így kezeli, `— "…"`), és
onnan a Memoár ingyen megkapná az `A HÉT NAPJAI` blokkon át. **Két okból nem:** a
`daily_summary` sorok éjjel íródnak, tehát a ma írt jegyzetről a **mai** chat nem tudna; és a
Memoár egy *generált narratíván át* látná a mondatot — pontosan az az összefoglalás, amit a
§2 elvet.

### 4.3 Négy becsatlakozási pont

| Hol | Mit kap | Miért |
|---|---|---|
| `ContextSnapshotAssembler.todayLoggedLine` | a **mai** edzés jegyzete, vágva | minden fordulón jelen van |
| `trainBlock` „elmúlt N nap" digest | jegyzet rövidebbre vágva a dátum mellé | a hét íve olcsón látszik |
| `TrainTools.renderGymLog` | a **teljes** jegyzet (bőkezűbb vágással) | just-in-time: a „hogy ment kedden?" kérdés felülete |
| `MemoirGenerator.gather` | a hét összes jegyzete nyersen + horgony-jelöltként | itt a legnagyobb a hozam, hetente egyszer fut |

### 4.4 Vágás, nem összefoglalás
Új validált `workoutNoteMaxChars` a `CompanionProperties.Snapshot`-ban (a `checkinNoteMaxChars`
mintájára, `@Min`/`@Max`). A Memoár oldalon **per-bejegyzés ÉS összesített** plafon. A
túlcsordulás `…`-szal **csonkolva**, sosem LLM-mel rövidítve: a csonkolás őszintén veszteséges,
az átíratás hazudik.

### 4.5 Horgony
A hét jegyzetei horgony-jelöltként is bemennek, új `WorkoutNote` fajtával. A FE chip-renderelés
ma csak a `Memory`-t kezeli külön, tehát a `WorkoutNote` kap egy címkét — ez a kör egyetlen
frontend-munkája.

### 4.6 Elvetve
- **`WeeklyReviewContextSources`**: megosztott, tehát a heti *áttekintés* promptját is
  megváltoztatná. Külön döntés, nem ezé a köré.
- **Bármilyen összefoglalás vagy érzés-következtetés** a jegyzetekről.

## 5. Tesztelés

- `ContextSnapshotAssemblerIT`: a mai jegyzet megjelenik a `[Edzés]` blokkban · a digest sorai
  hordozzák · **a vágás érvényesül** (plafon fölött `…`) · **üres jegyzet semmit nem renderel** ·
  a `render` és a `renderWithoutBiometrics` is (a két összeállítási pont ne divergáljon).
- `CompanionToolsRenderIT`: `renderGymLog` hozza a teljes jegyzetet.
- `MemoirGeneratorIT`: a hét jegyzetei a gather payloadban **verbatim** · horgony-jelöltként is ·
  az összesített plafon érvényesül · **saját (custom) edzés jegyzete sem esik ki** (§3.4/2).
- `TrainPopulator`: `closingNote` beállítási út.
- `ArchitectureTest` **kötelezően** a fókuszált futásban (a §3.4/4 miatt).
- Switch-off IT nem kell: nem születik új `@ConditionalOnProperty` bean; a meglévő
  `CompanionSwitchOffIT` / `MemoirJobSwitchOffIT` lefedi a fogyasztókat.

## 6. Nem cél

- A heti áttekintés (`WeeklyReviewContextSources`) promptjának megváltoztatása.
- A gyakorlat- és set-szintű jegyzetek betáplálása (más granularitás, más döntés).
- Bármilyen visszamenőleges feltöltés — ami eddig íródott, az onnantól látszik, ahonnan olvassuk.
