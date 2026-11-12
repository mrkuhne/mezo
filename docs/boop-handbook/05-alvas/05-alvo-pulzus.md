---
cim: Alvás közbeni pulzus
szint: Kis funkció
terulet: Alvás
allapot: Részben kész
hol: [iPhone app, Apple Health, Háttérrendszer]
szulo: 01-ejszakak-apple-healthbol
szakasz: [B1]
osszefoglalo: A telefon kiszámolja az alvás alatti átlagpulzust, ha az Apple Egészségben van éjszakai pulzusadat — ma még nincs.
---

## Mit csinál
Minden éjszakához eltesszük az alvás közbeni átlagpulzust. Ez jó jelzője a pihenésnek: ha például szokásosan 55
körüli, és egyik éjjel 62, az fáradtságra vagy betegségre utalhat. Ma még **nem jelenik meg** sehol, és az
adatbázisban is üres, mert nincs miből számolni.

## Hogyan működik
1. A telefon az éjszaka nyertes alvásblokkján belül csak az **alvással töltött** szakaszokat veszi.
2. Ezekre az időszakokra lekéri az Apple Egészségből a pulzusmintákat, és átlagot számol.
3. Az átlagot az éjszakával együtt küldi el.
4. Ha nincs pulzusminta az éjszakában, a mező üres marad.

## Miért így
- A telefon már úgyis összerakja az éjszakát, egy plusz lekérdezés olcsó (B1 döntés).
- Hibának tűnt, hogy minden éjszakánál üres (bd jegy, 2026-11-11), de kiderült: az Apple Egészségben egyszerűen nincs éjszakai pulzus, mert a jelenlegi óra nem méri éjjel. **Nem programhiba** — magától kitöltődik, amint éjszaka is pulzust író órát vagy gyűrűt hordasz.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `sleep_log` | `sleeping_hr`: az alvás közbeni átlagpulzus (ütés/perc), üres, ha nincs adat |

## Mi jön még
- Apple Watch (B5) vagy okosgyűrű esetén automatikusan megtelik. Hogy hol jelenik meg (alvás-szoba, Forma), arról még nincs döntés.

## Mi marad ki
- Éjszakai pulzusgörbe nincs.
