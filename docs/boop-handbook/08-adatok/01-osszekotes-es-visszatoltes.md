---
cim: Összekötés és 60 napos visszatöltés
szint: Funkció
terulet: Apple Health és adatok
allapot: Élesben
hol: [iPhone app, Apple Health, Naptár, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S2, B1]
osszefoglalo: Egy rövid lépéssorral összekötöd a Boopot az Egészséggel és a naptárral, és az app azonnal behozza az elmúlt 60 napot.
---

## Mit csinál
Az első mérlegelés után (vagy később a „Kössük össze az Egészséget és a naptárat” sorról) a Boop végigvezet:

1. **Kössük össze** — felsorolja, mit kér (Apple Egészség, Naptár), és figyelmeztet, hogy az iPhone engedélyablakában a teljes időszakot válaszd.
2. Az iPhone megkérdezi az engedélyt az Egészség olvasására, majd a naptár olvasására.
3. **Behúzom az elmúlt 60 napot** — a gömb megtelik, élőben számolja a behozottakat, a végén például: „Megvan: 58 éjszaka, 60 nap mozgás és 21 edzés.”

A „Most kihagyom” mindig kilép. Utána a kezdőlapon egy „Beérkezett adatok” kártya mutatja az eddig behozott
mennyiségeket és az állapotot (frissítem… · nem sikerült frissíteni · naptár: nincs engedély · frissítve 08:12).
Rákoppintva frissít.

## Hogyan működik
1. Az első futás 60 napot olvas (a pulzust csak 14 napra, mert abból nagyon sok van).
2. Sorrendben küld: éjszakák → napi összesítők → edzések → egyedi mérések → pulzusblokkok → naptár, kis csomagokban.
3. Ha megszakad (például elmegy a net), a következő indítás újraküldi — a szerver nem duplikál.
4. Ha nincs Egészség-adat, egy kártya megmondja, hol kapcsold be (Egészség app › Megosztás › Appok › Boop); ha a naptárat utasítod el, egy sor mutatja az utat (Beállítások › Boop › Naptárak). A másik forrás ettől még szinkronizál.
5. A számlálók minden éjszakát / napot / edzést csak egyszer számolnak, akkor is, ha újra elküldtük.

## Miért így
- 60 nap elég ahhoz, hogy a Forma 14 éjszakás tanulási ideje rögtön meglegyen, és legyen saját átlag.
- A pulzus 14 napra korlátozva, hogy a visszatöltés ne legyen óriási.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.wearable.max-sleep-nights` | Éjszakák egy küldésben | 100 |
| `mezo.wearable.max-days` | Napok egy küldésben | 120 |
| `mezo.wearable.max-workouts` | Edzések egy küldésben | 300 |
| `mezo.wearable.max-samples` | Egyedi mérések egy küldésben | 1000 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `sleep_log`, `daily_metric`, `wearable_workout`, `health_sample`, `calendar_event` | A behúzott adatok (lásd a többi oldalt) |

## Mi jön még
Nincs.

## Mi marad ki
- Az iOS engedélyablakában a „csak az utolsó 30 nap” választás korlátozza a visszatöltést — ezt az app nem tudja felülírni, csak figyelmeztet.
