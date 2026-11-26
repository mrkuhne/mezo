---
cim: Napi bírás és Átrendezés
szint: Funkció
terulet: Ma
allapot: Részben kész
hol: [iPhone app, Háttérrendszer, AI, Naptár, Apple Health]
szulo: 00-attekintes
szakasz: [B7]
osszefoglalo: Reggel egy mondatban megtudod, belefér-e a nap; ha egy nap vagy hét túl sok, Boop egy új oldalon megmutatja, mit tenne át, minden kereszthatással, és a jóváhagyásod után mindenhol átkerül, de az Évad terve nem változik.
---

## Mit csinál
- **Reggel** a Ma oldal reggeli sora egy szóval és egy okkal mondja meg, milyen a nap: laza, rendben, szoros vagy túl
  sok (például: „Szoros, de belefér: rövid éjszaka, 4 megbeszélés délelőtt, lábnap este”).
- **A napod oldalán** az energiagörbe a nap terhével számol, és látod, mi visz el energiát (melyik program mennyire
  fáraszt szellemileg, emberek közt vagy fizikailag, és mi tölt fel), valamint azt, miből gazdálkodsz (alvás, pulzus,
  tegnapi edzés és evés, a bejelentkezésed).
- **Átrendezés:** egy új oldal, ahol Boop megmutatja, mit tenne át a héten: edzést másik napra vagy időpontra,
  rövidebb vagy könnyebb edzést, később fekvést a másnap reggeli edzés csúsztatásával, más ételelosztást, egy program
  lemondását vagy áttételét. Minden javaslatnál látod az összes kereszthatását (kalória, alvás, heti edzésszám,
  súlycél), és egyenként hagyod jóvá.
- **Az Évad oldalon** hétről hétre látod a terhedet a pihenésedhez mérve, és Boop szól, ha a teher hetek óta
  gyorsabban nő, mint ahogy pihensz.
- **Előre szól:** vasárnap este átnézi a jövő hetet, és ha túl sok lenne, már akkor javasol.

## Hogyan működik
1. A telefon a naptár minden adatát elküldi (cím, időpont, résztvevők, helyszín, ismétlődés). Az MI minden programot
   felcímkéz: mennyire fáraszt szellemileg, emberek közt és fizikailag, vagy éppen feltölt.
2. A háttérrendszer összeadja a nap terhét. Az egymás utáni, szünet nélküli megbeszélések többet érnek, a szünetek
   pihentetnek. Hozzáadja az edzést is.
3. Ugyanez kiszámolja, mennyit bírsz ma: a saját szokásos napjaidhoz méri az alvásodat, a pulzusodat, a tegnapi
   terhet és evést, és ha kitöltötted, a reggeli bejelentkezést.
4. A kettő arányából lesz a reggeli szó. Az esti zárásod („milyen volt a nap?”) mutatja meg, mennyire találta el;
   ebből hétről hétre pontosodik. Amíg kevés az adat, kiírja: „még tanulom, mennyit bírsz”.
5. Ha egy nap túl sok, a javaslatokat szabályok rakják össze, a hatásokat pedig ugyanazok a számolások adják, mint az
   Évadnál. Az MI csak megfogalmazza a szöveget, számot nem talál ki.
6. Ha jóváhagysz egy javaslatot, az egy közös „heti áttételek” listába kerül, és innen olvas a Ma oldal, a napod
   oldala, az Edzés, az Étel, az esti lefekvési emlékeztető és Boop is. Az Évad terve nem változik.
7. Egy megbeszélés áttételét a Boop nem csinálja meg a naptáradban: teendőként felírja, és amikor a naptárban átkerült,
   mindent ahhoz igazít.
8. Minden javaslatot, a döntésedet és azt, hogyan sült el a nap, megjegyzi. Ha valami többször ismétlődik (például a
   sűrű csütörtökökön elmarad az esti edzés), azt mintaként megmutatja, és előre szól miatta.

## Miért így
Döntések, 2026-11-21: a napi bírást mindenből tanulja a Boop; Átrendezés jóváhagyással, csak arra a napra és hétre;
a naptárat továbbra sem írja; a naptár minden adatát láthatja az MI; minden áttételt megjegyez, és az évad szintjén is
figyel.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| (épül) | A reggeli szavak határai, a vasárnapi átnézés időpontja, a javaslatok száma | vasárnap 18:00, legfeljebb 5 javaslat egy hétre |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `calendar_event_score` | Programonként a fárasztás címkéi |
| `day_adjustment` | A jóváhagyott heti áttételek (ez az, amit az app mindenhol olvas) |
| `capacity_proposal` | Minden javaslat és a döntésed (hogy hogyan sült el, azt az előrejelzés lépés tölti) |

## Mi jön még
Négy lépésben épül: alap (címkézés és becslés), reggel és Évad, Átrendezés, előrejelzés. Az első három kész:
- a Ma oldal reggeli sorában a nap szava és az oka, a napod oldalán a „Mennyit bírsz ma”, a „Mi visz el ma energiát”
  és az „Amiből gazdálkodsz” rész, az Évad oldalon a heti teher és pihenés képe;
- **Átrendezés:** ha egy nap túl sok, a Ma oldalon megjelenik egy kártya, ami az Átrendezés oldalra visz. Ott minden
  javaslatnál látod a hatásait („Minden hatása”), egyenként jóváhagyhatod, visszavonhatod, vagy azt mondhatod: „Most
  nem”. Egy jóváhagyott edzés-áttétel a Ma oldalon, a napod oldalán, az Edzésnél, az Ételnél és az Évad „Hogy megy”
  részén is az új napon látszik, egyszer számolva. Egy megbeszélés áttétele teendő lesz, ami magától „kész”, amikor a
  naptáradban átkerült.
- Ha közben az Évad oldalon módosítod az edzésnapjaidat, vagy új blokk indul, a terv nyer: a már nem illő áttételek
  lejárnak, a már letolt edzések viszont megmaradnak a múltban.

Hátravan: a vasárnapi előrejelzés, és hogy a Boop a korábbi áttételekből tanuljon („Korábban áttettük”, „Ebből tanulok”).

## Mi marad ki
- A Boop nem ír a naptáradba, és nem mond le helyetted megbeszélést.
- Az Évad tervét egy javaslat nem módosítja; ha egy javaslat a tervet érintené, az Évad saját módosító oldalát nyitja meg.
