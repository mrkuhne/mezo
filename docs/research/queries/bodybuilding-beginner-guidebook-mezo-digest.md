---
title: Beginner bodybuilding guidebook — Mezo product and development digest
type: query
updated: 2026-11-17
tags: [train, goals, technique]
related:
  - ../concepts/program-design-rules.md
  - ../concepts/set-volume-landmarks.md
  - ../../features/train.md
  - ../../features/goal-engine.md
sources:
  - raw/articles/2026-11-17-bodybuilding-transformation-beginner-extraction.md
confidence: medium
contradictions: []
---

# Kezdő testépítő kézikönyv → Mezo: döntéselőkészítő digest

**Kérdés:** mit érdemes átvenni a felhasználótól kapott *The Bodybuilding Transformation
System — Beginner* kézikönyvből a Mezo edzéstervezésébe, progressziójába, gyakorlatrendszerébe és
ajánlásaiba? **Forrás:** [oldalszámos, parafrazált kinyerés](../raw/articles/2026-11-17-bodybuilding-transformation-beginner-extraction.md).
Az oldalszámok a PDF-néző 1-től számozott oldalai; a könyvbe nyomtatott szám 3-mal kisebb.
**A könyv szabályai forrásállítások. Az „Irány” sorok Mezo-javaslatok, nem jóváhagyott döntések.**

## Vezető megállapítás

A kézikönyv legértékesebb része **nem egy lemásolható edzésterv**, hanem egy kezdő program
logikája: alacsony induló terhelés → fokozatos munka és erőfeszítés → új gyakorlatokkal könnyebb
átvezető hét → újabb építés; mindezt követhető gyakorlatokkal, indokolt cserékkel és
összehasonlítható szettadatokkal. Mezóban a komponensek zöme már létezik. A termékmunka a
**kezdő útvonal összerendezése** és néhány modellhiány feloldása. A PDF a teljes programlapok
nélkül nem tartalmazza a 12 hét összes napi gyakorlatát, szettjét és cserepárját (PDF 15.).

## Forrás → jelenlegi Mezo → használható irány

