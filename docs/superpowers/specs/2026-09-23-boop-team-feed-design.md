# Boop csapat-üzenőfal — social fal + karakter-narratíva (design spec)

Dátum: 2026-09-23 · Állapot: **jóváhagyott prototípussal, spec review alatt**
Előzmény: Boop V3 social navigáció (`mezo-dcuyw`, ADR 0049) · vizuális kánon: restored-world
style bible + ADR 0032/0033 (Huawei/Mozaik csempe→oldal idióma).
Jóváhagyott prototípus: **[`docs/design_2.0/prototypes/uveg-uzenofal.html`](../../design_2.0/prototypes/uveg-uzenofal.html)**
(a social-fal az **üveg-kánonban** — 2026-09-23 este az owner jóváhagyta, a poszt-panelek
tagolásával és a karakterhangú szövegekkel együtt). Történeti előzmény:
[`assets/boop-team-feed-v3.html`](assets/boop-team-feed-v3.html) (a világos Mozaik-változat,
amelyen a szerkezeti döntések születtek).

> **Vizuális kánon-váltás, 2026-09-23:** az egész app a sötét **üveg-anyagra** vált
> (Üvegesítés program, epic `mezo-me75u`, `/uvegesites` skill, üveg style bible). Ez a spec
> minden felülete az üveg-kánonban készül, **csak sötét módban**; a §3-ban leírt anatómia a
> jóváhagyott üveg-prototípus szerint értendő. A Mezo-domain üvegesítés-szeleteivel (U8/U9)
> ez az epic ad tartalmi irányt — azok e spec felületeit kapják meg.

## 1. Vízió

A Mezo-világ főszereplője az **5 boop karakter** — egy csapat, amely folyamatosan figyeli
a felhasználót, és megfigyeléseit egy **social-media-szerű üzenőfalon** posztolja. A
felhasználó reagál és hozzászól; ebből épül a róla szóló tudás. A mai „developer-módú”
funkciórács (minták, előrejelzések, kísérletek, diagnózis, tudástár, memoár…) tartalma a
karakterek narratíváján keresztül jut el hozzá; a nyers rács dev-menüként megmarad, de
lekerül a főútvonalról.

**A tervezési képlet: a fal social-logikával épül, a mélység Huawei/Mozaik-logikával.**

## 2. Jóváhagyott döntések (a brainstorm sorrendjében)

1. **Főoldal:** az üzenőfal a főoldal, tetején az 5 karakter állapotsávjával (hibrid).
2. **Szereposztás:** 5 főszereplő + állandó mellékszereplők. A mai 7+2 backend-persona
   beolvad: szomnológus→**Alvás**, edző+drill→**Mozgás**, táplálkozó→**Étkezés**,
   pszichológus+doki→**Közérzet**, antropológus+Mezo→**A csapat**. A **Szkeptikus** és
   **Mezo** (döntéshozó) külön figuraként él tovább a beszélgetésekben; a Szkeptikus nem
   posztol, nem kap story-kört.
3. **Ritmus:** reggeli felütés → napközben csak „kopogtatás” (döntés/kérdés/kérés) →
   **esti szertartás**: naponta egyszer 3–6 válogatott poszt (2026-09-24: 2–4 → 3–6, 21:00, lásd
   [a II. felvonás specjét](2026-09-24-csapatfal-act2-esti-kiadas-design.md)). Keveset, de várhatót; a fal
   2 perc alatt elolvasható. A többi a naplóban marad, visszakereshetően.
4. **Karakter-profilszobák:** a régi funkcióoldalak tartalma az 5 karakter szobáiba
   költözik (mit figyel most · mit tanult meg rólad · mit kér tőled), a területfüggetlen
   dolgok (memoár, heti, tudástár egésze, konzílium) **A csapat** (Mezo) szobájába. A mai
   12-csempés rács **dev-menü**: a Gépterem mellől és az „Összes funkció” ajtóról nyílik,
   nem fül.
5. **Navigáció:** dokk = **Üzenőfal · A csapat · Rólad · Emlékek**. A fal tetejének
   karakterkörei és A csapat fül kártyái ugyanoda visznek (egy cél, két út). A falról
   nyíló mélyoldalakon az Üzenőfal fül marad kijelölve — a kijelölés nem ugrál.
