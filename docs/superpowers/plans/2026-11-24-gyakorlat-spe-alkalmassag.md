# Gyakorlatonkénti SPE és Hip Thrust megtartás — megvalósítási terv

**Cél:** a 166 központi gyakorlat mindegyikének ellenőrzött SPE-palettája legyen; a Hammer Curl három technikája és a rudas Hip Thrust 2 mp-es felső megtartása választható és naplózható legyen.
**Architektúra:** a verziózott katalógus JSON tárolja a palettát, a szerver ugyanebből validál és küldi a telefonra. A `top_pause` a normál utolsó munkasorozat technikája, `topHoldSec=2` előírással és extra láb/sorozat nélkül. A régi szerverválasz és a saját gyakorlatok szigorú tartalék szabálya megmarad.
**Alap:** [jóváhagyott specifikáció](../specs/2026-11-24-gyakorlat-spe-alkalmassag-design.md) és annak [szimulátoros próbája](../specs/assets/mezo-eiux9/plan.png). **Beads:** `mezo-eiux9`. **Ág:** `feat/gyakorlat-spe`.

## Közös korlátok és kész-feltételek

- A tulajdonos 2026-11-24-én jóváhagyta a koncepciót és a szimulátoros próbát. Ez a terv a harmadik, megvalósítás előtti jóváhagyási pont.
- A 166 master sorból jelenleg 57 `stable`, 109 `free`; a 57 régi palettája megmarad, a 109 `free` közül csak `hammer-curl` (`myo`, `rest_drop`, `drop`) és `hip-thrust` (`top_pause`) kap SPE-t. A többi `free` sor kifejezetten üres listát kap, köztük a Cross-Body Hammer Curl és az Overhead Press. A 166 sor `equipment`, `gear`, `stability`, `lengthenedFriendly`, `type` és mozdulatneve egyenként ellenőrizendő a JSON-írás előtt.
- A `none` mindig választható, de nem szerepel az `allowedTechniques` listában. Az új `top_pause` kizárólag az utolsó munkasorozaton, minden ismétlés tetején 2 mp, változatlan súly/ismétlés/RIR mellett, egy normál naplózott sorozatként működik. A nap kihívása és a kímélő/deload tiltás változatlan.
- A tervező/AI az új `free` palettából nem helyez el automatikus SPE-t. Futó blokk, korábbi napló és már elkezdett edzés nem módosul automatikusan. A saját katalógussoroknál a régi stabilitás/nyújtott-helyzet alapértelmezés marad, ismeretlen `other/free` esetén üres lista.
- Visszafelé kompatibilis iPhone-dekódolás: hiányzó `allowedTechniques` → régi, szigorú szabály; hiányzó `topHoldSec` → nincs megtartás. Minden új szerverválaszban szerepel a lista. Az OpenAPI az egyetlen határ; a nyugdíjazott webhez nem készül új kliens.
- A kiválasztóban az engedett és letiltott technikák, az indok, az Overhead Press magyarázó nézete, a napi kihívás és a „Sima sorozatok” megmarad. A lejátszóban a megtartás előtte/közben és a kész sorozat/összefoglaló látszik; a normál és régi technikák, üres/betöltési/hibás állapotok, offline/újranyitás, 320 pt szélesség és csökkentett mozgás nem romlanak.
- Egyetlen `mezo-eiux9` ügy, ugyanaz a `feat/gyakorlat-spe` ág. Minden alábbi feladat külön ellenőrzött commit. **Nem kész**, amíg a helyi kapuk, a `--no-ff` egyesítés, a push, a szerver telepítése, a telefonra telepítés és az élő ellenőrzés meg nincs.

## 1. Szerződés: paletta és csúcsponti megtartás

