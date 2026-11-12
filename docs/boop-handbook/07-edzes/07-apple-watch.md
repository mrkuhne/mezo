---
cim: Apple Watch-app
szint: Funkció
terulet: Edzés
allapot: Tervezve
hol: [Apple Watch, iPhone app, Apple Health, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: Az órán indítod az edzést, a csuklódról rögzíted a sorozatokat, és közben élőben látod a pulzusodat.
---

## Mit csinál
Új, a webes appban nincs ilyen:

- **Edzés az órán:** a mai edzés gyakorlatai és az előírt sorozatok a csuklón.
- **Élő pulzus** edzés közben.
- **Sorozat-rögzítés a csuklóról:** súly, ismétlés, tartalék egy-két mozdulattal.
- **Pulzus sorozatonként:** minden sorozathoz eltárolódik, milyen volt a pulzus.
- **Futás az órával:** távolság és tempó is (ma a futás csak időszakaszokból áll).
- Később: check-in egy koppintással az óráról (spec §3.1 „Az appon kívül”).

## Hogyan működik (terv)
1. Az óra az Apple saját edzés-munkamenetét indítja (ez adja az élő pulzust és a pontos edzésrögzítést az Apple Health-be).
2. A sorozatok ugyanarra a háttér-végpontra mennek, mint a telefonról — az előírást továbbra is a szerver számolja.
3. A sorozatonkénti pulzushoz a háttérrendszerben új adatmező kell (ma nincs).
4. Az óra által rögzített edzés és a Boopban vezetett edzés **egynek** számít (lásd [Edzések az Apple Health-ből](09-edzesek-a-healthbol.md)).

## Miért így
- A fizetős Apple fejlesztői tagság (döntés #3) teszi lehetővé, hogy az óra-app hetente újratelepítés nélkül működjön.
- A Huawei Health nem ír pulzusváltozékonyságot és alvást; a teljes érték az Apple Watch-csal jön (spec §7).

## Beállítások
Nincs még.

## Adattáblák
Nincs még. A sorozatonkénti pulzus új mezőt vagy táblát igényel a B5-ben.

## Mi jön még
B5 (valószínűleg B5b): az óra-app egésze.

## Mi marad ki
Nincs.
