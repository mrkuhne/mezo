---
cim: Éjszakák az Apple Egészségből
szint: Funkció
terulet: Alvás
allapot: Élesben
hol: [iPhone app, Apple Health, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S2, B1]
osszefoglalo: A telefon az Apple Egészség alvásmintáiból összerakja az éjszakáidat, kiválasztja a legmegbízhatóbb forrást, és elküldi őket.
---

## Mit csinál
Minden éjszakádat magától behúzza: mikor feküdtél le, mikor ébredtél, mennyit aludtál, mennyi volt a mély-,
a REM- és a könnyű alvás, és mikor voltál ébren. Az első összekötéskor az elmúlt 60 nap éjszakáit hozza be,
utána csak az újakat.

## Hogyan működik
1. A telefon kiolvassa az Apple Egészségből az alvásmintákat (szakaszok: mély, REM, könnyű, ébren, ágyban).
2. Forrásonként „alvásblokkokra” bontja őket: ahol több mint 90 perc szünet van, ott új blokk kezdődik.
3. A délután (14–18 óra között) végződő blokkot szundításnak veszi, és kihagyja.
4. Ha egy reggelhez több app is írt éjszakát, a **forrás-sorrend** dönt: Apple Watch → okosgyűrű appok (Oura, Ultrahuman, RingConn) → Sleep Cycle → bármely más app; döntetlennél az nyer, amelyikben több szakaszolt perc van.
5. Az éjszakából 5 perces szeletekben egy rövid „hipnogram” készül (például: mély, REM, könnyű, ébren betűkkel), és a telefon kiszámolja az alvás közbeni átlagpulzust is, ha van rá adat.
6. A telefon elküldi az éjszakát a háttérrendszernek a nyertes app nevével együtt. Ugyanaz az éjszaka újraküldve nem duplikálódik.
7. Csak a legfrissebb, ma vagy tegnap reggel végződő **új** éjszaka jelez a Boopnak („megjött az éjszakád”) — egy 60 napos visszatöltés nem áraszt el üzenetekkel.

## Miért így
- Az Apple Watch szenzorral méri az alvást, a Sleep Cycle a telefon mikrofonjával — ezért az óra az elsőbb. A tulajdonosnak most nincs órája, így nála a Sleep Cycle a forrás.
- A szundítást kiszűrjük, hogy egy délutáni alvás ne írja felül az éjszakát.
- A forrás nevét eltesszük, hogy később látszódjon, honnan jött az adat (B1 döntés).

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.wearable.max-sleep-nights` | Legfeljebb ennyi éjszaka mehet egy küldésben | 100 |
| `mezo.wearable.zone` | Melyik időzóna szerint számít egy nap | Europe/Budapest |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `sleep_log` | Az éjszaka: dátum, lefekvés, ébredés, alvásidő, szakaszpercek, hipnogram, `source` (honnan: kézi / képernyőkép / Apple Egészség), `source_app` (melyik app írta), `sleeping_hr` (alvás közbeni pulzus) |

## Mi jön még
- Amikor óra vagy okosgyűrű kerül a képbe, a forrás-sorrend miatt automatikusan az ő éjszakája lesz az érvényes — nem kell hozzá fejlesztés.

## Mi marad ki
- A Sleep Cycle saját minőségpontszáma nem jön át az Apple Egészségen.
- A szundításokat nem tároljuk.
