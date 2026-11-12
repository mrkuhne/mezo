---
cim: Az alvás-szoba
szint: Funkció
terulet: Alvás
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S3, B2]
osszefoglalo: Az Alvás gömbre koppintva megnyílik egy teljes oldal az éjszakádról, a heti mélyalvásról és arról, mit tehetsz ma este.
---

## Mit csinál
A Ma oldalon az Alvás gömbre (vagy az idővonal egy alvás-állomására) koppintva megnyílik az alvás-szoba.
Ugyanazt a négy részes vázat követi, mint a többi szoba:

1. **A szint** — a fő szám (például „7ó 12p”), egy mondat Boop hangján, a hipnogram, és csempék: alvásidő (lefekvés–ébredés), mélyalvás, elalvás időpontja. Innen nyílik az *Az éjszakád* részletes lap is.
2. **A hét** — a mélyalvás percei az elmúlt 7 napon, oszlopokban, átlagvonallal.
3. **A napok mögötte** — a hét napjai egyenként, a mai felül.
4. **Mit tehetsz** — Boop javaslata és a teendők (például a lefekvés-kártya az emlékeztető kapcsolójával és Boop esti tippjével).

A Ma oldal reggeli részében az alvás a „Boop mondja” kártya kiemelt szavaival is megnyitható.

## Hogyan működik
1. A telefon lekéri a háttérrendszertől a napi reggeli összefoglalót; ebben benne van a tegnap éjszaka, a heti mélyalvás-sor és a lefekvési cél.
2. A szoba ebből rajzol; amihez nincs adat, az a csempe egyszerűen nem jelenik meg (nem írunk ki 0-t).
3. Ha egy éjszaka időpontok nélkül van rögzítve, az alvásidő csempe megmarad, az időpontok helyén „–” áll.
4. Balról jobbra húzással visszalépsz a Ma oldalra.

## Miért így
- Minden szoba ugyanarra a vázra épül (ítélet → szint → a napok mögötte → teendők), hogy a Boop egy appnak érződjön, ne négy-ötnek (B2, tulajdonosi döntés 2026-11-11).
- Hiányzó adatra nem rajzolunk hamis nullát, mert az félrevezető.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `boop_brief` | A napi reggeli összefoglaló (benne az éjszaka és a heti sor), naponta egy |
| `sleep_log` | Az éjszakák, amelyekből az összefoglaló készül |

## Mi jön még
- B7–B8: alvásadósság és hosszabb távú alvás-következtetések megjelenhetnek a szobában.

## Mi marad ki
- Éjszakánkénti pulzusgörbe és HRV a szobában nincs.
- A webes alvásoldal rendszeresség- és hatékonyság-mutatói nincsenek átvéve.
