# A nap-oldal visszajelzés-gombjai — a hetedik artifact-fajta

- **Dátum:** 2026-09-05
- **bd issue:** `mezo-jcpt.9`
- **Szülő epic:** `mezo-jcpt` — napi értékelés újratervezés
- **Státusz:** jóváhagyás nélkül végrehajtva (éjszakai futam, user-felhatalmazással); minden
  önálló döntés a PR-ben és a bd kommentekben, reggeli átnézésre

## A hiba

A `WeekDayPage` átépítésekor (`mezo-jcpt.4`) elvesztek a visszajelzés-gombok, és a review
megerősítette, hogy a **jelenlegi szerződés mellett nem is voltak megtarthatók**: a `useFeedback`
egy `(fajta, artifactId)` párra kulcsolódik, a fajták között nincs napi értékelés, a
`DayEvaluationResponse` pedig **egyáltalán nem hordoz azonosítót**. A régi gombok a heti elemzés
id-jére szavaztak olyan prózáért, amit az oldal már nem is mutat — a megtartásuk azt jelentette
volna, hogy a felhasználó **képernyőn nem látható** dolgot értékel.

Következmény: a napi értékelés a termék egyik legdrágább LLM-felülete, és **nincs róla
visszajelzési hurok**.

## Prior art

**A ház saját precedense a mérvadó, és pontosan ez a mozdulat.** A `companion.md` §5.7 rögzíti,
hogy a `FeedMessageResponse`, a `WeeklySuggestionResponse` és a `MemoirResponse` mind **kapott
egy kötelező `id`-t a szerződésre** — „mert enélkül a frontendnek nincs mire szavaznia". Az
entitásoknak mindig is volt id-jük; a szerződés hallgatott róla. Ugyanez a helyzet itt.

**Új fajta felvétele = CHECK-csere migráció**, nem új oszlop. Sablon:
`202608271500_mezo-p2tr_feedback_weekly_review_kind.sql` (hat sor, adatmigráció nélkül) — ez
maga is a `memory_embedding`-fajta bővítés idiómáját követi.

**Külső prior art szándékosan kimaradt:** a kérdés teljes egészében „mi a ház mintája egy
hetedik artifact-fajtára", és arra a repó a válasz.

## Codebase terrain

| Terület | Fájl |
| --- | --- |
| Fajta-regex a szerződésben (**három** hely) | `api/feature/companion-feedback/companion-feedback.yml:16`, `:84`, `:109` (+ a prózai felsorolás `:121`) |
| `artifactId` típusa | ugyanott, mindenhol `{type: string, format: uuid}` |
| A napi válasz, ami ma id nélküli | `api/feature/me-week/me-week.yml:199` |
| Fajta-konstansok + DB-minta | `MessageFeedbackEntity.java:40-45`, `:67` |
| A CHECK-csere precedens | `db/changelog/1.0.0/script/202608271500_mezo-p2tr_feedback_weekly_review_kind.sql` |
| A nap-review sor (van id-je!) | `DayReviewEntity.java:42-46` |
| Az újragenerálás helye | `DayReviewService.java:287-316` (`prose`), `:494-503` (`upsert`) |
| FE fajta-unió | `frontend/src/data/feedback/feedbackTypes.ts:5-11` |
| A hook | `frontend/src/data/feedback/feedbackHooks.ts:68` |
| A legközelebbi testvér-minta | `frontend/src/features/me/components/WeekReviewCard.tsx:27` |
| A beépítés helye | `WeekDayPage.tsx:257` → `DayReviewCard.tsx:34-38` (`children` slot) |

**Követendő minták:** az artifact-azonosító **mindig a saját tábla sor-id-je, UUID** — a hat mai
fajta közül **egyik sem** használ szintetikus vagy természetes kulcsot; a fajta „enum" a
szerződésben **regex**, nem OpenAPI `enum`, ezért a bővítés additív; **nincs gomb artifact
nélkül** (a memoár 404-es üres állapota szándékosan gombtalan); a gombok **kártya-szintű hook +
buta komponens**; a hibás visszajelzés-olvasás „nincs verdikt", nem törött oldal.

**Ismert csapdák:** contract-drift kapu (fragment + `openapi.yml` + `api.gen.ts` egy commitban);
CODEMAP-frissesség; `lint-liquibase` névkonvenció; ArchUnit (a `day_review` és a `feedback`
ugyanabban a slice-ban van, tehát nincs új kereszt-él); **FE mindkét mód** — a
`WeekDayPage.test.tsx`-nek már ma is van mock- és real-módú blokkja, és a `mezo-kr9v` hiba
pontosan a „csak mock módban jelenik meg" aszimmetria volt; a MSW-handlernek is meg kell kapnia
az új mezőt, különben a real-módú teszt id nélküli válaszra assertál. A **vizuális suite nem
fedi a nap-oldalt**, tehát golden nem mozdul — de védőháló sincs.

## Döntések

### D1 — az azonosító a `day_review.id`, vagyis a ház mintája

Nem vezetünk be szintetikus kulcsot. A `DayReviewEntity`-nek **van** sor-id-je, és mind a hat
mai fajta a saját sor-id-jét használja. A szerződés `artifactId`-je ráadásul `format: uuid`,
tehát egy természetes kulcs (pl. `2026-05-18`) **nem is lenne ábrázolható**.

A `DayEvaluationResponse` kap egy **opcionális** `reviewId` mezőt: akkor és csak akkor van
jelen, ha a naphoz tartozik LLM-próza. Nincs próza → nincs id → **nincs gomb**; ez a ház
„artifact nélkül nincs szavazás" szabálya.

### D2 — a szavazat TÚLÉLI a próza újragenerálását; ez vállalt korlát

