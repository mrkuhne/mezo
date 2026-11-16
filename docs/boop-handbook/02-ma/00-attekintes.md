---
cim: Ma — a kezdőlap
szint: Fő szekció
terulet: Ma
allapot: Élesben
hol: [iPhone app, Háttérrendszer, AI]
szulo:
szakasz: [S3, B2, B3, Kezdőlap]
osszefoglalo: A mai napod egy görgetésben: a nap görbéje a pillanataival, amit Boop épp mondani akar, a reggeli terv és a napod egy-egy sorrá csukva, az észrevételek és az esti zárás.
---

## Mit csinál
A nap oldala a **[kezdőlap](../01-alapok/kezdolap)** körének **közepéről** és a kör tetején ülő **Nap gömbről**
is ide nyílik — ugyanaz a hely, két ajtóval. Fent csak a dátum és a **boop** felirat áll; a nagy felkelő gömb és
a Reggel/Napközben/Este fülek lekerültek róla (tulajdonosi döntés, 2026-11-16), mert a gömbök a köré tartoznak,
a nap pedig egyben olvasható. A felirat alatti gombsor szintén lekerült, és
a **felolvasás** is kikerült az appból: a reggeli összefoglalót olvasni lehet, hallgatni nem. A
lefekvés-emlékeztetőt az Alvás területén kapcsolod.

Egy görgetésben, ebben a sorrendben:

- **Mai nap** — a nap görbéje, rajta a nap saját pillanatai kis jelekkel (ébredés, étkezések, a legsűrűbb
  naptárblokk, az edzés, a lefekvés). Egy jelre koppintva megmondja, mi volt az.
- **Most** — az **[élő fal](elo-fal)**: legfeljebb három dolog, amit Boop épp mondani akar, fölötte a check-in
  kérdése, amíg esedékes.
- **A reggeli terv** és **A napod** — egy-egy sorrá csukva (reggel nyitva); mögöttük a nap terve, „Boop mondja”
  és az egész nap idővonala.
- **Amit ma észrevettem** — a mai összefüggések, mindegyiknél az „igaz / nem rólam szól” válasszal, alattuk egy
  sor Boophoz.
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
- A nap pillanatai közül egyelőre csak a naptár legsűrűbb blokkja kerül fel; a levelek és a kiadások akkor,
  amikor azok a területek megépülnek.
- Új javaslatfajták (étel ±, edzés rövidebb/hosszabb) — B7.

## Mi marad ki
Külön „A napom” fül — a Napközben idővonal vette át a helyét.
