# 0011 — Public repository for free GitHub Actions CI

- **Status:** Accepted
- **Date:** 2026-07-14
- **Driver:** mezo-05v6 (PR #15 CI outage)

## Context

The project's quality gate depends on GitHub Actions: the 16 GB dev machine cannot run the
full backend integration suite locally (SpringBoot + Testcontainers OOM), so `ci.yml` on a
clean `ubuntu-latest` runner is the **authoritative full-suite gate** before every merge
(see [`docs/infrastructure/local-dev-testing.md`](../infrastructure/local-dev-testing.md)).

On 2026-07-14, PR #15's CI refused to start: *"The job was not started because recent
account payments have failed or your spending limit needs to be increased."* The repo was
**private**, so Actions minutes were metered (Free plan: 2000 min/month included, `$0`
default spending limit); the heavy backend suite across many recent PRs exhausted the
budget. Every merge was blocked on a billing knob.

Options considered:

1. **Make the repo public** — Actions on standard runners becomes free and unlimited.
2. **Self-hosted runner** on the existing Hetzner CX33 (8 GB) — repo stays private, but the
   box already runs k3s + the app + Postgres; RAM headroom for the IT suite is doubtful,
   and it adds a maintenance surface.
3. **Pay** (raise the spending limit) — recurring cost for a hobby project.
4. **Wait for the monthly reset** — recurring outage instead.

## Decision

**Make `mrkuhne/mezo` public** (option 1). Zero cost, zero maintenance, unlimited standard
runners, effective immediately (`gh repo edit --visibility public`).

Pre-flip safety sweep (performed 2026-07-14): no `.env`/key/token files anywhere in the
git history or HEAD; no plaintext credentials; no public IPs in docs (the infra docs carry
only Tailscale CGNAT addresses). The four committed `k8s/**/sealedsecret*.yaml` files are
Bitnami **SealedSecrets** — encrypted for the cluster's private key and designed to live in
public GitOps repos.

## Consequences

- CI is free and unmetered; the merge gate no longer depends on billing state.
- The codebase, docs, and beads issue export are world-readable. This includes the git
  author email (already present in every commit's metadata) and the personal
  training/health context that drives the app (e.g. real weekly schedule in feature docs
  and demo fixtures). Accepted knowingly — the project contains no secrets, and secrets
  stay in env vars / SealedSecrets by standing rule.
- **New standing rule:** anything that must not be world-readable can no longer ride in
  the repo at all (not even "temporarily") — env vars, SealedSecrets, or the k3s box only.
- If genuinely private material ever needs to land in-repo, the fallback is option 2
  (self-hosted runner + flip back to private), documented here for that future decision.
