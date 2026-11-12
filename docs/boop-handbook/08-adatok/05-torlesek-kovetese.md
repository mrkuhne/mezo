---
cim: Törlések követése
szint: Kis funkció
terulet: Apple Health és adatok
allapot: Részben kész
hol: [iPhone app, Apple Health, Háttérrendszer]
szulo: 03-frissites-nyitaskor-es-hatterben
szakasz: [B1]
osszefoglalo: Amit az Apple Egészségben törölsz, az a Boop szerverén is eltűnik.
---

## Mit csinál
Ha az Egészségben kitörölsz egy hibás edzést, egy rossz mérlegelést vagy egy éjszakát, a Boop is elfelejti —
nem fog egy nem létező edzés a terhelésedbe számítani.

## Hogyan működik
1. A könyvjelzős lekérdezés a törölt minták azonosítóit is visszaadja.
2. A telefon ezeket egy külön kérésben elküldi; a szerver „töröltnek jelöli” őket (nem dobja el végleg).
3. Éjszakánál más az út, mert egy éjszaka sok mintából áll: alvás-törléskor a teljes 60 napos ablak újramegy, és ami hiányzik belőle, az törlődik.
4. Egy törlés kétszer elküldve sem okoz gondot.

## Miért így
- A törlésjelzés csak egy azonosítót ad, ezért kell az éjszakákhoz az ablakos megoldás (B1 döntés).
- „Töröltnek jelölés” — így szükség esetén visszaállítható.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `health_sample`, `wearable_workout`, `weight_log`, `sleep_log` | Az `is_deleted` jelző mutatja, hogy egy sor törölve van |

## Mi jön még
- **Fizetős Apple-fiók:** a telefonon igazolni, hogy egy Egészségben törölt edzés eltűnik a szerverről (a kód kész, a tesztek zöldek, a valódi eszközön még nincs kipróbálva).

## Mi marad ki
- Pulzusmérés törlése nem változtatja meg az 5 perces blokkot.
- Egészségből törölt testsúly után a célt nem számoljuk újra.
- Ha minden éjszakát törölsz a 60 napból, azt nem lehet továbbítani.
