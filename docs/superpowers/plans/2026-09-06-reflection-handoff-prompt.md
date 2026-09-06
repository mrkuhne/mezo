# Reflexió (mezo-eq85) — handoff prompt for a fresh session

Paste the block below into a new Claude Code session opened on `main` (or a worktree cut from
`main`). It is self-contained: the session reads the spec and the plan, picks the next open
slice, and runs it through the house workflow. Re-paste it in another fresh session for the
next slice; it always continues from the first open child of `mezo-eq85`.

---

```text
Folytasd a Reflexió epik (mezo-eq85) implementálását a ház szabályai szerint.

Kontextus:
- Spec: docs/superpowers/specs/2026-09-06-reflection-self-discovered-patterns-design.md (jóváhagyva)
- Terv: docs/superpowers/plans/2026-09-06-reflection-self-discovered-patterns.md — tizenkét task, mindegyik egy bd gyerek issue: mezo-eq85.1 … mezo-eq85.12, ebben a sorrendben, egymásra épülve (Part A: .1–.6 Reflexió; Part B: .7–.12 memória-platform minden emlékező AI-felületre). A .11-nek előfeltétele van (egy hét NEW chat visszaesés nélkül) — ha nem teljesül, ugord át a .12-re és jelezd.
- Vizuális igazság: docs/design_2.0/prototypes/eszrevetelek.html (v1, változtatás nélkül jóváhagyva)
- A tervnek van egy "Global Constraints" és egy "File and interface map" szakasza — mindkettő minden taskra érvényes

Mit csinálj:
1. `bd prime`, majd `bd list --parent mezo-eq85`. A LEGELSŐ open (nem closed) gyerek issue a tiéd. Ha az előző szelet még in_progress és nincs mergelve a main-en, állj meg és jelezd.
2. `git pull --rebase` a main-en, majd `git checkout -b feat/reflexio-s<N>` (N = a szelet száma). `bd update <id> --claim`.
3. Használd a superpowers:subagent-driven-development skillt a terv "Task N" fejezetére: lépésről lépésre, TDD, gyakori commit, a commit-üzenetben a bd id (pl. `feat(companion): … (mezo-eq85.1)`).
4. Minden lépésnél a terv kódja a kiindulás, de a valós fájlokat olvasd el, mielőtt módosítod — a terv path:line hivatkozásai a 2026-09-06-i main-re mutatnak.
5. Ne írj LLM-válaszból pattern.status-t, belief-et, knowledge_fact-ot vagy memory_item.salience-t — ez a spec kemény szabálya.
6. Kapuk zárás előtt (superpowers:verification-before-completion): backend fókuszált ITek + ArchitectureTest (`./mvnw test -Dtest=… -Dmezo.test.use-testcontainers=true` a backend/ mappából), frontend mindkét mód (`pnpm test` és `VITE_USE_MOCK=false pnpm test`) + `pnpm build`, contract-drift (fragment + `api/openapi.yml` + `api.gen.ts` egy commitban), `node scripts/gen-codemap.mjs`, `node scripts/lint-docs.mjs --errors-only`, Liquibase lint ha van migráció.
7. Docs: a task által érintett docs/features/*.md frissítése (companion.md mindig; insights.md / today.md / proactive.md / _platform-notifications.md ahol a terv mondja).
8. `git push -u origin feat/reflexio-s<N>`, self-PR (`gh pr create`, a PR-leírás végén: 🤖 Generated with [Claude Code](https://claude.com/claude-code)), várd meg a CI-t (`gh pr checks <n> --watch`). Zöld után: `git checkout main && git pull --rebase && git merge --no-ff feat/reflexio-s<N> && git push && git branch -d feat/reflexio-s<N>`.
9. `bd close <id>` egy rövid összefoglalóval (mi készült, mi tér el a tervtől és miért). `bd dolt push`. `git status` legyen "up to date with origin".
10. A végén írj egy rövid handoffot: mi készült, mi a következő szelet, van-e nyitott kérdés a terméktulajdonosnak.

Ha a terv és a kód között ellentmondást találsz, a kód a valóság: igazítsd a megoldást, jegyezd fel a bd issue-n kommentként, és menj tovább. Ha egy döntés terméktulajdonosi (pl. a spec §1 döntéseinek megváltoztatása), ne dönts helyette — állj meg és kérdezz.

Ha az összes gyerek issue closed, zárd le a mezo-eq85 epiket a spec §11 elfogadási kritériumainak végigjárásával, és ellenőrizd a terv két záró kapuját ("Final integration gate (Part A)" és "Part B final gate").
```
