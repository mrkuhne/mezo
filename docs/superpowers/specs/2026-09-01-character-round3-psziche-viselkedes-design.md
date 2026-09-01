# Karakter — 3. kör: psziché & viselkedés-meta (design)

**bd:** mezo-1gim.15 (3. kör) · **Előzmények:** [1. kör](2026-08-31-character-round1-edzes-test-design.md),
[2. kör](2026-09-01-character-round2-fuel-ciklus-design.md), [epic](2026-08-27-user-character-dossier-design.md)
**Domain-doc:** [`docs/features/character.md`](../../features/character.md)

## 1. Cél

A Karakter-dosszié bemeneti korpuszának harmadik körű bővítése: a `MINDENT be` leltár
(`frontend/src/features/character/inventory.ts`, `INVENTORY_ROUNDS` n=3) „Psziché &
viselkedés-meta" sorainak valódi bekötése — hat új domain-olvasás és **tizenkét** új
determinisztikus detektor. A katalógus 20-ról 32-re nő.

Ez a kör nem a *mit csinál* (edzés, evés), hanem a **hogyan viszonyul hozzá** rétegét nyitja meg:
mit ígér magának és mit zár le, mennyire kalibrált az önértékelése, hogyan reagál egy megszakadt
sorozatra, mikor és mennyi idővel utólag naplóz, és mikor van ébren.

### A kör mércéje

Daniel a 2. kör tervezésekor ezt szabta meg, és a 3. körre is ez érvényes — szó szerint:

> „mehet az A, de akkor ha annak van értelme. ne azért válasszuk, mert már felépült a kódbázis
> hozzá, max építünk tovább ha kell. nem az a lényeg hogy minél kevesebb munka legyen, hanem
> hogy pontosak legyünk."

Gyakorlati következménye ebben a körben kétszer is kimutatható: a `retro-logging-ratio` a drágább,
tíz entitást bekötő változatban készül el (nem a három adatpontos olcsóban), és a `self-calibration`
szándékosan **kevesebb** skálát dolgoz fel, mint amennyi rendelkezésre áll — mert csak kettőnek van
becsületes objektív párja.

## 2. Prior art

A `researcher` recon jelentése alapján, szűrve.

**Átvéve:**

