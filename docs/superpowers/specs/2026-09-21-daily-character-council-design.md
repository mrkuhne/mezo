# Napi Karakter-csapat — beszélgetésekből követhető változás

2026-09-21 · Beads: **mezo-zwy6v** · Kapcsolódó döntés: [ADR 0048](../../decisions/0048-daily-character-council.md).

A termékirányt a tulajdonos a beszélgetésben elfogadta. Ez a részletes specifikáció a következő tervezési és prototípusfázis alapja; az itt leírt bővítés még nincs implementálva. A jelenleg működő rendszer leírása: [character.md](../../features/character.md).

## 1. Cél és elfogadott határok

A Karakter legyen a Mezo napi AI-életének olvasható helye: reggelre új felismerések, szakértői kommentváltások és követhető eredmények várják a felhasználót. A heti konzílium a napi szálak összegzésévé válik.

- Bővebb, görgethető fal, tetején legfeljebb három kiemelt beszélgetéssel.
- Napi előkészítés, napközbeni eseményvezérelt folytatás, heti összegzés.
- Alapból 2–3 releváns szakértő, legfeljebb három vitakör; szükség esetén más szakértő bevonása.
- Bizonyítékok eszközös ellenőrzése; kiegyensúlyozott modellválasztás, indokolt erősebb modellre váltással.
- Automatikus, látható és visszavonható profilpontosítás. Edzésterv, cél vagy rutin módosítása csak a felhasználó külön jóváhagyásával.
- A felhasználó meglévő posztokra és kommentekre válaszolhat, új posztot továbbra sem hoz létre.
- A jelenlegi Mezo megjelenési szabályai és közös UI-elemei az irányadók. A megváltozó élményhez apphű interaktív prototípus készül a felületi implementáció előtt.

## 2. Kiinduló hiányok és javításuk

Az audit a szeptember 20-i éles heti konzíliumban 11 javaslatot, 0 keresztreakciót, 7 elfogadott és 4 elvetett javaslatot talált. A jelenlegi keresztvita csak azonos témakörbe javasló különböző szakértőket kapcsol össze; havi és bootstrap futásban nincs keresztvita.

Az UP/DOWN mentés csak a bizalmi szintet módosítja. A döntési indoklás átírást vagy áthelyezést is mondhat, de az nem válik automatikusan végrehajtott műveletté. Az eltérő időszakú állítások kapcsolata nincs strukturáltan jelölve. A Szkeptikus főként javaslatot és indoklást olvas, nem ellenőriz önállóan eredeti adatokat.

Az új rendszer ezekre explicit megoldást ad: témák közötti bevonás, válaszolható kommentek, eredeti forrásokat olvasó eszközök, típusos változtatási műveletek, időbeli érvényesség és tartós utánkövetés. A bizonyítékhiány, feldolgozási hiba és költségkeret miatti halasztás külön állapot.

## 3. A reggeli fal

Az Üzenőfal / Rólad / Csapat navigáció megmarad. Az Üzenőfal tetején az „Amíg aludtál” blokk a legutóbbi látogatás óta érdemben változott szálakat emeli ki; napközbeni visszatéréskor a felirat „Mióta itt jártál”. A kiemelések az alábbi fal ugyanazon szálaira mutatnak, nincs második tartalompéldány.

A rangsorolás sorrendje: választ igénylő személyes kérdés, jelentős új vagy megváltozott következtetés, érdemi új bizonyíték vagy nézetkülönbség, frissesség. A három hely felső korlát, nem kötelező kvóta. Hosszú ideje megválaszolatlan kérdés nem foglalja örökké az első helyet: megmarad a nyitott kérdések között, új fejlemény nélkül nem számít újdonságnak.

A teljes fal érdemi aktivitás szerint rendezett és lapozható. Egy új szakértői érv, felhasználói válaszra adott reakció, ellenőrzött bizonyíték vagy eredmény hozhat előre régi szálat; egyszerű újrafogalmazás és saját megnyitás nem. Lapozás közben az új elemek jelzést kapnak, a lista nem ugrik el.

A poszt szerzőt, időt, témát és olvasható felvetést mutat. Alatta a tényleges kommentek, közvetlen válaszcélok és reakciók látszanak. Hosszabb beszélgetés néhány komment után kinyitható. Minden számláló mentett adatokból számolódik. A SUPPORT / CHALLENGE / NUANCE reakció szakmai álláspont, nem népszerűségi pont.

