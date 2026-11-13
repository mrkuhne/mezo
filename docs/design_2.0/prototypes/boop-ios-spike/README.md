# Boop iOS spike

> **Newest round — "Képek" (B3/b, `mezo-r36n9.32`, 2026-11-13):** photos inside the Napkelte look, judged on the
> real shipped screens in the simulator (a throwaway `KepekSpike.swift` layer over the app plus the CC0 photos,
> deleted after the round). Owner's pick: **A fent, B a kártyákon** — a quiet nature photo in every page and room
> head under the hue's own sky, and a photo of the thing on proposal cards, day stations, Napló days and plan rows;
> the blurred-photo ground (C) is rejected. Guideline:
> [`docs/superpowers/specs/2026-11-13-boop-kepek-design.md`](../../../superpowers/specs/2026-11-13-boop-kepek-design.md).
> Screenshots: `kepek-attekintes.jpg` (the three variants), `kepek-valasztott.jpg` (the chosen combination).

> **Newest round — "Élet" (curiosity spike, `mezo-r36n9.33`, 2026-11-13, round 2 after owner feedback):** what Boop looks like once it also
> carries **money** and **mail** (and later life goals), with one AI that keeps **threads**. Round 1 (a seven-orb
> strip on Ma + Reggel/Napközben/Este chips) was **rejected by the owner** — two stacked menus, and seven dots are
> not a dashboard. Round 2: **one home screen**, the whole day in a single scroll with the phases as headings and
> one orb; the **areas as wide cards** further down, loud ones first and the calm ones collapsed; **every area has
> its own full page with its own top tabs**, from one data-driven component; the proposal card as the cross-area
> organ ("4 terület szólt hozzá" → "miért?"); the Boop tab as a **thread list**; Terv's top level as the **life
> goal**. Round 3 answers "how do I get into an area?": **Terv is the home of the areas** — the goal plus one
> card per area (today's verdict + what it contributes to the goal), each opening that area's page; no fifth bar
> button. Areas renamed to the spine vocabulary (Fuel → Étel, Mozgás → Edzés, Közérzet → Energia).
> Round 4 makes it premium: a long **morning briefing** (speak button, three paragraphs, a chip peek into every
> area, "a nap három dolga"), the Terv areas as a **two-up grid with big orbs and notification badges**, and area
> pages built from a real component kit (`EletKit.swift`: stat tiles, smooth auto-scaled curves with a target
> line, composition bars, detailed row lists, heat strips, 2-column menu grids, badges) with content in
> `EletContent.swift`. **Round 5** adds a WARM variant behind `-eletWarm YES` for an A/B the owner asked for after
> comparing the old Lágy screen ("hideg és dobozolós"): Képek variant A photo heads, the area's hue on the key
> numbers and marked spans inside the text (`EHueText`, `*…*` markup), photo thumbnails on rows that are things, and
> the boxes dropped from the stats / curve / composition / row-list blocks (`EletWarm.swift`). Side-by-side:
> `elet-x1-osszehasonlitas-felso.jpg`, `elet-x2-osszehasonlitas-also.jpg`. **The owner picked warm, so it is now
> the default** (`-eletHideg YES` still shows the pre-decision version). Only Forma, Alvás, Étel and Pénz have a
> photo today; the rest keep the painted landscape until `mezo-r36n9.44` adds the missing mood photos.
> Files `Elet*.swift`; launch `-elet YES` plus `-eletTab 0–3`, `-eletOpen penz|level|m0…m6`, `-eletHideg YES`. Screenshots: `elet-*.png`. Direction write-up:
> [`docs/superpowers/research/boop-life/03-ui-direction.md`](../../../superpowers/research/boop-life/03-ui-direction.md).
> **Nothing here is built** — the owner decided on 2026-11-13 that the life dashboard ships after B6.

> **Newest round — "Gerinc" (B2, `mezo-r36n9.12`, 2026-11-11):** the standalone spine in the Napkelte look —
> bottom bar Ma · Terv · Napló · Boop + "+", Ma as one day (Reggel plan → Napközben timeline with proposal cards →
> Este close), proposal card + "miért?" with labelled expert lines, the domain drill-down template (Alvás),
> the "+" quick-capture sheet, placeholders. Files `Gerinc*.swift`; launch `-gerinc YES` plus `-gerincTab 0–3`,
> `-gerincPhase 0|1|2` (the clock; also the time chip top-left), `-gerincMetric 0–4`,
> `-gerincOpen why|plus|drill`, `-gerincScroll reggel|napkozben|este`. Screenshots: `gerinc-*.png`.


> **Newest round — "Napkelte" (owner, 2026-11-10, `mezo-r36n9.3`):** a dark-glass look with a painted sky backdrop
> and the orb rising as the morning sun; it replaces Lágy as Boop's look once its spec is approved
> ([`2026-11-10-boop-napkelte-design.md`](../../../superpowers/specs/2026-11-10-boop-napkelte-design.md)).
> Files `Aura*.swift`; launch `-aura YES -auraVariant 3` (plus `-auraMetric 0–4`, `-auraTab 0–3`,
> `-auraOpen checkin|intention|weight|meal`, `-auraSheet sleep|heart|day`, `-auraBottom YES`, `-auraPhoto 0–2`).
> Screenshots of each approved state: `aura-*.png` in this folder.

> **Current state (Lágy pivot, owner 2026-11-09):** the app starts in the **Lágy** shell (`LagyRoot`
> in `LagyShell.swift`): five domains in the floating bottom bar, each a Lágy tab page.
>
> | File | What it shows |
> |---|---|
> | `Lagy.swift` | Lágy tokens, Outfit + Manrope (bundled OFL, `Res/`), glyph view, logo mark, chips, pills, cards, bars |
> | `LagyMai.swift` | **Nap · Mai** morning: photo head, verdict, *Boop mondja* (spoken + typed), readiness orb in the deep card, sheets |
> | `LagyCurve.swift` | *A nap energiája* in Lágy dress (generated from `EnergyCurve.swift`) |
> | `LagyFlowKit.swift`, `LagyFlows.swift` | the five morning steps as Lágy inner pages: check-in, Mai szándék, Mérlegelés, Első étkezés (photo analysis), Boop észrevette |
> | `LagyShell.swift`, `LagyDomains.swift` | bottom bar + Edzés · Mai, Fuel · Mai, Boop · Üzenőfal, Én · Hol tartok |
>
> The companion is called **Boop** (not Mezo). Glyphs are generated from the Lágy prototype's `G()`
> table into `Assets.xcassets/Glyphs` by `tools/genglyphs.mjs`; photos in `Res/` come from
> `docs/design_2.0/prototypes/kepes/foto` (CC0, see its `CREDITS.md`).
> Launch arguments: `-tab Nap|Edzés|Fuel|Boop|Én`, `-open checkin|intention|weight|meal|patterns`,
> `-checkinDone YES`, `-intentionAsked YES`, `-weightSaved YES`, `-mealStage 0–3`, `-sheet sleep|heart|day`,
> `-mood 0|1|2`, `-crowded YES`, `-scrubAt 14.25`, `-voiceOn NO`, `-legacy YES` (the first dark spike below).
>
> Everything below describes the **first, dark spike round** (superseded look, kept for reference).

## First round — the dark morning look

Throwaway SwiftUI spike the owner reviewed in the iOS Simulator while brainstorming the native
iPhone app **Boop** (epic `mezo-r36n9`, spec
[`docs/superpowers/specs/2026-11-09-boop-ios-v1-design.md`](../../../superpowers/specs/2026-11-09-boop-ios-v1-design.md)).
It is a **reference for the look and feel**, not production code: fake data, buttons that do
nothing, no networking, no tests.

**Approved direction: variant A "Orb"** (`VariantOrb.swift`). B (`VariantAiry`) and C
(`VariantGlass`) were the rejected alternatives and are kept only for comparison.

What the owner approved in A:

- **Living orb** (`Orb.metal`, `LivingOrb.swift`) — a glass sphere drawn by a Metal shader: flowing
  marbled colour inside, a liquid that fills to the day's readiness on open, waves that swell and
  settle, caustics and rising bubbles, rim light and a specular glint. It sloshes when the phone
  tilts (CoreMotion gravity → under-damped spring) or when dragged, ripples where tapped (soft
  haptic), surges with every spoken word, and its palette encodes the day (good = indigo/violet/sky,
  okay = teal/sun, tired = amber/rose) together with the background sky.
- **Boop speaks** — the verdict is read aloud in Hungarian (`AVSpeechSynthesizer`, best installed
  hu-HU voice) and typed in sync with the voice word by word (`willSpeakRangeOfSpeechString`);
  serif "voice" type, left aligned, key phrases bold + dotted-underlined and tappable (they open
  the data behind them in a sheet). Mute toggle + "Mondd újra" (replay).
- **A nap energiája** (`EnergyCurve.swift`) — the day as a liquid energy curve 06:00–24:00 with a
  "most" line. Only body-relevant anchors sit on it as icons (meals, training, sleep; conflicts
  lifted above on a stem); meetings melt into a 15-minute **busy ribbon** under the curve (darker =
  overlapping). Icons closer than ~1.4 h merge into a numbered cluster. **Press and drag** shows a
  magnifier (time, predicted energy %, what is on at that moment) with a 15-minute haptic tick.
  A callout under the curve explains the selected anchor, with Boop's suggestion and an action.
  Proven readable with a 20-event "CEO day" (`DayPlan.ceo`).
- Choreographed staggered entrance; reduced-motion branch (no typing, no slosh, instant fill).

Run it: open `BoopSpike.xcodeproj` in Xcode 26+ (iOS 26 SDK; the shader needs the Metal
toolchain: `xcodebuild -downloadComponent MetalToolchain`), pick an iPhone simulator, Run. Launch
arguments used while verifying: `-variant 0|1|2`, `-mood 0|1|2`, `-crowded YES`, `-scrubAt 15.2`
(pins the magnifier), `-select 0-19:00` (pre-selects an anchor).
