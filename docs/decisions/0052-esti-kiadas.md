# 0052 — Esti kiadás: a napi konzílium 21:00-kor kiad a falra

- **Status:** Accepted
- **Date:** 2026-09-24
- **Driver:** mezo-a9bo7.12

## Context

ADR 0048 a napi konzíliumot reggeli jelenetként írta le: az előző éjszaka megfigyeléseiből egy
szálas vita, amely a fal legfeljebb három kiemelt posztját adta. A csapat-üzenőfal II. felvonásának
owner-jóváhagyott iránya (`docs/superpowers/specs/2026-09-24-csapatfal-act2-esti-kiadas-design.md`)
ezt a jelenetet estére tolja, és a napi kimenetet a konzílium egyetlen forrásáról a csapat összes
forrására (minta, monitorozott pár, előrejelzés, kísérlet, konzílium-szál) bővíti — egy válogató,
amely mindent lát, nem egy új, párhuzamos csatorna.

## Decision

A konzílium 21:00-kor (Europe/Budapest) fut — nem reggel —, majd közvetlenül utána, külön
`try`-ban (a konzílium csendes vagy hibás kimenetétől függetlenül) lefut a `team_edition` kiadás:
3–6 rangsorolt poszt minden forrásból (minta, monitorozott pár „gyűlik", lezárt előrejelzés, futó
kísérlet mérföldköve, a napi konzílium vita-szálai), karakterenként legfeljebb 2, forrásrekordonként
legfeljebb 1, 7 napos ismétlés-tilalommal, csendes napon feltöltéssel „gyűlik"/„kérés" jelöltekből 3-ig
(fabrikált poszt soha). A konzílium dosszié-döntési szerepe (proposal → cross-talk → verdict →
publish, claim-életciklus) VÁLTOZATLAN marad — a kiadás csak a fal-publikálás új helye, a kimenetét
jelöltként fogyasztja. A névütközés elkerülésére az új táblák és osztályok mindig `team_edition*` /
`TeamEdition*` nevűek, a meglévő `character_council_edition` (a konzílium lease-sora) érintetlen.

## Consequences

A detektorok lezárt napra készülnek, ezért a karakter-észlelések egy nap késéssel (D-1) kerülnek a
kiadásba, míg a companion-rekordok (minták, előrejelzések, kísérletek) frissek — ez tudatos
döntés, nem hiba. Két új tábla (`team_edition`, `team_edition_post`) és a `character_run.kind`
CHECK bővítése (`+EDITION`) született; a Gépterem Futások listája és a `GET /api/character/edition`
végpont H1-től látja a kiadást, de a fal csak H2-ben olvassa (`mezo.feature.team-edition.enabled`
addig csak a backend futást kapcsolja). H1-ben minden poszt szövege a rekord nyers szövege
(`voiced=false`) — a karakter hangja H3-ban érkezik.

## Alternatives considered

Új, párhuzamos válogató a konzílium mellett: két hely döntene arról, mi számít „fontosnak", és a
konzílium dosszié-eredménye könnyen elszakadna a fal-tartalomtól — elvetve, a spec §1 owner-döntése
szerint egy válogató marad. LLM nélküli, tisztán szabály-alapú szűrés a kiadás egészére: elvetné a
konzílium meglévő szakértői vitáját, holott az pontosan a dosszié-döntés helye marad — elvetve;
a kiadás csak a már meglévő konzílium-kimenetet és a companion/proactive rekordokat rangsorolja,
nem generál új tartalmat LLM-mel (H1-ben egyáltalán nem hív modellt).