**Fájlok:** `api/feature/train/train.yml`, `api/openapi.yml`, `ios/BoopKit/Sources/BoopAPI/openapi.yaml`.
**Határ:** `ExerciseCatalogItem.allowedTechniques: Technique[]` (válaszban kötelező, lehet üres); `Technique` új `top_pause`; `PrescribedSet.topHoldSec?: integer` (csak `top_pause` esetén 2, máskor hiányzik). A meglévő `ExerciseTechniqueUpdateRequest` és naplózási DTO-k az új enumot ugyanazzal a mezővel viszik.

- [x] A fragment módosítása és a merge után `ios/scripts/sync-openapi.sh --check` eltérést jelzett (exit 1); a sync előtt a két generált példány már eltért.
- [x] `cd api/generate && npm ci && npm run generate:api`; majd `ios/scripts/sync-openapi.sh`. Az utóbbi `--check` és `node scripts/check-generator-toolchain.mjs --manifests` zöld.
- [x] A diffet átnéztem: az új mezők és enum megjelentek. Az iPhone OpenAPI-példánya a korábbi Mail és edzésterv szerződésváltozásokat is behozta, mert a mainen már elmaradt a szinkron; a sync parancs teljes, kanonikus példányát tartjuk meg. `git add api/feature/train/train.yml api/openapi.yml ios/BoopKit/Sources/BoopAPI/openapi.yaml && git commit -m 'feat(api): describe exercise SPE palettes and top pause (mezo-eiux9)'`.

## 2. A teljes katalógus tételes palettája

**Fájlok:** `backend/src/main/resources/content/exercise-catalog.json`, `backend/src/main/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogLoader.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogClassificationTest.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogLoaderIT.java`.
**Határ:** `ExerciseCatalogLoader.CatalogJsonItem.allowedTechniques: List<String>`; minden master sorban kötelező. Csak a hat valós SPE-token (`rest_drop`, `drop`, `myo`, `rest_pause`, `partials`, `top_pause`), ismétlés és `none` nélkül.

- [x] A piros próba `allowedTechniques()` hiányával fordításkor elbukott; a későbbi próba 166 egyedi slugot, 59 nem üres palettát és a négy név szerinti esetet ellenőrizte.
- [x] Egyszeri helyi átalakítással mind a 166 JSON-sor kifejezett palettát kapott; az alkalmazás nem következteti vissza a master listát stabilitásból.
- [x] A rendezett auditnézetben mind a 166 név, típus, eszköz, gear, stabilitás és nyújtott-helyzet jelző át lett nézve. Nem találtam gép/kábel `free` párt; 7 megtámasztott szabad súlyos `stable` sor maradt. A `dead-hang` régi `plyo` típusa külön, volumenhatású besorolási kérdés, nem változtatjuk meg SPE-javításként.
- [x] A betöltő a hiányzó/ismeretlen/ismételt listát upsert előtt elutasítja. `./mvnw clean test -Dtest=ExerciseCatalogClassificationTest,ExerciseCatalogLoaderIT -Dmezo.test.use-testcontainers=true`: 19 teszt, 0 hiba, BUILD SUCCESS. `git add backend/src/main/resources/content/exercise-catalog.json backend/src/main/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogLoader.java backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogClassificationTest.java backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogLoaderIT.java && git commit -m 'feat(train): audit all exercise SPE palettes (mezo-eiux9)'`.

## 3. Katalógus-adatbázis és válasz

**Fájlok:** `backend/src/main/resources/db/changelog/1.1.0/script/202611241449_mezo-eiux9_exercise_spe.sql`, `backend/src/main/resources/db/changelog/1.1.0/1.1.0_master.yml`, `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/ExerciseCatalogEntity.java`, `backend/src/main/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogLoader.java`, `backend/src/main/java/io/mrkuhne/mezo/feature/train/mapper/TrainMapper.java`, `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/ExerciseCatalogService.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogLoaderIT.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogContractIT.java`.
**Határ:** `exercise_catalog.allowed_techniques varchar(16)[] NULL`; `NULL` csak saját/régi sorokon engedett; a szerver API-ja minden sorhoz teljes listát ad. A migráció az `exercise` és `exercise_set` technika CHECK-jeibe is felveszi a `top_pause` értéket. A fájlnév UTC percét az íráskor ellenőrizni kell; ha a tervben jelölt perc már elmúlt, a tényleges percet írd be mind a fájlnévbe, mind a változásazonosítóba.

