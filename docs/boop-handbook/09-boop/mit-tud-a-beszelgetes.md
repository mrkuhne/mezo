---
cim: Mit tud a beszélgetés
szint: Funkció
terulet: Boop
allapot: Ellenőrzés
hol: [Háttérrendszer, AI, Apple Health, Naptár]
szulo: 00-attekintes
szakasz: [B3, B8]
osszefoglalo: Boop minden kérdésnél megkapja a mai nap összefoglalóját, a rólad tanult tényeket, és ha kell, maga néz utána a régebbi adatoknak.
---

## Mit csinál
Amikor Boopot kérdezed, három rétegből tudja a választ:
1. **Ami mindig ott van:** a fiókod alapadatai (kor, magasság, utolsó súly), az aktív súlycél és a mai kalória/fehérje
   célja, a „Rólam” szöveged, a saját kommunikációs kéréseid, a tanult beszédstílusod, és **minden megerősített tény**,
   amit rólad tud.
2. **A mai nap blokkja (B3, Boop-csatorna):** tegnap éjjeli alvás (és az előző), nyugalmi pulzus és HRV a 14 napos
   szokásoshoz képest, mai lépések, a mai kitöltések (energia, hangulat, feszültség és az akkori pulzus/HRV), a nap célja,
   mai és holnapi edzés vagy sport (típus, idő, hossz), eddigi evés a célhoz képest, a hátralévő naptárblokkok, a
   lefekvési cél.
3. **Amit maga hoz elő:** ha a kérdéshez kell, Boop lekéri például az edzésnaplót, a súlytrendet, az étkezéseket, a
   receptjeidet, a hosszú távú emlékezetből a hasonló napokat — B3-tól az Apple Health heti adatait és a mai naptárt is.

## Hogyan működik
- A napi blokkot a háttérrendszer állítja össze a meglévő adatokból, határozottan rövidre (célja: kb. 1 200 egység
  szöveg alatt), és minden körben elküldi — nem kell kérni.
- **A naptárból csak az idő és a hossz megy az AI-hoz, a címek soha** (B3-ban). Hogy a címek mehetnek-e, azt a B7 kérdezi
  meg a tulajdonostól.
- A „Boop látja” sáv ugyanebből a blokkból készül, így pontosan azt látod, amit a modell is.
- A válasz szabálya: ha számot mond, nevezze meg, honnan van, egy tagmondatban.

## Miért így
A korábbi kutatás (2026-11-10) szerint a webes chat nem látta az óra és a naptár adatait, és a mai napot sem kapta meg
magától. A B3 ezt pótolja. A naptárcímek magánszféra-ok miatt maradnak ki.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.companion.facts.prompt-cap` | Legfeljebb hány megerősített tény megy be minden kérdéshez (biztonsági plafon) | 200 |
| `mezo.companion.tools.max-window-days` | Egy adatlekérés legfeljebb hány napra nézhet vissza | 30 |
| `mezo.companion.conversation.results-max-chars` | Az előhozott adatok összes szövegének felső korlátja egy kérdésnél | 40 000 karakter |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `knowledge_fact` | A megerősített tények rólad, amik minden kérdéshez bemennek |
| `ai_message` | A válaszhoz használt adatlekérések nyoma (90 nap után a részletek törlődnek) |

## Mi jön még
- **B6:** a Terv szabályai (engedett receptek, edzésblokk) minden AI-szövegbe bekerülnek.
- **B8:** a chat mindent lát, a Tervet is, és az emlékezetben strukturált napi adatok is lesznek.

## Mi marad ki
A naptáresemények címe (B7 döntéséig). A beszélgetés nem változtat semmin — csak olvas és válaszol.
