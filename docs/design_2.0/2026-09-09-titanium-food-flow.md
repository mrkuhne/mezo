# Titanium food analysis → daily nutrition

Driving issue mezo-4bto. Second dominant flow, following the approved
[workout flow](2026-09-09-titanium-workout-flow.md). Isolated prototype only; production
feature behavior, APIs and living feature docs are unchanged. Source: [Fuel](../features/fuel.md).

## Flow and decisions

Nap's command demo opens a full-phone food review with the yogurt/banana example prefilled.
Manual logging starts with a text entry and an explicit example shortcut. The bounded demo
recognizes yogurt + banana only; unsupported text stays in entry with an explanation.
No actual speech capture, LLM, database or external nutrition service is used.

Review exposes uncertain yogurt type, natural/Greek choice, gram quantities, editable time,
and live calorie/macro preview. Input quantities must be 1–2000 grams. Illustrative fixture
values recalculate proportionally; they are explicitly not product label data. Changes remain
in a draft until save. Saving uses a stable draft ID: re-saving or correcting replaces the same
meal, including after rewriting the description. Cancel discards only uncommitted changes.

Saved confirmation leads to Fuel Mai: remaining budget, macros, training context, chronological
meal list and recipe entry. Newly saved meals can be reopened. The Nap nutrition tile is also
updated and remains synchronized across daypart renders. The daily target stays the sample
2,400 kcal; logs change intake, not the budget. Other static training-context copy remains the
previous prototype's sample data. Reload or the desktop sample-day reset clears new meals.

## Files

- `food-state.js`: fixture foods, portions, totals and stable-ID meal upsert.
- `food.js`: entry/review/saved takeover, Fuel landing, Nap tile synchronization.
- `food.css`: review cards, portion controls, nutrition preview, daily budget and meal timeline.
- `navigation.js`: delegates Fuel Mai and both command/manual entry to the new flow.

## Validation

Two tests first failed for the missing state module, then passed: portion preview isolation,
recalculation, idempotent save, correction replacement and rejection of invalid portions without
mutating saved meals. Eight total prototype tests pass, and both Vite entries build. Existing
Three.js >500 kB warning remains.

Browser at 390 × 844: Nap command → review → yogurt 150→160 g → save (209 kcal, 1,389 daily),
then reopen → 150 g → resave (203 kcal, 1,383 daily). The list remains three meals, proving no
duplicate on correction. Reviewed mobile review/landing screenshots. Compact companion region
was increased 20px so the two-line copy and microphone fit above the budget card.