| Forrás | Már létezik | Irány / rés | Súly |
|---|---|---|---|
| **12 hét, 5+7 szakasz; 1. és 6. hét könnyű, 3–5. hét 2 szett, 7–12. hét 2–3 szett** (PDF 20–21.) | A [Train](../../features/train.md) 4–8 hetes generátora szakaszgörbét, izomprioritást, heti szettprogressziót és deloadot ad. | Külön **kezdő hipertrofia-sablon** felhasználó által választható heti napokkal és két, 5+7 hetes blokkal. Az 1./6. hét átvezető jellegét explicit modellezni; ne erőltessük a 12 hetet minden célra. | Magas |
| **Kezdő RIR ~2–3; korai/utolsó szett eltérhet; csak kijelölt utolsó szettek mehetnek bukásig később** (PDF 8–9., 12–13.) | Gyakorlatonként `targetRir`, szettenként tényleges RIR, bemelegítő/munkaszettszétválasztás és readiness-könnyítés. | Vizsgálni a **szettpozíció szerinti előírást**: korai és utolsó munkaszettre külön cél, majd csak megfelelő gyakorlatnál, blokkban és felhasználói beleegyezéssel technikai bukás. RPE↔RIR nyelvi fordítás a felületen. | Magas |
| **Ismétlés a sáv tetejéig, utána súly; forma romlása nem valódi progresszió** (PDF 7., 10.) | A `ProgressionDecider` már ismétlés/súly/tartás/deload jelet és szettcélokat számol. | Ellenőrizni, hogy súlynövelés előtt **minden releváns munkasor** teljesíti-e a felső határt összehasonlítható formában; egyszerű formavisszajelzés legyen bizonyíték, ne automatikus, mérhetetlen „technika pontszám”. | Magas |
| **Gyakorlat maradjon stabil a blokkon belül; cserének legyen oka** (PDF 17., 22., 49.) | 166 elemes gyakorlatkatalógus; napra vagy egész mezociklusra csere; a választó hasonló izom alapján ajánl. | A csereindok lehet felszerelés, fájdalom, tartósan rossz érzet vagy preferencia. Ajánlott helyettesítő azonos **mozgásmintát/izomcélt** tartson; blokk közbeni csere megőrizze az előző gyakorlat teljesítménytörténetét és magyarázza az összehasonlítás törését. | Magas |
| **Stabil, célizmot nyújtott helyzetben terhelő mozgások; gép és szabadsúly egyaránt érvényes** (PDF 11–12., 30–36.) | Katalógus: izom, típus, `stim`, `fatigue`, média; generátor keretekbe választ. | A katalógushoz ellenőrzött metaadat kellhet: felszerelés, mozgásminta, primer/szekunder izom, terhelési profil, korlátozás, rövid instrukció. Példa: a könyv *machine hip adduction* mozgást említ (PDF 35.), a 166-os master-katalógusban jelenleg nincs ilyen név; előbb variáns-/duplikátumaudit. | Közepes |
| **4 nap esetén az 5. alkalom átvihető a következő hétre** (PDF 46.) | A Mezo generátora napdarabszám alapján más splitet választ; a mezociklus naptári hetekhez kötött. | Külön termékdöntés: **rögzített 4 napos terv** vagy **sorban folytatódó 5 alkalmas ciklus**. A kettőt nem szabad egy motorban észrevétlenül keverni, mert a heti volumen-, kihagyás- és deload-számolás más lesz. | Közepes |
| **Szettenkénti súly/rép napló, testsúlytrend, ritkább összehasonlítható fotó együtt** (PDF 22., 27–28.) | Teljes szettnapló, rekordok, EWMA testsúlytrend és célmotor; edzéstörténet. | A 4–8 heti felülvizsgálat együtt mutathat teljesítményt + súlytrendet + opcionális fotót. Fotó nélkül is működjön; a teljesítményjavulást ne állítsa biztos izomnövekedésnek. | Közepes |
| **Pihenőidő inkább regenerálódási támpont; gyakorlatonként eltérhet** (PDF 15., 47.) | Edzés közben futó időzítő, jelenleg 150 s összetett / 90 s izolációs alapértékkel. | Egy későbbi tervhez lehet gyakorlat-/szettfüggő pihenő és felhasználói módosítás. A pontos könyvbeli soronkénti értékek a hiányzó programlapok nélkül nem ismertek. | Alacsony |

## Amit változtatás nélkül nem emelnénk át

- **Nem „heti ötször kötelező”**: a könyv 5 napos bontása a szerző választása (PDF 19–20.);
  a Mezo 2–6 napra épít. A kezdő felhasználó ideje, korábbi edzése és regenerációja fontosabb.
- **Nem 12 hetes, azonos gyakorlatlistás klón**: a PDF csak a szerkezetet és egy 7. heti
  mintanapot mutatja. Hiányoznak a teljes programlapok. A könyv jogfenntartott; saját tervlogika,
  saját megfogalmazás, licencelt/saját gyakorlatmédia kell (PDF 2., 15.).
- **Nem automatikus bukás vagy nagyobb volumen**: a kezdőknél a könyv maga fokozatosságot és
  csak kiválasztott utolsó szetteket ír. A Mezo meglévő readiness, fájdalom- és recovery-jelzései
  maradjanak elsődlegesek (PDF 8–9., 12–13.; [Train](../../features/train.md)).
- **Nem új táplálkozási konstansok egy az egyben**: a könyv tömegelési/diétás és fehérje-
  sávjai (PDF 28., 38–40.) nem helyettesítik a [Goal Engine](../../features/goal-engine.md)
  adaptív energia-, trend- és guard-logikáját. Szakirodalmi ellenőrzés és termékdöntés kellene.
