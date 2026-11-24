---
cim: Edzés pótlása — „Megvolt” a terv számaival
szint: Funkció
terulet: Edzés
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [Kezdőlap]
osszefoglalo: Egy kimaradt konditermi tervnap utólag is könyvelhető a Napló napjáról: a terv sorozataival, a nap dátumára, egy koppintással — net nélkül is.
---

## Mit csinál
A Napló egy korábbi napjának lapján, ha arra a hétköznapra van tervnap és nincs kész edzés, ott az **„Edzés pótlása:
Pull Day”** sor (2026-11-24). A Megvolt lapon:

- **A terv sorozatai** gyakorlatonként: „3 × 8 · 60 kg” — a mai terv ajánlása. A sorra koppintva a **súlyt
  gyakorlatonként átírhatod** a könyvelés előtt; ahol még nincs ajánlott súly („– kg · írd be”), ott beírod, vagy az a
  gyakorlat kimarad.
- **Mikor:** a terv ideje (vagy este hat), vagy más időpont.
- **Megvolt:** a szerver a nap dátumára készre könyveli az edzést a terv sorozataival; időtartam nincs kitalálva.

A könyvelt edzés az Előzményekben és a heti terhelésben úgy látszik, mint bármelyik kész edzés. Utólag a számok már
nem módosíthatók.

## Hogyan működik
- Egy hétre visszamenőleg lehet pótolni. Ha fut egy élő edzés, előbb azt kell befejezni („Előbb fejezd be a futó
  edzést”); ha az a tervnap azon a héten már megvolt, a szerver nem könyvel másodikat („Ezen a héten már megvolt”).
- Net nélkül a könyvelés a telefonon vár, és amint van net, elmegy; ugyanaz a sor nem könyvelődik kétszer.

## Miért így
A tulajdonos a visszamenőleges rögzítés listáján az „edzés”-t is kérte; a Sport-kerülőút a terv napját hamisan
üresen hagyta volna. B változat (2026-11-24): a terv számaival, a végére téve, hogy a többi ne várjon rá. Egy
pontosítás: a „javító lap” csak futó edzésen él, ezért a súly a Megvolt lapon írható át, utána már nem.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `workout_session` | A könyvelt edzés (a nap dátumával, és egy telefonos azonosítóval, hogy ne könyvelődjön kétszer) |
| `exercise_set` | A terv sorozatai készként; a súly nélküli gyakorlat „kihagyva” jellel |

## Mi jön még
- A könyvelt edzés számainak utólagos javítása az Előzményekből.

## Mi marad ki
Sorozatonként pontos számok beírása utólag — a terv számai mennek be.
