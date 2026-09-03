# Memoár-prompt v2 — krónikás hang, széles gather, emberi horgonyok (mezo-uajy)

Daniel a heti memoár kimenetét három ponton kifogásolta: a **hangvétele** moralizáló
(„Gyengéden azt gondolom… a hétköznapi gondoskodás csatáját még nem mindig vívod meg"),
a **prózája szegényes** (egyetlen tagolatlan tömb), és a **gather sovány** — miközben a
heti review generátor (mezo-d20.7.8) már a napló/döntések/kísérletek/emberek/gyógyszerciklus
blokkokat is látja. Ez a spec a `MemoirGenerator` promptját és gather-ét újítja meg; a
Memoár UI Design 2.0 körének (könyv-hub prototípus, ugyanezen bd issue) backend-flagged
„tagolt törzs" és „humanizált horgony-címke" tételeit is ez váltja be. A tappolható horgony
**cél-ref** (navigáció) NEM része — az a UI-implementációs slice-szal jön.

## 1 · Diagnózis (a mai állapot)

- A prompt 4 sor, jelző-alapú („irodalmi hangvételű… gyengéd észrevétel") — a mezo-q71s
  tanulság („viselkedést írj, ne jelzőt") nem ért ide el; nincs moralizálás-tilalom, nincs
  szerkezet, nincs hossz, nincs példa. A „gyengéd észrevétel" sor kényszeríti ki a
  leereszkedő zárlatot.
- A gather: napi összefoglalók + teljes tény-blokk + Karakter-blokk + growth-digest +
  **minden nem törölt minta státusztól függetlenül** (a rejected is), és mind horgony-jelölt.
- A Memory horgony-jelölt címkéje a nyers ISO-dátum (`2026-08-29`) — a FE ezért mutat
  `[Memory] 2026-08-29` chipet.
- A kontraktus (`proactive.yml`) a body-t „single narrative paragraph block"-ként írja le.

## 2 · Az új prompt

Blokkosított, a chat-persona (`ChatService.SYSTEM_PROMPT`) mintájára; a
`HETI-MEMOIR-FELADAT` marker marad (fake-tükör). Jóváhagyott irány: **krónikás társ** —
meleg, konkrét, elbeszélő; értékelés, tanács és giccs nélkül.

```
HETI-MEMOIR-FELADAT
[Ki vagy]
Te vagy a mezo, Daniel egészség- és teljesítmény-társa. A közös hetetek emlékkönyvét írod —
egy fejezetet hetente. Társ vagy, nem bíró: megfigyelsz és megőrzöl, sosem osztályozol,
sosem moralizálsz, és nem adsz tanácsot — a tanács a beszélgetés dolga, a memoár emlék.

[Mit írsz]
Heti memoár-fejezetet magyarul: rövid, felidéző cím (legfeljebb hat szó, ne tanulság és ne
ítélet), és 2–4 bekezdés próza — a bekezdéseket \n\n választja el. Nagyjából 120–220 szó:
elég hosszú, hogy története legyen, elég rövid, hogy egy szuszra elolvassa.

[Hogyan írsz]
Elbeszélsz, nem értékelsz. A hetet történetként meséld: legyen íve — honnan indult, mi
fordult, hová érkezett.
Konkrét mozzanatokból építkezz (egy nap, egy szám, egy mondat, egy ember), ne
általánosságokból — a megadott adat konkrétuma mindig erősebb a nagy szónál.
Jelen lehetsz a szövegben („láttam", „figyeltem"), de a hét Danielé — te tanú vagy, nem
főszereplő.
Kerüld a giccset, a pátoszt és a motivációs frázisokat; ha egy mondat egy poszter alján is
szerepelhetne, húzd ki.
A nehéz napokat is jegyezd fel, ugyanazzal a nyugalommal, mint a jókat — részvéttel, ítélet
nélkül. „Még nem tanultad meg", „elveszel", „meg kell tanulnod" típusú kioktatás tilos.

[Példa a hangra]
ROSSZ: „Büszke lehetsz magadra, de a hétköznapi gondoskodást még tanulnod kell."
JÓ: „Csütörtökön, a 105 kilós húzás után, csendben ültél két percet — az ilyen percekből
épült ez a hét."
(A példa FORMÁJÁT másold, ne a tartalmát — minden mozzanat a megadott adatból jöjjön.)

[Mit szabad állítani]
Kizárólag a megadott hét adataiból dolgozz; számot, adatot, eseményt kitalálni tilos.
Gyógyszer adagolására vonatkozó változtatást SOHA ne javasolj.

[Horgonyok]
A HORGONY-JELÖLTEK listából válaszd ki azt a 2–5 tételt, amire a fejezet ténylegesen épül.
Memory-jelölthez adj rövid (legfeljebb hat szavas) note-ot arról, mi történt aznap — a
szövegedben szereplő mozzanattal egyezően.

Válaszolj KIZÁRÓLAG szigorú JSON-nal:
{"title": "...", "body": "bekezdések \n\n-nel elválasztva",
 "anchors": [{"index": 0, "note": "rövid címke"}]}
```

## 3 · Gather-bővítés (pure-code, a „code-collected, model-selected" fegyelem marad)

Sorrend a payloadban — minden szekció csak akkor kerül be, ha van sora:

1. **A hét napjai** — változatlan (napi összefoglaló-narratívák; Memory horgony-jelöltek).
2. **Minta-szűkítés** — a mai „minden nem törölt minta" helyett: a CONFIRMED minták + a hét
   minta-eseményeit adó minták (`WeeklyReviewWeekWindow.patternEvents` a review mintájára,
   esemény-fajtával). Csak ezek horgony-jelöltek (`Pattern`).
3. **Életesemények** — `WeeklyReviewWeekWindow.lifeEvents`; horgony-jelölt (`LifeEvent`).
4. **A hét edzés-csúcsai** — `ExerciseRecordService.list()` szűrve azokra a rekordokra,
   amelyek `bestSet.date`-je a hétbe esik (az all-time best ezen a héten dőlt); render:
   `- Lat Pulldown: 105 kg × 9 (aug. 29.)`; horgony-jelölt (`PR`, label
   `"{név} {súly} kg"`). Új, ciklusbiztos `proactive → train` olvasó-él (ArchitectureTest
   fut rá).
5. **Predikciók kimenettel** — `predictionRepository.findByCreatedByAndWeekStart` a review
   mintájára (nem horgony-jelölt).
6. **Szélesebb kontextus** — `WeeklyReviewContextSources.render(...)` egy az egyben:
   napló-idézetek, döntések (+1–5 értékelés), futó kísérletek, emberek-említésszám,
   gyógyszerciklus-pozíció, heti `period_summary`. Nem ad horgony-jelöltet (a review-val
   azonos érv: minden jelölt dupla tokenköltség).
7. **Tény-blokk, Karakter-blokk, growth-digest** — változatlanul.
8. **HORGONY-JELÖLTEK** számozott lista — változatlan mechanika, bővült fajtákkal:
   `Memory | Pattern | LifeEvent | PR`.

## 4 · Horgony-válasz és címke-komponálás

- A JSON-válasz `anchors: [{index, note}]`; a parser **fallbackként** a régi
  `anchorIndexes: [int]` alakot is érti (modell-variancia + régi scripted sentinelek).
- Feloldás: index-határellenőrzés + dedup változatlanul. A `note` szerveroldalt max 60
  karakterre vágva.
- **Címke-komponálás** (a wire-kontraktus `MemoirAnchor{kind,label}` NEM változik):
  - `Memory`: label = HU-formázott nap (`"aug. 29., szombat"`), note-tal:
    `"aug. 29., szombat — {note}"`.
  - `Pattern`/`LifeEvent`/`PR`: label a jelölt címkéje (már emberi); a note-ot eldobjuk.
- A FE nyers dátum-chipje ezzel adatoldalról gyógyul; a chipek tappolhatóvá tétele
  (cél-ref) a UI-slice backend-flagged tétele marad.

## 5 · Kontraktus és fake

- `proactive.yml` `MemoirResponse.body` leírása: „single narrative paragraph block" →
  „narrative prose; paragraphs separated by \n\n". Leírás-változás, séma nem változik →
  FE codegen újrafuttatva, viselkedési FE-változás nincs (a bekezdés-split a UI-körben jön).
- `FakeCompanionLlm`: a `MEMOIR_SENTINEL` **greedy**-re vált (`\{.*}`) — az `anchors`
  beágyazott objektumai miatt, a `WEEKLY_REVIEW_SENTINEL` precedensével; az alap
  (nem scriptelt) válasz az új alakot adja:
  `{"title":"Fake memoir","body":"FAKE-MEMOIR-NARRATÍVA","anchors":[]}`.

## 6 · Tesztek

- `MemoirGeneratorIT` frissül + bővül: gather tartalmazza az új szekciókat (minta-szűkítés:
  rejected minta NEM kerül be és nem jelölt; PR-szekció akkor és csak akkor, ha a hétre
  esik best-set; kontextus-blokk jelen, ha van napló-sor), `anchors`-alakú sentinel
  (note → komponált Memory-label), legacy `anchorIndexes` fallback, üres hét → null
  változatlanul.
- A prompt-szöveg pinelése: a marker + a moralizálás-tilalom sor + a JSON-kontraktus
  jelenléte (teljes szöveg-pin nem — a próza hangolható maradjon).
- `ArchitectureTest` explicit futtatás (új `proactive → train` él), CODEMAP regen.

## 7 · Nem cél

- Horgony cél-ref a wire-on (UI-slice), memoár-archívum végpont (UI-slice), FE
  bekezdés-render (UI-slice), mérföldkő-kártya backend (külön tétel).
