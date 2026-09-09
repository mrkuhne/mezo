# 0040 — Fuel öt bejárattal, külön vizuális prototípusban

- **Status:** Accepted for prototype; production adoption undecided
- **Date:** 2026-09-09
- **Driver:** `mezo-88jw.12`

## Context

Daniel a Boop új navigációját és vizuális hierarchiáját szeretné a korábbi Fuel
színes Clay készletével, részletes számaival, makróival és AI score-jával ötvözni.
A négy javasolt helyi fülből hiányzott a napi szinten használt Stack és a beállítások;
közben a Ma és Napló részben ugyanazt a napi összegzést ismételte.

## Decision

Önálló, kattintható Fuel tanulmány készül: **Napló · Receptek · Kamra · Stack ·
Beállítások**, mellettük állandó színes mezo területváltó. A Ma a Naplóba olvad,
amely a napi áttekintésből a korábbi napok és a heti grafikon felé is nyílik.
A heti tervezés és étkezési ablakok a Beállításokból érhetők el; a Naplónak is van
közvetlen tervbejárata. A gyógyszernapló a Stackből és a Beállításokból is elérhető.

A Beállításokban a keret és a makrók nem kézzel megadott számok: az aktív súlycél,
a céldátum és a napi fenntartó alap számítja őket. A tervezett edzés látható, de
csak a rögzítés után kerül hozzá a napi kerethez.

A látványt és a mélyebb aloldalakat közvetlenül a prototípusban iteráljuk.
A production oldalak, API-k és számítási szabályok változatlanok. A prototípus
explicit demonstrációként kezeli a score-t és az AI-válaszokat.

## Consequences

A hat alsó érintési cél keskeny telefonon is megmarad, a helyi menü mindig azonos
sorrendű. A részletes információ nem tűnik el: saját étkezés-, score-, recept-,
kamra-, protokoll- és beállításoldalakon bontható ki. A két eredeti napi dashboard
egyesítése csökkenti az ismétlést. A prototípus és a production eltéréseit a
[tanulmány leírása](../design_3.0/fuel-prototype/README.md) rögzíti.

## Alternatives considered

- Ma + Napló + Receptek + Kamra: nem ad közvetlen helyet a Stacknek és beállításoknak.
- Külön Ma és további fülek: túl sok elemet zsúfolna a helyi menübe, megtartva az ismétlést.
- Production átalakítás azonnal: Daniel előbb közvetlen vizuális iterációt kér külön prototípusban.