A „Miből látszik?” a közös GlassBoxban nyílik: eredeti forrás, pontos időszak, lefedettség, ellenőrzött számítás, adat vagy önbeszámoló megkülönböztetése. A szál eredménye külön látható: „Pontosítottuk a profilod”, „A válaszodra várunk”, „Ekkor nézzük újra”, „Javaslatod van”, „Lezártuk”.

## 4. Időzítés és témaválasztás

A napi előkészítés alapértelmezett célideje 05:15 Europe/Budapest, a 02:50-es megfigyelések után. Az időpont konfigurálható. A futás ellenőrzi a bemeneti feldolgozás állapotát és rögzíti, meddig volt elérhető adat; az időpont önmagában nem bizonyítja, hogy az előző lépések sikeresek voltak.

Ha az előfeltétel késik, a rendszer 15 percenként újraellenőrzi, és a napi munka tartós állapotból folytatható. Két lezárt nap elmaradt munkáját pótolja; régebbi nyitott kérdések és még fel nem dolgozott bizonyítékok ettől függetlenül megmaradnak. Minden napi kiadás időszaka és tényleges elkészülési ideje külön tárolódik. Appmegnyitás legfeljebb hiányzó munka sorba állítását kérheti, nem futtat szinkron teljes konzíliumot.

Jelölt témák forrásai: friss megfigyelések, konkrét új forrásadat, régi és új állítás közti eltérés, több terület együttjárása, felhasználói válasz és esedékes utánkövetés. Új kapcsolat régi adatokból is születhet, de a felhasznált bizonyíték nem kap új dátumot.

Témánként kanonikus szálazonosító és bizonyíték-ujjlenyomat akadályozza meg ugyanazon összesítés napi újraposztolását. A témaválasztás különbséget tesz új adat, új értelmezés és ismétlés között. Egy olvasási hiba nem számít adat- vagy viselkedéshiánynak.

A heti 19:30-as összegzés a napi szálakból és a még feldolgozatlan bemenetekből dolgozik. Feloldatlan ellentmondásokat, változásokat, régi hipotéziseket és a teljes profil következetességét vizsgálja. Ugyanazt a változtatást nem mentheti újra. A havi mélyolvasás és a bootstrap is ugyanazt a beszélgetési/változtatási magot használja, saját bemeneti körrel; a havi futás kihagyott esedékességet is pótol.

## 5. Beszélgetési folyamat

1. **Felvetés:** egy szakértő megnevezi az észrevételt, a konkrét kérdést és forrásait. A tématervező relevancia alapján választ 2–3 résztvevőt; nem szükséges azonos dimenzióba tartozniuk.
2. **Ellenőrzés és első reakciók:** a meghívottak az eredeti felvetésre válaszolnak, más nézőpontot adnak, adatot kérnek vagy eszközzel ellenőriznek. A részvétel indoka tárolódik.
3. **Visszaválasz:** az eredeti szerző és az érintettek megválaszolhatják a kritikát, pontosíthatnak, vagy visszavonhatják álláspontjukat. Egy további szakértő meghívható, összesen legfeljebb négy domain-résztvevővel.
4. **Lezárás:** szükség esetén még egy tisztázó kör, majd Mezo eredményt ad. Tartós profilváltozás előtt a Szkeptikus ellenőrzi a javasolt változtatást és a hivatkozott bizonyítékot. A Szkeptikus saját rendszer-önvizsgálati javaslata sem válhat független megerősítéssé saját ismételt véleményezésétől.

A három kör felső korlát; korábban is lezárható a szál. A tartalmas ellenérv nem kötelező szerepjáték: egyetértés esetén nincs mesterséges vita. A Szkeptikus és Mezo záró ellenőrzése a domain-vitakörökön felüli, külön keretezett munka.

A nyilvános komment rövid, felhasználónak szánt szakmai állítás, forrással és indoklással; nem a modell rejtett gondolatmenete. Csak ténylegesen lefutott és validált válasz jelenhet meg. Az „ellenőriztem” állításnak sikeres eszközhívásra kell mutatnia.

