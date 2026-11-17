---
title: "The Muscle Ladder → mezo: edzésrendszer-kutatási digest"
type: query
updated: 2026-11-17
tags: [train, technique]
related:
  - ../concepts/program-design-rules.md
  - ../concepts/set-volume-landmarks.md
  - ../../features/train.md
  - ../../features/fuel.md
  - ../../features/goal-engine.md
sources:
  - raw/books/jeff-nippard-muscle-ladder-source.md
confidence: medium
contradictions: []
---

# The Muscle Ladder → mezo

**Cél:** a Jeff Nippard-féle *The Muscle Ladder* (2024) fejlesztéshez használható, saját szavas kivonata. [Forrásrekord és a PDF-oldalak térképe](../raw/books/jeff-nippard-muscle-ladder-source.md). A „PDF 318” hivatkozás a felhasználó eredeti PDF-jének 1-től számozott **fizikai oldalát** jelenti. A mezo-állapot a [Train élő leírásának](../../features/train.md) 2026-11-17-i állapotából és a jelzett kódhelyekből származik.

**Olvasási kulcs:** **K** = a könyv állítása vagy a szerző gyakorlati ajánlása; **M** = ma létező mezo-képesség; **J** = javasolt termékirány, amelyhez külön termékdöntés és tervezés kell. A K nem önmagában bizonyított, általános szabály. A könyv egy szerző szintézise; ahol konkrét határértékből algoritmus lenne, az eredeti kutatást is ellenőrizni kell.

## 1. Vezérelv: először működő szokás, aztán optimalizálás

**K:** a program tarthatósága és az edző gondolkodásmódja az összes többi edzésváltozó alapja. A könyv sorrendje: technika → gyakorlatválasztás → megfelelő erőfeszítés → mérhető fejlődés → volumen → gyakoriság/felosztás → ismétlés/terhelés → pihenő → haladó módszerek → periodizáció. A sorrend nem tudományos rangsor minden emberre, hanem döntési segédlet. PDF 12–17, 85–98.

**J:** a tervajánló előbb kérdezze meg a heti reális időt, elérhető napokat, felszerelést, élvezett/kerülendő mozgásokat és tapasztalatot; csak utána optimalizáljon izomcsoportonkénti volument. A kezdőnek érthető 2–3 napos alap, a haladónak testre szabott volumen és variáció legyen. Ugyanaz a terv maradjon szerkeszthető; a kihagyás és a könnyítés ne jelenjen meg erkölcsi kudarcként. A szöveghangra a könyv PDF 91–98 különösen jó forrás.

## 2. Könyvi elvek → mai állapot → fejlesztési rés