- [x] Piros integrációs teszt: a hiányzó entitásmező fordítási hibája a `/tmp/mezo-eiux9-red-persist.log` naplóban. A betöltés, eltérült paletta gyógyítása, saját sor fallbackje és a három GET-paletta ellenőrzése elkészült.
- [x] A `202611241449` UTC-percű Liquibase-fájl, JPA-lista, újraindításkori upsert és API-leképezés elkészült.
- [x] A saját sor `NULL` palettája a régi `stable`/`lengthenedFriendly` szabályt követi; `free/other` üres. 26 célzott teszt, 0 hiba, BUILD SUCCESS; `node scripts/lint-liquibase.mjs` PASS.
- [x] A katalógus-adatbázis és válasz változásai külön commitban rögzítve.

## 4. Egységes szerveroldali jogosultság

**Fájlok:** `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/{CatalogAttributes,Technique,TechniqueRules,TechniqueRecommender,TechniquePrescriber}.java`, `backend/src/main/resources/messages_hu.properties`, `backend/src/main/resources/messages_en.properties`, `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/{TechniqueRulesTest,TechniqueRecommenderTest}.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/train/{ExerciseTechniqueApiIT,MesoTemplateTechniqueIT,TechniqueExclusionIT}.java`.
**Határ:** `CatalogAttributes.Attrs` vigyen explicit `Set<Technique>` palettát; négyparaméteres kompatibilis konstruktora a régi stabilitási alapértelmezést adja a teszteknek/saját soroknak. `TechniqueRules.check(t, challenge, attrs)` a palettát kérje számon, részismétlésnél továbbra is a `lengthenedFriendly` feltétellel; a kihívás külön szabálya érintetlen.

- [x] A palettás szabály piros próbája a hiányzó `TOP_PAUSE` és ötelemű `Attrs` miatt fordításkor bukott. Hammer/Hip/Overhead és a régi stabil/fallback esetek lefedve.
- [x] `Technique.TOP_PAUSE`, explicit `Attrs.allowedTechniques`, közös palettaellenőrzés kész; az automatikus ajánló továbbra is csak `stable` sorokat vizsgál.
- [x] A `TRAIN_TECHNIQUE_NOT_ALLOWED` hibaszöveg névparaméterrel mindkét nyelven kész. A mentési és előírási utak a közös ellenőrzést használják.
- [x] Az eltárolt, utóbb érvénytelenné vált választásra a sablon-, beállítás- és mai edzés regressziója a paletta megváltoztatásával fut. A 4–5. feladat együttes célzott kapuja 138 teszt, 0 hiba, BUILD SUCCESS.

## 5. Megtartás előírása és naplózása a szerveren

**Fájlok:** `backend/src/main/resources/application.yml`, `backend/src/main/java/io/mrkuhne/mezo/feature/train/config/TrainTechniqueProperties.java`, `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/{TechniquePrescriber,TechniqueRules}.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/TechniquePrescriberTest.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/train/{WorkoutTodayTechniqueIT,ExerciseTechniqueApiIT,TrainTechniquePropertiesIT}.java`.
**Határ:** `TrainTechniqueProperties.TopPause.holdSec=2` (`mezo.train.technique.top-pause.hold-sec`); `TechniquePrescriber.apply` a végső munkasorozat másolatára `technique=top_pause`, `topHoldSec=2`, `legs=[]` értéket ír. Súly, reps, RIR, pihenő és a sorozatok száma marad. `TechniqueRules.allowedLegKinds(TOP_PAUSE)=∅`, naplóban a `technique` token megmarad.

