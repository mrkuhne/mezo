# Boop fejlesztési playbook

> Hogyan építünk Boopot (iPhone + Watch app és a szervere) **gyorsan, jó minőségben és tokentakarékosan**.
> A munkamenet skill része: a gép a feladat típusához tartozó fejezetet olvassa el, nem az egészet.
> Tulajdonos: a termékgazda. Utolsó frissítés: 2026-11-27 (mezo-g641l).

---

## 0. Az alapelvek (minden feladatra)

| Elv | Mit jelent a gyakorlatban |
|---|---|
| **Egy feladat, egy session** | Minden munka friss sessionben indul, és lezárással ér véget: beolvasztás, jelentés, archiválás. Ami nem fér bele, azt **szeletekre** bontjuk (5. fejezet). |
| **Az emlékezet a jegyben van, nem a chatben** | A haladás, a döntések és a csapdák a jegyben és a tervben élnek. Így bármelyik új session 2 perc alatt felveszi a fonalat. |
| **Előbb felderítés, aztán építés** | Új képernyő, új technika vagy gyanús hiba előtt egy olcsó kutató megnézi, hogyan csinálják ma a legjobbak (8. fejezet). |
| **A UX/UI az első szempont** | Nem elég, ha működik: szépnek, gyorsnak és egyértelműnek kell lennie, minden állapotában (9. fejezet). |
| **A teljesítmény mérhető** | Gyors indulás, akadásmentes görgetés, offline is használható, kíméli az akkut (9. fejezet). |
| **Takarékos gép** | Olcsó modell a mellékmunkára, szűk olvasás, a Notion egyszer frissül, és a gép magától szól, ha a session túl nagy lett (10. fejezet). |

**Hol kell a te jóváhagyásod:** legfeljebb három ponton, és csak ha látható változásról van szó:
① a leírásnál (mit építünk), ② a szimulátoros próbaváltozatnál (hogy néz ki), ③ a tervnél (hogyan, mikor kész).
Utána a gép nem kérdez újra, hanem végigviszi a munkát a telefonra telepítésig. Csak akkor áll meg, ha egy akadály
megváltoztatná azt, amit látni fogsz.

**Bármilyen projekten?** Az alapelvek, a menet (kezdés → ötletelés → terv → építés → ellenőrzés → lezárás), az
átadás és a takarékossági szabályok bárhol működnek. Ami csak a Mezo/Boop sajátja: a Notion-tér, a Napkelte
dizájn, a szimulátoros kapu és a feladatkezelő részletei.

---

## 1. Melyik fejezet kell? (feladattípus-választó)

| Ha ezt mondod… | Típus | Fejezet | A te OK-d |
|---|---|---|---|
| „ez a felirat rossz”, „kicsit nagyobb legyen” | Apróság | 2 | nem kell |
| „nem működik X”, „összeomlik”, „rossz számot mutat” | Hibajavítás | 3 | csak ha a javítás látható változást hoz |
| „kéne egy képernyő…”, „szebb legyen az Étel oldal” | Új képernyő / UI-munka | 4 | ① ② ③ |
| „építsük meg a B7-et”, bármi, ami több nap | Nagy szelet | 5 | ① ② ③ egyszer, az egész szeletre |
| „a szerver tudja, de az app nem mutatja” | Szerverfunkció az appba | 6 | ③ (és ② ha látszik) |
| „nézd meg, hogy csinálják mások” | Felderítés | 7 | a végén döntés |
| „takarítsuk ki”, „gyorsítsuk fel” | Karbantartás / gyorsítás | 7b | nem kell, ha semmi nem változik a képernyőn |

---

## 2. Apróság (szöveg, szín, térköz, egy gomb)

**Cél:** 1 session, kevés lépés, nincs ceremónia.

1. Jegy (ha nincs) → a gép megkeresi a pontos helyet (szűk keresés, nem végigolvasás).
2. Javítás a Napkelte-készlet elemeivel, nem egyedi megoldással.
3. Szimulátor-képernyőkép a legkisebb iPhone-on is → app-tesztek → beolvasztás → telepítés.
4. Jelentés egy-két mondatban, a képernyőképpel.

**Kész, ha:** a változás látszik a telefonon, és semmi más nem változott.
**Takarékosság:** nincs ötletelés, nincs felderítés, nincs alügynök.

---

## 3. Hibajavítás

**Cél:** a hiba **oka** legyen meg, ne csak a tünete, és soha ne jöjjön vissza.

1. **Megismétlés:** a gép előidézi a hibát a szimulátorban, vagy a valódi adatokon (az éles adatbázist csak
   olvassa, sosem írja engedély nélkül).
