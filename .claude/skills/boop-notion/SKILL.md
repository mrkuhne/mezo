---
name: boop-notion
description: Keep the owner's Notion "Boop" space (Jegyek ticket board, Kézikönyv handbook, Döntések, Kiadások) true — a one-way mirror of bd (epic mezo-r36n9) + docs/boop-handbook/. Push once at the end of a work series (boop skill §5, munkamenet lezárás); ticket states, decisions and releases are edited in the sources as they happen. Use when the user mentions Notion, the Boop kézikönyv, jegytábla, or asks to sync / update Notion.
---

# Boop → Notion sync

The owner reads the Boop programme in his Notion, in Hungarian: a Jira-like ticket board, a handbook of every
section / feature / small feature (with settings and data tables), the decision log and the release log.
**Notion is a one-way mirror.** The machine of record is **bd** (tickets) and **`docs/boop-handbook/`** (everything
else). Never hand-edit the Notion rows — change the source, then sync. Writes happen through the **Notion MCP tools**
(no API token lives in the repo; never ask the owner for one). If the Notion tools are missing, show the connector
card (`mcp__mcp-registry__suggest_connectors`, Notion `69f3a300-cc60-48c4-b237-dfac56530dbf`) and ask him to connect.

Space root: Notion page **Boop** (`docs/boop-handbook/_notion-state.json` → `notion.pages.home`). The four databases
live under *Adatbázisok (ne nyúlj hozzá)*; the dashboard pages (Jegyek, Kézikönyv, Döntések, Kiadások) show linked views.

## 1. Update the sources

| What happened | Edit |
|---|---|
| New Boop bd issue | add a row to `docs/boop-handbook/_jegyek.json` (cim, tipus, szakasz, terulet, mit_kapsz, optional munkamenet/szulo/leiras) — Hungarian, business language, no ids/files in the text |
| Ticket state that bd can't express | `bd label add <id> allapot:<slug>` — slugs: `kesobb tervezes indulhat epul ellenorzes elesitesre-var var-rad elesben lezarva elvetve` (remove the old label). Defaults: in_progress→Épül, open→Később, blocked→Vár rád, closed→Élesben (Kutatás/Apróságok/Karbantartás→Lezárva) |
| Session works on it | `munkamenet` in the overlay row (the session's short name) |
| Owner decision | new entry in `_dontesek.json` (key never changes) — mirror of `docs/superpowers/research/boop-standalone/14-decisions.md` + spec decisions |
| Merge to main the owner can feel | new entry in `_kiadasok.json`, key = merge commit short sha; `verzio` = the release tag if the backend shipped |
| A server feature reaches the app, a slice starts building it, or a new backend feature lands | its row in `docs/boop-handbook/_funkciok.json` (Szerverfunkciók — the rebuild tracker): `app` = `Kész` · `Részben kész` · `Épül` · `Tervben` · `Nincs még` · `Nem kell`, plus `app_megjegyzes`, `jegyek`, `kezikonyv`. `terulet` is one of the eight areas in the script (`FEATURE_AREAS`) |
| A feature appears / changes / is cut | edit its page under `docs/boop-handbook/NN-terulet/` (format: `docs/boop-handbook/README.md`): state, *Mit csinál*, *Hogyan működik*, *Beállítások*, *Adattáblák*, *Mi jön még* |

Privacy: no personal health values, ever. Examples are invented and marked „például”.

## 2. Push to Notion — once per series, one at a time, in the slim worker (mezo-hsc75, mezo-g641l)

Every Notion call made in the main session re-reads the whole (often 200k+ token) conversation, and two syncs running
side by side once created the same rows twice. So:

- **Once per series.** Editing the sources (§1) is cheap — do it as things happen. **Push once**, in the session that
  finishes the work (the last one of a handoff chain), or when the series stops to wait for the owner. A session that
  hands off does not push, and a lag found at session start is not paid first: the next series end pushes everything.
- **From main.** Merge and push the sources first; sync from a worktree that is at `origin/main`.
- **One at a time.** The script holds a machine-wide lock: `payload` refuses without it, `lock` refuses a state file
  that is behind `origin/main`, and `unlock` refuses until the new page ids are pushed.
- **Delegate.** The main session never calls the Notion MCP tools itself. Dispatch one fresh worker:
  `Agent(subagent_type: "boop-notion-sync", description: "Boop Notion sync", prompt: "Sync from <worktree path>.")`
  (only if that agent type is missing or reports no Notion tools: `general-purpose` with `model: "sonnet"` and "follow
  `.claude/skills/boop-notion/SKILL.md` §2"). A worker that stalls is resumed with `SendMessage`, not re-dispatched.
- **Publish and release** — the main session, right after the worker reports `check` exit 0:

```bash
git add docs/boop-handbook/_notion-state.json && git commit -m "chore(boop): Notion sync (<bd id>)" && git fetch -q origin && git rebase origin/main && git push origin HEAD:main && node scripts/boop-notion-sync.mjs unlock
```

The worker's loop:

```bash
node scripts/boop-notion-sync.mjs lock --wait 10  # first; waits while another sync runs
node scripts/boop-notion-sync.mjs plan            # what is pending (writes docs/boop-handbook/.last-plan.json)
```

`lock` exit 4 = the state file is behind: `git merge --ff-only origin/main`, then lock again. Exit 3 = still held by
another sync: stop and report who holds it. `unlock --force` is only for a dead sync whose Notion rows you have
checked by hand.

For each pending op:

- **create** — `node scripts/boop-notion-sync.mjs payload create <db> 20` prints `{parent, pages, keys}`; call
  `notion-create-pages` with that `parent` and `pages` (`allow_async: false`). The result lists the new page ids in
  the same order as `keys`; then `node scripts/boop-notion-sync.mjs record '<key>=<page-id>' ...` (quote the args —
  zsh globs `?`).
- **update** — `node scripts/boop-notion-sync.mjs payload update '<key>'` prints `{page_id, icon, properties, content}`;
  call `notion-update-page` twice: `update_properties` (properties + icon) and `replace_content` (content). Then `record`.

`<db>` is one of `jegyek`, `dontesek`, `kiadasok`, `kezikonyv`, `funkciok`. Create in that order (tickets first, so relations
resolve). Rows created in the same pass carry their relations on the **next** `plan` as updates — repeat
`plan → apply → record` until `node scripts/boop-notion-sync.mjs check` exits 0.

`plan` also warns about bd issues missing an overlay row and about orphans (rows in Notion whose source is gone:
archive them in Notion, then delete the record from `_notion-state.json`).

## 3. Commit

The source files are committed and merged with the slice; `_notion-state.json` (page ids + hashes) is committed and
pushed right after the sync (§2), before `unlock`. `.last-plan.json` is gitignored. Commit messages carry the bd id.
