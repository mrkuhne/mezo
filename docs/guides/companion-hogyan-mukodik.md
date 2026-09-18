---
title: A companion — hogyan működik (útmutató)
type: guide
updated: 2026-09-18
tags: [companion, ai, insights, guide]
related: [companion, insights]
---

# A companion — hogyan működik

> Nem-technikai útmutató a Phase 3 AI-agyhoz: mit tud, mi történik magától és mikor, mi a te
> szereped, és milyen elvek védik a megbízhatóságát. A technikai referencia:
> [`docs/features/companion.md`](../features/companion.md).

## Mi ez, és milyen problémát old meg?

A klasszikus fájdalom: minden új AI-beszélgetés nulláról indul — újra el kell magyarázni, mikor
edzel, mit eszel, mi a célod, hol tartasz (ha van ilyen) a gyógyszer-ciklusban. Közben a mezo **már
tárolja mindezt**: az edzéseket, az étkezéseket, az alvást, a súlyt, a gyógyszert, a
check-ineket.

A companionnel bármilyen témáról beszélgethetsz. Amikor a kérdésedhez segít, utánanéz a rólad
tárolt adatoknak; egy regényről vagy nehéz napról szóló beszélgetést nem kell egészségügyi
elemzéssé alakítanod. A megerősített tények, emlékek és korábbi beszélgetésrészletek kérésre elérhetők.

## A négy képesség

A companion négy, egymásra épülő szintben lett felépítve. Mindegyik önállóan is értéket ad, együtt
pedig egy tanuló társat adnak ki.

### 1. „Lát engem" — szükség esetén utánanéz

Ha a saját alvásodról, étkezésedről, edzésedről vagy más rögzített adatodról kérdezel,
a companion lekéri a releváns részt. Szükség esetén az első eredmény alapján tovább kérdezheti
az adatokat. A „és ez miért lehet?” folytatásnál is látja az előzményt és eléri az eszközeit.

Általános kérdéshez, ötleteléshez vagy egyszerű beszélgetéshez nem kell adatot lekérnie.
Az alapadataidat — életkor, magasság, nem, legutóbbi súly és aktív súlycél — a beszélgetés ismeri, ha rögzítetted őket. A mai állapotod és az összes személyes háttér nem kerül automatikusan minden válasz elé.

A részletes adatokhoz is hozzáfér: az étkezés összetevőihez, az edzés egyes sorozataihoz, régi naplóbejegyzésekhez, szokásokhoz, emberekhez és a korábbi felismerésekhez. Hosszú bejegyzést több részletben is végigolvashat. Egy memória-találatból vissza tud lépni az eredeti szöveghez; a keresési kivonat nem az egész bejegyzés. A korábban kimaradt hosszú emlékeket az éjszakai feldolgozás fokozatosan pótolja.
A válasz alatti címkék jelzik, minek nézett utána. Az elemző válasz szövege is folyamatosan
érkezik, miután a szükséges adatokat összegyűjtötte.

### 2. „Megjegyez" — tények, amiket te hagysz jóvá

Minden beszélgetés után a háttérben megnézi, mondtál-e magadról valami **tartósat**
(„laktózérzékeny vagyok", „hétfőn sosem edzem"). Ezekből **javaslat** lesz, nem tudás: az
Insights → Knowledge fülön várnak rád, és te döntesz — **Elfogad / Pontosít / Elvet**.

Amit elfogadsz, bekerül a tartós tudástárba. A companion akkor kérheti le, amikor a témához
releváns; nem kell minden beszélgetésben felsorolnia, amit tud rólad.

A „ne kérdezzen rá arra, amit már tud” elv törekvés: a beszélgetési előzmény és az adatlekérés
segíti. A normál válasz után nincs külön nyelvi bíró, amely némán újrafogalmaztatja a választ.
A gyógyszeradagolásra vonatkozó korlát és a sikertelen adatelérés jelzése megmarad.

Minden tény mellett a Knowledge fülön kapcsoló van: bármelyiket **kikapcsolhatod** — onnantól
semmilyen csatornán nem kerül a beszélgetéseidbe.

### 3. „Emlékszik" — naplót vezet és felidéz

Minden éjjel megírja az **előző napod rövid, magyar nyelvű összefoglalóját** — mit edzettél,
hogyan ettél, hogyan aludtál, hol tartott a ciklus. Ezek az összefoglalók bekerülnek egy
**emlék-tárba**, méghozzá úgy elmentve, hogy **jelentés alapján** is megtalálhatók legyenek, ne
csak pontos szóegyezésre (ezt hívjuk beágyazásnak — a továbbiakban így rövidítjük).