| Téma | K: könyv, PDF-oldal | M: mezo ma | J: mit vizsgáljunk? |
|---|---|---|---|
| Tervválasztás | 20 **példa** 2–6 edzésnapra, rövid és hosszabb edzésekre; full body, upper/lower, PPL/hibrid (538–587). A legjobb felosztás az, amelyikkel tartható a szükséges munka és regeneráció (398). | A generátor napok számából rögzített felosztást képez; 2–3 full body, 4 upper/lower, 5 hibrid, 6 PPL. Bemenete napok + hetek + izomprioritás + szabad célmondat; nincs explicit időkeret/felszerelés/edzettségi szint ([Train §4](../../features/train.md)). | A felosztást több életképes jelöltből ajánlani, előre becsült idővel és felhasználói választással. A könyv kész edzésterveit ne másoljuk. |
| Gyakorlatválasztás | Hat alap mozgásminta (guggolás, csípőhajlítás, függőleges/vízszintes nyomás és húzás), majd izoláció az egyéni hiányokra. Nincs mindenkinek kötelező konkrét gyakorlat; fájdalom, élvezet, hozzáférés számít (247–265, 297–303). | Közös katalógus és edzés közbeni csere van. A master rekord ma `muscle/type/stim/fatigue` mezőkből indul; a generátor katalógusjelöltekből tölt csoportonként ([ExerciseCatalogEntity](../../../backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/ExerciseCatalogEntity.java), [Train §4](../../features/train.md)). | A katalógushoz mozgásminta, felszerelés, primer/szekunder izmok, technikai és regenerációs igény, helyettesíthetőség, egyéni preferencia jelölés. A „melyik a legjobb gyakorlat?” helyett „melyik illik hozzád és a tervréshez?” |
| Technikatanulás | Kontrollált negatív szakasz, személyhez illő, **összehasonlítható** mozgástartomány; a nagyobb súly nem valódi fejlődés, ha közben a ROM rövidül (100–105). A könyv 109–244 között gyakorlati bemutatókat tartalmaz. | A katalógushoz két állókép és videó kapcsolható; a napló terhelést/ismétlést/RIR-t tud. | Rövid, saját gyártású mozgásminta- és gyakorlati támpontok; opcionális „ma szándékosan más ROM” jelzés, hogy a rendszer ne ünnepeljen hamis rekordot. Nem szükséges számítógépes formaminősítés. |
| Erőfeszítés | A munkaszettek többsége kb. 0–3 RIR; a nagy, nehéz alapgyakorlatokat a szerző többnyire 2–4 RIR-re, az izolációkat közelebb a bukáshoz teszi. Az RIR becslés tanult, zajos készség (314–324). | A generált terv célja általában **RIR 1** minden gyakorlatra; a felhasználó naplózza a tényleges RIR-t, a readiness könnyítést ajánlhat ([Train §4](../../features/train.md)). | Gyakorlat- és szettfüggő **tartomány**, nem egyetlen RIR; óvatos kalibrálás időnként, kényszerített bukás nélkül. A kijelzés kezelje az önbecslés bizonytalanságát. |
| Progresszió | Súly, ismétlés, néha szett, technikai minőség; a kettős progresszió alapminta. Napi teljesítményingadozás normális, egy rossz nap nem stagnálás (331–349, 84, 413–417). | RIR-érzékeny kettős progresszió és gépsúlylépcső-memória van; a heti volumen a lezárt teljesítményből lép tovább, megtart vagy deloadol ([Train §4](../../features/train.md)). | Előbb **audit**, utána a valódi hiányok: többhetes trend, egyszeri rossz nap és valódi plató különválasztása; indoklás arról, miért súly/ismétlés/tartás lett a javaslat. Ne követeljünk minden héten rekordot. |
| Munkavolumen | A heti „kemény” munkaszettek praktikus egység; bemelegítő nem számít. ~10 szett/izom/hét kezdő kiindulás, sok középhaladónál 10–20, de nagy egyéni és izomközi eltérés; a 8.1. tábla becsült sávokat ad, karra a **direkt izolációs** szetteket számolja (354–365). Volumen, erőfeszítés és gyakoriság együtt számít (371). | RP-alapú rögzített MEV/MAV/MRV táblák, izomprioritásos heti ramp, FE tervezési sávok; a direkt szettek számítása és a napos cap már létezik ([Train §4](../../features/train.md)). | Az alapértékek legyenek **kiinduló hipotézisek**, személyes válasz alapján állítható sávok. Definiáljuk egységesen: munkaszett, direkt/indirekt terhelés, szett stílusa, heti és napi korlát. |
| Gyakoriság | Azonos volumen mellett a magasabb gyakoriság önmagában nem egyértelműen több izmot épít; fő haszna a volumen elosztása és a minőségi szettek megtartása (374–385, 398). | A generátor minden izomcsoportot **legalább heti kétszer** érint, a tervezési cap frekvencianövelést sugall. | A 2× legyen jó alapértelmezés, **ne abszolút feltétel**. Ha 1× tartható és a volumen/munkaminőség rendben van, ajánlhassuk. |
| Ismétléstartomány | Izomépítés sok terheléssel lehetséges megfelelő erőfeszítéssel; a szerző praktikus fő sávja 6–15 ismétlés, több szett itt, kisebb rész 1–5 és 15–30 között. Erőcélhoz több alacsony ismétlés kell (400–412). | A generátor compound 8–10, izoláció 12–15; a korábbi kutatási lapunk 25/50/25 nehéz/közepes/könnyű elosztást ír ([program-design-rules](../concepts/program-design-rules.md)). | Ne hardcode-oljunk univerzális százalékos mixet. Cél, gyakorlat, élvezet és időkeret alapján válasszunk rep-sávot; a két forrás eltérő kategóriáit előbb egyeztessük. |
| Pihenő és idő | A szerző kb. 1–2 perc izolációra, 2–3 perc könnyebb compoundra, 3–5 perc nehéz compoundra ad **rugalmas** kiindulást; azonos izmot fárasztó szuperszettet kerüli, antagonista pár időt spórolhat (426–433). | Szettközi timer 150 mp minden compoundra és 90 mp másra; külön edzésidő-becslés és tanuló időprofil már van ([Train §9](../../features/train.md)). | Katalógus-/receptfüggő alap pihenő és felhasználói korrekció; az időbecslés ugyanazt használja. Az első körben mérjük, mikor csökken a következő szett teljesítménye, mielőtt a timer „túl kevés pihenést” minősít. |
| Deload és élethelyzet | A meso tipikusan néhány hét építés + könnyebb hét. A deload lehet tervezett vagy fáradtság alapján; a szerző 4–12 hetes szórást és kb. 30–50% volumencsökkentést ír, nem univerzális ciklushosszt (471, 480–484). | 4–8 hetes generált meso, fázisgörbe és automatikus heti set-ramp; check-in könnyítés, kihagyás és betegség utáni visszatérés is van ([Train §2/§4](../../features/train.md)). | Vizsgáljuk, melyik deload **felajánlás**, melyik automatikus szabály. A munka, alvás, sport és életszakasz tervezésnél legyen kontextus, de ne „diagnózis”. |
| Haladó eszközök | Drop set, myo-rep, hosszú izomhosszon részismétlés stb. kiegészítő, főként tapasztalt és stagnáló edzőnek; magas fáradtság, vegyes bizonyíték (436–457). | A jelenlegi generált terv alapmódszereket használ. | Későbbi, önkéntes modul; ne legyen kezdő-alap és ne írja felül a normál munkaszett/volumen napló jelentését. |
| Táplálkozás és sport | Energia- és fehérjebevitel **tartomány**, testsúlytrend és edzésjelzés együtt; meal timing másodlagos. Kardió általában összeegyeztethető az erősítéssel, a sok intenzív futás zavarhatja a lábedzést (491–529). | Fuel, célmotor, testsúlytrend, sport/futás és Train keresztterhelés már létezik ([Fuel](../../features/fuel.md), [Goal engine](../../features/goal-engine.md), [Train](../../features/train.md)). | Csak egy külön, forrásellenőrzött kutatási kör után módosítsunk kalória-/fehérjekalkulátort. Előbb az edzés és sport naptárban jelezzünk ütközést, rugalmas felhasználói döntéssel. |

