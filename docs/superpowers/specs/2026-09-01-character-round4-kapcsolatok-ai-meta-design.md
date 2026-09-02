# Karakter — 4. kör: kapcsolatok & AI-meta (design)

**bd:** mezo-1gim.15 (4., utolsó kör) · **Előzmények:** [1. kör](2026-08-31-character-round1-edzes-test-design.md),
[2. kör](2026-09-01-character-round2-fuel-ciklus-design.md), [3. kör](2026-09-01-character-round3-psziche-viselkedes-design.md),
[epic](2026-08-27-user-character-dossier-design.md)
**Domain-doc:** [`docs/features/character.md`](../../features/character.md)

## 1. Cél

A Karakter-dosszié bemeneti korpuszának negyedik, záró bővítése: a `MINDENT be` leltár
(`frontend/src/features/character/inventory.ts`, `INVENTORY_ROUNDS` n=4) „Kapcsolatok &
AI-meta" sorainak valódi bekötése — hét új domain-olvasás és **nyolc** új determinisztikus
detektor. A katalógus 32-ről 40-re nő, és a leltár `rounds` listája **kiürül**.

Ez a kör két, egymástól élesen elválasztott réteget nyit:

- **Kapcsolatok és kontextus** — kikkel és milyen kontextusban élsz (említések), hogyan bomlik
  szét a hét (hétvége-szakadék), és mit hozol a társhoz (chat-témák). Ezek **rólad** szólnak.
- **AI-meta** — mit kezdesz a társ javaslataival (Tudástár-triázs), és mennyire volt igaza a
  társnak (predikciók, questek, kísérletek). Ezek **a rendszerről** szólnak.

A második réteg miatt ez a kör nem csak detektorokat ad: egy új dimenzió-fajtát (`META`) és egy
új megfigyelő-personát (a Szkeptikus) is bevezet, hogy a rendszerről tett állításnak legyen
szerkezeti helye, ahol nem keveredik a felhasználóról tett állítással.

### A kör mércéje

