---
cim: Ma — a kezdőlap
szint: Fő szekció
terulet: Ma
allapot: Élesben
hol: [iPhone app, Háttérrendszer, AI]
szulo:
szakasz: [S3, B2, B3, Kezdőlap]
osszefoglalo: Amit Boop épp mondani akar — legfeljebb három dolog —, alatta a reggeli terv és a napod egy-egy sorrá csukva, az energiagörbe és az esti zárás.
---

## Mit csinál
A Ma oldal a **[kezdőlap](../01-alapok/kezdolap)** körének közepéről nyílik. Felül a **felkelő gömb** Boop
ítéletével — szám nélkül, mert a számok a kör gömbjeiben vannak. Alatta az **[élő fal](elo-fal)**: legfeljebb
három dolog, amit Boop épp mondani akar, és fölötte a check-in kérdése, amíg esedékes.

- **A reggeli terv** — egy sorrá csukva (reggel nyitva), benne a nap terve és „Boop mondja”.
- **A napod** — az egész nap egy csendes idővonalon, szintén egy sorrá csukva.
- **A nap energiája** — a görbe, ami előre néz.
- **Este** — a nap lezárása.

Egy területre a kör gömbjéről jutsz, nem innen.

## Hogyan működik
A telefon a saját helyi dátumával lekéri a szervertől a napi összefoglalót. A szerver kiszámolja az öt pontszámot
és az energiagörbét, egy olcsó AI-modell magyar mondatokat ír hozzá, és naponta egyszer eltárolja. A szakasz az
órához igazodik: Reggel 04–10, Napközben 10–18, Este 18–04.

## Miért így
Döntések napló, 1. pont: egy kezdőlap + napi ritmus. A reggeli összefoglaló (S3) nőtt bele a Reggel részbe.

## Beállítások
Lásd az egyes funkciók oldalain.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `boop_brief` | Napi egy reggeli összefoglaló felhasználónként |

## Mi jön még
- Az energiagörbe a check-in pöttyökkel a Napközben részben — B3 (ellenőrzés alatt).
- Új javaslatfajták (étel ±, edzés rövidebb/hosszabb) — B7.

## Mi marad ki
Külön „A napom” fül — a Napközben idővonal vette át a helyét.
