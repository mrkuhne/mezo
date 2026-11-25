---
cim: Az évad (cél + edzés + étel + alvás)
szint: Funkció
terulet: Terv
allapot: Részben kész
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B6]
osszefoglalo: Egy néhány hetes terv, amely magában foglalja a célt, az edzésblokkot, a heti napokat és az alvásigényt — minden módosításnál élőben mutatja, mire hat, és csak az elfogadásod után változtat.
---

## Mit csinál
Egy **évad** 4–24 hétig tart, és ezeket fogja össze:

- a **súlycélt** (fogyás, súlytartás vagy izomépítés, tempóval);
- az **edzésblokkot** (a futó blokkot átveszi, vagy újat indít egy sablonból);
- a **heti edzés- és sportnapokat** (például heti 4 edzés + kedden és csütörtökön röplabda);
- az **alvásigényt** és a lefekvés idejét;
- a **szabályokat** és a **kiválasztott recepteket** (ezekből áll össze a heti menü — lásd [Heti menü](09-heti-menu.md)).

Ebből számol: edzésnapi és pihenőnapi kalória, fehérje, szénhidrát edzésnapon, a **heti összes** kalória, alvásigény,
lefekvés, céldátum és tempó (súlytartásnál a súlysáv).

**Módosítás — „Mi változna?”** Átállíthatod, hány edzésed legyen hetente, mely napokon sportolsz, és milyen tempóban fogyj vagy
híz. Minden változtatás után Boop azonnal megmutatja:
- **Ennyi változna** — „Most” és „Utána” oszlop: edzésnapon, pihenőnapon (vagy „nincs pihenőnap”, ha minden nap mozogsz),
  szénhidrát edzésnapon, **heti összesen**, alvásigény, lefekvés, célba érés és tempó (vagy a sáv);
- piros figyelmeztetés, ha a motor szerint baj lenne (például „Ilyen tempónál izmot is veszítenél, nem csak zsírt.”);
- **A blokkod új hete** — ha az edzésnapok változnak és fut egy edzésblokk: napról napra, melyik edzés hova kerül
  („Szerda · Alsó A — Eddig kedden volt.”), melyik nap új („Új nap: a hétfői edzés még egyszer.”) és melyik marad ki;
- **Ehhez ezt kell tenned** — például „Korábbi lefekvés: 21:55 körül feküdj le. Az esti emlékeztetőt is ehhez igazítom.”, vagy
  hogy a futó blokk napjai is az új edzésnapokra kerülnek;
- **Elfogadom** / **Mégsem**. Amíg nem fogadod el, semmi sem változik.

Egy fontos részlet: **egy plusz edzés nem emeli az edzésnapi kalóriát.** Minden nap célja az alap + azon a napon végzett mozgás
+ a cél miatti különbség. A plusz edzés egy pihenőnapot edzésnappá tesz, így a **heti összes** kalória nő (például 16 800-ról
17 000-re), az alvásigény nő, és korábban kell feküdni — ezt a három sort érdemes nézni.

**Egy elfogadás, minden együtt mozdul (2026-11-25 óta).** Ha futó edzésblokk mellett változtatsz az edzésnapokon (több,
kevesebb vagy más napok), az *Elfogadom* egyszerre állítja át a célt, a heti napokat, az alvásigényt **és a blokkot**:
- ha ugyanannyi nap marad, a blokk napjai sorrendben az új napokra költöznek (a gyakorlatok és a korábbi edzéseid
  megmaradnak);
- ha több nap lesz, az új nap egy meglévő edzésnap ismétlése — azt választja Boop, amelyikkel a heti izommunka a
  legkiegyensúlyozottabb marad (ugyanaz a kiértékelő dönt, mint a Blokk-építőben), és oda teszi a hétben, ahol a
  legjobb helyen van;
- ha kevesebb, az a nap marad ki, amelyik nélkül a hét a legkevésbé billen fel; a kimaradt nap korábbi edzései megmaradnak.