## 3. A legnagyobb érték: ajánló, amely indokol és tanul

**Javasolt ajánlási lánc (hipotézis, nem jóváhagyott terv):**

1. **Cél és helyzet:** elsődleges cél (izom, erő, időhatékony fenntartás, sporttal együtt), edzettség, reális napok/perc, felszerelés, preferenciák, meglévő sport, ismert fájdalom/korlát. K: PDF 20–29, 53–64, 247–253, 538–541.
2. **Heti váz:** 2–3 életképes felosztásjelölt ugyanarra a célra; mindegyikhez várható idő, izomérintés, pihenőnapok és szerkeszthetőség. A jelöltindoklásban ne legyen „tudományosan legjobb” címke. K: PDF 372–399.
3. **Gyakorlatok:** mozgásminta-lefedés + célizom + elérhető felszerelés + egyéni jó/rossz tapasztalat + váltási lehetőség. Stabil alapmozgások, szándékos, nem véletlenszerű variáció. K: PDF 253–265, 290–303, 348–349.
4. **Adagolás:** kezdő sáv → tényleges munkaszett/RIR/idő napló → trend → kis, indokolt korrekció. A volumendöntést ne egyetlen rossz edzés, becsült RIR vagy súlymérés hozza. K: PDF 84, 314–324, 354–371.
5. **Következő hét:** javasolt változás + bizonyíték + választás („marad”, „könnyebb”, „áttervezem”); minden tervváltozás naplózható és visszavonható. K: PDF 91–98, 331–349, 480–484.

