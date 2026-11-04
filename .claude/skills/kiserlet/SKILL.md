---
name: kiserlet
description: Session driver for the owner's ALTERNATIVE prototype (mezo-pi0jf, "every page its own drawing" — kiserlet-napom-grafika.html + vilagos/kiserlet-*.js, Artifact https://claude.ai/artifact/2ZdMk9D8jsjbFRhf2cB9cP). Converts the remaining old-look inner pages (Edzés, Fuel, Mezo) to the new system one domain per round, verifies them with the repo probes, republishes the fixed Artifact and reports in Hungarian. Re-invoke after a compaction to pick the work up where it stopped. Use when the user invokes /kiserlet or asks to continue the alternative prototype / kísérlet / régi oldalak átalakítása / belső oldalak.
---

# Kísérlet (alternative prototype) session driver

The owner's side experiment: a second, drawn version of the whole Folyadék prototype. **Not the build
target** — the app and `/folyadek` go on unchanged; never propose rebuilds or "which direction wins".
**Re-invoking this skill after a compaction is the normal way to resume** — do §Resume first, every time.

## Resume (every invocation, before anything else)

1. `bd show mezo-pi0jf` and its children: `bd list --parent mezo-pi0jf --status open`. The open child
   with the lowest number is the current round (`.1` Edzés · `.2` Fuel · `.3` Mezo); its description lists
   the pages. `bd comments <id>` holds what earlier sessions finished — **append a comment after every
   batch of pages** (which pages are done, what is open), so a compaction loses nothing.
2. `git log --oneline -8` on the branch; `git status` clean? (worktree rules: never cd to the primary repo,
   never bare `git stash`; commits go to the branch and are pushed — this work does not merge to main).
3. Read **`docs/design_2.0/prototypes/vilagos/KISERLET.md`**: owner rules (§Rules, §UX floor), the pages
   table (newest rows last), §Traps, and the hand-offs. It is the canon; this skill only points at it.
4. Start the server (background): `python3 -m http.server 8757 --bind 127.0.0.1` from
   `docs/design_2.0/prototypes`, then `node docs/design_2.0/prototypes/vilagos/kiserlet-tools/conv.mjs`
   — the live list of pages still in the old look (`old` / `mixed`).

## Files

- Shell: `docs/design_2.0/prototypes/kiserlet-napom-grafika.html` (Folyadék shell + the 5 experiment files).
- Experiment layer, the ONLY files you edit: `vilagos/kiserlet-{napom,edzes,fuel,mezo,en}.js` (+ `KISERLET.md`).
  **Never edit** the approved `nap.js edzes.js fuel.js mezo.js en.js kit.js foly.js keret.js klinikai-iranyok.html`.
- A page is converted by wrapping its route: `const O=…routes.x; …routes['x-lista']=O; …routes.x=newFn`
  — the approved page stays reachable as `#w-<d>-x-lista` (the owner's "régi" comparison link; never
  convert or rewrite those). Copy the idiom of the nearest converted page in the same file: e.g.
  `trendek3` in kiserlet-fuel.js (cardsOf / bal / g, `ex-hero` + `n7-h` sentence, `KH` section heads,
  `mz()` Mezo line instead of grey notes, `pills`, `badge`), helpers via `window.KXN` / `window.KXE`.
- Probes (repo, outputs go to `$TMPDIR/kiserlet-tools`): `vilagos/kiserlet-tools/`
  `reach.mjs` (crawl from every tab, expect `visited ≥ 318 errs 0`, BAD []), `err.mjs <route>…`,
  `txt.mjs <route>…` (visible text), `conv.mjs`, `small.mjs [route…]` (<12 px at 320),
  `narrow.mjs` (taps <40 px at 320), `abbr.mjs` (abbreviations left), `build.mjs` (publish bundle).

## The round (one domain; Mezo may take two)

1. Recon the domain's old pages: `txt.mjs` each, read its approved route code for every control, state and
   field (parity list), and the converted siblings for the look. Never invent features.
2. Convert in batches of 3–5 pages. Parallel helpers are fine **per file** (two helpers never edit the same
   file); give each the exact pages, the idiom to copy, the owner rules and the checks below.
3. Checks per batch, with evidence: `err.mjs` on the pages; click every control (Playwright, `lib.mjs`
   `open/load`), including once more after an in-place switch (`soft()` re-renders wipe added elements —
   keep state on own `data-w…` attributes, see §Traps); `small.mjs` + `narrow.mjs` clean on them; a 320 px
   screenshot looked at; `body.still` hides new motion; then `reach.mjs` for the whole prototype.
4. Log: one row per page (or group) in KISERLET.md §Pages; commit
   `docs(prototype): alternative prototype — <what> (mezo-pi0jf)`; `git push`; bd comment on the round.
5. Publish (below), then the Hungarian report: link, what to click, what changed in everyday words, what
   is still open, one genuine question at most. **Stop and wait** for the owner after each domain.
6. When a round is done: `bd close <id>`; `node scripts/check-beads-backup.mjs --fix`, commit, push,
   `bd dolt push`.

## Owner rules in one breath (full list: KISERLET.md §Rules / §UX floor — they win)

Opens on the current page (`#w-nap-mai`); one object one card shape; roomy cards; the domain keeps its
tinted ground; mode switches happen in place; carousels have dots; pictures must say something; no grey
helper text (it becomes Mezo's line); no abbreviations (day letters H K Sze Cs P Szo V, monograms, units
and exercise names are fine — the global `abNode` pass in kiserlet-napom.js writes the rest out); no
numbered headings; no emojis; no purple/orange hero boxes; text ≥ 12 px and taps ≥ 40 px (44 primary) at
320 px; "kalória", never kcal; dates agree with today = csütörtök, szeptember 24. (week 21–27).
Implement direct instructions immediately; never push direction changes. Owner decisions recorded in
KISERLET.md as removals are NOT losses — do not restore them.

## Publish (fixed Artifact, one URL)

`node vilagos/kiserlet-tools/build.mjs` → prints the 16-file list (index.html + 15 `vilagos/*.js`).
Then `get_artifact` on https://claude.ai/artifact/2ZdMk9D8jsjbFRhf2cB9cP (slug
`0ca75872-a244-4c9e-a780-ad95d028a304`) for the live `version`, and `publish_files` with that slug,
`base_version` = it, `files` = the printed list (patch mode). Read the files you publish that you did not
write this session (the approved ones are unchanged from the last publish; check with `git diff` against
the last publish commit). After publishing, read one changed file back and check it is the worktree file.
The in-app browser cannot open artifact URLs — verify locally, publish for the owner.

## Traps (more in KISERLET.md §Traps)

- `F.css` dedupes blocks by their first 60 characters: start every new block with its own comment.
- nap.js's `data-n` handler is a document capture listener that stops propagation: overrides are window
  capture listeners. Cross-domain links: `location.hash='#w-<d>-<r>'`.
- No regex lookbehind (`(?<!…)`): Safari < 16.4 fails the whole file and every experiment page falls back.
- A probe that times out on `#phone .scroll` means the page threw: `err.mjs` shows why.
- Background test runs inherit the shell's cwd; use absolute paths.

## Talking to the owner

Hungarian, business language, no file or code names. Decisions in the CLAUDE.md format (helyzet · gond ·
2–3 options table · ajánlás). Report results plainly; if something could not be met, say so.
