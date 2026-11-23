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

## Ami még nyitva van (jegyek)

- `mezo-r36n9.150` — ez az átadó: tesztkapu + telepítés a másik gépen.
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