**Ma már megvan az alap:** meso-sablon/futam, felhasználói gyakorlatswap, set napló, RIR és overload, heti izomvolumen, célprioritás, readiness, visszatérés, időbecslés, valós edzésidő, Fuel/sport integráció. Ezért **ne új edzésmotort írjunk a könyvből**: a [meglévő láncot](../../features/train.md) kell termékoldalon és adatszinten finomítani. A 15. fejezet 20 programja a szegmensek és receptmezők lefedettségét ellenőrző referencia; a pontos táblákat, képeket és szövegeket nem használjuk alkalmazástartalomként.

### Számítási szerződés, amit külön kell megtervezni

| Számítás | Meglevő adat / kiindulás | Javasolt kimenet és korlát |
|---|---|---|
| **Heti terhelés** | Tervezett és naplózott, nem bemelegítő munkaszettek; izomcsoport; cél-RIR/tényleges RIR; aktuális prioritás. A könyv a primer gyakorlathoz kb. RPE 6, kisebbekhez kb. RPE 7 felett tekint egy szettet „keménynek” (PDF 354–355). | Tervezett és tényleges dózis külön. Az alacsony erőfeszítésű szettet ne töröljük a naplóból; azt vizsgáljuk, kap-e külön „mennyire informatív” jelzést a volumenmotor. Direkt vs. indirekt izomterhelés definícióját előbb dönteni kell. |
| **Napi recept** | Gyakorlat típusa, terhelhetőség, előző szettek, cél, gyakorlatok sorrendje és pihenő. | Súly/ismétlés/**RIR-sáv**/pihenőjavaslat, becsült edzésidő és elérhető csere. A naplózott teljesítmény a javaslatot módosíthatja, de egyetlen nap nem írja át a hosszú távú célt (PDF 84, 331–338, 413–417, 428–430). |
| **Heti módosítás** | Több hét lezárt teljesítménye, tervezett/tényleges volumen, check-in, sport, kihagyás, időkorlát. | TART / kis növelés / könnyítés / felülvizsgálat **indoklással és felhasználói döntéssel**. A könyv 20%-os volumenkísérlete a több hónapos plató egyik ötlete, nem automatikus heti +20% szabály (PDF 364–368). |
| **Erő becslése** | A mezo e1RM-et vezet, 12 ismétlés fölött nem számol; a könyv a %1RM-et elsősorban nehéz alapemeléshez/erőcélhoz használja (PDF 417–423). | Hipertrofia-ajánlásnál logbook + RIR legyen a fő támpont; az e1RM becslés nem lehet általános „izomnövekedés-pontszám”. |

**Kritikus egybevezetés:** ma a tervezési sávok, a heti volumenmotor, a napi cap és az időbecslés több külön szabályrétegben élnek ([Train §4](../../features/train.md)). A későbbi implementáció előtt rögzíteni kell, melyik réteg a forrása a felhasználónak mutatott „ennyi szett/perc, ezért ezt ajánlom” számnak; ugyanarra a hétre két egymásnak ellentmondó magyarázat nem fér bele.

## 4. Ajánlott fejlesztési sorrend Claude számára

