---
title: Mezo UX — vezetett élmény és saját vizuális karakter
type: query
updated: 2026-09-09
tags: [design, frontend, technique]
related: [../../features/_platform-design-system.md, ../../features/today.md, ../../features/insights.md, ../index.md]
sources:
  - raw/articles/2026-09-08-hevy-ux-excerpt.md
  - raw/articles/2026-09-08-strava-ux-excerpt.md
  - raw/articles/2026-09-08-yazio-ux-excerpt.md
  - raw/articles/2026-09-08-huawei-health-ux-excerpt.md
  - raw/articles/2026-09-08-nike-ntc-ux-excerpt.md
  - raw/articles/2026-09-08-bevel-ux-excerpt.md
  - raw/articles/2026-09-08-apple-design-awards-ux-excerpt.md
  - raw/articles/2026-09-08-bears-gratitude-ux-excerpt.md
  - raw/articles/2026-09-08-avatar-lab-ux-excerpt.md
confidence: medium
contradictions: []
---

# Mezo UX — vezetett élmény és saját vizuális karakter

Driver: **mezo-88jw.1**. Kutatási kiindulópont és megvitatandó javaslatok, **nem elfogadott design**.
Daniel szerint az információtartalom alapvetően megfelelő, de a felület csempés, nehezen bejárható,
a fejléc zsúfolt, a visszalépés kiszámíthatatlan, a prémium érzet és a felismerhető karakter hiányzik.

## Bizonyíték és korlátok

Elsődleges termékoldalak, hivatalos használati útmutatók, Apple design-esettanulmányok és a megadott
GitHub README alapján készült. A Bevel webes képernyőbemutatóját, valamint a helyi Mezo
`/nap` → `/me` → `/me/weight` felületeit böngészőben is megvizsgáltuk, explicit mock módban.
Ez nem a versenytársak telepített appjain végzett használhatósági teszt, és nem az éles Mezo auditja.
A raw fájlok rövid, szó szerinti kivonatok; a teljes kontextushoz az alábbi eredeti linkek tartoznak.
A következtetések tervezői hipotézisek; a források nem bizonyítanak általános UX-fölényt.

## Mi magyarázza a jelenlegi érzetet?

1. **Azonos forma eltérő feladatokra.** A [Design 2.0 iteráció](../../design_2.0/2026-08-27-mezo-en-design-iterations.md)
   §1 minden új oldalra általánosította a színezett csempéket. A Nap mock nézetében az étkezés,
   célok, edzés, Életjel, víz, Stack, küldetések és check-in hasonló súlyú dobozokat kapnak.
   A víz közvetlen művelet, az edzés navigáció, az Életjel összegzés: a feladatuk különbözik.
2. **A fejléc szerepei egymásra rakódnak.** `frontend/src/app/AppLayout.tsx` a legtöbb útvonalon
   kirajzolja az `AppHeader`-t. Az a szekciót mutatja, míg a lap saját feje az oldalt.
   A Súly oldalon ezt a böngészőben is láttuk: Én fejléc → vissza/logolás sor → Napi súly hero.
   Az `AppHeader.tsx` napszakválasztója más oldalról is a Napra navigál; globálisnak látszó
   vezérlővel valójában kontextust váltunk.
3. **A termék belső szerkezete több helyen a felhasználó feladata lesz.** A Mezo hub a
   [funkcióleírás](../../features/insights.md) §10 szerint tíz belépőt kínál, köztük Memóriát.
   Megfontolandó a napi érték (segítő üzenet, felismerés, döntés) és a működés részleteinek eltérő
   hangsúlya. Az átláthatóság maradjon elérhető, de ne igényelje a motor megértését.
4. **Az assetcsalád már létezik.** A [Clay-csomag](../../design_2.0/assets/README.md) egységes
   fényirányt, ikonokat, illusztrációkat és több Orb-állapotot ír le. További assetek előtt
   azt kell meghatározni, hol milyen jelentést és viselkedést képviselnek.

**Visszalépés:** `frontend/src/shared/hooks/useBackNav.ts` már tartalmaz history-alapú visszatérést
fallbackkel, a `ScreenContent.tsx` pedig scroll-visszaállítást és a visszatéréskor belépő animáció
elnyomását. A konkrét swipe-hibát nem reprodukáltuk; a felhasználótól egy érintett útvonalat kértünk.
Ezek jelenléte nem bizonyítja, hogy minden oldal/átirányítás/sheet helyesen használja őket.

## Mit érdemes átvenni a referenciákból?

