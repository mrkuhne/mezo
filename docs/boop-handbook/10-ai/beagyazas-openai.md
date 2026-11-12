---
cim: Beágyazás OpenAI-on
szint: Kis funkció
terulet: AI és memória
allapot: Élesben
hol: [Háttérrendszer, AI]
szulo: emlekezet
szakasz: [B0]
osszefoglalo: Az emlékek „jelentés-lenyomatát” 2026-11-11 óta az OpenAI készíti, mert a Google-keret kifogyott.
---

## Mit csinál
Minden emlékről készül egy számsor (beágyazás), ami a szöveg jelentését írja le. Ettől lehet „hasonló napokat” vagy egy
témához kapcsolódó régi bejegyzést találni akkor is, ha más szavak szerepelnek benne.

## Hogyan működik
- B0 óta az **OpenAI kis beágyazó modellje** készíti a lenyomatokat, ugyanakkora méretben, mint korábban a Google.
- Az élesítéskor egy háttérfeladat minden aktív emléket újra feldolgozott (az első körben 150 darab, kb. 0,04 cent
  költséggel), azóta óránként pótolja, ami hiányzik.
- Ha a szolgáltató hibát ad, a hibakód és az üzenet naplózódik (korábban üresen maradt, ezért nem derült ki, mi a baj).
- Visszaállás: a régi Google-út megmaradt, egy beállítás törlésével visszakapcsolható.

## Miért így
A Google előre fizetett kerete 2026-10-21-én kifogyott, és három hétig egyetlen új emlék sem került be. A tulajdonos
2026-11-11-én az OpenAI-ra költözést választotta (a Google feltöltése helyett).

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.companion.embedding.provider` | Ki készíti a lenyomatot: Google vagy OpenAI | Google (élesben: OpenAI) |
| `mezo.companion.memory-platform.serving-embedding-version` | Melyik lenyomat-generációból keres | Google-generáció (élesben: OpenAI-generáció) |
| `mezo.companion.memory-platform.reembedding.enabled` | Újrafeldolgozó háttérfeladat be/ki | ki (élesben: be, óránként) |
| `mezo.companion.memory-platform.execution.query-embedding-timeout-ms` | Egy keresés lenyomatának időkerete | 2 500 ms |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `memory_vector` | Lenyomatok generációnként; a régi Google-sorok is megmaradtak |

## Mi jön még
Nincs.

## Mi marad ki
Saját gépen futó beágyazó modell — nem tervezett.
