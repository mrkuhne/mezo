# Mintarészlet — közérthető következtetés és adaptív grafikon

- **Dátum:** 2026-09-04
- **bd issue:** `mezo-0469`
- **Státusz:** a vizuális irány user által jóváhagyva; implementációs specifikáció felülvizsgálatra kész
- **Normatív vizuális referencia:**
  [`docs/design_2.0/prototypes/minta-reszlet.html`](../../design_2.0/prototypes/minta-reszlet.html)

## Miért változtatunk

A jelenlegi részletoldal ugyanazon a képernyőn ezt kérdezi:
„Hétvégén később csúszik az utolsó étkezés?”, majd ezt közli:
„Meglepő: hétvégén kicsit korábban ettél utoljára.” A kérdés valójában a katalógusban
rögzített hipotézis, a második mondat pedig a mért korreláció előjelének determinisztikus
fordítása. A felület azonban nem különíti el a **mit vizsgálunk** és a **mit tudunk már**
szerepét, ezért a két mondat ellentmondásnak hat.

Az éles rekord ezt a problémát tovább erősíti: a 2026-09-03-mal záródó ablakban 9 illesztett
nap van, de ezekből 8 hétköznap és csak 1 hétvége. A Pearson-korreláció ettől még számolható
(`r=-0,27`, `p=0,479`), de az egyetlen hétvégi pontból nem szabad hétvégi viselkedésre
következtetni. A jelenlegi `min-n` kapu csak az összes illesztett napot nézi, a két csoport
egyensúlyát nem.

A szöveg **nem LLM-ből jön**. A kérdés és az irányonkénti mondatok az
`application.yml` párkatalógusából, az „Igen/Meglepő” prefix és a bizonyossági mondat a
frontend tiszta függvényeiből, az `r/n/p` pedig a backend Pearson-számításából származik. Ez a
szelet ezt a determinisztikus vezetéket tartja meg, de közérthetőbb szerkezetet és őszintébb
kaput ad neki.

## Cél

A részletoldal öt másodperc alatt megválaszolja ezt a négy kérdést:

1. Mit vizsgál az app?
2. Van-e már elég és kellően kiegyensúlyozott adat?
3. Pontosan mely napokból áll az összevetés?
4. Mi történik most, illetve mit fog tenni az app később?

A statisztikai részletek megmaradnak auditálhatónak, de nem versenyeznek a fő üzenettel.

## Jóváhagyott vizuális irány

A Design 2.0/Huawei stílusú oldal egy színes történetfolyam, nem egymás alá rakott fehér
diagnosztikai kártyák sora. A prototípus a valós 8+1 napot használja, és ez a megvalósítás
vizuális igazodási pontja.

- Az állapotot egy nagy, színezett hero mondja ki. A kérdés kisebb „Amit vizsgálunk”
  kontextusként jelenik meg.
- A két összevetett csoport külön égkék és levendula csempét kap, darabszámmal és emberi
  összefoglalóval.
- A grafikon a metrika természetéhez igazodik. Bináris bemenetnél két oszlopos pontdiagram,
  nem regressziós vonal jelenik meg.
- A „Mit jelent ez?” és „Mi történik ezután?” blokkok külön színnel és egy-egy rövid mondattal
  vezetik tovább a történetet.
- A történet és a számítás részletei lenyithatók. A nyers `r/p` csak egy második, „Technikai
  számok” szint alatt látható.
- A mobil olvashatóság az elsődleges; az oldal a meglévő `MozaikPage`/`PageHead`/`PageBody`
  keretet és Design 2.0 tokeneket használja, nem hoz létre párhuzamos design rendszert.

## Felhasználói nyelv

### A mostani 8+1 eset kötelező szövege