Ezért működik a „**volt már ilyen napod?**" kérdés: a companion tematikusan hasonló **napokat**
idéz fel — dátummal és a nap kivonatával, a frissebb emlékeket előrébb sorolva. Gyenge,
erőltetett hasonlóságot nem mutat: ha nincs igazi találat, azt mondja, „nincs adat".

A közelmúltból legfeljebb 80 üzenetet kap meg közvetlenül, méretkorláttal. A jelenlegi
beszélgetés régebbi részeit külön is lekérheti. A korábbi eszközeredményekből megőrzött kivonat
időbélyeget kap: egy múlt heti mérés ettől még nem mai adat. Hosszú távú személyes emléket
jelentés alapján is kereshet; a keresés nem garantálja minden korábbi részlet megtalálását.

### 4. „Észrevesz" — minták, amiket te ítélsz meg

Két gépezet keresi az összefüggéseket az adataidban:

- **Éjszakai statisztika** — 29 előre definiált összefüggés-párt számol át (pl. alvásminőség ↔
  másnapi edzés-RPE, késői étkezés ↔ alvás, gyógyszer-ciklusnap ↔ kalória, sportterhelés ↔
  gym-volumen).
  Csak akkor mutat bármit, ha van elég adat (legalább 8 összevethető nap) — és a bizonytalan
  mintára nem ír ki kitalált százalékot, hanem azt mondja: **„tanulom"**.
- **Heti hipotézis-kör** — az erősebb modell mechanizmus-szintű sejtéseket fogalmaz meg a heted
  alapján, majd **saját magát kritizálja** négy szempont szerint (statisztikai alap, zavaró
  tényezők, illeszkedés a tényeidhez, cselekvésre válthatóság). Csak a szigorú pontszámot túlélő
  hipotézisek jutnak el hozzád; a határeseteket egyszer átfogalmazza és újraértékeli.

Mindkettő az Insights → Patterns **inboxba** érkezik, ahol te ítélsz: **Confirm / Monitor /
Reject** (Megerősít / Figyelem alatt tart / Elvet). A visszautasított minta soha nem jön vissza.
A megerősített minta **tartós ténnyé válik** — és amikor az éjszakai számítás újra kimutatja
ugyanazt az összefüggést, a tény megerősítés-számlálója nő (legfeljebb hetente egyszer), így
egyre előrébb sorolódik a companion tudásában. A felismerést a companion akkor kéri le és
használja a beszélgetésben, amikor az kapcsolódik a témádhoz; nincs kötelező bejelentése.

## Mi fut magától, és mikor?

