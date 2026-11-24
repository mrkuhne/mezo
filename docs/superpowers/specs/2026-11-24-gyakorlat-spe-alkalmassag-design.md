# Gyakorlatonkénti SPE-alkalmasság és csúcsponti megtartás

**Dátum:** 2026-11-24 · **Állapot:** tervezet, tulajdonosi jóváhagyásra · **Ügy:** `mezo-eiux9`  
**Felület:** Boop, edzésterv-szerkesztő és edzéslejátszó; szerveroldali gyakorlatkatalógus és edzésmotor.

## 1. Miért változik

A katalógus `stability=free` értékét az app jelenleg minden SPE kizáró okának tekinti, és ezt
„szabadsúlyos” szöveggel magyarázza. A stabilitás és a használt eszköz nem ugyanaz: a katalógusban
megtámasztott kézisúlyzós gyakorlatok is lehetnek `stable` értékűek. A Hammer Curl és a rudas
Hip Thrust eszközadata helyes, de a közös stabilitási kapu a hozzájuk illő technikákat is elrejti.
Ez **viselkedési hiba** és félrevezető indoklás, nem hibás eszköznév.

Tulajdonosi döntés, 2026-11-24: az SPE-alkalmasság gyakorlatonként és technikánként legyen
meghatározva; Hammer Curlhez Myo set, pihenős drop és Drop set választható; a rudas Hip Thrusthoz
új, 2 másodperces csúcsponti megtartás tartozzon; a nehéz Overhead Press maradjon SPE nélkül.

## 2. Határ és elfogadás

- A **166 központi katalógustétel** mindegyikének legyen kifejezett, felülvizsgált SPE-palettája.
  A jelenleg `stable` gyakorlatok meglévő lehetőségei a felülvizsgálat kiindulópontjai, nem
  automatikusan érvényesek egy másik, hasonló nevű gyakorlatra. A `free` gyakorlatok nem kapnak
  automatikusan technikát csak az eszközük vagy az `isolation` típusuk miatt.
- A jelenlegi lista: 57 `stable` (17 összetett, 40 izolációs) és 109 `free` (64 összetett, 29
  izolációs, 16 ugró). Nem szerepel gép / kábel eszközű, de `free` stabilitású sor. Az első
  paletta a stabil 57 sor jelenlegi technikáit megtartja; a 109 `free` sor közül csak az
  alább név szerint engedett mozdulatok kapnak új technikát. Ez tudatosan szűk kezdés, nem
  eszközfajta szerinti automatikus engedély.
- A Hammer Curlnél `myo`, `rest_drop`, `drop`; a Hip Thrustnál `top_pause` választható. A
  Cross-Body Hammer Curl és más rokon mozdulatok külön sorok: az egész katalógus felülvizsgálata
  során külön alkalmassági döntést kapnak, a nevükből nem örökölnek jogot.
- A 2 másodperces megtartás az **utolsó munkasorozat minden ismétlésének felső pontján** történik.
  A sorozatok száma, az ismétléstartomány, a tervezett súly és a tartalék változatlan. A telefon
  nem próbálja automatikusan megmérni az egyes ismétlések idejét; az utasítást mutatja, és a
  napló a választott technikát rögzíti a normál sorozat mellett.
- Az Overhead Press és a nem engedélyezett technikák a kiválasztóban láthatók, de az adott
  gyakorlatra nem választhatók. Az indok az **adott technika** hiányzó alkalmasságát mondja el;
  a `free` értéket nem nevezi „szabadsúlynak”.
- A nap félismétléses kihívásának külön szabálya és a kímélő / pihenőhetes SPE-elnyomás nem
  változik. Már naplózott sorozat nem módosul. A futó blokkban semmi nem kapcsolódik be magától:
  a tulajdonos maga választja ki az újonnan engedett technikát.

## 3. Meglévő működés és a hiba helye

| Határ | Most | Változás |
|---|---|---|
| Katalógus | A JSON 166 sort és `equipment`, `stability`, `lengthenedFriendly` adatot tölt be. | Kifejezett `allowedTechniques` lista gyakorlatonként; a betöltő minden master sornál ellenőrzi és frissíti. |
| Szerver | `TechniqueRules.check` minden SPE-re `stable` értéket követel. | A kiválasztott technikát a gyakorlat listájával ellenőrzi; a részismétlés további nyújtott-helyzet feltétele megmarad. |
| Telefon | `DraftExercise.allowedTechniques` ugyanazt a stabilitási kaput másolja, `unavailableReason` „szabadsúlyos” szöveget mutat. | A szervertől kapott palettát használja; régi válasz esetén a korábbi szigorú szabály a tartalék. |
| Edzés | Minden technika a végső munkasorozatra kerül; a lejátszó külön lépésekre bontja a dropot, myót és félismétlést. | `top_pause` az utolsó sorozat **normál** naplózásával működik, extra lépés és plusz sorozat nélkül. |

Kapcsolódó helyek: `backend/.../train/ExerciseCatalogLoader.java`, `service/CatalogAttributes.java`,
`service/TechniqueRules.java`, `service/TechniquePrescriber.java`, `api/feature/train/train.yml`,
`ios/BoopKit/Sources/BoopCore/Train/{BlockDraft,WorkoutSession,TrainModels}.swift`,
`ios/Boop/EdzesTerv/TechniquePicker.swift`, `ios/Boop/Edzes/{WorkoutPlayer,PlayerTechnique}.swift`.

