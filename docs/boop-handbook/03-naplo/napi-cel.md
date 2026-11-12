---
cim: A nap célja
szint: Funkció
terulet: Napló
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer, Naptár]
szulo: 00-attekintes
szakasz: [B3]
osszefoglalo: Reggel egyetlen személyes célt tűzöl ki — begépelve, kimondva vagy egy javaslatra koppintva —, este egy koppintással értékeled.
---

## Mit csinál
A reggeli terv kártyáján **„MI MA A LEGFONTOSABB?”**: egy sor mikrofonnal és legfeljebb három javaslat, mindegyik
egy kis indoklással, például:
- „Csapatmegbeszélés 10:00” — *a naptárból*;
- „Felsőtest edzés 17:30” — *a heti terv*;
- „Meal prep” — *8 napja nem volt*.

Egy koppintás beállítja; a beállított cél csillagos sorként látszik „csere” lehetőséggel. Este az esti zárásban:
**Sikerült · Részben · Nem**. A cél + az elfogadás összesen **2 koppintás**.

Mellette **„Boop céljai”** — a terv saját pontjai (például fehérje, edzés, lefekvés), amelyeket Boop este magától
ítél meg az adatokból (például „146 g”, „90 perc · pulzus átl. 128”, „még előtted”).

## Hogyan működik
- A javaslatokat a telefon rakja össze, **AI nélkül**: a nap legtöbb résztvevős / leghosszabb naptáreseménye, a mai
  edzés, és olyan cél, amit legalább két korábbi napon beírtál, de az elmúlt 7 napban nem.
- A naptár eseménycíme **nem hagyja el a telefont** a javaslathoz.
- A cél a meglévő „napi szándék” rendszerbe kerül (a nap első fókusza), saját azonosítóval, így net nélkül is menthető
  és nem duplázódik. A „csere” a régit törli, az újat felveszi.
- Boop reggeli összefoglalója már a mai célt is látja.
- Az edzés „teljesítve” jelzését a B3 adja hozzá: kész, ha volt befejezett edzés vagy sport, vagy az órád legalább 20
  perces edzést mért a tervezett idő körül (±2 óra).

## Miért így
A tulajdonos döntése (B3 spec, D6): **egy** személyes dolog (például egy edzés, egy nagy megbeszélés, a halogatott
meal prep), plusz Boop saját céljai automatikusan. A javaslatok szabályalapúak, hogy ne kelljen AI-hoz küldeni a naptárat.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.intention.focus-cap` | Hány fókusz lehet egy napon (a webes appnak; a Boop csak az elsőt mutatja) | 3 |
| `mezo.intention.focus-max-len` | Egy cél legfeljebb ennyi karakter | 200 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `intention_focus` | A nap céljai; a Boop az elsőt használja, saját azonosítóval (`client_ref`) |
| `daily_intention` | A nap értékelése (sikerült / részben / nem) — az esti zárás ide is beírja |

## Mi jön még
A cél a Terv szabályaival együtt jelenik meg az AI-ban — B6.

## Mi marad ki
Több cél egy napra a Boopban — szándékosan egy.
