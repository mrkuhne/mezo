# 0056 — Unified meal entry

- **Status:** Accepted
- **Date:** 2026-09-29
- **Driver:** mezo-qe90y

## Context

The meal logger split input into Fotó, Hang, Gépelés and Szokásosak tabs. Text was unavailable
until Gépelés was selected, and Kamra and Recept were hidden one level deeper. A selected photo
immediately started recognition, leaving no chance to check the image or add text before analysis.
The owner approved the clickable
[unified entry prototype](../design_2.0/prototypes/fuel-log-bevitel-javaslat.html).

## Decision

The new meal page has four direct actions: Fotó, Kamra, Recept and Szokásosak. A single text field
and its microphone remain visible below the camera or usuals area. Fotó opens the file picker;
the selected image appears in the large camera frame with Csere and removal controls. Photo and
text reach the existing AI draft endpoint only when the user presses Elemzés. Kamra and Recept
open the existing picker sheets and add lines to the same editable meal draft. The editing route
and the other LogFlow overlay entry points retain their own entry controls.

## Consequences

The page owns the selected photo and the top-row picker actions; `MealComposer` still owns the
AI request, line editing, provenance and save. The selected photo remains available for another
analysis until removed or the page closes. The failure state keeps the text field and a new-photo
route available. The living Fuel prototype and Kalauz wording follow this flow.

## Alternatives considered

- Keep separate Hang and Gépelés tabs: both duplicate controls already present beside the text
  field and hide useful entry paths.
- Analyze immediately on photo selection: this prevents reviewing or replacing the image and
  combining it with a typed description before recognition.
