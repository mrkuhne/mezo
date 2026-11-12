---
cim: Egy dátum, egy éjszaka
szint: Kis funkció
terulet: Alvás
allapot: Élesben
hol: [Háttérrendszer]
szulo: 00-attekintes
szakasz: [B1]
osszefoglalo: Egy reggelhez mindig csak egy érvényes éjszaka tartozik, akkor is, ha az Apple Egészségből és kézzel is jött adat.
---

## Mit csinál
Ha ugyanarra a reggelre kézzel is beírtál egy éjszakát (például a webes appban), és az Apple Egészségből is
megjött, a kettő **egy** éjszakává olvad össze. Így sehol nem látsz két különböző alvásidőt ugyanarra a napra.

## Hogyan működik
1. Az adatbázis szabálya: egy felhasználónak egy dátumra csak egy élő éjszakája lehet.
2. Összefésüléskor a **mért** adatok (lefekvés, ébredés, alvásidő, szakaszok, hipnogram, alvó pulzus, forrás app) az Apple Egészségből jönnek.
3. A **saját érzésed** szerinti adatok (minőség, felébredések száma, jegyzet) a kézi bejegyzésből maradnak meg.
4. Ha két írás egyszerre érkezik, a rendszer egyszer újrapróbálja az összefésülést, nem hoz létre második sort.
5. Ha egy éjszakát kitöröltél, az törölve marad — egy újraküldés nem éleszti fel.
6. Ha az Apple Egészségben törölsz egy éjszakát, a telefon a teljes 60 napos ablakot újraküldi, és ami onnan hiányzik, azt a szerver is törli.

## Miért így
- Korábban egy napra több éjszaka is lehetett, és a reggeli összefoglaló véletlenszerűen választott közülük. Egy adatbázis-szabály egyszerre javítja az összes helyet, ahol az alvást olvassuk (B1 döntés).
- A szenzor pontosabb az időpontokban, de a minőséget csak te tudod megmondani — ezért fele-fele.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `sleep_log` | Az éjszakák; a `uq_sleep_log_owner_date_live` szabály biztosítja, hogy dátumonként egy élő sor legyen |

## Mi jön még
Nincs.

## Mi marad ki
- Ha az összes éjszakát kitörlöd a 60 napból, azt a telefon nem tudja elküldeni (üres listát nem fogad a szerver) — ez ismert korlát.
- Egy kézzel átírt lefekvési idő nem írja felül a szenzor által mért időt.