2. **Okkeresés** (`systematic-debugging`): hipotézis → bizonyíték. Ha a hiba platform-szagú (iOS-viselkedés,
   egy keretrendszer furcsasága), előbb gyors felderítés (8. fejezet): ismert hiba-e, van-e rá hivatalos megoldás.
3. **Előbb egy elbukó teszt**, ami megfogja a hibát → javítás → a teszt zöld.
4. **Rokon helyek:** ugyanez a minta máshol is elő tud jönni? Ha igen, ott is javítás, vagy új jegy.
5. Beolvasztás → (szerverhiba esetén) élesítés → telepítés → **élő ellenőrzés a telefonon**.
6. Jelentés: mi volt a baj, mi az oka, mit láthatsz most, mi a garancia, hogy nem jön vissza.

**Kész, ha:** a hiba a telefonon nem jön elő, van rá teszt, és az ok le van írva a jegyben.
**Takarékosság:** az okkeresés a fő sessionben fut, rövid és célzott lépésekben. A hosszú naplókból csak a releváns
sorokat olvassa ki.

---

## 4. Új képernyő / UI-munka

**Cél:** **világszínvonalú, modern iPhone-élmény** a Napkelte világban, nem csak egy működő képernyő.

1. **Kezdés:** jegy, „Kész, ha…” lista, a terület emlékei.
2. **Felderítés** (kötelező, 8. fejezet): mit ír erről most az Apple dizájn-útmutatója, milyen friss
   iOS-lehetőség van rá (például új animációk, widgetek, Live Activity, interaktív elemek), és hogyan oldják meg a
   kategória legjobb appjai. Kimenet: egy oldal, linkekkel.
3. **Ötletelés veled**, magyarul, egyszerre egy kérdés. 2–3 irány, ajánlással → **① leírás OK**.
4. **Szimulátoros próbaváltozat:** egy eldobható változat a valódi Napkelte-elemekből, képernyőképekkel:
   üres, töltődik, hiba, offline, legkisebb iPhone, csökkentett mozgás, nagy betűméret → **② OK**.
   A képi iterálás csak itt történik, weboldalon soha.
5. **Terv** a „Kész, ha…” listával → **③ OK**.
6. **Építés egy sessionben:** a logikához előbb tesztek, a képernyők a jóváhagyott próbaváltozat alapján épülnek.
7. **Ellenőrzés a 9. fejezet mércéjével** (UX/UI + teljesítmény), majd egy friss szemű átnézés a legerősebb modellel.
8. Lezárás: beolvasztás → telepítés a telefonra → végigjárás → jelentés képekkel → Notion egyszer → archiválás.

**Kész, ha:** a telefonon pontosan a jóváhagyott próbaváltozat látszik, minden állapotban, akadás nélkül.

---

## 5. Nagy szelet (B6, B7, B8 méretű munkák)

**A gond, amit megoldunk:** a B6/B7 sessionök 5–8 napig futottak, és egyenként 500 millió token fölé nőttek, mert
egyetlen beszélgetés vitte az egészet. Mostantól **a munka hosszú, a sessionök rövidek.**

### 5.1 Szelet-térkép (egyszer, az elején)
1. Ötletelés + felderítés az egész szeletre → ① leírás → ② próbaváltozat → ③ **szelet-terv**.
2. A terv **lépésekre** bontja a munkát. Minden lépés:
   - **egy session alatt kész** (ökölszabály: legfeljebb kb. 60–70 gépi lépés, mert ennyi fér a 250 ezres határig;
     egy beolvasztható egység);
   - saját jegy az epic alatt, saját „Kész, ha…” listával;
   - lehetőleg önállóan is értelmes eredmény (például „a szerver tudja”, „a képernyő üresen megjelenik”,
     „a kísérlet lap kész”).
3. A sorrend és a függőségek a jegyekben vannak, nem a chatben.

### 5.2 Egy lépés menete (minden lépés friss sessionben)
1. **Kezdés:** a gép elolvassa az előző lépés **átadó jegyzetét** és a szelet-tervből a **saját lépését**, mást nem.
2. Építés → ellenőrzés → beolvasztás. A lépések rendszerint a fő ágba kerülnek; a még be nem kapcsolt részek
   kapcsoló mögött várnak, így nem gyűlik egy hatalmas, kockázatos ág.
3. **Átadó jegyzet** a következő lépés jegyébe (5.4) → lezárás → archiválás.
4. A következő lépés új sessionben indul, **leválasztva**: a régi azonnal bezár, nem várja meg és nem figyeli.
   A te jóváhagyásod nem kell hozzá: a ③ terv már lefedi. Ha már csak a lezárás van hátra (kb. 25 lépés vagy
   kevesebb), nincs átadás: a session maga fejezi be.
5. A Notion a **sorozat végén egyszer** frissül, nem lépésenként.

