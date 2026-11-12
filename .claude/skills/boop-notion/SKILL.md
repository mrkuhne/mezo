---
name: boop-notion
description: Keep the owner's Notion "Boop" space (Jegyek ticket board, Kézikönyv handbook, Döntések, Kiadások) true — a one-way mirror of bd (epic mezo-r36n9) + docs/boop-handbook/. Run at the end of every Boop slice (boop skill §5), whenever a Boop ticket changes state, a decision is made or something ships. Use when the user mentions Notion, the Boop kézikönyv, jegytábla, or asks to sync / update Notion.
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
| A feature appears / changes / is cut | edit its page under `docs/boop-handbook/NN-terulet/` (format: `docs/boop-handbook/README.md`): state, *Mit csinál*, *Hogyan működik*, *Beállítások*, *Adattáblák*, *Mi jön még* |

Privacy: no personal health values, ever. Examples are invented and marked „például”.

## 2. Push to Notion

```bash
node scripts/boop-notion-sync.mjs plan          # what is pending (writes docs/boop-handbook/.last-plan.json)
```

For each pending op:

- **create** — `node scripts/boop-notion-sync.mjs payload create <db> 20` prints `{parent, pages, keys}`; call
  `notion-create-pages` with that `parent` and `pages` (`allow_async: false`). The result lists the new page ids in
  the same order as `keys`; then `node scripts/boop-notion-sync.mjs record '<key>=<page-id>' ...` (quote the args —
  zsh globs `?`).
- **update** — `node scripts/boop-notion-sync.mjs payload update '<key>'` prints `{page_id, icon, properties, content}`;
  call `notion-update-page` twice: `update_properties` (properties + icon) and `replace_content` (content). Then `record`.

`<db>` is one of `jegyek`, `dontesek`, `kiadasok`, `kezikonyv`. Create in that order (tickets first, so relations
resolve). Rows created in the same pass carry their relations on the **next** `plan` as updates — repeat
`plan → apply → record` until `node scripts/boop-notion-sync.mjs check` exits 0. Large passes (the whole handbook)
go to a subagent with this skill as its brief.

`plan` also warns about bd issues missing an overlay row and about orphans (rows in Notion whose source is gone:
archive them in Notion, then delete the record from `_notion-state.json`).

## 3. Commit

`_notion-state.json` (page ids + hashes) and the source files are committed with the slice; `.last-plan.json` is
gitignored. Commit message carries the driving bd id.
