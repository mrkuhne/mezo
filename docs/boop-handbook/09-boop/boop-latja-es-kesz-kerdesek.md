---
cim: Boop látja és Ma kérdezheted
szint: Kis funkció
terulet: Boop
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B3]
osszefoglalo: A Boop fül tetején tény-csíkok mutatják, mit lát most Boop, alatta legfeljebb három kész kérdés a mai naphoz.
---

## Mit csinál
- **„Boop látja · most”**: vízszintesen görgethető csíkok, például: alvás a tegnapihoz képest, HRV a szokásoshoz képest,
  mai sport és időpontja, hány kitöltés volt és mi az utolsó energia, megevett kalória a célból, a nap célja, hátralévő
  naptár.
- **„Ma kérdezheted”**: legfeljebb három kérdés, egy koppintással elküldhető.

## Hogyan működik
- A csíkokat a háttérrendszer adja ugyanabból a napi blokkból, amit a chat modell is kap.
- A kész kérdéseket **egyszerű szabályok** választják, nem AI. Például: ha a HRV a szokásos alatt van vagy rövidebb volt
  az alvás → „Miért vagyok fáradtabb, mint tegnap?”; ha ma edzés van → „Mennyit egyek az edzés előtt?” és „Mire figyeljek
  ma az edzésen?”; ha holnap edzés vagy verseny → „Mikor és mit egyek, hogy holnap jól menjen?”; különben „Hogy alakul a
  napom?”.

## Miért így
Az átláthatóság: amit a sáv mutat, az az, amit Boop lát. A szabály alapú kérdések ingyenesek és kiszámíthatók (tervezői
döntés, a tulajdonos ellenőrzésére jelölve).

## Beállítások
Nincs.

## Adattáblák
Nincs — a csíkok minden megnyitáskor frissen készülnek.

## Mi jön még
Nincs külön tervezve.

## Mi marad ki
AI-val generált kérdésjavaslatok — B3-ban szándékosan nem.
