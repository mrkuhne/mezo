# Titanium navigation and companion actions

Approved conversational direction, 2026-09-09. Driving issue: mezo-cwc3.
Extends the [Nap prototype](2026-09-09-nap-titanium-prototype.md), exclusively under
`prototypes/companion-titanium`. Production routes, data and feature behavior are unchanged.

## Navigation

A fixed lower-left miniature titanium mark opens a five-domain dialog. Each domain has
four contextual buttons. Hash routes support direct links and browser history; switching
remembers each domain's last page within the current page session.

| Domain | Four destinations |
| --- | --- |
| Nap | Mai, Beszélgetés, Rutin, Napzárás |
| Edzés | Mai, Terhelés, Napló, Tervek |
| Fuel | Mai, Receptek, Kamra, Kiegészítők |
| Mezo | Felfedezések, Előrejelzések, Karakter, Tudástár |
| Én | Áttekintés, Súly, Alvás, Napló |

The user prioritizes logging and load monitoring over exercise catalogs or frequent mesocycle
creation. Discoveries groups patterns, investigation (the proposed label “Járjunk utána” replaces
Diagnózis) and experiments. Weight and sleep are first-class personal destinations. Quests
leave the Nap mosaic and contextual menu; the original water reward state remains intact.

The existing renderer appears on all five landing pages, compact on Train and Fuel. It now
turns right-to-left over 72 seconds; orbit rings tip on their x axes with distinct slow periods.
Previously approved calm oscillations and non-burst thought response remain. Pause and reduced
motion still apply. One iframe is reused, rather than mounting five WebGL renderers.

## Action demo and boundaries

The microphone-shaped button explicitly opens a simulated command interface: three sample
utterances or typed text, no microphone capture, network speech service, or real AI/tool calls.
Food opens the existing demo dialog with the utterance prefilled and a clearly labelled canned
joghurt/banana analysis. Workout opens today's start dialog and a temporary set-logging form.
Journal opens the existing journal editor; text after a colon can be carried into it. Unsupported
commands stay in the command interface with a clear explanation. No automatic backend writes.

All twenty menu destinations have demo content. Secondary cards open bounded descriptive detail
dialogs; complete recipe builders, character feedback, real forecasts and catalog editing are not
implemented. Sport and weight forms demonstrate submission feedback only, without changing the
sample overview. Set rows last only while the workout dialog is open. Original journal, water,
habit and check-in interactions retain their in-memory state. Reload resets the prototype.

## Sources

- [Train](../features/train.md): execution, volume ramp, static interim sport load, plans.
- [Fuel](../features/fuel.md): daily budget, recipes/workshop, pantry and supplement protocol.
- [Insights](../features/insights.md), [Character](../features/character.md),
  [Proactive](../features/proactive.md): discovery and knowledge relationships.
- [Companion](../features/companion.md): existing snapshot and character prompt context.
- [Me](../features/me.md): weight, sleep, goals, journal.

## Verification

- Navigation state test first failed for absent module, then passed: domain-page restoration and
  invalid hash fallback. All four prototype tests pass.
- Vite builds both HTML entries; existing Three.js >500 kB bundle warning remains.
- Browser at 390 × 844: no document horizontal overflow; nav bottom equals viewport bottom.
  Visually reviewed Nap, domain selector and load page. Exercised Mezo menus, Train menus,
  personal pages and all three command transitions; recorded a workout set.
- CODEMAP check and documentation error-only lint pass (12 existing stale advisories, 3 warnings).
- The inherited in-app iframe MutationObserver diagnostic is documented in the Nap prototype note.

## Atomic orbit refinement (mezo-mv0p)

User requested two additional planet-bearing rings and subtle neuron-like local firing.
Four rings now live in an independent scene group: they follow the body's center and manual
view rotation, but do not inherit its autonomous yaw. Each plane tips at its own rate;
beads orbit in alternating directions with periods approximately 19–29 seconds. The orbit
lines have slightly higher opacity so their independent movement is easier to read.
Six short seam fragments provide local light events, one at a time, with a smooth 1.1-second
fade every 5.4 seconds. No whole-body brightness modulation or extra point light is added.
Pause/reduced motion stops orbit time and hides the transient light fragments.
Validation: four existing prototype tests pass, both Vite entries build, diff whitespace
check passes, and the four-ring scene was visually checked on the Nap landing page.