6. **Hidegindítás:** a bemutatkozás maga is posztokban történik (a Kalauz buborék-sorozat
   megszűnik). Mind az 5 boop bemutatkozó posztot ír a saját hangján; az első hetekben
   minden poszt őszintén jelzi az érettségét („0/8 nap · ismerkedünk”). Demó-tartalom
   (kitalált poszt) tilos — ADR 0049 vasszabálya érvényben marad.
7. **Nevek és nyelv:** saját név + terület-alcím (munkanevek a prototípusban: Szunya·alvás,
   Mocor·mozgás, Falat·étkezés, Derű·közérzet, Mezo·a csapat — a végleges nevek owner-döntés).
   Három nyelvi vasszabály: (a) tegeződő, beszélt magyar, zéró szaknyelv („intake”,
   „7-day MA”, „±0.3 kg” tilos); (b) minden állítás mellett „Miből látszik?”; (c) a
   bizonytalanság magyarul is bizonytalan („lehet”, „kezd úgy tűnni”, „még csak sejtem”).
   Karakterenként írott stílus-szabály (hangkönyv) készül.
8. **Egységes hármas gombkészlet** minden poszton: 👍 **Ez talál** · 👎 **Nem így érzem** ·
   💬 **Elmesélem** (ikonok a kánoni ikonkészletből, sosem emoji). A „Nem így érzem” a
   legértékesebb: a karakter visszakérdez és láthatóan feljegyzi. A döntés utóélete a
   poszton marad („Megerősítetted · bekerült a rólad szóló képbe”). A napközbeni döntés
   nem külön gombkészlet, hanem kérdés-poszt ugyanezzel a hármassal.
9. **Két felvonás:** I. a színpad — az új főoldal a meglévő, valós tartalomból (a mai
   findingok karakterposztként, profilszobák, gombok, bemutatkozás); II. a hang — az esti
   szertartás gépezete: saját hangú, válogatott esti posztok és területeken átívelő
   beszélgetések (az ADR 0049-ben nyitva hagyott cross-engine témaszál backend-bővítése).
10. **Élő-adat kiegészítések** (2026-09-22-i éles vizsgálat alapján):
    - *Láthatóság:* a már létező findingok (élesben 6 döntésre váró minta ült olvasatlanul)
      a falon posztként jelennek meg — ez önmagában megszünteti a „lassú” érzés nagy részét.
    - *Adatéhség mint párbeszéd:* ha egy boop kevés adatból dolgozik, ő maga kéri a falon
      („két hétből 4 estéről tudom… ha ma bejelentkezel…”), CTA-val.
    - *A „gyűlik” állapot is tartalom:* a küszöb (min-n=8) alatt 5 közös naptól őszinte
      „még csak sejtés” poszt mehet ki — a köztes izgalom nem vész el.
    - *(2026-09-24: a kritikus-újrahangolást a `mezo-hben1` grounded ága szállítja — az alábbi
      „mind eldobta” állapot addig volt igaz.)*
    - *Szabad AI-felfedezés felszabadítása:* az éjszakai hipotézis-javaslatokat a belső
      kritikus 2026-08-30 óta mind eldobta (keep floor vs. statisztika-nélküli-új-ötlet
      csapda). Újrahangolás: a sejtés alacsony, őszinte bizalommal szülessen meg, a szigor
      a *megerősítésnél* legyen. **Külön hibajegyet is kap**, az új felülettől függetlenül.
    - *Az Étkezés boop napi műsora:* a kaja folyamatos értékelése három szólamban —
      a tányér (önmagában) · a cél (súly/deficit) · az edzés (teljesítmény-kapcsolat).
    - *Kérdéslista-bővítés + gyakoribb előrejelzés:* a II. felvonás után.

11. **Üveg-kánon, sötét-only (2026-09-23):** anyag a Titaniumtól (üvegkártya gradiens-kerettel,
    fényfutás, derengés, 3D ikonkészlet), színek a Mozaiktól, alap a meleg grafit `#191614`.
    A fal rangsora: a nap posztere az egyetlen üvegdoboz; a csendes posztok halvány, lekerekített
    lapos panelben ülnek (leheletnyi kiemelés + vékony keret — jól látható poszthatárokkal,
    üveg-tulajdonságok nélkül); a csapat-sorok és szoba-sorok üvegben, karakterszín-kerettel.
    A chrome (fejléc + alsó üveg-menü az élő Booppal) a `fuel-uveg.html`-ből jön, változatlanul.
    Négy új ikon készült a Titanium-receptben (Ez talál, Nem így érzem, Küldés, Kísérlet) —
    owner-jóváhagyással a közös készletbe kerülnek.