Ha épp fut egy edzés azon a napon, ami kimaradna, Boop megkér, hogy előbb fejezd be. Ha az előnézet óta a blokkban
változtattál valamit (például a napszerkesztőben), Boop újraszámolja az előnézetet, mielőtt elfogadnád.

**Boop ismeri az évadot (2026-11-21 óta).** Az évad szabályai — a cél és a tempó, a heti edzés- és sportnapok, az edzés- és
pihenőnapi kalória és fehérje, a kiválasztott receptek szabálya, a feldolgozottsági szabály (ha nem „bármi mehet”), az
alvásigény és a lefekvés — ott vannak Boop minden beszélgetésében, a reggeli összefoglalóban és az étkezések értékelésében.
Így például egy étkezés értékelésekor kedvesen szól, ha egy étel nem fér bele az évad szabályaiba. Ha megkérdezed, hogyan
halad az évad, Boop elmondja, hányadik hétnél tartasz, merre halad a súlyod, hogy ment az elmúlt hét, és mit vett észre.

**Kártyák a Ma falán (2026-11-21 óta):** ha Boop rájött, hogy a valóságban más az égetésed, mint amivel a terv számolt, egy
javaslat-kártya jelenik meg (hetente legfeljebb egyszer) „Átnézem” gombbal, ami a Módosításra visz — ott előbb látod, mi változna, és csak az elfogadásod
után változik bármi. Ha az évad egy héten belül véget ér, azt is jelzi. Egyik kártya sem csörget.

**Edzésblokk csak évaddal indulhat.** Ha nincs évad (vagy egy héten belül induló tervezett évad), az új blokk indítását a
rendszer elutasítja, és Boop az Évad oldalra küld. A már futó blokk zavartalanul fut tovább.

## Hogyan működik
1. **Előnézet:** a telefon elküldi a tervezett változatot; a háttérrendszer a súlycél-motorral kiszámolja előtte és utána az
   összes számot — **semmit nem ment el**.
2. **Elfogadás:** egy lépésben átírja a súlycélt, a heti edzés- és sportnapokat, az alvásigényt (és a lefekvést), szükség esetén
   csatolja a blokkot, és feljegyzi a változást az előtte–utána számokkal.
3. **Ujjlenyomat:** az előnézet megjegyzi, milyen állapotból számolt (cél, heti napok, legutóbbi mérlegelés, alvás, blokk). Ha
   közben valami változott — például mérlegeltél —, az elfogadást a rendszer visszautasítja, a telefon újraszámol, és ezt írja:
   „Közben változott valami, újraszámoltam.” Így soha nem kerül be elavult szám.
4. **Alvásigény (Boop szabálya):** alap = a saját alváscélod, ha beállítottad, különben 7 óra 30 perc; minden heti edzés és sport
   +6 perc; legfeljebb 8 óra 30 perc. Lefekvés = ébredés − alvásigény − 15 perc elalvás. Például heti 4 edzés + 2 sport mellett
   7 óra 30 perces alapból 8 óra 6 perc lesz. Az általános ajánlás felnőtteknek 7–9 óra, sportolóknak inkább a sáv teteje; a
   pontos lépésköz Boop kiinduló szabálya, nem mért érték. Az alapot az évad megjegyzi, így ismételt módosításnál nem
   halmozódik; az évad lezárásakor az alváscél visszaáll az alapra (hacsak közben magad nem írtad át).
5. **Életciklus:** tervezett → aktív → lezárt. Egyszerre egy aktív évad lehet; egy új évad indítása lezárja az előzőt.
6. **Az évad Boop fejében:** a háttérrendszer minden beszélgetés, reggeli összefoglaló és étkezés-értékelés előtt röviden
   összeírja az évad szabályait. Ha valamit nem tud kiszámolni (például hiányoznak a testadatok), azt a sort kihagyja,
   sosem talál ki számot — és ha bármi hibázik, a beszélgetés akkor is megy tovább, csak az évad nélkül. Ára: aktív évad
   alatt minden ilyen alkalom egy rövid, csak olvasó számolással jár; plusz AI-hívás nincs.
