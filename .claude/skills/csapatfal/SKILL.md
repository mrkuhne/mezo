---
name: csapatfal
description: Session driver for the Boop csapat-üzenőfal programme (epic mezo-a9bo7, 2026-09-23) — the 5-character social wall in the dark glass canon. Design rounds first (D1–D6, extending the approved uveg-uzenofal.html prototype, one round per fresh session, owner OK per round), implementation slices after. Use when the user invokes /csapatfal or asks to continue the csapat-üzenőfal / team-feed work.
---

# Csapatfal session driver

**One fresh session = one round.** The programme has two phases: **design rounds (D1–D6)**
that grow one clickable prototype world, then **implementation slices** (two acts) that are
cut only when the design rounds are done. Never skip the owner OK; never start implementation
while a design round is open.

## Owner decisions (2026-09-22/23): do not re-litigate

All recorded in the spec — read it first:
**`docs/superpowers/specs/2026-09-23-boop-team-feed-design.md`** (12 numbered decisions).
The load-bearing ones:

- **The wall is the main page**; 5 named characters (working names Szunya·alvás, Mocor·mozgás,
  Falat·étkezés, Derű·közérzet, Mezo·a csapat) + Szkeptikus/Mezo as conversation-only roles.
  The Szkeptikus never posts and has no story ring.
- **Social anatomy** (Facebook card order, stories-ring semantics, counts row above actions,
  comment preview, "N új bejegyzés" pill) fused with the **Huawei/Mozaik depth** (tile → own
  page, hero zones). Dock: Üzenőfal · A csapat · Rólad · Emlékek.
- **Glass canon, dark only** (üveg bible). Ranking on the wall: the day's poster is the ONLY
  glass box; quiet posts sit in faint rounded flat panels (visible boundaries, no glass
  properties); team/room rows are glass with the character's accent. **Chrome comes from
  `fuel-uveg.html` verbatim** (Mezo domain: lav accent, boop-mezo on the switcher).
- **Character voice rule:** posts and comments are 2–4 sentences, concrete numbers, bold
  emphasis, personality, and measured **emoji in the text** (Szunya 🌙, Mocor ⚡💪, Falat 🍽️🥦,
  Derű 🌤️, Mezo 📔✅; the Szkeptikus stays dry, no emoji). Emoji live ONLY in character
  sentences — UI glyphs are sprite symbols, never emoji.
- **Honesty rules** (ADR 0049): no invented records in the real app; a prototype uses
  szemléltetett content that mirrors real record types. Uncertainty speaks Hungarian
  ("kezd úgy tűnni", "még kevés adat"); every claim carries "Miből látszik?".
- **Unified action trio** everywhere: Ez talál · Nem így érzem · Elmesélem (custom Titanium
  icons, approved 2026-09-23) + visible afterlife ("Megerősítetted · bekerült…").

## Canon (read every session, in this order)

1. The spec above — decisions, gazdi-térkép, phasing.
2. **`docs/design_2.0/prototypes/uveg-uzenofal.html`** — the approved world; every round
   EXTENDS this file (hash-routed pages), so it stays one coherent clickable world.
3. **`docs/design_2.0/2026-09-23-uveg-style-bible.md`** — the glass material, icons (§4),
   data graphics (§5), motion (§6), chrome (§7). Where it conflicts with older bibles, it wins.
4. The `/uvegesites` skill — its Procedure §1 (prototype rules: HTTP serve, cache-bust,
   "Új ikonok" sheet, §3.4 ranking) applies here verbatim.
5. For what a screen must cover: `docs/features/{insights,character,companion,proactive}.md`
   and the 2026-09-21 audit (`docs/superpowers/specs/2026-09-21-boop-social-ai-audit.md`) —
   parity sources, never look sources.

## The rounds

`bd list --label epic:boop-team-feed` is the authority. Take the lowest open `mezo-a9bo7.N`
unless the owner names one. `bd show <id>` carries the scope. Current plan:

| Round | Scope |
| --- | --- |
| D1 | A fal mélye: poszt-oldal minden műfajra (kísérlet, előrejelzés, döntés-flow), Elmesélem válasz-flow, mélyebb Miből látszik |
| D2 | Mind az 5 szoba teljes mélysége + karakter-aloldalak (minták/kísérletek listái, érettség-történet) |
| D3 | Rólad: a dosszié (tények, karaktervonások, életesemények, egy döntő-postaláda) |
| D4 | Emlékek: napló, heti memoár-fejezet, visszakeresés |
| D5 | Mezo-szoba mélye: konzílium-jegyzőkönyv, heti fejezet, Gépterem dev-ajtó |
| D6 | Első használat napról napra + kalauz-kivezetés |

After D6: write the implementation plan (superpowers:writing-plans) for Act I (the stage —
FE over existing data) and Act II (the voice — cross-engine témaszál + esti kurátor +
hypothesis-critic retune), cut the implementation beads under `mezo-a9bo7`, and coordinate
with `mezo-me75u` U8/U9 (those slices receive these surfaces; do not build the same screen
twice).

## Procedure (one design round)

1. `bd update <id> --claim`. Work on a branch (worktree), e.g. `feat/csapatfal-d1`.
2. Extend `uveg-uzenofal.html`: new hash routes + a jump link per new page in the notes
   panel. Reuse the file's helpers (`CH`, `phead`, `acts`, `ring`, `openSheet`); never fork a
   second glass recipe. New icons → draw in the §4 recipe, add to the "Új ikonok" page for
   the owner's OK.
3. Verify yourself: serve over HTTP from the prototypes dir (`python3 -m http.server 8471
   --bind 127.0.0.1`, background; `file://` renders script-less). Click every new route in the
   in-app browser, console clean, cache-bust with `?v=N`, check the "Mozgás kikapcsolása"
   branch.
4. Hand to the owner **in Hungarian, business language**: what to click, what is new, 1–2
   genuine questions. **Stop and wait for the OK.** Iterate in the same file.
5. After the OK: commit prototype + any spec delta with the bead id
   (`docs(boop): csapatfal D<N> — <mit> (mezo-a9bo7.<N>)`), close the bead with a summary,
   session close per CLAUDE.md (beads backup + push).

## Traps

- The primary checkout sits on main — always work from a worktree; merges go detached-HEAD
  → `git push origin HEAD:main` (house rule).
- `file://` in the in-app browser = static snapshot; hash navigation does not reload — use
  the HTTP server + `?v=N`.
- The sprite must stay `position:absolute;width:0;height:0`, never `display:none`.
- Descendant selectors bite: a bare `b`/`i` rule inside a new block can restyle the bar-fill
  `<b>` of `.bar` (this cost D0 a bug). Scope value texts with their own class.
- The chrome is not this programme's to change (header, tabbar, switcher, ntf panel) — swap
  only domain accent/boop/tabs.
- Mezo domain tabs are the NEW dock (Üzenőfal · A csapat · Rólad · Emlékek) — this is the
  approved future nav, deliberately different from the live app's Menü tab.
- The gold Mezo and slate Szkeptikus boop figures live in this prototype's own sprite block
  (`ug-*` gradients) — reuse, don't redraw.
