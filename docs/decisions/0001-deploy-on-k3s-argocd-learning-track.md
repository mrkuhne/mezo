# 0001 — Deploy mezo on self-managed k3s + ArgoCD (learning track)

- **Status:** Accepted
- **Date:** 2026-06-13
- **Driver:** mezo-ht3

## Context

mezo needs a place to run continuously so it is reachable from a phone as an installable PWA.
The naive optimization target is "easiest, cheapest, always-on", which points at a managed PaaS
(Railway) or a self-hosted PaaS (Coolify) in front of the existing `docker-compose.yml`.

A second, overriding goal emerged: **Daniel's clients at work run on Kubernetes + ArgoCD + pgAdmin**,
and building real fluency in that stack has direct career value. mezo is a good, low-stakes
practice ground for it. When learning the client stack is the priority, "easiest deploy" is the
wrong objective — the deliberately harder, transferable path is the point.

Cost note: Kubernetes, ArgoCD, and pgAdmin are all **free, open-source** software. The only cost is
the VPS RAM (k8s is memory-hungry; ~8 GB is the comfortable floor for cluster + app + DB).

## Decision

Deploy mezo on a **single Hetzner VPS running k3s**, with **ArgoCD** driving GitOps deployments and
**pgAdmin** for database inspection. Specifically:

- **One node, k3s** (lightweight single-binary Kubernetes) — real `kubectl`, real manifests, but runs
  on one ~8 GB VPS. k3s ships Traefik (ingress) and `local-path` (storage) out of the box.
- **GitOps via ArgoCD** — k8s manifests live in a git repo; pushing changes triggers an automatic sync.
- **pgAdmin private only** — reachable via Tailscale / `kubectl port-forward`, never exposed publicly.
- All container images to **GHCR** (free).

Sequence intentionally puts manual `kubectl apply` first (steps 0–3) and ArgoCD second (step 4), so the
contrast between hand-applied and GitOps-synced state is visible — that contrast is the key lesson.

## Consequences

**Makes easy / good:**
- Hands-on practice with the exact stack clients use (nodes, pods, Deployments, StatefulSets, Ingress, GitOps).
- One predictable flat monthly bill (~EUR 9–14), no usage surprises.
- Full control; nothing hidden behind a PaaS abstraction.

**Makes harder / costs:**
- Higher operational burden: OS patching, k3s upgrades, backups, cert/secret management are on us.
- More moving parts than `docker compose up` — more ways to break, which is acceptable for a learning project.
- Single node = no real HA; fine for the stated goal, not production-grade.

## Alternatives considered

- **Railway (managed PaaS)** — rejected: hides exactly the layer we want to learn; usage-based billing is unpredictable.
- **Coolify (self-hosted PaaS)** — rejected for the primary goal: docker-compose based, not Kubernetes, so it teaches little that transfers to client environments. (Still a fine option if priorities ever flip back to convenience.)
- **Managed k8s control plane (Civo / DigitalOcean)** — viable and lower cluster-ops, control plane often free, pay for nodes. Deferred: we want the full self-managed experience first; revisit if cluster maintenance becomes a distraction (would supersede this ADR).
- **Multi-node k3s cluster** — deferred: closer to production reality but ~2–3x the cost; single node is enough to learn the concepts first.
