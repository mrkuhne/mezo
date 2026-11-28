---
name: munkamenet
description: Session lifecycle for this repo — every piece of work is a SERIES with one fő session (the one the owner talks to) and its al-sessions linked under it, consistent titles, and a fixed Hungarian záró blokk at every session end (hol tartunk, mi a következő, hol és milyen prompttal folytasd), so the owner can always follow what runs where. Modes - kezdés (start a task / series), lezárás (finish or hand off), takarítás (cleanup + "hol tartok" overview). Use when the owner starts a new piece of work ("csináljuk X-et", "kezdjük", "új feladat"), when a task is done or the session-length guard fires ("zárjuk le", "kész", "add át"), or when he asks what runs / where things stand / to clean up ("takarítás", "mi fut még", "hol tartok", "rendet").
---

# Munkamenet — one series, one fő session, short al-sessions (mezo-lwsig → mezo-g641l → mezo-vmqwc)

Why: every API call re-reads the whole conversation, so sessions stay short (token diet, mezo-hsc75). But the owner
must be able to **follow** the work: on 2026-11-28 ~30 sessions were open, successors were detached, sessions archived
themselves, and he could not tell which one did what or where yesterday's work continues (mezo-vmqwc). So: short
sessions, but always **in one tree per series, with predictable names and a written way back in**. Talk to the owner
in Hungarian business language (CLAUDE.md §Communication).

Pick the mode from the request: **kezdés** · **lezárás** · **takarítás**. The `session-length-guard` hook may tell you
to switch to **lezárás** mid-task — do that at the next safe point (tests green or work committed), never mid-edit.

## The tree — fő session and al-sessions (owner rule, 2026-11-28)

- **Series** = one piece of work the owner asked for (a feature, a slice, a bug) with all its steps.
- **Fő session** = the session in which the owner started the series. It is where he talks: brainstorm, spec, spike,
  plan, decisions, the final report. It does **not build** once the plan is approved — every build step runs in an
  **al-session** it starts. It stays open until the series ends.
- **Al-session** = one step, started by the fő session with `start_session` (`initiation: "user_asked"`,
  `context: "fresh"`, `use_worktree: true`). **Never detach it** — the link is what lets the owner see it under the fő
  session. An al-session **never starts sessions itself** (no grandchildren): when it needs a successor, it says so in
  its záró blokk and the fő session starts the next one.
- **Thin fő session (the token price of the tree):** when an al-session reports back, the fő session answers in at
  most two lines — note it, start the next step if the plan says so, or ask the owner — and reads nothing else. No
  code, no logs, no file reads in the fő session after the plan OK. If the fő session itself hits the guard, it writes
  its záró blokk (with the prompt for a new fő session) and stops; it does not archive while an al-session still runs.
- **Parallel al-sessions** only when they touch different files (playbook §5.3). Max ~3 at once.
- A request that is **not part of this series** (new feature, unrelated bug) is a new series: it gets its own fő
  session, which is the one place `detach_session` is still right (start it, detach it, tell the owner in one line).

## Names — always the same shape

Set the title at start (`start_session` `title`, or `set_session_title` with `"self"` for a fő session the owner
opened). Hungarian, no ids, no "Mezo", ≤ 50 characters:

| Kind | Shape | Example |
|---|---|---|
| Fő session | `<Terület> — <sorozat>` | `Sport — terület újratervezés` |
| Al-session | `<Terület> <n>/<össz> · <lépés>` | `Sport 3/5 · Ma fül + rögzítés` |
| Folytatás of a step | same step, `+` suffix | `Sport 3/5+ · Ma fül + rögzítés` |
| Lezárás-only step | `<Terület> · lezárás` | `Sport · lezárás` |

`<Terület>` is the handbook area (Ma, Étel, Edzés, Sport, Terv, Napló, Levél, Évad, Alapok …). `<n>/<össz>` comes from
the plan's step list (`?` when unknown). The fő session also files itself and every al-session into **one sidebar
group** named `<Terület> — <sorozat>` (`create_group` once, then `move_sessions`; if the app asks the owner, that is
fine — ask once per series).

## Záró blokk — mandatory at every session end

Every session that stops — done, handing off, guard fired, waiting for the owner, or blocked — ends its **last
message** with this block, in Hungarian, filled in (no placeholders left). The same text goes into the bd issue
(`bd update <id> --notes`), so it survives the session.

