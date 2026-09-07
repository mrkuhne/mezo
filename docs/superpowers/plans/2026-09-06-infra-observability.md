# Infra Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Metrics, logs, Grafana and Telegram alerting on the single-node k3s box, with the backend exposing Prometheus metrics on a private management port — after the disk is cleaned and image GC is in place.

**Architecture:** A second ArgoCD `Application` installs `victoria-metrics-k8s-stack` (vmsingle + vmagent + vlsingle/vlagent + Grafana + vmalert + Alertmanager) into a `monitoring` namespace from a values file in this repo; plain manifests under `k8s/monitoring/` (namespace, SealedSecrets, scrapes, rules, dashboard, Tailscale ingress) are synced by the existing `mezo` Application. The backend gets `micrometer-registry-prometheus`, `management.server.port=8081` (cluster-internal, no JWT), ECS JSON logs and a JVM heap flag. Spec: `docs/superpowers/specs/2026-09-06-infra-observability-design.md`.

**Tech Stack:** k3s v1.35, ArgoCD (multi-source Helm app), Helm chart `victoria-metrics-k8s-stack` **0.91.2**, VictoriaMetrics/VictoriaLogs, Grafana, Alertmanager (Telegram), `postgres_exporter` v0.20.1, Tailscale operator ingress, Sealed Secrets, Spring Boot 4.0.0 / Micrometer 1.16, kubeconform v0.8.0.

**Deviations from the spec (decided while planning):** `postgres_exporter` runs in the `mezo`
namespace and reads the existing `mezo-db` Secret directly (the official image's `POSTGRES_USER`
is a superuser, so no `pg_monitor` grant and no `sealedsecret-pg-exporter.yaml`); Traefik is
scraped with a `VMPodScrape` on the pod port (the metrics port is deliberately not exposed on
the Service); the logs alert needs a second `VMAlert` CR (`vmalert-logs.yaml`) because one
vmalert has one datasource.

## Global Constraints

- Driving issue **mezo-ibxy**; branch `feat/infra-observability` cut from `main`; commit subjects carry `(mezo-ibxy)`; self-PR → CI green → `gh workflow run premerge.yml -f pr=<n>` → local `--no-ff` merge → push (CLAUDE.md §Git Workflow).
- Every new pod declares `resources.requests` + `limits.memory`, never CPU limits. Stack memory-limit budget ≈ 1.3 GiB; PVCs: vmsingle **5Gi**, vlsingle **5Gi**, Grafana **1Gi**.
- Retention: metrics **30d**, logs **14d**.
- Every object under `k8s/monitoring/` states `metadata.namespace` explicitly (the mezo Application defaults to `mezo`). Custom-resource objects carry the annotation `argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true` so the mezo app never fails a sync before the chart's CRDs exist.
- Secrets only as `SealedSecret` + a `secret.example.yaml` template beside it; never plaintext in git. Seal with `kubeseal --controller-name sealed-secrets-controller --controller-namespace kube-system`.
- Never touch the `image:` line of `k8s/backend/deployment.yaml` / `k8s/frontend/deployment.yaml` (release bot rewrites it); rebase onto main right before merging.
- No new tailnet hostnames or IPs in docs beyond what `docs/infrastructure/*.md` already prints (public repo, ADR 0011).
- Backend: no `@Value`, no field injection, no class-level `@Transactional` (ArchUnit); ITs run with `-Dmezo.test.use-testcontainers=true`; run plain `./mvnw test` once before the PR so ArchUnit executes.
- `kubectl` from the Mac: `export KUBECONFIG=~/.kube/mezo-k3s.yaml`. SSH: `ssh -i ~/.ssh/id_mezo_hetzner deploy@100.75.51.113` (Tailscale SSH may ask for a browser check-in first — the user must complete it).
- Manual cluster steps are recorded in the runbook in the same task that performs them.

---

### Task 0: Branch and issue scaffolding

**Files:**
- none (git + bd only)

- [ ] **Step 1: Cut the branch from current main**

```bash
git fetch origin && git checkout -b feat/infra-observability origin/main
```

- [ ] **Step 2: Create child issues under the epic (one per task below) and claim the first**

```bash
for t in "Slice 0: disk cleanup + kubelet image GC" \
         "Backend: Prometheus registry + management port + security matcher" \
         "Backend: ECS logs, JVM flag, k8s ports/probes" \
         "Stack: monitoring namespace, secrets, values, ArgoCD Helm app, Grafana ingress" \
         "CI: kubeconform gate for k8s manifests" \
         "Scrapes: backend, postgres_exporter, Traefik" \
         "Alerts: VMRules, logs vmalert, Telegram receiver" \
         "Grafana: custom mezo dashboard" \
         "Docs: ADR + infra docs + runbook"; do
  bd create --title "$t" --type task --priority 2 --parent mezo-ibxy
done
bd ready | grep mezo-ibxy
```

Expected: nine child issues listed under `mezo-ibxy`. Claim each with `bd update <id> --claim` when its task starts and `bd close <id>` when it ends.

---

### Task 1: Slice 0 — disk cleanup and permanent image GC

**Files:**
- Modify: `docs/infrastructure/runbook.md` (new `### Disk & image GC` under `## 4. Common operations`)

**Interfaces:**
- Produces: ≥ 20 GiB free on the node; `/etc/rancher/k3s/config.yaml` with kubelet GC thresholds; runbook section other tasks link to.

- [ ] **Step 1: Record the "before" numbers (read-only)**

```bash
export KUBECONFIG=~/.kube/mezo-k3s.yaml
NODE=$(kubectl get node -o name | cut -d/ -f2)
kubectl get --raw "/api/v1/nodes/$NODE/proxy/stats/summary" | python3 -c "
import sys,json;s=json.load(sys.stdin)['node']
f=s['fs'];i=s['runtime']['imageFs']
print('nodefs used %.1f/%.1f GiB' % (f['usedBytes']/2**30,f['capacityBytes']/2**30))
print('imagefs used %.1f GiB' % (i['usedBytes']/2**30))"
kubectl get node -o jsonpath='{.items[0].status.images}' | python3 -c "import sys,json;x=json.load(sys.stdin);print(len(x),'images %.1f GiB' % (sum(i['sizeBytes'] for i in x)/2**30))"
```

Expected (2026-09-06 baseline): `nodefs used 58.2/74.8 GiB`, `imagefs used 29.1 GiB`, `50 images 9.8 GiB`. Paste the output into the runbook section in Step 6.

- [ ] **Step 2: Find what is eating the disk (SSH, read-only)**

```bash
ssh -i ~/.ssh/id_mezo_hetzner deploy@100.75.51.113 '
sudo df -h /;
sudo du -xh -d1 /var/lib/rancher/k3s/agent/containerd 2>/dev/null | sort -h | tail -5;
sudo du -sh /var/lib/rancher/k3s/storage /var/log/journal /var/lib/rancher/k3s/agent/images 2>/dev/null;
sudo crictl images | wc -l'
```

Expected: the overlayfs snapshotter directory dominates (tens of GiB); journal size printed.

- [ ] **Step 3: Prune orphaned images and cap journald**

```bash
ssh -i ~/.ssh/id_mezo_hetzner deploy@100.75.51.113 '
sudo crictl rmi --prune;
sudo journalctl --vacuum-size=500M;
sudo mkdir -p /etc/systemd/journald.conf.d;
printf "[Journal]\nSystemMaxUse=500M\n" | sudo tee /etc/systemd/journald.conf.d/mezo.conf;
sudo systemctl restart systemd-journald;
sudo df -h /'
```

Expected: `crictl rmi --prune` reports removed images; `df` shows Use% below 78%. If the overlayfs directory is still > 15 GiB after the prune, list leaked snapshots with `sudo ctr -n k8s.io snapshots ls | wc -l` versus `sudo crictl ps -a | wc -l` and remove unreferenced ones with `sudo ctr -n k8s.io snapshots rm <key>` (only keys that no container from `crictl ps -a` references).

- [ ] **Step 4: Set permanent kubelet GC thresholds**

```bash
ssh -i ~/.ssh/id_mezo_hetzner deploy@100.75.51.113 '
sudo test -f /etc/rancher/k3s/config.yaml && sudo cat /etc/rancher/k3s/config.yaml || echo "(no config.yaml yet)"'
```

