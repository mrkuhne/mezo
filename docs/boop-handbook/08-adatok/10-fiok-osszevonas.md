---
cim: Fiók-összevonás az eredeti fiókba
szint: Kis funkció
terulet: Apple Health és adatok
allapot: Élesben
hol: [Háttérrendszer]
szulo: 00-attekintes
szakasz: [B1]
osszefoglalo: A Boop külön fiókjának adatai átkerültek az eredeti, webes fiókodba, így egy fiókod és egy történeted van.
---

## Mit csinál
Az első hetekben a Boop egy külön fiókot használt, így az Egészség-adatok és a webes előzmények (célok,
check-inek, régi éjszakák) két helyen voltak. Egy egyszeri művelet mindent az eredeti fiókba költöztetett, és a
telefon azóta azzal lép be.

## Hogyan működik
1. Egy egyszeri adatbázis-szkript először biztonsági másolatot készít minden érintett sorról.
2. Egyetlen lépésben áthelyezi: éjszakák (amelyek ugyanarra a napra estek, azokat az *Egy dátum, egy éjszaka* szabály szerint összefésüli), napi összesítők, edzések, naptáresemények, reggeli összefoglaló, súly.
3. Ellenőrzi a darabszámokat; alapból csak próbaüzemben fut, éles írás csak külön kapcsolóval.
4. Van visszaállító szkript, amely a másolatból mindent visszatesz.
5. 2026-11-11-én a tulajdonos jóváhagyásával élesben lefutott. A régi Boop-fiók megmaradt (egy árva szinkronnal, ártalmatlan); a biztonsági másolatok a tulajdonos végső jóváhagyásáig megmaradnak.

## Miért így
- Tulajdonosi döntés (2026-11-11): az eredeti fiók az egyetlen fiók, egy történet.
- Éles adatírás, ezért előtte darabszámok + visszaállítási terv a tulajdonosnak, és próba egy tesztadatbázison.
- Nem a szokásos adatbázis-frissítéssel ment, mert konkrét felhasználó-azonosítókhoz kötött egyszeri művelet.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `b1_backup_*` | Ideiglenes biztonsági másolatok az összevonás előtti állapotról |
| `sleep_log`, `daily_metric`, `wearable_workout`, `calendar_event`, `boop_brief`, `weight_log` | Az áthelyezett adatok |

## Mi jön még
- A régi Boop-fiók letiltása és a másolatok törlése a tulajdonos megerősítése után.

## Mi marad ki
- A régi fiók automatikusan keletkezett szokásai és AI-naplói nem költöztek (nincs rájuk szükség).
