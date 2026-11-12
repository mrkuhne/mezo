---
cim: Első lépések és összekötés
szint: Funkció
terulet: Alapok
allapot: Élesben
hol: [iPhone app, Háttérrendszer, Apple Health, Naptár]
szulo: 00-attekintes
szakasz: [S1, S2]
osszefoglalo: Az első indításkor pár adatot kér rólad, egy mérést, majd összeköti az Apple Egészséget és a naptárat, és behúzza az elmúlt 60 napot.
---

## Mit csinál
Három rövid lépés jön az első belépés után:

1. **Pár adat rólad** — nem, magasság (vonalzón görgetve), születési dátum.
2. **Mennyi ma?** — a mai testsúly egy tizedes pontossággal.
3. **„Szia, Boop vagyok”** — bemutatkozás, utána a kezdőlap.

Ezután jön a **Kössük össze** lap: az Apple Egészség és a Naptár engedélye. A Boop elmagyarázza, hogy az
Egészség lapon a teljes időszakot érdemes választani. Majd „Behúzom az elmúlt 60 napot”: a gömb közben telik, és a
végén ilyet mond, például: „Megvan: 58 éjszaka, 60 nap mozgás és 21 edzés.”

## Hogyan működik
- Ha megszakad a bemutatkozás, a Boop a következő indításkor ott folytatja, ahol abbamaradt.
- Az Egészségből olvas: alvás, lépés, aktív energia, pulzus, nyugalmi pulzus, edzések, és (B1 óta) sok más mérés.
- A naptárból csak olvas, és csak a mai és a holnapi eseményeket küldi fel (a múltat egyszer, 60 napra visszamenőleg).
- Ha nincs Egészség-adat, egy kártya megmondja, hol kell bekapcsolni; ha a naptárat elutasítod, a másik forrás
  akkor is szinkronizál. A „Most kihagyom” mindig kivisz.

## Miért így
A Boop reggeli ítélete az alvásból és a pulzusból dolgozik; 60 nap kell ahhoz, hogy legyen mihez viszonyítani.
A naptár csak olvasható marad (spec, „Mi marad ki”) — a Boop sosem ír bele.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.wearable.zone` | Melyik időzóna szerint számít „ma” | Europe/Budapest |
| `mezo.wearable.max-calendar-days` | Hány naptári nap jöhet egy küldésben | 31 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `biometric_profile` | Nem, magasság, születési dátum |
| `weight_log` | A testsúlymérések (kézi vagy Apple Egészségből) |
| `calendar_event` | A naptár eseményei (cím, kezdés, vég) |

## Mi jön még
Részletek az Apple Health és adatok szekcióban (08-adatok).

## Mi marad ki
A Boop nem kér semmilyen adatot, amire nincs szüksége a reggeli ítélethez.
