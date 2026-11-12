---
cim: Fiók és belépés
szint: Funkció
terulet: Alapok
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S1, B1]
osszefoglalo: A Boopba ugyanazzal az e-mail-címmel és jelszóval lépsz be, mint a webes appba, így minden korábbi adatod ott van.
---

## Mit csinál
Az első indításkor a Boop egy belépő képernyőt mutat: e-mail és jelszó. Aki még nem regisztrált, a „Van
meghívókódom” gombbal regisztrálhat (meghívókód, név, e-mail, jelszó 8–72 karakter). A hibák magyarul, a hibás
mező alatt jelennek meg (rossz jelszó, foglalt e-mail, már felhasznált meghívó, nincs net 20 másodperc után).

Belépés után a Boop **ugyanazt a fiókot** használja, mint a webes app: az edzésterved, az étrended, a súlyod, a
korábbi check-injeid mind itt vannak.

## Hogyan működik
1. A telefon elküldi az e-mailt és a jelszót a háttérrendszernek, ami egy belépőjegyet ad vissza.
2. A belépőjegyet a telefon biztonságos tárolója (kulcskarika) őrzi; 30 napig érvényes.
3. Ha lejár vagy a szerver elutasítja, a Boop kilépteti a felhasználót, és újra a belépő képernyő jön.
4. Az app induláskor eldönti, hol tartasz: betölt · nincs belépve · nincs net · hiányzik a bemutatkozás · kész.

## Miért így
Eredetileg a Boop külön, új fiókot kapott. A 2026-11-11-i döntés (Döntések napló, 2. pont): **egy fiók, egy
történet**. A Boop-fiók kevés adatát (éjszakák, napi mozgás, edzések, naptár, egy reggeli összefoglaló, egy mérés)
2026-11-11-én — a tulajdonos külön engedélyével — átköltöztettük az eredeti fiókba, és azóta a telefon azzal lép be.
A régi Boop-fiók megmaradt, de nem használjuk.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.auth.strict` | Éles szerveren nem indul el a rendszer gyári (fejlesztői) jelszóval vagy titokkal | élesen be |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `app_user` | A felhasználói fiókok (név, e-mail, jelszó lenyomata) |
| `invite` | A meghívókódok, és hogy felhasználták-e már |

## Mi jön még
Nincs külön tervezett bővítés.

## Mi marad ki
- Nincs automatikus megújítás: 30 nap után újra be kell lépni.
- Nincs „Belépés Apple-lel” — szándékosan egyszerű marad.