```
**Hol tartunk** — <sorozat> (<n>/<össz> lépés kész)
- Kész: <1–3 pont, amit a tulaj érez>
- Nincs kész: <1–3 pont, vagy „semmi”>

**Mi a következő** — <egy mondat: a következő lépés, és ki lép: új al-session / te döntesz / semmi>

**Hol folytasd** — <session-link, vagy „a fő session indítja: [<fő session címe>](#local_…)”, vagy „új fő session”>

**Prompt a folytatáshoz** (ha új sessiont kell nyitni, ezt másold be):
> Folytasd a <bd-id> munkát a <ág> ágról. Előbb olvasd el: `bd show <bd-id>` (jegyzet). Csak ezt csináld: <lépés>.
> A munkamenet skill szerint zárd le, záró blokkal.

**Ez a session** — lezárva / nyitva marad, mert <ok>
```

An al-session's `wrap_up` recap starts with `ÁTADÁS:` or `KÉSZ:` plus the next step in a few words, because the fő
session only sees the first 400 characters of it.

## Kezdés — start one task

1. **Which session?**
   - The owner starts something new in a fresh session → this is the **fő session** of a new series: set the title
     and the group (§Names).
   - This session is a fő session and the plan says "next step" → start the al-session (§The tree) with a brief:
     the bd id, the branch, the one step, "finish with the munkamenet skill (lezárás) and its záró blokk".
   - This session already finished a different task, or is long (guard fired, past ~100 turns) → new series: start
     a fresh fő session, detach it, tell the owner in one line where it runs.
2. **One bd issue.** Find (`bd search`, `bd ready`) or create the issue; claim it. Boop work goes under epic
   `mezo-r36n9` with its `_jegyek.json` row (edit the source now; the Notion push waits for the end of the series).
   A long series: one issue per step, children of the series issue.
3. **Memories, narrowly.** `bd memories <keyword>` for the 1–3 areas you will touch. No full list unless unsure.
4. **Kész, ha…** Write the done-checklist into the issue (`bd update <id> --acceptance "..."`), per CLAUDE.md.
5. Then the flow below, or straight to work for a small fix (a small fix may be built in the fő session itself — no
   al-session for a ≤ 25-step job).

## The flow — superpowers inside the frame (mezo-dl3h3)

