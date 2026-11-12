---
cim: Progresszió-motor (súly és ismétlés)
szint: Funkció
terulet: Edzés
allapot: Tervezve
hol: [Háttérrendszer]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: A következő edzés súlyát és ismétlését szabályok számolják a legutóbbi azonos gyakorlatból — AI nélkül, mindig megindokolva.
---

## Mit csinál
Minden gyakorlathoz kiszámolja a mai előírást: mekkora súllyal, hány ismétlést, mennyi tartalékkal — és egy rövid indoklást
(„súlyemelés”, „+1 ismétlés”, „tartás”, „terhelés-csökkentés”). A motor a háttérben ma is fut a webes appnak; a Boop B5-ben
ugyanezt mutatja.

## Hogyan működik
A motor megkeresi az **utolsó elvégzett edzést ugyanazzal a gyakorlattal**, annak legjobb munkasorozatát, és:

1. **Terhelés-csökkentő hét:** kb. 90%-os súly, ismétlések visszaállnak.
2. **Elérted a tartomány tetejét:** a következő **valóban létező** súly kb. +2,5% (összetett) vagy +5% (izolációs), azonos
   erőfeszítésre átszámolt ismétléssel. Ha az ugrás 10%-nál nagyobb lenne, előbb ismétlést épít a tartomány fölé.
3. **A tartományon belül vagy:** +1 ismétlés — kivéve, ha az utolsó sorozat „őrlés” volt (a tartalék a cél alatt), akkor tartás.
4. **A tartomány alatt vagy:** ha a cél-erőfeszítésen voltál, csökkenti a súlyt, különben tart.
5. **Első alkalom:** a kezdősúlyból indul.
6. **Súly-igazítás:** a célsúlyt a gépen ténylegesen elérhető súlyra kerekíti (előzmények + tárcsarács − ismert hiányok).
7. **Bemelegítés:** a munkasúlyból visszafelé lépcsőzve (például 50% × 8, 75% × 3).

Ráadásként a mai napra, a sablon módosítása nélkül: könnyítés a reggeli készenlét alapján, egy napra szóló könnyítés, visszatérő
rámpa kímélő időszak után (lásd [Kihagyás, kímélő mód, készenlét](11-kihagyas-kimelo.md)).

**Ami nem mozgatja a terhelést:** a pumpa/ízület/munka visszajelzés, a záró megjegyzés, az alvás, az étel, a testsúly, az óra adatai.

## Miért így
- Átlátható és visszafordítható: minden előírás mellett ott az ok.
- Gyakorlatonként, edzésről edzésre alkalmazkodik, a bevett „ismétlést előbb, súlyt utána” elv szerint.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.feature.hypertrophy-drive.enabled` | Be/ki kapcsolja az előírt sorozatokat és a dinamikus ajánlást | be |
| `mezo.hypertrophy.step-percent.compound` / `isolation` | Súlyemelés mértéke a tartomány tetején | 2,5% / 5% |
| `mezo.hypertrophy.max-jump` | Ennél nagyobb ugrás előtt előbb ismétlést épít | 10% |
| `mezo.hypertrophy.max-jump-reserve` | Nagyobb tartaléknál megengedett ugrás | 15% |
| `mezo.hypertrophy.reserve-slack` | Ennyivel a cél fölötti tartalék számít „bőnek” | 2 |
| `mezo.hypertrophy.rep-overflow` | Ennyi ismétlést épít a tartomány fölé ugrás előtt | 3 |
| `mezo.hypertrophy.plate-step` | Kerekítés lépésköze | 2,5 kg |
| `mezo.hypertrophy.gap-near-fraction` | Ekkora eltérés jelzi, hogy egy súly hiányzik a gépen | 10% |
| `mezo.hypertrophy.warmup-ladders` | Bemelegítő lépcsők a bemelegítő sorozatok száma szerint | 1–3 lépcső |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `exercise_set` | A korábbi sorozatok, amelyekből a motor dolgozik, és az előírt érték pillanatképe |
| `exercise` | A gyakorlat receptje (tartomány, cél-RIR, kezdősúly) |
| `exercise_weight_gap` | Gépenként hiányzó súlyok |

## Mi jön még
B5: a Boop lejátszó mutatja az előírást és az indoklást. Nyitott: a visszajelzés bekerüljön-e a motorba (tulajdonosi döntés kell).

## Mi marad ki
Nincs.