12. **Karakterhang-szabály (2026-09-23):** a posztok és hozzászólások nem egymondatosak —
    2–4 mondat, konkrét számokkal, kiemelésekkel, a karakter saját hangján, mértékkel adagolt
    **emojival a szövegben** (Szunya 🌙, Mocor ⚡💪, Falat 🍽️🥦, Derű 🌤️, Mezo 📔✅; a
    Szkeptikus szárazon, emoji nélkül). Az emoji KIZÁRÓLAG a karakterek mondataiban élhet —
    a felület glifái (gombok, csempék, ikonok) továbbra is a sprite-készletből jönnek, emoji ott
    tilos marad.

## 3. A fal anatómiája (a jóváhagyott üveg-prototípus szerint)

**Oldal-csontváz, fentről:** aurora-fejléc (felület, nem sáv; napszak-színű) → „Üzenőfal”
cím (Geist, sans) → **story-sáv** → „N új bejegyzés” korong (időzítve, sosem szúr be
tartalmat görgetés közben) + lehúzásra frissítés → a fal.

**Story-sáv:** az 5 boop köre. Színes (konikus gradiens) gyűrű = ma van új mondanivalója;
szürke = már láttad; piros pötty = döntést vár tőled. Koppintás = a karakter szobája,
és a gyűrű elszürkül.

**A fal ritmusa — három súly:**
- *Csendes poszt (alap):* laposan a lapon, hajszálvonal-elválasztóval (X/Threads-ritmus).
- *A nap posztere (naponta EGY):* Mozaik wash-poszter az esti kiadás legfontosabb
  darabjának — a képernyő egyetlen hangos eleme (style bible §3.4).
- *Ritmustörők:* nap-elválasztók (MA · TEGNAP·ESTI KIADÁS · VASÁRNAP·KONZÍLIUM), heti modul.

**Poszt-anatómia (platform-kánon, sorrendhelyesen):** fejléc (figura · név · terület-jelvény
· idő · ⋯ menü) → szöveg (3 sor fölött „továbbiak” csonkolás) → **média-blokk = adat-grafika**
(rajzolódó görbe, sávok, napcellák, zsetonok — a mi „fotónk”) → **összesítő sor a gombok
felett** (mini-figurák + „Falat egyetért, a Szkeptikus vitatja · 3 hozzászólás”) → balra
zárt könnyű akciósor számlálóval → 1 hozzászólás előnézetben → „Mind az N hozzászólás” →
válaszmező. A ⋯ menü: Miből látszik? · A téma története · Ritkábban ilyet.

**Mélység (csempe→oldal):** posztra koppintva a poszt saját oldala csúszik be (színezett
hero: karakter + nagy állítás; teljes szál; bizonyíték). Karakterre koppintva a profiloldal:
hero (figura + érettség), alatta az ő mozaik-csempéi, mind saját oldalra nyit.

**Mozgás:** egy-lövéses belépő koreográfia (lépcsőzetes rise), rajzolódó vonalak, kinövő
sávok, felpattanó pontok, számfelfutás — mind `prefers-reduced-motion` védelemmel; utána csend.

**Poszt-műfajok (I. felvonásban, mind létező rekordból):** megfigyelés · két-karakteres
közös ügy (Szkeptikus-ellenvetéssel, Mezo-döntéscsíkkal) · „még csak sejtés” (őszinte
n/8 sávval) · kísérlet-állás (napcellák) · napi kaja-értékelés (három szólam) ·
lezárt előrejelzés (bevált/nem — „ez is számít” hanggal) · konzílium-összefoglaló
(+N bekerült / nyugdíjazva / visszadobva) · kérés (adatéhség, CTA) · bemutatkozó/mérföldkő.

**AI-jelzés:** halk — a clay figura önmagában jelzi; plusz apró jelvény a névsorban.
Nem harsány címke posztonként.

## 4. Gazdi-térkép (minden mai AI-funkció új helye)

