---
name: mezo-deploy
description: Use before any deployment / infra / hosting / k8s / ArgoCD / CI work.
---

# mezo Deployment & Infra

READ FIRST: docs/infrastructure/deployment-k3s-argocd.md AND
docs/decisions/0001-deploy-on-k3s-argocd-learning-track.md. For CI specifics:
docs/infrastructure/local-dev-testing.md (why the self-PR CI gate exists).

Hard gates: infra changes get a docs/infrastructure/ doc update in the same change ·
direction changes get an ADR · never bypass the PR + CI-green gate.
