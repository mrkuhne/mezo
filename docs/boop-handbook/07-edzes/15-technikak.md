---
cim: Intenzitás-technikák és a napi kihívás
szint: Funkció
terulet: Edzés
allapot: Részben kész
hol: [Háttérrendszer]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: Egy gyakorlat utolsó sorozata helyett technikát (pihenős drop, drop set, myo set, félismétlések) vagy a nap kihívását írhatod elő, de a rendszer is elhelyezi őket a stílusos, technikás blokkban; edzés közben lépésről lépésre megmondja, a napló pedig rögzíti.
---

## Mit csinál
Egy gyakorlat **utolsó munkasorozatát** le lehet cserélni egy **intenzitás-technikára**. Az öt lehetőség:

| Technika | Mit jelent |
|---|---|
| **Pihenős drop** (a te változatod) | Egy sorozat bukásig, rövid, 30 másodperces pihenő, majd kisebb súllyal (a súly 70%-ával) ugyanannyi ismétlés. |
| **Drop set** | Egy sorozat bukásig, szünet nélkül kisebb súllyal (a súly 80%-ával) újra bukásig. |
| **Myo set** | Egy aktiváló sorozat (egy ismétlésnyi tartalékkal), majd legfeljebb négy rövid, 5 ismétléses mini-sorozat 20 másodperces szünetekkel; ha egy mini-sorozat 3 ismétlés alá esik, vége. |
| **Félismétlések** | Egy sorozat bukásig, majd a nyújtott szakaszban végzett részismétlések bukásig. |
| **Napi kihívás** | A nap egyik gyakorlatán félismétlések bukásig, és a rendszer megmondja az eddigi legjobbat ugyanazzal a súllyal. |

A technikát **te is megadhatod** a tervben, a rendszer pedig (lásd lent) maga is elhelyezhet. Egy gyakorlatra egyszerre egy technika vagy a kihívás kerülhet;
ha a kettő ütközik, a **kihívás nyer**. Egy napon legfeljebb **egy kihívás** lehet.

## Az automatikus elhelyezés (2026-11-19)
Ha a blokknak van **edzésstílusa**, és a **technikák be vannak kapcsolva**, a rendszer magától is elhelyezi a technikákat és a napi kihívást.
Más blokkban (a webesekben és a most futóban) ez nem történik meg.

**Technikák:**
- **A 3. héttől az utolsó terhelő hétig.** Az első két héten még nincs technika, a könnyített héten sem.
- **Naponta legfeljebb kettő.** Ha fogyókúrában vagy, vagy aznap sport is van, akkor legfeljebb egy. Egy izomra hetente legfeljebb **két** technikás
  gyakorlat jut (például a hátra a hét két utolsó edzésnapján).
- **A Hangsúly izmok kapják először**, utána az Építés, **a Tartás izom soha**. Egy izmon belül az edzés végén lévő gyakorlat kerül sorra.
- **Csak stabil gyakorlat, az izom utolsó gyakorlata aznap**, és legalább két sorozatos legyen: a technika **egy sima sorozatot vált ki**
  (például 3 sorozatból 2 sima és 1 technikás lesz).
- **Mit kap:** a sok ismétléses (15 fölötti) izolációs gyakorlat myo szettet; a gépes és kábeles gyakorlat a te pihenős dropodat. Drop setet és
  félismétlést a rendszer magától nem választ.
- **A sport által terhelt izomra sportnapon nincs technika.**

**A napi kihívás** az **első héttől** jár: a nap első olyan gyakorlata kapja, amelyik stabil és nyújtott helyzetben is biztonságos; a Hangsúly izom
előnyben. Ha a nap egyik izma sportnapon a sporttól amúgy is terhelt, azt kihagyja; ha nincs ilyen gyakorlat, aznap nincs kihívás. A kihívást
sportnapon az edzés nem is mutatja.

**A te választásod szent.** Amit te állítottál be, azt a rendszer soha nem írja át és nem veszi el, de **beleszámít a keretbe** (ha a tiéid miatt
már túl sok a technika, ezt jelzi, de nem töröl semmit).

**Hol látod.** A blokk-építő a tervezéskor **hétről hétre** megmutatja, hol lesz technika és kihívás, és figyelmeztet (például ha egy napra nem
talált kihívást). A futó blokkban a változás a **heti javaslat soraiként** érkezik: automata módban magától életbe lép, kézi módban te
fogadod el. Ha közben te átírtad az adott gyakorlatot, a te számod marad.

## Megállt a fejlődés: egy ajánlat
Ha egy izom két hete nem fejlődik, a rendszer **egyetlen** javaslatot tesz, ebben a sorrendben (az első, ami szóba jöhet):
1. **technika** az izom egyik gyakorlatára;
2. **ismétlés-tartomány váltás** (a nehéz vagy a sok ismétlésű tartományról a középre, a középről a sok ismétlésűre);
3. **egy hét kevesebb sorozat**, ami a következő héten **visszajön** (csak ha az izom nem Tartás szinten van).