| Sorrend | Önálló döntési/fejlesztési szelet | Késznek tekinthető, ha… | Fő függőség |
|---|---|---|---|
| 0 | **Tényellenőrző audit:** jelenlegi generátor, volumentáblák, RIR, frekvencia, rep-mix és timer összevetése ezzel a digesttel. | Minden eltérésnél világos: tudatos termékdöntés, becslés vagy hibás forrásállítás; a számszerű küszöbökhöz elsődleges bizonyíték van. | Könyv PDF 314–324, 354–371, 384, 400–412, 426–433 + meglévő kutatási lapok. |
| 1 | **Ajánlási interjú és 2–3 tervjelölt:** idő, napok, edzettség, felszerelés, cél, sport és preferencia beemelése a tervválasztásba. | Azonos célból eltérő, indokolt, időbe beleférő és módosítható javaslatok születnek; a felhasználó dönt. | Termék/spec + kattintható prototípus jóváhagyása; contract-first API, Train/Goal/People. |
| 2 | **Gyakorlat-taxonómia és csere:** hat mozgásminta, felszerelés és célizom szerinti lefedés, személyes preferencia. | A csere őrzi a terv szerepét és azonosítja a megfelelő, elérhető alternatívát; a katalógus-adatok szerkesztése nem semmisíti meg a korábbi naplókat. | Katalógus + szettörténet, master-content loader, szerzői média. |
| 3 | **Célzott recept és idő:** gyakorlat-/szettfüggő RIR-sáv és pihenő, valós időkeret. | Az ajánlás és az időbecslés ugyanazokat a receptadatokat olvassa; egy könnyebb/nehéz nap nem büntetésként látszik. | Recept DTO, időbecslő, rest timer, overload. |
| 4 | **Adaptív heti felülvizsgálat:** többhetes trend, plató és regeneráció együtt; finom volumen/deload felajánlás. | A döntés forrása megjelenik, a tulaj elfogadja/módosítja, az egyszeri kilengést nem címkézzük platónak. | Volumenmotor, check-in, sport, meso riport; mérési terv. |
| Később | Haladó specializáció, szuperszettek, intenzitástechnikák. | Csak releváns tapasztalati szinten, opcionálisan, szett-/fáradtságelszámolással. | Az 0–4. szeletek alapja és külön tulajdonosi design-döntés. |

## 5. Mérési és döntési kérdések a tervezéshez

- **Siker:** tervelfogadás és utólagos módosítás; 4–8 hetes tényleges teljesítés; tervezett/valós edzésidő különbsége; visszatérés kihagyás után; gyakorlatcsere okai; edzésnaplózott teljesítménytrend és regeneráció. A testösszetétel-változás nem vezethető le biztosan a szettekből vagy néhány testsúlyadatból (K: PDF 65–84).
- **Felhasználói döntések:** mennyi kérdést enged a tervező első alkalommal; több tervjelöltet vagy egy ajánlást lát; mi legyen a fő cél (maximális izom, minimális idő, erő, sport együtt); melyik korlátnál kérünk emberi döntést ahelyett, hogy automatikusan változtatunk. Ezek a könyvből **nem** következnek.
- **Adatminőség:** a tényleges RIR szubjektív; a heti szettek jelenleg direkt izomcsoportosak; a katalógus `stim`/`fatigue` értékei nem személyes mérések; a súly × ismétlés fejlődése technikai/ROM-változással torzulhat. Ezért az ajánlás confidence-t és „miért?” magyarázatot igényel.
- **Határ:** fájdalomból/sérülésből ne diagnosztizáljon a rendszer; a már meglevő könnyítő és kihagyó utak legyenek a biztonságos termékseam. Táplálkozási számokat, kiegészítőket és kép-/videótartalmat ne emeljünk át közvetlenül a könyvből.
- **Forrásérdek:** a könyv MacroFactor-ajánlásánál a szerző tulajdonosi érdekeltséget közöl (PDF 504). Ezt nem kezeljük független termék-összehasonlításként.

## 6. Claude-indító

> Olvasd el ezt a digestet, a [forrásrekordot](../raw/books/jeff-nippard-muscle-ladder-source.md), a [Train élő dokumentációját](../../features/train.md), a [programtervezési kutatási lapot](../concepts/program-design-rules.md), majd a saját szeletedhez tartozó eredeti PDF-oldalakat. Először auditáld a jelenlegi szabályt; külön jelöld a könyvi állítást, a ma működő mezót és a javasolt termékváltozást. Kérj termékdöntést ott, ahol a felhasználó más működést látna. Kövesd a mezo design/prototípus/terv és contract-first workflow-ját. A könyv 20 kész tervét, képeit és gyakorlatleírásait ne másold az alkalmazásba.
