---
cim: Táplálékkiegészítők (egyszerűsítve)
szint: Funkció
terulet: Étel
allapot: Tervezve
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B4]
osszefoglalo: A kiegészítőid listája és egy koppintás, hogy bevetted — a bonyolult elhelyező szerkesztő nélkül.
---

## Mit csinál
- A kiegészítő-stacked listája: mit, mennyit, mikor (a nap melyik szakaszában).
- Egy koppintással jelölöd, hogy bevetted.

## Hogyan működik
1. A háttérrendszerben van egy „elhelyező motor”, ami eldönti, hogy egy kiegészítő a nap melyik szakaszába kerüljön: először egy
   szabálytábla, ha az nem ismeri, egy AI-javaslat, aztán a te döntésed, végül egy tartalék szakasz.
2. Ez a motor **a szerveren marad és dolgozik**; a Boop csak az eredményt mutatja (a listát a helyükkel) és a bevételt rögzíti.
3. A motor szerkesztőfelülete (amivel a webes appban kézzel áthelyezed, rögzíted a tételeket) **nem kerül át**.

## Miért így
A tulajdonos ténylegesen használja a stacket, ezért megmarad (döntés #6, 2026-11-11), de egyszerűsítve: a mindennapi
használathoz a lista és a „bevettem” elég.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.feature.stack-placement-llm.enabled` | Be/ki kapcsolja az AI-javaslatot az ismeretlen kiegészítők elhelyezésére (ki: tartalék szakasz) | be |
| `mezo.fuel.protocol.default-confidence` | A stack biztonsági jelzésének rögzített értéke | 0,86 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `protocol` | A stack (protokoll) feje |
| `protocol_item` | A stack tételei: adag, napszak-zóna, rögzítve van-e, honnan jött az elhelyezés |
| `supplement_intake` | A bevételek naplója |

## Mi jön még
B4: natív lista és „bevettem” gomb.

## Mi marad ki
Az elhelyező szerkesztő felülete; a gyógyszer-ciklus (lásd [Ami kimarad](10-ami-kimarad.md)).
