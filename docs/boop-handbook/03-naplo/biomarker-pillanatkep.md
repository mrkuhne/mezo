---
cim: Az órád ekkor (biomarker-pillanatkép)
szint: Kis funkció
terulet: Napló
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer, Apple Health]
szulo: check-in
szakasz: [B3]
osszefoglalo: Minden kitöltéshez elmentődik, mit mért az órád abban a pillanatban — pulzus, HRV, lépés, alvás.
---

## Mit csinál
A kitöltés részleteinél **„AZ ÓRÁD EKKOR”**: pulzus · HRV (ha a szokásosnál alacsonyabb, „lejjebb” felirattal) ·
lépés · alvás. Például: „pulzus 78, HRV 38 (szokott 50), 7 420 lépés”. Ez a kép **befagy**: később sem változik.

## Hogyan működik
A telefon a mentés pillanatában számolja ki az Apple Egészségből (net nélkül is):
- **pulzus** — az utolsó 15 perc átlaga (ha nincs, az utolsó mérés egy órán belül);
- **HRV** — a legutóbbi érték 8 órán belül, és a 14 napos középérték mint „szokásos”;
- **lépés** — a mai lépések eddig;
- **alvás** — az előző éjszaka alvásideje.

Ha egy kitöltés pillanatkép nélkül érkezik (például a webes appból), a szerver maga tölti ki a már feltöltött
adatokból — ilyenkor a lépés a nap összesített száma, és ez meg is van jelölve.

## Miért így
A tulajdonos minden pötty mellett látni akarja, mit mondott az óra (spec, Oura-féle „okos címkék” helyett).
Ez az adat kell később a napi kapacitás (B7) betanításához is.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `check_in_snapshot` | Kitöltésenként egy pillanatkép: pulzus és ideje, HRV és ideje, szokásos HRV, lépés (és hogy napi összeg-e), alvás perc, forrás, és hogy a telefon vagy a szerver számolta |

## Mi jön még
A pillanatképekből a napi kapacitás modell tanul — B7.

## Mi marad ki
A pillanatkép utólagos frissítése — szándékosan nem, a pillanatot rögzíti.
