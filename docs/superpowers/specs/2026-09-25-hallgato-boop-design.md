# Hallgató Boop: feedback for every voice input

**Date:** 2026-09-25 · **bd:** `mezo-zyyox` · **Status:** owner-approved (prototype OK 2026-09-25)
**Prototype:** [`docs/design_2.0/prototypes/hang-boop.html`](../../design_2.0/prototypes/hang-boop.html)
(https://claude.ai/artifact/SENAq5WTU8bP6WGchrgAuX)

## Problem

Voice input is tap-to-start, tap-to-stop. After the second tap nothing on screen says the
transcript is being built. The mic chip only greys out, and on the journal sheet there is no
text at all. The owner read the silence as "did it hear me?". All six `useVoiceInput`
consumers show the three states differently, and several show none of them.

## Decision

Build one shared **glass bubble** that floats above the tab bar while voice input is active.
It carries the domain's living Boop, and every consumer renders it the same way.

| Phase | Trigger | Bubble |
|---|---|---|
| listening | `state === 'recording'` | Boop + ring + 12 bars pulse with the **live mic level**. Copy: „Figyelek · Mondd nyugodtan · Koppints ide, ha végeztél". Tapping the bubble stops. **✕** cancels: the clip is discarded and nothing is transcribed. |
| thinking | `state === 'transcribing'` | Boop looks up and sways, and an arc spins around it. Copy: „Leírom, amit mondtál…" |
| done | transcribing → idle, no error | Boop hops and the bubble leaves (~0.75 s). The text lands in the field as before. |
| sad | `error` becomes non-null | Coral accent, drooped brows and ears, error copy. Auto-hides after 3.2 s. |

Owner choices (2026-09-25):
- Placement: a floating bubble at the bottom (not inline at the button, not a centred modal).
- Listening motion reacts to the real voice level.

## Shape

- **`useVoiceInput`** gains:
  - `cancel()`. A ref flag makes `onstop` skip transcription.
  - `levelRef`: 0..1, fed by a Web Audio `AnalyserNode` on the recording stream through a rAF
    loop. It is a ref rather than state so a 60 fps signal never re-renders the consumer. It
    degrades to 0 when `AudioContext` is missing.
  - The too-short copy changes from „tartsd nyomva" (wrong since tap-to-toggle) to
    „Túl rövid volt — koppints, beszélj, aztán koppints újra."
- **`VoiceBubble`** (`shared/ui/voice/VoiceBubble.tsx`) takes `{ voice, domain }`:
  - It portals into `.phone-screen` (falling back to `body`) at z-index 300, above sheets, in
    the same tier as toasts.
  - It derives its phase from `voice.state` and `voice.error` transitions.
  - Its own rAF loop writes `--lvl` onto the bubble node.
  - It tolerates hook mocks that lack `levelRef` or `cancel`: level 0, and no ✕.
- **Consumers** render `<VoiceBubble voice={voice} domain=…/>` and drop their inline
  `voice.error` lines, because the bubble now owns the error message. Domains: Journal/Gratitude
  `me`, Chat `mezo`, Fuel (both) `fuel`, evening Reflection `nap`.
- **Reduced motion:** the same phases and copy without any motion. Level-driven transforms sit
  inside the `no-preference` branch.

## Testing

- The hook: cancel skips transcription, `levelRef` exists and stays 0 without Web Audio, and
  the existing tests still pass.
- `VoiceBubble`: hidden when idle. Shows listening copy while recording and thinking copy while
  transcribing. Shows the error copy. Stops on a bubble click and cancels on ✕.
- Consumer tests keep passing: MealComposer's error text is now found inside the bubble.