Felhasználói hozzászólás először tartósan mentődik. A mentett célkomment/szál, saját szerző, idő és eredeti kontextus megmarad. Ugyanazt a szálat folytatja, nem indít párhuzamos régi reply-evaluatort is. Gyors egymás utáni válaszok sorrendben, összevonható feldolgozási ablakkal jutnak a csapathoz; egyetlen válasz sem veszhet el. Lezárt szál érdemi új bemenetre új ciklussal nyitható újra, a korábbi lezárás megőrzésével.

## 6. Eszközhasználat és bizonyíték

A meglévő belső, tulajdonosra szűrt olvasóeszközöket és teljesforrás-olvasást használjuk új, párhuzamos adat-hozzáférési réteg helyett. A hozzáférhető eszközök képességeit a regisztrált katalógus határozza meg; tetszőleges SQL, URL vagy más felhasználó azonosítója nem lehet modellparaméter.

Szükséges képességek: eredeti napló/edzés/étkezés/alvás olvasása; időszakok és lefedettség összevetése; meglévő állítások és változáselőzmények olvasása; korábbi felhasználói válaszok és releváns emlékek keresése. A chat-munkamenetet feltételező eszköz kapjon megfelelő szerveroldali szálkontextust, ne kitalált conversation ID-t.

Az eszközök olvasnak; javaslatgenerálást vagy domainmódosítást mellékhatásként sem végezhetnek. A modell pontos számokat determinisztikus, mértékegységet és időablakot tartalmazó összehasonlításból kap. Lapozott vagy levágott eredményt nem tekinthet teljes korpusznak.

A bizonyítékhivatkozás tartalmazza a forrás típusát/azonosítóját, releváns változatát vagy ujjlenyomatát, eseményidejét, olvasási idejét, időablakát, lefedettségét, valamint a felhasznált kivonatot vagy számítást. Az eredeti forrásra visszavezetett azonos adat több összefoglalóban is egy bizonyítékcsalád marad. Az önbeszámoló külön jelölést kap. Törölt vagy elfelejtett forrás kivonata nem maradhat korlátlanul elérhető a komment/provenance rétegen keresztül; a meglévő adat-életciklus szabályai erre is kiterjednek.

Ellenőrizhetetlen vagy megváltozott forrás esetén a rendszer nem erősíthet automatikusan tartós állítást. Kérdés, további megfigyelés vagy elhalasztott feldolgozás lehet az eredmény. A bizonyítékokban található utasításokat adatként kezeljük.

## 7. Végrehajtható döntések és időbeli érvényesség

A modell javasolt műveletet ad; a szerver ellenőrzi és hajtja végre. Támogatott műveletek: CREATE, REVISE_TEXT, CHANGE_CONFIDENCE, MOVE_DIMENSION, MERGE, RETIRE, SET_VALIDITY. Az időbeli felülírás expliciten összekapcsolja a korábbi és új állítást; nem fizikai törlés.

Minden művelethez tartozik célzott állítás és elvárt verzió, strukturált előtte/utána állapot, indok, források és a szál lezárásának azonosítója. Új állításnak nincs előzménye; összevonás minden érintett állításra hivatkozik. Másik dimenzióba mozgatás mindkét portrét érinti. Egy összetartozó változtatáscsomag, portréfrissítés és sikeres eredménybejegyzés együtt válik láthatóvá.

Az állítás külön tárolja: milyen megfigyelési időszakból származik, mely időszakra érvényes, mikor ismertük meg, jelenleg aktív-e, és mi váltotta fel. Eltérő ablakú számok összevetése önmagában nem ellentmondás; átfedés, célérték és lefedettség ellenőrzendő. A pontos időszak nem maradhat csak a mondat szövegében.

Az eredmény szövege a ténylegesen alkalmazott műveletből készül. Nem jelenhet meg „átírtuk” csak bizalomszint-változás esetén, vagy „áthelyeztük” pusztán egy REHOME megjegyzésből. A sikertelen/no-op változtatás is őszinte állapotot kap.

A felhasználó a profilváltoztatást visszavonhatja. A visszavonás új auditált, kompenzáló változatot hoz létre. Közben történt módosítást nem ír felül vakon: a rendszer megmutatja az ütközést és a jelenlegi állapothoz alkalmazható visszaállítást. A visszautasított változtatás ugyanazzal a bizonyítékkal nem alkalmazható újra automatikusan.

