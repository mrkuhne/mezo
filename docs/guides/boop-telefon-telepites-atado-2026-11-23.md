# Átadó: a Boop telepítése a telefonra a másik gépről (2026-11-23)

**Kinek:** a tulajdonos, illetve a Claude-menet azon a Macen, ahol az Xcode be van állítva (Apple ID
bejelentkezve, `~/.config/boop/team` megvan).

**Miért:** az edzéslejátszó javításcsomagja (`mezo-r36n9.147`, merge `9eabffcd5`, 2026-11-23) a főágon van és a
szerver (v3.34.2) élesben fut, de a telefonra nem lehetett telepíteni az új Macről: ott az Xcode sosem futott,
nincs aláíró tanúsítvány, és nincs rendszergazdai jog a fejlesztői mód bekapcsolásához. Ugyanezért **a telefonos
tesztkészlet szimulátoros futtatása is elmaradt** ott (a lejátszó modelljének tesztjei natívan lefutottak: 9 csomag,
91 teszt zöld; az app és a tesztjei lefordulnak).

## Mit kell tenni a másik gépen (emberi nyelven)

1. A telefont kábellel bedugni, feloldani, és ha kérdezi, megbízni a gépben.
2. A projekt mappájában friss főágat húzni, majd a telepítőt futtatni. Egy Claude-menetnek elég ennyit mondani:
   *„Húzd le a legfrissebb főágat, futtasd le a telefonos tesztkészletet, és telepítsd a Boopot a telefonra.”*
3. Az első indításnál a telefonon: Beállítások › Általános › VPN és eszközkezelés › **Megbízom**.
4. Az ingyenes aláírás 7 napig él — hetente újra kell telepíteni (ez eddig is így volt).

## A pontos parancsok (a Claude-menetnek vagy a Terminálba)

```bash
cd <a mezo projekt mappája>
git pull --ff-only origin main
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer

# A kihagyott tesztkapu — először ezt (a két parancs kb. 10–15 perc):
cd ios/BoopKit && xcodebuild test -scheme BoopKit-Package \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -skipPackagePluginValidation -derivedDataPath ../build/kit; cd ../..
cd ios && xcodebuild test -project Boop.xcodeproj -scheme Boop \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -skipPackagePluginValidation -derivedDataPath build/app; cd ..

# Telepítés a bedugott telefonra (a csapat-azonosítót a ~/.config/boop/team fájlból veszi):
ios/scripts/install-on-phone.sh
```

Kilépési kódok: `2` nincs csapat-azonosító (`~/.config/boop/team` egy sor) · `3` nem lát telefont (kábel, feloldás,
megbízás) · `4` az építés nem sikerült (`ios/build/install.log`) · `5` a telepítés nem sikerült (a telefonon a
„Megbízom” lépés hiányzik, vagy a log mondja).

## Mit nézzen meg a tulajdonos a telefonon (élő ellenőrzés)

Edzés › Ma › Indítás › Indulás, majd a lejátszóban:

- a **súly és az ismétlés** húzható skálán áll (0,5 kg-onként; a számra koppintva beírható); a terv értéke pont a skálán;
- ha bemelegítő jön: nagy **„BEMELEGÍTŐ 1/2 · könnyű súllyal, N ismétlés”** sor a számok fölött;
- a számok alatt a **„TERV · … kg · … ismétlés · … tartalék”** sor akkor is ott marad, ha átírja a számokat;
  új gyakorlatnál „ehhez még nincs ajánlott súly…”;
- egy munkasorozat után a következő sorozat **az előző súlyát** hozza, a szám mellett „ELŐZŐ”;
- **„…” › Jegyzet**: Mentés gomb, Kész a billentyűzet fölött; a jegyzet a következő edzésen is ott van (a szerverre felment);
- egy kész sorozat sorára koppintva a javító lapon a **tartalék** is állítható;
- „…” menü: **„Ma mást csinálok helyette”** és **„Lecserélem a blokkban is”** külön;
- Edzés › Blokk › Napok: a futó edzés napján a sorrend húzható, a sorozat/ismétlés/tartalék/technika szerkeszthető,
  **Mentés** után a futó edzés követi (hozzáadni/cserélni/törölni ott nem lehet, ez szándékos);