| Mikor | Mi történik | Mit veszel észre belőle |
|---|---|---|
| **Minden éjjel 02:20** | Napi összefoglaló-írás: az előző nap (és az elmúlt 7 nap bármely kimaradt napja) narratívát kap, és bekerül az emlék-tárba. Kimaradt éjszakák maguktól pótlódnak. | A „volt már ilyen napod?" kérdés egyre gazdagabban válaszol. |
| **Minden éjjel 02:40** | Mintakeresés: a 8 összefüggés-pár átszámolása az elmúlt 60 nap felett. Megerősített mintáid újra-kimutatása erősíti a hozzájuk tartozó tényt (legfeljebb hetente egyszer). | Új kártyák a Patterns inboxban; a megerősített tudásod „×N reinforced" számlálója nő. |
| **Vasárnap 03:00** | Heti hipotézis-kör: heti kontextus → javaslat → önkritika → átfogalmazás → csak a túlélők. | Hetente legfeljebb pár, már előszűrt mély-hipotézis a Patterns inboxban, indoklással („AI gondolatmenete"). |
| **Minden chat-üzenet után** (azonnal, háttérben) | Tény-javaslat kinyerés a beszélgetésből + a forduló beágyazása az emlék-tárba. | Új javaslatok a Knowledge fülön. |

**Mikor látsz belőle először valamit?** A napi emlékek már az első éjszaka után épülni kezdenek;
az első statisztikai minták nagyjából **8 nap** összevethető adat után jelenhetnek meg; az első
mély-hipotézisek az első vasárnapi kör után. Egyik háttérmunka sem tudja elrontani a
beszélgetést: ha bármelyik hibázik, csendben kimarad, és a következő futás pótolja.

## Hogyan hozd ki belőle a legtöbbet?

Néhány kérdéstípus, amire kifejezetten fel van készítve:

- **„Mit egyek ma vacsorára a maradék makróim alapján?"** — lekéri a releváns mai adatokat, és azokból válaszol.
- **„Hogy aludtam a héten, és látszott ez az edzéseimen?"** — eszközökkel néz utána, chipekkel.
- **„Mennyi volt az átlag fehérjém az elmúlt két hétben?"** — a számokat mindig kiszámolja, nem becsüli.
- **„Volt már ilyen napom?" / „Mikor éreztem utoljára így magam edzés után?"** — emlék-felidézés.
- **Mondj el magadról tartós dolgokat** („a térdem nem bírja a mély guggolást") — javaslat lesz
  belőle a Knowledge fülön, és jóváhagyás után soha többé nem kell elmondanod.

## Őszinteségi elvek (amikben megbízhatsz)

- **Nincs kitalált szám.** Ha egy minta bizonytalan, „tanulom" a felirat — nem egy hasraütött
  százalék. Ha nincs adat, azt mondja: „nincs adat".
- **A válaszok önellenőrzésen mennek át.** Egy második lépés vizsgálja, hogy a válasz a te
  adataidra épül-e, és nem kérdez-e rá ismert tényre; egy javítási kör után, ha még mindig
  kétséges, a válasz apró **„nem ellenőrzött"** jelölést kap — sosem titkolja el.
- **Gyógyszer-szabály.** A gyógyszer-adagolás módosítását soha nem javasolja — ezt a GLP-1
  család ismert neveire (és rokon készítményekre) egy **beépített, nem-AI szabály** is
  kikényszeríti, ami mindig ugyanúgy működik, nem az AI pillanatnyi döntésén múlik. Más szerekre
  az AI-nak adott szigorú utasítás védi ugyanezt. (Az owner jelenleg nem szed gyógyszert — ez a
  szabály minden jövőbeli esetre is érvényben marad.)
- **Csak olvasni tud, cselekedni nem.** A companion eszközei kizárólag a saját adataid
  *olvasására* képesek: nem tud emailt küldeni, naptárba írni, vásárolni, külső rendszerbe írni —
  ilyen eszköze szerkezetileg nem létezik, és automata teszt őrzi, hogy ne is kerülhessen bele.

## Mi történik az adataimmal?

Az adataid a **saját mezo-adatbázisodban** élnek (a saját szervereden). Amikor a companion
válaszol, a kérdésedhez tartozó **releváns szelet** (a napi pillanatkép, a top tények, az
előkeresett emlékek) feldolgozásra elmegy a **Google Gemini** felhő-szolgáltatásához — ahogy
minden felhő-AI-nál. Ezen kívül semmi nem hagyja el a rendszert, és a fenti „csak olvasni tud"
elv miatt az AI semmilyen adatot nem tud sehová továbbítani vagy kiírni.

## Költség és modellek

- **Minden beszélgetés-forduló** a gyors és olcsó **Gemini Flash**-en fut (a tény-kinyeréssel és
  önellenőrzéssel együtt) — fordulónként nagyságrendileg 1–3 forint.
- **A heti hipotézis-kör** az erősebb **Gemini Pro**-t használja — ez a fix „alapdíj", havi
  néhány tíz forintnyi.
- Összességében: minimális használatnál **havi néhány tíz forint**, rendszeres napi
  beszélgetésekkel inkább **havi pár száz forint** nagyságrend.

## Ki- és bekapcsolás

Minden réteg kapcsolható, az app a companion nélkül is teljes értékű — de fontos tudni, hogy ezek
**konfigurációs (fejlesztői) kapcsolók**, nem a felületen élnek:

- Fő kapcsoló az egész companionre, és külön a tény-kinyerésre, az önellenőrzésre, a
  beszélgetés-beágyazásra és mindhárom éjszakai/heti munkára.
- Kikapcsolt állapotban a felület **őszinte „nem elérhető"** állapotot mutat — nem törött képernyőt.
- **Az appon belül** egyetlen valódi kapcsoló van: a Knowledge fülön a tények melletti
  be/ki-kapcsoló (melyik tény vehet részt a beszélgetésekben).

## Hol találod?

Minden az **Insights** fülön él: **Chat** (a beszélgetés), **Knowledge** (a tudástár és a
jóváhagyó inbox), **Patterns** (a minta-inbox). Jó tudni: az Insights többi füle — Weekly,
Memoir, Predictions, Experiments — egyelőre **demó-tartalmat** mutat, azokat még nem a valódi
companion táplálja; az ott látott számokat ne vedd készpénznek. Élesben 2026. július 4. reggel
óta fut; a memória az első éjszakai körökkel kezd feltöltődni.
