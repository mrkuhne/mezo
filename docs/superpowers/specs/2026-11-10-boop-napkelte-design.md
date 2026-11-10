# Boop — the "Napkelte" look (dark glass, painted sky, the rising orb) — design

- **Date:** 2026-11-10 · **Epic:** `mezo-r36n9` · **Issue:** `mezo-r36n9.3` · **Status:** draft for owner OK — the orb-as-lens Mai (§5.1a) and day path (§5.1b) and the per-orb pages, path, ground, icon-only bar and Forma (§5.1a–b) approved in the simulator 2026-11-10
- **Replaces:** the **Lágy** look for Boop (spec `2026-11-09-boop-ios-v1-design.md` §0 and §4.2 visuals). Everything in
  that spec that is *not* about looks — data, backend, install, slices, the six moments, owner decisions in its §8 —
  stays valid.
- **Approved look, executable:** the throwaway SwiftUI spike in
  [`docs/design_2.0/prototypes/boop-ios-spike/`](../../design_2.0/prototypes/boop-ios-spike/README.md), files
  `Aura*.swift` (launch argument `-aura YES -auraVariant 3`, see §8). Screenshots of every approved state sit next to
  it as `aura-*.png`.
- Marks: *owner* = decided by the owner in this brainstorm; *call* = designer's call, open to correction.

## 1. Intent — why this exists

The owner found the Lágy look (light paper, white cards, photo head) "not mobile-friendly". He brought screenshots of
**Oura** (dark, clean, full-screen photos, white type, very few colours that glow with a gradient aura, a page-level
hue, premium feel) and **Ultrahuman** (a marbled liquid orb with one word in it, three big scores with trend
triangles, mono labels). The goal is **one unique look** that mixes those qualities with what is ours — Boop the
companion, the orb as Boop's face, the spoken verdict, the five domains — **without copying Oura** (*owner*: the first
dark variant "is a one-to-one Oura copy, we can't do that").

Success: the owner opens Boop in the morning and it feels premium, calm and clearly *Boop*; one glance says how the
day looks; tapping a number re-colours the world around it.

## 2. Goals, non-goals, anti-goals

**Goals**
- A dark, glass, white-type visual language for the whole Boop app, defined on the **Nap** domain (Mai + its three
  sibling tabs + the morning steps + the detail sheets) so later domains can follow it.
- The orb becomes the hero of the morning ("the sun of the morning").
- A metric tap re-colours the page (the "C" idea the owner liked), quietly.

**Non-goals (this design)**
- Edzés, Fuel, Boop (üzenőfal) and Én domains — they get their own spike rounds later, in this language.
- Data, backend, AI-brief changes. This is a re-skin + new interactions on the same data.
- A light mode.

**Anti-goals (would be a failure even if it works)**
- Looks like Oura (arc gauge + number over a mountain photo, outlined score rings) — *owner*.
- Colour everywhere: the owner wants colour **only** in the backdrop and the orbs; everything else glass + white — *owner*.
- Busy chrome: rings around selected items, scale lines, hairlines under tabs, many equal-weight buttons — *owner*
  (each was removed on request).

## 3. Constraints

- Native SwiftUI, iOS 26 SDK (Liquid Glass `glassEffect` available), the existing `ios/` app and `BoopDesign` kit.
- The orb is the existing Metal shader (`Orb.metal`, `LivingOrb`); it needs **four** colours per palette (a three-colour
  palette crashes the shader index — found in the spike).
- Hungarian copy; the companion is **Boop**; the morning data and endpoints of the v1 spec.
- Another session (`mezo-r36n9.2`, S2) currently owns `ios/Boop/Onboarding/OnboardingFlow.swift`,
  `ios/Boop/Shell/NapEmptyView.swift`, `ios/Boop/BoopApp.swift`, `ios/Boop/Connect/**` and `ios/Boop.xcodeproj/**`.
  Re-skinning those files waits for S2 to land.

## 4. The look — decided parts

### 4.1 Ground, colour and type
- **Ground:** near-black blue `#0D1218` everywhere below the backdrop; status bar light. *owner* (dark, white type).
- **Colour lives only in two places** — *owner*:
  1. the **painted backdrop** at the top of every page, and
  2. the **orbs** (the hero orb and the selected mini orb).
  Everything else is white on glass: cards, buttons, charts, bars, tab bar, icons.