Then append (create the file if absent — keep any existing keys):

```bash
ssh -i ~/.ssh/id_mezo_hetzner deploy@100.75.51.113 '
sudo mkdir -p /etc/rancher/k3s;
sudo tee -a /etc/rancher/k3s/config.yaml <<EOC
# Image GC + eviction (mezo-ibxy). Defaults (85/80 %) left the disk at 78 % with 29 GiB of
# orphaned image layers; evict before the node itself becomes unusable.
kubelet-arg:
  - "image-gc-high-threshold=70"
  - "image-gc-low-threshold=60"
  - "eviction-hard=nodefs.available<10%,imagefs.available<10%"
EOC
sudo systemctl restart k3s;
sleep 20; sudo k3s kubectl get nodes'
```

Expected: node `Ready` after restart (all pods restart once; the app is briefly unavailable — do this outside the user's active hours).

- [ ] **Step 5: Verify the "after" numbers**

Re-run Step 1. Expected: nodefs free ≥ 20 GiB (used ≤ ~55 GiB → target ≤ 70%); imagefs well below 29 GiB.

- [ ] **Step 6: Document in the runbook**

Insert after the `### Check status / logs` block in `docs/infrastructure/runbook.md`:

```markdown
### Disk & image GC (mezo-ibxy)

The node has ONE disk (74.8 GiB) shared by the OS, containerd image layers and every
`local-path` PVC. On 2026-09-06 it sat at **78 % used with 29 GiB of orphaned image layers**
from 170+ release tags; the kubelet evicts pods at 85 %. Two guards now exist:

1. **Kubelet GC thresholds** in `/etc/rancher/k3s/config.yaml` (`kubelet-arg`:
   `image-gc-high-threshold=70`, `image-gc-low-threshold=60`,
   `eviction-hard=nodefs.available<10%,imagefs.available<10%`). Host-side, NOT in git —
   re-apply on a rebuild.
2. **journald** capped at 500 M (`/etc/systemd/journald.conf.d/mezo.conf`).

Check disk (no SSH needed):
```bash
NODE=$(kubectl get node -o name | cut -d/ -f2)
kubectl get --raw "/api/v1/nodes/$NODE/proxy/stats/summary" | python3 -c "
import sys,json;s=json.load(sys.stdin)['node'];f=s['fs'];i=s['runtime']['imageFs']
print('nodefs %.1f/%.1f GiB, imagefs %.1f GiB' % (f['usedBytes']/2**30,f['capacityBytes']/2**30,i['usedBytes']/2**30))"
```
Manual prune: `ssh … 'sudo crictl rmi --prune'`. Baseline after cleanup (2026-09-06): <paste Step 5 output>.
The `NodeDiskPressure` alert (Grafana/Alertmanager, §Observability) fires below 15 % free.
```

Replace `<paste Step 5 output>` with the real numbers.

- [ ] **Step 7: File the GHCR retention follow-up and commit**

```bash
bd create --title "GHCR tag retention workflow for mezo-backend/mezo-frontend (170+ release tags)" --type task --priority 3 --description "Follow-up from mezo-ibxy slice 0: registry keeps every release tag; add a scheduled workflow (e.g. actions/delete-package-versions) keeping the last 20 + tags referenced by k8s/*/deployment.yaml."
git add docs/infrastructure/runbook.md
git commit -m "docs(infra): disk cleanup + kubelet image GC runbook section (mezo-ibxy)"
```

---

### Task 2: Backend — Prometheus registry, management port, security matcher

**Files:**
- Modify: `backend/pom.xml` (dependencies, after `spring-boot-starter-actuator`)
- Modify: `backend/src/main/resources/application.yml:2000-2004` (`management` block)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/security/SecurityConfig.java:42-45`
- Modify: `backend/src/test/resources/application.properties` (append)
- Create: `backend/src/test/java/io/mrkuhne/mezo/techcore/security/ManagementPortIT.java`

**Interfaces:**
- Produces: `GET :<management-port>/actuator/prometheus` → 200 text exposition without a token; `GET :<management-port>/actuator/health` → 200; `GET :8090/actuator/prometheus` → 401. Property `management.server.port` (env `MEZO_MANAGEMENT_PORT`, default 8081) used by Task 3's manifests.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.techcore.security;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.web.server.LocalManagementPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * mezo-ibxy: actuator lives on a SEPARATE management port (cluster-internal, no JWT).
 * health + prometheus are open there; on the app port they are not mapped at all, so the
 * JWT chain answers 401 like for any unknown path.
 */
class ManagementPortIT extends ApiIntegrationTest {

    @LocalManagementPort
    int managementPort;

    @Test
    void prometheusIsOpenOnManagementPort() {
        ResponseEntity<String> r = rest.getRestTemplate()
            .getForEntity("http://localhost:" + managementPort + "/actuator/prometheus", String.class);
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(r.getBody()).contains("jvm_memory_used_bytes");
        assertThat(r.getBody()).contains("application=\"mezo-backend\"");
    }

    @Test
    void healthIsOpenOnManagementPort() {
        ResponseEntity<String> r = rest.getRestTemplate()
            .getForEntity("http://localhost:" + managementPort + "/actuator/health", String.class);
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void prometheusIsNotServedOnAppPort() {
        ResponseEntity<String> r = rest.getForEntity("/actuator/prometheus", String.class);
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw -q test -Dtest=ManagementPortIT -Dmezo.test.use-testcontainers=true -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: FAIL — `@LocalManagementPort` unresolved (no separate management port) or 404/401 on `/actuator/prometheus`.

- [ ] **Step 3: Add the Prometheus registry dependency**

In `backend/pom.xml`, directly after the `spring-boot-starter-actuator` dependency:

```xml
		<!-- mezo-ibxy: Prometheus exposition of Micrometer metrics on the management port. -->
		<dependency>
			<groupId>io.micrometer</groupId>
			<artifactId>micrometer-registry-prometheus</artifactId>
		</dependency>
```

(Version comes from the Boot 4.0.0 BOM — Micrometer 1.16.0.)

- [ ] **Step 4: Configure the management port and exposure**

Replace the `management:` block at the end of `application.yml` with:

```yaml
management:
  server:
    # mezo-ibxy: actuator on its OWN port — cluster-internal only (not routed by the public
    # Ingress, not on the Tailscale ingress). vmagent scrapes /actuator/prometheus here.
    port: ${MEZO_MANAGEMENT_PORT:8081}
  endpoints:
    web:
      exposure:
        include: health,prometheus
  metrics:
    tags:
      application: mezo-backend
  prometheus:
    metrics:
      export:
        enabled: true
```

- [ ] **Step 5: Open health + prometheus in the security chain**

In `SecurityConfig.java` add the import and change the matcher:

```java
import org.springframework.boot.security.autoconfigure.actuate.web.servlet.EndpointRequest;
```

```java
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/login", "/api/auth/register").permitAll()
                // mezo-ibxy: actuator endpoints are mapped ONLY on the management port
                // (management.server.port); EndpointRequest matches nothing on the app port,
                // so /actuator/* there falls through to authenticated() → 401.
                .requestMatchers(EndpointRequest.to("health", "prometheus")).permitAll()
                .anyRequest().authenticated())
```

- [ ] **Step 6: Give tests a random management port**

Append to `backend/src/test/resources/application.properties`:

```properties
# mezo-ibxy: the management server is a second embedded server; a fixed 8081 would collide
# across the cached test contexts. 0 = random, read back with @LocalManagementPort.
management.server.port=0
```

- [ ] **Step 7: Run the IT to verify it passes**

```bash
cd backend && ./mvnw -q test -Dtest=ManagementPortIT -Dmezo.test.use-testcontainers=true -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: PASS (3 tests).

- [ ] **Step 8: Run the whole backend suite once (ArchUnit + every IT that boots a context)**

```bash
cd backend && ./mvnw -q test -Dmezo.test.use-testcontainers=true
```

Expected: BUILD SUCCESS. If any test asserted on `/actuator/health` via the app port, move it to the management port the same way as Step 1.

- [ ] **Step 9: Commit**

