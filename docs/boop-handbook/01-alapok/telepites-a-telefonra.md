---
cim: Telepítés a telefonra
szint: Funkció
terulet: Alapok
allapot: Élesben
hol: [iPhone app]
szulo: 00-attekintes
szakasz: [S1, B1]
osszefoglalo: A Boop egyetlen paranccsal kerül fel a telefonra a Macről; az ingyenes Apple-fiók miatt most még hetente újra kell telepíteni.
---

## Mit csinál
A Boop nincs az App Store-ban. A Macen egy parancs lefordítja és feltelepíti a csatlakoztatott iPhone-ra. Az
ingyenes Apple-fiókkal aláírt app **7 napig** él, utána a parancsot újra le kell futtatni (az adatok megmaradnak).

## Hogyan működik
1. A telepítő megkeresi a fejlesztői csapat azonosítóját (ezt sosem tesszük a kódba).
2. Lefordítja az appot, aláírja, és feltelepíti a telefonra.
3. Ha valami hiányzik, érthető hibakóddal áll meg: nincs csapat · nincs telefon · nem fordult le · nem települt.

## Miért így
Amíg nincs fizetős Apple-fiók, ez az egyetlen út a saját telefonra. Az ingyenes fiók szabályai: legfeljebb 3
saját app, hetente legfeljebb 10 új azonosító — ezért az app azonosítóját soha nem nevezzük át.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `~/.config/boop/team` | A fejlesztői csapat azonosítója a Macen (nem a kódban) | — |
| `~/.config/boop/paid` | Ha ez a fájl létezik, a telepítő a fizetős fiók jogosultságaival (értesítésekkel) fordít | nincs |
| `Boop.entitlements` | Ingyenes fiók: Egészség-olvasás és háttérfrissítés, értesítés nélkül | — |
| `Boop-Paid.entitlements` | Fizetős fiók: ugyanez + szerverről küldött értesítések | — |

## Adattáblák
Nincs.

## Mi jön még
A fizetős fiók (lásd a külön oldalt): nincs heti lejárat, és jöhet a TestFlight.

## Mi marad ki
App Store-megjelenés — a Boop személyes app marad.