- **Five hues**, one per metric, each a sky triple (top, middle, horizon) and an orb quadruple (from the spike's
  `PaintedLandscape.skies` and `SunMetric.all[].orb`):
  Forma (formerly Készenlét) violet-dawn · Alvás deep blue · Mozgás orange sunrise · Fuel teal-green · Pulzus rose dusk.
  Inner pages pick a hue by meaning (szándék violet, mérlegelés green, étkezés orange, A napom orange, Beszélgetés
  violet, Rutin green). *call* for the per-page picks.
- **Type** — *owner* ("the A font is very good"):
  - display / headlines / Boop's voice: **serif** (system New York) — e.g. "Jó napod lesz" 42 pt, inner titles 38–40 pt,
    Boop's brief 18–19 pt;
  - numbers: **Outfit Light** (big values 58–84 pt, card values 26–36 pt);
  - labels/eyebrows: **monospaced caps** with tracking (12 pt, "BOOP MONDJA", "A NAP ENERGIÁJA");
  - body: system sans 15–17 pt.
  Manrope is no longer used in this look. *call*.

### 4.2 The painted backdrop — *owner* picked it out of three options (vivid photo / photo per metric / painted)
A generated landscape, not a photo: a vivid vertical sky gradient in the hue, a soft glow band at the horizon, and four
layered ridges with aerial perspective (far ridges melt into the sky, near ones are deep and dark, haze between them).
It is always vivid, always legible, unique to Boop, and re-colours as one piece. Reference: `PaintedLandscape` in the
spike. The Mai hero uses it at full screen height; inner pages and sheets use a 330–360 pt head (sheets 170 pt) that
fades into the ground.

### 4.3 Glass
Cards: white at 7 % fill, 26 pt continuous radius, a 1 pt top-light stroke (white 16 % → 3 %); **no coloured glows on
cards** (*owner*: removed). Floating controls (back button, avatar, bottom bar, pills on photos) use system Liquid Glass.
Primary action = solid **white pill** with dark text; secondary = white 10 % pill.

### 4.4 Icons
The Lágy glyph artwork relies on white inner detail; tinted white on dark it **flattens into blobs** (check, clock,
camera, book did). The spike draws those as thin outlines. **This look needs a thin-outline white glyph family** before
it ships; until then the builder may draw the few missing ones as outlines in the 64-unit grid. *owner* agreed the icon
family is a separate, later round.

## 5. The screens — decided parts (all *owner*-approved in the simulator)

### 5.1 Nap · Mai (the morning)
Top to bottom, the hero fills the first screen:
1. **Title row:** bell (left), "boop" wordmark Outfit Light with wide tracking (centre), avatar in a glass circle (right).
2. **Nap tabs** as thin text tabs: *Mai · A napom · Beszélgetés · Rutin*; selected = white semibold with a **1 pt**
   underline; others white 62 %; a small dot on "A napom" in the morning; **no hairline under the row** (*owner*).
3. **Metric row:** five **mini orbs** in five equal columns, edge to edge (*owner*: even spacing), 46 pt, value in the
   orb, name under it — **Forma**, Alvás, Mozgás, Fuel, Pulzus (*owner* 2026-11-10: "Készenlét" is renamed **Forma**). **Only the selected one is in full colour and alive**;
   the others are ~25 % saturation and **frozen** (a still frame of the shader). **No ring** on any of them (*owner*).
4. **The rising orb:** the selected metric's orb, ~156 pt, liquid filled to the value, the number inside (Outfit Light
   ~58 pt). Its height over the horizon encodes the value: good values stand high, a weak value **sinks behind the
   ridges** (clipped at the horizon). No scale line, no 0/100 labels (*owner*). Soft glow behind it in the hue.