## 8. Eredmények és utánkövetés

Egy szál több kapcsolódó eredményt is adhat, de mindegyiknek önálló állapota van:

| Eredmény | Következő lépés |
|---|---|
| Profilpontosítás | Előtte/utána összevetés, forrás, visszavonás |
| Kérdés | Válasz ugyanabban a szálban; a felhasználó elhalaszthatja vagy lezárhatja |
| Megfigyelendő hipotézis | Konkrét kérdés, szükséges adat/lefedettség, következő ellenőrzés ideje |
| Kipróbálható javaslat | Világos cél és jóváhagyásra váró, előnézhető domainváltoztatás |
| Változtatás nélküli lezárás | Indok, szükség esetén újranyitási feltétel |

Az utánkövetés tartós rekord, esedékességgel és felelős szereppel. Hiányzó adat esetén nem lesz automatikusan cáfolt hipotézis; új ellenőrzési idő vagy felhasználói kérdés következik. A napi futás az esedékes rekordokat is feldolgozza, a heti összegzés pedig áttekinti az elakadt szálakat.

Terv/cél/rutin-javaslat jóváhagyása előtt a felhasználó a konkrét változást látja. Végrehajtáskor a domain aktuális verzióját újra ellenőrizzük, és a meglévő domainműveletet hívjuk idempotensen. Nem támogatott automatikus végrehajtás esetén a javaslat a megfelelő meglévő szerkesztőbe vezet; sosem jelöljük végrehajtottnak pusztán a jóváhagyástól.

## 9. Modellválasztás és kezdeti működési korlátok

Alapértelmezés: kiegyensúlyozott mód. A témaválasztás és szokásos kommentmunka a meglévő költségtakarékos modellútvonalon fut. Több területet érintő, megmaradó vita, összevonás/időbeli ellentmondás, érzékeny állítás erősítése vagy lényeges profilátírás indokolja az erősebb útvonalat. Az eszkaláció okát és tényleges modelljét az audit rögzíti; az erősebb modell sem pótol hiányzó adatot.

Kezdeti, konfigurálható felső korlátok: napi hat új szál, három domain-vitakör, négy domain-résztvevő, ciklusonként tizennégy modellhívás (a tool-folytatásokkal és záróhívásokkal együtt), legfeljebb nyolc olvasóeszköz-hívás és négy erősebbmodell-hívás. Felhasználónként napi 120 modellhívásból 30 a felhasználó által kezdeményezett folytatásoknak fenntartott rész; autonóm futás ezt nem használhatja el. A meglévő központi token-, költség- és időkorlátok szigorúbb határa mindig érvényes.

Ezek biztonságos induló működési korlátok, nem vállalt posztszámok vagy forintösszegek. A ciklus előre fenntartja a lezárás és a szükséges portréfrissítések keretét; új vitakör csak ezen felüli szabad keretből indulhat. Ha a lezárási keret sem biztosítható, a munka mentett, halasztott állapotban marad. A maradék keret alapján a vita korábban zárulhat. A modell/model-tier, limitek és kapcsolók a meglévő konfigurációs rendszeren keresztül állíthatók. Nincs forráskódba égetett modellnév és nincs automatikus fizetős szolgáltatóváltás.

Keretkimerüléskor a felhasználói válasz mentése sikerülhet, a feldolgozás külön „későbbre ütemezve” állapotot kap. A heti és havi munka is ugyanabba a napi elszámolásba tartozik; a tartós sor biztosítja, hogy az előző napi félbemaradt munka ne vesszen el. A mérés tartalmazza a szálankénti hívásokat, tokent, költséget, eszközhibát és érdemi eredmény arányát.

## 10. Tartósság, hibakezelés és integráció

A logikai tárolási egységek: napi kiadás, témaszál, feldolgozási ciklus, komment/válaszcél, forráshivatkozás, eredmény, profilváltoztatás és utánkövetés. Mindegyik felhasználóhoz kötött; azonosítót a szerver old fel. A részletes REST/OpenAPI és adatbázisterv az implementációs tervezés feladata, a meglévő character contract bővítéseként.

