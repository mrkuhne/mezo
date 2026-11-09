# Boop iOS spike — the approved morning look (2026-11-09)

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
