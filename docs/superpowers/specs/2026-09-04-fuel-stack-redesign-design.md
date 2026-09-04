# Fuel Stack újratervezése — következő bevétel, napi ritmus és külön protokoll-oldalak

- **Dátum:** 2026-09-04
- **bd issue:** `mezo-ubxd`
- **Státusz:** interaktív prototípus alapján vizuálisan jóváhagyva (2026-09-04)
- **Prototípus:** a Codex taskban iterált, valódi app-headerrel és cirkadián háttérrel
  megjelenített interaktív Stack prototípus; a kötelező döntéseket ez a dokumentum
  tartósan rögzíti
- **Scope:** frontend-only UI, navigáció és success-toast; backend, OpenAPI, DTO,
  adatmodell és a living protocol mentési szemantikája változatlan
- **Érintett living docs:** `docs/features/fuel.md`,
  `docs/features/_platform-design-system.md`, `docs/features/_platform-notifications.md`

## 1. A probléma

A jelenlegi `/fuel/stack` oldal egyetlen görgetett felületre teszi a napi összegzést,
a négyelemű stat sort, az időívet, a következő bevételt, minden további zónát, az
étkezési párosításokat, az időzítés indoklását és a protokollkezelés belépési pontjait.
Az információk önmagukban hasznosak, de együtt túl sűrűek: a legfontosabb kérdés —
**„mit vegyek be most?”** — nem kap elég vizuális prioritást.

A protokoll kezelése közben ugyanazon a nézeten keveredik a napi végrehajtás és a
hosszabb távú szerkesztés. A `Kamrából` művelet a page headben ül, az egyes tételek
módosítása pedig csak a zónakártyák soraira koppintva fedezhető fel. Bevétel pipálásakor
a mutation lefut, de nincs egyértelmű success-visszajelzés és gyors visszavonási lehetőség.

## 2. Célok

- A főoldal első eleme egyértelműen a következő bevétel legyen.
- A napi állapot egy rövid, háromsoros előnézetben legyen áttekinthető; a teljes ritmus
  külön oldalra kerüljön.
- A teljes protokoll, a napi ritmus, az étkezési kapcsolatok és a kezelés négy külön,
  valódi csempecél legyen.
- A protokollkezelés kapjon saját hubot és elkülönített szerkesztési nézeteket, ne egy
  túlterhelt drawerben vagy a végrehajtási oldalon éljen.
- A fő- és aloldalak ugyanazt a színes, élő Design 2.0 / Huawei Health ihletésű
  vizuális nyelvet használják.
- Kizárólag a projekt saját clay ikonkészlete jelenjen meg; emoji és idegen ikoncsomag
  ne kerüljön a felületre.
- Sikeres bepipálás után név szerinti toast jelenjen meg `Visszavonás` akcióval.
- A meglévő occurrence-alapú protokoll, napi projekció és autosave működés változatlan
  maradjon; a felület ne találjon ki nem perzisztálható beállítást.

## 3. Nem célok

- backend-, OpenAPI-, DTO- vagy adatmodell-változtatás;
- új időzítési szabály, étkezési horgony vagy protokoll-verziózási művelet;
- a `projectStackDay`, `matchMealsToStack` vagy a placement algoritmus módosítása;
- a globális app shell, tabbar, QuickLog FAB vagy AppHeader újratervezése;
- új ikonok rajzolása a meglévő Design 2.0 készlet mellé;
- a Fuel hub vagy a Kamra általános újratervezése.

## 4. Oldalhéj és vizuális szerződés

### 4.1 Valódi app-környezet

Minden Stack route a jelenlegi `AppLayout` alatt marad. Ez biztosítja a valós
`AppHeader`-t, `HeaderAurora` cirkadián hátteret, a `Fuel` section spotot, kalauz-,
üzenet- és értesítésgombokat, a napszak-orbot, az alsó tabbart és a QuickLog FAB-ot.
A Stack nem készít második app-headert és nem imitál telefonkeretet.

