---
cim: Alvás pontszám és Forma
szint: Kis funkció
terulet: Alvás
allapot: Élesben
hol: [Háttérrendszer, iPhone app]
szulo: 00-attekintes
szakasz: [S3]
osszefoglalo: Az éjszakádból 0–100-as Alvás pontszám lesz, és ez adja a reggeli Forma (kipihentség) majdnem felét.
---

## Mit csinál
Reggel az Alvás gömbön egy szám áll (például 82), és ugyanez az éjszaka a legnagyobb súllyal számít bele a
**Forma** gömbbe, ami azt mondja meg, mennyire vagy ma formában. Amíg nincs legalább 14 rögzített éjszaka, a
Forma helyén „–” és „még tanulom” áll, nem 0.

## Hogyan működik
1. **Alvás pontszám:** mennyit aludtál a célodhoz képest (70%) + az általad adott minőség (30%). Ha nincs minőség — és az Apple Egészségből jövő éjszakáknál nincs —, csak az időtartam számít. Például 6 óra alvás 8 órás célnál ≈ 75.
2. **Forma:** 45% Alvás + 35% Pulzus (nyugalmi pulzus a saját 14 napos átlagodhoz képest; ha nincs adat, semleges 70) + 20% terhelés (tegnapi edzésperc alapján).
3. Állapot: 70 felett „jó”, 50–69 „rendben”, 50 alatt „fáradt”.
4. A számot a háttérrendszer számolja; a mesterséges intelligencia csak szavakba önti, nem pontoz.

## Miért így
- Az alvás a pihenés legerősebb jele, ezért kapja a legnagyobb súlyt.
- 14 éjszaka nélkül nincs megbízható alap — inkább mondjuk, hogy még tanulunk, mint hogy hamis számot mutassunk.
- Fontos korlát: mivel az Apple Egészség éjszakáinál nincs minőség, egy rövid jó és egy hosszú rossz éjszaka ugyanannyit érhet.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.boop.nights-needed` | Éjszakák száma, ami után a Forma megjelenik | 14 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `boop_brief` | A kiszámolt pontszámok a napi összefoglalóban |
| `sleep_log` | Az éjszakák (időtartam, minőség) |
| `sleep_goal` | A célidő, amihez az alvást mérjük |

## Mi jön még
- **B7:** a nap „kapacitása” a Formára, HRV-re és alvásadósságra épül majd, a check-inekből kalibrálva.

## Mi marad ki
- HRV, alvásadósság és rendszeresség még nincs benne a Formában; a súlyok kézzel választottak, nem személyre hangoltak.
