---
cim: Működés net nélkül
szint: Funkció
terulet: Alapok
allapot: Részben kész
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S1, S3, B3]
osszefoglalo: A napi rögzítés net nélkül is működik — a telefon megőrzi, és magától elküldi, amint újra van kapcsolat.
---

## Mit csinál
- **Belépéskor** net nélkül egy nyugodt „nincs net” képernyő jön. *(Élesben)*
- **A Ma oldal** a már betöltött reggeli összefoglalót mutatja akkor is, ha a frissítés nem sikerül. *(Élesben)*
- **A napi ritmus** — check-in, a nap célja, napló (hanggal is), esti zárás — net nélkül is menthető. Egy kis
  felhő-ikon és a „Nincs net · a telefonon van, elküldöm, amint lesz” sor jelzi, hogy még vár. *(Ellenőrzés, B3)*
- Boop saját mondatai (a kitöltés utáni sor, az esti mondat, a csevegés válasza) netet igényelnek; addig egy csendes
  „amint lesz net…” sor áll a helyükön.

## Hogyan működik
1. Minden mentés először a telefonra kerül, egy sorba („kimenő posta”), saját azonosítóval és a rögzítés pontos
   idejével.
2. A telefon elküldi, amikor: az app előjön, a net visszajön, új mentés történik, vagy háttérfrissítés fut.
3. A szerver a saját azonosító alapján ismeri fel, ha ugyanazt kétszer kapja — sosem lesz duplikáció.
4. A szerver a **rögzítés** idejét tárolja: egy 16:02-es kitöltés akkor is 16:02-nél áll a görbén, ha csak este 23-kor ért be.
5. Ha valami végleg nem megy át, a nap összegzésében megjelenik egy „nem sikerült elküldeni” sor **Újra** gombbal — semmi sem tűnik el csendben.
6. Egy 7 napnál régebbi, el nem küldött tétel hibásként, az értékeivel együtt látszik.

## Miért így
A tulajdonos saját szavai (B3 spec, D1 döntés): októberben sokat utazott, nem volt net, ezért hagyta abba a
naplózást. A B3 első követelménye ezért: **semmi ne vesszen el, mert elment a net**.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.dayclose.max-past-days` | Legfeljebb hány nappal korábbi nap zárható le utólag (késve beérkező zárásnál) | 7 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `intention_focus` | A nap célja — saját azonosítóval (`client_ref`), hogy ne duplázódjon |
| `journal_entry` | Naplóbejegyzések — szintén saját azonosítóval |
| `day_close` | Az esti zárás — szintén saját azonosítóval |

## Mi jön még
Az étel- és edzésrögzítés (B4, B5) ugyanezt a net nélküli utat kapja.

## Mi marad ki
Boop válaszai net nélkül — azokhoz a szerver kell.
