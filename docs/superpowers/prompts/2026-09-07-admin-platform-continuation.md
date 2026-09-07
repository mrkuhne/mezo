# Admin/observability platform — folytató prompt (friss sessionbe másolható)

> Másold be az alábbi blokkot egy friss Claude Code sessionbe a mezo repóban. Minden futtatás
> után frissítsd az „Állapot” szakaszt (mi készült el, melyik bd-issue zárult), hogy a következő
> session is innen tudjon indulni.

---

Ez a mezo repó (`/Users/mrkuhne/Applications/Personal/Mezo/mezo`). Az **admin/observability
platform** sorozatot visszük tovább, amelynek három része specelve van, az első implementálva:

| # | Rész | Spec | Epic | Állapot |
|---|---|---|---|---|
| 1 | Admin hub (`/admin/*`, `feature/admin` backend-szelet, adatböngésző) | `docs/superpowers/specs/2026-09-06-admin-hub-design.md`, terv: `docs/superpowers/plans/2026-09-07-admin-hub.md`, ADR 0038 | mezo-d5iy | **KÉSZ, mainen** (2026-09-07, PR #565) — 5 follow-up nyitva |
| 2 | RAG memory explorer (`/admin/users/:id/memory`) | `docs/superpowers/specs/2026-09-06-rag-memory-explorer-design.md` | mezo-4qyt | spec kész, **most ez a soron következő** (a mezo-d5iy függés feloldva) |
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

## Következő lépés: 2. rész (RAG memory explorer, mezo-4qyt)

1. `bd prime`, `bd show mezo-4qyt`, és olvasd el a spec-et.
2. `superpowers:writing-plans` a spec-re → `docs/superpowers/plans/<dátum>-rag-memory-explorer.md`, commit.
3. `superpowers:subagent-driven-development` a tervre, `feat/rag-explorer` ágon. A belépési pont a
   `/admin/users/:id` **„Memória" fül** — az admin hub `AdminUserDetailPage`-e már négy fület
   kezel (Aktivitás · Adatok · Feature-ök · Költség), ez lesz az ötödik.

### Amire az admin hubból építhetsz (mind a mainen)

- `feature/admin` backend-szelet: `AdminTableCatalog` (information_schema-allowlist),
  `AdminSqlDialect`, `AdminInsightsQuery`, `AdminRowQuery`, `AdminSeries.dense(...)`.
- `/admin` route-család saját `AdminLayout`-tal (bal sáv, teljes szélesség, se TabBar, se
  PhoneFrame), **lazy chunk**; `MosaicDesktop` + `Tile span={3|4|6|12}`.
- Adatréteg-minta: `frontend/src/data/admin/adminInsights{Api,Hooks,Mock}.ts` és
  `adminData{Api,Hooks,Mock}.ts`.
- Komponensek: `AdminTile` (csempénkénti hibaállapot + Újra), `Sparkline`, `MatrixGrid`,
  `DataTable`, `JsonCell`, `TablePicker`, `UserPicker`.
- Prototípus-idióma asztali vászonra: `docs/design_2.0/prototypes/src/admin-{head,body}.html`.

### Az admin hub nyitott follow-upjai (nem blokkolják a 2. részt)

`mezo-d5iy.16` valós módú betöltési állapotok · `.17` két nem-őrzött mélylink kidobja a
nem-tulajdonost · `.18` a mock sorok figyelmen kívül hagyják a lapozást/userId-t ·
`.19` duplikált segédfüggvények · `.20` az entrance újrajátszik vissza-navigáláskor

## Házirend és tanulságok (ezek nélkül elakadsz)

- CLAUDE.md + AGENTS.md szerint: bd-issue + `feat/<topic>` ág + self-PR → CI zöld →
  `gh workflow run premerge.yml -f pr=<n>` → lokális `--no-ff` merge → push. Session végén
  `node scripts/check-beads-backup.mjs --fix`, `bd dolt push`, `git push`.
- **Worktree-ben dolgozz**, soha ne `cd`-zz a primary repóba (az a mainen áll). A mainre merge-elés
  a worktree-ből is megy: `git checkout --detach origin/main && git merge --no-ff <ág> && git push origin HEAD:main`.
- Backend IT-k: mindig `-Dmezo.test.use-testcontainers=true`; ArchUnit **csak szűretlen** futásban fut.
- Frontend kapu: **mindkét módot állítsd be explicit**en — `VITE_USE_MOCK=true pnpm test` ÉS
  `VITE_USE_MOCK=false pnpm test`. A csupasz `pnpm test` környezetfüggő (unset ⇒ mock, de egy
  `.env.example`-ből másolt `frontend/.env` valósra állítja), így némán futtathatja ugyanazt kétszer.
  Az `AGENTS.md` ezt 2026-09-07-ig rosszul írta (mezo-ywvi) — javítva.
- **A teljes backend suite-ot a kontroller futtassa, soha ne subagent**: ~11 perc, és két ügynök is
  elvérzett rajta committálás nélkül. Előtte `pgrep -fl "maven|mvnw"` — két Maven ugyanabban a
  worktree-ben osztozik a `backend/target/`-en, és a `clean` kirántja a másik alól az osztályokat.
  A tünet HAMIS és ijesztő: `ClassNotFoundException` generált `$Builder` osztályokra, hiányzó
  repository bean-ek, `BeanDefinitionStoreException`. Egy korai ügynök órákig árván futtatott egyet.
- **A harness `exit 0`-jában ne bízz** — a Mavent megbukott futásra is 0-t jelenthet. Mindig a logot
  nézd: `grep -E "Tests run:.*Failures|BUILD (SUCCESS|FAILURE)"`.
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