A `/fuel/stack` főoldal a közös header után **közvetlenül** a „Most következik”
kártyával indul. Nem jelenik meg külön `Stack` PageHero, `Fuel · csütörtök` sor,
oldalcím vagy önálló visszalépő fejléc. Ezzel a közös shell és az oldal tartalma nem
ismétli egymást. A részletoldalak a közös header alatt egy kompakt, tartalmi
`PageHead` visszalépést használhatnak (`‹ Stack` vagy `‹ Kezelés`), mert ott a
hierarchia jelzése valódi navigációs információ.

### 4.2 Szín, felület és mozgás

- A főoldal sage/coral/gold/lavender/sky csempéket és finom, rétegzett washokat kap.
- Minden aloldalnak van saját domináns színe és vizuális fókusza; egyik sem lehet
  fehér listává egyszerűsített, puritán „admin” oldal.
- A háttér a közös cirkadián canvasból fut a Stack tartalmába; a tartalom nem fest rá
  külön, a shelltől idegen teljes képernyős hátteret.
- A csempékhez kizárólag a `docs/design_2.0/assets/clay-icons.svg` meglévő szimbólumai
  használhatók: `i-stack`, `i-idozito`, `i-recept`, `i-beallitas`, `i-kamra`.
- Egyszeri, staggerelt rise és indokolt progress-fill engedett. Folyamatos animáció
  csak a valóban következő elem visszafogott jelzésén lehet.
- `prefers-reduced-motion` alatt minden belépő és pulzáló mozgás állóképre vált.
- 320, 390 és 430 px szélességen nincs vízszintes overflow, levágott szöveg,
  összenyomott checkbox vagy a tabbar/FAB által takart utolsó művelet.

## 5. Információs architektúra

### 5.1 Stack hub — `/fuel/stack`

#### „Most következik” hero

Az első és legnagyobb kártya a `useStackDay()` következő, még nem kész slotjából
épül. Tartalma:

- `MOST KÖVETKEZIK` eyebrow és az idő pillben;
- saját `i-stack` clay grafika;
- a következő occurrence neve és dózisa;
- egy rövid, meglévő placement reason;
- legalább 44×44 px-es, egyértelmű bevétel-checkbox;
- `takenCount / totalCount` és egy vékony napi progress rail.

Ha a következő slot több occurrence-et tartalmaz, a legelső nem teljesített tétel a
hero fő sora, a többi ugyanabban a slotban a teljes ritmus oldalon marad. A hero
koppintható szövegrésze az occurrence szerkesztésére vezet, a checkbox kizárólag a
bevételt kapcsolja; a két célterület nem fedi egymást.

Ha minden alkalmazható occurrence kész, a hero sage sikerállapotot mutat: `A mai
stack kész`, a napi darabszámmal. Ha nincs aktív occurrence, őszinte üres állapot
jelenik meg `Tétel hozzáadása` CTA-val a Kamra-választó oldalra; nem jelenik meg
`0/0` sikerként.

#### Rövid napi előnézet

A hero alatt a `Mai ritmus` szakasz legfeljebb három releváns sort mutat időrendben:
a legutóbbi elkészültet, a következőt és az utána jövőt. Egy sorban idő, név/dózis és
állapotjel jelenik meg. A `Mind a N` akció a teljes napi ritmus oldalra visz.

#### Négy navigációs csempe

| Csempe | Rövid hub-adat | Tap cél | Clay ikon / tónus |
|---|---|---|---|
| Teljes protokoll | occurrence-ek és zónák száma | `/fuel/stack/protocol` | `i-stack` / sage |
| Mai ritmus | következő idő vagy kész állapot | `/fuel/stack/today` | `i-idozito` / gold |
| Étkezéshez | használható párosítások száma | `/fuel/stack/meals` | `i-recept` / coral |
| Kezelés | hozzáadás és beállítás | `/fuel/stack/manage` | `i-beallitas` / lavender |

A csempék az aktuális hook-adatokat foglalják össze, nem statikus prototípus-számokat.
Mind a négy teljes felületű gomb; nincs külön, apró chevron-only célterület.

### 5.2 Teljes protokoll — `/fuel/stack/protocol`