```bash
git add backend/pom.xml backend/src/main/resources/application.yml backend/src/main/java/io/mrkuhne/mezo/techcore/security/SecurityConfig.java backend/src/test/resources/application.properties backend/src/test/java/io/mrkuhne/mezo/techcore/security/ManagementPortIT.java
git commit -m "feat(backend): prometheus metrics on a separate management port (mezo-ibxy)"
```

---

### Task 3: Backend — ECS logs, JVM flag, k8s ports and probes, security doc

**Files:**
- Modify: `backend/src/main/resources/application.yml` (new `logging` block after `management`)
- Modify: `backend/Dockerfile:23`
- Modify: `k8s/backend/deployment.yaml` (ports, env, probes)
- Modify: `k8s/backend/service.yaml`
- Modify: `docs/features/_platform-auth-security.md:177,425,438`

**Interfaces:**
- Consumes: `MEZO_MANAGEMENT_PORT` from Task 2.
- Produces: Service `backend` port `management` (8081) — Task 6's `VMServiceScrape` selects it by name; ECS JSON on stdout — Task 7's LogsQL rules query `log.level`.

- [ ] **Step 1: Make structured logging opt-in by env**

Append to `application.yml` after the `management:` block:

```yaml
logging:
  structured:
    format:
      # mezo-ibxy: empty = Boot's plain console pattern (local dev). k8s sets
      # MEZO_LOG_FORMAT=ecs so VictoriaLogs gets message / log.level / service.name fields.
      console: ${MEZO_LOG_FORMAT:}
```

- [ ] **Step 2: Verify locally that both modes boot**

```bash
cd backend && MEZO_LOG_FORMAT=ecs ./mvnw test -Dtest=ManagementPortIT -Dmezo.test.use-testcontainers=true -Dsurefire.failIfNoSpecifiedTests=false 2>&1 | grep -m1 '"log.level"'
```

Expected: one JSON log line containing `"log.level"` (proves ECS output when the env is set). Then re-run without the `MEZO_LOG_FORMAT=ecs` prefix and confirm plain `INFO … ---` lines.

- [ ] **Step 3: JVM heap flag**

`backend/Dockerfile` line 23:

```dockerfile
# mezo-ibxy: the 1Gi container limit gave the JVM only ~256Mi heap by ergonomics; 60 %
# leaves room for metaspace + the metrics registry while keeping the limit.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=60", "-jar", "/app/app.jar"]
```

- [ ] **Step 4: Deployment — management port, env, probes**

In `k8s/backend/deployment.yaml` replace the `ports:` block and the three probes, and add two env entries after `MEZO_FEATURE_LLM_LOG_ENABLED`:

```yaml
          ports:
            - name: http
              containerPort: 8090
            # mezo-ibxy: actuator (health + prometheus). Cluster-internal only — never on an Ingress.
            - name: management
              containerPort: 8081
```

```yaml
            # mezo-ibxy: observability. ECS JSON logs for VictoriaLogs; actuator on 8081.
            - name: MEZO_LOG_FORMAT
              value: ecs
            - name: MEZO_MANAGEMENT_PORT
              value: "8081"
```

```yaml
          # startupProbe gives Spring Boot + Liquibase time to come up before
          # liveness/readiness start judging it. /actuator/health lives on the management
          # port (mezo-ibxy) — a broken management server = an unhealthy pod, on purpose.
          startupProbe:
            httpGet:
              path: /actuator/health
              port: management
            periodSeconds: 5
            failureThreshold: 40      # up to ~200s to boot
          readinessProbe:
            httpGet:
              path: /actuator/health
              port: management
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /actuator/health
              port: management
            periodSeconds: 20
```

Do not touch the `image:` line.

- [ ] **Step 5: Service — second port**

`k8s/backend/service.yaml`:

```yaml
  ports:
    - name: http
      port: 8090
      targetPort: http
    # mezo-ibxy: scraped by vmagent (VMServiceScrape "backend" selects this port by name).
    - name: management
      port: 8081
      targetPort: management
```

- [ ] **Step 6: Security doc**

In `docs/features/_platform-auth-security.md`:
- line 177: replace `` `/actuator/health` `` with `` `/actuator/health` and `/actuator/prometheus` — **on the management port only** (`management.server.port`, 8081, cluster-internal; `EndpointRequest.to("health","prometheus")`; on the app port `/actuator/*` is not mapped and answers 401) ``.
- line 425: replace `(`login`, `register`, `/actuator/health`)` with `(`login`, `register`, actuator `health`+`prometheus` on the management port)`.
- line 438: replace `/actuator` health exposure` with `management.server.port` + `health,prometheus` exposure (mezo-ibxy)`.

- [ ] **Step 7: Lint docs and commit**

```bash
node scripts/lint-docs.mjs --errors-only
git add backend/src/main/resources/application.yml backend/Dockerfile k8s/backend/deployment.yaml k8s/backend/service.yaml docs/features/_platform-auth-security.md
git commit -m "feat(infra): ECS logs, JVM heap flag, backend management port in k8s (mezo-ibxy)"
```

---

### Task 4: Stack — namespace, secrets, values, ArgoCD Helm app, Grafana ingress

**Files:**
- Create: `k8s/monitoring/namespace.yaml`
- Create: `k8s/monitoring/secret.example-grafana.yaml`, `k8s/monitoring/sealedsecret-grafana.yaml`
- Create: `k8s/monitoring/secret.example-alertmanager.yaml`, `k8s/monitoring/sealedsecret-alertmanager.yaml`
- Create: `k8s/monitoring/values.yaml`
- Create: `k8s/monitoring/ingress-tailscale-grafana.yaml`
- Create: `argocd/monitoring-application.yaml`
- Modify: `argocd/application.yaml:22` (exclude glob)

**Interfaces:**
- Produces: namespace `monitoring`; Services `vmsingle-vm:8428`, `vlsingle-vm:9428`, `vmalertmanager-vm:9093`, `vm-grafana:80` (verified in Step 9); Secret `grafana-admin` (keys `admin-user`, `admin-password`); Secret `alertmanager-config` (key `alertmanager.yaml`).

- [ ] **Step 1: Namespace**

`k8s/monitoring/namespace.yaml`:

```yaml
# Observability lives in its own namespace (mezo-ibxy): the VictoriaMetrics k8s-stack Helm
# release (argocd/monitoring-application.yaml) plus the plain manifests in this directory.
# The mezo ArgoCD Application defaults to namespace `mezo`, so every file here names its
# namespace explicitly.
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring
```

- [ ] **Step 2: Secret templates**

`k8s/monitoring/secret.example-grafana.yaml`:

```yaml
# TEMPLATE ONLY — real values sealed into sealedsecret-grafana.yaml (see k8s/README.md).
apiVersion: v1
kind: Secret
metadata:
  name: grafana-admin
  namespace: monitoring
type: Opaque
stringData:
  admin-user: admin
  admin-password: "CHANGE_ME"
```

`k8s/monitoring/secret.example-alertmanager.yaml`:

```yaml
# TEMPLATE ONLY — the whole Alertmanager config is sealed because it carries the Telegram
# bot token. Create a bot with @BotFather, get chat_id from https://api.telegram.org/bot<token>/getUpdates
# after messaging the bot once.
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-config
  namespace: monitoring
type: Opaque
stringData:
  alertmanager.yaml: |
    route:
      receiver: telegram
      group_by: [alertname]
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 4h
    receivers:
      - name: telegram
        telegram_configs:
          - bot_token: "CHANGE_ME"
            chat_id: 0
            parse_mode: HTML
            send_resolved: true
            message: '{{ template "telegram.default.message" . }}'
```

- [ ] **Step 3: Seal both secrets (real values never in the shell history — read them from files)**

```bash
export KUBECONFIG=~/.kube/mezo-k3s.yaml
read -rs GRAFANA_PW; echo
kubectl create secret generic grafana-admin -n monitoring \
  --from-literal=admin-user=admin --from-literal=admin-password="$GRAFANA_PW" \
  --dry-run=client -o yaml \
| kubeseal --controller-name sealed-secrets-controller --controller-namespace kube-system -o yaml \
> k8s/monitoring/sealedsecret-grafana.yaml

cp k8s/monitoring/secret.example-alertmanager.yaml /tmp/am-real.yaml   # edit bot_token + chat_id in /tmp/am-real.yaml
kubeseal --controller-name sealed-secrets-controller --controller-namespace kube-system -o yaml \
  < /tmp/am-real.yaml > k8s/monitoring/sealedsecret-alertmanager.yaml
rm /tmp/am-real.yaml
grep -c encryptedData k8s/monitoring/sealedsecret-*.yaml
```

