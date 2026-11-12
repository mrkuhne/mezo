---
cim: A Terv keret (B2)
szint: Funkció
terulet: Terv
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B2]
osszefoglalo: A Terv oldalon ma a mai súlyod és trendje, a mai edzés, és egy gomb a webes appba látszik.
---

## Mit csinál
A Terv oldal címe „Terv”, alcíme „Amihez Boop a napjaidat igazítja”, saját festett éggel. Három dolgot mutat:

1. **SÚLYOD** — a legutóbbi mért súly → a trend (például „82,4 → 82,1 kg”, „mért érték → trend”).
2. **MAI EDZÉS** — a mai edzés címe, időpontja és hossza.
3. Egy Boop-kártya: „Az edzés- és étrendtervedet **a webes appban** állítsd be, ide hamarosan átköltözik.” — **Megnyitom** gombbal.

Ha még nincs reggeli összefoglaló, csak a harmadik kártya látszik.

## Hogyan működik
Az oldal a reggeli összefoglalóból olvas, amit a háttérrendszer állít össze: a súly a mérlegelésekből és a trend-számításból
(lásd [Testsúly és trend](03-testsuly-trend.md)), az edzés a futó mezociklusból. Írni semmit nem lehet innen.

## Miért így
A B2 (Gerinc) a négy helyet és azok őszinte keretét adta. A Terv a B6-ig csak olvasható, mert a tervek szerkesztése nagy munka,
és az étel (B4) és az edzés (B5) szobák után jön.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `boop_brief` | A napi összefoglaló, benne a súly és a mai edzés |

## Mi jön még
- Testösszetétel szakasz: a Test kártya (lásd [Test kártya](04-test-kartya.md)).
- B6: a Terv szerkesztővé válik.

## Mi marad ki
Nincs.
