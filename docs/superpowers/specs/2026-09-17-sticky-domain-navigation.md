# Sticky domain navigation

Owner-approved on 2026-09-17 after reviewing the clickable Titanium prototype.
Driver: `mezo-0i5y6`. The light-mode experiment was explicitly cancelled.

## Design

The contextual navigation stays anchored to the bottom of the phone viewport while
content scrolls. Replace the floating capsule with an edge-to-edge graphite bar,
one upper divider and bottom safe-area padding. Keep the switch mark followed by
the active domain's four existing tab icons and labels. Each domain has its own
accent: gold, lime, cyan, lavender or rose. Keep the production route matrix and
last-tab memory; prototype-only differences in Train labels are not route changes.

Opening the switcher blurs and dims the phone screen. Only five independent Titanium
cards appear, with the existing domain names, icons, tab summaries and current-domain
checkmark. There is no enclosing drawer, visible heading or drag handle. A hidden
accessible dialog name remains. Cards enter with a short upward motion; reduced
motion disables it. Escape and tapping the backdrop dismiss; choosing a card closes
and navigates to that domain's remembered tab. Focus starts on the current card,
stays inside the dialog, and returns to the switch button on dismissal. Background
content is inert and cannot scroll. Small/landscape viewports can scroll the choices.

## Scope and acceptance

Apply navigation styling to all five domains and existing chrome-bearing subpages.
Keep deliberate chrome-free workout, sport logging, night and ritual flows intact.
Do not replace page content, fixtures, theme preferences, routes, data hooks or API
contracts. Navigation itself uses the approved dark palette even on legacy pages.
Preserve quick-log and save/composer clearance. Verify 320px, 390px and desktop
layouts, scroll anchoring, all five domain choices, keyboard behavior and last-tab
restoration. Run frontend tests in explicitly selected mock and real modes, build,
doc lint and codemap freshness before pushing a self-PR.
