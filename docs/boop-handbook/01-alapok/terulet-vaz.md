---
cim: A területek közös váza
szint: Funkció
terulet: Alapok
allapot: Élesben
hol: [iPhone app]
szulo: 00-attekintes
szakasz: [Kezdőlap]
osszefoglalo: Minden terület oldala egyetlen közös vázból épül, hogy az Étel, az Edzés, a Pénz és a Levél ugyanúgy nézzen ki és ugyanúgy viselkedjen.
---

## Mit csinál
Amikor a körből belépsz egy területre, mindegyik ugyanazt a felépítést kapja:

- **Fejléc**: a terület gömbje egy vékony vonal fölött, alatta **balra** a terület neve, a mai ítélete és egy
  mondat; jobbra fent keresés és beállítások. Ahol van hozzá saját fotó, az adja a hátteret.
- **Saját alsó menüsor**: minden területnek megvan a maga néhány oldala — ez teszi külön kis alkalmazássá —,
  mindegyiken egy kis jelzés, ha van mögötte néznivaló, és a sor végén egy fix gomb, amivel Boopot kérdezheted
  erről a területről. Amíg egy terület nyitva van, a szokásos alsó sáv félreáll.
- Alatta **építőelemek** abból a készletből, amit minden terület használhat: a nap egy mondata (akár gombokkal),
  számok, görbe célvonallal, lépcsős oszlopok, összetétel-sáv, soros listák, hőtérkép, összehasonlítás,
  „mit tud még ez a terület” rács, és egy sor, amivel egyenesen Boophoz fordulhatsz az adott területről.

A területek saját menüi (2026-11-16-tól, a szimulátorban jóváhagyott minta szerint):

| Terület | A saját oldalai |
|---|---|
| **Alvás** | Ma · Hét · Előzmények |
| **Energia** | Ma · Check-inek · Minták |
| **Edzés** | Ma · Blokk · Gyakorlatok · Előzmények |
| **Forma** | Ma · Mi hat rá |
| **Étel** | Ma · Receptek · Kamra · Hét |
| **Pénz** | Ma · Pénzem · Költés · Gyakorlás |
| **Levél** | Ma · Figyelt · Szabályok · Fiókok |

A **Pénz** és a **Levél** oldala is megvan, a Levélnek már valódi tartalma is van (a reggeli posta); ahol valami még nem él (például a Figyelt fül), a fül megmondja, mi lesz rajta, és egyetlen
kitalált számot sem mutat. Ugyanez a szabály a többi területen is: ahol a minta olyat mutat, amit az app még nem
tud (például a nyolchetes edzésblokk), ott a fül ezt kimondja.

## Hogyan működik
1. A számok, a görbe és a listák **nem dobozban** ülnek, hanem közvetlenül a lapon, egy színes vonalkával és egy
   felirattal — a lényeges számok a terület saját színét viselik.
2. **Minden szakasz magának tölt és magának hibázik**: ha egy rész nem jön meg, csak ott jelenik meg egy „Újra”,
   a többi marad a helyén.
3. Ha egy szám **régi adatból** jön, azt kiírja. Ha fontos lenne, és mégis régi, borostyánsárga jelzést kap.
   Ha nincs friss adat, azt mondja ki — nem mutat nullát.
4. A listasorok négyféleképpen nézhetnek ki: hétköznapi, **megvolt** (pipa), **kimaradt** (kifakult, mellette az
   okával), **hátravan** (szaggatott körvonal) — akkor is, ha a sorban fotó van.
5. Fülváltáskor a lap visszajön a fülekhez, ha lejjebb voltál.

## Miért így
Így nem hét különböző appot építünk hét területre. Amit egyszer megtanulsz az Étel szobában, az ugyanúgy működik
majd az Edzésben, a Pénzben és a Levélben is — és amikor valami javul a vázon, mind a hét területen javul.

## Mi jön még
- Az Edzés területe erre a vázra épül.
- Később a Pénz és a Levél is.
