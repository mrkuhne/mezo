# Mezo — UI/IA Redesign Handoff (Claude Code → Claude Design)

> **How to use this document:** paste or attach it as the FIRST message of the Claude Design
> conversation. It carries the full context of a brainstorming session held in Claude Code on
> 2026-08-25/26 (bd issue `mezo-88jw`). Everything below was verified against the codebase and
> its docs — treat it as ground truth, do not re-invent it.
>
> **Instructions for Claude Design:** respond in Hungarian. All UI labels are Hungarian and must
> be used verbatim (glossary at the end). The user (Daniel) is the app's only user AND its
> developer — he knows every feature; what he needs from you is IA + visual direction, not
> feature ideas. Prefer showing over telling: mockups he can compare, one decision at a time.

---

## 1. What is Mezo

A single-user, iPhone-first PWA — a **life companion** for one person (Daniel, 33, 5×/week gym
hypertrophy training + 5×/week volleyball, weekly medication cycle under medical supervision).
It unifies training (RP-style mesocycles), nutrition (macros + supplements + meal windows),
sleep, weight, biometrics, check-ins, relationships, journaling — with a **layered AI memory**
(daily summaries → embeddings → confirmed knowledge facts → detected patterns) injected into
every LLM call. The product thesis: *"a tracker that knows you, a coach that instructs you, and
a companion that walks with you are three different products — Mezo is the third."*

