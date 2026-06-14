# mezo — Roadmap & Milestone Log

High-level "where are we" timeline. Update this whenever a phase/slice ships or the direction shifts.
Detail lives elsewhere (`decisions/`, `infrastructure/`, `superpowers/`); this is the index over time.

## Phases

- **Phase 1 — Frontend (mock data):** ✅ done. React 19 + Vite + Tailwind v4, Hungarian UI, 6 vertical slices on a mock data layer.
- **Phase 2 — Core data backend:** 🔄 in progress. Java / Spring Boot 4 + PostgreSQL behind the same `src/data/hooks.ts` boundary.
  - Slice A (foundation + auth + biometrics + TanStack Query): ✅ done
  - Slice B (Train): ✅ done
  - Slice C (Fuel) → D (Insights seed) → E (People): ⏳ remaining
- **Phase 3 — AI brain:** 🔜 later. Spring AI, pgvector, RAG, pattern/companion pipeline.

## Cross-cutting tracks

- **Deployment / infra (learning track):** 🔄 planned — self-managed k3s + ArgoCD + pgAdmin on a single Hetzner VPS.
  Driver `mezo-ht3`. See [ADR 0001](../decisions/0001-deploy-on-k3s-argocd-learning-track.md) and
  [deployment architecture](../infrastructure/deployment-k3s-argocd.md). Goal doubles as hands-on practice
  with the stack Daniel's clients use.

## Milestone log

| Date | Milestone |
|---|---|
| 2026-06-13 | Deploy direction decided: self-managed k3s + ArgoCD + pgAdmin (learning track). ADR 0001 + infra doc written. `docs/` decision/infra/milestone structure established. |
| 2026-06-14 | Deploy steps 0-2 done: Hetzner VPS hardened + Tailscale, k3s installed, full mezo (Postgres + backend + frontend) live on k8s at `https://46.225.112.172.sslip.io/` with Let's Encrypt HTTPS. `k8s/` manifests + Dockerfiles committed. Pending: pgAdmin (step 3), ArgoCD/GitOps (step 4). |