Expected: both files contain `encryptedData`; `git diff` shows no plaintext token.

- [ ] **Step 4: Chart values**

`k8s/monitoring/values.yaml`:

```yaml
# victoria-metrics-k8s-stack values (mezo-ibxy). Read by argocd/monitoring-application.yaml.
# Budget on the 8 GB single node: memory limits ≈ 1.3 GiB, PVCs 5 + 5 + 1 Gi.
fullnameOverride: vm
argocdReleaseOverride: $ARGOCD_APP_NAME

victoria-metrics-operator:
  enabled: true
  crds:
    plain: true
  resources:
    requests: { memory: 96Mi }
    limits: { memory: 192Mi }

vmsingle:
  enabled: true
  spec:
    retentionPeriod: 30d
    storage:
      resources:
        requests:
          storage: 5Gi
    resources:
      requests: { memory: 256Mi }
      limits: { memory: 768Mi }

vmagent:
  enabled: true
  spec:
    scrapeInterval: 30s
    selectAllByDefault: true
    resources:
      requests: { memory: 128Mi }
      limits: { memory: 384Mi }
    extraArgs:
      promscrape.streamParse: "true"

vlsingle:
  enabled: true
  spec:
    retentionPeriod: 14d
    storage:
      resources:
        requests:
          storage: 5Gi
    resources:
      requests: { memory: 256Mi }
      limits: { memory: 512Mi }

vlagent:
  enabled: true
  spec:
    k8sCollector:
      enabled: true
    resources:
      requests: { memory: 64Mi }
      limits: { memory: 192Mi }

vmalert:
  enabled: true
  spec:
    # Only metrics rules; the logs vmalert (k8s/monitoring/vmalert-logs.yaml) takes vmalert-target=logs.
    ruleSelector:
      matchExpressions:
        - { key: vmalert-target, operator: NotIn, values: [logs] }
    resources:
      requests: { memory: 64Mi }
      limits: { memory: 192Mi }

alertmanager:
  enabled: true
  spec:
    configSecret: alertmanager-config
    resources:
      requests: { memory: 32Mi }
      limits: { memory: 128Mi }

grafana:
  enabled: true
  admin:
    existingSecret: grafana-admin
    userKey: admin-user
    passwordKey: admin-password
  plugins:
    - victoriametrics-logs-datasource
  persistence:
    enabled: true
    size: 1Gi
  resources:
    requests: { memory: 128Mi }
    limits: { memory: 256Mi }
  grafana.ini:
    server:
      # Tailscale terminates TLS; Grafana serves plain HTTP behind it.
      root_url: "%(protocol)s://%(domain)s/"

defaultDashboards:
  enabled: true
  annotations:
    argocd.argoproj.io/sync-options: ServerSideApply=true

defaultRules:
  enabled: true
  groups:
    etcd: { create: false }
    kubeScheduler: { create: false }
    kubernetesSystemScheduler: { create: false }
    kubernetesSystemControllerManager: { create: false }

kube-state-metrics:
  enabled: true
  resources:
    requests: { memory: 48Mi }
    limits: { memory: 128Mi }

prometheus-node-exporter:
  enabled: true
  resources:
    requests: { memory: 24Mi }
    limits: { memory: 64Mi }

# k3s runs these in-process — no scrapable targets, disable to avoid dead-target alerts.
kubeEtcd: { enabled: false }
kubeScheduler: { enabled: false }
kubeControllerManager: { enabled: false }
```

- [ ] **Step 5: Render the chart locally against the values (catches key typos before ArgoCD)**

```bash
helm repo add vm https://victoriametrics.github.io/helm-charts/ 2>/dev/null; helm repo update vm
helm template vm vm/victoria-metrics-k8s-stack --version 0.91.2 -n monitoring -f k8s/monitoring/values.yaml > /tmp/vm-render.yaml
grep -c '^kind:' /tmp/vm-render.yaml
grep -E '^  name: (vmsingle-vm|vlsingle-vm|vmalertmanager-vm|vm-grafana)$' /tmp/vm-render.yaml | sort -u
```

