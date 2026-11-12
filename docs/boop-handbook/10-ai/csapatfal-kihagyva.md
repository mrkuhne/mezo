---
cim: Csapatfal és szakértői oldalak
szint: Kis funkció
terulet: AI és memória
allapot: Kihagyva
hol: [Háttérrendszer]
szulo: 00-attekintes
szakasz: []
osszefoglalo: A webes app öt szereplős csapatfala, esti kiadása, csapat-chatje és szakértői oldalai Boopban szándékosan nem jelennek meg.
---

## Mit csinál
A webes appban van egy „csapat-üzenőfal” névvel ellátott szereplőkkel, esti kiadás, egész napos csapat-chat „ügyekkel”,
szakértői oldalak, egy 47 érzékelős átláthatósági felület, fejezetek és érettségi görbe. **Boopban ezek egyike sem
jelenik meg.**

## Hogyan működik
A háttérrendszerben a táblák és a működés megmaradnak (a webes app még fut), csak a Boop nem hívja őket. Ahol
újrahasznosítható (az érzékelők jelei, az állítások tára), azt a B8 használhatja a háttérben.

## Miért így
Döntések naplója #5 (2026-11-11): egy hang, Boop. A kutatás szerint ezek a felületek zajosak voltak, a csapatfal
ráadásul úgy termelt tovább, hogy a mögötte lévő dosszié hetek óta nem frissült.

## Beállítások
Nincs Boop-oldali beállítás.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `character_reply` | A csapatfal válaszai (csak webes) |
| `character_portrait_revision` | Szereplő-portrék változatai (csak webes) |
| `character_maturity_week` | Heti érettségi pillanatkép (csak webes) |

## Mi jön még
Nincs — nem tervezett.

## Mi marad ki
Az egész felület, szándékosan.
