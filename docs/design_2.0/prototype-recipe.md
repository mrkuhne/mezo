# Prototype recipe — how every clickable prototype is made

The owner looks at a change once, at a clickable prototype, before any code. This is the recipe
for that prototype. It was the `/uvegesites` skill's Procedure §1 (programme `mezo-me75u`, closed
2026-09-27); the skill is archived at [`../archive/skills/uvegesites.md`](../archive/skills/uvegesites.md)
and this page is now the living copy (`mezo-iwmsw`). The shared workflow around it (the three
owner gates, living per-domain prototypes and *Kész, ha…* checklist) is in the
[`owner-visible-frontend` skill](../../.agents/skills/owner-visible-frontend/SKILL.md).

## The page

- One self-contained HTML page. For a change in a bottom-menu domain, **edit that domain's living
  prototype** in [`prototypes/elo/`](prototypes/elo/README.md) instead of starting a new file. A
  standalone page (a new programme's world, e.g. `uveg-uzenofal.html`) starts by copying
  [`prototypes/fuel-uveg.html`](prototypes/fuel-uveg.html): it carries the sprite, the `.glass`
  recipe, aurora, rings, sheet, motion and the side-notes panel. Dark only — no light theme, no toggle.
- **Clickable:** the change's main routes are reachable by tapping, with a hash router, back
  buttons and the key sheets/dialogs. Non-scope taps show a toast.
- **Real-looking content:** Hungarian, mirroring what the live screen shows. Read the page
  components for the actual fields; never invent features. Never paste the owner's real data
  (production DB rows) — real-*looking* content of the real record types.
- Apply the **§3.4 ranking** ([restored-world bible](2026-09-17-restored-world-style-bible.md))
  first: name the one thing each screen says and give it the loudest treatment. Not everything is
  glass ([üveg bible](2026-09-23-uveg-style-bible.md) §3).
- **The chrome comes from `fuel-uveg.html` verbatim:** the header with its sprites and day orb,
  the notification panel, the glass TabBar with the living Boop, the domain switcher. Swap only
  what the area changes: the active domain's Boop, its `navModel` tabs and labels, and `--c`.

## Icons — custom, always (owner, 2026-09-23)

- List every icon the screens show: content icons, empty states, tiles. Map each to the
  Titanium 3D sprite.
- **Where no symbol fits well, draw a custom one** in the üveg bible §4 recipe (64×64, gradient
  body, pale stroke, highlight strokes, `#shadow` filter). No near-miss, no unrelated glyph,
  **never an emoji** (emoji live only inside character sentences on the csapatfal).
- Put an **"Új ikonok" sheet** in the prototype: each new icon large, on glass, with its name and
  where it appears, so the owner approves icons together with the screens. After the OK the new
  symbols go into the shared sprite (never inlined into a page) and later work reuses them.

## Verify it yourself before showing it

- Serve over HTTP from the prototypes dir: `python3 -m http.server <port> --bind 127.0.0.1`, in
  the background. A `file://` page renders as a script-less snapshot in the in-app browser.
- Click through every route in the in-app browser; the console must be clean.
- Cache-bust with `?v=N` after edits — hash-only navigation does not reload the page.
- Check 320px width and the reduced-motion ("Mozgás kikapcsolása") branch.
- Where an Artifact publishing tool is available, republish to the domain's fixed URL for the
  owner. Otherwise show the browser-tested preview through a route the owner can actually open
  and provide the repository file path. A localhost link alone may be inaccessible. Say plainly
  that the fixed Artifact URL was not updated; settle the review route before prototype approval.

## Hand-off

In Hungarian, business language (the root house rules §Working with the owner): the link, what to click, what
changed in everyday words, and 1–2 concrete questions only if there are genuine choices. **Then
stop and wait for the OK.** Iterate on feedback in the same file. After the OK, commit the
prototype with the change — it becomes the change's parity reference, and there is no further
visual iteration after the build.

## Traps

- The sprite is hidden with `position:absolute;width:0;height:0`, never `display:none`.
- The ring svg needs `overflow: visible`, or the glow `drop-shadow` clips to a square.
- `prototype.css` locks the document scroller (`html, body { overflow: hidden }`); a lab page
  that links it must unlock it.
- Descendant selectors bite: a bare `b`/`i` rule inside a new block can restyle the bar-fill
  `<b>` of `.bar`. Scope value texts with their own class.
- Before prototyping any surface, grep every approved prototype for its route (üveg bible rule
  66): another programme may already have designed it.
