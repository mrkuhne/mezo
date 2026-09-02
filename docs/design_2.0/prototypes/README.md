# UI Redesign Prototypes (mezo-88jw)

Self-contained, interactive single-file HTML prototypes for the Napív→Clay UI redesign.
Open them directly in a browser, or view the published artifacts below. Design decisions and
the full context live in `../2026-08-26-ui-ia-redesign-handoff.md`; the clay icon/spot sprites
they inline come from `../assets/`.

## Files ↔ published artifacts

| File | Artifact URL (republish with `url` to keep the link) |
|---|---|
| `clay-csomag.html` | https://claude.ai/code/artifact/79f7676e-7998-4a61-b098-44c2e0f8b905 |
| `nap-gerinc.html` | https://claude.ai/code/artifact/e1eae7d4-05bc-41c9-8e7e-55bdbee70249 |
| `edzes-tab.html` | https://claude.ai/code/artifact/d9fd807c-71ca-4c27-b8c9-7d32aca48d15 |
| `mezociklus.html` | https://claude.ai/code/artifact/46daab1d-d30f-4f44-a435-65f225cf6e38 |
| `edzes-session.html` | https://claude.ai/code/artifact/0a747fcc-0359-462a-8b8b-1de02a611f77 |
| `fuel-tab.html` | https://claude.ai/code/artifact/e0da58f6-f4ef-4874-b60e-b83a1998ba0e |
| `mezo-tab.html` | https://claude.ai/code/artifact/dc2800aa-7c1f-41f0-b33d-b3d127b544fa |
| `en-ia-valasztas.html` | https://claude.ai/code/artifact/418b2a2d-25ba-4441-8cb5-6b15c6ab88b2 |
| `en-tab.html` | https://claude.ai/code/artifact/dee0dd7e-f321-4f88-94ff-c7face496d70 |
| `napzaras.html` | https://claude.ai/code/artifact/0e4e02ba-d5c8-49ce-a738-b924f1583cf6 |
| `fuel-logolas.html` | — (not yet published; mezo-byo1 design source) |
| `fuel-log-multinap.html` | — (not yet published; A /fuel/log nap-léptetője + Pótlás-hangulat + hub-csali — mezo-1j3z) |
| `fuel-log-oldal.html` | — (not yet published; A logolás saját oldala a helyben nyíló composer helyett — /fuel/log/uj) |
| `fuel-logolas-2.1.html` | https://claude.ai/code/artifact/f4af0e21-8293-4732-a9e2-2a2c48a3427e (Logolás 2.1 — Keret-hero a /fuel/log-on, AI score pill + kcal, rost gyűrű, kontextus chip, breakdown sheet — mezo-zeeq) |
| `mezo-chat.html` | https://claude.ai/code/artifact/ae02e856-1e3d-4c60-aad5-842e75190538 |
| `edzes-review.html` | https://claude.ai/code/artifact/66f5a4de-8afe-48ff-b04f-e861b3ba22ee |
| `fuel-mely.html` | https://claude.ai/code/artifact/d5c6d770-a067-4642-baa3-9dee63613718 |
| `en-mely.html` | https://claude.ai/code/artifact/d7744124-37bb-4e7d-ac57-45cf66f1fc24 |
| `karakter-tab.html` | https://claude.ai/code/artifact/e723d44d-b0d7-484f-8b5f-9b5b41359bde |
| `emberek.html` | https://claude.ai/code/artifact/9c94ecde-f426-471a-a988-b0a60ca7fbcf |
| `mezo-memoar.html` | https://claude.ai/code/artifact/95759be5-7de6-4d04-af7b-60d7862dbe50 |
| `receptmuhely.html` | https://claude.ai/code/artifact/dc39e817-e89e-43df-b93f-53b568efed9f |
| `tudastar-egyben.html` | https://claude.ai/code/artifact/1ddf2a14-f5ce-4d4c-b125-c843e073797e |
| `kalauz.html` | https://claude.ai/code/artifact/aff4eff9-775c-4222-82cf-487d143479bf |
| `growth-tab.html` | https://claude.ai/code/artifact/393bca87-9095-42dd-ac55-127162ad0412 |
| `rutin-epito.html` | https://claude.ai/code/artifact/78c8f0f9-925f-44a9-93b4-3e9cc077e162 (Rutin-építő — széles Rutin csempe az Én hubon, /me/rutin hub erő-csíkokkal, 4 lépéses szokás-recept wizard Fogg / Clear keretre, szokás-szerkesztő — mezo-3zue) |
| `celok.html` | https://claude.ai/code/artifact/e404d1d4-55c3-4e81-a8b4-716c6ba45f87 |

## Workflow

1. Edit the parts in `src/` (`*-head.html` = title + CSS; `*-body.html` = markup + JS).
2. Run `./build.sh` — it inlines the sprites from `../assets/` into the assembled files.
3. Republish the assembled file as an artifact, passing the matching `url` above so the link
   stays stable.

Never edit the assembled files directly — they are build output (committed so the prototypes
are usable without a build step).

## What each prototype demonstrates

- **clay-csomag** — the asset catalog: Orb logo, 33 clay icons (tab-bar mute test included),
  14 spot graphics.
- **nap-gerinc** — the Nap (spine) tab: daypart panels (Reggel/Nap/Este) with per-panel entrance
  choreography, header daypart switch + notification bell + orb avatar, one hero + mosaic rule,
  minimal tile anatomy, five detail pages (Mezo messages, habits, quests, check-in with fillable
  slot, Életjel with segmented ring → need tiles), interactive water/stack tiles.
