# 0049 — Közös Boop-témák és social AI-felület

- **Status:** Accepted (UI); backend topic model pending
- **Date:** 2026-09-21
- **Driver:** mezo-7fduk / mezo-dcuyw

## Context

A Mezo AI-funkciói külön menükben mutatják a mintákat, jóslatokat, vizsgálatokat,
emlékeket és a csapatbeszélgetéseket. Egyes döntések/ténylisták több felületen élnek,
az állapotok sem mindig egyeznek. A felhasználó az egész AI-világot a Boop-csapat
közös social feedjére szeretné építeni, a jelenlegi agyagdesign megtartásával.

## Decision

A jóváhagyott V3 navigáció: **Üzenőfal, Menü, Rólad, Emlékek**. A Menü az eredeti Minták, Előrejelzések, Diagnózis, Kísérletek és Heti neveket mutatja; a tartalmi részletek önálló oldalak, saját visszaúttal. A valódi Mozaik/Clay elemek és az alsó dokk maradnak. A konzílium meglévő kommentjei, reakciói és bizonyítékai adják a social belépőt. A tudásdöntés és ténylista egyetlen kanonikus felületen él.

A UI implementáció a meglévő rekordokat és műveleteket kapcsolja össze. A közös, minden AI-motort összefogó tématörténet és annak válaszfeldolgozása külön backend kiterjesztés: a UI nem állítja, hogy ez már létezik. Nincs új API, kitalált szakértői poszt, mérőszám vagy egyetértést jutalmazó pontozás.

Jóváhagyás: 2026-09-22. [V3 terv](../superpowers/specs/2026-09-21-boop-social-ai-v3-navigation.md), [implementáció](../superpowers/plans/2026-09-22-boop-v3-implementation.md), [eredeti audit](../superpowers/specs/2026-09-21-boop-social-ai-audit.md).

## Consequences

Kevesebb önálló menü, közös állapot és visszakereshető döntések. Új témakapcsolatok,
API-olvasási modell, mélylink-migráció és a visszavont tudás függőségeinek kezelése kell.
A narratív memória, a keresési tömörítés és a kanonikus tény külön marad. A játékosság
nem fedheti el a bizonytalanságot és nem jutalmazhatja az AI-val való egyetértést.

## Alternatives considered

Csak egy feed a régi oldalak fölé: kisebb átállás, de a struktúra problémái megmaradnak.
Kizárólag feed: követhető napi újdonságok, gyenge tartós visszakereshetőség.