- az edzés lezárása után a Ma oldal **„megvolt”**-at mond, és a **„Megnézem a mai eredményt”** újranyitja a lezáró képet;
  a terület menüjében „Megvolt · A mai eredmény”.

## Második csomag ugyanebben az átadóban (2026-11-24, `mezo-r36n9.151`–`.154`, merge `c894ba3e4`)

A kezdőlap és a gyors rögzítés javításai is a főágon vannak; ugyanaz a telepítés hozza. A telefonon nézd meg:

- a **kezdőlap orbjaiban** szám áll (Alvás, Edzés, Energia akkor is, ha a Forma még „–” és „tanul”); az **Étel** orb
  ugyanazt a számot mutatja, mint az Étel szoba gömbje; a **Pénz** orb élő, és a heti keret megmaradt részét mutatja
  százalékban;
- Boop mondata alatt jobbra a **Rögzítés** gomb ugyanazt a lapot nyitja, mint a menüsor plusz gombja;
- a **„Mit rögzítesz?”** lapon kilenc ajtó: Víz · Kiegészítők · Edzés indítása · Sport · Súly · Check-in · Napló ·
  Alvás · Kiadás, fölötte az étkezés öt bejárata; mindegyik lapon a gomb a billentyűzet fölött marad;
- **Étel › + › Fotó**: a fotóból a vázlat megérkezik (eddig „Most nem sikerült kiszámolnom…” jött), és a mentett
  étkezés mellett a Napló oldalon ott a kép;
- egy **víz**, egy **súly**, egy **alvás**, egy **sport** és egy **naplósor** rögzítése után a rövid üzenet megjelenik;
  a súly/alvás/sport/napló repülő módban is „rögzítve” marad, és net után elmegy.

Az új tesztek a telefonos készletben: `KezdolapRingTests`, `CaptureSheetTests`, `MaiCopyTests` (app) — a mag
(`BoopCore`) 951 tesztje natívan lefutott az új Macen.

## Harmadik csomag ugyanebben az átadóban (2026-11-24, `mezo-r36n9.156`–`.158`)

A lapok bezárása, a kezdőlap gyorsajtói és a Súly terület is a főágon vannak; ugyanaz a telepítés hozza. A telefonon
nézd meg:

- **minden felcsúszó lap** jobb felső sarkában a kis kerek **X** zárja a lapot; az **Étel szobából nyíló lapokon** a
  lehúzás **bezár**, nem frissít (a szoba saját lehúzása továbbra is frissít);
- a kezdőlapon Boop mondata alatt **öt ajtó**: Étkezés · Víz · Súly · Check-in · Napló — mindegyik rögtön a saját
  lapját nyitja; a sáv plusz gombja változatlan;
- a kör **kilenc gömb**: az arany **Súly** az Energia és a Forma között; a száma „–", ha nincs aktív évad vagy még
  kevés a mérés, különben az ütem-pontszám (0–100);
- a Súly gömb a **Súly szobát** nyitja: Ma (a mai mérés, a trend, a cél, a görbe a terv vonalával, a hét mérései,
  a cél sora az Évadba), Test (testzsír, izomtömeg, BMI — a Feelfit az Egészségen át; itt a **saját testikon** a
  fülön), Napló (minden mérés hetenként); repülő módban az utolsó kép a korával;
- egy **Súly rögzítése** után (a szoba gombja vagy a gyorsajtó) a gömb és a szoba újraolvas.

Új tesztek a telefonos készletben: `KezdolapRingTests` (kilenc gömb, a Súly száma), `CaptureSheetTests` (az öt ajtó),
`MaiCopyTests` (a színvilágok száma), `RitmusTickTests` (a mérés jele), `NapkelteTokensTests` (az arany világ, a
testikon). A mag (`BoopCore`) Súly-tesztjei (41) natívan lefutottak az új Macen.

## Negyedik csomag ugyanebben az átadóban (2026-11-24, `mezo-r36n9.159`–`.161`)

A visszamenőleges rögzítés, a Napló pótlásai, az edzés pótlása és az italok a főágon vannak; **a szerver is változott**
(ital-rekesz, edzés-pótlás végpont), ezért előbb a `deploy` legyen zöld. A telefonon nézd meg:

- a **Súly, Alvás, Sport, Napló** lapokon a **„Mikor"** sor (Ma · Tegnap · Más nap; a sportnál időponttal): a választott
  nap a sor jobb szélén, a mentés rövid üzenete nevezi a napot („… rögzítve · tegnap"); egy hétre visszamenőleg;
- az **étkezés** „Mikor etted" sorában a **Tegnap** gomb;
- a **Napló** a mai és az előző hat napot mindig listázza; egy korábbi nap lapján a **PÓTLÁS** blokk: a kimaradt
  check-in pillanat (a kitöltés a pillanat idejére kerül, az energiavonalon a helyén), **Edzés pótlása** (a terv
  sorozataival, a súly átírható, „Megvolt"), **Lezárom a napot**; a mai nap lapján csak az elmúlt, kimaradt
  pillanatok; a nap naplósorai **A NAP SORAI** alatt;
- az **Ital** bejárat (rögzítő és „Mit rögzítesz?"): szokásos italaid, szöveg/fotó, Recept · Kamra · Vonalkód,
  „Mikor ittad"; az Étel szoba Ma lapján az **ITALOK** csoport, a Hét naplapján „ital" jel; az Étel gömb száma nem
  mozdul tőle;
- net nélkül: minden pótlás és ital a telefonon landol, és net után elmegy.

Új tesztek a telefonos készletben: `QuickSheetsWhenTests`, `MealComposerTests` (+1), `NaploCatchUpModelTests`,
`CheckinFlowTests` (+1), `EsteFlowTests` (+1), `MealComposerDrinkTests`, `EtelDrinkRowsTests`,
`WorkoutAsPlannedModelTests`, `NapkelteTokensTests` (+ a pohár-ikon). A mag (`BoopCore`) új tesztjei natívan
lefutottak ezen a gépen.

## Ami még nyitva van (jegyek)

- `mezo-r36n9.150` — ez az átadó: tesztkapu + telepítés a másik gépen (már négy csomaggal).
- `mezo-r36n9.28` — a Testösszetétel terv szerverfele (a testzsír a cél energiaszámításába); a telefonos fele a Súly
  szoba Test oldala lett (`.158`).
- `mezo-r36n9.148` — a Notion „Boop” tér frissítése (az új Macen a Notion-kapcsolat az Intuitech teret látta);
  ahol a tulajdonos Notion-kapcsolata él: `node scripts/boop-notion-sync.mjs plan` → apply → `check` 0.
- `mezo-r36n9.149` — a telefon szerződés-másolata (`ios/scripts/sync-openapi.sh --check`) elmaradt a szerverétől;
  egy olyan menetben szinkronizálandó, ahol az app tesztjei futnak.

## Az új Macen tanultak (hogy legközelebb ne lepjen meg)

- Friss klónnál a jegy-adatbázis üres: `git checkout -- .beads/issues.jsonl && bd import` állítja helyre.
- `xcodebuild -downloadComponent MetalToolchain` kell az első iOS-buildhez.
- A szimulátoros tesztfuttatóhoz **fejlesztői mód** kell (`sudo DevToolsSecurity -enable`), ami rendszergazdai jog nélkül
  nem kapcsolható be; az app építése és a szimulátorban futtatása enélkül is megy.
- Az éles adatbázis Tailscale nélkül nem érhető el.

## Ötödik csomag ugyanebben az átadóban (2026-11-25, `mezo-r36n9.163`)

„Másik napot csinálok ma” — csak a telefon változott, szerveroldali kiadásra nem kell várni. A telefonon nézd meg:

- Edzés · Ma: a kártya alatt a **„Másik napot csinálok ma”** sor; a lapon elöl a kimaradt nap(ok) („KEDD · KIMARADT”),
  pihenőnap nincs rajta.
- Egy napot választva a kártya **PÓTLÁS**, „keddi nap, ma pótolod · …”; Indítás → eligazítás → lejátszó a választott
  nap gyakorlataival; „Mégis a mai napot csinálom” visszavált.
- Futó pótló edzés közben lépj ki az Edzés szobából és vissza: a kártya és a gyakorlatok a pótolt napéi maradnak.
- Befejezés után a kártya „megvolt” a pótolt edzés nevével, a Blokk fülön **A heted** a keddet pipálja.

Új telefonos tesztek: `EdzesStoreTests` (a választás, net nélkül, vissza a maira, a hét kész napjai, a korábban kész
mai nap, újranyitás futó pótlás közben, a saját gyorsítótár-kulcs). A mag `OtherDayTests` (9) natívan lefutott.
