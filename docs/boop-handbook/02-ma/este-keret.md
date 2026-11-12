---
cim: Este a Ma oldalon
szint: Funkció
terulet: Ma
allapot: Ellenőrzés
hol: [iPhone app]
szulo: 00-attekintes
szakasz: [S3, B2, B3]
osszefoglalo: Este 18 órától az oldal alkonyi színt kap, és az Este rész a nap lezárására hív — lezárás után a nap összegzését mutatja.
---

## Mit csinál
- **18 órától** a Ma oldal alkonyi égboltot kap; a Forma gomb „Esti check-in”, az Alvás gomb „Esti levezetés”
  lesz, és az esti légzés és étkezés állomásai jönnek a reggeliek helyett. *(Élesben)*
- Az **Este** rész a lezárás kerete. A B2-ben a „Lezárom” gomb még „hamarosan” üzenetet adott. *(Élesben)*
- A B3 óta a gomb megnyitja az **esti zárást** (lásd a Napló szekcióban), és lezárás után itt egy **lezárt-nap
  kártya** áll — koppintásra a nap összegzése. *(Ellenőrzés)*

## Hogyan működik
Az esti szakasz az órához igazodik (18:00–04:00). Ha a nap már le van zárva (akár a webes appban), a kártya
lezártként jelenik meg.

## Miért így
A spec szerint az este egy egyperces zárás, nem egy újabb feladatlista.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `day_close` | Az esti zárás (B3) |

## Mi jön még
Nincs külön tervezve.

## Mi marad ki
- Ismert hiányosság: éjfél és hajnali 4 között az Este rész még a nappali égbolton jelenik meg.
