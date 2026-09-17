# Titanium quick logging

Approved by the owner on 2026-09-17 after reviewing the interactive quick-log and capture-sheet prototype. Driver: `mezo-62xey`.

## Design

Keep the 3×3 order: Étkezés / Víz / Stack, Edzés / Sport / Súly, Check-in / Napló / Alvás. One heading (Mi érkezett?), a graphite/gold Mezo entry, colored metallic category sculptures, compact live sublines. The category graphic continues into each capture sheet. Use the existing theme tokens, native controls, shared Sheet dismissal and reduced-motion support.

Water gets a selected-amount liquid graphic; weight a large reading and ruler; sport keeps its sport-specific counters and ratings; check-in retains four steps, skip/back and unlimited summary notes; journal retains note/decision/gratitude, voice and dates; activity keeps classification and confirmation; sleep retains manual/import review, phases, quality and all optional data. Remove canned personal/AI claims from capture surfaces. All real data, validation, mutations, loading/error behavior and routes remain authoritative; never port prototype fixtures or simulated saves.

Étkezés, Stack, Edzés and chat already navigate to dedicated production flows. Preserve those routes and their existing Titanium pages, not the deliberately abbreviated prototype previews. No backend/contract changes.

## Acceptance

Every launcher action remains reachable with keyboard and touch. The page has one title. Sheet inputs fit 320px through 430px, light/dark appearance, and scroll above the mobile keyboard. Capture graphics are decorative; accessible labels remain on controls. Existing mutation regression suites pass in both data modes. Build, focused browser review and docs checks pass before shipping through the self-PR CI gate.
