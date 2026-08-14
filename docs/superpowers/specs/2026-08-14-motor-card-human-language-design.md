# Motor pár-kártya — emberi nyelvű minta-leírás (design)

**Dátum:** 2026-08-14 · **Státusz:** approved design (brainstorm, v4 mockup jóváhagyva — „A")
**bd:** `mezo-fj1g` · **Előzmény:** `2026-08-13-motor-redesign-design.md` (mezo-18bx — a v2 kártya élesben)

## 1. Probléma

Az élesített Motor-kártya a motor TÁROLÁSI modelljét beszéli: nyers `r/n/p`, csupa-caps
metrika-útvonal, „együttmozgás"-nyelv. A felhasználó nem érti, milyen mintát figyelünk és mit
találtunk. A statisztika fordítás nélkül nem kommunikál.

## 2. Cél / nem cél

**Cél:** a kártya két emberi mondatot mondjon — 🔍 *amit keresünk* és 📈 *amit eddig látunk* —
páronként kézzel írt szövegekből komponálva; a nyers statisztika a kibontott nézetbe kerül;
a lefedettség-sor a v3 szerint újratagolódik (név főszerepben, chip-státusz, semmi levágás).

**Nem cél:** a motor/tárolás változtatása; új számítás; LLM-szöveg (minden mondat determinisztikus
kompozíció írott elemekből); a hero/chipek/szekciók változtatása.

## 3. Katalógus-bővítés (kézzel írt mezők, `PatternPair` config)

Páronként 4 új kötelező mező a yml-ben (a `title`/`mechanism` mintájára):
- `question` — kérdés-cím, ez lesz a kártya címe („Jobban alszol, ha este lezárod a napot?");
- `expected-direction` — `positive|negative`: a mechanizmus által várt korreláció-irány;
- `when-positive-hu` / `when-negative-hu` — egy-egy tagmondat, mit jelent EMBERÜL a pozitív ill.
  negatív r ennél a párnál, `{erősség}` behelyettesítővel
  (pl. „a lezárt esték után {erősség} jobban aludtál").

## 4. Kártya-kompozíció (determinisztikus, FE)

1. Fejsor: kategória-pill + kereszt-domén chip + verdikt-pill (változatlan).
2. **Cím = `questionHu`** (17px); alatta halvány pár-sor: `{A-label} ↔ {lag>0 ? 'másnapi ' : ''}{B-label}`.
3. **🔍 Amit keresünk** blokk (lila tint): `mechanismHu` (a kibontásból ide költözik).
4. **📈 Amit eddig látunk** blokk (élő/fagyasztott, ha van r):
   - előtag: a talált irány (`sign(r)`) egyezik a várttal → „Igen:", különben „Meglepő:";
   - mondat: `when-positive/negative-hu` a talált irány szerint, `{erősség}` →
     |r|<0.3 „kicsit" · <0.6 „érezhetően" · ≥0.6 „határozottan"; a behelyettesített rész félkövér;
   - bizonyosság-chip + magyar meta-mondat `p`-ből: p≤0.05 zöld „megbízható jel" + „ez már aligha
     véletlen"; p≤0.15 arany „ígéretes jel" + „még összejöhet véletlenül is — gyűlik az adat";
     különben sárga „még bizonytalan" + „kb. minden {max(2, round(1/p))}. ilyen minta véletlenül is
     összejönne"; előtte mindig „{n} közös nap".
   - fagyasztott soron plusz egy sor: „Te ítélted meg (megerősítve/elvetve) — nem számoljuk újra."
5. **few_days:** a blokk címe „🎯 Még nincs válasz", tartalma a meglévő nudge-mondat.
   **no_data/degenerate:** a meglévő őszinte mondatok ebben a blokk-pozícióban.
6. **Kibontás** (koppintásra, mint eddig): forrás-pillek + ÚJ „statisztika" sor
   (`r=… · n=… · p=…` — ide költözik a nyers adat) + „Minta megnyitása →" (élő/fagyasztott).
7. Csupa-caps megszűnik a kártyán és a lefedettség-soron (a szekció-eyebrow-k maradhatnak).

## 5. Lefedettség-sor (v3, jóváhagyva)

Gyűrű + **név főszerepben** (13.5px, normál betűk) + alsó sor „{n}/{window} nap · utoljára: {ma |
tegnap | M.D.}" + jobbra színes chip: „N pár vár rá" (sárga, ha nincs élő hivatkozó pár) /
„N párban él" (zöld). Kibontás változatlan (forrás + hivatkozó párok).

## 6. Contract (additív)

`PatternMonitorPair` += `questionHu`, `expectedDirection` (`positive|negative`),
`whenPositiveHu`, `whenNegativeHu` — a monitor-service áttölti a configból, számítás nincs.

## 7. Tesztek

- BE: config-validáció (29 pár × 4 mező nem üres, a validátor fogja) + monitor-IT mezőasszertek.
- FE `PairRow`: kompozíció-egység — „Igen/Meglepő" előtag mindkét ága, {erősség} három sávja,
  p-fordítás három sávja, few_days/no_data változatlan mondatai; MotorPage-teszt frissítés.
- Lefedettség: „pár vár rá/párban él" chip + dátum-formázás (ma/tegnap/M.D.).

## 8. Megjegyzés — hr-recovery irány

A `run-hr-recovery-s` a *visszaállás ideje másodpercben* (alacsonyabb = jobb) — a
`sleep-quality~next-day-hr-recovery` irány-olvasatait ennek megfelelően kell írni; implementáláskor
a mező szemantikáját a Run-napló forrásából ellenőrizni.