## 4. A képernyőn

Az edzéstervben a technika gomb ugyanott marad. Hammer Curlnél a három engedett módszer aktív;
a többi halvány és egy rövid, konkrét okot mutat. Hip Thrustnál az új **„Fent megtartás · 2 mp”**
aktív. Más gyakorlatnál csak a saját listája jelenik meg aktívként. A „Sima sorozatok” mindig
választható. Ha egy soron sem technika, sem kihívás nem választható, a csendes címke például
„Ehhez a gyakorlathoz nincs SPE”; nem állítja, hogy a gyakorlat más eszközzel készül.

Az edzéslejátszó a Hip Thrust utolsó munkasorozata előtt és alatt ezt mondja: **„Minden
ismétlés tetején tartsd meg 2 másodpercig.”** A súly, ismétlésszám és tartalék a normál
előírásból jön. A sorozat ugyanazzal az egy rögzítéssel készül el, nincs extra számláló vagy
időzítő. A kész sorozat és az edzés összefoglalója megnevezi a technikát. Kihagyás,
visszatérés, kapcsolatvesztés és újranyitás a normál sorozat útját követi.

A szimulátoros próba az edzéstervben a három választást, a letiltott sorok indokát, az
Overhead Press csendes állapotát, valamint az edzéslejátszó Hip Thrust sorozatának előtte / utána
állapotát mutatja; kis iPhone-szélességen és csökkentett mozgással is.

## 5. Adat és szerverhatár

- A katalógussorhoz `allowed_techniques` lista kerül; a master lista a verziózott JSON-ból
  érkezik. A szerver ugyanazt a listát adja vissza a katalógus-API-ban, amelyet a mentés és
  az edzés előírásának ellenőrzése használ. Így a telefon nem vezet párhuzamos szabályt.
- A 166 master sor mindegyike kifejezett listát kap, a betöltő hiányzó / ismeretlen / ismételt
  értékre induláskor hibát ad. A teljes audit minden sornál ellenőrzi a mozdulatot, a
  felszerelést és az egyes SPE-k végrehajthatóságát. A felülvizsgált tábla a katalógus JSON-ban
  él, nem egy második dokumentumban. Egy későbbi katalógusbővítés új sorát is kötelező besorolni.
- A saját gyakorlatoknál a szerver a meglévő `stable` / `lengthenedFriendly` értékből ad
  kompatibilis alapértelmezést, amíg nincs kifejezett lista; az ismeretlen `other/free` sor üres
  listát kap. A saját sorok SPE-palettájának külön szerkesztője nem része ennek a javításnak.
  A központi sorok tartalma továbbra is csak a verziózott katalógusból változik.
- `top_pause` új technikaazonosító. Az előírt sorozat opcionális `topHoldSec=2` értéket kap;
  nincs új `SetLegKind` vagy extra lábsor. A napló a sorozat `technique=top_pause` értékét
  tárolja, az időt nem teszi megfigyelt ténynek. A szerver a technikát plusz munkának számolja
  a jelenlegi SPE-keretben, de nem tesz hozzá ténylegesen naplózott sorozatot vagy tonnát.
- A meglévő mentési útvonalak ugyanazzal a palettával validálnak. Hibás választásra 400-as,
  névvel és indokkal lokalizált hiba jön. Ha egy már eltárolt választás később érvénytelenné
  válik, a meglévő elv szerint a mentéskor kiesik, az aznapi előírás pedig sima sorozatra vált.
- A tervező és az AI első körben nem helyez automatikusan új SPE-t `free` gyakorlatra; az új
  választás tulajdonosi. A meglévő `stable` gyakorlatokra vonatkozó ajánlások nem romlanak.

## 6. Ellenőrzés és kiadás

Szerveroldali integrációs próba: mind a 166 master sor betöltése, a konkrét engedett / tiltott
technikák és a hibakódok; futó blokk mentése és aznapi előírás; `top_pause` változatlan súly,
ismétlés, tartalék és extra lépés nélkül; régi stabil gyakorlat, pihenőhét, kímélő nap és
kihívás regressziója. Telefonos próbák: a választó, az indokok, a normál sorozatként naplózott
csúcsponti megtartás, újranyitás. A katalógus és a szerver / telefon palettája egyezzen meg.

Kiadási sorrend: **koncepció jóváhagyása → szimulátoros próba jóváhagyása → megvalósítási terv
jóváhagyása → szerződés és szerver → telefon → helyi próbák → egyesítés és feltöltés → telepítés
és élő ellenőrzés**. Az élő adatot a kód nem írja át külön művelettel; a katalógus a szokásos
indulási betöltéssel frissül. A tulajdonos meglévő terve változatlan marad, amíg ő nem választ
új technikát.

## 7. Nyitott technikai részlet

A szimulátoros próbában dől el a pontos rövid címke és a lejátszó utasításának elhelyezése.
A szolgáltatott API mezők neve és a katalóguslista tárolási típusa a megvalósítási tervben
rögzül; a fent leírt viselkedés és adatfolyam nem változik ettől.
