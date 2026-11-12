---
cim: Fizetős Apple-fiók
szint: Kis funkció
terulet: Alapok
allapot: Tervezve
hol: [iPhone app, Apple Health, Apple Watch]
szulo: 00-attekintes
szakasz: [B1]
osszefoglalo: Az évi 99 dolláros Apple fejlesztői tagsággal megszűnik a heti újratelepítés, és bekapcsolhatók azok a funkciók, amiket az ingyenes fiók nem enged.
---

## Mit csinál
Az ingyenes és a fizetős fiók különbsége a felhasználó szemével:

| | Ingyenes (most) | Fizetős (kb. 2026-11-25-től) |
|---|---|---|
| Lejárat | 7 nap, utána újratelepítés | nincs heti lejárat |
| Szerverről küldött értesítés | nem | igen |
| Háttérfrissítés az Egészségből | a kód kész, de telefonon nem ellenőrzött | ellenőrizhető |
| Widget, válasz az értesítésből | nem | igen |
| Apple Watch app | nem | igen (B5) |

## Hogyan működik
Előfizetés után az app azonosítóját egyszer újra kell regisztrálni a fizetős csapat alatt, majd a telefonon
ellenőrizni: háttérfrissítés, szerverértesítés, törölt Egészség-adatok átvezetése.

## Miért így
A tulajdonos 2026-11-11-én a fizetős tagság mellett döntött (Döntések napló, 3. pont), mert enélkül nincs
értesítés, háttérfrissítés és Watch app.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `~/.config/boop/paid` | A telepítő a fizetős jogosultságokkal fordít | nincs |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `apns_device` | A telefon értesítési címe (már regisztrálódik, de a szerver még nem küld) |

## Mi jön még
A widget és a válasz-az-értesítésből (B3 kiegészítés), Watch app (B5), szerverről küldött javaslat-értesítések (B7).

## Mi marad ki
Nincs.