Ez a living protocol nyugodt, teljes olvasata. Sage hero mutatja az aktív protokoll
nevét/verzióját, occurrence-számát és confidence-ét, majd a tételek a protokoll
zónái szerint csoportosulnak. Minden sorban név, dózis, zóna és a kézi rögzítés
állapota látható. A placement reason kibontva vagy rövid másodlagos sorban jelenik
meg, hogy a „miért itt?” ne vesszen el.

A `Szerkesztés` akció a kezelési protokolloldalra vezet; ez a route nem kever napi
pipálást a hosszabb távú szerkesztéssel.

### 5.3 Mai ritmus — `/fuel/stack/today`

Gold/sky napív és alatta az összes mai slot időrendben. A slotok nem kártyamozaikként
versenyeznek, hanem egy jól pásztázható timeline-ban jelennek meg. Minden occurrence
itt is pipálható, ugyanazzal a success-toasttal és undo-akcióval, mint a hub herója.
A pihenőnapi átköltözés vagy kihagyás a meglévő `projectStackDay()` eredménye alapján,
őszinte státuszként látszik.

### 5.4 Étkezéshez — `/fuel/stack/meals`

Coral hero összegzi, hány mai étkezéshez van értelmes Stack-párosítás. Alatta a
meglévő `matchMealsToStack()` eredményei étkezésenként külön, színes kártyákon
jelennek meg: étkezés, kapcsolt tételek és rövid indoklás. Az oldal read-only;
nem talál ki kézzel menthető kapcsolatot, mert ilyen write contract jelenleg nincs.
Üres állapotban elmagyarázza, hogy a párosítás a mai étkezésekből és a protokoll
időzítéséből képződik.

### 5.5 Kezelés — `/fuel/stack/manage`

A lavender kezelési hub négy nagy, saját céloldalra vezető sort/csempét tartalmaz:

| Cél | Route | Valódi műveletek |
|---|---|---|
| Protokoll tételei | `/fuel/stack/manage/protocol` | dózis, zóna, unpin, további occurrence, eltávolítás |
| Időzítési rend | `/fuel/stack/manage/timing` | occurrence-ek zónánkénti áttekintése és mozgatása |
| Étkezési horgonyok | `/fuel/stack/manage/meals` | meal-bound zónák áttekintése és a tételek mozgatása |
| Új tétel a Kamrából | `/fuel/stack/manage/add` | keresés és `addItem` |

Minden sor a meglévő állapotból számolt alcímet kap. Nem jelenhet meg olyan
`Mentés` gomb vagy kapcsoló, amelyhez nincs valós mutation.

#### Protokoll tételei

Az occurrence-ek tömör, színes kezelési kártyákon jelennek meg. Tételre koppintva a
meglévő `StackItemSheet` funkciói érhetők el: dózismódosítás, zónaváltás, unpin,
további occurrence és eltávolítás. A sheet vizuálisan a megújult oldalhoz igazodik,
de a mutationök és az autosave változatlanok.

#### Időzítési rend és étkezési horgonyok

Ezek nem új szabály-editorok. A meglévő occurrence-ek két célzott vetületei:

- az időzítési oldal az összes zónát és occurrence-et időrendben mutatja;
- az étkezési oldal a `breakfast`, `lunch` és `dinner` zónákat emeli ki.

Mindkét oldalon ugyanaz a valós zónaváltás nyílik meg a tételről. A prototípusban
szereplő külön `Mentés` gombok a termékbe nem kerülnek át, mert a living protocol
minden módosítása automatikusan mentődik.

#### Új tétel a Kamrából

A jelenlegi `StackPickerSheet` kereshető polclistája teljes oldalra költözik. A sor
mutatja a nevet, brandet, dózist, típust és azt, hogy a tétel már szerepel-e a
stackben. Hozzáadás után az oldal nyitva marad, így több tétel is felvehető; sikeres
mutation után rövid success-toast jelenik meg. A duplikált item+zone hibája továbbra
is a globális mutation-error toastban jelenik meg.

## 6. Komponens- és route-architektúra

Új route-oldalak a `frontend/src/features/fuel/pages/` alatt:

- `FuelStackPage.tsx` — az új hub;
- `FuelStackProtocolPage.tsx`;
- `FuelStackTodayPage.tsx`;
- `FuelStackMealsPage.tsx`;
- `FuelStackManagePage.tsx`;
- `FuelStackManageProtocolPage.tsx`;
- `FuelStackManageTimingPage.tsx`;
- `FuelStackManageMealsPage.tsx`;
- `FuelStackAddPage.tsx`.

A közös, Fuel-domain presentational elemek a
`frontend/src/features/fuel/components/` alatt élnek, például a következő-bevétel
hero, a kompakt rhythm row, a Stack tile és a kezelési occurrence row. Nem készül
új domainfüggő `shared/ui` komponens, és nem készül feature barrel.

A `frontend/src/app/router.tsx` explicit statikus route-okat regisztrál. A meglévő
`StackItemSheet` megmarad a részletes occurrence-műveletekhez; a
`StackPickerSheet` nyugdíjba kerül, miután minden fogyasztója az új add oldalra mutat.

## 7. Adatfolyam és állapotok

Az új UI kizárólag a meglévő frontend data boundaryt használja:

- `useStackDay()` — mai slotok, occurrence-ek, stash, edzésnap, ébredés és lefekvés;
- `useProtocol()` — protokoll-meta és read-state;
- `useStack()` — Kamra/stash és read-state;
- `useStackActions()` — napi log/undo;
- `useProtocolActions()` — add/move/dose/unpin/remove;
- `useFuelDay()`, `useRecipes()` és `matchMealsToStack()` — étkezési párosítás;
- `useFuelWeek()` — kizárólag ott, ahol az adherencia ténylegesen megjelenik.

Nincs új REST-hívás és nincs kliensoldali shadow protocol. A hub, a részletoldalak
és a kezelési oldalak ugyanazt a query cache-t olvassák, ezért egy módosítás után
nem tarthatnak egymástól eltérő lokális másolatot.

Pending állapotban a számszerű hero- és csempeadatok skeletont kapnak. Real-mode
read hiba vagy üres protocol esetén seedből származó adat nem jelenhet meg. A már
létező globális mutation-error toast az egyetlen write-error visszajelzés; success
állapot csak a mutation valódi feloldása után jelenhet meg.

## 8. Pipa-toast és azonnali visszavonás

Sikeres, új bevétel logolásakor a globális toast host ilyen üzenetet kap:

`{Tétel neve} bevéve` · **Visszavonás**

A toast csak a log mutation sikeres feloldása után jelenik meg. Hiba esetén nincs
optimista sikerüzenet; a globális mutation-error toast marad látható.

Az azonnali undo nem támaszkodhat arra, hogy a log utáni refetch már biztosan
befejeződött. A `useStackActions().logIntake` Promise-a ezért visszaadja a létrehozott
intake azonosítóját real és mock módban is, a toast akciója pedig ezt az exact sort
törli. A normál, már renderelt pipa kézi kikapcsolása továbbra is a
pantryItemId+slotKey feloldást használhatja.

A `SimpleToast` opcionális, egyetlen `{ label, onClick }` akciót kap. A
`ToastProvider` ezt valódi buttonként, a bezárástól elkülönítve rendereli; aktiválás
után meghívja az akciót és bezárja az adott toastot. A toast akciója billentyűzetről
elérhető, fókuszjelzett és nem nyújtja 44 px alá a célterületet. Reward toast nem
kap akciót, a meglévő toast payloadok változatlanul érvényesek maradnak.

## 9. Hozzáférhetőség és interakció

- A checkboxok `aria-label` értéke név szerint jelzi a műveletet, például
  `Kreatin bevétel jelölése` / `Kreatin bevétel visszavonása`.
- A csempék button/link szemantikájúak; billentyűzettel és screen readerrel az egész
  kártya egyetlen érthető cél.
- A progress railhez szöveges `N / M bevéve` érték társul; a szín önmagában nem
  hordoz állapotot.
- A sage, gold, coral, lavender és sky felületek minden szövege eléri a projekt
  kontrasztkövetelményét világos, Cirkadián és Pulse módban.
- A sticky app chrome és a sheet portal fókuszkezelése a meglévő primitive-eket
  használja; új kézi focus trap nem készül.

## 10. Tesztelési szerződés

