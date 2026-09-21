# 0049 — Közös Boop-témák és social AI-felület

- **Status:** Proposed
- **Date:** 2026-09-21
- **Driver:** mezo-7fduk

## Context

A Mezo AI-funkciói külön menükben mutatják a mintákat, jóslatokat, vizsgálatokat,
emlékeket és a csapatbeszélgetéseket. Egyes döntések/ténylisták több felületen élnek,
az állapotok sem mindig egyeznek. A felhasználó az egész AI-világot a Boop-csapat
közös social feedjére szeretné építeni, a jelenlegi agyagdesign megtartásával.

## Decision

Jóváhagyásra javasolt: közös tématörténetek a meglévő típusos eredmények fölött;
Üzenőfal, Folyamatban, Rólad, Emlékek navigáció; egy közös Gépterem. A felhasználó
hozzászólása forrásként követhető, az új tudás jóváhagyása egyetlen döntési helyen
él. A meglévő szakmotorok és a napi konzílium bővülnek, nem kapnak párhuzamos másolatot.

Ez még tervezési javaslat. Termékkód és adatok nem változnak a vizuális jóváhagyásig.
Részletek és ellenőrzött leltár: [audit és prototípus](../superpowers/specs/2026-09-21-boop-social-ai-audit.md).

## Consequences

Kevesebb önálló menü, közös állapot és visszakereshető döntések. Új témakapcsolatok,
API-olvasási modell, mélylink-migráció és a visszavont tudás függőségeinek kezelése kell.
A narratív memória, a keresési tömörítés és a kanonikus tény külön marad. A játékosság
nem fedheti el a bizonytalanságot és nem jutalmazhatja az AI-val való egyetértést.

## Alternatives considered

Csak egy feed a régi oldalak fölé: kisebb átállás, de a struktúra problémái megmaradnak.
Kizárólag feed: követhető napi újdonságok, gyenge tartós visszakereshetőség.
