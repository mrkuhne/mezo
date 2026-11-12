---
cim: Reggeli ítélet és az öt gömb
szint: Funkció
terulet: Ma
allapot: Élesben
hol: [iPhone app, Háttérrendszer, AI, Apple Health]
szulo: 00-attekintes
szakasz: [S3, B2]
osszefoglalo: Reggel Boop egy mondatban megmondja, milyen napod lesz, és öt gömbben mutatja, miből gondolja.
---

## Mit csinál
A Ma tetején egy nagy, felkelő gömb és alatta öt kis gömb:

| Gömb | Mit mutat (például) |
|---|---|
| **Forma** | Összkép 0–100 (például 74) az alvásból, a pulzusból és a tegnapi terhelésből |
| **Alvás** | Az éjszaka hossza és minősége (például „7ó 12p”) |
| **Mozgás** | A mai lépések a napi célhoz képest (például „3 240”) |
| **Fuel** | Mennyit ettél az eddig „esedékeshez” képest |
| **Pulzus** | A mai nyugalmi pulzus a szokásoshoz képest |

A kiválasztott gömb neve, egy cím és egy-két mondat Boop hangján. Kis gömbre koppintva az egész oldal átszíneződik,
és a gömb alatti fehér gomb az adott gömb teendőjére vált (Forma: check-in, Alvás: lefekvési emlékeztető, Mozgás:
mai edzés, Fuel: fotó, Pulzus: egyperces légzés rezgéssel). Ahol még nincs adat, „–” és „még tanulom” áll, sosem 0.

## Hogyan működik
1. A telefon elküldi a helyi dátumát; a szerver összegyűjti az éjszakát, a pulzust, a lépéseket, az étkezéseket,
   a naptárat és a tervet.
2. Szabályok számolják a pontokat (nem az AI). A Forma csak **14 rögzített éjszaka** után jelenik meg.
3. Egy olcsó AI-modell magyar mondatokat ír a számokhoz — 8 másodpercet vár rá; ha addig nem válaszol, a
   szabály-alapú szöveg megy ki, és a késve érkező AI-mondatok a következő megnyitáskor jelennek meg.
4. Az összefoglaló naponta el van tárolva; csak akkor készül újra, ha a bemenet változott (új éjszaka, étkezés,
   naptár, döntés), vagy a napszak fordul (reggel → délután → este).
5. A telefon frissít: app-előjövetelkor, napváltáskor és minden Egészség-szinkron után.

## Miért így
Az AI soha nem pontoz és nem dönt — csak elmondja a kiszámolt számokat. Így a szöveg sosem hibázik a számban, és
ha az AI nem elérhető, a Boop akkor is működik. A naptár eseménycímei nem mennek az AI-hoz, csak időpontok.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.boop.steps-goal` | Hány lépés ad teljes Mozgás-pontot | 9000 |
| `mezo.boop.nights-needed` | Hány éjszaka kell, mielőtt a Forma megjelenik | 14 |
| `mezo.boop.llm-timeout` | Meddig vár az AI mondataira | 8 mp |
| `mezo.boop.regen-per-day` | Naponta hányszor kérhető kézzel új összefoglaló | 3 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `boop_brief` | Napi egy összefoglaló: a számok, a mondatok, egy „ujjlenyomat” a bemenetről, és hogy AI írta-e |

## Mi jön még
Napi kapacitás (mennyi „terhelés” fér a napba) a reggeli ítéletben — B7.

## Mi marad ki
Pontozás AI-val — szándékosan nem.