### Komponens- és oldaltesztek

- a hub első tartalmi eleme a `Most következik` hero, és nincs duplikált `Stack`
  PageHero vagy `Fuel · nap` sor;
- a hero a valódi következő occurrence-et, dózist, időt és reasont mutatja;
- all-done és honest-empty állapot külön renderel;
- a napi előnézet legfeljebb három sort mutat, a `Mind a N` a today route-ra visz;
- mind a négy csempe a megfelelő route-ra navigál és hook-adatból képez alcímet;
- minden új route közvetlen MemoryRouter belépéssel renderel és a visszaút helyes;
- protocol/timing/meals oldalak nem gyártanak nem létező write-állapotot;
- a kezelési occurrence műveletek a meglévő `useProtocolActions` hívásait használják;
- a Kamra-add oldalon a keresés, occupied jelzés és többszörös hozzáadás működik;
- sikeres pipa után név szerinti success-toast jelenik meg; pending és rejected
  mutation alatt nem;
- a toast `Visszavonás` pontosan a frissen létrehozott intake sort törli akkor is,
  ha a list-query refetch még nem ért véget;
- a toast action billentyűzetről aktiválható és csak a saját toastját zárja;
- real módban továbbra sem történik `/api/goals` kérés;
- reduced-motion alatt nincs belépő vagy végtelen animáció.

### Vizuális gate

A `/fuel/stack`, `/fuel/stack/today`, `/fuel/stack/protocol`,
`/fuel/stack/meals` és `/fuel/stack/manage` legalább 390 px-en screenshot-gate-et
kap. A főoldalt emellett 320 és 430 px-en is ellenőrizni kell, világos és legalább
egy alternatív theme/mode állapotban. A screenshot a teljes app shellt tartalmazza,
így a header, a cirkadián háttér, a tabbar és a FAB illeszkedése is regressziós
szerződés.

### Minőségi gate-ek

```bash
cd frontend
pnpm build
pnpm test
VITE_USE_MOCK=true pnpm test
```

Az új route-ok után `node scripts/gen-codemap.mjs` fut; a generált
`docs/CODEMAP.md` kézzel nem szerkeszthető. A Fuel és az érintett platform living
docok frissítése után:

```bash
node scripts/lint-docs.mjs
```

Végül `git diff --check` és a fókuszált browseres vizuális ellenőrzés kötelező.

## 11. Tudatos eltérések a prototípustól

- A termékben a valódi `AppHeader`, `HeaderAurora`, tabbar és QuickLog FAB renderel;
  a prototípus ezek vizuális másolata csak az illeszkedés ellenőrzésére szolgált.
- A hubon nincs saját topbar vagy `Stack` oldalhero; a tartalom a közös header alatt
  a következő kártyával indul.
- A kezelési prototípus `Mentés` gombjai nem kerülnek át: a living protocol jelenlegi
  mutationjei autosave-ok, ezért egy külön mentésgomb hamis állapotot ígérne.
- Az időzítési és étkezési kezelőoldalak a meglévő occurrence-ek célzott vetületei,
  nem új, backend nélküli szabály-editorok.
- Minden prototípus-szám és név helyére a jelenlegi hookok valós vagy mock adatforrása
  kerül.

## 12. Kockázatok

- **Az undo-cache race:** ha a toast csak pantryItemId+slotKey alapján töröl, egy
  azonnali tap refetch előtt no-op lehet. Az exact created intake id kötelező.
- **Túl sok új oldal, duplikált logika:** a route-oldalak a közös Fuel komponenseket
  és ugyanazt a `useStackDay` projekciót használják; nem másolhatják szét az
  occurrence-rendezést vagy a státuszképzést.
- **Látszat-szerkesztés:** új toggle vagy Mentés csak valódi mutationnel kerülhet be.
- **Shell-ütközés:** a feature CSS nem pozicionálhat saját fix headert/tabbart, és
  nem írhatja felül az AppLayout safe-area szerződését.
- **Toast visszafelé kompatibilitás:** az opcionális action nem változtathatja meg a
  meglévő simple és reward toastok elrendezését, időzítését vagy queue-viselkedését.