A `DayReviewService.upsert` **helyben írja felül** a sort, ezért a `day_review.id` stabil egy
`inputsHash`-változás után is. Vagyis ha a nap prózáját egy visszamenőleges log miatt újra
generáljuk, a felhasználó korábbi 👍-ja a **már átírt** szöveghez marad hozzárendelve.

**Ezt elfogadom, nem javítom**, három okból: (1) a szavazat a nap *értékelésére* mint
artifactra vonatkozik, nem egy konkrét szövegváltozatra; (2) egy **lezárt** nap bemenetei
ritkán változnak, tehát az eset ritka; (3) az alternatíva — hash-ből származtatott azonosító —
**elhagyná a ház mintáját** (már nem sor-id), és árva visszajelzés-sorokat halmozna.

Az alternatíva a spec része, hogy felülbírálható legyen. Ha a szavazatnak a prózával együtt kell
meghalnia, a helyes lépés a hash-származtatott azonosító **vagy** a sor cseréje frissítés
helyett — de az már a cache szemantikáját írja át, és külön szelet.

### D3 — az új fajta EGYELŐRE nem kerül a tanuló-rollupba

A `FeedbackLearningService.SURFACE_KINDS` ma öt fajtát sorol — a `weekly_review` **hiányzik
belőle**, tehát annak a szavazatai ma is „write-only". Az új `day_review` fajtát **ugyanebbe az
állapotba** tesszük: felvesszük a szerződésre, a DB CHECK-be és a felületre, de a rollup-scope-ok
közé **nem**.

**Miért:** egy új rollup-scope felvétele megváltoztatja a scope-ok számát, amire tesztek
assertálnak, és egy másik feature (a tanuló réteg) viselkedését módosítja — ez külön szelet,
külön kockázattal. **Külön issue-t kap**, és abban a `weekly_review` már meglévő hiánya is
benne lesz: a kettő ugyanaz a hézag.

Amit a felhasználó lát, ettől független: a szavazatai rögzülnek és visszatöltődnek; csak a
nyers jel nem folyik még bele a coaching-rollupba.

### D4 — a gombok csak pontozott, prózás napon jelennek meg

A `WeekDayPage` ma is csak `scored` állapotban rendereli a `DayReviewCard`-ot. A gombok annak a
`children` slotjába kerülnek, a chat-átadó gomb mellé — ugyanúgy, ahogy a `WeekReviewCard`
csinálja. `thin` / `empty` / `in_progress` / `future` napon nincs próza, tehát nincs gomb.

Ezzel megszűnik a `DAY_COPY.noNote` / `noReview` árvasága is: vagy tényleges fogyasztót
kapnak, vagy — ha a felület nem mutat ilyen esetet — törlendők. Az implementáció döntse el
tényadat alapján, és indokolja.

## Architektúra és adatfolyam

```
DayReviewEntity.id ──► DayReviewService.prose(...) [ma csak az envelope-ot adja vissza]
                              │  (a visszatérési alak bővül: envelope + id)
                              ▼
        DayEvaluationResponse.reviewId (opcionális, csak prózás napon)
                              │
                              ▼
   DayReviewCard ──► useFeedback('day_review', reviewId ? [reviewId] : [])
                              │
                              ▼
        PUT/DELETE /api/companion/feedback   (artifactKind: 'day_review')
                              │
                              ▼
     message_feedback  (CHECK kibővítve — hetedik fajta, adatmigráció nélkül)
```

## Hibakezelés és hiány-állapotok

- **Nincs próza** → nincs `reviewId` → nincs gomb (nem üres gomb-sor).
- **A visszajelzés-lekérés hibázik** → „nincs verdikt", az oldal ép marad.
- **Árva `artifact_id`** (a nap-review sorát törölték) → a visszajelzés-tábla nem hivatkozik
  idegen kulccsal, a sor egyszerűen soha nem olvasódik vissza. Ez a mai viselkedés minden
  fajtánál.

## Tesztelés

**Backend:** `DayEvaluationApiIT` — prózás nap válaszában ott a `reviewId`, prózátlan napén
nincs; `CompanionFeedbackApiIT` / `MessageFeedbackPersistenceIT` — a hetedik fajta elfogadva
(és egy érvénytelen fajta továbbra is elutasítva, hogy a CHECK ne lazuljon); ArchUnit külön.

**Frontend:** `WeekDayPage.test.tsx` — a gombok **mindkét módban** megjelennek pontozott napon,
és **nem** jelennek meg `thin`/`empty` napon; szavazás → optimista írás → visszatöltés.
A `mezo-kr9v` tanulsága miatt a mock-only aszimmetria külön tesztet érdemel.

**Kapuk:** contract-drift (fragment + `openapi.yml` + `api.gen.ts` egy commitban),
`lint-liquibase` **a CHECK-csere migrációval**, CODEMAP-regen, FE mindkét mód.

## Dokumentáció

A felderítés **három elavult helyet** talált, amit ez a szelet érint és ezért javítania kell:

1. `companion.md` §5.7 táblázata **öt** fajtát sorol, a `weekly_review` hiányzik belőle.
2. A „Backend tables (W4.1 feedback)" szakasz **és** a `MessageFeedbackEntity` javadocja is „öt
   fajta öt táblán"-t ír — a valóság ma hat.
3. A §10 fájllistából hiányzik a `202608271500_mezo-p2tr_feedback_weekly_review_kind.sql`.

Ezekhez jön a `me.md` „Day page" szakasza (a `DayReviewCard` visszajelzési affordanciája).

## Nyitott kérdések

Nincs. A D2 vállalt korlátja és a D3 halasztása egyaránt kimondott, indokolt és felülbírálható.
