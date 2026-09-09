# 0041 — Külön Boop Edzés mobilprototípus

- **Status:** Accepted (prototype only)
- **Date:** 2026-09-09
- **Driver:** mezo-6wbr

## Context

Az Edzés jelenlegi appja részletes szettnaplót, mezociklusokat, heti ritmust,
futást, sportot és eredményeket kezel. Az új Boop irányban ezek nyugodtabb
hierarchiáját kell közvetlenül kipróbálni, a külön Fuel tanulmány mellett.
Daniel kifejezetten működő helyi prototípust kért, Superpowers specifikációs és
tervezési folyamat, valamint production frontend-átépítés nélkül.

## Decision

Önálló, natív HTML/CSS/ES-modulos tanulmány a
[`docs/design_3.0/train-prototype/`](../design_3.0/train-prototype/README.md)
könyvtárban. Saját szerver: `127.0.0.1:5197`, saját `localStorage` kulcs,
helyi betűk és Clay sprite-ok. A `phone.html` külön telefonházban, valódi
384 px-es iframe viewportban futtatja az `index.html` alkalmazást.

Az állandó alsó sor: színes, kétszemű területváltó + **Edzés · Heti · Tervek ·
Napló · Tár**. Az Edzés a mai cselekvést emeli ki; a heti ritmus, terv,
teljesítési előzmény és gyakorlatgyűjtemény külön belépőt kap. Futás és sport
az Edzésből és a közös naplóból nyílik. A fejléc bal oldalán kizárólag `boop.`,
jobb oldalán felirat nélküli, pislogó és röviden irányba pillantó zöld avatar.

A Fuel szerkezeti és vizuális mintája helyi másolatként szolgál; a Fuel fájljai
változatlanok. A meleg papír, Fraunces/Geist, zsálya, korall, arany, levendula
és kék közös vizuális nyelv. A tartalmi hűség forrása a
[Train feature doc](../features/train.md) és a
[Boop navigációs PR #610](https://github.com/mrkuhne/mezo/pull/610).

## Consequences

Gyorsan iterálható, build és backend nélkül fut. A fontos módosítások menthetők:
szett, jegyzet, futás/sport, heti időpont, tervnév, sablon, saját edzés.
A bemelegítés külön marad, a lezárás explicit, a terv nem teljesítés.

A teljesítési összegzés a rögzített munkaszettekből számol; a heti számlálók
naptári héthez kötöttek. A gyakorlatok elsődleges izomcsoportos bontása egyszerűsített
olvasási példa, nem a production effektívszett-/MEV-/MAV-/MRV-motor másolata.
A ciklusív illusztráció, a chat előre megírt minta, a medáladatlapok szemléltetők.
Nincs AI-hívás, sport→súlyzós keresztterhelési modell vagy Fuel-adatszinkron.
A részletes határokat és az ellenőrzést a prototípus README-je tartalmazza.

Ez elfogadott **tanulmányi döntés**, nem a production navigáció átállításának
jóváhagyása. A production Train dokumentációjában külön jelzett hivatkozás szerepel.

## Alternatives considered

- Production oldalak közvetlen átírása: a vizuális iterációhoz túl nagy csatolás,
  és ellentétes a kifejezett kéréssel.
- A korábbi Boop React-tanulmány továbbépítése: több meglévő felületet és közös
  állapotot érintene; a Fuelhez hasonló önálló próba egyszerűbb.
- Statikus képek: a szettnapló és a navigáció kipróbálására nem elegendők.