- [x] A piros próba a hiányzó `topPause()` konfiguráció miatt fordításkor elbukott. A Hip Thrust záró sorozata, változatlan céladatai, pihenőhét és láb nélküli POST/GET napló lefedve.
- [x] A megtartás 2 mp-e validált konfiguráció; a másolat őrzi az opcionális mezőt, az előírás és a napló egyetlen normál sorozatot használ.
- [x] A 4–5. feladat közös célzott kapuja 138 teszt, 0 hiba, BUILD SUCCESS; a teljes regresszió a 8. feladatban következik.

## 6. iPhone: a szerver palettája a blokképítőben

**Fájlok:** `ios/BoopKit/Sources/BoopCore/Train/{PlanWire,BlockDraft}.swift`, `ios/Boop/EdzesTerv/{TechniquePicker,BlockBuilderPage,PlanPreview}.swift`, `ios/BoopKit/Tests/BoopCoreTests/{BlockDraftTests,BlockDraftEditTests}.swift`.
**Határ:** `WireCatalogItem.allowedTechniques: [String]?`; `DraftExercise.catalogAllowedTechniques: [SetTechnique]?`. Ha a mező jelen van, `allowedTechniques` kizárólag ebből + `.none` értékből épül (`judged` kapu mellett). Ha hiányzik, a régi `stable`/`lengthened` szigorú tartalék szabály él. A kiválasztás ugyanazt a wire tokent küldi a szervernek.

- [x] A három új katalógusválasztás piros próbája a hiányzó `.topPause` miatt fordításkor bukott. A régi szervermező nélküli tartalék szabály, a kihívás és a rossz választás regressziója megmaradt.
- [x] A paletta a betöltésen, hozzáadáson, cserén és másoláson átmegy; a megtartás neve és leírása kész. A tiltási szöveg a konkrét gyakorlathoz kötött.
- [x] A csendes chip is megnyitja a választót, a tiltott sorok indokkal látszanak. A szimulátoros fixture három palettája frissült.
- [x] A célzott BoopKit-tesztek és a Boop app fordítása zöld. A szűk kijelzős vizuális ellenőrzés a 8. feladatban következik.

## 7. iPhone: a megtartás a lejátszóban

**Fájlok:** `ios/BoopKit/Sources/BoopCore/Train/{TrainModels,TrainClient,WorkoutSession}.swift`, `ios/Boop/Edzes/{WorkoutPlayer,PlayerTechnique}.swift`, `ios/Boop/EdzesTerv/{BlockBuilderPage,TechniquePicker,SPEPreview}.swift`, `ios/BoopKit/Tests/BoopCoreTests/{WorkoutTechniqueTests,TrainTechniqueWireTests}.swift`.
**Határ:** `PrescribedSet.topHoldSec: Int?` a régi cache-ből hiányozhat; `PrescribedSet.isTechnique` továbbra is csak a több lépéses technikafolyamatot jelenti. A `SessionExercise.liveTechnique` a láb nélküli `.topPause`-t is felismeri. `WorkoutSession.log` normál `append` előtt a tervezett végső sorozat `technique` értékét a naplózott `SessionSet`-re másolja, **csak** ha a sorozat nincs kibővítve lábakkal; extra, kézzel hozzáadott szett nem örökli.

- [x] A `topHoldSec` nélküli modell miatti fordítási hiba volt a piros próba. A dekódolás, egyetlen naplóbejegyzés, outbox token, újranyitás, régi cache és kézzel hozzáadott extra sorozat lefedve.
- [x] A kliens továbbítja a megtartási időt. A végső Hip Thrust szett előtt és alatt a kért mondat látszik; a kész sor „Fent megtartás · 2 mp”, mini-lépés nincs.
- [x] A Swift-jelölések frissültek; a statikus DEBUG bemutató belépési pontja és fájlja kikerült, mert a végleges lejátszó más elrendezést használ. A jóváhagyott képek a specifikációban maradnak.
- [ ] A célzott BoopKit-tesztek és a Boop app tesztje zöld; szimulátoron az előtte/utána és offline/újranyitás útja működik. `git add ios && git commit -m 'feat(ios): log top pause as one normal set (mezo-eiux9)'`.

