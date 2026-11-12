---
cim: Check-in pillanatkép
szint: Kis funkció
terulet: Apple Health és adatok
allapot: Ellenőrzés
hol: [iPhone app, Apple Health, Háttérrendszer]
szulo: 02-szeles-adatkor
szakasz: [B3]
osszefoglalo: Amikor kitöltesz egy check-int, a Boop mellé teszi, mit mutatott abban a pillanatban a pulzusod, a HRV-d, a lépéseid és az éjszakád.
---

## Mit csinál
Egy check-in (például „fáradt vagyok, 4/10”) mellé automatikusan elmentődik egy pillanatkép a testedről:
aktuális pulzus, HRV és a szokásos HRV-d, a mai lépések addig, és mennyit aludtál előző éjjel. Így később
kiderülhet, hogy az érzésed és a mért adatok hogyan függenek össze.

## Hogyan működik
1. Mentéskor a telefon az Egészségből olvas: pulzus = az utolsó 15 perc átlaga (ha nincs, az utolsó egy órán belüli mérés); HRV = az utolsó 8 órán belüli mérés + a 14 napos medián („szokott”); lépés = ma eddig; alvás = a ma reggel véget ért éjszaka.
2. Minden értékhez az időpontja és a forrás is elmentődik; ami nincs, az üres.
3. Ha a check-in a pillanatkép nélkül érkezik (például a webes appból), a szerver tölti ki a tárolt mérésekből.
4. Egy check-inhez egy pillanatkép tartozik.

## Miért így
- Az egyik alapcél: a check-ineket össze kell tudni kötni a mért adatokkal (spec B3). Ez lesz a B7-es kapacitás-modell kalibrálásának alapja.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `check_in_snapshot` | Egy check-inhez: pulzus + időpont, HRV + időpont, szokásos HRV, lépés, alvásperc, forrás, ki számolta (telefon vagy szerver) |

## Mi jön még
- A B3 ellenőrzés és beolvadás után élesedik.

## Mi marad ki
- Óra nélkül a HRV üres marad (a jelenlegi forrás nem ír HRV-t).