- Állapot: **„Még gyűlik az adat”**
- Főmondat: **„Még nincs elég hétvégi adat.”**
- Hipotézis-kontextus: „Azt vizsgáljuk, hogy hétvégén későbbre csúszik-e az utolsó étkezésed.”
- Magyarázat: „8 hétköznapi nap mellett még csak 1 hétvégi nap van. Egyetlen hétvégi napból
  még nem mondunk irányt.”
- Következő lépés: „Még 2 hétvégi nap kell. Addig csak gyűjtjük az étkezési naplódat.”
- Döntési gombok: **nincsenek**.

### Amikor már van következtetés

A kérdés soha nem válik állítássá. A lelet külön blokkban kap irányt:

- ha a mért irány egyezik a hipotézissel: „Eddig ebbe az irányba mutatnak a napjaid: …”;
- ha ellentétes: „Eddig az ellenkezője látszik: …”.

A „Meglepő:” prefix megszűnik. A gyenge bizonyítékot nem fordítjuk át a félreérthető
„minden N. ilyen minta véletlenül is összejönne” mondatra. A felhasználói szint három mondata:

- `p <= 0,05`: „Erősebb bizonyíték — ez már kevésbé magyarázható véletlennel.”
- `0,05 < p <= 0,15`: „Ígéretes irány, de még gyűlik az adat.”
- `p > 0,15`: „Bizonytalan jel — ebből még nem érdemes következtetést levonni.”

Ezek továbbra is determinisztikus UI-szövegek. A pontos `p` érték a technikai részben marad.

## Állapotmodell a részletoldalon

| Aktuális állapot | Hero | Fő tartalom | Döntési művelet |
|---|---|---|---|
| `no_data`, `few_days`, `degenerate`, `imbalanced_groups` | borostyán „Még gyűlik” | hiány és következő lépés | nincs |
| `live` + `proposed` erős jel | korall/fehér „Döntésre vár” | emberi lelet + grafikon | megerősítem / figyeljük / elvetem |
| `live` + `proposed` gyenge jel | levendula „Még bizonytalan” | emberi lelet + további gyűjtés | nincs tudássá emelő CTA |
| `live` + `monitoring` | levendula „Figyeljük” | aktuális lelet és fejlődés | meglévő állapot látszik |
| `frozen` + `confirmed` | zsálya „Megerősítve” | befagyasztott lelet + hatás | meglévő döntés látszik |
| `frozen` + `rejected` | tompa „Elvetve” | rövid lezárás | meglévő döntés látszik |

A részletoldal mindig az aktuális monitor-verdiktet tekinti a statisztikai igazságnak. Egy
korábban létrejött `proposed` adatbázissor önmagában nem jogosít döntésre: ha a pár ma nem
`live`, a hero gyűjtést mutat és a CTA-kat elrejti. A már felhasználó által megítélt
`confirmed`/`rejected` sorok továbbra is befagyasztottak.

## Backend és kapu

### Konfiguráció

A `mezo.companion.patterns` blokk új `min-group-n: 3` értéket kap. A
`CompanionProperties.Patterns` recordban ez `@Min(3) @Max(30) int minGroupN`; nincs hardcode a
szolgáltatásban.

### Metrikatípus

A `MetricKey` új `MetricValueKind` metaadatot kap:

- `NUMBER`: az általános numerikus metrikák;
- `CLOCK_HOUR`: `late-meal-hour`, `bedtime-hour`, `wakeup-hour`;
- `BINARY`: `weekend`, `ritual-closed`.

Ez a backend katalógus lesz a megjelenítési típus forrása. A frontend nem újabb kulcslistából
dönti el, hogy csoportos vagy időformátumú grafikont kell-e rajzolnia.

### Csoportegyensúly-kapu

A `PatternGate.evaluate(...)` a lag szerinti illesztés után ebben a sorrendben dönt:

1. nulla illesztett nap → `NO_DATA`;
2. összes illesztett nap `< minN` → `FEW_DAYS`;
3. ha A metrika `BINARY`, megszámolja a `0` és `1` csoportot; bármelyik
   `< minGroupN` → `IMBALANCED_GROUPS`;