- **Önértékelés vs. objektív mérés eltérése** mint kutatott konstrukció létezik és mérhető
  (subjective–objective sleep discrepancy, „sleep state misperception"), és a friss szakirodalom
  szerint stabil egyéni jellemző, nem zaj —
  [PNAS/PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11761674/),
  [J Clin Sleep Med](https://jcsm.aasm.org/doi/10.5664/jcsm.9348).
  **De:** minden validáló vizsgálat hetekben-hónapokban mér, EEG/aktigráfia ground-truth-tal.
  14 nap + önválasztott proxy ennél lényegesen gyengébb állítás. → A `self-calibration` ezért
  **irányt** jelez (egyezik / nincs jel / fordított), soha nem pontszámot vagy százalékot, és a
  saját leírása kimondja, hogy egyetlen ablak nem jellemvonás.
- **Visszamenőleges naplózás mint adatminőségi jel** megalapozott: a napló-kutatás szerint a
  minőségromlás órákon belül elindul, és a 8–24 órán túli felidézés mérhetően gyengébb —
  [SAGE, time-diary recall](https://journals.sagepub.com/doi/10.1177/00811750221126499),
  [24h dietary recall toolkit](https://www.measurement-toolkit.org/diet/subjective-methods/24-hour-dietary-recall).
  → Ez adja a `retro-logging-ratio` vágópontját: **ugyanaz a naptári nap = azonnali**, minden más
  utólagos. Nem önkényes küszöb, hanem a szakirodalom „same-day gold standard" konvenciója.
  **Korlát, ami a megfogalmazásba kerül:** a kutatás a *részletgazdagságot* méri, nem azt, hogy egy
  utólag beírt szám hamis — a detektor tehát nem állíthatja, hogy a retro-logolt adat rossz.

**Elutasítva / óvatosan kezelve:**

- **Streak-pszichológia** („what-the-hell effect", abstinence violation effect) valós konstrukció,
  de **nincs validált numerikus vágópont** arra, hogy hány nap újraindulási késés „egészséges".
  Az egyetlen valódi empirikus adatpont egy n=17-es kvalitatív futó-streak vizsgálat
  ([PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0317254)), ami
  szerint az összeomlás **kockázat, nem alapeset**. → A `restart-pattern` küszöbei **bevallott
  heurisztikák**: a detektor javadocja és a Gépterem-leírása is kimondja, hogy nincs mögöttük
  validált határ. A „missing twice starts a new pattern" iparági szabályt **nem** vesszük át:
  Lally habit-automaticity vizsgálatának laza parafrázisa, nem eredmény.
- **Termék-precedens a nem-ítélkező mondatra** (Oura/WHOOP): a szándék dokumentált, a kivitel nem —
  független UX-elemzések szerint a WHOOP szövegeinél gyakran nem derül ki, hogy a közölt tény jó
  vagy rossz hír ([925 Studios](https://www.925studios.co/blog/whoop-design-breakdown)). → Ebből
  csak a **elkerülendő hibát** vesszük át: a mondat legyen tényszerű ÉS egyértelmű valenciájú
  abban, hogy megfigyelés, nem ítélet. Nincs átvett szövegsablon.

## 3. Codebase terrain

Az `investigator` recon jelentése alapján, szűrve. Minden mező kódban ellenőrizve.

**Érintett szeletek és a pontos mezők:**

| forrás | entitás | a felhasznált mezők |
|---|---|---|
| napi fókusz | `feature/intention/entity/IntentionFocusEntity` | `focusDate LocalDate`, `text String(200)`, `createdAt` |
| napzárás | `feature/intention/entity/DailyIntentionEntity` | `intentionDate LocalDate`, `reflection String(8)` — zárt: `yes`/`partial`/`no` (`REFLECTION_*` konstansok) |
| döntésnapló | `feature/journal/entity/DecisionEntryEntity` | `decidedOn`, `reviewDue`, `reviewedAt Instant`, `outcomeRating Short @Min(1)@Max(5)`, `decisionText`, `createdAt` |
| hála | `feature/journal/entity/GratitudeEntryEntity` | `occurredOn`, `lifeArea String(16)` — zárt `@Pattern`: `mindfulness\|mindset\|cooking\|financial\|productivity\|learning\|connection\|recovery`, `createdAt` |
| Életjel-nap | `feature/needs/entity/NeedsDayEntity` | `needsDate`, `energia/hidratacio/pihenes/mozgas/lelek/rend int 0..100`, `greenCount`, `allGreen`, **`streakDays int` — naponként perzisztált pillanatkép** |
| check-in sor | `feature/biometrics/checkin/entity/CheckInEntity` | `date`, `slotTime String(5)` „HH:mm", `energy/stress/body/mental Integer 1..10`, `note String(500)`, `createdAt` |
| chat | `feature/companion/entity/AiMessageEntity` | `role String` (`user`), `createdAt Instant` |

**Tükrözendő domain-szemantika** (a 2. kör `FuelDayService#targetSet` precedense szerint):

- **Zöld-küszöb:** `NeedsProperties.greenThreshold` = **60** (`application.yml:1370`). A detektor nem
  olvashat configot → a küszöb a `DetectorInput`-ba utazik, ahogy a 2. körben a makró-célok.
- **Streak-szabály:** `NeedsService.closeNew` (`:74-79`) — a streak akkor nő, ha az **előző naptári
  napnak van sora ÉS az all-green**; különben 1-re (all-green nap) vagy 0-ra áll. A hiányzó sor
  tehát a domain saját szemantikája szerint törés. Ezt a 6. és 7. detektor tükrözi, és a javadoc
  kimondja, hogy ez tudatos tükrözés, nem az „absent ≠ zero" szabály megsértése.

**Csapdák — mindegyik kódba és tesztbe kerül:**

1. **`CheckInEntity.savedAt` NEM használható latenciára.** A `CheckInService.save()` minden
   upsertnél felülírja, tehát az utolsó szerkesztés ideje, nem az első íráse. A latencia
   `createdAt`-ból számol (`OwnedEntity`, immutábilis).
2. **`notification_schedule` NEM használható.** Ez a felület által írt, „teljes csere kategóriánként"
   szemantikájú tábla, **nincs történeti verziója** — egy múltbeli napra visszamenőleg hazudna.
   A `checkin-latency` ezért a check-in **saját sorában** tárolt `slotTime` címkét használja
   névleges időpontként, ami soronként, történethűen ott van.
3. **`GamificationProfileEntity` NEM használható.** Csak élő aktuális állapotot tárol
   (`streakDays`, `lastStreakDate`), nincs napi története — „mi volt a streak 13 napja" kérdésre
   nem tud válaszolni. A streak-detektorok a `NeedsDayEntity.streakDays` napi pillanatképéből
   dolgoznak.
4. **Időzóna.** Minden `Instant → LocalDate/LocalTime` konverzió `ZoneId.systemDefault()`-tal, a
   `CharacterSignalReads` meglévő konvenciója szerint (`:249-250`, `:483`). A `med-cycle-covariance`
   záró-review hibaosztálya (`character.md` §9) pontosan ennek megsértése volt.
5. **ArchUnit.** A kör két új **egyirányú** élt hoz: `character → intention`, `character → needs`.
   A recon ellenőrizte: sem az `intention`, sem a `needs` nem importál `feature.character`-t, tehát
   nincs új kör. A `journal` (döntés, hála), a `companion` (chat) és a `biometrics/checkin` már be
   van kötve. **Az `ArchitectureTest`-et külön nevesítve futtatni kell** — nincs benne a
   `*Character*` szűrésben.
6. **`JournalNoteDetector` precedens.** Már ma is nyers naplószöveget ad át a
   `DetectorSignal.summary`-ban — a detektor determinisztikusan *válogat*, az értelmezést a
   szakértő-persona végzi. Ez a kör ezt a mintát követi ott, ahol nyers szöveget használ (§4.3).

## 4. Döntések

### 4.1 A szabad szöveg határa

**Nem** épül LLM-kivonatoló réteg ebben a körben, és **nem** végez detektor szövegbányászatot.
A kör mind a tizenkét szála **strukturált mezőkből** épül (`reflection` enum, `outcomeRating`,
`lifeArea`, `streakDays`, skálák, időbélyegek). Ahol a nyers szöveg tényleg hozzátesz, ott a
`JournalNoteDetector` bevált mintája érvényes: a detektor **determinisztikusan válogat**, és a nyers
szöveget **bizonyítékként** adja át a szakértő-personának, értelmezés nélkül.

A döntés útja fontos, mert korrigál egy korábbi tévedést: az első javaslat egy éjszakai LLM-kivonatoló
réteg volt, azzal az indoklással, hogy metaadat-only mellett a nyolc szálból három kiürül. A recon
megmutatta, hogy ez **téves**: a `reflection` enum, az `outcomeRating` skála és a `lifeArea` zárt
címke pontosan azt a tartalmat hordozza strukturáltan, amihez LLM-et akartam hívni. A kivonatoló
réteg így a jegyzet- és döntés-szövegre szűkült volna — kevesebb, mint amennyit egy új tábla,
prompt, backfill és honesty-log-bővítés megér. **Külön bd-issue-ként marad nyitva**, ha később a
tartalom időbeli összehasonlítása valóban kell.

### 4.2 Ablak-architektúra

A 2. kör mintája, mert a források itt is túlnyomórészt **napiak** (check-in, intention, Életjel-nap,
chat): az „érkezett-e ma új adat" kapu majdnem mindig nyitva áll, ezért az elsődleges
túltüzelés-védelem az **állapotváltás-kapu**. Minden detektor kvalitatív állapotot számol a napra
és a nap−1-re, és csak nem-null eltéréskor szólal meg. Állapot nélkül, tábla nélkül.

**Az állapotkulcsba soha nem kerül mozgó számláló** — a 2. kör záró review-ja pontosan ezt buktatta
meg négy detektorban, és két teszt emiatt volt rossz okból zöld. Minden állapot sáv- vagy
címke-értékű.

A sorozatok kizárólag a 8 hetes `TrendWindow`-ban élnek; a detektorok `asOf` paraméterrel ablakoznak.
Két ablakhossz létezik:

- **14 nap** a napi forrásokra (`TrailingWindow.WINDOW_DAYS`).
- **hosszabb ablak** az epizodikus forrásokra, ahol 14 nap alatt nincs elég eset: döntések
  **42 nap**, hála **28 nap**, újraindulás **28 nap**. Mindegyik elfér a 8 hetes (56 napos)
  sorozatban úgy, hogy a nap−1 kiértékelésnek is teljes az adata (42+1 ≤ 56).

A `RoundTwoWindow` helper átnevezésre kerül **`TrailingWindow`**-ra (`git mv`), mert immár három kör
osztozik rajta, és a „round two" név félrevezetővé vált. Az `inWindow` kap egy `days` paraméteres
túlterhelést a hosszabb ablakokhoz.

### 4.3 A `self-calibration` objektív oldala

Négy önértékelt skála van (`energy`, `stress`, `body`, `mental`), de csak **kettőnek** van becsületes
objektív párja a rendszerben:

- `energy` ↔ **az előző éjszaka alvásminősége** (`SleepPoint.quality` 1..10; a `date` a napba vezető
  éjszaka, a companion konvenciója szerint — tehát a D napi skálához a D-re dátumozott `SleepPoint`
  tartozik)
- `body` ↔ **az aznapi legrosszabb ízületi fájdalom** a gym-visszajelzésből
  (`ExerciseWork.worstJointPain` 1..10, magasabb = rosszabb → `11 − pain` alakban fordítva)

A `mental` és a `stress` **kimarad**, és a detektor a saját leírásában **kimondja, hogy kimarad, és
miért**. Elutasított alternatíva: egy összevont „jó nap" index mind a négy skálához — a súlyozása
önkényes lenne, és egy önkényes szám kerülne a dosszié ÉRZÉKENY állításába.

Az edzés-teljesítést szándékosan **nem** vesszük objektív oldalnak: az „alacsony energia és mégis
megcsinálta" nem kalibrációs hiba, hanem akarat — a detektor összekeverné a kettőt.

### 4.4 Érzékenység

A `self-calibration` **ÉRZÉKENY**. A ház konvenciója szerint ez claim-szintű
(`CharacterClaimEntity.sensitive`), a konzílium proposal-promptja jelöli, a `PortraitWriter` és a
`CharacterPromptAssembler` rendereli az ÉRZÉKENY markert, a felületen a `ClaimTile` levendula-pöttyös
kerete jelzi. **Kódszintű kapu nincs**, ezért a detektor megfogalmazása maga a védelem: a
`self-calibration` összefoglalója megfigyelést közöl, nem minősít, és nem használ olyan szót, ami
az önértékelést „hibásnak" nevezi.

Új érzékenységi felület: a check-in `note` és a döntés `decisionText` **nyers részlete** bekerül a
`DetectorInput`-ba (§5.1, §5.3). Ez a dosszié eddigi legszemélyesebb bemenete. Korlátok: legfeljebb
**2 részlet** detektoronként, egyenként **120 karakterre** vágva, determinisztikusan kiválasztva
(a szélső napok / a szélső értékelésű döntések), és soha nem elemezve — csak átadva.

## 5. A tizenkét detektor

Közös szabályok minden alábbira: `@Component @ConditionalOnProperty(CHARACTER_SWITCH)`,
`CharacterDetector` implementáció, `DetectorSignal(detectorKey, expertKey, summary, salience 1..5)`,
magyar egymondatos összefoglaló, tizedesvessző a `TrailingWindow.hu()`-val, és a §4.2 szerinti
állapotváltás-kapu. Minden küszöb kódban nevesített konstans.

### 5.1 `self-calibration` — pszichologus — **ÉRZÉKENY**

**Bemenet:** `trend().checkinDays()` (skálák), `sleepPoints()`/8 hetes alvás, `trend().gymEightWeeks()`
(ízületi fájdalom), `trend().checkinSlots()` (jegyzet-részlet).

**Számítás** páronként, a 14 napos ablakon: a napokat a skála **ablakon belüli mediánja** vágja két
csoportra (magas / alacsony önértékelés); mindkét csoportra átlagoljuk az objektív értéket.

- magas-csoport objektív átlaga ≥ alacsony + `MIN_SEPARATION` (**1,0** pont) → `egyezik`
- magas-csoport ≤ alacsony − `MIN_SEPARATION` → `forditott`
- egyébként → `nincs-jel`

**Kapuk:** `MIN_PAIRED_DAYS` = **8** párosítható nap páronként, `MIN_DAYS_PER_GROUP` = **3** (a 2. kör
`ComfortEatingDetector` kontraszt-csoport precedense — csoport nélkül nincs összehasonlítás).
Az a pár, amelyik ezeket nem éri el, kimarad az állapotból. Ha egyik pár sem értékelhető → null állapot.

**Állapot:** `"energia:egyezik|testi:forditott"` (csak az értékelhető párok, rögzített sorrendben).

**Salience:** 4 ha bármelyik pár `forditott`, egyébként 2.

**Bizonyíték:** az ablak legmagasabbra és legalacsonyabbra értékelt energia-napjának check-in
jegyzete, ha van — 120 karakterre vágva, idézőjelben, értelmezés nélkül.

**Megfogalmazási kötelezettség:** az összefoglaló kimondja, hogy csak az energia és a testi skála
volt mérhető objektív párhoz, és hogy egy 14 napos ablak irányt jelez, nem jellemvonást.

### 5.2 `promise-vs-delivery` — drill

**Bemenet:** `trend().intentionDays()`.

Két dimenzió a 14 napos ablakon:

- **tartás** — a *lezárt* fókusz-napok pontszáma (`yes`=1,0 · `partial`=0,5 · `no`=0,0) átlaga:
  ≥0,75 → `tartja` · 0,40–0,75 → `reszben` · <0,40 → `csuszik`
- **lezárás** — a fókusszal induló napok hány százalékán van egyáltalán `reflection`:
  ≥70% → `teljes` · alatta → `hianyos`

**Kapu:** `MIN_FOCUS_DAYS` = **5** fókusszal induló nap. `MIN_CLOSED_DAYS` = **4** lezárt nap a
tartás-dimenzióhoz; ha ez nem teljesül, csak a lezárás-dimenzió kerül az állapotba.

**Állapot:** `"tart:csuszik|zaras:hianyos"`.

**Salience:** 4 ha `csuszik` vagy `hianyos`, egyébként 2.

### 5.3 `decision-profile` — pszichologus

**Bemenet:** `trend().decisions()`. **Ablak: 42 nap**, a `reviewedAt` helyi dátuma szerint.

Az `outcomeRating` (1..5) átlaga: ≥3,75 → `jo` · 2,25–3,75 → `vegyes` · <2,25 → `gyenge`.

**Kapu:** `MIN_REVIEWS` = **4** értékelt döntés az ablakban.

**Állapot:** `"kimenet:vegyes"`.

**Bizonyíték:** a legmagasabbra és a legalacsonyabbra értékelt döntés `decisionText`-je,
120 karakterre vágva.

**Salience:** 4 ha `gyenge`, egyébként 3.

### 5.4 `decision-review-backlog` — drill

**Bemenet:** `trend().decisions()`.

A `day`-re nézve: hány döntésnek járt már le a `reviewDue`-ja (`reviewDue ≤ day`), miközben nincs
átnézve **a megfigyelt napig** (`reviewedAt` null, vagy a helyi dátuma `day` utáni — utóbbi a
catch-up őszinteség miatt kell).

Sávok: 0 → `nincs` · 1–2 → `nehany` · ≥3 → `halmozodik`.

**Kapu:** legalább egy döntés létezzen egyáltalán, különben null állapot (különben minden
döntésnapló nélküli felhasználó örökké `nincs` állapotban ülne).

**Állapot:** `"backlog:halmozodik"` — sáv, nem darabszám.

**Salience:** 4 ha `halmozodik`, egyébként 2.

### 5.5 `gratitude-focus` — antropologus

**Bemenet:** `trend().gratitudes()`. **Ablak: 28 nap**, `occurredOn` szerint.

- **domináns terület** — a leggyakoribb `lifeArea`
- **eloszlás** — a domináns részaránya ≥50% → `koncentralt`, alatta → `szort`

**Kapuk:** `MIN_ENTRIES` = **6** bejegyzés az ablakban, és `MIN_AREA_COVERAGE` = **60%** — a
`lifeArea` opcionális mező, és egy 2 címkézett bejegyzésből vont „domináns terület" fabrikálás
lenne (a 2. kör `MIN_NOVA_COVERAGE` precedense).

**Állapot:** `"terulet:connection|eloszlas:koncentralt"`.

**Salience:** 3.

### 5.6 `streak-break-response` — pszichologus

**Bemenet:** `trend().needs()`. **Ablak: 14 nap.**

**Törés** = olyan nap az ablakban, amelyet megelőzően élt a sorozat (az előző napnak van sora és
`allGreen`), és amelyen a sorozat megszakad — vagyis a napnak vagy **nincs sora**, vagy van, de nem
`allGreen`. A hiányzó sor kezelése a `NeedsService.closeNew` szabályának **tudatos tükrözése**, nem
az „absent ≠ zero" megsértése: a domain saját authority-ja szerint a le nem zárt nap töri a sorozatot.

A legutóbbi ilyen töréstől számított **3 nap** (`RESPONSE_DAYS`) all-green napjai:

- 0 → `kaszkad` · 1 → `vontatott` · ≥2 → `visszaall`

**Kapu:** a törés és mind a 3 rákövetkező nap essen az ablakba és ne legyen `day` utáni. Ha az
ablakban nincs törés → null állapot (a detektor hallgat).

**Állapot:** `"toresvalasz:kaszkad"`.

**Salience:** 4 ha `kaszkad`, egyébként 3.

### 5.7 `restart-pattern` — drill

**Bemenet:** `trend().needs()`. **Ablak: 28 nap.**

A legutóbbi törés és az azt követő első all-green nap közti napok száma:

- 1 → `azonnal` · 2–3 → `rovid` · 4–7 → `hosszu` · >7 vagy még nem történt meg → `nyitott`

**Kapu:** legyen törés az ablakban, különben null állapot.

**Állapot:** `"ujraindulas:hosszu"`.

**Salience:** 3.

**Kötelező őszinteség:** a javadoc és a Gépterem-leírás is kimondja, hogy **ezek a küszöbök
heurisztikák** — a streak-irodalomban nincs validált vágópont (§2). Az összefoglaló ténymegállapítás
(„a legutóbbi megszakadás után N nap telt el az első teljes napig"), nem minősítés.

### 5.8 `retro-logging-ratio` — drill

**Bemenet:** `trend().logLatencies()` — egyetlen lapos lista, `LogLatencyPoint(genre, source,
aboutDate, writtenDate)`. **Ablak: 14 nap**, `aboutDate` szerint.

Két műfaj-csoport, **külön** kiértékelve (egy összemosott arány kása lenne — egy másnap beírt edzés
és egy visszamenőleg pótolt hála nem ugyanaz a viselkedés):

- `esemeny` — gym-nap, futás, sport, súly, alvás, étkezés
- `reflexio` — check-in, napló, hála, döntés, napi fókusz

Egy rekord **azonnali**, ha `writtenDate == aboutDate` (a §2 „same-day" konvenciója), különben
utólagos. Az utólagosak aránya csoportonként: <20% → `azonnali` · 20–50% → `vegyes` · >50% →
`utolagos`.

**Kapu:** `MIN_RECORDS_PER_GROUP` = **6**; az ez alatti csoport kimarad az állapotból. Ha egyik
csoport sem éri el → null állapot.

**Állapot:** `"esemeny:azonnali|reflexio:utolagos"`.

**Salience:** 3.

**Megfogalmazási korlát:** az összefoglaló nem állíthatja, hogy az utólag rögzített adat pontatlan —
csak azt, hogy mikor íródott (§2 korlátja).

### 5.9 `night-activity` — szomnologus

**Bemenet:** `trend().userChatTimes()` — a `role="user"` chat-üzenetek helyi időbélyegei.
**Ablak: 14 nap.**

Éjszakai sáv: `NIGHT_FROM` = **00:00** (inkluzív) — `NIGHT_TO` = **05:00** (exkluzív). Az ablak azon
**napjainak száma**, amelyeken van legalább egy ilyen üzenet: 0 → `nincs` · 1–2 → `alkalmi` ·
≥3 → `rendszeres`.

**Kapu:** legyen legalább egy chat-üzenet az ablakban egyáltalán, különben null állapot.

**Állapot:** `"ejszakai:rendszeres"`.

**Salience:** 4 ha `rendszeres`, egyébként 2.

**Attribúciós őszinteség:** ez **chat-használatot** bizonyít, nem általános app-használatot — a
javadoc, a Gépterem-leírás és az összefoglaló is így fogalmaz. Elutasított, gyengébb proxyk:
`push_log` / `app_notification` (a rendszer cselekvését bizonyítja, nem a felhasználóét),
`llm_log_history` (1:1 együtt mozog a chattel, nem ad többet).

### 5.10 `checkin-latency` — drill

**Bemenet:** `trend().checkinSlots()`. **Ablak: 14 nap.**

Soronként: névleges idő = `LocalDateTime(date, parse(slotTime))`, tényleges = `createdAt` helyi
ideje. Késés percben = tényleges − névleges, **0-ra vágva** (a korábban kitöltött slot nem negatív
késés, hanem pontos).

A késések **mediánja**: <60 perc → `pontos` · 60–240 → `keses` · >240 → `kesoi`.

**Kapu:** `MIN_CHECKINS` = **6** sor az ablakban; a nem értelmezhető `slotTime` (nem „HH:mm") sor
kimarad.

**Állapot:** `"keses:kesoi"`.

**Salience:** 3.

**Csapda kódban rögzítve:** `createdAt`, **nem** `savedAt` (§3/1).

### 5.11 `checkin-slot-drift` — drill

**Bemenet:** `trend().checkinSlots()`.

Két szomszédos 14 napos ablak: **korábbi** = `day−27 … day−14`, **friss** = `day−13 … day`.
Egy `slotTime` címke **kikopott**, ha a korábbi ablakban legalább `MIN_BASELINE_ROWS` = **3** sora
volt, a frissben pedig egy sem.

**Állapot:** `"slot:stabil"` vagy `"slot:kikopott:07:00,12:30"` (a kikopott címkék rendezve, összefűzve
— címke-értékű, nem számláló).

**Kapu:** a korábbi ablakban legyen legalább egy `MIN_BASELINE_ROWS`-t elérő slot, különben null.

**Salience:** 3.

### 5.12 `needs-domain-imbalance` — pszichologus

**Bemenet:** `trend().needs()` (a `greenThreshold` a kontextusban utazik). **Ablak: 14 nap.**

Domainenként (`energia`, `hidratacio`, `pihenes`, `mozgas`, `lelek`, `rend`) a `≥ greenThreshold`
napok aránya. **Gyenge** az a domain, amelynek aránya < `WEAK_SHARE` (**40%**), miközben legalább
`MIN_STRONG_DOMAINS` (**3**) másik domain aránya ≥ `STRONG_SHARE` (**70%**) — vagyis a jel a
*kontraszt*, nem az alacsony abszolút szint (egy általánosan gyenge két hét nem „aránytalanság").

**Kapu:** `MIN_NEEDS_DAYS` = **7** lezárt Életjel-nap az ablakban.

**Állapot:** `"gyenge:lelek,rend"` vagy `"gyenge:nincs"`.

**Salience:** 4 ha van gyenge domain, egyébként 2.

## 6. Olvasás-bővítés

A `CharacterSignalReads` új gyűjtői, mind a 8 hetes `TrendWindow`-ba, a meglévő konvenciókkal:
**absent ≠ zero** (nincs sor → nincs elem, soha nem szintetizált nulla) és **catch-up őszinteség**
(minden olvasás felülről a megfigyelt `day`-jel határolva, finder-korláttal vagy memóriabeli
szűréssel — a súly-olvasás precedense `:138-147`).

Új `DetectorInput` rekordok a `TrendWindow`-ban:

```
IntentionDayPoint(LocalDate date, int focusCount, String reflection)   // reflection null = nincs lezárás
DecisionPoint(LocalDate decidedOn, LocalDate writtenOn, LocalDate reviewDue,
              LocalDate reviewedOn, Short outcomeRating, String textPreview)
GratitudePoint(LocalDate occurredOn, LocalDate writtenOn, String lifeArea)
NeedsContext(int greenThreshold, List<NeedsDayPoint> days)
NeedsDayPoint(LocalDate date, int energia, int hidratacio, int pihenes, int mozgas,
              int lelek, int rend, int greenCount, boolean allGreen, int streakDays)
CheckinSlotPoint(LocalDate date, String slotTime, LocalDateTime writtenAt, String notePreview)
LogLatencyPoint(String genre, String source, LocalDate aboutDate, LocalDate writtenDate)
```

valamint `List<LocalDateTime> userChatTimes`.

A `NeedsContext` null, ha nincs egyetlen Életjel-nap sem (a 2. kör `StackContext`/`MedContext`
mintája). A `CheckinSlotPoint` a meglévő, napra aggregált `CheckinDayPoint` **mellett** él — az
aggregátum a skálákhoz kell, a soros nézet a slot-viselkedéshez.

A `logLatencies` gyűjtője tíz forrásból tölt fel egy lapos listát; a `writtenDate` mindenhol a
`createdAt` (illetve étkezésnél a már bekötött `loggedAt`) helyi dátuma. Ehhez a meglévő
gym/futás/sport/súly/alvás olvasások **`createdAt`-tal bővülnek**.

Új `DetectorGates` metódusok a meglévők mellé: `newIntentionData`, `newDecisionData`,
`newGratitudeData`, `newNeedsData`, `newChatData`.

## 7. Felület, dokumentáció

- `DetektorokPage.tsx` katalógus **20 → 32**; a leírások hordozzák a §5 őszinteség-korlátait
  (`restart-pattern` heurisztika, `night-activity` chat-attribúció, `self-calibration` két pár).
- `inventory.ts`: a 3. kör **teljes objektuma törlődik** az `INVENTORY_ROUNDS`-ból, a hat új
  adatforrás `INVENTORY_READS` sorrá válik. A 4. körből az **„Életjel-gyűrűk" sor is törlődik**,
  mert ez a kör előrehozza. A fájl fejléc-kommentje a 3. körrel bővül.
- `characterMock.ts`: tizenkét új `CHAIN_POOL` seed, valós gazdákkal és a valódi küszöbökkel
  konzisztens számokkal.
- `docs/features/character.md`: katalógus-tábla, a 3. kör olvasás-bővítése, a két új ArchUnit él,
  §9 főkönyv frissítése.
- `docs/CODEMAP.md` regenerálás.

Nincs OpenAPI/kontraktus-változás: a detektorok a meglévő `character_run` / claim-csővezetéken
mennek végig.

## 8. Tesztelés és kapuk

- **Detektor unit-tesztek** (`DetectorTest`): detektoronként legalább a tüzelő eset, a kapu-eset
  (küszöb alatt néma) és az **állapotváltás-kapu** esete (változatlan állapot → néma). A 2. kör
  tanulsága kötelező: a teszt bizonyítsa, hogy az állapotkulcs **kvalitatív** — egy számláló-alapú
  kulcs mellett is zöld teszt hibás teszt.
- **Olvasás-IT** (`CharacterSignalReadsIT`): forrásonként catch-up felső korlát és „absent ≠ zero";
  külön a `createdAt`-vs-`savedAt` csapda és a `NeedsContext` null-esete.
- **Backend fókuszált futás** csak: `./mvnw test -Dtest='*Character*' -Dmezo.test.use-testcontainers=true`,
  **plusz külön nevesítve `ArchitectureTest`** (a cross-feature importok miatt).
- **FE mindkét módban** (`pnpm test` és `VITE_USE_MOCK=false pnpm test`) + `pnpm build`.
- `node scripts/gen-codemap.mjs --check`, `node scripts/lint-docs.mjs --errors-only`.
- A teljes suite a CI dolga (self-PR); lokálisan soha.

## 9. Hatókörön kívül

- **LLM-kivonatoló réteg** a szabad szöveghez — külön bd-issue (§4.1).
- **4. kör** (kapcsolatok & AI-meta) — az „Életjel-gyűrűk" sor kivételével érintetlen.
- `GamificationProfileEntity` napi történetének bevezetése — a `NeedsDayEntity` elég (§3/3).
- A `notification_schedule` történeti verziózása — a `slotTime` kiváltja (§3/2).