### 5.3 Párhuzamosság
- Két session csak akkor fut egyszerre, ha **nem nyúlnak ugyanahhoz a fájlhoz** (például az egyik a szerveren,
  a másik egy másik képernyőn dolgozik).
- **Nincs hosszan élő „karmester” session.** A szervezés a jegyekben és a tervben él. A karmester-sessionök
  hízottak a legjobban, és archiválni sem lehetett őket, amíg egy gyerekük félkész volt.

### 5.4 Az átadás sablonja (jegy-jegyzetbe, nem chatbe)
```
Ág: feat/…            Állapot: X/Y lépés kész, utolsó commit …
Kész: (3–5 pont)
Következő: (a pontos első lépés)
Döntések: (ami a tervhez képest változott, és miért)
Csapdák: (amit nehezen tanultunk meg)
Parancsok: (a tesztek és a futtatás pontos parancsai)
```
Az új session indító üzenete ennyi: *„Folytasd a <jegy> munkát a <ág> ágról. Előbb olvasd el a jegy
jegyzetét. A munkamenet skill szerint zárd le.”*

**Soha:** egy hosszú chat „lemásolása” (fork), vagy annak reménye, hogy a tömörítés majd megoldja.
A tömörítés nem átadás: elveszíti a részleteket, és drága marad.

---

## 6. Szerverfunkció az appba (a szerver tudja, az app nem)

1. Kezdés: a funkció sora a „Szerverfunkciók” táblában → a meglévő szerverfelület felderítése (célzott olvasás,
   a kódtérképből indulva).
2. Ha a szervert módosítani kell: előbb a szerződés (a végpont leírása), utána a tesztek, csak aztán a kód. Az
   architektúra-teszt is fut.
3. Az app oldala a 4. fejezet szerint, ha új képernyő kell; ha csak adat kerül egy meglévő képernyőre, a 2. szerint.
4. **Offline és gyorsítótár:** az app azonnal mutassa az utolsó ismert adatot, és a háttérben frissítsen.
5. Élesítés → ellenőrzés, hogy az éles verzió fut → telepítés → élő ellenőrzés → a tábla sorának frissítése.

---

## 7. Felderítés (önálló kutatási feladat)

1. Egy olcsó kutató ügynök, **egy kérdéssel** és kerettel: legfeljebb kb. 10 forrás, egyoldalas jelentés.
2. Források rangsora: Apple hivatalos dokumentáció és az idei fejlesztői konferencia anyagai → Apple dizájn-útmutató
   → elismert szakmai blogok és fórumok → a kategória legjobb appjai.
   Mindig a **legfrissebb** állapotot keresi, és jelzi, ha valami egy újabb iOS-verziót igényel.
3. Kimenet: a jegybe vagy a kutatási tudástárba (`docs/research/`), hogy legközelebb ne kelljen újra keresni.
4. A végén döntés neked, a szokásos szerkezetben (helyzet, gond, lehetőségek, ajánlás).

### 7b. Karbantartás / gyorsítás
1. Előbb mérés (mi lassú, mennyire), csak utána módosítás. A végén újramérés, előtte-utána számokkal.
2. Ha semmi nem változik a képernyőn, nem kell a jóváhagyásod. A jelentés a mért javulást mondja el.

---

## 8. Felderítés minden építés előtt (a „scout”)

| Mikor | Mit keres | Mennyi |
|---|---|---|
| Új képernyő vagy új interakció | Apple dizájn-útmutató, friss iOS-lehetőségek, 3–5 kiváló app megoldása | 1 kutató, kb. 10 forrás |
| Új technika (értesítés, widget, Watch, egészségadat, háttérfrissítés) | a hivatalos, legújabb módszer; a régi, elavult megoldások elkerülése | 1 kutató |
| Platform-szagú hiba | ismert hiba-e, van-e hivatalos javítás vagy kerülőút | gyors, 3–5 forrás |
| Teljesítménygond | az Apple ajánlott mérési és optimalizálási módszere | gyors |

- A felderítést mindig **olcsó modell** végzi, a háttérben, a munkával párhuzamosan.
- Eredménye kötelező fejezet a leírásban (*Prior art*, vagyis „így csinálják mások”), hogy lásd, honnan jön az ötlet.
- Ha a legfrissebb megoldás újabb iOS-t kíván, mint amit az app támogat, a gép szól, és felajánl egy tartalék
  megoldást a régebbi rendszerre.

---

## 9. A minőségi mérce: UX/UI és teljesítmény

### UX/UI — minden képernyőn, minden alkalommal
- **Napkelte világ:** sötét üveg, festett ég, színt csak az ég és a gömbök kapnak, a kiválasztott gömb lencse.
  A közös elemkészletből építünk, nem egyedileg.