7. **Az első évad** a meglévő súlycélodból, a futó blokkodból, a heti napjaidból és az alvásodból áll össze javaslatként; élesbe
   csak az „Indulhat az évad” gombra kerül.

## Miért így
- A tulajdonos alapkérése: az étrend, az edzés, a súly és az alvás **egy** egység legyen, és minden változtatásnál lássa a
  következményt (döntések #61–#64).
- Az étkezési számot a heti edzés- és sportnapok mozgatják, nem maga a blokk — ezért az évad birtokolja a heti napokat.
- Az évad szabályai azért vannak Boop minden AI-jában, mert a tulajdonos kérése, hogy a terv egy rendszer legyen: ha Boop
  nem tudna az évadról, olyat is javasolhatna, ami ellentmond neki.
- Az elfogadás egy lépés, hogy soha ne legyen olyan pillanat, amikor a kalória már 5 edzéssel számol, a többi még 4-gyel.
- Az új nap mindig egy meglévő nap ismétlése, nem egy frissen kitalált edzés: így az elfogadás azonnali és kiszámítható, a
  részleteket utána a napszerkesztőben bármikor átírhatod. (2026-11-20 és 11-25 között futó blokk alatt az edzésnapok
  zárolva voltak, amíg ez a lépés el nem készült.)

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.season.mesocycle-gate.enabled` | Be/ki kapcsolja, hogy edzésblokk csak évaddal indulhasson | be |
| `mezo.season.mesocycle-gate.planned-lead-days` | Ennyi napon belül induló tervezett évad is elég a blokk indításához | 7 nap |
| `processed_food_max_nova` (évad-szabály) | Csak kevéssé feldolgozott ételek (1–4-es skálán meddig) | 2 |
| `deload_maintain` (évad-szabály) | Könnyebb edzéshéten ne fogyj | be |
| `use_learned_expenditure` (évad-szabály) | A valódi, megtanult égetéssel számoljon | be |
| `propose_experiments` (évad-szabály) | Ajánljon kísérletet, ha valami újat kezdesz | be |
| `menu_day` / `menu_time` (évad-szabály) | Mikor kéred a jövő heti menüt | vasárnap 18:00 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `season` | Az évad: név, állapot, kezdet, hossz, a súlycél, alvásigény és annak alapja, szabályok, az utoljára elfogadott változat |
| `season_revision` | Minden elfogadott változás, az előtte és utána számokkal |
| `season_allowed_recipe` | A kiválasztott receptek |
| `goal` | A súlycél (az évad hozza létre és írja át) |
| `goal_plan_link` | Az évadhoz csatolt edzésblokk |
| `gym_schedule_slot` / `sport_schedule_slot` | A heti edzés- és sportnapok (az évad írja elfogadáskor) |
| `sleep_goal` | Az alváscél (aktív évad alatt az évad alvásigénye) |

## Mi jön még
- 3. szakasz (élesben): [Heti menü](09-heti-menu.md) és [Bevásárlólista](07-bevasarlolista.md).
- 4. szakasz (élesben): kísérletek (lásd [Hatás — kísérletek](08-hataskovetes.md)).
- Egy elfogadással a futó blokk napjai is átrendeződnek, ha az edzésnapok változnak.
- A célsúly, az évad hossza és az ébredési idő állítása a Módosításban; Korábbi évadok oldal.

## Mi marad ki
A tervben szereplő „hétfőn ehhez igazítanám a keretet” heti javaslat nem épült meg — az égetés-észrevétel ezért csak megmutatja
az eltérést, a módosítás a te elfogadásodon múlik. Életcélok (PERMAH-pillérek, jelkatalógus, „ha–akkor” szabályok) termékként; napi szintű újratervezés (7. szakasz); futóblokk az
évadban (döntés #44).
