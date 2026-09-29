# Hangdiktálás mindenhol — design (mezo-xojq8)

**Date:** 2026-09-29 · **Owner decision:** option A (one shared voice field on every free-text
sentence field, including the 7 places that already had voice) · **Prototype:** the five living
prototypes (`docs/design_2.0/prototypes/elo/*.html`) via the shared kit `elo/_hang-kit.html`.

## Problem

Owner report: the Check-in note has no dictation button and no Hallgató Boop, while Napló has.
Voice input was added screen by screen (mezo-at8x.4, mezo-zyyox), so 7 screens carry 5 different
mic buttons and ~20 free-text fields have none.

## Decision

1. **One field, one look.** A text field with a square glass mic tile to its right (the
   Kihagyás "Egyéb" tile, `trm-micb`, is the reference — the newest owner-approved variant). The
   tile shows the 3D `t-mic`; while listening it gets the accent ring + glow (`is-live`).
2. **One feedback.** Every mic drives the existing `VoiceBubble` (Hallgató Boop: listening →
   thinking → done / sad) with the domain's Boop. No change to the bubble itself.
3. **Composer bars keep their layout** (chat composer mic on the left, recipe-workshop composer):
   they use the same mic tile component and the same bubble, only the position differs.
4. **Fuel's dedicated "Hang" log mode** keeps its big round mic; it drives the same bubble and the
   transcript lands in a visible field before "Tovább". The "Hang" chip next to "Elemzés" is
   removed — the field's own tile replaces it.
5. **Dictated text is appended** to whatever is already typed (existing idiom:
   `d ? \`${d} ${t}\` : t`), never replaces it.
6. **Leaving mid-recording drops the clip** (sheet closes / route changes → `cancel()`).

### In scope (free-text sentence fields)

- **Nap:** Check-in "Gondolatok", Napi szándék, Tevékenységnapló, esti reflexió + hála sorok
  (already voiced — restyled), súly "egy mondat", sport jegyzet.
- **Edzés:** kihagyás oka (restyle), edzés utáni jegyzet (összegzés + ceremónia), gyakorlat
  jegyzet, edzés jegyzet, sport napló, futás napló, blokk-lezárás jegyzet, edzésterv-interjú.
- **Fuel:** étkezés AI-panel (restyle), Hang mód, gyógyszer beadás jegyzet, recept-műhely composer.
- **Én:** napló (restyle), hála (restyle), döntés-visszatekintés, ember jegyzet + ember leírás,
  ember gyors-log, súly jegyzet, alvás jegyzet (if the app has one), cél-varázsló szöveges lépései,
  szokás "miért"/horgony/ünneplés, AI-javaslat szándék, Rólam / stílus szöveg.
- **Mezo:** chat composer (restyle), csapatfal válasz, csapat-chat, karakter-válasz.

### Out of scope

Names, titles, search boxes, numbers, dates, passwords, admin/memory-editor fields.

## Shape in code

- Move `useVoiceInput` from `features/insights/logic` to `shared/lib/voice` (it is already used
  by 4 features; shared/ui must not import from features).
- New `shared/ui/voice/VoiceField.tsx`: textarea (or render-prop for a custom input) + `MicTile`
  + `VoiceBubble`, `onTranscript` appends. `MicTile` exported for composer bars.
- Replace the 7 hand-rolled mic buttons with `MicTile`; delete their one-off CSS
  (`capture-mic`, `rz-reflect-mic`, `trm-micb`, the "Hang" `logflow-aichip` variant).
- Wire `VoiceField` into every in-scope field.

## Acceptance (Kész, ha…)

Tracked in the bd issue `mezo-xojq8` and the plan.
