---
cim: Ma — a kezdőlap
szint: Fő szekció
terulet: Ma
allapot: Élesben
hol: [iPhone app, Háttérrendszer, AI]
szulo:
szakasz: [S3, B2, B3]
osszefoglalo: A nap egyetlen görgethető oldalon — reggel Boop ítélete és a nap terve, napközben az idővonal a javaslatokkal, este a zárás.
---

## Mit csinál
A Ma a Boop szíve. Felül a **felkelő gömb** Boop ítéletével és öt kis gömbbel (Forma, Alvás, Mozgás, Fuel,
Pulzus). Alatta egy **szakaszsáv**: Reggel · Napközben · Este — koppintásra az adott részhez görget.

- **Reggel** — a nap terve, amit elfogadhatsz („Elfogadom a napot”), és „Boop mondja” kártya.
- **Napközben** — az egész nap egy csendes idővonalon, a „MOST” pontnál Boop javaslataival.
- **Este** — a nap lezárása (B3-ban kész, ellenőrzés alatt).

Egy gömbre koppintva megnyílik annak **szobája** (például az Alvás szoba), ugyanazzal a felépítéssel.

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
