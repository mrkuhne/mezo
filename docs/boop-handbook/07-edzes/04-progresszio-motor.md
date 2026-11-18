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

> **Tartomány-érzékeny kiindulás.** Ha ugyanazt a gyakorlatot két különböző ismétlés-tartománnyal edzed (például hétfőn 6–10,
> csütörtökön 12–15), a motor mindig **az azonos tartományú utolsó edzésből** számol, ha az legfeljebb 8 hetes. Ha nincs ilyen,
> a legutóbbi edzést használja, és ha az a saját tartományán belül volt, de a mostanin kívül, **átszámolja** az új tartományra:
> azt a súlyt keresi, amelyen az új tartomány alja a cél-erőfeszítésre esik, és a valóban létező súlyra kerekíti. Így a 12 ismétléses
> nap nem sürget „súlyemelést” a 6–10-es napon, és fordítva. Ez minden edzésblokknál így működik.

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

**A sorozatok számáról** nem ez a motor dönt: azt a gyakorlatra beírt szám adja, és hétről hétre a heti javaslat mozgatja egy-két
sorral (lásd [Heti volumen](05-heti-volumen.md)). Ez a motor a súlyt és az ismétlést számolja arra a sorozatszámra.

**Edzésstílusú blokkban** (lásd [Edzésstílus](14-edzesstilus.md)) a motor még három dolgot tesz: **hétről hétre fokozza az erőfeszítést**
(a tartalék a blokk elején a stílus értéke, a közepén eggyel kevesebb, az utolsó terhelő héten kettővel kevesebb, a
terhelés-csökkentő héten kettővel több; szabad súlyos gyakorlatnál sosem megy 1 alá), **megmondja a pihenőt** minden sorozathoz,
és a tartomány tetején a stílusnak megfelelő számú ismétlést épít, mielőtt súlyt emel (4 / 3 / 2). Ha a tartalék 0–1, a motor
nem hisz a becsült tartaléknak: „őrlésnek” számít, ha két vagy több ismétlést hagytál ki az előírthoz képest.

**Elakadás-figyelés:** stílusos blokkban a motor izomcsoportonként nézi, hogy valamelyik gyakorlatnál a legjobb sorozat javult-e
(nehezebb vagy több ismétlés) az előző héthez képest. Ha két egymást követő héten **egyetlen** gyakorlat sem javult az adott izomnál,
a heti javaslat naplójába bekerül: „megállt a fejlődés”. Egyelőre csak jelzés — számot nem változtat; a javaslatok (technika,
tartományváltás, egy hét könnyítés) egy későbbi csomagban jönnek.

**Ami nem mozgatja a súlyt és az ismétlést:** a pumpa-visszajelzés, a záró megjegyzés, az alvás, az étel, a testsúly, az óra adatai.

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
| `mezo.train.style.same-range-max-age-days` | Ennyi napnál nem régebbi azonos tartományú edzés számít kiindulásnak | 56 nap |
| `mezo.train.style.ramp` | Az erőfeszítés-fokozás lépései (közép −1, utolsó hét −2, terhelés-csökkentő +2, szabad súlyos alsó határ 1) | lásd Edzésstílus |
| `mezo.train.style.stall-weeks` | Ennyi hét javulás nélkül „megállt a fejlődés” | 2 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `exercise_set` | A korábbi sorozatok, amelyekből a motor dolgozik, az előírt érték és az edzett ismétlés-tartomány pillanatképe |
| `exercise` | A gyakorlat receptje (tartomány, cél-RIR, kezdősúly) |
| `exercise_weight_gap` | Gépenként hiányzó súlyok |

## Mi jön még
Az elakadás utáni javaslatok és az intenzitás-technikák a stílus-sorozat következő csomagjaiban. B5: a Boop lejátszó mutatja az előírást és az indoklást. A heti sorozat-javaslat már figyelembe veszi a gyakorlat utáni visszajelzést
(túl sok volt-e a munka, fájt-e az ízület) és az izomlázat — de a súly és az ismétlés kiszámolását a visszajelzés még nem
befolyásolja (ez egy későbbi csomag kérdése).

## Mi marad ki
Nincs.
