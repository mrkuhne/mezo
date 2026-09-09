# Nap — titanium companion prototype

Driver: `mezo-hgqh`. Builds on `mezo-zm9m` / PR #621, whose liquid titanium B companion
and 60%-reduced autonomous motion were explicitly approved by the user. The user chose
Nap as the first whole-app context to explore before Train and self-reflection.

## Design scope

[The existing Nap behavior](../features/today.md) is the functional reference; this is a
standalone proposed composition, not a production feature change. The hierarchy is:
arrival with Mezo → one next action → daypart-specific tiles → six life signs → daily
intention → a quiet progression summary. The companion's presence and useful content
share the screen. Custom dimensional SVG objects use titanium, cyan, lavender, lime and
gold gradients instead of emoji or a generic stroke-only icon library.

Morning, daytime and evening switch the greeting, companion copy, suggested action and
tiles. Desktop shows a phone presentation with scenario controls; mobile is full-screen
and cycles dayparts through the header control. No connection to the production app,
AI, accounts, external persistence or push notifications exists. Numbers and prose are
explicitly demo content; reload resets all inputs.

## Files and running

All source lives beside the [approved companion study](2026-09-09-companion-titanium-motion.md)
in `prototypes/companion-titanium/`:
- `nap.html`: presentation, mobile shell, SVG symbols, companion frame and native dialog.
- `nap.css`: responsive visual system, custom tile treatments and restrained feedback.
- `nap.js`: demo scenarios, interactions and contextual detail sheets.
- `nap-state.js` + `nap-state.test.js`: in-memory water, check-in and habit behavior.
- `vite.config.js`: two build entries (`index.html`, `nap.html`).

Run `npm ci` and `npm run dev` in that directory. Open
`http://127.0.0.1:5189/nap.html`. Production bundle: `npm run build`.
State checks: `node --test nap-state.test.js`.

`/?embed=1` exposes the same companion renderer in a compact frame. The geometry,
material and 0.4 autonomous-motion multiplier are shared, not forked. The iframe accepts
only `mezo:mode` and `mezo:pause` messages from its same-origin parent, validates their
values and keeps its own pause/reduced-motion behavior. The original `/` study remains
available with all controls. A header pause control is available in the Nap hero.

## Interactive behavior

Water adds 250 ml, updates the tile and hydration life sign, and completes the demo 2 L
quest once (+25 XP). Subsequent drinks never repeat its reward. A normal log uses light
and a filling strip; only completing the quest requests the companion's celebration.

Check-in exposes four day slots and four 1–10 dimensions. Re-saving a slot replaces its
values without incrementing the daily count. A daytime check-in changes the next-action
card from check-in to nourishment. All four slots are editable for testing.

Manual routine items toggle; sleep and intention are derived, non-interactive rows.
Journal text is escaped on rendering, shown in the current in-memory journal, and gets
a quiet acknowledgment with no reward or outward ring. Intention text is editable.
The evening closing preview can capture an optional reflection and mark the day closed;
it is a short design sketch, not the full production six-act ritual.

All tiles and navigation controls have a response. The Train, Fuel, Stack, sleep and
profile destinations are deliberately bounded detail previews; workout execution,
meal editing and the complete sibling pages are outside this first Nap study. Messages
show illustrative companion prose rather than simulating a live chat service.

## Differences to evaluate before implementation

Unlike the current app, detail previews use sheets to make this first design study easy
to explore. This does not approve replacing the production full-page sibling navigation.
The routine is a four-item illustrative subset, the needs percentages are simplified
signals, the currency is a read-only sample and the closing ritual is abbreviated.
Production integration must use the existing domain hooks, engines and honest states.
The locally served iframe and WebGL bundle are a prototype reuse mechanism; mobile GPU
profiling, renderer lifecycle and app integration require a separate implementation.

## Verification

Three state tests cover idempotent water-quest rewards, replacement of a check-in slot
and protection of derived habits. Browser checks cover rendering, water logging and
quest/XP changes, check-in submission, journal capture, daypart switching, and a 390px
mobile layout with no horizontal overflow and bottom navigation inside the viewport.
Both the original companion and Nap are included in the Vite production build.

The in-app browser emits an early `MutationObserver.observe` TypeError for iframe pages.
The identical error was reproduced on a temporary plain HTML page containing only an
empty iframe, with no application JavaScript. It is not treated as a clean-console result;
rendering and the interaction checks passed. The diagnostic files were removed.