Success metric: `coach_presence_score` (the companion's daily reliability) — explicitly NOT
engagement. Stack (context only): React 19 + Vite PWA, Spring Boot backend, Gemini LLM.

## 2. Identity axioms — these bind every UI decision

- **IDENT-1 — Companion, not coach.** First-person plural voice ("csináljuk", never "csináld").
  Mentor–apprentice archetype: may push back, never moralizes. No bare grades, no clinical tone.
- **IDENT-2 — Internal sphere only.** The app never acts outward (no messages/orders/calendar).
- **IDENT-3 — Never silent.** ≥3 contextual touches/day: morning briefing → midday nudge →
  evening closing. Presence is architecturally guaranteed.
- **IDENT-4 — Self-logging is the enemy.** Forms are the failure mode. Median input ≤10 s.
  Ladder: passive → voice → photo → AI question with chips → number tap → form as last resort.
- **IDENT-5 — Whole-life scope (PERMA).** Not a fitness app; life companion.
- **IDENT-6 — Cognitive offloading.** What the companion can decide, the user is never asked.

**Hard visual/ethical guardrails (from a 48-item dark-pattern catalog):**
- **XP is feedback, not payment** (ADR 0010): quests are offers, no failure state, no accept
  ceremony, no countdowns, no loot-box mechanics; XP never spendable; traits computed, never
  self-claimed. Streak exists but gets no weaponized widget.
- **No red / no failure framing.** Error color is terracotta `#C4634B`, never red; a missed
  window says "Pótold", never shame. Comparisons never color a regression red.
- **Honest states.** No fabricated numbers, ever. Unknown confidence renders as "tanulom";
  a missing data source renders NOTHING (no "—" placeholders, no empty-state theater where a
  real state exists). AI-derived numbers carry provenance (tool chips / ref tags).
- The niggle/crisis surface ("AnchorMode" / rough day) never uses warning tokens — it melts the
  screen into one warm holding point instead.

## 3. The daily loop the product is built around

1. **Morning:** open app → morning routine chain guides the start (weigh-in, sunlight, coffee
   timing…), read the companion's morning briefing, 1-tap check-in, creed + up to 3 daily foci.
2. **Day:** micro-logging (meals, water, supplement doses, weight), 4 check-in slots on
   notification, the workout itself (set-by-set logging, rest timer, pre-workout challenges).
3. **Evening:** evening routine chain → **Napzárás** ritual (6-act full-screen closing: arrival
   → the day's arc → reflection → open loops → XP harvest → release) → sleep-prep → night mode.
4. **Weekly:** memoir + weekly review reading, pattern/knowledge triage (Megerősít / Megfigyel /
   Elvet decisions), mesocycle maintenance, recipes/pantry upkeep.

## 4. Current IA — as shipped today

**Shell:** bottom bar with **4 tabs + center FAB**: `Ma · Edzés · [FAB: Gyors logolás] · Fuel ·
Én`. **Insights has NO tab** — reached only via a ✨ icon in the Today header. Every section has
a sticky `AppHero` (avatar + XP ring, level, 🔥 streak, ⚡ quests, 🪙 coins, 🔔 bell) and a
**hidden dropdown** (`SubNavDropdown` popover chip) for sub-navigation — no visible tab strip.

| Tab | Sub-pages (behind the dropdown) |
|---|---|
| **Ma** `/today` | one page, 3 daypart segments 🌅 Reggel · ☀️ Nap · 🌙 Este; MezoChip (companion thread), quests chip, 6 Életjel need-rings, then the daypart's list |
| **Edzés** `/train` | 9: Mai · Heti · Gym · Sport · Futás · Gyakorlatok · Medálok · Mesociklusok · Sablonok (+ full-screen: session, review, planner, builder, report, compare) |
| **Fuel** `/fuel` | 6: Mai · Terv · Stack · Receptek · Kamra · Gyógyszer (+ hidden: `/fuel/slots` meal-window template editor, only reachable from a settings sheet row) |
| **Én** `/me` | 9: Profil · Growth · Napló · Cél · Súly · Alvás · Emberek · Tudás · Értesítés (+ full-screen: AI-napló, goal wizard, routine editor, Éjszakai mód) |
| **(Insights)** `/insights` | 8, behind the ✨ icon: Minták · Heti · Memoár · Tudástár · **Chat** · Előrejelzések · Kísérletek · Memória |

**Scale: ~57 routed screens + 59 bottom sheets ≈ 115+ visible surfaces.**

**Global affordances:** FAB opens `QuickInputSheet` (a highlighted chat row → `/insights/chat`,
plus 8 tiles: Étkezés / Edzés / Víz / Súly / Stack navigate; Alvás / Napló / Check-in log in
place). A `FloatingReturnLayer` shows a lavender chat bubble on every route and a coral
resume-workout FAB while a session is open. `/ritual` (Napzárás), `/train/session` and
`/me/sleep/night` are full-screen, tab-bar-less.

**Key screens worth knowing (they work well, keep their spirit):**
- **Today:** iOS inset-grouped list; hero number per daypart (sleep / session start / live
  countdown to lights-out); "act-anywhere" (any daypart actionable retroactively); done items
  fold into `✓ N kész · +M XP`.
- **Fuel Mai:** `KeretHero` (46px remaining-kcal count-up, day-bar with gold now-marker, 5
  macro rings, water ring is a button) + a "window river" — one island per open eating window.
- **Train session:** 4 phases (prep with expected-XP + challenges → active set stepper with
  rest timer → summary with medals → close). Strong, mechanically complete.
- **Napzárás:** the 6-act evening ritual — the emotional peak of the app.
- **Chat:** streaming, tool chips appear live, voice input, memory-recall disclosure
  (`Emlékek · N`), honest mode subtitle.

## 5. Design system — "Napív", the Mezo edition of Exist Zen

Mature token system; the redesign should **evolve it, not rebrand it** (open question §12.6).

- **Surfaces (light default):** page `#FBF6EF` warm cream · card `#FFFFFF` · recess/elevated
  steps · dark mode "Pulse" = warm graphite (token-level override, components never branch) ·
  third mode "Cirkadián" (default): auto theme + a circadian sky band tinting the canvas by
  daypart.
- **Color roles:** primary **coral** ramp (`#FF6B4A` base — fills/icons only, never text;
  `#A84A26` deep = "the coral you write with"); one CTA gradient `#FF7A55→#FF5B36`; gold =
  reward; error terracotta. **Domain accents live in a data-viz band only** (never on buttons/
  surfaces): coral=Train, sage=Fuel, lavender=Me/Insights, rose=Sport, sky=Futás, amber=reward.
- **Type:** Geist (display + body), coach voice = 22px Geist Light (never italic), Fraunces
  italic = "meta voice" pull-quotes, body floor 16px, eyebrow 12/700/0.22em.
- **Scales:** spacing ÷4 (4–64), radii 6/10/14/18/22/28/full, motion 150/250/400ms + spring,
  all infinite animation reduced-motion-guarded.
- **Component vocabulary:** AppHero, TabBar+FAB, Sheet (bottom sheet, 59 of them), ItemCard /
  ItemRow, Island (capsule↔hero morph shell, now Fuel-only), KeretHero, ScoreRing, TrendChart,
  GhostState, CoachBubble, MezoChip, segmented controls, DayNavigator, chips/pills.

## 6. The drift — why it feels incoherent (verified, documented in ADRs)

1. **Four coexisting card/list languages:** Today's iOS list (`.td-*`) vs the shared
   `ItemRow`/`ItemCard` family (Fuel, Me) vs Fuel's Island/river vs Train's own card language.
   Unification is an open, tracked issue (`mezo-jaoy`).
2. **Three switcher idioms at once:** iOS segmented (Today) · bordered pills (Sport/Futás) ·
   `SubNavDropdown` popover — plus legacy inline-tinted segments.
3. **Today burned through 4 render layers in 5 weeks** (islands → tabs → iOS list), each ADR
   reacting to the previous day's feedback. The day model beneath survived — the visual
   language kept churning.
4. **Navigation never grew with the surface:** 115+ screens behind 4 tabs and hidden dropdowns.
   No visible menu, no "what should I look at now" thread above the tab level.

## 7. Discoverability — the hidden-gem problem (top of a 26-item list)

- The **entire Insights area** (patterns, weekly, memoir, knowledge, predictions, experiments,
  memory observatory — the product's differentiator!) hangs off one ✨ icon.
- **Chat** — the most-used surface after logging — is 2-3 taps deep (✨→Chat, FAB row, or the
  floating bubble).
- **AI-napló** (per-call LLM transparency) is behind the last card on Profil.
- **Goal engine** (feasibility, guards, prescriptions) recomputes silently — no screen of its own.
- **Éjszakai mód** calm tools (breathing pacer, body scan, mental walk) — almost never surfaced.
- Meso **report/compare** appear only for closed runs, two hops deep.
- Fuel **Gyógyszer** tab is a permanent empty state (populated medication UI exists, unreachable).
- Decision journal review loop, gratitude streak: `/me/naplo` only, no Today surface.

## 8. Daniel's real daily usage (his own words, condensed)

- **Morning: works.** Wakes → morning routine in the app guides him through.
- **Training: mechanically fine, emotionally empty.** Starts the session, logs through. But
  around the workout the companion is absent: no "how is my mesocycle standing", no "what to
  focus on today", no post-workout narrative. *"Amikor jönnének pont a társ feelingből, az
  kimarad itt."*
- **Midday: dead.** Logs meals when eating, check-ins on notification — otherwise doesn't open
  the app, because *"a Mai tabon nincs semmi, amit nézni kéne."*
- **Journal:** writes when he remembers — deliberately, to feed the AI memory.
- **Chat: the most-used feature.** Talks to the AI a lot — what to eat, how he feels, how to
  prep for training. (Yet it's the most buried major surface.)
- **Insights:** browses out of curiosity, **often forgets it exists**.
- **Sport:** set-and-forget; fine as is.
- **Evening: works.** Evening routine + Napzárás.

## 9. Diagnosis (agreed in the brainstorm)

**The product is rhythm-based; the UI is domain-based.** The promise is a daily arc (morning →
day → evening → close) with a companion walking alongside — but only the Ma tab expresses it.
Edzés / Fuel / Én / Insights are domain databases: fine when you know what you're looking for,
but nothing leads through them, nothing surfaces the right thing at the right moment. That's
why there is no attention guidance, why features stay invisible, and why midday is empty. The
visual fragmentation (4 card languages) amplifies the feeling, but the root is structural.

## 10. Decision so far + the design task

**Decided: full IA redesign** ("IA-újratervezés") — reorganize navigation and screen hierarchy
around the daily rhythm; visual unification is part of it, not the driver. The 4-tab shell is
NOT sacred.

**Decided in the mockup rounds (2026-08-26, Claude Code artifacts):**

- **Spine = Hybrid.** A day-rhythm "Nap" spine tab + Edzés and Fuel as workshop tabs + **Mezo
  (chat) as a first-class tab**. Rule: spine = "doing now", tabs = "plan/manage". The spine
  itself uses feed mechanics (chronological, now-anchored cards). Rejected: pure time-spine,
  chat-as-home (strong runner-up), pure feed.
- **Visual language = "Mozaik 2.0".** Huawei-Health-inspired tile mosaic: data drawn as
  graphics (rings, gauges, hypnogram, sparkline), poster-anatomy cards (one visual anchor +
  one big 40–60px numeral + eyebrow label), domain-color washes on tiles — a conscious
  relaxation of the "domain colors only in the data-viz band" rule.
- **Depth.** Two-layer shadows (large soft + contact) + inner top light edge; focus cards cast
  *colored* shadows (MOST card coral, insight card lavender); subtle ground gradient.
- **Motion.** One-shot entrance choreography (staggered card rise 60–80 ms, ring sweep, kcal
  count-up, day-bar fill), then calm — only the MOST dot and the FAB keep breathing; springy
  press states; everything reduced-motion-guarded.
- **Brand: logo = the Orb.** The companion as a warm gradient sphere *character* with states
  (awake, night, listening, celebrating); it is the app icon, chat avatar and coach marker in
  one. Wordmark: lowercase "mezo" in Geist. Rejected: Ívjel, M-horizont.
- **Graphics = clay 3D SVG.** Recipe: radial gradient (light from top-left) + specular
  highlight + ground shadow + reflected glow. A full **clay icon set replaces emojis**
  (12 pieces drafted); in the tab bar active = colored clay, inactive = muted. Mini-clay
  rules: silhouette-first, one gradient + one highlight, ground shadow only ≥32 px, light
  always from top-left. Stroke icons were rejected as too dry.
- Mockup artifacts (claude.ai/code/artifact/…): Négy gerinc `9d423d6a-d792-458b-951f-41dc019c6514`,
  Hibrid nyelvpróbák `bd54c3ae-19fc-4da1-89f7-3e20cd556a8e`, Mozaik 2.0
  `dd9ed4ee-7d2f-4ef6-baad-de086b68f128`, Grafikai műhely `9a376291-ae47-4e86-afe7-2a1faabcc6df`.

Of the §12 open questions, #1, #2 and #6 are answered by the above; #3 (how Insights
dissolves), #4 (companion thread placement) and #5 (the exact "now card" content) remain for
the screen-level design phase.

**Screen prototype package (2026-08-26, rounds 5+ — built in Claude Code):**

Interactive, self-contained prototypes live in `docs/design_2.0/prototypes/` (assembled HTML +
`src/` parts + `build.sh`, which inlines the clay sprites from `docs/design_2.0/assets/`).
Published artifacts — updatable from ANY session by republishing with the matching `url`:

- Clay csomag (asset catalog): https://claude.ai/code/artifact/79f7676e-7998-4a61-b098-44c2e0f8b905
- Nap-gerinc: https://claude.ai/code/artifact/e1eae7d4-05bc-41c9-8e7e-55bdbee70249
- Edzés tab: https://claude.ai/code/artifact/d9fd807c-71ca-4c27-b8c9-7d32aca48d15
- Mezociklus: https://claude.ai/code/artifact/a4f4ecdd-decc-4524-9fab-931af7a9c8b3
- Edzés-session: https://claude.ai/code/artifact/0a747fcc-0359-462a-8b8b-1de02a611f77

Locked patterns from the screen rounds (canonical for every further page):

- **One long tile per panel — the hero.** Everything else lives in the 2-column mosaic.
- **Tile anatomy: eyebrow + spot graphic + one datum.** Details belong to the page, not the tile.
- **Tile → own full page (Huawei pattern):** slides in from the right, colored hero zone
  (spot + big numeral + name), "‹ back" chip, content as cards, quiet principle line at the
  bottom. No blur overlays — those were tried and rejected.
- **Header recipe:** date eyebrow · daypart switch (Nap tab only — small round button next to
  the avatar, gold dot when not viewing "now") · clay bell with badge + dropdown panel · orb
  avatar with XP ring.
- **Mezo messages tile** uses the envelope icon (`i-level`) with an unread badge; the companion
  page hero is the breathing orb. **Quests/check-in tiles**: status circles + XP only.
  **Életjel tile**: one segmented ring (six colored arcs forming the circle); its page = six
  need tiles with clay icons + mini ring + %. Habit tile: next item name + tick + x/y.
- **Edzés IA:** the 9 sub-tabs dissolved → hero (today's session WITH the coach line) + 6 tiles
  (Heti, Mesociklus, Sport, Futás, Gyakorlatok, Medálok). Sablonok folded into the Mesociklus
  page; the Gym muscle-zone view folds into Heti. Session/planner stay full-screen flows.
- **Gyakorlatok page fully specified** in the edzes-tab prototype (2026-08-27, feature-audited
  against the real `/train/exercises` — `ExercisesPage.tsx` + its three sheets; see
  `prototypes/README.md` for the detailed list). Key load-bearing behaviors carried over:
  the **dual-mode list** (default = ranked PR list, search/filter = records-then-ghosts over
  the full catalog), the two-level muscle filter (region → sub-muscle, Plyo as the lone type
  chip), ghost rows that are **not buttons** and carry the 5-tick Stim meter, the two-branch
  stat strip (weighted vs bodyweight — `weightKg > 0` rule), roundels gated on
  `editable`/`catalogId` (⋯ only on Saját, ▶ everywhere), `—` for null stats, sections that
  vanish instead of rendering empty, reduced-motion demo stills → manual ⇄ toggle, IG videos
  in 9:16, and the two-tap in-sheet delete.
- **Sport page fully specified** in the edzes-tab prototype (2026-08-27, feature-audited
  against the real `/train/sport` — `SportPage.tsx` + its three sheets; see
  `prototypes/README.md` for the detailed list). Load-bearing behaviors carried over: the
  3-segment structure (Heti terv | Napló | Cross-load) with the selected segment in primary
  coral (rose stays on data/tags/rails only — ADR 0018 D5); multi-slot days; the one-off
  `EGYSZERI` layer as a second model (own sheet, per-row delete, current-week merge into the
  weekday, excluded from weekly hours); volleyball-only conditionals (edzés/meccs toggle,
  setek vs körök, váll-skála, Mezo observation card); the live observation card's pre-save
  coaching; planned-vs-logged as a hard distinction; RPE grading 7+ coral / 8+ amber, never
  red; minibars/chips only when the value exists. Designed additions flagged for
  implementation: notes input in the log sheet (contract field exists, UI missing) and the
  Napló 4-week idő+RPE trend (needs a `from`/`to` on `GET /api/train/sport-sessions`).
- **Futás page fully specified** in the edzes-tab prototype (2026-08-27, feature-audited
  against the real `/train/futas` + the `/train/futas/:id` builder; see
  `prototypes/README.md` for the detailed list). Load-bearing behaviors carried over:
  3 segments with `＋ Új terv` only on Tervek; create-then-navigate (running has no `/new`
  route); the builder's auto-save contract (no Save button, `Mentés… → ✓ Mentve` pill,
  flush-on-back) and its **plan-level vs week-level split** (Menetrend applies to every
  week, Terhelés to one week); week cap 1–8; single-active invariant on Aktiválás;
  three-way session CTA (planned/missed/today) with done-state on the
  blockId+week+sessionKey triple; interval runs report no duration/hours anywhere;
  conditional log chips (nothing shown that wasn't measured); RPE-target hue = terracotta
  only for sprint min≥9. Designed additions flagged for implementation: rounds capture for
  pyramid sessions too (today a logged pyramid earns ~0 XP because `completedRounds` is
  sprint-only in the sheet while the scorer treats pyramid as sprint), and the Napló
  HR-recovery trend card (data exists in `hrRecoverySec`, no UI today).
- **Fuel hub specified** in the new fuel-tab prototype (2026-08-27, feature-audited against
  all real `/fuel` routes; see `prototypes/README.md`, and the **full audit** in
  [`2026-08-27-fuel-feature-audit.md`](2026-08-27-fuel-feature-audit.md) — the per-subpage
  deep rounds must consult it). Hub absorbs the old Mai page: keret-hero
  (honest negative remaining-kcal, proportional done-window day-bar + gold now-marker, energy
  chips that vanish on static energy, 5 rings with the water ring as a button), the
  **window swimlane** (Daniel's direction, replacing the earlier MOST-card + done-capsule
  pair): one tile per user-scheduled eating window in a horizontal lane with clay meal icons
  — done tiles show the meal name + kcal · g P + AI-score chip (unscored ✨ folyamatban), the
  now tile is coral-ringed with a Logold CTA, missed tiles are dashed amber "még pótolható"
  Pótold, future tiles carry the plan suggestion; the lane auto-scrolls to MOST and ends with
  the out-of-window log tile (＋ Logolás / ✨ AI); AI-average from scored meals only in the
  lane header — then 6 tiles → Terv /
  Stack / Receptek / Kamra / Gyógyszer / Napló. Load-bearing behaviors carried: log sheet slot
  defaults to the launching window's slotKey (the mezo-bnsf bug class), derived-until-touched
  meal name, manual-ml-overrides-chip in the water sheet, zone anchor notes + pin/auto badge
  precedence, NOVA hue never red (4 = terracotta), empty Terv sections stay hidden (real mode
  ships them empty — mock over-designs them). Designed additions flagged for implementation:
  **Napló trend page** (weekly API already returns 7-day series, FE collapses it to 3 scalars),
  **Snack segment** on Receptek, **Gyógyszer segment** on Kamra, Terv rhythm-grid markers
  derived from settings instead of the hardcoded 21:00/14:00, and a future add-medication path
  (today none exists). Deeper rounds still to design per subpage: full LogMealSheet (overrides,
  MealPicker), AiLogSheet 3 fázis, MealScoreSheet/ScoreBreakdown, recipe detail/editor, Kamra
  detail + Import (OFF/link/fotó), StackItem/StackPicker sheets, FuelSlots editor + Tier-1/2
  validation, EnergyBreakdownSheet. New sprite icons: `i-injekcio` + the meal set
  `i-reggeli` / `i-ebed` / `i-snack` / `i-vacsora`.
- **Mezociklus fully specified** in its prototype: hub (hero + Volumen/Történet/Sablonok/Új
  blokk tiles), MEV/MAV/MRV provenance bars with expandable 01→02→03 derivation, 5-step wizard
  (tappable phase curve + Mezo reset, Emphasize cap 2 with disabled-not-hidden buttons, program
  editor with day breakdown + session-cap 11 + StructureLint + PeakFit, searchable multi-add
  picker, ▲▼ reorder), start/close sheets (close → report, mirroring the real transaction),
  frozen report ("Heti szettek · a blokk íve" naming), Történet selection mode → A/B compare.
- **Advisory signals are never red and never block; nulls are never zeros** — carried through
  every screen.
- **Edzés-session fully specified** in its prototype (feature-audited against
  `ActiveWorkoutPage.tsx` — see `prototypes/README.md` for the current, detailed list):
  prep = hero (4 mini stat cells + CTA above the fold) + 6-tile mosaic (Gyakorlatok, Fejlődés,
  Heti zóna, Küldetések, Bemelegítés, Niggle), each tile → own page with compact hero
  (title above icon+number row) + stat strip + animated bars/rings; Gyakorlatok page uses
  tile-styled exercise cards (labeled columns, mini set dots, 1RM medal, múlt-hét → progression
  footer). Live logging = calm default: only the execution card expanded; Progresszió and
  Szettek are collapsible strips with informative headers; warmup B-labels with no RIR, rest
  bar with pause/skip, medal toast, 5-way navigation, ⋯ actions incl. reorder-with-handover
  and the "Csak ma / Minden hétre" extra-set prompt, set table edit/delete + one-slot floor;
  RP debrief, summary + level-up. New icons for it: `i-video`, `i-idozito`, `i-kihivas`.
  Honesty gates deliberately preserved (no fabricated numbers, misses never red, inert
  `Passz`/`Tudatosítsuk később` kept inert).
- **Interaction patterns locked in the session rounds (apply everywhere):** subpage hero =
  title, then icon + big number in one row, no subtitle; reference content lives in thin
  collapsible strips whose closed header already carries the summary; inputs live in ONE
  clearly bounded panel ("a kártyán logolsz, a sávokban utánanézel"); labeled mini-columns
  beat chip piles; a datum shown by a visual (set dots) is not repeated as text; the same
  fact never appears twice on one screen.

**How a fresh session continues:** read this file + `docs/design_2.0/prototypes/README.md` +
`docs/design_2.0/assets/README.md`; edit `prototypes/src/`, run `build.sh`, republish with the
Artifact tool passing the artifact `url` above. Remaining pages to design: Fuel subpage deep
rounds (Terv, Stack, Receptek, Kamra, Gyógyszer, Napló + their sheets — the hub is done), Mezo
(chat) tab, Napzárás, Me/profil surfaces, and the Edzés review page (the live session flow is
done — see Edzés-session above). New icons/spots always go back into `docs/design_2.0/assets/`
sprites first.

**The task for this Claude Design session:** propose **2-3 distinct IA/navigation directions**
as mobile mockups (iPhone, ~390×844), then iterate with Daniel toward one. Each direction must
answer:

1. **The spine:** what replaces or reworks the 4-tab + FAB shell? Where does the daily arc live?
2. **Chat placement:** the most-used feature — does it become a first-class tab / persistent
   surface / merged with Today?
3. **Midday value:** what makes opening the app worth it between meals? (Fuel windows, needs
   rings, midday nudge, next-session prep already exist as ingredients.)
4. **Companion moments around training:** pre-workout "mire figyelj ma" and post-workout
   meso-status / narrative — where do they surface?
5. **Insights dissolved into the flow:** patterns/memoir/predictions reaching the user in the
   daily arc (feed? digest? contextual cards?) instead of a forgotten silo.
6. **The shelf:** where do the ~30 setup/rare sub-pages live (Kamra, Receptek, Sablonok,
   Gyakorlatok, Emberek, Értesítés…) so they're findable without polluting the spine?
7. **One list/card language** that Today, Fuel, Train and Me can all speak.

## 11. Constraints & non-negotiables

- Hungarian UI, labels verbatim; 44pt touch targets; body text ≥16px.
- The axioms and guardrails of §2 override aesthetics (no red, honest states, XP-as-feedback,
  companion voice, no engagement dark patterns).
- Single user; no social, no sharing, no onboarding funnel needed.
- Backend domains are fixed; screens can be recomposed freely, data model doesn't move.
- The Napív token system (colors, type, spacing, dark/circadian modes) is mature — evolve it;
  a full rebrand needs explicit justification.
- Napzárás ritual, Train session flow and KeretHero are loved, working surfaces — recompose
  their placement, keep their essence.

## 12. Open questions the design should resolve

1. Tab count and naming: time-spine ("Most / Nap / …") vs hybrid (spine + 2 domain shelves)?
2. Does Chat deserve the center-stage position (FAB? tab? swipe-up?), and what happens to
   Gyors logolás if it does?
3. Does Insights survive as a place at all, or fully dissolve into feed/digest moments?
4. Where does the companion's proactive thread live when it spans the whole day (currently
   MezoChip on Today)?
5. What is the "now card" — the single answer to "mi most a dolgom" — and is it the app's
   opening surface?
6. How far may the visual language move from current Napív? (Daniel is open to direction
   proposals here — token architecture stays.)

## 13. Glossary (Hungarian UI terms, use verbatim)

Ma = Today tab · Edzés = Train · Én = Me · Gyors logolás = quick log (FAB) · Napzárás = the
evening closing ritual · Életjel = the six need-rings · kreed/fókusz = daily intention creed +
foci · Kamra = pantry · Keret = daily kcal budget · Stack = supplement protocol · Terv = plan ·
Receptek = recipes · Gyógyszer = medication · Mai = "today's" sub-page · Heti = weekly ·
Gyakorlatok = exercise catalog · Medálok = medals · Mesociklusok/Sablonok = mesocycles/templates
· Futás = running · Súly = weight · Alvás = sleep · Emberek = people · Tudás/Tudástár =
knowledge · Minták = patterns · Memoár = memoir · Előrejelzések = predictions · Kísérletek =
experiments · Memória = memory observatory · Éjszakai mód = night mode · Pótold = "make it up"
(retro-log) · tanulom = "still learning" (honest unknown-confidence state).

---

*Handoff written by Claude Code on 2026-08-26. Source docs: `docs/CODEMAP.md`,
`docs/features/*`, `docs/decisions/*` (esp. ADR 0010/0014/0018/0022–0026), `docs/milestones/
roadmap.md`, `docs/old docs/mezo-prd.md`, plus Daniel's usage interview in the session.
Driving bd issue: `mezo-88jw`. When a direction is chosen in Claude Design, bring the result
back to Claude Code to turn it into a spec (`docs/superpowers/specs/`) and implementation plan.*