Expected: hundreds of objects; the four names print (if a name differs, e.g. `vm-grafana` renders as something else, update the Service names in Steps 7 and 9 and in Task 7's `vmalert-logs.yaml`).

- [ ] **Step 6: ArgoCD Helm Application**

`argocd/monitoring-application.yaml`:

```yaml
# Second ArgoCD Application (mezo-ibxy): the VictoriaMetrics k8s-stack Helm release.
# Multi-source: the chart from the VM Helm repo, the values file from THIS repo.
# Applied once by hand like application.yaml:
#   kubectl apply -f argocd/monitoring-application.yaml
# ServerSideApply: the operator CRDs + bundled dashboards exceed the 262144-byte
# last-applied annotation. Never combine with Replace=true.
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: monitoring
  namespace: argocd
spec:
  project: default
  sources:
    - repoURL: https://victoriametrics.github.io/helm-charts/
      chart: victoria-metrics-k8s-stack
      targetRevision: 0.91.2
      helm:
        releaseName: vm
        valueFiles:
          - $values/k8s/monitoring/values.yaml
    - repoURL: https://github.com/mrkuhne/mezo
      targetRevision: main
      ref: values
  destination:
    server: https://kubernetes.default.svc
    namespace: monitoring
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
      - RespectIgnoreDifferences=true
  ignoreDifferences:
    - group: admissionregistration.k8s.io
      kind: ValidatingWebhookConfiguration
      jqPathExpressions:
        - .webhooks[].clientConfig.caBundle
    - group: ""
      kind: Secret
      name: vm-victoria-metrics-operator-validation
      jsonPointers:
        - /data
```

- [ ] **Step 7: Grafana on the tailnet**

`k8s/monitoring/ingress-tailscale-grafana.yaml`:

```yaml
# Grafana on the PRIVATE tailnet via the Tailscale operator (same pattern as
# k8s/pgadmin/ingress-tailscale.yaml). https://grafana.<tailnet>.ts.net — never public.
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: grafana-ts
  namespace: monitoring
spec:
  ingressClassName: tailscale
  defaultBackend:
    service:
      name: vm-grafana
      port:
        number: 80
  tls:
    - hosts:
        - grafana        # → grafana.<tailnet>.ts.net
```

- [ ] **Step 8: Keep secret templates out of the mezo app's sync**

`argocd/application.yaml` line 22 — the exclude is a single glob string; widen it to both naming styles:

```yaml
      exclude: "{**/secret.example.yaml,**/secret.example-*.yaml}"
```

- [ ] **Step 9: Push, apply, verify**

```bash
git add k8s/monitoring argocd
git commit -m "feat(infra): VictoriaMetrics k8s-stack via ArgoCD Helm app + Grafana tailnet ingress (mezo-ibxy)"
git push -u origin feat/infra-observability
```

The mezo Application syncs `main` only, so for verification on the branch **temporarily** point the monitoring app at the branch (`targetRevision: feat/infra-observability` in the `ref: values` source) when applying, and restore `main` in the committed file:

```bash
export KUBECONFIG=~/.kube/mezo-k3s.yaml
kubectl apply -f k8s/monitoring/namespace.yaml -f k8s/monitoring/sealedsecret-grafana.yaml -f k8s/monitoring/sealedsecret-alertmanager.yaml
sed 's/targetRevision: main/targetRevision: feat\/infra-observability/' argocd/monitoring-application.yaml | kubectl apply -f -
kubectl apply -f argocd/application.yaml
sleep 120
kubectl get application -n argocd
kubectl get pods -n monitoring
kubectl get crd | grep -c victoriametrics
kubectl get svc -n monitoring | grep -E 'vmsingle-vm|vlsingle-vm|vmalertmanager-vm|vm-grafana'
kubectl get secret -n monitoring grafana-admin alertmanager-config
kubectl top pods -n monitoring
kubectl top nodes
```

Expected: both Applications `Synced`/`Healthy` (the operator webhook may show one transient sync retry); all monitoring pods `Running`; ≥ 15 VM CRDs; the four Services present; memory sum of monitoring pods ≤ 1.3 GiB. Then apply the Grafana ingress and open it:

```bash
kubectl apply -f k8s/monitoring/ingress-tailscale-grafana.yaml
kubectl get ingress -n monitoring grafana-ts -w   # wait for the ADDRESS
```

Expected: `https://grafana.<tailnet>.ts.net` loads; login `admin` + sealed password; datasources `VictoriaMetrics` and `VictoriaLogs (DS)` present; the "Kubernetes / Compute Resources / Node" dashboard shows data. After merge to `main`, re-apply `argocd/monitoring-application.yaml` unchanged so the ref returns to `main`.

---

### Task 5: CI — kubeconform gate for k8s manifests

**Files:**
- Modify: `.github/workflows/ci.yml` (new job `lint-k8s` after `lint`)

**Interfaces:**
- Produces: CI fails on schema-invalid plain manifests and on values that do not render.

- [ ] **Step 1: Add the job**

Insert after the `lint` job in `.github/workflows/ci.yml`:

```yaml
  lint-k8s:
    # mezo-ibxy: first manifest gate. Plain YAML under k8s/ is schema-checked; the Helm values
    # are proven renderable against the pinned chart. CRD kinds have no upstream schema in
    # kubeconform's catalog → -ignore-missing-schemas (structure is still YAML-validated).
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: Install kubeconform
        run: |
          curl -sSL https://github.com/yannh/kubeconform/releases/download/v0.8.0/kubeconform-linux-amd64.tar.gz \
            | tar -xz -C /usr/local/bin kubeconform
      - name: Validate plain manifests
        run: |
          find k8s argocd -name '*.yaml' ! -name 'values.yaml' ! -name 'secret.example*' -print0 \
            | xargs -0 kubeconform -strict -ignore-missing-schemas -kubernetes-version 1.35.0 -summary
      - name: Render the monitoring chart with our values
        run: |
          helm repo add vm https://victoriametrics.github.io/helm-charts/
          helm template vm vm/victoria-metrics-k8s-stack --version 0.91.2 -n monitoring \
            -f k8s/monitoring/values.yaml \
            | kubeconform -strict -ignore-missing-schemas -kubernetes-version 1.35.0 -summary
```

- [ ] **Step 2: Run the same commands locally**

```bash
brew list kubeconform >/dev/null 2>&1 || brew install kubeconform
find k8s argocd -name '*.yaml' ! -name 'values.yaml' ! -name 'secret.example*' -print0 | xargs -0 kubeconform -strict -ignore-missing-schemas -kubernetes-version 1.35.0 -summary
helm template vm vm/victoria-metrics-k8s-stack --version 0.91.2 -n monitoring -f k8s/monitoring/values.yaml | kubeconform -strict -ignore-missing-schemas -kubernetes-version 1.35.0 -summary
```

Expected: `Summary: N resources found … 0 invalid`. Fix any invalid file it reports (existing manifests included).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: kubeconform gate for k8s manifests and the monitoring chart values (mezo-ibxy)"
```

---

### Task 6: Scrapes — backend, postgres_exporter, Traefik

**Files:**
- Create: `k8s/monitoring/vmservicescrape-backend.yaml`
- Create: `k8s/postgres/exporter-deployment.yaml`, `k8s/postgres/exporter-service.yaml`
- Create: `k8s/monitoring/vmservicescrape-postgres.yaml`
- Create: `k8s/monitoring/vmpodscrape-traefik.yaml`
- Modify: `docs/infrastructure/runbook.md` (host-side Traefik `HelmChartConfig` note, inside the §Observability section created in Task 9 — add it now as a stub heading `### Observability (mezo-ibxy)` under §4)

**Interfaces:**
- Consumes: Service `backend` port `management` (Task 3); Secret `mezo-db` keys `POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB`.
- Produces: vmagent targets `backend`, `postgres-exporter`, `traefik` UP; metrics `jvm_*`, `http_server_requests_seconds_*`, `gen_ai_client_*`, `pg_*`, `traefik_*` in VictoriaMetrics.

- [ ] **Step 1: Backend scrape**

`k8s/monitoring/vmservicescrape-backend.yaml`:

```yaml
# vmagent scrape of the Spring Boot actuator on the management port (mezo-ibxy).
apiVersion: operator.victoriametrics.com/v1beta1
kind: VMServiceScrape
metadata:
  name: backend
  namespace: mezo
  annotations:
    argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true
spec:
  selector:
    matchLabels:
      app: backend
  endpoints:
    - port: management
      path: /actuator/prometheus
      interval: 30s
```

- [ ] **Step 2: postgres_exporter in the mezo namespace (reads `mezo-db` directly; the image's POSTGRES_USER is a superuser, so no `pg_monitor` grant is needed)**

`k8s/postgres/exporter-deployment.yaml`:

```yaml
# postgres_exporter (mezo-ibxy): stat_database / stat_user_tables / locks / activity for Grafana
# and the PostgresDown / PgConnectionsHigh alerts. Lives in `mezo` so it can use the mezo-db
# Secret; scraped by k8s/monitoring/vmservicescrape-postgres.yaml.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres-exporter
  namespace: mezo
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres-exporter
  template:
    metadata:
      labels:
        app: postgres-exporter
    spec:
      containers:
        - name: exporter
          image: quay.io/prometheuscommunity/postgres-exporter:v0.20.1
          ports:
            - name: metrics
              containerPort: 9187
          env:
            - name: DATA_SOURCE_URI
              value: postgres:5432/mezo?sslmode=disable
            - name: DATA_SOURCE_USER
              valueFrom:
                secretKeyRef: { name: mezo-db, key: POSTGRES_USER }
            - name: DATA_SOURCE_PASS
              valueFrom:
                secretKeyRef: { name: mezo-db, key: POSTGRES_PASSWORD }
          readinessProbe:
            httpGet: { path: /metrics, port: metrics }
            periodSeconds: 30
          resources:
            requests: { cpu: "10m", memory: "32Mi" }
            limits: { memory: "96Mi" }
```

`k8s/postgres/exporter-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-exporter
  namespace: mezo
spec:
  selector:
    app: postgres-exporter
  ports:
    - name: metrics
      port: 9187
      targetPort: metrics
```

`k8s/monitoring/vmservicescrape-postgres.yaml`:

```yaml
apiVersion: operator.victoriametrics.com/v1beta1
kind: VMServiceScrape
metadata:
  name: postgres-exporter
  namespace: mezo
  annotations:
    argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true
spec:
  selector:
    matchLabels:
      app: postgres-exporter
  endpoints:
    - port: metrics
      interval: 30s
```

- [ ] **Step 3: Traefik metrics — host-side HelmChartConfig, then a pod scrape**

```bash
ssh -i ~/.ssh/id_mezo_hetzner deploy@100.75.51.113 'sudo tee /var/lib/rancher/k3s/server/manifests/traefik-config.yaml <<EOC
# mezo-ibxy: expose the bundled Traefik Prometheus endpoint on the pod (port 9100, not on the
# Service). Never edit traefik.yaml — k3s re-applies it; this HelmChartConfig overlays it.
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    metrics:
      prometheus:
        entryPoint: metrics
        addRoutersLabels: true
        addServicesLabels: true
        addEntryPointsLabels: true
    ports:
      metrics:
        port: 9100
        expose:
          default: false
EOC
sleep 60; sudo k3s kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik -o jsonpath="{.items[0].spec.containers[0].ports[*].containerPort}"; echo'
```

Expected: the printed ports include `9100`.

`k8s/monitoring/vmpodscrape-traefik.yaml`:

```yaml
apiVersion: operator.victoriametrics.com/v1beta1
kind: VMPodScrape
metadata:
  name: traefik
  namespace: kube-system
  annotations:
    argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: traefik
  podMetricsEndpoints:
    - port: metrics
      path: /metrics
      interval: 30s
```

- [ ] **Step 4: Runbook stub for the host-side step**

Under `## 4. Common operations` in `docs/infrastructure/runbook.md` add:

```markdown
### Observability (mezo-ibxy)

Host-side pieces (NOT in git, re-apply on a rebuild): `/etc/rancher/k3s/config.yaml` kubelet
GC args (see *Disk & image GC*) and `/var/lib/rancher/k3s/server/manifests/traefik-config.yaml`
(HelmChartConfig turning on Traefik's Prometheus port 9100; contents in the plan
`docs/superpowers/plans/2026-09-06-infra-observability.md` Task 6).
```

- [ ] **Step 5: Validate, apply on the cluster, verify targets**

```bash
find k8s -name '*.yaml' ! -name 'values.yaml' ! -name 'secret.example*' -print0 | xargs -0 kubeconform -strict -ignore-missing-schemas -kubernetes-version 1.35.0 -summary
export KUBECONFIG=~/.kube/mezo-k3s.yaml
kubectl apply -f k8s/postgres/exporter-deployment.yaml -f k8s/postgres/exporter-service.yaml \
  -f k8s/monitoring/vmservicescrape-backend.yaml -f k8s/monitoring/vmservicescrape-postgres.yaml -f k8s/monitoring/vmpodscrape-traefik.yaml
sleep 90
kubectl port-forward -n monitoring svc/vmagent-vm 8429:8429 >/dev/null 2>&1 & PF=$!
sleep 3; curl -s http://localhost:8429/api/v1/targets | python3 -c "
import sys,json;t=json.load(sys.stdin)['data']['activeTargets']
for x in t: print(x['health'].ljust(5), x['labels'].get('job'), x['scrapeUrl'])"
kill $PF
```

Expected: `up` for jobs containing `backend`, `postgres-exporter`, `traefik`, plus the chart's kube-state-metrics / node-exporter / vm components. (Note: the backend target is `up` only once the Task 3 image is deployed on main; on the branch it shows `down` until then — acceptable, re-check after merge.)

- [ ] **Step 6: Commit**

```bash
git add k8s/monitoring k8s/postgres docs/infrastructure/runbook.md
git commit -m "feat(infra): scrape backend, postgres_exporter and Traefik into VictoriaMetrics (mezo-ibxy)"
```

---

### Task 7: Alerts — VMRules, logs vmalert, Telegram

**Files:**
- Create: `k8s/monitoring/vmrule-mezo.yaml`
- Create: `k8s/monitoring/vmalert-logs.yaml`
- Create: `k8s/monitoring/vmrule-logs.yaml`

**Interfaces:**
- Consumes: metrics from Task 6; Secret `alertmanager-config` and Service `vlsingle-vm:9428`, `vmalertmanager-vm:9093` from Task 4.
- Produces: the nine alerts from the spec, delivered to Telegram.

- [ ] **Step 1: Metrics rules**

`k8s/monitoring/vmrule-mezo.yaml`:

```yaml
# mezo alert rules (mezo-ibxy) — evaluated by the chart's vmalert, routed to Telegram.
apiVersion: operator.victoriametrics.com/v1beta1
kind: VMRule
metadata:
  name: mezo
  namespace: monitoring
  annotations:
    argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true
spec:
  groups:
    - name: mezo.availability
      interval: 30s
      rules:
        - alert: BackendDown
          expr: up{job=~".*backend.*"} == 0
          for: 3m
          labels: { severity: critical }
          annotations: { summary: "mezo backend is not scrapeable for 3 minutes" }
        - alert: PodCrashLooping
          expr: increase(kube_pod_container_status_restarts_total[15m]) > 3
          for: 0m
          labels: { severity: critical }
          annotations: { summary: "{{ $labels.namespace }}/{{ $labels.pod }} restarted {{ $value | printf \"%.0f\" }}× in 15 min" }
        - alert: PostgresDown
          expr: pg_up == 0 or absent(pg_up)
          for: 2m
          labels: { severity: critical }
          annotations: { summary: "postgres_exporter cannot reach Postgres" }
        - alert: PgConnectionsHigh
          expr: sum(pg_stat_activity_count) / max(pg_settings_max_connections) > 0.8
          for: 5m
          labels: { severity: warning }
          annotations: { summary: "Postgres connections above 80% of max_connections" }
    - name: mezo.node
      interval: 60s
      rules:
        - alert: NodeDiskPressure
          expr: node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"} / node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"} < 0.15
          for: 5m
          labels: { severity: critical }
          annotations: { summary: "Node root disk below 15% free ({{ $value | humanizePercentage }})" }
        - alert: NodeMemoryHigh
          expr: (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) > 0.90
          for: 10m
          labels: { severity: warning }
          annotations: { summary: "Node memory above 90% for 10 minutes" }
    - name: mezo.jobs
      interval: 5m
      rules:
        - alert: BackupMissed
          expr: time() - kube_cronjob_status_last_successful_time{namespace="mezo",cronjob="postgres-backup"} > 26 * 3600
          for: 0m
          labels: { severity: critical }
          annotations: { summary: "postgres-backup has not succeeded in 26 hours" }
    - name: mezo.traffic
      interval: 60s
      rules:
        - alert: HttpErrorRate
          expr: sum(rate(traefik_service_requests_total{code=~"5.."}[5m])) / sum(rate(traefik_service_requests_total[5m])) > 0.05
          for: 5m
          labels: { severity: warning }
          annotations: { summary: "Traefik 5xx rate above 5% for 5 minutes" }
        - alert: LlmTokenSpike
          expr: sum(increase(gen_ai_client_token_usage_total[1d])) > 3 * avg_over_time(sum(increase(gen_ai_client_token_usage_total[1d]))[7d:1d])
          for: 0m
          labels: { severity: warning }
          annotations: { summary: "LLM tokens today are more than 3× the 7-day daily average" }
```

- [ ] **Step 2: A second vmalert for logs**

`k8s/monitoring/vmalert-logs.yaml`:

```yaml
# vmalert instance for LogsQL rules (mezo-ibxy): datasource = VictoriaLogs, notifier = the chart's
# Alertmanager. Picks VMRules labelled vmalert-target=logs; the chart's vmalert excludes them.
apiVersion: operator.victoriametrics.com/v1beta1
kind: VMAlert
metadata:
  name: logs
  namespace: monitoring
  annotations:
    argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true
spec:
  replicaCount: 1
  datasource:
    url: http://vlsingle-vm.monitoring.svc:9428
  notifiers:
    - url: http://vmalertmanager-vm.monitoring.svc:9093
  evaluationInterval: 60s
  ruleSelector:
    matchLabels:
      vmalert-target: logs
  extraArgs:
    rule.defaultRuleType: vlogs
  resources:
    requests: { memory: 32Mi }
    limits: { memory: 128Mi }
```

`k8s/monitoring/vmrule-logs.yaml`:

```yaml
apiVersion: operator.victoriametrics.com/v1beta1
kind: VMRule
metadata:
  name: mezo-logs
  namespace: monitoring
  labels:
    vmalert-target: logs
  annotations:
    argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true
spec:
  groups:
    - name: mezo.logs
      type: vlogs
      # vmalert evaluates a vlogs group over its own interval window; the stats value is the
      # alert value and the rule fires when the query returns a row → filter to > 20 / 5 min.
      interval: 5m
      rules:
        - alert: LogErrorBurst
          expr: 'kubernetes.container_name:backend AND log.level:ERROR | stats count() as errors | filter errors:>20'
          for: 0m
          labels: { severity: warning }
          annotations: { summary: "backend logged {{ $value }} ERROR lines in the last 5 minutes" }
```

- [ ] **Step 3: Apply, verify rules load, send a test alert**

```bash
find k8s -name '*.yaml' ! -name 'values.yaml' ! -name 'secret.example*' -print0 | xargs -0 kubeconform -strict -ignore-missing-schemas -kubernetes-version 1.35.0 -summary
export KUBECONFIG=~/.kube/mezo-k3s.yaml
kubectl apply -f k8s/monitoring/vmrule-mezo.yaml -f k8s/monitoring/vmalert-logs.yaml -f k8s/monitoring/vmrule-logs.yaml
sleep 60
kubectl get vmrule,vmalert -n monitoring
kubectl port-forward -n monitoring svc/vmalert-vm 8880:8080 >/dev/null 2>&1 & PF=$!; sleep 3
curl -s http://localhost:8880/api/v1/rules | python3 -c "import sys,json;[print(g['name'], len(g['rules'])) for g in json.load(sys.stdin)['data']['groups']]"
kill $PF
# Test delivery: post a synthetic alert straight to Alertmanager
kubectl port-forward -n monitoring svc/vmalertmanager-vm 9093:9093 >/dev/null 2>&1 & PF=$!; sleep 3
curl -s -XPOST http://localhost:9093/api/v2/alerts -H 'Content-Type: application/json' \
  -d '[{"labels":{"alertname":"TestAlert","severity":"info"},"annotations":{"summary":"mezo-ibxy test alert"}}]'
kill $PF
```

Expected: groups `mezo.availability`, `mezo.node`, `mezo.jobs`, `mezo.traffic` listed with their rule counts; the logs VMAlert `operational`; a Telegram message "TestAlert" arrives within ~30 s (group_wait), and a "resolved" one within a few minutes.

- [ ] **Step 4: Commit**

```bash
git add k8s/monitoring/vmrule-mezo.yaml k8s/monitoring/vmalert-logs.yaml k8s/monitoring/vmrule-logs.yaml
git commit -m "feat(infra): mezo alert rules, logs vmalert and Telegram delivery (mezo-ibxy)"
```

---

### Task 8: Grafana — custom mezo dashboard

**Files:**
- Create: `k8s/monitoring/grafana-dashboard-mezo.yaml`

**Interfaces:**
- Consumes: metrics from Task 6; Grafana sidecar label `grafana_dashboard: "1"` (chart default).
- Produces: dashboard "mezo" in Grafana's default folder.

- [ ] **Step 1: Dashboard ConfigMap (sidecar-loaded)**

`k8s/monitoring/grafana-dashboard-mezo.yaml`:

```yaml
# Custom "mezo" dashboard (mezo-ibxy), picked up by the Grafana dashboards sidecar.
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboard-mezo
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  mezo.json: |
    {
      "title": "mezo",
      "uid": "mezo-main",
      "schemaVersion": 39,
      "timezone": "Europe/Budapest",
      "refresh": "1m",
      "time": { "from": "now-24h", "to": "now" },
      "panels": [
        { "id": 1, "type": "timeseries", "title": "Backend requests/s by route",
          "gridPos": { "x": 0, "y": 0, "w": 12, "h": 8 },
          "targets": [ { "expr": "sum by (uri) (rate(http_server_requests_seconds_count{application=\"mezo-backend\"}[5m]))", "legendFormat": "{{uri}}" } ] },
        { "id": 2, "type": "timeseries", "title": "Backend 5xx rate",
          "gridPos": { "x": 12, "y": 0, "w": 12, "h": 8 },
          "fieldConfig": { "defaults": { "unit": "percentunit" } },
          "targets": [ { "expr": "sum(rate(http_server_requests_seconds_count{application=\"mezo-backend\",status=~\"5..\"}[5m])) / sum(rate(http_server_requests_seconds_count{application=\"mezo-backend\"}[5m]))", "legendFormat": "5xx" } ] },
        { "id": 3, "type": "timeseries", "title": "Backend p95 latency by route",
          "gridPos": { "x": 0, "y": 8, "w": 12, "h": 8 },
          "fieldConfig": { "defaults": { "unit": "s" } },
          "targets": [ { "expr": "histogram_quantile(0.95, sum by (le, uri) (rate(http_server_requests_seconds_bucket{application=\"mezo-backend\"}[5m])))", "legendFormat": "{{uri}}" } ] },
        { "id": 4, "type": "timeseries", "title": "JVM heap used / max",
          "gridPos": { "x": 12, "y": 8, "w": 12, "h": 8 },
          "fieldConfig": { "defaults": { "unit": "bytes" } },
          "targets": [
            { "expr": "sum(jvm_memory_used_bytes{application=\"mezo-backend\",area=\"heap\"})", "legendFormat": "used" },
            { "expr": "sum(jvm_memory_max_bytes{application=\"mezo-backend\",area=\"heap\"})", "legendFormat": "max" } ] },
        { "id": 5, "type": "timeseries", "title": "Postgres connections",
          "gridPos": { "x": 0, "y": 16, "w": 8, "h": 8 },
          "targets": [
            { "expr": "sum(pg_stat_activity_count)", "legendFormat": "active" },
            { "expr": "max(pg_settings_max_connections)", "legendFormat": "max" } ] },
        { "id": 6, "type": "timeseries", "title": "LLM tokens/h by model",
          "gridPos": { "x": 8, "y": 16, "w": 8, "h": 8 },
          "targets": [ { "expr": "sum by (gen_ai_request_model, gen_ai_token_type) (increase(gen_ai_client_token_usage_total[1h]))", "legendFormat": "{{gen_ai_request_model}} {{gen_ai_token_type}}" } ] },
        { "id": 7, "type": "stat", "title": "Backup last success (h ago)",
          "gridPos": { "x": 16, "y": 16, "w": 4, "h": 8 },
          "fieldConfig": { "defaults": { "unit": "h", "thresholds": { "mode": "absolute", "steps": [ { "color": "green", "value": null }, { "color": "red", "value": 26 } ] } } },
          "targets": [ { "expr": "(time() - kube_cronjob_status_last_successful_time{namespace=\"mezo\",cronjob=\"postgres-backup\"}) / 3600" } ] },
        { "id": 8, "type": "stat", "title": "Root disk free",
          "gridPos": { "x": 20, "y": 16, "w": 4, "h": 8 },
          "fieldConfig": { "defaults": { "unit": "percentunit", "thresholds": { "mode": "absolute", "steps": [ { "color": "red", "value": null }, { "color": "green", "value": 0.15 } ] } } },
          "targets": [ { "expr": "node_filesystem_avail_bytes{mountpoint=\"/\",fstype!=\"tmpfs\"} / node_filesystem_size_bytes{mountpoint=\"/\",fstype!=\"tmpfs\"}" } ] },
        { "id": 9, "type": "logs", "title": "Backend ERROR logs",
          "gridPos": { "x": 0, "y": 24, "w": 24, "h": 10 },
          "datasource": { "type": "victoriametrics-logs-datasource" },
          "targets": [ { "expr": "kubernetes.container_name:backend AND log.level:ERROR" } ] }
      ]
    }
```

- [ ] **Step 2: Validate the JSON and apply**

```bash
python3 -c "import sys,yaml,json;json.loads(yaml.safe_load(open('k8s/monitoring/grafana-dashboard-mezo.yaml'))['data']['mezo.json']);print('json ok')" 2>/dev/null || python3 -c "
import json,re;t=open('k8s/monitoring/grafana-dashboard-mezo.yaml').read();j=t.split('mezo.json: |',1)[1];json.loads('\n'.join(l[4:] for l in j.splitlines()));print('json ok')"
export KUBECONFIG=~/.kube/mezo-k3s.yaml
kubectl apply -f k8s/monitoring/grafana-dashboard-mezo.yaml
sleep 60
```

Expected: `json ok`; the "mezo" dashboard appears in Grafana within a minute; panels 1–4 and 6 show data once the Task 3 image is live, panels 5, 7, 8 immediately, panel 9 lists ERROR lines (empty is fine). Import the community dashboards by ID in the Grafana UI: 4701 (JVM Micrometer), 9628 (PostgreSQL), 17346 (Traefik) — these live on Grafana's PVC.

- [ ] **Step 3: Commit**

```bash
git add k8s/monitoring/grafana-dashboard-mezo.yaml
git commit -m "feat(infra): custom mezo Grafana dashboard (mezo-ibxy)"
```

---

### Task 9: Docs — ADR, infra docs, runbook, README; open the PR

**Files:**
- Create: `docs/decisions/0037-observability-stack-victoriametrics.md`
- Modify: `docs/infrastructure/deployment-k3s-argocd.md` (topology, layout, out-of-scope, staleness)
- Modify: `docs/infrastructure/runbook.md` (§1 table, §3 URLs, §4 Observability, §5 troubleshooting rows, §6 rebuild outline)
- Modify: `k8s/README.md` (layout, apply order)

- [ ] **Step 1: ADR**

`docs/decisions/0037-observability-stack-victoriametrics.md`:

```markdown
# 0037 — Observability: VictoriaMetrics k8s-stack + VictoriaLogs + Grafana, Telegram alerts

- **Status:** Accepted
- **Date:** 2026-09-06
- **Driver:** mezo-ibxy (the k3s box was blind: no metrics, no log search, no alerting)
- **Spec:** docs/superpowers/specs/2026-09-06-infra-observability-design.md

## Context

One 8 GB node runs the whole product. Measured 2026-09-06: 3.1 GiB memory used, disk 78 %
full (29 GiB of orphaned image layers). Options: kube-prometheus-stack (1.5–3 GB), Loki + Alloy
for logs (~0.7 GB, slower queries), VictoriaMetrics k8s-stack with VictoriaLogs (~1.3 GB, one
Helm release, one Grafana), or hosted SaaS.

## Decision

1. `victoria-metrics-k8s-stack` 0.91.2 with vlsingle/vlagent enabled, installed by a **second
   ArgoCD Application** (multi-source Helm, values in `k8s/monitoring/values.yaml`,
   `ServerSideApply`), namespace `monitoring`. Plain objects (scrapes, rules, dashboard,
   Tailscale ingress, SealedSecrets) stay under `k8s/monitoring/` in the existing mezo app.
2. Backend metrics on a **separate management port** (8081), cluster-internal, no JWT;
   ECS JSON logs; `-XX:MaxRAMPercentage=60`.
3. Alerting through the chart's vmalert + Alertmanager with the **native Telegram receiver**;
   a second vmalert evaluates LogsQL rules against VictoriaLogs.
4. **Disk first:** kubelet image-GC thresholds 70/60 %, journald cap, PVCs 5 + 5 + 1 Gi,
   retention 30 d metrics / 14 d logs.

## Consequences

- Grafana at `grafana.<tailnet>.ts.net` (never public). Runbook §4 *Observability*.
- Host-side files (`/etc/rancher/k3s/config.yaml`, Traefik `HelmChartConfig`) are not in git —
  the runbook lists them for a rebuild.
- Rejected: self-hosted Langfuse (six services), Grafana unified alerting (no log alerts),
  hand-run `helm install` (not reproducible), helm-rendered YAML in `k8s/` (CRD ordering).
- Follow-ups: per-feature LLM histograms + cron gauges (Micrometer), MDC trace id, GHCR tag
  retention, `sql_exporter` for pgvector index sizes.
```

- [ ] **Step 2: deployment-k3s-argocd.md**

- Topology block (line 10–35): add `│   ├ postgres-exporter Deployment` under `mezo` and a new block `namespace: monitoring — VictoriaMetrics k8s-stack (vmsingle, vmagent, vlsingle, vlagent, vmalert, alertmanager, grafana) ← Tailscale only`; change `CX32` → `CX33` in the diagram.
- Components table: add a row `| **Observability** | Helm release via `argocd/monitoring-application.yaml` + `k8s/monitoring/` | VictoriaMetrics + VictoriaLogs + Grafana (tailnet), Alertmanager → Telegram. [ADR 0037](../decisions/0037-observability-stack-victoriametrics.md). |`.
- Repository layout: add `monitoring/` (namespace, values, sealedsecrets, scrapes, rules, dashboard, ingress-tailscale), `postgres/exporter-*.yaml`, `postgres/backup-*.yaml`, `cert-manager/`, `pgadmin/ingress-tailscale.yaml`, `**/sealedsecret*.yaml`, and `argocd/monitoring-application.yaml`.
- Current deployment table: add `| Grafana (private) | `https://grafana.<tailnet>.ts.net` |`; images row → `<current tag from k8s/*/deployment.yaml>`; pgAdmin sentence at line 46 → "Tailscale ingress (`k8s/pgadmin/ingress-tailscale.yaml`)".
- Out of scope: delete the "Sealed Secrets / SOPS" bullet (done) and replace the observability bullet with `- ~~Observability~~ — DONE 2026-09-06, ADR 0037.`
- Line 154: change "Tests are intentionally NOT run in CI" to "Tests are intentionally NOT run in **deploy.yml**".

- [ ] **Step 3: runbook.md**

- §1 table: add `| `monitoring` | VictoriaMetrics k8s-stack: vmsingle/vmagent (metrics), vlsingle/vlagent (logs), vmalert + alertmanager (→ Telegram), Grafana | observability, ADR 0037 |` and `postgres-exporter` to the `mezo` row; images sentence → "tags in `k8s/*/deployment.yaml`".
- §3 URLs: add `Grafana: https://grafana.<tailnet>.ts.net` (login `admin`, password `kubectl get secret -n monitoring grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d`).
- §4 *Observability* (extend the Task 6 stub): how to check targets (`port-forward svc/vmagent-vm 8429` → `/targets`), rules (`svc/vmalert-vm 8080` → `/api/v1/rules`), logs query in Grafana Explore (`kubernetes.container_name:backend AND log.level:ERROR`), silence an alert (Alertmanager UI via `port-forward svc/vmalertmanager-vm 9093`), rotate the Telegram token (re-seal `alertmanager-config`), memory budget (`kubectl top pods -n monitoring`, expected ≤ 1.3 GiB), and the Task 1 disk section link.
- §5 rows: `| Telegram alert "BackendDown" | `kubectl get pods -n mezo`; management port probe: `kubectl exec deploy/backend -- wget -qO- localhost:8081/actuator/health` |`, `| No data in Grafana | vmagent targets page; `kubectl get vmservicescrape -A`; operator logs `kubectl logs -n monitoring deploy/vm-victoria-metrics-operator` |`, `| monitoring app OutOfSync on CRDs | must be ServerSideApply (never Replace); hard-refresh the app |`.
- §6 rebuild outline: insert "→ apply `argocd/monitoring-application.yaml` → re-create host files (kubelet GC, Traefik HelmChartConfig)".

- [ ] **Step 4: k8s/README.md**

- Layout tree: add `monitoring/` with one line per file, `postgres/exporter-deployment.yaml`, `exporter-service.yaml`, `backup-cronjob.yaml`, `backup-pvc.yaml`, `pgadmin/ingress-tailscale.yaml`, and `sealedsecret*.yaml` entries; fix `pgadmin/deployment.yaml # pgAdmin 4 (private, Tailscale ingress)`.
- Apply order: add step `5. observability: kubectl apply -f k8s/monitoring/namespace.yaml -f k8s/monitoring/sealedsecret-*.yaml && kubectl apply -f argocd/monitoring-application.yaml` and note the two host-side files.
- Also fix the two stale "no Ingress" comments: `k8s/pgadmin/deployment.yaml:2-3` and `k8s/pgadmin/service.yaml:1-2` → "private: reachable only over the Tailscale ingress (ingress-tailscale.yaml)".

- [ ] **Step 5: Gates, tracker export, PR**

```bash
node scripts/lint-docs.mjs --errors-only && node scripts/gen-codemap.mjs --check
git add docs k8s/README.md k8s/pgadmin/deployment.yaml k8s/pgadmin/service.yaml
git commit -m "docs(infra): ADR 0037 observability stack + runbook/deployment doc updates (mezo-ibxy)"
node scripts/check-beads-backup.mjs --fix && git add .beads/issues.jsonl && git commit -m "chore(beads): refresh tracker export (mezo-ibxy)"
git pull --rebase origin main && git push
gh pr create --fill --title "feat(infra): observability stack — VictoriaMetrics/Logs, Grafana, Telegram alerts (mezo-ibxy)" --body "Spec: docs/superpowers/specs/2026-09-06-infra-observability-design.md. Plan: docs/superpowers/plans/2026-09-06-infra-observability.md.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Then: wait for CI green → `gh workflow run premerge.yml -f pr=<n>` → `git checkout main && git pull --rebase && git merge --no-ff feat/infra-observability && git push` → after ArgoCD syncs, re-apply `argocd/monitoring-application.yaml` (ref back to `main`), re-run Task 6 Step 5's target check (backend must be `up` now) and confirm a Telegram "resolved" for any alert that fired during the rollout → `bd close` the child issues and the epic.