4. csak ezután fut a degeneráltság-ellenőrzés és a Pearson-korreláció.

A `PatternGate.Outcome` bináris A metrikánál a `groupZeroDays` és `groupOneDays` darabszámot is
hordozza. A `PatternDetectionService` az `IMBALANCED_GROUPS` eredményt ugyanúgy kapun kívül
tartja, mint a `FEW_DAYS` eredményt: nem hoz létre sort, nem frissít korábbi
`proposed`/`monitoring` statisztikát, nem ír snapshotot és nem küld értesítést.

A történeti sor nem törlődik. Ez megőrzi az auditot, miközben a monitor aktuális verdiktje
megakadályozza, hogy a frontend elavult `r/p` alapján döntést kérjen.

## API-contract

A módosítás contract-first, az első szerkesztett boundary fájl az
`api/feature/companion/companion.yml`.

A `PatternMonitorPair` változásai:

- `metricAValueKind`, `metricBValueKind`: kötelező, regex
  `number|clock_hour|binary`;
- `verdict`: az eddigi értékek mellé `imbalanced_groups`;
- `groupZeroDays`, `groupOneDays`, `requiredPerGroup`: nullable számok; bináris A metrikánál
  értelmezettek, máskor `null`.

Az `alignedDays` továbbra is a két metrika illesztett napjainak teljes száma. Az
`imbalanced_groups` esetben `missingDays` és `bottleneckMetricKey` null; a hiányt a három
csoportmező írja le. A frontend API-adapterei minden opcionális wire mezőt explicit `null`-ra
normalizálnak.

Nincs új endpoint és nincs adatbázis-migráció. A meglévő monitor- és pair-detail endpointok
ugyanazt a bővített `PatternMonitorPair` alakot adják.

## Frontend architektúra

### Oldal és komponensek

A `PatternDetailPage` megtartja a jelenlegi betöltési, hiba-, 404- és refetch ágakat. A betöltött
ág szerkezete a prototípust követi:

1. részletoldal-specifikus story hero;
2. csoport-összefoglaló csempék;
3. adaptív bizonyíték-grafikon és lenyitható naplista;
4. „Mit jelent ez?”;
5. „Mi történik ezután?”;
6. tömör, lenyitható történet;
7. `PatternImpactCard`, ha tényleges hatás van;
8. rétegzett „Hogyan számoltuk?” diagnosztika.

A detail hero nem használja tovább teljes egészében a dashboard `PatternDecisionCard`-ját. A
döntési mutáció (`usePatternActions`) közös marad, de a részletoldal saját komponense a fenti
állapotmátrix szerint jeleníti meg vagy rejti el az akciókat. A dashboard kártyája megtartja a
tömör inbox-szerepét.

### Adaptív grafikon

- `metricAValueKind === binary`: kétoszlopos csoport-pontdiagram. Minden pont egy nap; az Y
  tengely valós, `formatMetricValue`-val formázott értékeket mutat. A legutóbbi nap arany gyűrűt
  kap. Csoportmedián csak annál az oszlopnál látszik, ahol legalább `requiredPerGroup` nap van;
  regressziós vonal nincs.
- Más A metrika: a folytonos scatter megmarad, de mindkét tengely legalább három valódi,
  metrikaformázott skálafeliratot kap. Trendvonal csak `live` állapotban jelenhet meg.
- Üres vagy egyetlen pontos állapot: nincs félgrafikon; a kártya a hiányt és a következő
  szükséges adatot mondja ki.

A bináris csoportnevek a meglévő `axisEndLabels` emberi címkéi maradnak (`hétköznap/hétvége`,
`kimaradt/megvolt`), de a grafikon típusát már a contractból kapott value kind vezérli.

### Történet

Az alapnézet nem meséli el minden éjszakai `snapshot` erősségsáv-váltását. Látható sor lehet:

- az első számolható snapshot: „Először számolhatóvá vált — N közös nap”;
- az aktuális gyűjtési állapotból származtatott sor, például „Még gyűlik — 1/3 hétvégi nap”;
- felhasználói döntés: monitoring / confirmed / rejected;
- tudássá emelés és későbbi megerősítés.

Az „Életre kelt”, „gyenge sáv”, „átlépte a sávot” motorzsargon eltűnik a felhasználói
történetből. A nyers snapshot-események nem törlődnek, és a technikai részben továbbra is
auditálhatók. `imbalanced_groups` esetben a jelenlegi „Hogyan erősödött a jel” grafikon helyett
a csoportonkénti adatgyűjtés állása jelenik meg; nincs értelme egy érvénytelen jel erősödéséről
beszélni.

### Diagnosztika

A „Motor-diagnosztika” felirat „Hogyan számoltuk?” lesz, színes, köznyelvi alcsoportokkal:

- vizsgált időablak;
- adatforrások és párosítás („azonos nap” vagy „N nappal később”);
- közös napok és bináris esetben csoportegyensúly;
- a motor aktuális döntése.

Ezen belül egy második disclosure, „Technikai számok” mutatja az aktuális `pair.r/n/p` értéket és
a befagyasztás technikai állapotát. Ha a verdikt nem élő, de van korábbi perzisztált számítás, az
csak **„Korábbi nyers számítás — még a csoportkapu előtt”** címkével jelenhet meg itt; az elavult
`pattern.r/p` soha nem tűnhet aktuális következtetésnek.

## Adatfolyam

1. A metrikasorozatokat a meglévő `MetricSeriesService` tölti.
2. A közös `PatternGate` illeszt, összes napot és szükség esetén csoportokat számol, majd
   verdiktet ad.
3. Az éjszakai `PatternDetectionService` csak `LIVE` eredményt perzisztál; a
   `PatternMonitorService` ugyanebből a kapuból építi az aktuális wire állapotot.
4. A `PatternPairDetailService` a monitorpárt, napokat, eseményeket és hatást változatlan
   endpointon adja vissza.
5. A frontend adapter contracttípusról domaintípusra normalizál.
6. A detail oldal a verdiktből választ történetet, a `days` listából pedig vizualizációt és
   csoport-összefoglalót épít.

Ez megtartja azt a fontos invariánst, hogy a dashboard, a részletoldal és az éjszakai job ugyanazt
a kapudöntést látja.

## Hibakezelés és szélső esetek

- Ismeretlen pair key: a meglévő „Nincs ilyen minta” állapot marad.
- API-hiba: a meglévő „Nem sikerült betölteni” + „Újra” marad.
- Monitor külön nem tölthető be, de a detail sikeres: a pair-detail válasz `pair` mezője elég a
  herohoz és a grafikonhoz; csak a globális ablak/utolsó futás kiegészítés lehet „—”.
- Nulla vagy nem véges érték nem rajzolható; a meglévő backend sorozat-kontraktus és a chart
  guard őrzi ezt.
- A bináris extractorok továbbra is pontos `0/1` értéket adnak; ezt a `MetricSeriesService`
  extractor-tesztjei rögzítik, a gate nem vezet be harmadik, felhasználónak látható csoportot.
- `requiredPerGroup` hiánya mellett az `imbalanced_groups` wire állapot inkomplett; a frontend
  biztonságos fallbackje általános „Mindkét oldalról több nap kell”, nem kitalált szám.
- A reduced-motion beállítás a Design 2.0 motion-konvenció szerint kikapcsolja a pulzáló/entrance
  animációkat; információ nem függ animációtól.

## Tesztelés

### Backend

- `PatternGateTest`: 8+1 bináris eloszlás → `IMBALANCED_GROUPS`; 3+3 → számolható; összesen
  kevés nap → `FEW_DAYS`; nem bináris pár viselkedése változatlan.