## Kinek lehet
- Csak **stabil** gyakorlat kaphat technikát (gép, kábel, támasztott hát, ülve — lásd [Edzésstílus](14-edzesstilus.md)): ott biztonságos bukásig menni.
- A **félismétlés és a kihívás** ráadásul csak olyan gyakorlaton engedett, amely **nyújtott helyzetben is biztonságosan** terheli az izmot.
- A rendszer ezt a szerveren ellenőrzi: ha a kért gyakorlat nem felel meg, a mentés elutasításra kerül, és megmondja, miért. Ha egy gyakorlatot később
  átsorolsz, és a korábban beállított technika már nem érvényes, az **csendben lekerül** róla.

## Hogyan működik
1. **A technika az utolsó sorozatot váltja le** (tulajdonosi döntés, 2026-11-18): a sorozatok száma nem nő. Ha egy gyakorlatnak csak egy sorozata van,
   az a technikás sorozat.
2. **Csak terhelő héten.** A blokk első két hetében is él, de **lazító (deload) héten nincs technika**, ott egyszerű sorozatok vannak.
3. **Kímélő napon sincs.** Ha visszatérő napod van, vagy a mai állapotod alapján a rendszer könnyítést javasol, azon a napon **egyik sorozaton sincs technika
   és kihívás** — biztonsági okból.
4. **Csak bekapcsolt blokkban.** A technikák blokkonként kapcsolhatók (alapból ki). A webes blokkok és a most futó blokk változatlanok maradnak.
5. **Edzés közben** a napi edzés az utolsó sorozatnál megmutatja a lépéseket: az alapsorozatot, majd a drop súlyát (a ténylegesen emelhető
   legközelebbi, de nem nagyobb súlyra kerekítve), a pihenőket és hogy bukásig kell-e menni. A futó blokkban egy gyakorlat technikája a blokk napjain
   menet közben is átállítható (a már elkezdett edzésen nem).
6. **A napló** a sorozat alatt rögzíti, mit csináltál valójában (a drop súlyát és ismétlését, a mini-sorozatokat, a félismétlések számát). A naplózás a
   blokk beállításától függetlenül mindig működik: azt írjuk fel, amit csináltál. Egy webes szerkesztés sosem törli a már rögzített részeket.

## Mi számít, és mi nem
- **Rekordba és a következő edzés kiindulásába nem számít** a technikás sorozat: a következő alkalommal a rendes sorozataidból számolunk, így egy
  szándékos bukásig menés nem lesz „őrlés”, és nem nyomja le a javaslatot.
- **A heti sorozatszámba egyként számít** (a heti sávban egy sorozat), a **napi határoknál viszont kettőként** (gyakorlatonként 5, edzésenként 8): egy
  technikás sorozat többet fárasztja az izmot.
- **Az összes megemelt súlyba** a drop és a myo mini-sorozatok beleszámítanak, a **félismétlések nem**.
- **A szándékos bukásig menés nem „túl nehéz” jel**: a rendszer nem tekinti túlterhelésnek.
- **A napi kihívás** a legjobb eredményt számolja (hány félismétlést csináltál ugyanazzal a súllyal, csak befejezett edzésekből); nem kap külön érmet.
- A napi „mélység” kihívás (a proaktív kihívások között) is az utolsó **rendes** sorozatból értékel.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.train.technique.rest-drop` | Pihenős drop: tartalék, súlycsökkentés, pihenő | 0 · 30% · 30 mp |
| `mezo.train.technique.drop` | Drop set: tartalék, súlycsökkentés, pihenő | 0 · 20% · 0 mp |
| `mezo.train.technique.myo` | Myo: aktiváló tartalék, mini-ismétlés, alsó határ, pihenő, mini-sorozatok száma | 1 · 5 · 3 · 20 mp · 4 |
| `mezo.train.technique.partials` | Félismétlések: tartalék | 0 |
| `mezo.train.technique.cap-weight` | Hány sorozatnak számít a technikás sorozat a napi határoknál | 2 |
| `mezo.train.technique.planner` | Automatikus elhelyezés: kezdő hét, naponta legfeljebb, naponta legfeljebb (fogyókúrában vagy sportnapon), izmonként hetente legfeljebb, a myo-hoz szükséges ismétlésszám | 3 · 2 · 1 · 2 · 15 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `meso_template`, `mesocycle` | A blokk „technikák bekapcsolva” jelzése |
| `exercise` | A gyakorlat technikája, ki állította be (te vagy a rendszer), és hogy kihívás-e |
| `exercise_set` | A sorozat technikája |
| `exercise_set_leg` | A technikás sorozat részei: drop, mini-sorozat, félismétlés — súly, ismétlés, pihenő |

## Mi jön még
- A mesterséges intelligencia finomítása a technikákkal (T4).
- A telefonos képernyők: a blokk-építőben a beállítás, edzés közben a lépések megjelenítése.
- Az AI-összesítők (a Boop-társ kimutatásai) még nem számolják a technikák plusz részeit az összes súlyba.

## Mi marad ki
A webes app nem kapja meg (befagyasztott). Technika csak a bekapcsolt blokkokban él: a futó blokk és a webes blokkok változatlanok.
Az AI-finomítás egyelőre nincs.
