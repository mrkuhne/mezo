---
cim: Szobák (mélyebb nézet)
szint: Funkció
terulet: Ma
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B2]
osszefoglalo: Bármelyik gömbre koppintva megnyílik a szobája — mindig ugyanaz a négy rész, így sosem kell újratanulni.
---

## Mit csinál
Öt szoba van: **Forma, Alvás, Mozgás, Fuel, Pulzus**. Megnyílik a gömbre, a nagy gömbre vagy egy idővonal-elemre
koppintva. Minden szoba négy számozott részből áll:

1. **A szint** — a szám és egy felirat, az Alvásnál az éjszaka fázisai, a gömb csempéi, és egy sor a részletes lapra.
2. **A hét** — például a mélyalvás vagy a nyugalmi pulzus oszlopai, a Formánál az energiavonal.
3. **A napok mögötte** — a hét mögötti napok, legfelül a mai.
4. **Mit tehetsz** — a gömb javaslata és a hozzá tartozó teendők.

Visszafelé húzással lehet kilépni.

## Hogyan működik
A szobák a reggeli összefoglaló adataiból épülnek. Ahol még nincs adat, egy őszinte „hamarosan” sor áll, nem egy
kitalált szám. A részletes lapok (éjszaka, pulzus, nap) és a „miért?” lap minden szobából elérhető.

## Miért így
A spec szerint minden terület **ugyanazt a vázat** kapja: ítélet → szint/görbe → a mögötte lévő napok → teendők. Így
a Boop nem érződik öt külön appnak.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `boop_brief` | A szobák adatai (heti sorok, napok) |

## Mi jön még
- Az Étel szoba saját belső fülekkel (Ma · Receptek · Kamra · Hét) — B4.
- Az Edzés szoba (Ma · Terv · Gyakorlatok · Előzmények) — B5.

## Mi marad ki
Szakértői oldalak — a szakértők csak a „miért?” mögött szólalnak meg.
