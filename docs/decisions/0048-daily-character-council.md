# 0048 — Napi szakértői beszélgetések és végrehajtható Karakter-döntések

- **Status:** Accepted
- **Date:** 2026-09-21
- **Driver:** mezo-zwy6v

## Context

A heti konzílium ritka a kívánt napi élményhez. A jelenlegi keresztvita azonos témakörbe javasló szakértőkre szűkül, és a döntési indoklás néha olyan átírást/áthelyezést mond, amelyet a mentési művelet nem hajt végre. A tulajdonos a Karaktert az app napi AI-életének központjaként szeretné használni.

## Decision

Napi előkészített, görgethető fal legfeljebb három kiemelt szállal; eseményre folytatódó, témakörökön átívelő szakértői vita és heti összegzés. A szakértők belső olvasóeszközökkel ellenőriznek, kiegyensúlyozott modellhasználattal és indokolt eszkalációval. A profilpontosítás automatikus, látható és visszavonható; terv/cél/rutin változtatásához a felhasználó konkrét jóváhagyása kell. Minden lezárás a ténylegesen végrehajtott műveletet vagy tartós következő lépést mutatja.

A részletes célállapot és ellenőrzési példák a [napi konzílium specifikációjában](../superpowers/specs/2026-09-21-daily-character-council-design.md) vannak. Ez elfogadott termékirány, nem szállított képesség; a jelenlegi működést továbbra is a [Karakter living doc](../features/character.md) írja le.

## Consequences

Az újdonság, a vita és a változtatás külön auditálható. A források időbeli érvényessége, a duplikált bizonyíték kiszűrése, a feldolgozás tartóssága és az utánkövetés elsőrendű követelmény. A napi működés felső korlátokat, költségelszámolást és közös profilváltoztatási kaput igényel. A jelenlegi feed/reply viselkedés kompatibilitását meg kell tartani az átvezetéskor.

## Alternatives considered

Teljes heti konzílium naponta: sok ismétlés és szükségtelen hívás. Minden adatra teljes csapatreakció: széttördelt szálak és kiszámíthatatlan ráfordítás. Csak látványos kommentek hozzáadása: a döntési és bizonyítékhiányokat érintetlenül hagyná.