1. `superpowers:brainstorming` — step 1 = `brainstorm-recon`; no Visual Companion for Boop (visual iteration is the
   simulator's job). *(fő session)*
2. Spec in `docs/superpowers/specs/` → owner OK. *(fő session)*
3. Simulator spike → owner OK (only when something visible changes). *(fő session, or an al-session for a big spike)*
4. `superpowers:writing-plans` (with the *Kész, ha…* list, and the steps numbered n/össz) → owner OK. *(fő session)*
5. Execution: each plan step in an al-session, inline `superpowers:executing-plans` there.
   `superpowers:subagent-driven-development` is opt-in, only for a large step with clearly independent tasks — then
   every dispatch passes `model: "sonnet"`, no per-task reviewer agents unless the plan marks the task risky, and one
   final fresh-context review on the most capable model.
6. `superpowers:verification-before-completion` — tick every *Kész, ha…* item with evidence.
7. **Lezárás** (below). It replaces `superpowers:finishing-a-development-branch`: if that skill triggers, follow
   lezárás instead — no PR, no discard menu; local `--no-ff` merge per CLAUDE.md §Git Workflow.

Working rules while in the task: subagents on `model: "sonnet"` (most capable only for the final review / hard
design); read narrowly (`sed -n`, `grep`, `tail` on long output; in an al-session read only your step's section of the
plan); no Notion MCP calls outside the `boop-notion-sync` worker.

## Lezárás — finish, or hand off

Replaces `superpowers:finishing-a-development-branch` (no options menu, no PR, no discard). **Every path ends with the
záró blokk.**

**First decide: finish here, or hand off?** If all that is left is the close-out (merge, deploy/install, Notion,
report) or anything else of **about 25 steps or fewer**, finish here — even if the guard fired. Only a bigger
remainder goes to **B**.

Notion is pushed **once per series**, by the session that finishes the series (usually the last al-session, or the
fő session when the series stops to wait for the owner) — never by a session that hands off.

**A. My step is done** (gates green):
1. Merge per CLAUDE.md §Git Workflow (rebase main → `--no-ff` merge → push → delete branch); deploy/install if the
   change needs it.
2. `bd close <id>`; file remaining work as new bd issues (minors under the epic).
3. If this was the **last step of the series** and the product changed → update the sources (`_jegyek.json`,
   `_kiadasok.json`, `_dontesek.json`, handbook page, `_funkciok.json`), commit and push, then push Notion once: the
   `boop-notion-sync` agent → commit `_notion-state.json` → push → `unlock` (`boop-notion` skill §2).
4. `node scripts/check-beads-backup.mjs --fix` → commit; `git pull --rebase && bd dolt push && git push`.
5. Hungarian report (what he can now do, what was checked) **+ záró blokk**.
6. Archive: an **al-session** archives itself (`archive_session` `"self"`) after the report — the fő session keeps
   the record. The **fő session** archives itself only when the whole series is done and no al-session of it is
   still open (archiving a parent takes its idle children with it). Not when the owner asked to keep it open.

**B. Hand off** (more than ~25 steps left in my step):
1. Commit and push the branch (never leave work only in the worktree).
2. Write the handoff into the bd issue (`bd update <id> --notes "..."`, playbook §5.4 template) — branch, done,
   next, traps, exact commands, Notion sources still waiting.
3. **Al-session:** do **not** start a successor. Write the záró blokk (Hol folytasd = „a fő session indítja”), recap
   `ÁTADÁS: <step>+`, archive yourself. The fő session, on that note, starts the `+` al-session with the prompt from
   the block.
   **Fő session** (it was building a small fix that grew): start the al-session yourself (linked, not detached),
   write the záró blokk, and stay open as the thin fő session.
4. If the app refuses a start (the turn came from another session or an event), leave the proposal card, write the
   záró blokk with the prompt, and stop.

## Takarítás — cleanup and "hol tartok" (weekly, or on request)

1. `list_sessions` (limit 50, Mezo only) and, for each Mezo worktree, the unmerged work:
   ```bash
   git fetch -q origin && git worktree list --porcelain | awk '/^worktree/{w=$2}/^branch/{print w" "$2}' | \
     while read w b; do echo "$(basename $w) ${b#refs/heads/} unmerged=$(git rev-list --count origin/main..${b#refs/heads/}) dirty=$(git -C "$w" status --porcelain | grep -vc '^??')"; done
   ```
   Group the sessions **by series** (`startedBy` → fő session; titles; bd ids in the briefs).
2. Sort every idle session into: **lezárható** (no unmerged commits, nothing dirty), **befejezendő** (unmerged work —
   near done → one message "fejezd be és zárd le a munkamenet skill szerint, záró blokkal"; far from done → a `+`
   al-session from its branch under the series' fő session), **vár rád** (waiting on an owner decision).
3. Show the owner **one table per series** (session · hol tart · javaslat) and ask once. On his yes, archive the
   lezárható ones, rename stray titles to the §Names shape, file them into the series group. Never archive a fő
   session whose al-session still has unmerged work. Sessions of other projects are not yours — leave them.
   **Trap (2026-11-28):** archiving one session also archives every *idle linked* session of its family — not only
   its own children (archiving a stray "Következő lépések" session took the Sport fő session with it, and the
   classifier refused the unarchive). So archive **leaves one by one** and never a session that is linked to one
   that must stay open; when in doubt, `get_session` → `parentSessionId` first.
4. Report what was archived and what is left, ending with a záró blokk per still-open series; verify the
   befejezendő branches still exist.
5. `node scripts/boop-notion-sync.mjs check` — if something waits and no series that owns it is still running, push
   it once (`boop-notion` §2).

## Feladattípusok — the playbook

`playbook.md` (next to this file, Hungarian) holds the per-type flow for Boop: §2 small change, §3 bug, §4 new
screen / UI, §5 long slice (one step per al-session, handoff template), §6 server feature into the app, §7 research /
refactor, §8 scouting before building, §9 the UX/UI + performance bar, §10 token rules.
At kezdés, pick the type from its §1 table and read **only that section plus §9** (`sed -n` by heading).

**Scouting is mandatory** (playbook §8, `researcher` agent on sonnet, in the background) for: a new screen or
interaction, a new platform technique (widgets, notifications, Watch, HealthKit, background work), a bug that smells
like platform behaviour, and any performance work — not only inside brainstorming.