- **Soha nem puritán szöveg + lista** (tulajdonos, 2026-11-26, `mezo-r36n9.177`): minden oldalnak legyen vizuális
  rangsora és saját grafikája — üvegkártyák, a dolog alakját mutató mini-grafikon (hetek íve, gyűrű, izomtérkép,
  idősáv), egy kiemelt „hős” elem felül, lapozható kártyasorok. **A „kevés kártya, sok egymondatos tény” irány
  végleg kivezetve** (tulajdonos, 2026-11-27, `mezo-r36n9.184`, #119): újratervezéskor soha ne javasold újra. Egy csupa-sor lista csak keresés- vagy
  beállításszerű oldalon elfogadható. A próbaváltozat első köre is így készül, nem utólag szépítve.
- **Előbb megnézi, aztán dönt:** amit elindíthat vagy felülírhat (sablon, terv, mezociklus), azt előbb meg tudja
  nyitni átnézésre, és a döntés gombjai (Indítás · Szerkesztés) ott vannak alul — koppintás soha nem indít el
  azonnal semmit.
- **Minden állapot megtervezve:** üres, töltődik, hiba, offline, első használat, sok adat.
- **Egy pillantás alatt érthető:** egy fő cselekvés képernyőnként, egyhüvelykujjas elérés, legalább ujjnyi
  érintési felület.
- **Élő és finom:** értelmes animáció, rezgés-visszajelzés ott, ahol segít; csökkentett mozgás beállításnál
  nyugodt változat.
- **Mindenkinek:** nagy betűméretnél sem esik szét, felolvasóval is használható, elég a kontraszt.
- **Szöveg:** magyar, emberi, szakzsargon nélkül. Soha nincs emoji, és sosem jelenik meg a „Mezo” szó.
- **Legkisebb iPhone-on is** hibátlan, és a Watch-on is, ha érinti.

### Teljesítmény — mérve, nem érzésre
- **Azonnali kép:** a képernyő a tárolt adattal azonnal megjelenik, a friss adat a háttérből jön.
- **Akadásmentes görgetés és animáció**, nehéz képernyőnél műszeres méréssel ellenőrizve.
- **Gyors indulás:** semmi nehéz munka az app indulásakor.
- **Takarékos:** kevés hálózati hívás, nincs fölösleges háttérmunka, kíméli az akkut.
- **Offline:** a fő dolgok net nélkül is mennek, és a változások később szinkronizálódnak.

---

## 10. Takarékossági szabályok (a gépnek)

| Szabály | Miért |
|---|---|
| Egy feladat, egy session. 250 ezer token (kb. 60–70 lépés) felett átadás. | Minden lépés újraolvassa a teljes beszélgetést. |
| Ha legfeljebb kb. 25 lépés van hátra, helyben kell befejezni | Egy új session elindítása ennél többe kerül. |
| Átadás: egy utód, azonnal leválasztva, a régi bezár | A várakozó „szülő” sessionök vitték a friss fogyasztás kb. 12%-át (2026-11-27). |
| A figyelmeztetésre a következő biztonságos pontnál lezárás vagy átadás | Az automatikus őr szól, nem kell rá emlékezni. |
| Az alügynökök olcsó modellen futnak; a drága csak a végső átnézésre és a nehéz tervezésre | A nagy sessionökben az alügynökök vitték a tokenek felét. |
| Végrehajtás alapból egy sessionben; alügynök-sor csak nagy, független részekre | A soros alügynökök (feladatonként építő és ellenőrző) a legdrágábbak. |
| Szűk olvasás: célzott keresés, csak a kellő sorok; hosszú kimenetből csak a vége | A nagy fájlok és naplók a beszélgetésben ragadnak. |
| A Notion egy munkasorozat végén egyszer frissül, egyszerre csak egy frissítés, kis munkással | A beszélgetésen belüli hívások a tokenek kb. 10%-át vitték; a párhuzamos frissítések dupla sorokat gyártottak. |
| Emlékek: célzott keresés a területre, nem a teljes lista | A teljes emléklista minden lépésben ott ült. |
| Heti takarítás („takarítás”) | Ne maradjanak félkész vagy elfelejtett sessionök. |

---

## 11. Hogyan kérj munkát (a te oldalad)

- **Új munka:** „csináljuk X-et”. A gép eldönti a típust, és jelzi, ha új sessionben indítja.
- **Folytatás:** „folytasd a B7-et”. A jegyből és a tervből veszi fel a fonalat, nem a régi chatből.
- **Vége:** „zárjuk le”. Beolvasztás, telepítés, jelentés, archiválás.
- **Rend:** „takarítás”, hetente egyszer.
- **Ha valami túl drágának tűnik:** „mennyit fogyasztottunk?”. A gép ugyanúgy megméri, mint 2026-11-25-én.
