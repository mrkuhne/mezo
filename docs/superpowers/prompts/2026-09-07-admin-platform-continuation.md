# Admin/observability platform — folytató prompt (friss sessionbe másolható)

> Másold be az alábbi blokkot egy friss Claude Code sessionbe a mezo repóban. Minden futtatás
> után frissítsd az „Állapot” szakaszt (mi készült el, melyik bd-issue zárult), hogy a következő
> session is innen tudjon indulni.

---

Ez a mezo repó (`/Users/mrkuhne/Applications/Personal/Mezo/mezo`). Az **admin/observability
platform** sorozatot visszük tovább, amelynek három része specelve van, az első implementálva:

| # | Rész | Spec | Epic | Állapot |
|---|---|---|---|---|
| 1 | Admin hub (`/admin/*`, `feature/admin` backend-szelet, adatböngésző) | `docs/superpowers/specs/2026-09-06-admin-hub-design.md` | mezo-d5iy | spec kész, **terv + implementáció hátra** |
| 2 | RAG memory explorer (`/admin/users/:id/memory`) | `docs/superpowers/specs/2026-09-06-rag-memory-explorer-design.md` | mezo-4qyt (függ: mezo-d5iy) | spec kész, 1. után |
| 3 | Infra observability (VictoriaMetrics/Logs, Grafana, riasztás) | `docs/superpowers/specs/2026-09-06-infra-observability-design.md`, terv: `docs/superpowers/plans/2026-09-06-infra-observability.md`, ADR 0037 | mezo-ibxy | **KÉSZ, mainen** (2026-09-07) |
| 4 | Feature-telemetria | nincs spec | — | csak ha kell |

## Ami a 3. részből még nyitva (először ezeket zárd le)

1. **Telegram bekötése**: a `monitoring/alertmanager-config` Secret ma blackhole receiverrel van
   lepecsételve. Ha `/tmp/mezo-telegram` (két sor: `bot_token=…`, `chat_id=…`) létezik, töltsd ki
   a `k8s/monitoring/secret.example-alertmanager.yaml` sablont, pecsételd `kubeseal`-lel a
   `k8s/monitoring/sealedsecret-alertmanager.yaml`-be (recept: runbook §4 Observability), commit
   feat-ágon, PR, merge; utána teszt-riasztás Alertmanager API-n (terv Task 7 Step 3).
2. **Ellenőrzés a merge utáni első napon**: vmagent-targeteknél a `backend` legyen `up`
   (management-port 8081 az új image-ben), `LogErrorBurst` és a Grafana log-panel adjon adatot
   (`| unpack_json`), backend working-set az 1 Gi limit alatt maradjon (`-XX:MaxRAMPercentage=60`).
3. Follow-up issue: mezo-gloh (GHCR tag-retention workflow).

## Következő lépés: 1. rész (admin hub)

1. `bd prime`, majd `bd show mezo-d5iy` és olvasd el a spec-et.
2. `superpowers:writing-plans` a spec-re → `docs/superpowers/plans/2026-09-07-admin-hub.md`
   (szeletek a spec §Slices szerint: backend insights → adatböngésző backend → prototípus +
   shell + oldalak → adatböngésző UI → átköltöztetés + docs). Commit, majd
   `superpowers:subagent-driven-development` a terv végrehajtására, `feat/admin-hub` ágon,
   saját worktree-ben. A prototípus (`docs/design_2.0/prototypes/admin-hub.html`) kötelező a
   design 2.0 nyelven, desktop-first 12 oszlopos mozaik.
3. Utána ugyanez a 2. részre (RAG explorer, mezo-4qyt).

## Házirend és tanulságok (ezek nélkül elakadsz)

- CLAUDE.md + AGENTS.md szerint: bd-issue + `feat/<topic>` ág + self-PR → CI zöld →
  `gh workflow run premerge.yml -f pr=<n>` → lokális `--no-ff` merge → push. Session végén
  `node scripts/check-beads-backup.mjs --fix`, `bd dolt push`, `git push`.
- **Worktree-ben dolgozz**, soha ne `cd`-zz a primary repóba (az a mainen áll). A mainre merge-elés
  a worktree-ből is megy: `git checkout --detach origin/main && git merge --no-ff <ág> && git push origin HEAD:main`.
- Backend IT-k: mindig `-Dmezo.test.use-testcontainers=true`; ArchUnit csak a sima `./mvnw test`-ben fut.
  Frontend: `VITE_USE_MOCK=true` ÉS `=false` módban is tesztelj (unset = mock).
- Kontraktus-lánc: `api/feature/<x>/*.yml` → `api/generate/merge.yml` → `npm run generate:api` →
  `pnpm generate:api` → backend generált `<Tag>Api`; a codemap-gate (`node scripts/gen-codemap.mjs --check`)
  minden új csomagnál regenerálást kér.
- Subagent-driven development ebben a környezetben: a `SendMessage` NEM elérhető → egy megállt
  vagy javítandó implementálót friss ügynökkel folytass (brief + report fájl + a találatok). Az
  auto-mode klasszifikátor blokkolja az olyan ügynök-indítást, ami ssh+sudo+restartot tartalmaz →
  a host-oldali lépéseket a kontroller futtassa inline. A recon (`brainstorm-recon`) és a reviewok
  jól mennek háttér-ügynökként.
- Cluster: `export KUBECONFIG=~/.kube/mezo-k3s.yaml`; SSH `ssh -i ~/.ssh/id_mezo_hetzner deploy@100.75.51.113`
  (Tailscale SSH böngészős check-int kérhet). `~/.local/bin`-ben: kubectl, kubeseal, helm 4, kubeconform.
  A `monitoring` ArgoCD Application kézzel alkalmazott: values-ágon végzett munka után merge →
  `kubectl apply -f argocd/monitoring-application.yaml` → csak utána töröld az ágat.
- Párhuzamos sessionök tolják a maint (tucatnyi release/nap): merge előtt mindig
  `git merge origin/main` az ágba, a `.beads/issues.jsonl` konfliktust a backup-szkript regenerálásával oldd.
