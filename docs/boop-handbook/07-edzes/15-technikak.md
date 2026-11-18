---
cim: Intenzitás-technikák és a napi kihívás
szint: Funkció
terulet: Edzés
allapot: Részben kész
hol: [Háttérrendszer]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: Egy gyakorlat utolsó sorozata helyett technikát (pihenős drop, drop set, myo set, félismétlések) vagy a nap kihívását írhatod elő; az edzés közben a rendszer lépésről lépésre megmondja, a napló pedig rögzíti.
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

A technika **a tervben a te döntésed**: te mondod meg, melyik gyakorlatra kerül. Egy gyakorlatra egyszerre egy technika vagy a kihívás kerülhet;
ha a kettő ütközik, a **kihívás nyer**. Egy napon legfeljebb **egy kihívás** lehet.

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
   legközelebbi, de nem nagyobb súlyra kerekítve), a pihenőket és hogy bukásig kell-e menni. A futó blokkban egy gyakorlat technikája edzés közben is
   átállítható.
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

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `meso_template`, `mesocycle` | A blokk „technikák bekapcsolva” jelzése |
| `exercise` | A gyakorlat technikája, ki állította be, és hogy kihívás-e |
| `exercise_set` | A sorozat technikája |
| `exercise_set_leg` | A technikás sorozat részei: drop, mini-sorozat, félismétlés — súly, ismétlés, pihenő |

## Mi jön még
- A technikák **automatikus elhelyezése** és a kihívás felajánlása (T3).
- A mesterséges intelligencia használata a technikákkal (T4).
- A telefonos képernyők: a blokk-építőben a beállítás, edzés közben a lépések megjelenítése.
- Az AI-összesítők (a Boop-társ kimutatásai) még nem számolják a technikák plusz részeit az összes súlyba.
- A tervezési előnézet még nem számol kettővel a napi határoknál.

## Mi marad ki
A webes app nem kapja meg (befagyasztott). Technika csak a bekapcsolt blokkokban él: a futó blokk és a webes blokkok változatlanok.
Automatikus technika-elhelyezés és AI egyelőre nincs.