Rövid tranzakciók és tartós feldolgozási lease; külső modellhívás idejére nem tartunk nyitva profilíró tranzakciót. A napi, heti, havi és reply munka egy közös verziózott változtatási kapun megy át. Szálon belül sorrendtartás, dimenziók között determinisztikus zárolási sorrend, lejárt workerre és stale claimre külön ellenőrzés szükséges.

Hiba nem fogyaszthatja el végleg a feldolgozatlan megfigyelést. Egyedi hibás komment kihagyható, de a lefedettség és a kimaradt résztvevő belső állapota megmarad; ebből nem képzünk fiktív egyetértést. A ciklus csak validált eredménnyel zárulhat. Mentés/újrapróbálás, zárás, visszavonás és jóváhagyott domainművelet idempotens.

Az app „nincs érdemi újdonság” állapotot csak sikeres feldolgozás után mutat. Késés, modellhiba és bemeneti hiba külön jelzés, korábbi olvasható tartalommal. A gazdátlan/lejárt munkák helyreállítása UserFanOut alatt történik; a fiók letiltása a további munkát is megállítja.

A régi konferenciák és reply rekordok megmaradnak; olvasható adapter köti őket a falhoz. A meglévő reply-végpontok kompatibilitása megmarad. Ugyanarra a válaszra pontosan egy feldolgozási út jogosult. Régi értelmezésekből nem gyártunk utólag szakértői kommenteket.

A Karakter-kivonatot használó chat/memoár/predikció/heti áttekintés az aktív, időben megfelelő állításokat kapja. A friss felhasználói pontosításoknak külön keretrész jár, hogy egy hosszú dosszié ne szorítsa ki őket. Témához kötött olvasáskor elérhető a teljes szál és bizonyítéklánc. Minden kommentet önálló megerősített tényként vagy önálló emlékként indexelni tilos: az eredmény és az attribuált önbeszámoló a releváns egység.

## 11. Elfogadási példák és ellenőrzés

- Alvás–edzés jelzésre a Szomnológus meghívja az Edzőt külön témakörök esetén is; az Edző eszközzel ellenőriz, a szerző ténylegesen válaszolhat.
- A „héten négy helyett hat kihagyás” elfogadott szövegpontosítás a tárolt claimben és portréban is változik; a korábbi változat visszanézhető.
- Korábbi fehérjehiány és újabb többlet pontos időablakkal, cél- és lefedettségellenőrzéssel jelenik meg; az átfedő ellentmondás nem marad két általános, biztos narratíva.
- Ugyanazon mérési ablak három összefoglalója nem számít három független bizonyítéknak.
- A Szkeptikus által kért naplóadat tényleges eszközhívással és forráshivatkozással kerül be; idegen fiók adata minden elérési úton tiltott.
- A válasz elküldése közbeni hálózati hiba/újrapróbálás nem duplikál kommentet, tudást, változtatást vagy költséges ciklust.
- Napi/heti futás és felhasználói válasz ütközése nem írja felül az újabb állítást; a visszavonás nem veszít el későbbi független változtatást.
- Keretkimerülés és hiányzó forrás nem jelenik meg sikeres, változtatás nélküli napként.
- A tervjavaslat jóváhagyásig nem módosít domainadatot, lejárt előnézet esetén új összevetést kér.
- Az új kiemelések és kommentek telefonon olvashatók, billentyűzettel elérhetők, csökkentett mozgással is működnek. A glass popup fókuszt kezel és visszaad.

Backend: tényleges PostgreSQL-integrációs tesztek, fake modell kontrollált hibákkal és konkurens futásokkal; a szemantikus minőséget külön kurált esetkészlet méri (forráspontosság, ismétlés, időbeli ellentmondás, indokolt bevonás, túlzó profilállítás). Frontend: mindkét adatmód, build, apphű prototípus és mobilos böngészőellenőrzés. Éles felhasználói profilba nem írunk fiktív tesztállítást.

## 12. Következő kézzelfogható eredmény

Az interaktív prototípus egy reggeli falat, egy többkörös alvás–edzés beszélgetést, tool-bizonyíték popupot, felhasználói válasz miatti folytatást, előtte/utána profilváltozást és egy jóváhagyásra váró javaslatot mutat. A demonstrációs adatok egyértelmű jelölést kapnak. Ezután a specifikációból szerződés-, backend-, UI- és migrációs munkákra bontott megvalósítási terv készül, Beadsben követett feladatokkal.
