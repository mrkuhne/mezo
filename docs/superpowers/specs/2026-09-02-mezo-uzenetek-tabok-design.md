# NapMezoPage: Üzenetek | Életjelek tab-szétválasztás (mezo-ho9k)

**Dátum:** 2026-09-02 · **Issue:** mezo-ho9k · **Státusz:** jóváhagyott terv

## Probléma

A `/nap/uzenetek` oldalon („Mezo üzenetei", `NapMezoPage`) a Mezo companion-üzenetek és az
Életjel-figyelő küszöb-nudge kártyák egyetlen szálban keverednek — a `buildMezoMessages` a
nudge-okat a szál VÉGÉRE fűzi. A két tartalomtípus vizuálisan összemosódik, és a lap hosszú:
sok a görgetés. A felhasználói döntés: **tab-szétválasztás** a lapon belül.

## Jóváhagyott felhasználói döntések

1. **Szétválasztás:** szegmens-váltó tabok („Üzenetek | Életjelek") a lapon belül.
2. **Életjelek tab tartalma:** felül kompakt státusz-sáv mind a 6 needs-gyűrűről, alatta az
   aktív figyelmeztető (nudge) kártyák — sosem üres.
3. **Badge:** a fejléc olvasatlan-jelvénye változatlanul a TELJES szálat számolja; a lapon
   belül tab-pöttyök jelzik, melyik tabon van újdonság.
4. **Alap tab:** mindig Üzenetek.
5. **Üzenetek lista tömörítés:** a legújabb üzenet teljes kártya, a régebbiek egysoros
   összecsukott sorok, koppintva kinyílnak.

## Megközelítés (A: prezentációs partíció)

Az egy-szál doktrína (mezo-atry) érintetlen: a `MezoThreadProvider` marad az egyetlen
szálépítő, a partíció a NapMezoPage megjelenítési rétegében történik.

### 1. Adatfolyam

- `MezoMessageItem` új opcionális mezőt kap: `source?: 'eletjel'`
  (`frontend/src/features/today/logic/mezoMessages.ts`).
- A `toNudgeMessage` (`needsNudges.ts`) beállítja: `source: 'eletjel'` — a partíció explicit
  mezőn megy, nem string-egyeztetésen (`eyebrow`/`meta` szöveg nem diszkriminátor).
- `buildMezoMessages` sorrendje és szignatúrája NEM változik (Fuel/Hub hívók érintetlenek).
- A NapMezoPage bont: `uzenetek = messages.filter(m => m.source !== 'eletjel')`,
  `eletjelek = messages.filter(m => m.source === 'eletjel')`.

### 2. Tab UI

- Szegmens-váltó a hero alatt, a design_2.0 vizuális nyelvén (pill-háttér, aktív fehér
  szegmens); új CSS-osztályok a `prototype.css` nap-mzmsg blokkja mellé, világos + sötét
  token-átfedéssel a meglévő `:root`/dark varratoknál.
- Tab-állapot `?tab=` URL-paraméterben (`uzenetek` | `eletjelek`), a ChatPage `?c=`
  mintájára — vissza-navigáció és reload ugyanoda ér. Alapértelmezés (param nélkül): Üzenetek.
- A hero alcíme a teljes szálat számolja tovább (`N üzenet · a napod fonala`).

### 3. Üzenetek tab

- A legújabb (a partíció utolsó eleme) teljes kártyaként (chipekkel, ahogy ma).
- A régebbiek összecsukott egysoros gombok: idő · eyebrow · első bekezdés eleje, ellipszissel;
  koppintásra teljes kártyává nyílnak (`aria-expanded`).
- A „Beszélgess Mezóval ›" CTA a lista alján marad.
- A feedback-chip szerződés változatlan: chip CSAK `artifactId != null` sorokon (mezo-kr9v);
  kibontott régebbi kártya is kapja a chipjeit.

### 4. Életjelek tab

- Felül státusz-sáv: 6 cella (energia, hidratacio, pihenes, mozgas, lelek, rend) gyűrű-
  vizuállal és címkével; a piros/kritikus sávú cellák kiemelt (riasztás-színű) keretet
  kapnak. Adat: `useNeeds` — a provider már húzza, a react-query dedupol.
- Alatta az aktív nudge-kártyák (a mai partíció), bal oldali riasztás-csíkkal.
- Riasztás nélkül: státusz-sáv + „Minden gyűrű rendben" sor — a tab sosem üres.

### 5. Badge és tab-pöttyök

- A fejléc-badge és a belépéskori `markSeen()` változatlan (az `AppHeader` regressziós teszt
  áll marad); a szál sorrendje sem változik, tehát a vízjel-szemantika érintetlen.
- A lapra érkezéskor a lap pillanatképet vesz az olvasatlan elemek id-halmazáról (a provider
  `unread`-jéből levezetve, MIELŐTT a mount-beli `markSeen` lefut). Amelyik partícióban van
  olvasatlan, annak a tabja pöttyöt kap; a tab meglátogatása törli a saját pöttyét
  (session-lokális állapot, nem perzisztens).
- Az alapértelmezett Üzenetek tab pöttye belépéskor azonnal törlődik (ott van a user).

### 6. Deeplink (mezo-b3pp.36 invariánsok)

- `?n=`/`?d=` intervention-deeplink mindig az Üzenetek tabra kényszerít (a `?tab=` paramétert
  felülírja).
- A cél-kártya kibontva jelenik meg (ha az összecsukott zónába esne) és oda görgetünk; a
  scroll-target stabil string-id marad.
- A kereszt-napi kártya továbbra sem része a közös szálnak és a hero számlálójának.

### 7. Hibakezelés / élek

- Mock mód: `useCompanionFeed` üres — az Üzenetek tab a demo-briefinget mutatja; a
  viselkedés módfüggetlen.
- Éjfél-átfordulás (`useMinuteTick` dátumváltás): a pillanatkép-halmaz újraszámolódik.
- Üres üzenet-partíció: a meglévő tartalom-hiány viselkedés (csak CTA) marad.

## Tesztek

- Pure partíció-logika: a `source` mező és a bontás tesztje (`mezoMessages.test.ts` /
  `needsNudges.test.ts` bővítés).
- `NapMezoPage.test.tsx`: tabváltás, alap tab, `?tab=` roundtrip, pötty-életciklus,
  összecsukás/kibontás, chips-only-on-artifacts kibontott kártyán, Életjelek tab státusz-sáv
  + üres-riasztás állapot.
- `NapMezoPage.deeplink.test.tsx`: deeplink tabra kényszerítés + kibontás + scroll.
- `AppHeader.test.tsx`: változatlanul zöld (badge-életciklus).
- Mindkét mód (mock + real, `VITE_USE_MOCK` explicit) — a bare `pnpm test` mock-ot futtat
  kétszer.

## Dokumentáció / prototípus

- `docs/design_2.0/prototypes/src/nap-body.html` `#page-mezo` bővítése a tab-layouttal
  (a jóváhagyott artifact-prototípus alapján), + design-iterations jegyzet.
- `docs/features/today.md` §2 (oldal-viselkedés) frissítés; §9 gotcha-lista bővítés a
  partíció-mezővel; a §10-ben jelzett elavult sorok (needsNudges "nincs delivery path")
  javítása.
- `node scripts/gen-codemap.mjs --check` — új fájl esetén CODEMAP újragenerálás.

## Prior art (researcher)

- **Oura 2025 / Fitbit 2023 redesign** — a „ma fontos" és „az adataid" szétválasztása
  dedikált felületekre; lapon belüli könnyű változata a szegmens-váltó.
  (ouraring.com/blog/new-oura-app-experience, techcrunch.com/2023/08/01/fitbit-three-tab)
  → **átvéve** szegmens-váltóként.
- **Whoop home** — fix, kompakt metrika-fejsor, mély nézet koppintásra; a coaching a
  metrikához horgonyzik. (whoop.com/thelocker/the-all-new-whoop-home-screen)
  → a státusz-sáv **átvéve**, a metrika-horgonyzott üzenet **elvetve** (a Mezo-üzenetek
  jelentős része önálló, nem metrika-kommentár).
- **NN/g mobil accordion-kutatás** — ha mindkét szekció hosszú és a user mindkettőt
  használja, a tab jobb az accordionnál. (nngroup.com/articles/mobile-accordions)
  → az összecsukható-szekciós alternatíva **elvetve**, a tabon belüli régebbi-üzenet
  összecsukás viszont **átvéve** (ritkán olvasott tartalom).
- **Latest-message-preview inbox minta** — elvetve önmagában (a user kifejezetten tabot
  választott), de az összecsukott egysoros minta ebből jön.

## Codebase terrain (investigator)

- Érintett feature-ök: **today** (`docs/features/today.md` §2), **needs** (nudge-forrás),
  **insights** (stílus-referencia).
- Kulcsfájlok: `NapMezoPage.tsx` (partíció + tabok), `MezoThreadProvider.tsx` (érintetlen
  szál, pillanatkép-forrás), `mezoMessages.ts` (`source` mező), `needsNudges.ts`
  (`toNudgeMessage`), `useNeeds.ts` (státusz-sáv adat), `prototype.css` (új osztályblokk),
  `nap-body.html` (prototípus).
- Követendő minták: egy-szál doktrína (mezo-atry); chips csak artifactre (mezo-kr9v);
  MozaikPage/PageHead/EntranceGroup lap-anatómia; pure logika `logic/*.ts`-ben kollokált
  teszttel.
- Csapdák: badge-vízjel az UTOLSÓ elem id-je (sorrend nem változhat); `MezoMessageItem.id`
  ≠ `artifactId`; `buildMezoMessages`-nek három másik hívója van; prototype.css merge-ekor
  levágott `@media` záró kapcsos (csak `pnpm build`-nél bukik); mock módban a feed mindig
  üres; a `MezoMessagesSheet`/`.td-*` osztályok halottak — nem minta.