| Boop | Beolvadó personák | Amit örököl |
|---|---|---|
| **Alvás** (mn. Szunya) | szomnológus | alvásminták, alvás-előrejelzések/-kísérletek, alvás-észrevételek |
| **Mozgás** (mn. Mocor) | edző, drill | edzés/terhelés-minták, edzés-kísérletek, mozgás-javaslatok, logolási fegyelem |
| **Étkezés** (mn. Falat) | táplálkozó | étkezésminták, kalória/súly-előrejelzések, kaja-kísérletek, napi három-szólamú értékelés |
| **Közérzet** (mn. Derű) | pszichológus, doki | stressz/hangulat-minták, check-in észrevételek, mérések/egészségjelek, gyógyszer-összefüggések |
| **A csapat** (Mezo) | Mezo, antropológus | heti konzílium + értékelés, memoár (krónikás), diagnózis (ügygazda), tudástár + életesemények, mérföldkövek |

Szabályok: (1) minden findingnak pontosan egy gazdája van — a jel területcímkéje dönt
(sleep/train/fuel/mind, már ma is létezik); ami két területet köt össze, az a két boop
*beszélgetése* (a megfigyelőé a poszt, a következmény gazdája hozzászól). (2) Ami a
gépezetről szól (futások, detektorok, memória-csővezeték, adatforrások, költség), az a
**Gépterem** — user-felületen soha. (3) Egy döntés egy helyen él (a heti „tanulságok” és a
tudástár-postaláda, ill. a memória-audit és a ténylista duplikációja megszűnik — a többi
felület csak odamutat).

## 5. Prior art

