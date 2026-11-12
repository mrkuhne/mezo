---
cim: Ami kimarad az Étel szobából
szint: Kis funkció
terulet: Étel
allapot: Kihagyva
hol: [Háttérrendszer]
szulo: 00-attekintes
szakasz: [B4]
osszefoglalo: Négy webes étel-funkció szándékosan nem kerül át a Boopba; a háttérben megmaradnak, csak nem látszanak.
---

## Mit csinál
Ezek **nem** lesznek a Boopban (spec §3.1 „Nem kerül át”):

| Mi | Miért marad ki |
|---|---|
| **Gyógyszer-ciklus** (adagok, fázisok követése) | A tulajdonos nem használja; csak az AI étkezés-értékelőnek adna hátteret. |
| **Kamra árak, készlet, lejárat** és az „olcsóbb alternatíva” javaslatok | Nem az étkezés lényege, a webes appban is alig használt. |
| **Étkezési idősáv-sablon szerkesztő** (pihenő- és edzésnapi sablonok) | Nincs használatban; a napi terv a B4-ben szerveroldalon, sablon nélkül készül. |
| **„Hogy tanultam?” oldal** (a megtanult energiaigény részletes története) | Az oldal kimarad, de **a motor megmarad** és dolgozik; a Boop legfeljebb egy heti mondatban mutatja (lásd a Terv rész „Megtanult energiaigény” oldalát). |

## Hogyan működik
A táblák és a háttérszolgáltatások **megmaradnak** — a webes app továbbra is használhatja őket. A Boop egyszerűen nem hívja
ezeket, és nem mutat hozzájuk felületet.

## Miért így
Boop tiszta, célzott app, nem a webes app másolata (spec §1, §6). A zsúfoltság elrejtése, nem törlése a biztonságos út: a
háttérrendszerből kitépni ezeket külön, kockázatos munka lenne.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `medication`, `medication_dose` | Gyógyszerek és adagok (Boop nem használja) |
| `meal_slot_template` | Étkezési idősáv-sablonok napfajtánként (Boop nem használja) |
| `expenditure_estimate`, `intake_day_mark` | A megtanult energiaigény heti sorai és a tanulásból kizárt napok (a motor használja, a Boop nem mutatja részletesen) |

## Mi jön még
Nincs.

## Mi marad ki
Lásd fent.