- **edzes-tab** — Edzés IA: hero (today's session + coach line) + 6 tiles; detail pages with
  muscle-zone bars, volume arc, e1RM sparkline, lap chart, medal cabinet.
  **Gyakorlatok page (full catalog, audited against the real `/train/exercises`)**: compact hero
  (title above icon+161) + stat strip; working search (name-substring) + two-level muscle filter
  (Összes · Plyo · 6 regions → sub-muscle chips, region reset clears sub); **dual-mode list**
  (default: `Top gyakorlatok · rekordjaid` ranked by sessionCount with #n plaques; searching:
  `Találatok · teljes katalógus`, records first then dashed **ghost rows** with 5-tick Stim
  meter — ghosts are not buttons); record card = muscle rail + thumb (icon or initial fallback)
  + tag stamps (muscle · type · n alkalom · Saját; plyo = filled amber) + 3-cell stat strip with
  two branches (weighted: Legjobb szett / e1RM / Összvolumen; bodyweight: Max rep / Összes rep /
  Szettek) + gated roundels (⋯ only on Saját, ▶ everywhere, tinted when video exists);
  record sheet (best-set hero, A/B demo-still crossfade with manual ⇄, tap-to-reveal player
  16:9 YT / 9:16 IG, 2×2 stat grid with `—` nulls, rep-PR table, last-5 bars); create/edit
  sheet (21 region-grouped muscle tokens, compound/isolation/plyo segmented, stim/fatigue
  0–1 steppers, video URL, CTA gated on name+muscle, two-tap delete); video sheet
  (Mentés + Eltávolítás when set).
  **Sport page (full surface, audited against the real `/train/sport`)**: compact hero
  (2/4 sessions) + live stat strip (idő/RPE/váll/XP — recomputed from the session list);
  3 segment views (`Heti terv | Napló | Cross-load`, selected segment speaks primary coral,
  never rose — ADR 0018 D5). **Heti terv**: 7 day cards stacking multiple slots per day
  (Kedd = cross + röpi), MA highlight + inline `Logold ›` (preselects the slot's sport in
  the log sheet), dashed empty days, one-offs merged into their weekday with an EGYSZERI
  stamp; `Egyszeri események` section with per-row ✕ delete + own sheet (date/time,
  meccs default, röpi-only kind toggle); `Szerkesztés` sheet = full-replace weekly editor
  (per-slot sport switch Röpi/Cross/TRX, time input, edzés/meccs toggle **only** for röpi
  — cross/TRX force training, 15-min duration stepper 15–360, helyszín + intenzitás,
  `+ Sport hozzáadása` per day, slot ✕). **Napló**: 4-week idő+RPE trend bars (gold = 7+
  RPE week; a designed answer to the "no trends" gap), session cards with kind-correct
  tags (fixes the hardcoded RÖPI), big RPE readout graded 7+ coral / 8+ amber (never red),
  Intenzitás/Váll minibars only when the value exists, `avg n ugrás` chip only when data
  carries jumps, quoted notes. **Cross-load**: per-system rows (Edzés/Étkezés/Alvás/Súly/
  Pattern), the váll −2 MRV row with amber rail, tool-transparency chips
  (read/compute/write). **Log sheet**: kind tiles, Idő stepper (15–600), Setek (röpi,
  0–50) vs Körök (cross/TRX, 1–50) branch, RPE 1–10 cumulative scale, Váll scale
  röpi-only (amber ≥7), **live Mezo observation card** reacting to the sliders
  (váll≥7 → Cable-variáns; RPE≥8 → holnap RIR 2; RPE≥7,5 → korai vacsora), notes input
  (designed addition for the contract's unused `notes` field), Mentés · +30 XP.
  **Futás page (full surface, audited against the real `/train/futas`)**: compact hero
  (Hét 3/8) + live stat strip; 3 segments (`E heti edzés | Napló | Tervek`), the `＋ Új terv`
  header chip renders **only** on Tervek (real behavior). **E heti edzés**: block card with
  goal eyebrow + phase label + N-segment week strip (past 50%, current glowing), session
  cards with FUTÁS tag, RPE-target chip (sprint min≥9 = terracotta, else amber), segment
  pills (warmup / `8× · 45 mp` work / `90 mp séta` rest / cooldown; pyramid = joined
  `15／30／45` + `pihenő = szakasz × 2` note), three-way CTA (MA → `Naplózd`, past →
  `Pótold`, future → disabled grey `Naplózás ▸`, done → KÉSZ ✓), honest cross-load card
  ("a teljes bekötés a pattern-engine része lesz"). **Napló**: HR-recovery trend bars
  (lower = better, Δmp colored; designed answer to the "no trends" gap), run cards with
  conditional chips (RPE / kör / mp pulzus — the old pyramid logs honestly show no kör),
  quoted notes. **Tervek**: Aktív/Tervezett/Archív sections with counts, status chips
  (active sky / planned amber / archived neutral at 0.7 opacity + summary), active card
  carries the week strip + `Builder ›`; `＋ Új terv` = create-then-navigate into the
  builder. **Builder page** (full-screen, like the real `/train/futas/:id`): auto-save
  pill cycling `Mentés… → ✓ Mentve` (no Save button), title + goal inputs, week chips 1–8
  with ＋/− (cap enforced, current week ringed), per-session two-zone editor —
  **Menetrend · minden héten** (7-day grid H/K/Sze/Cs/P/Szo/V + time) vs
  **Terhelés · N. hét** (sprint: kör + mp-pihenő steppers; pyramid: pills cycling
  15→30→45→60 on tap, ✕ delete, `＋ szakasz`), status CTA (`Aktiválás` enforcing
  single-active / `Lezárás` → archived / archived = no CTA), Duplikálás + Törlés.
  **Run log sheet**: Teljesített körök stepper (shown for pyramid too — designed fix for
  the real scoring bug), RPE 1–10 scale, Pulzus-megnyugvás stepper (5-ös lépések),
  jegyzet, Mentés · +40 XP.
- **mezociklus** — full mesocycle functionality: hub (hero + Volumen/Történet/Sablonok/Új blokk
  tiles), MEV/MAV/MRV provenance bars with expandable derivation, 5-step wizard (tappable phase
  curve, Emphasize cap 2, program editor with day breakdown + session-cap 11 + Lint/PeakFit,
  searchable multi-add exercise picker, ▲▼ reorder), start/close sheets (close → report),
  frozen report, Történet selection mode → A/B compare page.
- **fuel-tab** — the Fuel hub, audited against the real `/fuel` routes. **Hub = the old Mai page's
  soul**: keret-hero stripped to one number — the kcal **consumed today** (target implied by
  the energy chips; no eyebrow, no eddig/cél line, no coach text in the hero),
  proportional day-bar built from done-window kcal segments + gold now-marker,
  energy chips Alap/Mozgás/Cél — the whole row vanishes on static energy, 5 rings
  Fehérje·Szénh.·Zsír·Rost·Víz where the water ring is a button → WaterLogSheet), the
  **window swimlane** — every user-scheduled eating window (the ones the AI recommends
  against) is its own tile in a horizontally scrolling lane with its own clay meal icon
  (`i-reggeli` egg / `i-ebed` bowl / `i-snack` apple / `i-vacsora` pot): every tile carries a **kcal mini-tile + three mini macro rings** (P coral · C amber ·
  F lavender — fill = this meal's share of the daily target); done = sage wash +
  KÉSZ ✓ + meal name + AI-score chip (fresh log = ✨ folyamatban), now = coral
  ring + MOST stamp + plan meal + Logold CTA, missed = dashed amber + "még pótolható" + Pótold
  (never punitive), future = plan suggestion + ghost Logold; the lane auto-scrolls to the MOST
  tile and ends with the out-of-window log tile (＋ Logolás / ✨ AI napló); the lane
  carries no header — it speaks for itself; below it a **Mezo banner tile** ("2 új
  Fuel-üzenet ma") opens the Mezo · Fuel page collecting the fuel-context companion messages
  (time + context eyebrows) — the hub shows only the counter, never repeats the voice — then
  6 tiles. **Unified full-page log flow** (manual + AI merged
  into one: slot segments defaulting to the launching window's slot — the mezo-bnsf fix
  pattern —, derived-until-touched name, three colorful source tiles — Kamra (gold, grams,
  multi-add picker that stays open), Recept (coral, servings, closes on pick), ✨ AI
  (lavender inline panel: text and/or photo, combinable) — AI-recognized lines land as
  BECSLÉS-tagged items next to the manual ones, so one meal can mix photo + text + pantry
  items; every line amount is a typeable input with ± steppers, per-line macros and the
  totals card recompute live; ✓ Logolás · +10 XP flips the window tile to done and updates
  hero, day-bar, rings) and **water sheet** (250/400/500 chips, manual ml overrides and deselects the
  chip). Sketch-level subpages behind the tiles: **Terv** (stat strip, 24h week-rhythm grid with
  gym/röpi bars + kitchen-close & caffeine-cutoff markers *derived from settings — designed fix
  for the hardcoded ones*, medication-cycle strip; empty sections stay hidden), **Stack**
  (redesigned on the Edzés-subpage recipe: stat strip, a day-arc timeline with zone dots —
  done sage ✓, next pulsing gold ring, MA marker, staggered time labels —, a featured
  KÖVETKEZŐ card with a big tick, kind-colored dot and the Mezo "why here" note — the
  unreachable `mezoNote` surfaced —, remaining zones in a 2-column mini-mosaic; every tick
  live-updates hero, stats, timeline and the hub tile; all-done → quiet "szép ritmus" card;
  meal-match ✓/⚠ with amber advice kept),
  **Receptek** (type filter with live counts *incl. the new Snack segment*; spacious cards:
  tall image band with a clay meal icon on a halo disc, slot chip + role tag + ★ + fit badge
  or ✨ pending, a row of four tinted macro mini-tiles (kcal sage · P coral · C amber ·
  F lavender), NOVA dot 1 sage / 2-3 amber /
  4 terracotta, and a live footer surfacing the never-shown contract fields
  `timesLogged`/`avgScore`/`lastLogged` — unlogged recipes say so honestly), **Kamra** (stat strip; search + type switcher *incl. the new Gyógyszer
  segment*; type-grouped list of kind-washed rail cards with monogram discs — food rows
  brand + NOVA dot + tinted kcal/100g cell, supp/stim/med rows italic protocol + tinted dose
  cell; a ✨ Mezo suggestion card and the Legutóbbi importok rows (OFF/FOTÓ source tags,
  amber "ellenőrzés"), both hidden when empty; honest no-hit; tapping a row opens the
  **item detail page** — monogram disc, source badge + brand + category + NOVA, macro
  mini-tiles and nutrient cells /100 g with honest `—` dashes, price row, "Receptekben"
  chips surfacing the never-shown `usedInRecipes`, dose + "a stackben" cross-link for
  supp/stim, ＋ Logolás bridging into the log sheet as a KAMRA line (100 g, hero updates
  without touching a window — the real out-of-window semantics), and a two-tap Törlés
  that removes the item and live-updates hero + stats + list), **Gyógyszer** (med card with cycle bar — peak terracotta never red — phase
  note, dose list with note; new sprite icon `i-injekcio`), **Napló** (designed addition for
  the "no trends anywhere in Fuel" gap, now week-centric: week-picker segments over per-week
  stored data — daily kcal bars with a dashed goal line (today = gold "in progress" bar,
  future days = honest empty slots), protein-day counter, per-day macro-average mini-tiles,
  and Súly heti átlag + AI-átlag cards with vs-previous-week deltas; the hero number follows
  the selected week's AI average).
- **edzes-session** — the full gym session flow (interactive state machine, feature-complete
  against `frontend/src/features/train/pages/ActiveWorkoutPage.tsx`).
  **Prep = Huawei tile IA**: hero (eyebrow + name + 4 mini stat cells: várható XP / szett / idő /
  izomcsoport + CTA above the fold), then a 6-tile mosaic — Gyakorlatok, Fejlődés, Heti zóna,
  Küldetések (badge), Bemelegítés, Niggle (badge; "Értem" → kezelve ✓) — each opening its own
  page with a compact hero (title above an icon+number row, no subtitles) + stat strip +
  animated bars/rings in the Heti zóna recipe. Gyakorlatok page: tile-styled exercise cards
  (family wash + rail, clay disc, labeled columns Cél · Induló súly, mini set dots carry the
  set count, 1RM medal, footer "múlt héten → progression chip" + challenge flag).
  **Live logging = calm default**: only the execution card is expanded — single-line name +
  small media icon buttons, muted metaline (🔥/🌿 · rep range · RIR · challenge chip),
  one-line note pill, white Logolás panel (slot label with cél, set dots + warmup-% note,
  flexible steppers, RIR 0–3 hidden on warmups, L/B/R for isolation, collapsed "＋ megjegyzés"
  toggle, CTA / rest bar with pause/skip at 10× demo speed); Progresszió and Szettek are thin
  collapsible strips with informative headers ("⚡ Progresszió · +2,5 kg ▾",
  "Szettek · 2/6 ✓ · 1 234 kg ▾"); 5-way navigation, medal toast, ⋯ sheet
  (reorder/skip/+szett with "Csak ma / Minden hétre"/durable note/early finish), set table
  rows edit/delete with one-slot floor. RP debrief per exercise, closing summary (halo hero,
  muscle pills, medals + target sets, challenge outcomes, per-exercise chip map, note),
  finish → level-up screen → closed mode.
- **edzes-review** — the *visszanézés* of a finished workout (`/train/review/:id`), the F7.2
  design round. The shell is the session prototype's summary; what the `closed` mode gains is
  **context**. (1) A **„Mihez képest" tile** under the hero names the reference session
  (`Előző Pull A · aug. 12. · 2 héttel korábban` — the gap between the two sessions, not the age
  from today) and gives three deltas mirroring the stat strip: volumen · célszett · Ø RIR. Under
  ADR 0010 the number is signed and honest while the **colour never punishes** — sage only
  upward, neutral graphite downward, coral and red absent; **Ø RIR is always neutral**, because
  there less is harder. (2) The per-exercise inventory stops being a stack of near-identical white
  cards and becomes a **horizontal swimlane** (the Fuel hub's window-lane precedent): one tile per
  exercise in its muscle family's wash, carrying a monogram disc, a REKORD stamp, **one anchor
  number** — the top working set — and a set-bar row (solid = logged · gold = medal · faint =
  warmup · dashed = missed). Depth is not in the scroll: each tile opens the exercise's **own
  page**, where every set is its own tile — `90 kg × 8 · RIR 2 · célsávban · 720 kg` — with the
  medal set in gold, the missed set as a ghost tile, **the set note under its own set**
  (`ExerciseSetResponse.note`, on the wire today and shown nowhere), and a stat strip whose fourth
  cell is the previous session's top set, gated exactly like the context tile. (3) **Stepping runs on the template-day
  chain** (`← Előző Pull A` / `Következő Pull A →`), the same axis the comparison uses, so there
  is one mental model rather than two. Three live Pull A sessions demonstrate all of it,
  including the honesty gate: the oldest is the mesocycle's first Pull A, so **the tile does not
  render at all** — no "nincs adat" placeholder. The `Lezárás` toggle shows the other mode: no
  tile, no stepping (there is nowhere to step while closing), and the closing CTA — where today's
  **dead `<textarea>` used to be**. (4) **That slice has now landed in the prototype**
  (`mezo-d20.8.2.2`): the closing screen's note field is back, but *real* — not a bare box but a
  question, **„Hogy ment?"**, optional and skippable, sitting ABOVE the finish CTA so the mobile
  keyboard pushes the button rather than covering it (the CTA is in flow, never `position: fixed`).
  In `closed` mode the saved sentence returns as a **Fraunces-italic block** ("Amit aznap írtál")
  with a ✎ that opens it for in-place editing — saving it empty clears it. The **aug. 12. session
  deliberately has no note**, so the honesty gate is visible here too: no empty placeholder, but a
  quiet **`＋ Jegyzet ehhez az edzéshez`** — on the revisit page, filling a gap is a meaningful
  intent, while displaying its absence would not be.
- **mezo-tab** — the Mezo tab (the companion's home), audited against the real `/insights`
  section (in the live app the companion is the Chat sub-tab of Insights; the redesign
  promotes it to a first-class tab). **Hub**: a breathing clay **orb hero** — no number hero,
  the relationship is the hero: one proactive companion sentence + quiet status
  (Gemini · élő · együtt 47 napja); a composer-shaped **chat opener** ("Mondj valamit…" +
  mic + send) that opens the full-screen chat; the motor's single **decision card** in a gold
  ring (Megerősítem / Figyeljük / Elvetem — deciding flips it to a sage acknowledgement and
  live-updates the Minták tile, the lifecycle grid and the memory band); a 6-tile mosaic
  (Minták, Heti, Memoár, Tudástár, Előrejelzések, Kísérletek) with live bottom lines; and a
  full-width **memory band** L0→L3 (nyers napok › napló › ítélet › tény) opening the Memória
  page. **Chat page**: the audited anatomy — Mezo eyebrow + timestamp, tool chips above the
  answer, `Hivatkozott · L3` refs footer with *human labels instead of raw ids* (designed fix
  for the real app's inert-refs gap), a collapsed `Emlékek · N` disclosure (date · source ·
  similarity% + gist), 👍/👎 feedback with the four reason chips on 👎; live send: typing
  dots → tool chip streams in → answer lands; mic records then transcribes into the input
  (never auto-sends); Beszélgetések sheet (rows with orb variants, active row, Névtelen
  beszélgetés fallback, ＋ Új) and an Új chat empty state. **Subpages**: Minták (motor prose
  with three bold numbers, 3×2 lifecycle grid where "döntésre vár" glows gold, the same
  decision card in sync with the hub, Megerősítve/Megfigyelés/Még gyűlik sections with
  human confidence words — never raw r/p —, Adat-egészség coverage rings), Heti (82/100 hero
  + delta chip, trend rows with ↗→↘ arrows, Mezo tervjavaslat with feedback chips, Growth
  weekly block), Memoár (Fraunces-titled chapter card with a lavender glow, anchor chips,
  anniversary card), Tudástár (approval inbox card — Elfogad moves the fact into the top
  section and bumps every counter —, search + category chips, "Most ezeket kapja meg a
  társ · 10" sage section with per-row toggles, kimarad/kikapcsolva sections with honest
  footnotes), Előrejelzések and Kísérletek (*Hungarian status chips — ◐ Folyamatban /
  ✓ Bevált / ◇ Javaslat — localizing the real app's English ones*; confidence bars, basis
  prose, acceptable proposal card that flips to ◐ Aktív 0/7), Memória (4 segments: Rétegek —
  L0→L3 layer cards joined by pulsing dashed connectors carrying human cron times; Napló —
  nightly-written day cards with embedded dots; Kereső — match-ring result cards with the
  score-math chips egyezés × frissesség = végső; Audit — cost hero, token columns,
  fact-provenance groups). **Tile pass (Daniel's direction: "élőbb, mozgóbb, színesebb,
  csempés a listák helyett"):** every list-row pattern on the subpages became washed Huawei
  tiles with clay icons, rise staggers and animated bars — Minták: colorful lifecycle cells
  (the decision cell pulses gold) + 2-col pattern tiles (confirmed sage + confidence chip,
  watching lavender + animated evidence bar, gathering dashed amber) + coverage-ring tile
  strip; Heti: metric tiles (wash + icon + arrow + animated bar, protein day-dots, wide
  weight-trend tile) + tinted Growth mini-cells; Tudástár: category-washed fact tiles
  (edzés coral · egészség amber · élet sky; disabled facts fade to dashed); Előrejelzések /
  Kísérletek: status-washed tiles (pending lavender, confirmed sage, active amber + day
  dots); Memória: per-layer colored L0→L3 cards with icons + tinted provenance cells.
- **en-ia-valasztas** — IA decision mockup (not a product page): where does the **Én** tab go?
  Three live-proportion phone frames — A: Én behind the header avatar (4 tabs + center FAB
  unchanged), B: Én as a fifth tab + the quick-log as a floating coral FAB bottom-right
  (recommended: Én's content — goal, weight, sleep, growth — deserves first-class visibility,
  and the log FAB stays in the thumb zone on *every* screen), C: fifth tab + quick-log in the
  header (Daniel's initial idea; reachable everywhere but the worst one-handed zone). Built
  standalone (not in build.sh); the changed element is marked with a dashed coral callout.
  Decision pending — the winning option gets rolled into all prototype tab bars.
- **en-tab** — the Én tab (decision B: fifth first-class tab), audited against the real `/me`
  section (`2026-08-27-en-feature-audit.md` — 9 sub-tabs + 5 full-screen pages). **Hub**:
  identity hero (avatar with the in-level XP ring, name, equipped title chip, Lv · XP · 🔥 ·
  🪙 row, and the bio line — only the filled bits, the whole row vanishes empty), the
  coral-ringed **goal card** (trajectory + title, animated progress track with indulás/most/cél
  labels, Hátra · Tempó · ETA mini-cells; maintain goals drop the track and read `tartás` per
  the real contract), 9 tiles (**Heti**, Súly, Alvás, Growth, Napló, Emberek, Tudás, Értesítés,
  AI-napló) with live bottom lines, and a Beállítások band (theme sheet: Világos/Sötét/
  Cirkadián with the real −90p copy). **Subpages** (all tile-based, rise-staggered, animated
  bars): Cél (hero card with guard chips + identity quote, the engine's prescription as
  **segment tiles** — W1–12 mély deficit amber · W13–20 taper sage, each with 4 mini-cells +
  rationale —, guard pills incl. the honest `Fehérje: Fuel-re vár`, a gym/futás/röplabda
  timeline with the ⚠ W1–4 fedezetlen chip, dashed plan slots), **Heti** (see the dedicated
  paragraph below), Súly (−2,8 kg hero, stat
  strip, trend chart with actual-MA + plan + ±1 kg tolerance band, weekly tiles with delta
  pills and direction; the log sheet with steppers + the context tip — saving cascades into
  the hero, bio line, goal card and hub tile), Alvás (goal card with the bed rail 🛏️→☀️,
  Rendszeresség/Hatékonyság ring tiles, phase rail + reference rows — `a sávban`, never red —,
  7-night stacked phase columns with quality dots, daily "Miért számít?" card, and the **dark
  Éjszakai mód tile**), Éjszakai mód (pitch-dark page, NO clocks or countdowns: Felébredtél? →
  Ébren vagyok → breathing orb + 3 tools; demo chip advances to the 20-minute Kelj fel state),
  Growth (hero trio XP/Fegyelem/Ritmus + 4 segments: LIFE/Atlétikus/Izom band tiles with
  animated skill bars + savings, Rutin 30-day 🌅/🌙 counters + chain tiles, Napló day tiles
  with `csendben lejárt` honesty, Kitüntetések badge grid — achieved sage ✓, rest with
  progress bars), Napló (gratitude streak tile, gold decision tile with inline 1–5 review that
  settles to a sage acknowledgement, month-grouped note tiles), Emberek (2-col person tiles
  with affect-ring avatars, mention tiles with the FIGYELEM badge + pattern tie), Tudás
  (summary tile, grouped node tiles with edge lines and a live Archivál that decrements every
  counter), Értesítés (dark daily-load card with a 24-hour spark + dense-window warning that
  **recomputes live as category toggles flip**, master toggle, 3 category groups with washes,
  the gym-only −45 perc lead chip, and the honest brain-events footnote), AI-napló (cost hero
  with Ma/Hét/Hónap segments, feature cost bars, call tiles with status rails — siker sage ·
  hiba terracotta · megszakadt amber — and the `~ becslés` footnote). **Quick log** (the
  floating FAB, wired live here — the same sheet sits behind every tab's FAB): audited against
  the real `QuickInputSheet` (title `Gyors logolás` / `bármikor, két koppintás`, 8-tile grid +
  highlighted chat row, Alvás/Napló/Check-in swap in place). Redesign: a **context-aware MOST
  head** (13:30 → Ebéd-ablak tile with the plan meal + Logold, echoing the Fuel swimlane —
  designed addition over the static grid), **do-it-here duo tiles** — Víz with ＋250/＋400/＋500
  chips that log in place (live HU-grouped counter + toast) and **Check-in as the full
  Heartbeat flow** (the tile shows the four measured dimensions as mini-cells — the morning
  reading faded —, tapping opens the real stepped measurement: Energia · Stressz · Testi ·
  Mentális tisztaság on 1–10 scales with auto-advance + Kihagy, then a 2×2 tap-back summary
  grid, the optional 200-char sentence, and **Mezo's reactive azonnali olvasat** card driven
  by the entered values — the real rule set) —, six mini tiles with live context sublines (Súly opens the weight sheet in place;
  Alvás honestly reads `ma ✓ 7,5 h` and refuses to re-log; Napló → picker, then **all three
  branches with their own in-place UIs**: Aktivitás (textarea + "Az AI besorolja…" note →
  ambiguous-skill picker grid quoting the entry → done card `+15 XP` + quest-completed line),
  Napló (textarea + working mic transcript + Dátum row + ✓ Mentem), Hála (1–3 growable rows
  with the real placeholders + `＋ Még egy`, saving bumps the streak to 5 and cascades to the
  hub tile and page hero); Étkezés/Edzés/Stack navigate with `ma 16:45 · Pull` / `köv. 16:45 · koffein`
  sublines), and the Mezo row at the bottom (`Mondd el Mezónak · kérdezz, mesélj — vagy logolj
  szóban`) keeping chat as a logging path.
- **en-tab → Heti áttekintés** — the weekly-review page, audited against the freshly merged
  `feat/weekly-review` slice (`2026-08-27-heti-feature-audit.md`: `/me/week` + `GET /api/me/week/{start}`,
  `GET|POST /api/proactive/weekly-review/{start}[/regenerate]`, `…/digest`, the Monday 06:50 generator
  and the Monday 10:00 push). The real page is one long scroll of cards; this round rebuilds it as a
  **tile hub with four view subpages** (Daniel's round-2 note: *"picit sok a scroll… legyen itt is pár
  csempe"*) — hub scroll height 1651 px -> 525 px. **Hub**: the animated score ring (number spins up from
  0, band-coloured — 80+ sage · 70+ gold · below terracotta, never red), a delta pill against last week
  and an **8-week score trend** with the viewed week ringed (`tanulom` under two measured days); eight
  tinted mini-cells — the real six plus **check-in energy** and **latest weight**, both returned by the
  backend and unused today; then the four tiles; then the `Mezo · a következő heted` band (current week
  only, matching the real gating) and the honesty footnote. **1 · Heti elemzés** (wide, lav-ringed):
  orb + the review's first sentence + the week's **mini score bars** + the generation stamp (or
  `hétfőn jön` / `nincs még`) → subpage with the Napi pontszám card (band-coloured columns, MA marker,
  date-derived axis — today's chart hardcodes `Sz` for both Szerda and Szombat —, tapping a column opens
  the days page and expands that day), the full review card with the **`amire épült` anchor chips**
  (Minta · Tudás · Életesemény · Emlék — the model selects these by index and the real UI drops them
  entirely), stale refresh, thumbs feedback, `Beszélgess a hétről`, and a hand-off band to the lessons.
  **2 · A hét tanulságai**: open-candidate count → subpage with the cross-day candidate facts, each with
  an evidence line and `Tanuld meg` / `Nem rólam szól`; accepting cascades into the tile, the hub Tudás
  tile and the graph count (backend flag A). **3 · A hét napjai**: `5 / 7 nap` + seven mini score rings
  → subpage as a **2-column day mosaic** (round 3: the first pass was still a row list), each day a tile
  washed by its score band, with the big score, the four subscores as **animated sparks** (sleep sky ·
  fuel sage · check-in rose · activity coral) and clay-icon data chips (kcal · sleep · workouts ·
  check-in n/4 · a `jegyzet` chip when Mezo wrote about the day); above them mini-cells for
  *legjobb nap · leggyengébb · tanulom*. Tapping a tile opens a **dedicated day page** (round 4 —
  the in-place full-width expansion punched a hole in the mosaic when a right-column tile opened): hero
  with the day's score ring and data chips, `Miből jött össze` with the four subscore rings,
  `Fuel · a cél ellenében` with three target bars, alvás · edzés · súly · XP cells, the Mezo note on an
  **orb card** with feedback and `Beszélgess a napról`, and finally **‹ előző nap / következő nap ›**
  tiles carrying the neighbours' scores so the week can be stepped through without leaving. Honest
  distinction the shipped UI does not draw: **`tanulom`** = fewer than two domains have data (`kitalálni
  nem fog`) · **`nincs adat`** = nothing was logged that day, so it does not count toward the weekly
  score · future days get their own empty page. When the review wrote no note for a day, the page says
  so instead of staying silent. **4 · Heti felfedezések**: `5 új nyom a
  memóriában` + category dots → subpage mosaic with the status information the API returns and the UI
  drops: pattern `event` (✓ Megerősítve · ▲ Erősödött · ★ Előléptetve), life-event dates, prediction
  outcomes (◐ Folyamatban · ✓ Bevált · ✗ Nem jött be); the header line separates these (things that
  already happened) from tile 2's candidates. **Honest states split apart**: a running week reads
  `Hétfő reggel érkezik… 4 / 7 nap logolva`; a finished week with no review offers
  **`✦ Készítsd el most`** (the regenerate endpoint already does exactly this) with a live spinner that
  fills in a real summary, day notes and lessons and refreshes every hub tile; week stepping shows a
  **skeleton** (today's page has neither a loading nor an error state). Week navigation walks three live
  weeks: finished-with-review → finished-without → running.
- **mezo-chat** — the Mezo chat's provenance layers restructured per the §1 tile recipe
  (2026-08-31 round): orb-led single-row live header (back disc · breathing orb · name +
  status dot élő/demo/off · icon discs for conversations/new; the orb pulses faster and the
  status reads `dolgozom rajta…` while streaming), the raw tool-call pills collapsed into one
  human **work strip** (overlapping domain clay icons + `Utánanézett · n forrás`, tap → source
  list with human labels, params and ✓; builds live source-by-source during streaming), refs
  grouped into **domain chips** (`Súly ×7 · Alvás ×5 · …`, tap → the group's date chips; ≤3
  refs render expanded), recalled memories as a **horizontal lavender card strip** (type icon +
  date + similarity ring + 4-line clamped gist, tap → card widens and unclamps), subtler
  feedback chips, lav-sheen composer, and no floating FAB on the chat page. The F7.5 deep
  round added the **conversation actions**: a ⋯ disc in the header AND a kebab on every picker
  row open the same action sheet — Átnevezés (inline input, no confirm; reversible) and Törlés
  (two-step warm — never punishing — confirm; ChatGPT pattern minus swipe, which fights PWA
  scroll/back gestures) — plus the **error bubble**: a failed send keeps the user bubble in
  place and renders an amber bubble with **Újra** (re-sends the same turn — replace, don't
  append, no duplicated message) and **Szerkesztés** (returns the text to the composer).
- **mezo-memoar** — the Memoir archive (F7.5): the dead `Memoir archive` footer retired at
  mezo-d20.5.5 becomes a real page. Day One-pattern month-grouped timeline (month header +
  count, one card per week: week chip + date range + anchor count + Fraunces title + 2-line
  excerpt; the whole card is one tap target — avoiding Apple Journal's ambiguous tap zones).
  Tapping a card navigates — no modal — to the **chapter page** merged at mezo-uajy: hero
  (week + title + date), the drop-cap memoir card with multi-paragraph body, the humanized
  `Miből íródott` anchor chips (Emlék › day page, Minta › Patterns; Identitás static),
  feedback chips, and the előző/következő pager which walks the timeline order. Contract
  note baked into the aside: `GET /api/proactive/memoir/archive` returns the full list in
  one round (weekly cadence — a year is ~52 small records); the latest endpoint and its
  404 semantics stay untouched.
- **fuel-mely** — the F7.3 Fuel deep round: the four blocks that close the tab's last
  mixed-generation surfaces. (1) **Gyógyszer full lifecycle** — the page finally carries its own
  write paths: a ＋ Beadás dose sheet, an edit sheet, and a two-step inline **Leállítás** that is
  deliberately *not* error-red (a decision, not a mistake; history survives as `active:false`).
  The empty state stops being a dead end: **＋ Gyógyszer felvétele** opens the create sheet
  (name, active ingredient, route chips, dose, cadence, and a P/S/T phase-template preview) —
  the round's single new contract element is `POST /api/medication`. (2) **Recipe detail +
  editor** — the detail page trades its two tabs for a **mosaic**: image-band Mozaik hero with
  slot chip and fit badge, stat-strip macros with the /adag↔egész toggle, then four tiles
  (Pontszám ring · Mezo-olvasat · Hozzávalók · Logok). Depth is one tap away: the full score
  breakdown opens in the same sheet the meal score uses (one component, two callers), the
  ingredients open their own sliding page, and Szerkesztés slides in the editor as a sub-page. (3) The **étkezési ablakok**
  editor renders its existing two-tier validation honestly: Tier-1 errors in coral (a forbidden
  state — the one place the colour is legitimate), warnings in amber that never block, and the
  ✨ Mezo értékelése verdict card that never gates saving. A demo button flips the error state to
  clean so the gating is visible. (4) A **sheet-launcher** page shows the family pattern —
  grabber → eyebrow header + ✕ → tinted hero band → content → button row — on the six key sheets
  (MealScore with the score ring, StackPicker with koffein/a-stackben marks, StackItem zones,
  Import with all three modes, Energia's equation bar, Beadás); the remaining seven follow the
  pattern without their own drawing.
- **en-mely** — the F7.4 Én deep round. (1) The **life-area iconography tabló**: 8 new clay
  symbols (`i-life-*` in `assets/clay-icons.svg`) replacing the LIFE-skill emojis — meditating
  figure, clay eye, pan with yolk, coin stack, check tile, open book, interlocked rings, pillow —
  each shown beside its old emoji, plus two in-use rows (Growth skill row, Napzárás gratitude
  chips: the tab's last emoji-language family). (2) The **goal-planner wizard** in Mozaik dress:
  trajectory cards + guard chips (step 1), field cards + the live feasibility panel (step 2) —
  an aggressive pace warns in amber and offers the realistic date as a one-tap fix. (3) The
  **routine editor**: chain cards with clay daypart icons, habit rows with XP/mode chips,
  edit + AI-suggest sheets. (4) **Growth becomes the progression's home**: the Kitüntetések tab
  opens with a streak card (milestone bar + 🧊 saver) and a Címek section (Létra/Bolt tabs,
  coin balance, the Viselve/Felvesz/Megveszem/🔒 state machine) — the hub's 🔥/🪙 chips navigate
  here and the two standalone sheets retire. (5) The **People/Sleep sheet family** on the shared
  pattern with tinted heroes (Petra's full picture, mic-hero quick log, SleepLog with the
  night-trace prefill note + phase rail). (6) The **AI-call detail** as a Mozaik page: hero +
  three headline numbers in a stat strip, a four-segment token bar, meta chips, and payload
  cards with a fading cut.
- **karakter-tab** — the Karakter dossier page (Én tab family), audited against the shipped
  backend (`docs/features/character.md` — 7 CORE dimensions, `CharacterExpertCatalog`'s 7 named
  experts, Szkeptikus + Mezo, weekly konzílium, bootstrap, claim feedback). Shown standalone (not
  nested under the Én hub, per the round's brief — the aside notes the eventual tile placement).
  **Round 1 iteration** (Daniel's feedback on the published artifact, logged in
  [`2026-08-31-karakter-design-iterations.md`](../2026-08-31-karakter-design-iterations.md)):
  compacted the hub, gave every persona an orb-variant avatar, enriched the Konzílium page, and
  added an entrance/ambient motion pass across every page. **Round 2 / v3 (mezo-1gim.14, same
  iteration log)**: Daniel approved a new "Gépterem" transparency direction — a geek surface
  showing concretely what data feeds the dossier.
  **Hub** (hero + a compact 4-tile mosaic + a 5th thin full-width tile, still ~one screen): the
  7-segment maturity ring (one arc per CORE dimension, color = the owning expert's domain tint,
  arc length/opacity = maturity, animated sweep-in; center = overall % + "érettség") + a
  Fraunces-italic AI self-portrait line (a deliberate visual placeholder — the spec marks the
  identity-hero bio line out of scope for v1); four tiles — **Dimenziók** (live datum:
  CORE-average maturity % + dimension count), **Feed** (live datum: newest observation preview +
  "N új" + pulsing dot), **Csapat** (9-avatar orb cluster), **Konzílium** (latest-session date +
  pulsing dot) — plus the new **Gépterem** wide tile (graphite/slate technical wash, distinct
  from the four warm tiles; live datum: the last pipeline run's line, "ma 02:50 · 3
  megfigyelés"). **Dimenziók page**: the 8 dimension tiles (7 CORE + 1 CHAPTER example
  "Munka-stressz ciklus" in a dashed/distinct wash, AI-opened per the real konzílium mechanic)
  that used to live directly on the hub — tapping one still opens the dimension detail page.
  **Feed page**: day-grouped observations (persona-voiced, orb avatars) + konzílium-diff rows
  that can point at a specific dimension or the Konzílium page; each observation row now also
  carries a small **⚙ "miből?" gear** that expands the same signal-chain face used on the
  Gépterem page, inline, in context. **Dimension page** (generic template driven by a `DIMS`
  data array, one page for all 8): colored hero (orb avatar + title + big maturity number), a
  portrait prose card, claim tiles with confidence-word chips only (biztos sage / valószínű
  amber / figyeljük lavender — never a raw number, per the API's honest-words contract), an
  ÉRZÉKENY (sensitive) variant with a lavender frame + mirror-toned line, and three live
  feedback pills — Talál (sage flash + "köszönöm"), Nem igaz (the tile fades to a dashed
  "nyugdíjazva" state), Pontosítom (inline textarea + Küldés) — plus a "Beszélgess erről
  Mezóval" chat-handoff chip. **Csapat page**: 9 persona cards — the 7 experts (each an
  orb-variant avatar in its domain color, from the `docs/design_2.0/assets/clay-spots.svg`
  sprite — `s-orb-doki` … `s-orb-szkeptikus`, the same clay recipe as the Mezo logo orb, tinted
  + a dashed inner-ring motif) + the Szkeptikus (graphite orb, dry contrarian) + Mezo (the
  original coral `s-orb`, elnök). **Konzílium page**: a session list (date + WEEKLY/HAVI/
  BOOTSTRAP badge + outcome summary, pulsing dot on the unread newest row) — tapping the newest
  opens a transcript view in place: a tinted 3-cell outcome header (elfogadva/nyugdíjazva/
  portré átírva counts), phase labels (`Javaslatok` → `A Szkeptikus` → `Döntés`) with a dashed
  connector line behind the proposal turns, four persona-orb proposal bubbles (Doki/Drill/
  Táplálkozó/Pszichológus), a graphite Szkeptikus attack bubble, a full-width coral Mezo ruling
  bubble, and one gold-railed "DANIEL VÁLASZA" quote embedded inside an expert's bubble showing
  how claim feedback re-enters the konzílium — with an explicit honesty note that the
  transcript is the real exchange, never re-dramatized.
  **Gépterem page** (new, mezo-1gim.14): **Futás-idővonal** — five expandable pipeline-run rows
  (two nightly runs, the Sunday konzílium, the monthly deep read, the one-time bootstrap); a
  quiet night ("csendes nap · 0 hívás") is given equal visual weight to a noisy one, framed as
  the system correctly finding nothing rather than as an empty/error state. **Jel-lánc**
  drill-down inside the noisy run: each fired detector renders as a two-tone block — a
  monospace **KÓD** row (the real detector key — `logging-gap` / `checkin-gap` /
  `journal-silence` / `under-logging` / `journal-note` — + the deterministic summary + `refIds`
  pills) → `↓ LLM értelmezi` → an **LLM** row (the expert's orb + their voiced observation),
  making the "kód detektál, LLM értelmez" split from `character.md` §3/§7 visually true. The
  run also honestly names which four experts (Doki/Edző/Szomnológus/Antropológus) got no
  nightly signal today, per §9's documented detector-ownership gap. **Adatforrás-leltár**: the
  real per-job read windows (nightly 14 days, konzílium's unconsumed-observations +
  ACTIVE-claims + user-feedback, the monthly full-claim-base re-read, bootstrap's six-source
  corpus) followed by ten dashed **"még nincs bekötve"** rows for domains the dossier doesn't
  read yet (edzés-szettek/RIR, futás, sport, fuel-részletek, chat-témák, hála, döntés-napló,
  Életjel, streakek, emberek-említések) — doubling as the `mezo-1gim.15` ("MINDENT be") working
  checklist. **AI-napló link row**: notes every Karakter LLM call is stored in full
  (`feature=character`, one row per pipeline step), demo-linking to the AI-napló surface.
  **Bootstrap flow** (aside demo button): intro (orb + 9-avatar orb cluster, popping in one by
  one + "Kezdjétek el") → staged progress lines ("Doki a súlytrendet olvassa…" etc.) over a
  coral→gold gradient arc with a live count-up percentage → reveal (the hero ring animates in)
  → CTA into the first konzílium. **Honest 204 empty state** (aside demo button): "Még nincs
  elég történet" — no fabricated numbers, no empty-state theater. **Motion**: every page
  replays a staggered rise-in choreography on open (including the konzílium transcript and the
  Gépterem run rows, which re-trigger their own `.play`/expand state rather than relying on the
  page-open flow alone), plus ambient pulsing dots, popping mini-rings/avatars, and hover/press
  micro-interactions — all reduced-motion-guarded. New-content note: dimension/expert keys,
  detector keys, and the konzílium's read windows are pulled directly from
  `CharacterCoreCatalog`/`CharacterExpertCatalog`/`docs/features/character.md`, not invented.
  **Round 2b — leltár in four rounds**: the Adatforrás-leltár's "még nincs bekötve" list became
  four numbered, dashed **"N. KÖR"** groups (edzés & test / fuel & ciklus / psziché &
  viselkedés-meta / kapcsolatok & AI-meta) each showing its target detector key as a monospace
  ghost chip and a lavender "érzékeny" tag where relevant, plus a fainter "később" tail —
  doubling as the literal `mezo-1gim.15` working checklist. **Round 3 — no dropdowns, week
  navigation** (see [`2026-08-31-karakter-design-iterations.md`](../2026-08-31-karakter-design-iterations.md)
  for the full rationale): the Futás-idővonal's accordion rows are gone — every run (including
  quiet nights) now taps through to its own **run detail page** (kind-specific orb/clay hero +
  StatStrip + full-width `.chain.big` signal cards + "Hívott szakértők" op-chips + a konzílium
  outcome/transcript link + a run-scoped AI-napló row); the Feed's "⚙" now navigates to that same
  page (dynamic "‹ Feed" vs "‹ Gépterem" back label) instead of expanding inline. The flat list
  is replaced by a **week-stepper** (‹ aug 24–30 ›, day-grouped H–V rows, "MA" marker) with a
  compact month-jump popover for fast multi-week travel; rare runs (havi/bootstrap) live in a
  separate "Ritkább futások" list. Demo ships 3 mocked weeks with a fully working stepper.
  added an entrance/ambient motion pass across every page.
  **Hub** (hero + a compact 4-tile mosaic, ~one screen): the 7-segment maturity ring (one arc
  per CORE dimension, color = the owning expert's domain tint, arc length/opacity = maturity,
  animated sweep-in; center = overall % + "érettség") + a Fraunces-italic AI self-portrait line
  (a deliberate visual placeholder — the spec marks the identity-hero bio line out of scope for
  v1); then four tiles — **Dimenziók** (live datum: CORE-average maturity % + dimension count),
  **Feed** (live datum: newest observation preview + "N új" + pulsing dot), **Csapat** (9-avatar
  orb cluster), **Konzílium** (latest-session date + pulsing dot). **Dimenziók page**: the 8
  dimension tiles (7 CORE + 1 CHAPTER example "Munka-stressz ciklus" in a dashed/distinct wash,
  AI-opened per the real konzílium mechanic) that used to live directly on the hub — tapping one
  still opens the dimension detail page. **Feed page**: day-grouped observations (persona-voiced,
  orb avatars) + konzílium-diff rows that can point at a specific dimension or the Konzílium page
  — richer than the hub's single-line teaser now that it has its own screen. **Dimension page**
  (generic template driven by a `DIMS` data array, one page for all 8): colored hero (orb avatar +
  title + big maturity number), a portrait prose card, claim tiles with confidence-word chips only
  (biztos sage / valószínű amber / figyeljük lavender — never a raw number, per the API's
  honest-words contract), an ÉRZÉKENY (sensitive) variant with a lavender frame + mirror-toned
  line, and three live feedback pills — Talál (sage flash + "köszönöm"), Nem igaz (the tile fades
  to a dashed "nyugdíjazva" state), Pontosítom (inline textarea + Küldés) — plus a "Beszélgess
  erről Mezóval" chat-handoff chip. **Csapat page**: 9 persona cards — the 7 experts (each now an
  orb-variant avatar in its domain color: same clay-orb recipe as the Mezo logo, tinted + a
  dashed inner-ring motif — see the iteration log for the sprite-graduation plan) + the Szkeptikus
  (graphite orb, dry contrarian) + Mezo (the original coral `s-orb`, elnök). **Konzílium page**: a
  session list (date + WEEKLY/HAVI/BOOTSTRAP badge + outcome summary, pulsing dot on the unread
  newest row) — tapping the newest opens a transcript view in place: a tinted 3-cell outcome
  header (elfogadva/nyugdíjazva/portré átírva counts), phase labels (`Javaslatok` → `A Szkeptikus`
  → `Döntés`) with a dashed connector line behind the proposal turns, four persona-orb proposal
  bubbles (Doki/Drill/Táplálkozó/Pszichológus), a graphite Szkeptikus attack bubble, a full-width
  coral Mezo ruling bubble, and one gold-railed "DANIEL VÁLASZA" quote embedded inside an expert's
  bubble showing how claim feedback re-enters the konzílium — with an explicit honesty note that
  the transcript is the real exchange, never re-dramatized. **Bootstrap flow** (aside demo
  button): intro (orb + 9-avatar orb cluster, popping in one by one + "Kezdjétek el") → staged
  progress lines ("Doki a súlytrendet olvassa…" etc.) over a coral→gold gradient arc with a live
  count-up percentage → reveal (the hero ring animates in) → CTA into the first konzílium.
  **Honest 204 empty state** (aside demo button): "Még nincs elég történet" — no fabricated
  numbers, no empty-state theater. **Motion**: every page now replays a staggered rise-in
  choreography on open (including the konzílium transcript, which re-triggers its own `.play`
  class since it opens in place rather than through the page-open flow), plus ambient pulsing
  dots, popping mini-rings/avatars, and hover/press micro-interactions — all reduced-motion-guarded.
  New-content note: dimension/expert keys and voices are pulled directly from
  `CharacterCoreCatalog`/`CharacterExpertCatalog` in the backend, not invented; the persona orb
  icons are a runtime-generated placeholder (`buildOrbDefs()` in `karakter-body.html`), pending
  graduation into hand-tuned `docs/design_2.0/assets/` sprites on approval.
- **receptmuhely** — the Receptműhely (mezo-92pb): AI-driven recipe builder under Fuel,
  vászon-first hybrid per the 2026-09-01 spec (`docs/superpowers/specs/2026-09-01-receptmuhely-design.md`).
  The screen IS the live recipe canvas — editable Fraunces name + goal chip, macro overview card
  (kcal + P/C/F cells, /adag↔egész toggle, kcal-source breakdown bar), serving stepper that scales
  amounts proportionally, ingredient rows (Kamra tag + inline amount input with ± steppers and live
  per-row kcal; unmatched AI line = ✨ BECSLÉS tag — either gram-based with estimated per-100g macros and an
  editable amount, or "ízlés szerint" with a fixed estimate; no-data = honest `—`),
  collapsible Elkészítés, portaled save bar — with a docked chat strip below (preset chips
  High protein · Pre/Post workout · Lefekvés előtt · Reggeli, last-AI-message preview, composer +
  🏺 kamra picker sheet feeding context chips). Every AI turn is prose + a structured **patch**
  (never a full regen): only the touched rows flash a gold diff highlight and manual edits survive.
  All five presets have scripted patch rounds (pre/post note the MealRole write-through on save);
  two generic free-text rounds + honest demo-end fallback; F7.5 error bubble (Újra/Szerkesztés)
  via the aside's demo button; macros always computed from kamra facts (lineContribution math),
  never spoken by the LLM. Save → Receptkönyv with role toast; aside carries the demo script.
  New sprite icon `i-muhely` (assets/clay-icons.svg): coral pot + steam + gold AI sparks — the
  feature's entry-point icon, used in the header and the empty-canvas ghost card.
- **emberek** — the Emberek page rebuilt as a tile hub (Heti recipe: one-screen hub, zero
  scroll): hero + 3 mini-cells + 4 menu tiles (**Jelöltek** gold with pulsing badge — the
  nightly extractor's person candidates, accept/reject live-updates every counter; **A köröm**
  rose with a facepile — person grid with 8-week affect sparks + context dots → full detail
  page: HU stat cells, animated affect arc, context breakdown bars, linked graph-edge tiles,
  Mezo facts, quote timeline; **Említések** sky — "A hét ritmusa" day columns colored by
  dominant tone + tinted filter chips + tone-washed mention cards with clay source icons and
  ✕ undo on auto rows; **Heti kép** lavender — animated tone-mix bar, direction mosaic
  (↗ sage / ↘ amber tiles), Fraunces "A hét pillanata" quote, dashed "Csendben maradt" cards)
  + a Mezo observation band. Sheets: Log (ki · tónus · kontextus · jegyzet) and Új személy
  (name + alias chips for the name-matcher + relationship). All-clay iconography, no emoji.
  Backend vision it mocks: spec `docs/superpowers/specs/2026-08-31-emberek-section-design.md`.
- **growth-tab** — the Growth page (`/me/growth`) rebuilt from a hero + 4-way segment switch
  into the Fuel/Edzés **hub idiom** (brainstorm decisions IA=A · hero=A · Ma-strip=A): a
  **live hero** (XP count-up that continues from the last shown value after every chip tap /
  saved activity, three labelled bars — Szint `340 / 500`, Fegyelem `84%` that honestly
  *disappears* when null, Ritmus as the last-8-weeks dot row), a **Ma strip** (quest chips:
  done sage ✓ · open neutral · `csendben lejárt` dashed and faded, tap = the real DailyQuestList
  "Kész"; `＋ Tevékenység` opens the activity sheet in place → `+15 XP · Tanulás` toast; head
  → `/nap/kuldetesek`), and a **2×2 mosaic** whose lines come from each page's own hook
  (`33 skill · legjobb Lv 9` derived from band lengths, not the hardcoded 8/12/13; `12 reggel ·
  18 este / 30`; `18 ✓ · 4 ✎`; `5 / 9 jelvény · 12 napos sorozat` + pulsing dot while a
  milestone is near) — one screen, no scroll. Sub-pages: **Skillek** (lav; stat strip + three
  parallel band cards — clay LIFE icons, `Lv` plaques, animated meters, top-4 + `Mind a 8 ▸`
  expand, `→ perk Lv n` hint one level before a perk milestone), **Rutin** (gold; two 30-cell
  chain tiles, milestone pill only at 7/30, day navigator max today, ◦/✓ chain rows with 30-day
  strength %, past days summarise and a miss reads "holnap folytatódik", never terracotta),
  **Napló** (sky; an "Ez a hét" tile fed by the still-unconsumed `GET /api/progression/growth-week`
  — 4 mini-cells + savings —, then 30-day day tiles with `csendben lejárt` honesty),
  **Kitüntetések** (sage; streak card with milestone bar + saver, Címek Létra/Bolt with working
  Felvesz/Megveszem — the coin's only sink —, badge grid where unearned badges keep a conic
  progress ring instead of vanishing, perks). Demo controls: milestone flash, empty Ma strip,
  Fegyelem unknown, reset.
- **rutin-epito** — Rutin-építő (mezo-3zue): the routine surface leaves the Growth segments.
  **Én hub** with the six small tiles + a **full-width Rutin tile** (Mezo-hub Diagnózis/Karakter
  precedent; one live datum: today done / total + morning/evening chain strength, vanishes when
  there are no habits). **Rutin hub** (`/me/rutin`): hero (done / total + 28-day mean strength),
  statstrip (perfect mornings / evenings / active habits), chain cards with per-habit **strength
  bar + framework badge** (⚓ FOGG · ◈ CLEAR · – legacy), chain toggles, `＋ Új szokás-recept` +
  `✨ AI javaslat`; rows open the habit page, no tick control (ticking stays on `/nap/rutin`).
  **Wizard** (`/me/rutin/uj`, 4 steps, dot Stepper): framework cards (Fogg Habit Stacking /
  Clear Four Laws) → anchor chips from existing habits + mezo events / cue chips → tiny behavior
  (soft "too big" warning on the Fogg branch) + chain + LIFE area + XP (+ craving/identity on the
  Clear branch) → celebration / reward chips + **Vállalom** commitment tick that gates save; a
  **live sentence card** assembles the recipe as the blanks fill; save returns to the hub with
  the new row highlighted. **Habit page** (`/me/rutin/szokas/:id`): framework band, the recipe
  sentence large, 28-day history strip, framework fields, pause-without-losing-progress.
  Backend vision it mocks: spec `docs/superpowers/specs/2026-09-02-routine-builder-design.md`.
- **celok** — the Célok (life goals) hub + goal detail + five-step creation wizard, spec
  `docs/superpowers/specs/2026-09-02-lifegoal-system-design.md`. **Slice 1 implemented**
  (`mezo-iizd.1`, real backend `docs/features/lifegoal.md`): the PERMAH-ring hero, dimension
  chips, per-goal tiles, the pillar-card detail page, and the wizard's five steps (Cél · Keret ·
  Pillérek · Ha–akkor · Összegzés) all ship against a real `life_goal`/`life_goal_pillar`
  backend and a closed 28-entry signal catalog, in both FE modes. **Not yet implemented** (the
  prototype's remaining surface, slices 2–3): the scored ↗/→/↘ arrows and % readouts anywhere
  on the hub/detail/tiles (every numeric slot renders an honest `—` in the real build), the
  "Jelek" signals page, the Nap "Célok · ma" tile, the Heti goals card, the Growth skill-row
  chip, and the companion `[Célok]` prompt block — all scorer/job output the prototype narrates
  but the real engine has not yet computed.
