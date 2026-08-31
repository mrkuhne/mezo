# Emberek szekció — design spec (mezo-06o0)

*2026-08-31 · brainstorming-eredmény. Vizuális forrás-igazság:
`docs/design_2.0/prototypes/emberek.html` (artifact:
https://claude.ai/code/artifact/9c94ecde-f426-471a-a988-b0a60ca7fbcf).*

## 1. Probléma és cél

A `/me/people` (Emberek) ma egy vékony v1-szelet: a személyek seed-only-k (nincs CRUD),
említés csak a kézi chip-útvonalon születik, a `tiedTo` címke-string, a person nem
gráf-node, és a UI egyetlen scrollozó lista. Cél: az Emberek legyen élő, önmagát töltő
felület — a szabad szöveges inputokból (napló, reflexió, hála, döntés, jegyzetek, chat)
magától épüljön a kapcsolati kép, gazdag metrikákkal (tónus + intenzitás,
kontextus-címke, esemény-kapcsolatok), és a személyek jelenjenek meg a companion
összefüggés-rétegében is.

**Jóváhagyott döntések** (brainstorming): felvétel = detektálás + jelölt-inbox + kézi
CRUD; forrás = minden narratív szöveg; kinyert adat = tónus+intenzitás, kontextus-címke,
esemény-élek, idézet; időzítés = hibrid (azonnali név-match + éjszakai LLM); az ismert
személyre eső determinisztikus találat azonnal éles, utólag törölhető.

## 2. Adatmodell (Liquibase-bővítések)

### `person` (bővítés)
| Új oszlop | Típus | Jegyzet |
|---|---|---|
| `aliases` | `text[]` default `{}` | becenevek a név-matchhez |
| `status` | `text` CHECK `candidate\|active\|archived`, default `active` | jelölt-inbox életciklus |
| `source_kind` | `text` CHECK `manual\|extractor\|seed`, default `manual` | honnan született |

### `mention` (bővítés)
| Új oszlop | Típus | Jegyzet |
|---|---|---|
| `intensity` | `smallint` NULL, CHECK 1..3 | LLM tölti, kézi útvonalon üres |
| `context_label` | `text` NULL, CHECK zárt készlet | `munka\|csalad\|baratok\|edzes\|konfliktus\|kozos_program\|segitseg\|egyeb` |
| `source_ref_kind` | `text` NULL | `journal_entry\|reflection\|gratitude\|decision\|activity_note\|checkin_note\|chat_turn` — a `memory_embedding.kind` készletével egyező nevezéktan |
| `source_ref_id` | `uuid` NULL | a szülő szöveg sora (visszaugráshoz, deduphoz) |

A `person.relationship` CHECK bővül: `partner|friend|family|colleague|teammate|mentee`
(a kontraktus-enum és az FE `Relationship` type azonosan) — a prototípus kapcsolat-készlete
igényli. A meglévő mention `source` CHECK bővül: `voice|camera|chip|text` + `chat`; a
`mention.tone` DB-szinten nullable lesz (az automata út tónus nélkül ír, az éjszakai kör tölti). A `tied_to_*`
mezők maradnak (deprecated, nem törlünk); az esemény-kötést a gráf-élek veszik át.
Dedup-kulcs az automata útvonalra: `(created_by, person_id, source_ref_kind, source_ref_id)`
partial unique index `WHERE source IN ('text','chat')`.

### Gráf
Új node-kind: `PERSON` (a `GraphNodeEntity` kind-készletébe). Promóciós horgony:
`source_kind='person'`, `source_id=person.id` — a meglévő `uq_knowledge_node_source`
idempotencia változatlanul működik. Élek: a meglévő `knowledge_edge` kindok
(`RELATES_TO` az alap; a LLM javasolhat `SUPPORTS`/`CONFLICTS`-ot is).

## 3. Írási utak (3)

1. **Kézi** — kontraktus-bővítés a `api/feature/people/people.yml`-ben:
   - `POST /api/people` (`CreatePersonRequest{name, aliases[], relationship, relationshipHu, notes}`)
   - `PUT /api/people/{personId}` (ugyanaz + `affectBaseline`, `contactCadenceLabel`)
   - `DELETE /api/people/{personId}` (soft delete, `@SQLDelete` útvonalon)
   - `POST /api/people/{personId}/decision` (`{decision: accept|reject}`) — jelölt-inbox
   - a `LogMentionRequest` bővül opcionális `contextLabel`-lel
   - a `GET /api/people` válasz person-DTO-ja bővül: `aliases`, `status`, `sourceKind`;
     a mention-DTO: `intensity`, `contextLabel`, `sourceRefKind`
2. **Azonnali név-match** — `MentionDetectionListener`
   (`@Async @TransactionalEventListener(AFTER_COMMIT)`) a meglévő embedding-listener
   események mellé (napló, reflexió, hála, döntés, jegyzet-catchup, chat-turn).
   A `ToolText.searchTokens`-féle hajtogatott (ékezet-strip, lowercase) token-match a
   személynevek + aliasok ellen; találatnál `mention(source='text'|'chat')`, a találó
   mondat `excerpt`-ként, `source_ref_*` kitöltve, `tone=NULL` (az éjszakai kör tölti).
   Dedup a partial unique indexen. IDENT-3: hiba → warn + swallow, a felhasználói írás
   sosem sérül. Kapuzás: `PEOPLE_SWITCH` (új feature switch) ∧ a forrás-feature switche.
3. **Éjszakai LLM-kör** — `PersonExtractionService`, a `LifeEventExtractionService`
   ikertestvére, a `GraphMaintenanceJob` láncába fűzve. Egy olcsó-LLM hívás a nap
   narratív szövegeire, három feladattal:
   - a nap tone-nélküli mentionjeinek gazdagítása (tónus + intenzitás + kontextus-címke);
   - esemény-kapcsolat javaslat: PERSON node ↔ LIFE_EVENT/GOAL node élek
     (`GraphEdgeStructurer`-mintára, evidencia a mention id-vel);
   - ismeretlen, visszatérő nevekre `person(status='candidate', source_kind='extractor')`
     javaslat (nap ≥2 vagy hét ≥3 említés felett), az evidencia-idézetekkel a `notes`-ban.
   Bizonytalan utalás ("a főnököm", több személyre illő keresztnév) SOHA nem ír adatot.
   Pre-spend kapuk a LifeEvent-mintára (nap már feldolgozva, üres narratíva).

### Gráf-tükör
`GraphPromotionService` bővül `SOURCE_PERSON`-nal: aktív személy → PERSON node upsert
(title = név, summary = kapcsolat + cadence), archiválás/törlés → node archive.
Trigger: person create/update/delete után esemény (`PersonSavedEvent`), a goal-minta
szerint. A `GraphTraversalService` és a ref-chip pipeline változatlanul, ingyen
szolgálja ki (a chat `[Összefüggések]` blokkjában megjelennek az emberek).

### Ami már ma fogyaszt, és gazdagodik
`MetricKey.SOCIAL_MENTIONS` (pattern engine), `DailySummaryService`,
`WeeklyReviewContextSources` — változtatás nélkül több adatot látnak. A chat
kontextus-snapshotba (ADR 0029 port) az emberek bekötése NEM része ennek a körnek
(külön bd issue-ba kerül).

## 4. UI (a prototípus a forrás-igazság)

Csempés hub a Heti-recept szerint — a hub egy képernyő, scroll nélkül:

- **Hero**: `i-emberek` + aktív kör száma + "N említés e héten".
- **Mini-cellák** (3): említés·hét · legtöbbet említett · hangulat-lejtő.
- **Mozaik** (2×2):
  - **Jelöltek** (arany, `i-kristaly`, pulzáló badge) → elfogad/elvet oldal;
    elfogadásnál a személy + az evidencia-említés élőben bekerül.
  - **A köröm** (rózsa, facepile) → személy-rács (affect-gyűrűs avatar, 8 hetes
    hangulat-spark, kontextus-pöttyök) → **részletek-oldal**: magyar statok
    (említés / e héten / hangulat), animált hangulat-ív, "Milyen helyzetekben"
    kontextus-bontás, "Kapcsolt események · gráf" él-csempék, "Amit Mezo tud" tények,
    idővonal idézetekkel, Log most CTA, Szerkesztés.
  - **Említések** (ég, `i-naplo`, figyelem-badge) → "A hét ritmusa" napi oszlopok
    (szín = domináns tónus, MA arany gyűrű), színes szűrőchipek (Mind/Hét + tónus +
    kontextus), tónus-washed említés-kártyák (forrás-ikon korongon + mini avatar +
    kontextus-címke + idézet + él-sor), automata sorokon ✕ visszavonás.
  - **Heti kép** (levendula, `i-heti`) → "A hét tónusa" rakott sáv + jelmagyarázat,
    irány-mozaik (↗ sage / ↘ arany washed csempék, ok-sorral, koppintásra részletek),
    "A hét pillanata" Fraunces-idézet, "Csendben maradt" szaggatott kártyák.
- **Mezo-észrevétel sáv** (korall-wash, `i-mezo`): egy proaktív mondat, chat-be visz.
- **Sheetek**: Log (ki + tónus + kontextus + jegyzet), Új személy (név +
  becenév-chipek + kapcsolat + jegyzet).
- Ikonográfia: kizárólag a clay sprite-készlet, emoji sehol.
- Javítás menet közben: a PersonDetail angol statjai (Affect/Cadence/Mentions)
  magyarra váltanak; a mikrofon a Log sheeten marad "hang → jegyzet" ígéretű
  (nem küld magától), amíg a voice-út nem épül meg.

FE-huzalozás a ház-recept szerint: kontraktus → `pnpm generate:api` →
`data/me/peopleApi.ts` bővítés → mock seed → `peopleHooks.ts` (`useDualQuery`,
mutációk: mock `setQueryData` / real `invalidateQueries`) → `features/me`
oldalak/sheetek → route-ok (`/me/people`, `/me/people/:id`) → MSW + hook + komponens
tesztek.

## 5. Becsületes állapotok

- Jelölt-inbox üres: "Nincs több jelölt — az éjszakai kör hajnalban néz újra."
- Friss automata mention tónus nélkül: a tónus-pötty helyett semleges jelzés +
  a feed lábjegyzete mondja ki, hogy az éjszakai kör tölti.
- Szűrésre üres feed: "Erre a szűrésre nincs említés — próbáld tágabban."
- Hét említés nélküli személy: "Csendben maradt" szekció, nem vádló hangnem.
- Elvetett jelölt nevét az extraktor nem javasolja újra (reject-lista a person
  soft-deleted candidate sorával).

## 6. Kapuzás, hibadoktrína

Új `mezo.feature.people.enabled` switch (`PEOPLE_SWITCH`); a detektálás-réteg
`PEOPLE_SWITCH` ∧ forrás-switch, a gráf-tükör `PEOPLE_SWITCH` ∧
`KNOWLEDGE_GRAPH_SWITCH`, az LLM-kör mindezek ∧ `COMPANION_SWITCH`. Minden async út
IDENT-3 (degrade to empty, warn, sosem töri a user-írást). LLM-hívások a `llm_log`
auditba mennek a meglévő adapter-mintán.

## 7. Tesztelés

- **Backend**: `PeopleContractIT` bővítés (CRUD + decision + bővült DTO-k);
  `MentionDetectionListenerIT` (match, alias-match, ékezet-hajtogatás, dedup,
  switch-off = no-op); `PersonExtractionServiceIT` a `FakeCompanionLlm`
  marker-dispatch mintájával (gazdagítás, jelölt-javaslat, bizonytalan → no-op);
  `GraphPromotionServiceIT` bővítés (PERSON upsert/retract). ArchUnit + codemap
  regenerálás ugyanabban a körben (focused IT-k ezt kihagynák).
- **Frontend**: hook-tesztek MSW-vel (real mód) + mock-seed tesztek; mindkét mód
  zölden (`pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — a worktree-ben
  a real-mód gate-hez `VITE_USE_MOCK=false` explicit).
- **CI**: a teljes backend IT-suite a self-PR-en fut (a 16 GB-os gépen csak focused).

## 8. Szeletelés (bd issue-k a mezo-06o0 alatt)

1. **S1 — séma + kontraktus + person CRUD** (BE+FE): migrációk, people.yml bővítés,
   CRUD végpontok, Új személy/Szerkesztés sheetek, aliasok. Önmagában értékes.
2. **S2 — azonnali név-match**: `MentionDetectionListener` minden narratív forrásra,
   dedup, forrás-jelzés a feedben, ✕ visszavonás.
3. **S3 — csempés hub UI**: hub-mozaik + Említések/Heti kép oldalak a prototípus
   szerint (S1–S2 adataira; LLM-mezők üresen is működik).
4. **S4 — éjszakai LLM-kör**: `PersonExtractionService` (gazdagítás + jelöltek),
   jelölt-inbox oldal + decision végpont.
5. **S5 — gráf-tükör**: PERSON node kind, promóció, esemény-élek, "Kapcsolt
   események" szekció a részleteknél.
6. **S6 — heti/detail polish**: hangulat-ív aggregáció, irányok számítása, "Csendben
   maradt", Mezo-észrevétel sáv (companion message kind).

Függés: S2→S1, S3→S1, S4→S2, S5→S1, S6→S3+S4; az S4 esemény-él-javaslatai csak S5
megléte után élesednek (addig az extraktor kihagyja őket). S1–S3 LLM nélkül is teljes
értékű terméket ad.