- **WHOOP / Oura Advisor** — „insight, never raw data”: minden poszt állítás + ok +
  javaslat köznyelven, a nyers metrika csak támogató grafika. Átvéve. A szaknyelv-szivárgás
  ismert bukási mód — a nyelvi vasszabályok ezt zárják ki.
  (https://www.925studios.co/blog/whoop-design-breakdown · https://ouraring.com/blog/oura-advisor/)
- **Duolingo világ-karakterek** — a rendszerüzenet karakterhez kötve, szigorúan
  megkülönböztetett hangokkal és saját területtel; e nélkül „öt avatar, egy bot”. Átvéve
  (hangkönyv karakterenként). (https://blog.duolingo.com/character-voices/)
- **Stanford Generative Agents** — megfigyelés→reflexió→terv rétegzés; a hihetőség kulcsa,
  hogy az ügynökök *konkrét megjegyzett adatra* hivatkoznak, és egymás közt is terjed az
  információ. A csapat-boop = a szintézis-réteg. Grounding nélküli ügynök-csevej = forgatókönyv-
  szagú töltelék — tilos. (https://arxiv.org/abs/2304.03442)
- **Spotify Wrapped** — kurált, ütemezett szertartás: kevés, értelmezett, várt tartalom.
  Az esti kiadás mintája. A kimerítő napi jelentést elvetettük. (https://uxplaybook.org/articles/spotify-wrapped-ux-design-lessons)
- **Finch** — az érett társ-app soha nem mutatja a belsőt fő felületként; a rács
  dev-menüvé fokozása biztonságos. (https://screensdesign.com/showcase/finch-self-care-pet)
- **Facebook feed-anatómia** — kártya-sorrend: fejléc → tartalom → média → *külön
  számláló-sor* → akciósor → hozzászólás-előnézet + „mind az N”; „új posztok” korong,
  sosem auto-beszúrás. Szinte egészében átvéve. (https://dev.to/zeeshanali0704/frontend-system-design-facebook-news-feed-li3)
- **Instagram stories-gyűrű** — gradiens = új, szürke = látott; a gyűrű maga az
  olvasatlan-UI. Átvéve az 5 karakter körsávjára. (https://www.techlicious.com/tip/instagram-icon-meanings-explained/)
- **Pull-to-refresh** (Tweetie-vonal) — csak legfrissebb-elöl tartalomra, csak szándékos
  gesztusra. Átvéve. (https://ui-patterns.com/patterns/pull-to-refresh)
- **Térköz-ritmus** — az egyen-súlyú kártyafal az ismert bukási mód; szigorú alapritmus +
  tervezett akcentus-ütések. Ez a fal három-súlyú ritmusának alapja.
  (https://www.designsystemscollective.com/spacing-alignment-in-ui-creating-visual-rhythm-and-breathing-room-2c382b112272)
- **Meta AI-profil címkézés** — az AI-jelleg halk, név-melletti jelzés, nem poszt-szintű
  transzparens. Átvéve. (https://www.socialmediatoday.com/news/instagram-updates-tags-for-ai-profiles/829235/)

## 6. Codebase terrain

**Ami már megvan és újrahasznosul:**
- Feed-adatmodell: `api/feature/character/character.yml` — `GET /api/character/feed`
  (OBSERVATION / CONFERENCE_POST / CONFERENCE_CHANGE), tárolt szakértői reakciók
  (`ConferencePeerReaction`), user-válaszok (`/api/character/replies`, kiértékeléssel).
  FE: `CharacterFeedPage` + `KarakterHubPage` (embedded a `BoopWorldPage`-ben).
- Esti/éjszakai gépezet: `CharacterObservationJob` (02:50, 40 detektor),
  `CharacterConferenceJob` (vasárnap 19:30), `ProactiveFeedService`+`CompanionMessageJob`
  (05:45/12:30/20:30 → `companion_message`), `ObservationFeedService` (Észrevételek),
  `ReflectionJob`+`HypothesisPipelineService` (éjszakai hipotézisek).
- Finding-entitások: `pattern` (29 páros katalógus + ai_hypothesis), `prediction`,
  `experiment`, `diagnosis`, `memoir`, `weekly_review` — mind valós, mindkét FE-módban.
- Navigáció: `navModel.ts` (a Mezo-domén dokkja + `owns` prefixek), `boopNavigation.ts`
  (a 12-elemű katalógus → dev-menü), `pageIndex.ts`, `LegacyPathRedirect`.
- UI-kit: `shared/ui/mozaik` + `shared/ui/clay` (Boop figurák, ClayIcon/ClaySpot,
  EntranceGroup, useCountUp), `boop-world.css`, `PersonaOrb`/`expertColors`.

**Ami hiányzik (a II. felvonás magja):** a cross-engine témaszál — egy beszélgetés, ami
minták+előrejelzések+kísérletek rekordjait köti össze karakterposztokká (ADR 0049 nyitott
backend-bővítése). Idempotencia forrás-azonosító+verzió+eseménytípus szerint; stabil
rendezés/olvasottság/követés; „Ír…” csak valós generálás alatt (a 2026-09-21-i audit §8
követelménylistája érvényes).

**Ismert csapdák:** VITE_USE_MOCK unset=mock (a real-mode gate vakon zöld); `pnpm test`
fájlszűrő nem szűkít, CI=true kell; contract-first + CODEMAP-frissesség gate; ArchUnit a
fókuszált IT-kből kimarad; cron-slot térkép kézzel dekonfliktolt — új esti jobnak szabad
slot kell; mock seedek (`characterMock.ts`, `insights.ts`) szinkronban tartandók; a
`navModel.owns` + `pageIndex` + katalógus-tesztek minden új route-nál frissítendők.
Állapot-következetlenségek javítandók a karakterek szája elé kerülés előtt:
`mezo-537kp` (bukott előrejelzésen „✓ Bejött”), `mezo-xasp9` (lista „megbízható” vs
részlet „GYŰLIK”).

**Éles számok (2026-09-22):** 12 minta (6 proposed döntésre vár), 10 előrejelzés
(3 függő), 5 kísérlet, 2 diagnózis; naplózás-lefedettség 60 napból: kaja 28, súly 24,
alvás 15, közérzet 8 nap. A hipotézis-kritikus 08-30 óta minden javaslatot eldobott
(„2 proposal(s), 0 persisted, keep floor 0.55”).

## 7. Megvalósítás — felvonások és szeletek

**I. felvonás — a színpad (FE-súlyú, meglévő adatból):**
1. Fal-újraépítés a prototípus szerint (story-sáv, három-súlyú ritmus, poszt-anatómia,
   nap-elválasztók, korong+frissítés, animációk) — a meglévő feed/finding-hookokra kötve;
   a posztok forrás-rekordokból renderelt nézetek (semmi kitalált tartalom).
2. Egységes hármas gombkészlet + utóélet-címkék; a „Nem így érzem” visszakérdezés a
   meglévő reply-csatornára kötve.
3. Karakter-regrouping a FE-n: 5 arc + Szkeptikus/Mezo; persona→boop leképezés;
   story-gyűrű állapot (új/látott/döntés).
4. Profilszobák (5 + Mezo-szoba a területfüggetlen ajtókkal); a rács dev-menüvé fokozása;
   dokk-csere (Menü→A csapat); mélylink-átirányítások.
5. Hidegindítás: bemutatkozó posztok, Kalauz-kivezetés, érettség-jelzések.
6. Nyelvi vasszabályok végigvezetése a meglévő szövegeken (amennyire a mai generátorok
   engedik) + hangkönyv-vázlat.
Gate-ek: mindkét FE-mód; mobil 320px; reduced-motion; navigációs tesztek; CODEMAP.

**II. felvonás — a hang (BE-súlyú):**
7. Cross-engine témaszál + esti kiadás-generátor (kurátor: 2–4 poszt, karakter-routing,
   idempotencia; szabad cron-slot).
   **Szállítva (II. felvonás, 2026-09-24):** H1–H2 (`mezo-a9bo7.12`/`.13`) — a kiadás 21:00-kor,
   3–6 poszttal (a [II. felvonás specje](2026-09-24-csapatfal-act2-esti-kiadas-design.md) szerint
   a 2–4 helyett), a témaszál a H4 vendég-soraiként (a poszt alatt beszélgető karakterek).
8. Karakterhangok (hangkönyv → generátor-promptok), két-karakteres beszélgetések konkrét
   user-adat-hivatkozással.
   **Szállítva (II. felvonás, 2026-09-24):** H3 (`mezo-a9bo7.14`, saját hang tény-őrrel) + H4
   (`mezo-a9bo7.15`, vendég-sorok, a Szkeptikussal együtt).
9. Hipotézis-kritikus újrahangolása (külön hibajegy, előrehozható) + „gyűlik”-posztok.
   **A „gyűlik”-posztok szállítva (II. felvonás, 2026-09-24):** H1 (`sejtes` feltöltő-műfaj). A
   kritikus-újrahangolást NEM a II. felvonás hozta, hanem a párhuzamos `mezo-hben1` (grounded ág).
10. Étkezés-boop napi három-szólamú értékelése; adatéhség-posztok.
   **Szállítva (II. felvonás, 2026-09-24):** H5 (`mezo-a9bo7.16`) — Falat napi értékelése (tányér ·
   cél · edzés) és Derű bejelentkezés-kérése „Bejelentkezem” gombbal. Az adatéhség-posztok közül
   csak Derűé él; a többi karakter adatkérése még nincs.
11. Később: kérdéslista-bővítés, gyakoribb előrejelzés.

**Design-körök a megvalósítás előtt (owner-döntés, 2026-09-23):** a kapcsolódó al- és
mélyoldalak MIND prototípusban készülnek el először, körönként owner-jóváhagyással, a
jóváhagyott `uveg-uzenofal.html` bővítésével (egy összefüggő, kattintható világ marad):
**D1** a fal mélye (poszt-oldal minden műfajra, válasz-flow) → **D2** az 5 szoba teljes
mélysége + karakter-aloldalak → **D3** Rólad (dosszié) → **D4** Emlékek → **D5** Mezo-szoba
mélye (konzílium, heti fejezet, Gépterem) → **D6** első használat + kalauz-kivezetés.
Beadek: `mezo-a9bo7.1`–`.6`. A megvalósítási (I–II. felvonás) szeletbontás a design-körök
végén készül, a kész prototípus-világ mint parity-referencia alapján.

**Folyamat-infrastruktúra:** epic `mezo-a9bo7` + a **`/csapatfal` session-skill**
(a `/uvegesites` mintájára): friss session → soron következő D-kör → prototípus-bővítés →
owner OK → commit.

## 8. Nem cél (out of scope)

- Nincs kitalált poszt, szám vagy egyetértés-jutalmazó pontozás (ADR 0049).
- Reakció nem növel statisztikai bizonyosságot; az AI-k egyetértése nem független bizonyíték.
- Nincs végtelen-görgetés-optimalizált, kimerítő napi folyam; a csendes nap őszinte állapot.
- Étrend/edzésterv a falról közvetlenül nem módosul — csak előnézet+jóváhagyás úton.
- A Rólad és Emlékek felületek tartalmi újratervezése (csak átcímkézés/behuzalozás).

## 9. Nyitott kérdések

- ~~A karakterek végleges nevei~~ — **lezárva 2026-09-24:** Szunya · Mocor · Falat · Derű · Mezo véglegesek.
- Mezo arany színe végleges-e (a prototípusban jóváhagyva; ünnepi arany anyaggal rokon).
- A „Rád vár” szűrés kell-e a falra külön nézetként, vagy elég a strip + pötty.