5. **Verdict block:** metric name in spaced caps, a serif headline ("Jó napod lesz", "Kipihented magad", "Van még benne
   több", "Jó úton jársz", "Nyugodt szív") and one or two sentences.
6. **Tap a mini orb → the whole page re-colours** (*owner*): backdrop hue, hero orb (refills and re-rises), headline,
   sentence, the hero action and the cards below (§5.1a); a spring animation (~0.7 s).
7. Floating glass **bottom bar**: Nap · Edzés · Fuel · Boop · Én as **icons only, no labels** (*owner*); the names stay as
   accessibility labels.

### 5.1a The orb is a lens — the selected metric decides the action and the cards (*owner*, 2026-11-10)

**Hero action row** (under the verdict): one **white primary pill** (system Liquid Glass tinted white, interactive) with
a glyph and a label, plus a **glass circle with Boop's tiny orb** = *Boop elmondja* (plays the spoken brief). On a
metric switch the pill **melts into the next one** (`GlassEffectContainer` + shared `glassEffectID`, label
interpolates) instead of being swapped.

| Metric | Primary pill | Extra in the hero | Below the hero: tiles · short path (only this orb's own stations, §5.1b) |
|---|---|---|---|
| **Forma** (violet; renamed from Készenlét, *owner*) | **Kitöltöm** → check-in (while the check-in is not done; afterwards the pill becomes *Boop elmondja* and the circle hides — *call*) | — | no tiles · MOST → Reggeli check-in (card, *Kitöltöm*) → Mai szándék (card, creed + *Megírom*) → Boop észrevette (swipe stack) → **all of the day's later check-ins** as one-line stations: 12:30 Déli, 16:00 Délutáni, 21:30 Esti (napzárás) — each opens into a card when it is due (*owner*) · then the Boop mondja card |
| **Alvás** (blue) | **Lefekvés 22:45 · Emlékeztess** → sets a bedtime reminder; becomes *Emlékeztetlek 22:15-kor* (in the evening the pill turns into *Esti levezetés* — *call*) | — | tiles: Alvásidő (night arc with a moon) · Mélyalvás (still blue orb) · Elalvás (a short descent line) · path: Elalvás 22:48 → Az éjszaka (hypnogram card) → Ébredés 06:53 → MOST → Lefekvés 22:45 (wind-down card) |
| **Mozgás** (orange) | **Edzés indítása** → starts today's session; **long press = context menu**: *Mai edzés · Felsőtest*, *Futás*, *Séta* | — | tiles: Lépések (winding trail) · Aktív kalória (a filling bar) · path: MOST → Mélyponti séta (card) → Felsőtest edzés (exercise photo strip + *Áttolom 18:30-ra*) |
| **Fuel** (green) | **Lefotózom** → first-meal capture | **Quick-log glass chips** under the pills: *Szokásos reggeli · Kávé · Víz +250 ml* — one tap logs, a glass toast "… · hozzáadva" slides from the top, success haptic | tiles (*owner*): **Víz** (the waving glass; tap = +250 ml, a drop falls in) · **Kalória** (still green orb, "820 / 2 350 kcal") · **Makrók** (three filling bars: protein · carbs · fat) · path: meals only — Reggeli (photo + macro bar) → MOST → Ebéd (Boop's suggestion, camera button) → Vacsora |
| **Pulzus** (rose) | **Légzés · 1 perc** → **the hero orb breathes**: scales up over 4 s, down over 4 s, headline "Belégzés" / "Kilégzés", one line "Kövesd a gömböt…", a soft haptic at each turn; pill becomes **Kész**; ends by itself after 60 s with a toast | — | tiles: Nyugalmi pulzus (7-day mini line) · Feszültség (still violet orb, from the check-in) · path: MOST → Egy perc légzés 13:55 (card) → Sűrű megbeszélés-sáv 14:00–16:00 (busy ribbon card) |

**Only what belongs to the orb** (*owner*, 2026-11-10: "egy gömb oldalán túl sok mindent mutatunk"): under the hero
each orb shows its 2–3 tiles and a **short path of its own stations** (table above) — about one screen of scrolling.
The whole day's path lives on the **A napom** tab (§5.2). The Boop mondja card closes the Forma page only.

**Boop mondja** card: tiny orb + "BOOP MONDJA", the longer brief in serif; key phrases white semibold with a **dotted
underline**, tappable → detail sheet (§5.4); the word-by-word typing synced to the voice runs here when *Boop elmondja*
is pressed.

**Boop észrevette stack** (*owner* liked the notification-style idea): up to three observation cards stacked
(back cards scaled 5 % per step and offset 10 pt); drag the top card — **right = Igaz**, **left = Nem rólam szól** —
a label fades in with the drag, past 110 pt it flies off with a soft haptic and the next one rises; "<n> új" counter;
an empty state "Köszönöm, ezekből tanulok."; hint line "Jobbra: igaz · balra: nem rólam szól". *Majd meglátjuk* is
no longer a button (leaving the card in the stack is "majd meglátjuk") — *call*.

The cards slide in on a switch (opacity + 28 pt rise); the check-in, szándék, mérlegelés and étkezés steps open as
full-screen covers, the sheets as sheets (§5.3, §5.4).

Interactions that are real behaviour, not only looks (for the plan): the bedtime reminder (a local notification),
quick food logging (posts a meal from a template), starting a workout / run / walk (opens the Edzés flow — the Live
Activity on the lock screen is a later slice), the observation verdicts (existing observation feedback endpoints).

Every Boop line referred to here — the five metric verdicts, tonight's tip, the next-meal suggestion — comes from the S3
morning brief (§9 point 1).

### 5.1b Below the hero: tiles, the path, and a ground that never goes black (*owner*, 2026-11-10)

Plain stacked cards read flat to the owner; after a look at award-winning apps (Gentler Streak's Activity Path,
Flighty's timeline, Apple Weather's modules, (Not Boring) Habits' tactile checkbox) the area below the hero became
**tiles with their own drawings + a glowing path**, and then was cut down to **only the orb's own content**.

**Tiles** — equal glass tiles in one row (22 pt radius): mono label, a **drawn mini graphic**, value + sub-line. The
drawings per orb are in the table in §5.1a. The Víz tile is tactile: tap = +250 ml, a drop falls into the waving glass,
the level springs up, soft haptic.

**The path** — rows: time (mono, right-aligned) · the line with a node · title + one line. Rules:
- The line is continuous; the part **up to now is lit** (2 pt white with a soft glow in the page hue), the rest is
  white 16 %.
- Past stations: solid white node with a dark check, dimmed text. Future stations: dark node with a thin ring and the
  station glyph. Stations that carry content (table) open a **glass card hanging off the line** and get a brighter
  ring + hue glow; one-line stations stay quiet.
- A **MOST** row sits at the current time: a white dot with a breathing halo in the page hue.
- Scroll: rows ease in with a slight 3D tilt, fade and scale (scroll transitions); content swaps with a spring when the
  orb changes.

**The ground never goes black** (*owner*: "görgetés után teljesen eltűnik minden szín … full fekete") — three layers:
1. **Derengés:** below the backdrop the page keeps the **deepest shade of the orb's hue** (violet-night, blue-night,
   amber-night…) as a soft vertical gradient all the way down; it re-colours with the orb.
2. **Úszó fények:** two or three very large, very soft lights in the hue behind the cards that move **slower than the
   scroll** (parallax), so scrolling passes through them.
3. **Tükröződő táj:** at the very bottom the painted landscape returns **mirrored and faint** (~28 %), like a lake
   closing the page (*owner*: "finoman").

**Compact header** — once the hero scrolls away, a glass capsule slides in at the top: live mini orb · metric name ·
value · headline ("Forma 78 · Jó napod lesz").

### 5.2 The other Nap tabs
Same skeleton: title row + tabs over a **shorter painted head** (330 pt) with a serif page title and one line, glass
cards below.
- **A napom** — **the whole day's path** (same path component as §5.1b, every station as a quiet one-line row: wake-up,
  weigh-in, meals, check-ins, the calendar block as one "Megbeszélések · <n> esemény" station, energy dip, training,
  bedtime), lit up to MOST. The head fades into the page hue without an edge.
- **Beszélgetés** — chat with Boop: Boop's bubbles left with the small orb as avatar (white 7 %), the user's right
  (white 16 %), a glass input pill "Írj a Boopnak…".
- **Rutin** — the morning chain as linked circles (done = solid white with dark glyph, pending = glass) with labels; a
  "Szokások ereje · 28 nap" card with white strength bars.

### 5.3 The morning steps (inner pages)
Common frame: painted head (360 pt) in the step's hue, glass back button + crumb ("Nap · Mérlegelés"), mono eyebrow,
serif title, one line; glass cards; **Boop speaks last** (small orb + "BOOP" + serif sentence); a white pill closes.
- **Check-in** — the signature screen, **full-screen sky**:
  - progress as a row of dots (current = a short bar), back button, "Most csak ennyi" link;
  - the question in serif, mono caps label above, an optional "why" line for "A nap kérdése";
  - **each question has its own hue** and the sky re-colours as you go (Energia orange, Hangulat rose, Feszültség
    violet, Test green, Fejtisztaság blue, A nap kérdése green);
  - **the orb is the answer:** drag up/down on it, the liquid follows 0–10, the number inside; a **soft haptic tick per
    step** (*owner*); "Húzd fel vagy le" hint; the orb sits **centred** between the question and the buttons (*owner*);
  - **no 2-4-6-8-10 quick buttons** (*owner*: removed);
  - bottom: Vissza / Kihagyom / Tovább (white).
  - Summary page: each answer as a small still orb filled to its value (grey if skipped), "Gondolatok" text field,
    Boop's sentence, "Mentem".
- **Mai szándék** — creed in a glass card (serif), three numbered focus fields, "Mit szól hozzá a Boop?" → Boop's
  verdict card + small white fit tags ("belefér", "segíti a célod") on the foci, then "Mentem".
- **Mérlegelés** — big value + a horizontal **ruler you drag** (centre needle, haptic per 0.1 kg); after saving: a
  12-day trend line with a dashed goal line ("cél 79 kiló"), three stat tiles (ma / trend / heti), Boop's sentence.
- **Első étkezés** — capture card ("Lefotózom" + text pill) → photo with a **scan line** and a glass status pill
  (Felismerem… → Elemzem… → Kész · 86% biztos) → draft (kcal total, white stacked macro bar, ingredient rows with photo
  thumbnails and ± 10 g) → verdict (an orb filled to the day's kcal with the number inside, white nutrient bars, score
  and suggestion tags, Boop's sentence, "Mentem").

### 5.4 Detail sheets (behind Boop's tappable phrases)
Sheet on the dark ground, medium + large detents, 34 pt corners, drag indicator; a 170 pt painted band in the hue with
mono eyebrow + serif title; glass cards; Boop's sentence last.
- **Alvás** (blue): tiles *Mély* / *Elalvás* with trend triangles; the hypnogram **with a legend** (colour bar as long as
  the share · stage name · time · percent — *owner* asked for it); 7-day deep-sleep bars with a dashed average line,
  today lit.
- **Nyugalmi pulzus** (rose): tiles *Heti átlag* / *HRV*; 7-day bars with average; the night's pulse line.
- **A napod** (orange): energy curve + the **busy ribbon** (15-minute slots, brighter = busier, training marked in
  amber) + "<n> esemény · Google Naptár"; a conflict card with *Áttolom 18:30-ra* (white) / *Marad így*.

### 5.5 Small rules that came out of the rounds
- Trend triangles (green up / rose down, gradient-filled) are the only "status colours" outside orbs and skies. *call*.
- Data colours inside charts are allowed where they encode categories the user must tell apart (sleep stages, blue
  scale). *call*.
- Motion: entrance and hue switches are springs; the orb's own slosh/tilt/tap/voice-surge from v1 stays;
  reduced-motion lands on end states (no rise animation, no typing, still orbs). *call*, carried from v1.

## 6. What changes in the shipped app (S1) and the plan
- `BoopDesign` gets the new tokens and kit: ground, glass card/pill modifiers, painted landscape, mini/still orb, the
  rising-orb hero, mono label, serif/Outfit type ramp, page frame (painted head + back + crumb), sheet frame, trend
  triangle, hypnogram, glow line, week bars, busy ribbon. Lágy kit pieces stay until their screens are converted.
- S1 screens (login, register, onboarding, the five-domain shell, Nap empty state) are re-skinned in this look — the
  files S2 owns (§3) only after S2 lands.
- S3 (reggel) and S4 (lépések) are built **directly in this look**; this document is their visual target instead of
  the Lágy files.
- House docs follow: the v1 spec gets a pointer in §0, `CLAUDE.md` §Boop and `.claude/skills/boop/SKILL.md` §2 name
  this look as the canon (Lágy's "light paper, no dark header" rejections no longer apply to Boop).

## 7. Left to the builder
- Exact token names, the module layout inside `BoopDesign`, and how the painted landscape is rendered (Canvas, a Metal
  shader, or pre-rendered per hue) as long as it looks like the spike and stays smooth while the hue animates.
- Ridge shapes per page (seeded so a page always looks the same), haze strength, glow sizes.
- How the still orb is produced (shader frame at a fixed time, or a cached image).
- Haptic choice details (`sensoryFeedback` soft impact ~0.45 is what the spike uses).
- The thin-outline stand-ins for the few glyphs that blob, until the icon family round.
- Dynamic Type and VoiceOver details: every orb and chart gets a spoken value; tappable phrases are buttons.

## 8. Reference — the spike
`docs/design_2.0/prototypes/boop-ios-spike/BoopSpike/`: `AuraSunrise.swift` (Mai, tabs, painted landscape, still orb,
other tabs), `AuraSteps.swift` (check-in, szándék, mérlegelés, étkezés, shared frame), `AuraSheets.swift` (brief with
tappable phrases, detail sheets, week bars, busy ribbon), `AuraSpike.swift` (fonts, glyph tinting, tab bar, the earlier
variants A/B/C kept for comparison only).
Launch: `-aura YES -auraVariant 3` · `-auraPhoto 2` (painted, default) · `-auraMetric 0–4` · `-auraTab 0–3` ·
`-auraOpen checkin|intention|weight|meal` · `-checkinDone YES` · `-intentionAsked YES` · `-weightSaved YES` ·
`-mealStage 0–3` · `-auraSheet sleep|heart|day` · `-auraBottom YES` (open scrolled to the end) · `-voiceOn NO`.
Rejected along the way (do not reintroduce): B "Nappal" (light, Ultrahuman-like); C's coloured card auras; A's arc
gauge + number (Oura copy); the photo options (vivid photo, photo per metric); white rings around selected orbs; the
0–100 horizon scale; the hairline under the tabs; the check-in quick-scale buttons; a fixed card list that is the same
for every metric (replaced by the lens, §5.1a).

## 9. Builder-check answers (2026-11-10)

Calls settled by the designer after the builder check (open to correction):

1. **Per-metric headline + sentence** — the S3 morning brief (already a new message kind in v1 §4.3) returns, besides
   readiness, a short headline and one sentence for each of the five metrics. No change to the web's messages. This is
   S3 backend scope, not new scope. *call*
2. **What 0–100 means per metric** (fill level and rise height; the number shown can differ) — *call*:
   Készenlét = readiness score; Alvás = the sleep score (shown as score); Mozgás = share of the day's step goal
   (capped at 100); Fuel = the day's intake progress against the time-of-day expected share of the calorie target;
   Pulzus shows **bpm** in the orb, but fill and rise come from a score of resting HR vs the 14-day baseline
   (at/below baseline = high). Rise mapping stays `(score − 40) / 60` clamped, so ≤ 40 sinks to the horizon.
3. **Charts without data in v1** — v1 ingests one daily-metrics row and min/avg/max HR, no HRV. Until S2's import
   grows (separate follow-up issue), the builder substitutes: Mozgás detail = steps vs goal bar + active energy;
   Pulzus detail/sheet = min · avg · max of the night + the 7-day resting-HR bars; the HRV tile is dropped. Rutin's
   habit strength exists on the backend (28-day derived strength, `habit.md`). *call*
4. **Slicing** — a separate slice **"S2.5 · Napkelte kit"** before S3: tokens, painted landscape, orbs (live + still),
   glass, type ramp, page and sheet frames, chart pieces, and the re-skin of S1 screens not owned by S2; the S2-owned
   files are re-skinned in S3 after S2 lands. S3/S4 build on the kit. *call*
5. **v1 parts not mentioned above** — "Mai szintek" is replaced by the mini-orb row; the brief keeps the word-by-word
   typing synced to the voice (in the Boop mondja card, started by "Boop elmondja"); the energy curve keeps the
   press-and-drag magnifier; conflicts are shown in the A napod sheet's conflict card instead of stems on the curve.
   *call*