## 8. Dokumentáció, teljes kapuk és kiadás

**Fájlok:** `docs/decisions/0059-exercise-specific-spe-eligibility.md` (ha a sorszám közben foglalt, a következő szabad), `docs/features/train.md`, `docs/features/boop-ios.md`, `docs/features/README.md` (csak ha az index leírása változik), `docs/CODEMAP.md` (generált, ha változik), `docs/milestones/roadmap.md` (ha a mérföldkő állapota változik), `.beads/issues.jsonl`. Az infrastruktúra leírását a kiadás előtt olvasd: `docs/infrastructure/deployment-k3s-argocd.md`, `docs/infrastructure/runbook.md`, `ios/README.md`.

- [ ] Írj rövid ADR-t az egyedi paletta mellett hozott döntésről (miért nem elég a `stable` kapu, hogyan marad külön a kihívás). Írd át a Train és Boop élő dokumentáció releváns részeit: a katalógus a paletta forrása, a szerver az egyetlen döntő, a saját sor fallbackje, az új technika és normál naplózás; frissítsd §10 fájltérképét. `node scripts/lint-docs.mjs` → 0 hiba és 0 stale.
- [ ] Teljes helyi kapuk: `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true`; `cd ios/BoopKit && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild test -scheme BoopKit-Package -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -skipPackagePluginValidation -derivedDataPath ../build/kit`; `cd ios && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild test -project Boop.xcodeproj -scheme Boop -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -skipPackagePluginValidation -derivedDataPath build/app`; `ios/scripts/sync-openapi.sh --check`; `node scripts/gen-codemap.mjs --check`; `node scripts/lint-liquibase.mjs`; `git diff --check`. Hiba esetén javítás + érintett kapu újrafuttatása.
- [ ] Valódi iPhone-szimulátorban nézd végig a blokképítő három gyakorlatát, a választó nyitását/választását/tiltását, a lejátszó utolsó sorozatát és a kész naplót; 320 pt körüli/szűk nézet, nagy szöveg, csökkentett mozgás, megszakítás/újranyitás. Az elfogadott képekkel összevetve igazítsd a látványt. Olvasható üres/betöltési/hibás állapot és meglévő kontrollok maradjanak.
- [ ] A dokumentáció/kapuk után `git add docs .beads/issues.jsonl && git commit -m 'docs(train): record exercise SPE behavior (mezo-eiux9)'`. `bd` jegyzetébe a kapuk eredménye, majd `node scripts/check-beads-backup.mjs --fix` és szükség esetén új backup-commit; `bd dolt push`.
- [ ] A projekt Codex-ágmenete szerint `git fetch origin`, a worktree-ből `git checkout --detach origin/main && git merge --no-ff feat/gyakorlat-spe && git push origin HEAD:main`; konfliktust oldj és a kapukat szükség szerint ismételd. A `main` piros CI-je elsőbbséget élvez; merge előtt `gh run list --branch main --limit 1`. Sikeres push után a szerver deployt és az iPhone telepítést kövesd a runbook szerint, ellenőrizd élőben a katalógus palettáját és egy új, tulajdonos által **kézzel választott** technika útját. Termelési adatírás csak külön, konkrét tulajdonosi jóváhagyással történhet; a kód telepítése önmagában nem indok manuális adatírást.
- [ ] `bd close mezo-eiux9` csak az élő ellenőrzés után; backup/push ismét, ág törlése. A magyar átadásban külön szerepeljen a 166 sor auditja, a három aktív blokkgyakorlat eredménye, a tesztek/deploy/telefon ellenőrzése és bármi ténylegesen elmaradt lépés.
