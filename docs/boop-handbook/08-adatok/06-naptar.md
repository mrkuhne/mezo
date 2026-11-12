---
cim: Naptár (csak olvasás)
szint: Funkció
terulet: Apple Health és adatok
allapot: Élesben
hol: [iPhone app, Naptár, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S2, B1]
osszefoglalo: A Boop az iPhone naptárából látja, mikor vagy elfoglalt, de soha nem ír bele, és a címeket nem adja oda az AI-nak.
---

## Mit csinál
A Boop az iPhone-on beállított összes naptárat olvassa (iCloud, Google, munkahelyi — ami a telefonon látszik).
Ebből tudja, mennyire zsúfolt a napod, és például szól, ha az edzésed túl közel esik az utolsó megbeszéléshez
(„Áttolom 18:30-ra”). A Ma oldalon a megbeszélések egy állomásként jelennek meg („Megbeszélések · 4 esemény”).

## Hogyan működik
1. Az első szinkron behozza az elmúlt 60 nap eseményeit + a mai és a holnapi napot; utána mindig a tegnap–ma–holnap ablakot.
2. Minden esemény egy állandó azonosítóval megy fel; ha egy elküldött napról eltűnik egy esemény (lemondták), a szerveren töröltnek jelölődik.
3. A múltbeli napokhoz többé nem nyúlunk — így megmarad a naptártörténet.
4. Üres címnél „(cím nélkül)”; a túl hosszú cím levágódik.
5. A reggeli összefoglaló a naptárból 15 perces „foglalt” sávokat csinál (06:00–24:00), és ebből dolgozik.
6. Az AI-nak csak darabszám, időtartamok és foglalt percek mennek — **események címe soha**.
7. Ha a naptár-lépés hibázik, az Egészség-adatok feltöltése attól még megmarad.

## Miért így
- A naptár **csak olvasás** (spec nem-cél): a Boop soha nem rak be, nem mozgat és nem töröl eseményt.
- Történet kell a későbbi „napi kapacitás” tanulásához (B7): hogyan érezted magad a zsúfolt napokon.
- Adatvédelem: a címek magánügyek, és az AI naplójába kerülnének.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.wearable.max-calendar-days` | Legfeljebb ennyi nap egy küldésben (a visszatöltés 14 napos csomagokban megy) | 31 |
| `mezo.wearable.max-events-per-day` | Legfeljebb ennyi esemény egy napon | 150 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `calendar_event` | Esemény: nap, cím, kezdés, vége, egész napos-e, naptár neve, állandó azonosító (`external_id`) |

## Mi jön még
- **B3 (Ellenőrzés):** a meghívottak száma a telefonon marad, és a napi cél javaslataihoz használjuk (nem küldjük fel).
- **B7:** az események AI-pontozása (szellemi terhelés, társasági fárasztás, fizikai) — címek csak a tulajdonos külön engedélyével.

## Mi marad ki
- Közvetlen Google Naptár kapcsolat nincs — csak ami az iPhone naptárában van.
- Visszaírás a naptárba nincs.
