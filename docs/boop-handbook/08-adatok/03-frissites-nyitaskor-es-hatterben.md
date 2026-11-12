---
cim: Frissítés nyitáskor és a háttérben
szint: Funkció
terulet: Apple Health és adatok
allapot: Részben kész
hol: [iPhone app, Apple Health, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S2, B1]
osszefoglalo: Minden megnyitáskor csak az új adatok mennek fel; a háttérben érkező frissítés be van építve, de csak a fizetős Apple-fiókkal lesz kipróbálva.
---

## Mit csinál
Nem kell semmit nyomnod: amikor megnyitod a Boopot, a telefon felküldi, ami azóta új lett az Egészségben, és
utána a reggeli összefoglaló is magától frissül. A cél, hogy később zárt telefonnál is jöjjön az adat (például
reggel, amint a Sleep Cycle beírta az éjszakát) — ez a kód már benne van, de még nincs igazolva.

## Hogyan működik
1. **Nyitáskor:** ha az utolsó frissítés 10 percnél régebbi, indul egy kör. Naptárváltozáskor a naptár külön is újraküldődik.
2. **Csak az új:** adattípusonként egy „könyvjelzőt” tartunk; a telefon csak az azóta jött (és törölt) mintákat kéri le.
3. **Biztonság:** a könyvjelző csak akkor lép előre, ha a szerver visszaigazolta a csomagot. Ha megszakad (net, szerverhiba, zárt telefon), legközelebb újraküldi — semmi nem vész el, semmi nem duplázódik.
4. **Háttérben:** az app indításkor feliratkozik az Egészség változásaira. Alvás, edzés és testsúly azonnali értesítést kér, a többi óránkéntit. Minden ébresztés egy összevont, csendes kört futtat.
5. Két kör soha nem fut egyszerre; ha egy már megy, a második megvárja.

## Miért így
- A könyvjelzős olvasás gyorsabb és kíméli az akkumulátort, és így a törléseket is látjuk.
- A háttérfrissítéshez az Apple fizetős fejlesztői fiókja kell a megbízható működéshez; a tulajdonos döntött róla (2026-11-11), az előfizetés kb. 2026-11-25-re várható.

## Beállítások
Nincs (a telefonon belül: 10 perces türelmi idő a nyitáskori frissítések között).

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `daily_metric`, `health_sample`, `sleep_log`, `wearable_workout`, `calendar_event` | A frissített adatok |

## Mi jön még
- **Fizetős fiók:** a telefonon igazolni, hogy egy zárt telefonos óra után új sorok jelennek meg a szerveren.

## Mi marad ki
- Ha egy app (pl. Sleep Cycle) átírja a régebbi éjszakáit, a telefon újraküldi a 60 napos ablakot — ez néha több adatforgalom.