A 2. körben megszabott mérce („nem az a lényeg, hogy minél kevesebb munka legyen, hanem hogy
pontosak legyünk") itt is érvényes. Daniel ehhez ebben a körben hozzátette, hogy a rendszer
bonyolultsága nem szempont — a mérleg egyetlen serpenyője a **felhasználói érték és az
őszinteség**. Ez döntötte el a határkérdést (§4.1): a több fájlt érintő, de igaz alanyú változat
készül el, nem az egyszerűbb, amely a rendszer hibáit a felhasználó tulajdonságaként mondaná ki.

## 2. Prior art

A researcher öt forráscsoportot hozott; mindegyik alakította a tervet.

- **Exist.io — erősség és bizonyosság külön dial.** A páros korrelációk mindig két független
  értéket hordoznak: mennyire mozognak együtt, és mennyi adat van mögötte (0–5 csillag); egy erős
  kapcsolat kis N-nél is alacsony bizonyosságú, és a találat sosem irányt állít. Átvéve a
  `people-mood-link`-be: a mondat külön nevezi a különbséget és az N-alapú bizonyosságot, és
  kimondja, hogy együttjárás, nem irány. Az Exist a küszöb alatti párokat elrejti, nem gyenge
  csillaggal mutatja — ezért van minimum-gate mindkét csoporton.
  <https://kb.exist.io/article/37-what-are-correlations>
- **Roenneberg — social jetlag mint alvásközép-eltolás.** SJL = |alvásközép szabadnapon −
  alvásközép munkanapon|; a népességi adatban ~69% ≥ 1 óra, ~harmad ≥ 2 óra, ezért 1 h a
  „jelen", 2 h a „jelentős" küszöb. A 2019-es önkritikus review hozzáteszi: a szabad/munka nap
  a valós kötelezettség-rendből következik, nem a naptári hétvégéből, és 8 hét alatt csak ~16
  szabad éjszaka gyűlik. Átvéve a `weekend-gap` alvás-ágába, 1 h / 2 h sávokkal és
  minimum-számmal; **elutasítva** a kötelezettség-rend, mert a rendszerben nincs ilyen adat —
  a hétvége Szo/V, és a mondat ezt vállalt korlátként kezeli. A logolás-lefedettségi rés nem
  ebből az irodalomból jön; szokás-megfigyelésként fogalmazódik, nem élettaniként.
  <https://www.cell.com/current-biology/fulltext/S0960-9822(12)00325-9>,
  <https://www.mdpi.com/2079-7737/8/3/54>
- **Hyndman — a két-ciklus-szabály.** Klasszikus szezonális dekompozícióhoz szezonális
  pozíciónként legalább két megfigyelés kell, azaz két teljes ciklus; ennél rövidebb sorozatból
  csak modell-feltevéssel (Fourier-tagok) lehet szezont „találni", ami nem detekció. Ez a
  **Szezonalitás kihagyásának** indoka: egy 8 hetes ablak egy éves ciklus töredéke, nulla
  ismétléssel. A sor az `INVENTORY_LATER`-be kerül azzal, hogy két év azonos naptári ablaka
  kell hozzá. <https://robjhyndman.com/hyndsight/tslm-decomposition/>
- **Brier-pontszám és kalibrációs napló.** Predikciónként (valószínűség, kimenet) párokat
  tárolnak; a Murphy-dekompozíció megbízhatóságra bontja; a pontszámot sosem mutatják a
  triviális bázisráta nélkül. Kis N-nél a dekompozíció elhagyandó: darabszám, találati arány a
  kimondott magabiztossághoz képest. Átvéve a `prediction-calibration`-be (találati arány vs.
  átlag-konfidencia, három sáv); **elhagyva** a Brier-szám és a bázisráta, mert a predikciók
  irány-típusúak és a szám a felhasználónak nem mond semmit — a sáv igen.
  <https://metricgate.com/blogs/brier-score-explained/>, <https://arxiv.org/html/2504.04906v3>
- **Elfogadási arány mint gyenge bizalom-proxy; kalibrált bizalom mint cél.** A Copilot-metrika
  körüli irodalom szerint az elfogadási arány önmagában sem minőséget, sem bizalmat nem mér:
  az elutasítás jelentheti, hogy a javaslat rossz, redundáns, vagy csak nem kellett. Lee & See
  (2004) keretében a cél a rendszer valós képességéhez igazodó bizalom, és a 2023-as review
  szerint a rendszer pontosságáról adott visszajelzés az egyik kevés eszköz, ami ezt tényleg
  mozgatja. Ez **fordította meg a határ-döntést** (§4.1): a triázs-adat a rendszer minőségéről
  szól, ezért a Szkeptikus mondja ki a rendszerről, és a felhasználó címkézése („szkeptikus",
  „bizalmatlan") tilos. <https://docs.github.com/en/copilot/concepts/copilot-usage-metrics/copilot-metrics>,
  <https://arxiv.org/pdf/2311.06305>

A chat-téma-eltolódásra a researcher nem talált tiszta külső mintát; a legközelebbi a
címke-gyakoriság ablakonkénti összevetése, állapotváltás-kapuval — ezt követi a
`chat-topic-shift`.

## 3. Codebase terrain

Az investigator jelentése (CODEMAP → `character.md`, `me.md`, `insights.md`, `proactive.md`,
`growth.md`); a tervet alakító pontok:

**Bővítési pontok.** `DetectorInput.TrendWindow` 15 komponensű pozicionális rekord; minden
építőhely (`CharacterSignalReads.gather`, `DetectorTest.emptyTrend`/`TrendBuilder`, négy
kézzel írt literál a `DetectorTest`-ben) együtt szélesedik. `CharacterSignalReads` már 28
függőségű. `DetectorSignal(detectorKey, expertKey, summary, salience)` — nincs benne
`sensitive`: az érzékenység claim-szintű, a javaslat-kör promptja mondja ki (már ma nevesíti az
„elutasítás-mintázati" osztályt).

**Emberek.** `MentionEntity` a dátumozott, strukturált sorozat: `ts`, `source`, `contextLabel`
(zárt DB-CHECK halmaz: munka|csalad|baratok|edzes|konfliktus|kozos_program|segitseg|egyeb),
`flagged`, `tone`/`intensity` (az éjszakai LLM-kör tölti, nullable), `excerpt` (szabad szöveg).
`MentionRepository` félig nyitott `ts`-ablak-finderrel. `PersonEntity.affectTrend` dátum
nélküli, kurált — nem idősor. **Semmi nem olvassa a people-t a characterből**; a `character →
people` él új, egyirányú, ciklust nem zár.

**Hétvége / szezon.** A `TrendWindow` minden sorozata `LocalDate`-et hordoz; `SleepLogEntity`
`bedtime`/`wakeup` HH:MM stringeket. Időzóna, helyszín, nappalhossz **sehol** nincs; minden
Instant → `ZoneId.systemDefault()`.

**Chat.** `AiMessageEntity`-n nincs téma-oszlop, de az asszisztens-sorok `toolCalls` envelope-ja
a végrehajtott olvasó-eszközök nevét hordozza (17 eszköz; a FE `toolDomains.ts` már doménre
képezi). `AiConversationEntity.title` = az első felhasználói üzenet 120 karakterre vágva.
A 3. kör csak a felhasználói sorok `createdAt`-ját olvasta.

**Tudástár.** `LearnedFactEntity.userDecision` accept|reject|refine, `category`
train|fuel|health|life, **nincs decidedAt** (a döntés egyszeri, a jelölt `createdAt`-ja az
egyetlen dátum-proxy). `PatternEventEntity` (kind confirmed|rejected|…, `occurredAt`) az
egyetlen időbélyeges elutasítás-napló. Gráf-jelölt elutasítás = soft delete → JPA-n át
láthatatlan; kimarad.

**Quest.** `DailyQuestEntity`: `questDate`, `slot BODY|FUELBIO|GROWTH`, `status
offered|completed|expired|rerolled`, `completedAt`; a `title`/`why` szöveget a flavor-átírás
jelölés nélkül felülírja; a nehézség a katalóguson él, nem a soron. A quest-motor saját
adaptív sávjai: 28 nap, minSample 5, 0,85 / 0,50 (`QuestProperties.Adaptive`).
`character → quest` új, egyirányú, biztonságos él.

**Predikció, kísérlet, kihívás, memoár.** `PredictionEntity`: `validFrom/validTo`, `status
pending|validated|missed`, `confidence` nullable, **nincs resolvedAt** (a validálás
`validTo < today` napon fut, helyben ír). `ExperimentEntity` `status … completed|dismissed` +
`outcomeGood`; `ChallengeEntity` `status … hit|miss|inconclusive|dismissed`, `workoutDate`.
`MemoirEntity` csak próza — kimarad. A `character → proactive` és `character → companion` él
már létezik.

**Dimenzió-modell.** `character_dimension.kind` CHECK `('CORE','CHAPTER')`; CORE a 7 fix,
szakértő-gazdás dimenzió (`CharacterCoreCatalog`), CHAPTER az AI-nyitotta, gazdátlan, 90 nap
üresen visszavonuló fejezet. A Szkeptikus és Mezo **szándékosan nincs** a
`CharacterExpertCatalog`-ban; a megfigyelő-kör és a javaslat-kör `byKey`-jel old fel, ismeretlen
kulcsnál kihagy. A kontrakt `kind` enumja két helyen `CORE|CHAPTER`; a FE `MaturityRing` csak
CORE-t rajzol, a `DimensionsPage` a CHAPTER-t szaggatottan.

**Csapdák.** ArchUnit freeze store (két tolerált ciklus; a két új él egyirányú); a fókuszált
kapu `-Dtest='*Character*,DetectorTest,ArchitectureTest'`; VITE_USE_MOCK unset = mock;
a `TrendWindow` literáljai; `contextLabel`/`tone` éjszakai töltése (a 02:50-es kör a mai
említéseket még címkézetlenül láthatja); a `INVENTORY_ROUNDS` kiürülése két tesztet tör
(`AdatforrasokPage.test`, `KorPage.test`) — őszinte üres állapotot kell tervezni.

## 4. Döntések

### 4.1 A határ: a claim alanya dönt

**Elv:** nem az adat forrása, hanem a **claim alanya** dönti el, hova kerül egy állítás. Ami a
felhasználóról szól, a 7 CORE dimenzió egyikébe megy, a dimenzió gazdájának hangján. Ami a
társ saját teljesítményéről szól — mennyire voltak jók a javaslatai, predikciói, questjei — az
egy új, fix **`META` dimenzióba** („A társ önvizsgálata"), a **Szkeptikus** hangján.

A döntés súlyozott mérlege (súly = felhasználói érték):

| Szempont | Súly | Csak felhasználó-viselkedés | META-fejezet a Szkeptikusnál |
|---|---|---|---|
| Őszinteség (a claim alanya tényleg az, akiről szól) | 5 | ✗ a triázs-adatot a felhasználóra kellene tolni | ✓ |
| Bizalom-kalibráció (tudod, mikor higgy a társnak) | 5 | ✗ ez az adat sehol nem jut el olvashatóan | ✓ |
| A dosszié fókusza | 4 | ✓ | ○ külön, elhatárolt fejezet kell |
| Tartalom a körben | 3 | ✗ 4 detektor | ✓ 8 detektor |
| Rendszer-hiba felhasználó-tulajdonságként | 5 | ✗ pont ez a kockázat | ✓ |
| Prompt-blokk használhatóság | 3 | ○ | ✓ a társ szerényebb lehet |

Következmények:

- A `knowledge-rejection-pattern` **nem** a felhasználó „elutasító hajlamát" méri, hanem a
  társ javaslatainak megtartási arányát. ÉRZÉKENY marad (a felhasználó *dönt* benne), de a
  mondat alanya a rendszer.
- A `[Karakter]` prompt-blokkba a META-claimek **bekerülnek** (Daniel döntése), CORE után,
  CHAPTER előtt, azzal a fejléc-mondattal, hogy ezek a társ saját találati arányáról szólnak
  és a válaszaiban ehhez tartsa magát.
- A Csapat-oldalon a Szkeptikus szerepe (`SKEPTIC`) nem változik; a `dimensionKey`-e `self-audit`
  lesz (eddig null).

### 4.2 A META dimenzió-fajta

- **Migráció:** `ck_character_dimension_kind` → `('CORE','CHAPTER','META')`.
- **Katalógus:** `CharacterCoreCatalog.META` egyetlen taggal:
  `("self-audit", "A társ önvizsgálata", "szkeptikus")`. Az `ensureCoreDimensions` a CORE + META
  listát veti (8 sor), `kind = "META"`. A havi stale-visszavonás kind-alapú (`CHAPTER`), a META
  sosem esik bele. A bootstrap ugyanazt a vetést hívja.
- **Szkeptikus mint megfigyelő és javaslattevő:** `CharacterExpertCatalog.EXPERTS` marad 7
  (a Csapat-oldal és a `MaturityRing` ezen nyugszik); új `CharacterExpertCatalog.SKEPTIC`
  `Expert` rekord (`key="szkeptikus"`, `primaryDimensionKey="self-audit"`, saját
  `systemPersona`: *„Te vagy a Szkeptikus … most a társ önvizsgálatát írod. A jelek Mezo saját
  javaslatainak, predikcióinak és questjeinek találati arányáról szólnak. Mindig a rendszerről
  állíts, sosem Daniel tulajdonságáról; a Tudástár-döntéseket tükörként, ÉRZÉKENY jelöléssel
  fogalmazd."*). A `byKey` az `EXPERTS` után a `SKEPTIC`-ben is keres. A Csapat-DTO
  szkeptikus-sora a `SKEPTIC` rekordból származik (`displayName`, `role`, `voiceLine`, `watch`
  változatlan szöveggel, `dimensionKey = "self-audit"`).
- **Ismert kulcsok:** a megfigyelő-kör `KNOWN_DIMENSION_KEYS`, a javaslat-kör
  `CORE_DIMENSION_KEYS` és `CORE_DIMENSION_TO_EXPERT` a CORE + META unióján.
- **Ítélet-kör:** a Szkeptikus-prompt egy mondattal bővül: a `self-audit` dimenzió javaslatait —
  amelyek a saját szerepéből jöttek — ugyanazzal a szigorral bírálja, és különösen azt nézi,
  hogy az alany tényleg a rendszer-e.
- **Prompt-blokk:** `CharacterPromptAssembler` sorrend CORE (katalógus-sorrend) → META →
  CHAPTER (`createdAt`); a blokk-fejléc bővül: *„az önvizsgálat sorai a saját találati arányomról
  szólnak — ezekhez tartsd magad, ne ígérj magabiztosabban, mint amit igazolnak"*.
- **Kontrakt:** `CharacterDimensionSummary.kind` és `CharacterDimensionResponse.kind` enum
  `CORE|CHAPTER|META`; `CharacterExpertDto.dimensionKey` leírása: „null a mezo-nál; a
  szkeptikusnál a META dimenzió kulcsa". FE kliens regen (`pnpm generate:api`), contract-drift
  kapu.
- **ADR:** rövid ADR *„META dimension: the companion's self-audit claims live beside, not inside,
  the user's dossier"* — a sorszám közvetlenül merge előtt ellenőrizve az `origin/main`
  `docs/decisions/` listáján (ismert ütközés-csapda).

### 4.3 Kapu-architektúra: a 4. körben nincs új-adat előszűrő

A 3. kör elve („ahol a hiány a jel, ott nincs előszűrő") itt egy lépéssel tovább megy. A kör
tervezése közben kiderült egy **kombinációs hiba**: az új-adat előszűrő és az állapotváltás-kapu
együtt **el tudja nyelni** az átmenetet, ha az egy adat nélküli napon történt. Példa: a 28 napos
triázs-ablakból egy csendes napon kiöregszik három elutasítás, az állapot „elutasító"-ról
„vegyes"-re vált — de aznap nincs döntés, az előszűrő zárva. A következő döntés napján a nap és
a nap−1 állapota már egyaránt „vegyes": a kapu nyitva, az állapotváltás-kapu viszont nem lát
különbséget. A jel **soha** nem szólal meg.

Ezért a 4. kör **egyetlen detektora sem használ új-adat előszűrőt**; az állapotváltás-kapu
(kvalitatív állapot a napra és a nap−1-re, csak nem-null eltéréskor tüzel) önmagában elegendő
túltüzelés-védelem, és nem nyel el átmenetet. A `DetectorGates` nem bővül.

Ugyanez a hiba elvben a 3. kör öt előszűrős detektorát is érinti (`self-calibration`,
`promise-vs-delivery`, `decision-profile`, `gratitude-focus`, `checkin-latency`). Nem ennek a
körnek a hatóköre; §9 nevesíti utómunkaként.

**Az állapotkulcsba soha nem kerül mozgó szám** — sáv- és címke-érték igen (domén-név, slot-név,
kategória-név).

**Ablakhosszak.** Mind elfér a 8 hetes (56 napos) sorozatban úgy, hogy a nap−1 kiértékelés is
teljes adatot lát (ablak + 1 ≤ 56): 28 nap (`mention-context-shift`, `chat-topic-shift`,
`knowledge-rejection-pattern`, `quest-completion-calibration`), 42 nap (`people-mood-link`),
49 nap (`weekend-gap`, `prediction-calibration`, `experiment-outcome-ledger`).

### 4.4 A szabad szöveg határa (a 3. kör elve, változatlanul)

Egyetlen detektor sem olvas tartalmat. Ahol a leltár „szöveget" nevezett, a strukturált mező
lett a jel: a Tudástár-döntés (`userDecision`), a quest státusza, a predikció státusza és
konfidenciája, az említés `contextLabel`-je. A `contextLabel`-t az emberek-feature éjszakai
osztályozója írja (zárt halmaz, DB-CHECK); a detektor **egy másik feature által perzisztált
strukturált mezőt** olvas, nem szöveget — és a mondat kimondja, hogy „a rendszer által
címkézett". A `tone`/`intensity` nem kerül felhasználásra: a hangulat-oldal a felhasználó saját
check-in skálája, nem a gép becslése.

Nyers szöveg csak **korlátozott bizonyítékként** jut a personához, a `JournalNoteDetector`
precedens szerint: a `chat-topic-shift` két beszélgetés-címet visz (120 karakter,
determinisztikus válogatás, sosem elemezve). A quest szövege és a memoár prózája **soha**.

### 4.5 Érzékenység

`knowledge-rejection-pattern` ÉRZÉKENY: a Szkeptikus megfigyelő-personája és a javaslat-kör
promptja (amely már nevesíti az „elutasítás-mintázati" osztályt) jelöli; kódszintű kapu nincs,
a megfogalmazás a védelem. A többi hét nem érzékeny: a `people-mood-link` együttjárást mond,
irányt nem, embert nem nevez; a `weekend-gap` szokást ír le, nem diagnózist.

## 5. A nyolc detektor

Közös: `@Component`, `@ConditionalOnProperty(CHARACTER_SWITCH)`, `key()`, `detect(in)`; állapot
a napra és a nap−1-re; csak nem-null eltéréskor `DetectorSignal`; HU tizedesvessző
(`TrailingWindow.hu`); minden mondat a **saját számításával** egyeztetve (a 3. kör
záró-review-tanulsága: a per-task review nem fogja meg, ha a mondat mást mond, mint a szám).

### 5.1 `people-mood-link` — antropologus (life)

**Kérdés:** a mentális check-in máshol áll-e azokon a napokon, amikor embert említesz?

- Ablak 42 nap. Említés-nap = bármely `MentionPoint.date` az ablakban (személytől
  függetlenül). Páros nap = `CheckinDayPoint` nem-null `mental`-lal.
- Csoportok: M (említés-napok, mental-lal), O (többi nap, mental-lal). Gate: |M|+|O| ≥ 14,
  |M| ≥ 3, |O| ≥ 3 (a `ComfortEatingDetector` alakja).
- Δ = átlag(M.mental) − átlag(O.mental). Állapot: Δ ≥ +1,0 → `magasabb`; Δ ≤ −1,0 →
  `alacsonyabb`; egyébként null (a comfort-eating precedens: csak megjelenés vagy előjelváltás
  tüzel).
- Bizonyosság |M| alapján, csak a mondatban: 3–7 `gyenge`, 8–15 `közepes`, >15 `erős`.
- Mondat: *„Az elmúlt 6 hét {m} napján, amikor embert említettél, a mentális check-in átlaga
  {x} volt, a {o} említés nélküli napon {y} — {magasabb|alacsonyabb} együttjárás, {tier}
  bizonyossággal ({m} nap). Együttjárás, nem irány; embert nem nevez."* Salience 4 ha `erős`,
  különben 3.

### 5.2 `mention-context-shift` — antropologus (life)

**Kérdés:** eltolódik-e, milyen kontextusban kerülnek elő az emberek?

- Ablak 28 nap; címkézett említések (`contextLabel != null`) száma ≥ 6, különben null.
- Domináns címke = legnagyobb részarány (holtverseny: ábécé, determinizmusért).
  Konfliktus-sáv a `konfliktus` részarányából: <10% `nincs`, 10–30% `jelen`, >30% `magas`.
- Állapot: `{domináns}|{konfliktus-sáv}`. Címkézetlenek száma a mondatban.
- Mondat: *„Az elmúlt 4 hét {n} címkézett említéséből a legtöbb {label}-kontextusú ({p}%), a
  konfliktus-részarány {q}% ({sáv}); korábban {prevLabel}/{prevSáv} volt. {u} említés még
  címkézetlen — a címkét a rendszer éjszakai osztályozója adja, nem te."* Salience 4 ha a
  konfliktus-sáv `magas`-ra lép, különben 3.

### 5.3 `weekend-gap` — antropologus (life)

**Kérdés:** mennyire szakad ketté a hét — alvásritmusban és logolásban?

- Ablak 49 nap. Hétvége = Szo/V a szerver-zónában (vállalt korlát, a mondat nem nevezi
  kötelezettség-rendnek).
- **Social jetlag:** `SleepPoint` `bedtime`/`wakeup` nem-null sorok; szabad-éjszaka = a sor
  `date`-je Szo/V (a napló `date`-je az ébredés napja), munka-éjszaka = H–P. Alvásközép
  percben: `bed = perc(bedtime)`, `wake = perc(wakeup)`, ha `wake ≤ bed` → `wake += 1440`,
  `mid = ((bed + wake) / 2) mod 1440`. Gate: ≥ 6 szabad, ≥ 15 munka. SJL = |átlag(szabad) −
  átlag(munka)|; sáv: <60 `nincs`, 60–119 `mérsékelt`, ≥120 `jelentős`; gate alatt `kevés`.
- **Logolás-rés:** egy nap „logolt", ha van `MealDayPoint` vagy `CheckinDayPoint` vagy
  `WaterDayPoint` a dátumon. Lefedettség hétvégén és hétköznap (logolt napok / ablakbeli
  napok). Rés-flag, ha `hétköznap − hétvége ≥ 0,25` → `rés`, különben `nincs-rés`.
- Állapot: `{jetlag-sáv}|{rés-flag}` — sosem null (a lefedettség mindig számolható).
- Mondat két tagból: *„Hétvégén az alvásközéped átlag {k} perccel {később|korábban} esik, mint
  hétköznap — {sáv} social jetlag a Roenneberg-sávok szerint, {f} szabad- és {w}
  munkaéjszakából."* (gate alatt: *„Az alvásközép-eltoláshoz még kevés a hétvégi alvásnapló
  ({f} éjszaka)."*) *„A logolás hétvégén a napok {a}%-án történt, hétköznap {b}%-án{ — hétvégi
  rés|, nincs érdemi rés}. Hétvége itt szombat–vasárnap."* Salience 4 ha `jelentős` vagy `rés`,
  különben 3.

### 5.4 `chat-topic-shift` — pszichologus (mental)

**Kérdés:** mi körül forognak mostanában a beszélgetéseid a társsal?

- Forrás: asszisztens-sorok `toolCalls` nevei (az eszköz-név az első `(` előtt). Domén-térkép
  backend-konstans (`ChatToolDomains`), a FE `toolDomains.ts` tükre: `suly` (get_weight_log,
  get_weight_trend), `alvas` (get_recovery), `fuel` (get_fuel_log, get_pantry, get_recipes,
  get_protocol), `edzes` (get_training_log, get_training_plan, get_exercise_records), `cel`
  (get_goal, get_growth, get_daily_practice), `mintak` (get_insights, find_similar_past_days,
  compare_periods), `gyogyszer` (get_medication). Ismeretlen eszköz nem számít.
- Ablak 28 nap; hívások ≥ 10 és a domináns domén részaránya ≥ 40%, különben null.
- Állapot: a domináns domén. A „korábban" a nap−1 állapota (az eltolódás maga az
  állapotváltás).
- Bizonyíték: a domináns domén eszközét hívó két legfrissebb beszélgetés címe
  (`AiConversationEntity.title`, 120 karakter), determinisztikus (legfrissebb hívás-dátum,
  majd conversationId).
- Mondat: *„Az elmúlt 4 hétben a társsal folytatott beszélgetéseid {p}%-a a(z) {domén} körül
  forgott ({n} eszközhívás); korábban a(z) {prev} volt az első. Két friss beszélgetés:
  „{cím1}", „{cím2}"."* Salience 3.

### 5.5 `knowledge-rejection-pattern` — szkeptikus (self-audit) — **ÉRZÉKENY**

**Kérdés (a rendszerről):** mekkora arányban tartod meg a társ javasolt tényeit és mintáit?

- Forrás (`MetaWindow.triageDecisions`): `LearnedFact` döntött sorai (`userDecision` nem null),
  dátum = a jelölt `createdAt`-ja (**proxy — a mondat kimondja**), kategória train|fuel|health|
  life, `kept` = accept|refine (refine külön számolva), `rejected` = reject; `PatternEvent`
  confirmed|rejected sorai, dátum `occurredAt`, kategória `minta`.
- Ablak 28 nap; döntések ≥ 5, különben null.
- Megtartási arány sávja: ≥0,70 `megtartó`, 0,40–0,70 `vegyes`, <0,40 `elutasító`. Domináns
  elutasított kategória: ha elutasítás ≥ 3 és egy kategória ≥ 50%-uk → a kategória, különben `-`.
- Állapot: `{sáv}|{kategória}`.
- Mondat: *„Az elmúlt 4 hétben {n} javaslatomról döntöttél: {k} megtartva ({r} finomítva),
  {j} elutasítva — {p}% találati arány{, az elutasítások főleg {kat} kategóriából}. Ez az én
  javaslataim minőségéről szól, nem a te tulajdonságodról. A tény-jelöltek döntésnapját a jelölt
  keletkezési napjával közelítem."* Salience 4 ha `elutasító`, különben 3.

### 5.6 `prediction-calibration` — szkeptikus (self-audit)

**Kérdés (a rendszerről):** mennyire volt igazam, és mennyire voltam magabiztos közben?

- Forrás (`MetaWindow.predictions`): predikciók `validTo` az ablakban és `validTo < asOf`
  (zárás napja = `validTo + 1`, a mondat kimondja). Zárult = `validated|missed`; `pending`
  lejárt = adat nélkül, külön számolva, nem része az aránynak.
- Ablak 49 nap; zárult ≥ 4, különben null.
- Találati arány = validated / zárult. Átlag-konfidencia a nem-null `confidence`-ekből; ha a
  zárultak kevesebb mint felének van konfidenciája → állapot `nincs-konfidencia`. Különben Δ =
  átlag-konfidencia − találati arány: ≥0,20 `túlbiztos`, ≤−0,20 `alulbiztos`, egyébként
  `kalibrált`.
- Állapot: a sáv.
- Mondat: *„Az elmúlt 7 hétben {n} predikcióm zárult: {v} talált, {m} nem ({p}%), miközben
  átlagosan {c}% magabiztosságot mondtam — {sáv}. {e} további lejárt adat nélkül, azokat nem
  számolom. Zárás napja az érvényesség vége utáni nap."* (`nincs-konfidencia`: *„… a
  többségükhöz nem mondtam magabiztosságot, így kalibrációt nem tudok mérni."*) Salience 4 ha
  `túlbiztos`, különben 3.

### 5.7 `quest-completion-calibration` — szkeptikus (self-audit)

**Kérdés (a rendszerről):** jól lőttem-e be a questek nehézségét slotonként?

- Forrás (`MetaWindow.quests`): `questDate` az ablakban és `questDate < asOf` (a napi
  véglegesítő cron 00:05-kor zárja az előző napot; a mai még nyitott), `status != rerolled`.
- Ablak 28 nap (a quest-motor saját ablaka). Slotonként: N < 5 → `kevés`; különben arány =
  completed / N: ≥0,85 `magas`, ≥0,50 `közép`, <0,50 `alacsony` (a motor saját 0,85 / 0,50
  sávjai).
- Állapot: `BODY:{x}|FUELBIO:{y}|GROWTH:{z}`; null, ha mindhárom `kevés`.
- Mondat: *„A questkínálatom 4 heti mérlege: BODY {c1}/{n1} ({p1}%), FUELBIO {c2}/{n2} ({p2}%),
  GROWTH {c3}/{n3} ({p3}%){ — a(z) {slot} slotban a nehézség-kalibrációm túllőtt}. A motor saját
  sávjai (85% / 50%) szerint; a quest szövegét nem olvasom."* (`kevés` slot: *„{slot}: kevés
  quest ({n})"*.) Salience 4 ha bármely slot `alacsony`, különben 3.

### 5.8 `experiment-outcome-ledger` — szkeptikus (self-audit)

**Kérdés (a rendszerről):** a javasolt kísérleteim és kihívásaim mire vezettek?

- Forrás (`MetaWindow.proposalOutcomes`): kísérletek `generatedAt` az ablakban — `completed`
  (kimenet = `outcomeGood`), `dismissed`; kihívások `workoutDate` az ablakban — `hit` (jó),
  `miss` (rossz), `inconclusive` (eldönthetetlen, az arányból kimarad), `dismissed`.
- Ablak 49 nap. Ítélt = jó + rossz; ítélt ≥ 3 → jó-arány sáv: ≥0,67 `jó`, ≥0,34 `vegyes`,
  <0,34 `gyenge`; ítélt < 3 → `kevés`. Elvetett-flag: elvetett / (elvetett + ítélt +
  eldönthetetlen) ≥ 0,5 és elvetett ≥ 3 → `többség-elvetve`, különben `-`.
- Állapot: `{sáv}|{flag}`; null, ha `kevés|-`.
- Mondat: *„Az elmúlt 7 hét {n} lezárt javaslatomból ({e} kísérlet, {c} kihívás) {g} járt jó
  kimenettel{, {i} eldönthetetlen}; {d} javaslatot elvetettél indulás előtt. Ez a javaslataim
  minősége, nem a te vállalkozó kedved."* Salience 4 ha `gyenge` vagy `többség-elvetve`,
  különben 3.

## 6. Olvasás-bővítés

### 6.1 `TrendWindow` — három közvetlen komponens + egy fészkelt ablak

```java
public record MentionPoint(LocalDate date, UUID personId, String contextLabel, boolean flagged) {}
public record ChatToolCallPoint(LocalDate date, UUID conversationId, String toolName, String titlePreview) {}
public record SleepPoint(LocalDate date, Integer quality, BigDecimal durationH, Integer awakenings,
                         LocalTime bedtime, LocalTime wakeup) {}   // bővül; HH:mm parse, hibás → null

public record TriageDecisionPoint(LocalDate date, String source /*fact|pattern*/, String category,
                                  String decision /*kept|rejected*/, boolean refined) {}
public record PredictionPoint(LocalDate validFrom, LocalDate validTo, String status,
                              BigDecimal confidence, String metricKey) {}
public record QuestPoint(LocalDate questDate, String slot, String status) {}
public record ProposalOutcomePoint(LocalDate date, String kind /*experiment|challenge*/,
                                   String status, Boolean outcomeGood) {}
public record MetaWindow(List<TriageDecisionPoint> triageDecisions, List<PredictionPoint> predictions,
                         List<QuestPoint> quests, List<ProposalOutcomePoint> proposalOutcomes) {}
```

`TrendWindow` végére: `List<MentionPoint> mentions, List<ChatToolCallPoint> chatToolCalls,
MetaWindow meta`. A `SleepPoint` bővítése minden építőhelyet érint (a `DetectorTest` literáljai
is).

### 6.2 Két olvasó

- **`CharacterSignalReads`** (+2 függőség: `MentionRepository`, `CharacterMetaReads`):
  `gatherMentions` (a meglévő `ts`-ablak-finder, felülről `day+1` kezdete), `gatherChatToolCalls`
  (a meglévő szerep-paraméteres `createdAt`-ablak-finder `role='assistant'`-tal; a cím a
  `message.getConversation().getTitle()`-ből, `preview()` 120), `toSleepPoint` bővítése.
- **`CharacterMetaReads`** — új `@Service` a `service/` alatt, ugyanazzal a kapcsolóval, hat
  függőséggel (`LearnedFactRepository`, `PatternEventRepository`, `PredictionRepository`,
  `DailyQuestRepository`, `ExperimentRepository`, `ChallengeRepository`), `gather(owner,
  trendStart, day) → MetaWindow`. Indok: a jelolvasó már 28 függőségű, és a rendszer-oldali
  források saját egységet és saját IT-t érdemelnek.

### 6.3 Új finderek

- `LearnedFactRepository.findByCreatedByAndUserDecisionIsNotNullAndCreatedAtGreaterThanEqualAndCreatedAtLessThanAndDeletedFalse(owner, from, toExcl)`
- `PatternEventRepository.findByCreatedByAndKindInAndOccurredAtGreaterThanEqualAndOccurredAtLessThanAndDeletedFalse(owner, kinds, from, toExcl)`
- `PredictionRepository.findByCreatedByAndValidToBetweenAndDeletedFalse(owner, from, to)`
- `ExperimentRepository.findByCreatedByAndGeneratedAtGreaterThanEqualAndGeneratedAtLessThanAndDeletedFalse(owner, from, toExcl)`
- `ChallengeRepository.findByCreatedByAndWorkoutDateBetweenAndDeletedFalse(owner, from, to)`
- Meglévő: `MentionRepository` ts-ablak, `AiMessageRepository` szerep+ablak,
  `DailyQuestRepository.findByCreatedByAndQuestDateBetweenOrderByQuestDateDesc`.

### 6.4 Őszinteségi szabályok

- Minden olvasás felülről `day`-jel határolt. **Két forrásnál a státusz helyben mutálódik
  időbélyeg nélkül** (predikció `status`, kísérlet/kihívás `status`/`outcomeGood`): egy
  catch-up futás a *mai* státuszt látja, nem az akkorit. A spec ezt vállalt korlátként rögzíti;
  a detektor-mondatok nem állítanak „aznapi" tudást.
- Instant → `ZoneId.systemDefault()` mindenhol.
- Hiány ≠ nulla: `tone`/`contextLabel` null = címkézetlen, `confidence` null = nem mondott
  magabiztosságot, `bedtime`/`wakeup` null = a sor kimarad az alvásközépből.

### 6.5 ArchUnit

Két új egyirányú él: `character → people`, `character → quest`. A `character → companion` és
`character → proactive` él már létezik (szélesedik). A freeze store érintetlen; ha az
`ArchitectureTest` bővült/új fagyasztott ciklust jelez, a munka BLOCKED, a store-hoz nem
nyúlunk.

## 7. Felület, dokumentáció

- **`inventory.ts`:** a 4. kör sora törlődik → `INVENTORY_ROUNDS` **üres tömb** (a típus
  marad); hét új `INVENTORY_READS` sor (említések, alvás bedtime/wakeup, chat-eszközhívások,
  Tudástár-döntések + minta-események, predikciók, questek, kísérlet/kihívás-kimenetek);
  `INVENTORY_LATER` két indokolt sorral bővül (Szezonalitás — két év azonos naptári ablaka
  kell; Memoár — nincs strukturált mezője), a `Súly-naplózási rés` sor marad.
- **Adatforrások „Tervezett":** őszinte üres állapot — *„Mind a négy kör bekötve."* egy
  `kr-degraded`-stílusú sor helyett saját `kr-laterline` eyebrow, alatta a `+ még N terület
  később` farok változatlanul. `AdatforrasokPage.test` és `KorPage.test` ehhez igazodik; a
  `/kor/:n` nem-található ága marad.
- **Detektorok:** `DETECTORS` 32 → 40, a Szkeptikus négye `who: 'szkeptikus'`
  (`expertColors` már ismeri); a fejléc-komment folytatja a kör-krónikát.
- **Mock:** `DIM_SEEDS` kap egy META dimenziót (`self-audit`, 2 szkeptikus-claim, egyik
  ÉRZÉKENY); nyolc új `CHAIN_POOL` lánc (`refs: []`, valós gazda, a valós küszöböket kielégítő
  számok; a 15. nap érintetlen). A hub sorszám-sora: `7 + önvizsgálat` (+ `N fejezet`, ha van).
- **Dimenziók-oldal:** META csempe saját jelöléssel (`◎`, `.kr-dimtile.meta`), nem a szaggatott
  CHAPTER; `DimensionPage` alcím META-nál „a társ önvizsgálata · Szkeptikus". `MaturityRing`
  változatlan (csak CORE).
- **Docs:** `character.md` §1/§5/§9/§10 (40-es katalógus, META fajta, 4.3 kapu-elv, két új él,
  a stale 20/32 számok normalizálva); ADR; CODEMAP regen; `lint-docs --errors-only`.

## 8. Tesztelés és kapuk

- **`DetectorTest`:** detektoronként ≥ 3 eset (sávba lépés, sávváltás, gate alatt csend;
  a `weekend-gap`-nél az éjfél-átlépő alvásközép és a `kevés` ág; a `chat-topic-shift`-nél a
  bizonyíték-válogatás determinizmusa; a `prediction-calibration`-nél a `nincs-konfidencia` ág).
  `TrendBuilder` egy setterrel bővül komponensenként. A fixtúrákat a küszöbökből kell
  visszaszámolni — **a fixtúra javul, sosem a küszöb** (3. kör tanulsága: öt fixtúra volt rossz).
- **`CharacterSignalReadsIT`:** említés- és chat-eszközhívás-olvasás catch-up felső határral,
  bedtime/wakeup parse, üres tulajdonos.
- **`CharacterMetaReadsIT`** (új): mind a négy lista, felső határ, üres tulajdonos; a
  populátorok már léteznek (`LearnedFactPopulator`, `PatternEventPopulator`,
  `PredictionPopulator`, `QuestPopulator` + kísérlet/kihívás-mentés).
- **META:** vetés-teszt (8 sor, kind META, gazda szkeptikus); megfigyelő-kör Szkeptikus-útvonal
  (`self-audit` jel → szkeptikus megfigyelés); javaslat-kör (`self-audit` ismert kulcs, szkeptikus
  javaslat érvényes); `CharacterPromptAssembler` sorrend CORE → META → CHAPTER és a bővült
  fejléc; Csapat-DTO `dimensionKey`; `CharacterApiSwitchOffIT` bean-felsorolás a nyolc új
  detektorral.
- **Kapuk:** backend fókuszált `-Dtest='*Character*,DetectorTest,ArchitectureTest'
  -Dmezo.test.use-testcontainers=true` (soha teljes suite lokálisan); kontrakt regen +
  contract-drift; FE mindkét mód + build; CODEMAP; `lint-docs --errors-only`. CI a merge-refen
  — ha a main mozdult, merge + CODEMAP regen + minden kapu újra.
- **SDD:** sonnet implementerek + task-reviewerek, haiku scoped re-review, **opus záró
  teljes-ág review**, külön figyelemmel arra, hogy minden Szkeptikus-mondat alanya a rendszer.

## 9. Hatókörön kívül, utómunka

- **Szezonalitás** és **Memoár** — `INVENTORY_LATER`, indokkal (§2, §3).
- **Gráf-jelölt elutasítások** (soft delete, natív számlálás kellene) — a
  `knowledge-rejection-pattern` későbbi bővítése.
- **Előszűrő + állapotváltás kombinációs hiba a 3. kör öt detektorában** (§4.3) — külön bd,
  a kör után: vagy az előszűrő elhagyása, vagy „utolsó tüzelt állapot" alapú összevetés.
- **`decidedAt` a `learned_fact`-on**, **`resolvedAt` a `prediction`-ön** — a forrás-feature-ök
  adóssága; a detektorok a proxyt kimondják, amíg nincs.
- A kör végén: `mezo-1gim.15` zárható; `mezo-1gim.12` maradéka (`weight-gap`) és az
  `INVENTORY_LATER` farok külön bd-be.
