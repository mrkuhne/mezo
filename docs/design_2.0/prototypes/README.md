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
| `mezociklus.html` | https://claude.ai/code/artifact/a4f4ecdd-decc-4524-9fab-931af7a9c8b3 |
| `edzes-session.html` | https://claude.ai/code/artifact/0a747fcc-0359-462a-8b8b-1de02a611f77 |
| `fuel-tab.html` | https://claude.ai/code/artifact/e0da58f6-f4ef-4874-b60e-b83a1998ba0e |
| `mezo-tab.html` | https://claude.ai/code/artifact/797270dd-f1dc-4196-b492-aa4ffb22d2de |

## Workflow

1. Edit the parts in `src/` (`*-head.html` = title + CSS; `*-body.html` = markup + JS).
2. Run `./build.sh` — it inlines the sprites from `../assets/` into the 6 assembled files.
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
  fact-provenance groups).
