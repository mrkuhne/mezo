# 0037. A konzílium kereszt-vita köre és a strukturált tanácskozás

- Státusz: elfogadva
- Dátum: 2026-09-06
- bd: mezo-xlvr

## Kontextus

A heti konzílium átirata próza volt: a javaslatokat, a Szkeptikus verdiktjeit és Mezo döntéseit
három külön buborék hordozta, a köztük lévő kapcsolatot csak egy `P` sorszám. A szerkezet a
futás memóriájában végig megvolt, mentés előtt dobtuk el. Ráadásul a szakértők nem is látták
egymás javaslatait, így a tanácskozás valójában nem volt tanácskozás.

## Döntés

Két lépés. Egy: a tanácskozás szerkezete külön jsonb oszlopban mentődik, fejezet-szálakra bontva,
a próza-átirat mellett. Kettő: a javaslat- és a verdikt-kör közé bekerül egy kereszt-vita kör,
ami CSAK azokra a fejezetekre hív modellt, ahol legalább két szakértő javasolt. Egy szakértő a
társa javaslatára állásfoglalást ad (támogatja, vitatja, árnyalja) egy mondat indoklással; ezek
Mezo prompt-jába kerülnek. A Szkeptikus köre változatlan, a döntés Mezóé marad.

## Következmények

- Konferenciánként legfeljebb hat plusz LLM-hívás, a legtöbb szakértőt érintő fejezetektől lefelé.
- A régi konzíliumok olvasáskor kapnak szálakat, a próza gépi soraiból visszafejtve; ott a szálak
  szakértő szerint állnak össze, mert a fejezet-hovatartozás nincs az átiratban.
- Egy nem értelmezhető kör nem termel verdiktet, és a felület ezt ki is mondja.