- **Nem izomépülést „bizonyító” fájdalom, fotó vagy 1RM**: a könyv szerint az izomláz nem
  megbízható mérőszám; a progresszfotó ritka és érzékeny adat; a program 8–15 körüli ismétlési
  tartományban nézi a teljesítményt (PDF 27., 48.).
- **Nem cardio- vagy supplement-javaslat a könyv alapján**: a PDF itt testépítői nézőpontot,
  egyszerűsítéseket és a táplálkozási appnál érdekeltséget is közöl (PDF 38., 41., 43., 49.).

## Javasolt fejlesztési sorrend Claude-nak

1. **Kezdő útvonal termékterv.** Meghatározni, kinek ajánlható (edzésmúlt, heti idő,
   felszerelés, cél, kímélendő régió), hogyan illeszkedik a meglévő 4–8 hetes generátorhoz,
   és a 12 hetes út két külön mezociklus, egy terv két blokkja vagy új programszint legyen-e.
   A választás előtt a [Train §4](../../features/train.md) generátort, volumenmotort és
   [programtervezési kutatást](../concepts/program-design-rules.md) át kell olvasni.
2. **Előírás és progresszió.** A jelenlegi szettmodellben igazolni a „minden sor a sáv tetején”
   szabályt, a korai/utolsó szett külön célját, a könnyű átvezető heteket és a technikai bukás
   feltételeit. A döntésekhez célzott tesztesetek: kezdő első hét, 3. hét, 6. hét,
   7. heti kiválasztott utolsó szett, fájdalmas nap, eszközcsere, kihagyott hét.
3. **Gyakorlat-ontológia és csere.** A PDF 30–36. oldalának mozgásmintáit összevetni a 166-os
   master-katalógussal; azonos/közeli/hiányzó variánsokat megjelölni. Csereajánlás előtt
   meghatározni a metaadat szerkesztési, forrás- és magyarázati szabályait; a meglévő
   direkt-szett számolást csak külön döntéssel szabad megváltoztatni.
4. **Felülvizsgálat és ütemezés.** Az edzés- és testsúlyadatból már rendelkezésre álló jelekkel
   egy rövid, bizonytalanságot mutató blokkértékelést tervezni. A fotó és a gördülő 5 alkalmas
   menetrend külön, opcionális döntés legyen a felhasználói adatkezelési és naptárhatás miatt.

## Tisztázandó termékdöntések, nem technikai részletkérdések

| Kérdés az ownernek | Miért fontos |
|---|---|
| Legyen-e a **kezdő izomépítő útvonal** külön, ajánlható opció, vagy a meglévő tervgenerátor fokozatosabb beállítása? | Meghatározza a felhasználó által látott választást és a 12 hetes fogalom szerepét. |
| Az 5 alkalmas programot 4 szabad napnál **gördülően** folytassuk, vagy generáljunk valódi 4 napos tervet? | A naptár és a heti terhelés értelmezése eltér. |
| A progresszfotó legyen-e része az értékelésnek, vagy maradjon kizárólag napló/teljesítmény/súlytrend? | Érzékeny, opcionális felhasználói adat és új felület. |

## Átadási mondat

Nyitott tervezési ügy: **mezo-py3uz**. Ez a kutatás nem fogad el termékirányt és nem ír elő
implementációt.

„Olvasd el ezt a digestet, a [forrásjegyzetet](../raw/articles/2026-11-17-bodybuilding-transformation-beginner-extraction.md)
és a [Train](../../features/train.md) jelenlegi dokumentációját. Készíts jóváhagyásra egy
kezdő izomépítő útvonal terméktervet, amely a meglévő motort használja, külön jelöli a PDF-ből
származó állításokat, a saját Mezo-döntéseket és a hiányzó programlapok miatt nem tudható
adatokat. Először az ownernek látható viselkedést döntsétek el; csak azután készüljön
kattintható prototípus és implementációs terv.”