- Integrációs teszt a projekt `ApiIntegrationTest`/populator mintája szerint: a monitor és a
  pair-detail ugyanazt az `imbalanced_groups`, 8/1/3 állapotot adja.
- `PatternDetectionService` integrációs teszt: kiegyensúlyozatlan pár nem hoz létre/frissít
  snapshotot vagy mintasort; már létező `proposed` sor statisztikája nem frissül.
- Configuration binding teszt: `min-group-n` kötelező és validált.

### Contract és frontend

- OpenAPI merge + backend és frontend generálás után nincs drift.
- Adaptertesztek rögzítik a value kindot, az új verdiktet és a nullable csoportmezőket.
- `verdicts.test.ts`: pontos, emberi csoporthiány-mondat és fallback.
- `findings.test.ts`: nincs „Meglepő” és nincs „minden N. véletlenül” szöveg.
- Grafikon-komponensteszt: 8+1 bináris nap két csoportba kerül; hétvégi medián/trendvonal nincs;
  a legutóbbi nap kapja a kiemelést; az időtengely óra:perc formátumú.
- `PatternDetailPage.test.tsx`: 8+1 esetben gyűjtő hero, `1/3`, „még 2”, nincs döntési gomb és
  nincs aktuálisként kiírt `r/p`; élő, monitoring, confirmed és rejected állapotok külön rögzítve.
- Mindkét frontend mód: `pnpm test` és `VITE_USE_MOCK=true pnpm test`, majd `pnpm build`.
- Vizuális QA a normatív prototípussal mobil viewporton, lenyitott történettel és technikai
  részletekkel; konzolhiba nélkül.

## Dokumentáció és leszállítás

- Az implementáció ugyanabban a változásban frissíti a
  `docs/features/insights.md` és `docs/features/companion.md` érintett részeit.
- Új/moved source fájl esetén `node scripts/gen-codemap.mjs`, majd a generált CODEMAP is a
  commit része.
- `node scripts/lint-docs.mjs` fut; a jelenlegi repository-baseline más feature-doksik
  stalenessét jelzi, ezért az érintett két feature-doksi frissességét külön is bizonyítani kell,
  és új doc-error nem maradhat.
- A fókuszált helyi tesztek után a self-PR CI a teljes backend integrációs suite authoritatív
  kapuja.

## Nem-célok

- LLM-es magyarázat vagy generált egészségügyi tanács.
- A Pearson-motor lecserélése vagy kauzalitás állítása.
- A pattern eseménytábla történeti sorainak törlése vagy adatbázis-migráció.
- A teljes Minták dashboard vizuális újratervezése; csak az új verdikt és közös copy szükséges
  bekötése tartozik ide.
- Új grafikonkönyvtár bevezetése; a vizualizáció a jelenlegi React/SVG megközelítést követi.
- A mintakatalógus hipotéziseinek tartalmi újraírása a kérdés/lelet szerepek szétválasztásán túl.

## Kockázatok és ellensúlyok

- **Régi proposed sor + új nem-live verdict:** a frontend minden döntési jogosultságot az aktuális
  pair-verdikthez köt, és regressziós teszt védi.
- **A gate eltér a monitor és job között:** mindkettő ugyanazt a `PatternGate.evaluate` hívást és
  mindkét config-küszöböt kapja; külön integrációs egyezőségteszt védi.
- **Contract mezők részleges bekötése:** contract-first generálás, kézi boundary DTO nélkül,
  adapterteszttel.
- **A grafikon túl sok speciális szabályt kap:** a döntés egyetlen contractos value kindon alapul;
  a naplista minden esetben megmarad auditálható fallbacknek.
- **Statisztika túlmagyarázása:** a fő nézet csak megfigyelést és bizonytalanságot közöl;
  oksági vagy egészségügyi állítás nincs, a nyers számok pedig külön technikai rétegben maradnak.
