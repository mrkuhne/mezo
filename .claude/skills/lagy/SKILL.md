---
name: lagy
description: Use when the user invokes /lagy, or asks to continue the "Lágy" direction, rebuild the next domain or page of the Mezo prototype in the new look (Nap, Edzés, Mezo, Én, or any inner page / sheet), or "csináljuk meg a következő oldalt", "menjünk tovább a Napra", "aloldalak", after a compaction mid-way through that work.
---

# Lágy — the owner-approved app look, page by page

The owner chose direction **Lágy** on 2026-11-04 after months of searching, and built Fuel with us at app
fidelity. This skill carries everything learned there so every other page lands in the same language
without re-litigating it. **The canon is [`IRANY.md`](IRANY.md) in this folder — read it in full at the
start of every session.** Fuel (`docs/design_2.0/prototypes/kepes/b/`) is the executable reference: when
in doubt, do what Fuel does.

Driving issue: `mezo-pi0jf` (comments carry every round). The app does not change in this work — only the
prototype and its docs, on branch `claude/mai-napom-custom-graphics-eedeb2`, pushed, never merged.

## Resume (every invocation, before anything else)

1. Read `IRANY.md` (all of it) and `docs/design_2.0/prototypes/kepes/README.md` (version log, newest last).
2. `bd show mezo-pi0jf` → the newest comments say which domain / page is done and what is next.
3. `git status` clean, `git log --oneline -5`. Worktree rules: never cd to the primary repo, never bare
   `git stash`.
4. Server (background): `python3 -m http.server 8757 --bind 127.0.0.1` from `docs/design_2.0/prototypes`
   (check `lsof -iTCP:8757 -sTCP:LISTEN` first). App: `http://127.0.0.1:8757/kepes/b/…`.

## One link, five domains

The whole app lives on **one** Artifact: https://claude.ai/artifact/EEf8oNUm6EDeFkaTkmhpKe (slug
`6b2ef909-0e57-49b0-a848-3117c146dcb5`). The bottom bar's five domains all work there.

- **Round 0 (once, before the first new domain):** split `b/fuel.html` into a shell + per-domain files
  without changing a pixel of Fuel: `b/index.html` (tokens, shared CSS, shared builders, router, sheets
  host, bottom bar), `b/fuel.js`, then `b/nap.js`, `b/edzes.js`, `b/mezo.js`, `b/en.js`. Hash prefix per
  domain (`#fuel`, `#fuel-kieg`, `#nap`, `#nap-…`); default route = Nap (the app opens on today);
  old Fuel hashes keep working. Re-run every Fuel probe after the split — identical results or it is not
  done. Publish with all files (`index.html`, the `*.js`, `foto/*` already there).
- **Order:** Nap → Edzés → Mezo → Én. One domain per round; Mezo may take two.

## The round (one domain)

1. **Recon, never invent:** list the domain's tabs, inner pages and sheets from the live app's feature doc
   (`docs/features/README.md` → the domain's doc) and the frozen Üveg prototype
   `docs/design_2.0/prototypes/elo/<domain>.html` (every control, state and field = the parity list).
   Pull real *shapes* of data from prod if needed (SELECT only, never copy personal data into the page).
2. **Play back in chat first** (Hungarian, business words, one screen): per tab — the photo, the one
   sentence, the one action, the deep-green card's number, the sections. Owner OK before building.
3. **Build** tab by tab, then every inner page and sheet, each against the golden rule (IRANY §3).
4. **Verify** every page (IRANY §13) with evidence; fix; re-verify.
5. **Log + ship:** README version entry, commit (`docs(prototype): Lágy — … (mezo-pi0jf)` + attribution),
   push over HTTPS (`git -c credential.helper='!gh auth git-credential' push https://github.com/mrkuhne/mezo.git HEAD:refs/heads/claude/mai-napom-custom-graphics-eedeb2`),
   bd comment, publish (`get_artifact` for the live version → `publish_files` with `base_version`).
6. **Report in Hungarian** (IRANY §15) and **stop and wait**. Owner corrections become IRANY entries
   (§12 for rejected ideas, the relevant section for new rules) in the same commit as the fix.

## Red flags — stop and re-read IRANY

| Thought | Reality |
|---|---|
| "It's only an inner page / sheet, plain rows are fine" | The golden rule covers every page and sheet. The owner caught exactly this. |
| "A drawn scene would make the hero richer" | The photo is the hero. Scenes as a second hero were removed on owner request. |
| "I'll show the photo as a nice card at the top" | Boxed photo cards read forced. The photo is the page top, edge to edge. |
| "A new graphic idea for these numbers" | Ring + bars / level tubes / three-column card first. Vessels and bowls were rejected. |
| "Grey helper text explains it" | No grey helper text; Mezo says it, or it goes. |
| "kcal is shorter" | "kalória", always. No abbreviations. |
| "The old test fails, the page must be fine" | Update the test to the new structure, then rerun; never skip it. |
| "Looks right in my head, publish" | Screenshot at 390 and 320 and look at it first. |