| Referencia | Forrásban megfigyelhető minta | Mezo számára javasolt alkalmazás |
|---|---|---|
| [Hevy](https://www.hevyapp.com/features/track-workouts/) | Újrahasználható rutinból indított edzés; sorozatok, előző értékek, automatikus pihenő | Az aktív feladat kapjon célzott, gyors munkafelületet; az edzés közben szükséges adatok legyenek helyben. |
| [Strava](https://support.strava.com/en-us/articles/15402077-training-log) | Heti aktivitási előzményből lehet a részletek felé haladni | Heti történet és összehasonlítható teljesítmény, fokozatos részletezés. |
| [Yazio](https://help.yazio.com/hc/en-us/articles/11804776635281-Tutorial-of-the-Yazio-app) | A napi étkezési napló a központ; elemzés és receptek külön szerepet kapnak | A Fuel napi használatának világos belépője legyen; ne kelljen a kamrán és a tervezésen át logolni. |
| [Huawei Health](https://consumer.huawei.com/en/mobileservices/health/) | Aktivitásgyűrűk és Health Clovers összefoglaló; sok egészségadat | Közös, felismerhető összegző ábra, amelyből részletek nyílnak. A csempeelrendezés ne váljon minden lap kötelező formájává. |
| [Nike Training Club](https://www.nike.com/ntc-app) | Felépített programok, edzéshez kapcsolt táplálkozási/regenerációs támogatás | Érkezés → felkészülés → végrehajtás → lezárás teljes útja; kevés, időben érkező utasítás. A Run Club termékoldalát is áttekintettük. |
| [Bevel](https://www.bevel.health/) | Strain/Sleep/Recovery hangsúly; táplálkozás, napló és személyes támogatás ugyanabban a termékben | Több terület egy közös állapotértelmezés körül; mérőszám mellé jelentés, majd következő lehetőség. |

Az [Apple Design Awards](https://developer.apple.com/design/awards/) oldalról három különösen
releváns jelölt/példa: **Tide Guide** (a témához kötött grafikonok, színek és animációk),
**The Outsiders** (terhelés/regeneráció értelmezhető vizualizációja), **Harvee**
(adatértelmezéshez kötött karakter). Ezek eltérő kategóriákban és státuszban szerepelnek;
nem nevezzük mindegyiket díjnyertesnek.
A [Bears Gratitude Apple-esettanulmánya](https://developer.apple.com/news/?id=i74v3f4r)
az illusztráció és a személyes hang összehangolását mutatja. Mezóban ennek tanulsága az,
hogy a karakter a reggeli fogadás, reflexió és lezárás része lehet.

## Három megvitatandó irány

| Irány | Karakter | Előny | Kompromisszum |
|---|---|---|---|
| Nyugodt műszerfal | Bevelhez közelebb: nagy számok, visszafogott vászon, kevés grafika | Erős adathierarchia, gyors áttekintés | Az életvezetési/társi réteg kevésbé lesz sajátos. |
| **Vezetett nap + Clay társ — ajánlott** | Levegős napi szerkesztés; az Orb néhány jelentős pillanatban vezet | Összeköti a sok funkciót a felhasználó aktuális szándékával | Jó prioritási szabályok és következetes szöveg szükséges. |
| Karakter köré épített világ | Erősebb illusztráció, jelenetek, animált átalakulások | Könnyen felismerhető márka, érzelmi jelenlét | Nagyobb art/motion teher; a rutinfeladatokat lassíthatja. |

Az ajánlott szervezőelv: **hol tartok → mi fontos most → mit tehetek → mi változott**.
Ez oldalakon átívelő ritmus, nem egy újabb kötelező kártyatípus vagy összpontszám.
A Nap rövid eligazítás; a Train/Fuel gyors munkafelület; a heti nézet értelmezés;
a napló és Napzárás nyugodt reflexió. A tipográfia, fény, színek és mozgás azonos családba köti őket.
Az öt jelenlegi fül átnevezése/átrendezése még nem eldöntött kérdés: először a valódi napi utakat
kell összehasonlítani. A gyakorlott felhasználónak maradjon közvetlen elérése.

## Vizuális és navigációs hipotézisek a következő próbához

- Az Orb köríve, puha térfogata és bal felső fénye közös motívum lehet: napív, folyamatjelző,
  diagramkiemelés és karakter egy család. A motívum csak ott jelenjen meg, ahol jelentése van.
- Csempe önálló tartalmi egységhez vagy belépőhöz; egy tartalmi egységen belül inkább tipográfia,
  térköz, sorok és diagram. Legfeljebb egy elsődleges, nagy hangsúlyú következő művelet.
- Oldalcsaládok: napi eligazítás, napló/munkafelület, részlet/elemzés, vezetett rituálé.
  Az egységesség nem igényel azonos elrendezést ezek között.
- Egy navigációs fejléc: főoldalon hely + kevés globális művelet; részletoldalon vissza + pontos
  cím + helyi művelet. A napszakválasztó a Nap tartalmához tartozzon.
- A vissza ugyanarra az előző állapotra vigyen (scroll, dátum, szűrő); egy új külső belépésnél
  legyen értelmes szülőoldal. A sheet bezárása, a főfülváltás és a részletoldal visszalépése
  külön kezelendő eset, valós iPhone PWA-n is ellenőrizve.
- Mozgás: belépéskor térbeli kapcsolat, mentéskor rövid visszajelzés, karakteren halk jelenlét.
  Visszatéréskor ne induljon újra minden számláló; csökkentett mozgásnál is érthető legyen minden állapot.

## Clay avatar és Avatar Lab

A [megadott repository](https://github.com/smontlouis/bible-strong-avatar-lab) böngészőben futó,
procedurális 2D avatar-szerkesztő. SVG geometriát, szemeket, arckifejezéseket és animációs sorokat
kezel; SVG/PNG pillanatkép, hordozható JSON és React/web futtatókörnyezet szerepel az exportok között.
Tetszőleges SVG-logó automatikus importját/animálását a README nem igazolja.
A jelenlegi kör alakú [Orb](../../design_2.0/assets/logo-orb.svg) alapján érdemes újraépíteni
egy próbatestet; a fény és az anyag azonosságát vizuálisan kell ellenőrizni.
A repo AGPL-3.0 jelölésű; a futtatókörnyezet integrációja külön értékelés, ebben a kutatásban nem döntöttünk róla.

Első próbához elég: jelen van, figyel, gondolkodik, visszajelez, elcsendesedik.
Az avatar a **társ**, a felhasználó állapotát külön ábrázoljuk; kihagyás után ne legyen csalódott vagy beteg.
Nem szükséges minden ikonból arcot készíteni. A karakter ne takarja a tartalmat, és ne foglalja el a gyorslogolás helyét.

## Hogyan válasszunk?

A következő összehasonlítás azonos adattartalmú reggeli Nap, edzésindítás és heti visszatekintés
három jelenetét mutassa. Minden irányból ugyanazt a feladatot kell tudni végrehajtani.
Akkor jó az irány, ha első pillantásra érthető, mi fontos, az elsődleges művelet keresés nélkül
elérhető, és részletezés után az ember ugyanott tudja folytatni. Új/bizonytalan adatú felhasználóval
is meg kell nézni; nem építhetjük a kompozíciót kizárólag szép, teljes demóadatokra.
Az art direction kiválasztása és a konkrét swipe-hiba reprodukciója a következő beszélgetés része.

## Boop: signature elemek az avataron túl

2026-09-09 · mezo-88jw.7 · tervezői javaslat, még nem elfogadott UI-változás.
A felhasználó megtartaná az editorial irányt és az eredeti kétszemű karaktert, de a jelenlegi
képernyők túl szövegesek. A fenti források újraolvasásából: Tide Guide esetén az Apple leírása
összeköti a vízi témát az egyedi animációkkal, diagramokkal és napszakos palettával; Huawei
felismerhető összegző ábrákat, Bevel több terület értelmezését kínálja. Ezekből saját motívumok
következhetnek, nem a referenciák megjelenésének másolása. Hivatalos weboldalak áttekintése,
nem új telepítettapp-vizsgálat. Az aktuális Apple-oldalon Tide Guide Visuals and Graphics nyertes.

Javasolt közös formai nyelv: nyitott körívek, kerek végű vonalak és kis pontok. Négy rokon elem:

- **Ritmusív:** időbeli előrehaladás. Nap: négy check-in; edzés: mezociklushetek vagy sorozatok;
  alvás: időablak. Valós sorrend és feliratok, nem egységesített egészségpontszám.
- **Kapcsolati szál:** étkezés, sport és megfigyelések közötti kapcsolat, forráspontokkal.
  Feltételezés szaggatva, rögzített adat folytonosan; a vonal önmagában nem állít okságot.
- **Öblös felület:** saját, finoman bemetszett kontúr két egymás melletti információs résszel;
  például étkezési alapkeret és sportkiegészítés. Kevés kiemelt helyen, nem minden sor körül.
- **Lenyomat:** naphoz vagy héthez tartozó kis kompozíció a rögzített eseményekből. Napló,
  heti összegzés, chatben megnyitható emlék. Nem hangulatdiagnózis, nem generikus dísz.

Mozgás: mentéskor pont érkezik a ritmusívre; sport átvezetésekor összekötő szál mutat a változó
étkezési keretre; területváltáskor ugyanaz a kontúr alakul át. Egyszeri, rövid, csökkentett mozgást
tiszteletben tartó átmenetek. Aktív sorozat vagy szövegírás alatt a háttér nyugodt.

Következő összehasonlítás: egy nap/check-in, egy edzés és egy étkezési képernyő ugyanazzal a
motívumcsaláddal. Az AI mintanézet negyedik próba a kapcsolati szálhoz. Sikerfeltétel: kevesebb
magyarázó szöveg, felismerhető azonosság eltérő kompozícióval, érthető adatok dísz nélkül is.
