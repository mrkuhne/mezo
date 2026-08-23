# Database Purge — Brand-New-User Restart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A one-off, hand-executed SQL purge script + runbook that wipes the live DB back to "brand new user" while keeping pantry, recipes, exercise catalog and the habit routine definitions (spec: `docs/superpowers/specs/2026-08-23-database-purge-restart-design.md`, bd mezo-rcsy).

**Architecture:** One pure-SQL `DO $$` block (no psql meta-commands, so both `psql` and JDBC can run it). It derives the purge set as *all `public` tables minus a hard-coded whitelist*, reports per-table row counts via `RAISE NOTICE`, and only truncates when the session GUC `purge.dry_run` is explicitly `off` — absent/any other value is a dry run. After truncating it re-counts the whitelist tables and raises (→ transaction abort) if any changed. A backend IT proves both modes against the real schema.

**Tech Stack:** PostgreSQL PL/pgSQL, Spring Boot IT harness (`AbstractIntegrationTest` + Testcontainers), plain Markdown runbook.

## Global Constraints

- Branch `claude/database-purge-prep-ed40c3` in this worktree; conventional commits carrying the bd id, e.g. `feat(scripts): ... (mezo-rcsy)`.
- Whitelist (KEEP) — exact, from the spec: `app_user`, `user_profiles`, `pantry_item`, `recipe`, `recipe_ingredient`, `exercise_catalog`, `habit_chain`, `habit_def`, `databasechangelog`, `databasechangeloglock`.
- The script must never enumerate the delete side — whitelist-complement only.
- Default behavior with no GUC set MUST be dry run (safe by default).
- Focused local tests only (16 GB rule does not apply on this machine, but stay focused anyway); full suite is CI's job. Run ITs with `-Dmezo.test.use-testcontainers=true` (the fixed-DB mode races — see bd memory).
- New backend test file ⇒ regenerate `docs/CODEMAP.md` (`node scripts/gen-codemap.mjs`) in the same change.

## File Structure

- `scripts/purge-restart.sql` — the purge script (pure SQL, single DO block).
- `backend/src/test/java/io/mrkuhne/mezo/PurgeRestartScriptIT.java` — IT exercising the script file from the repo (`../scripts/purge-restart.sql` relative to the backend module, Maven's working dir).
- `docs/infrastructure/purge-restart-runbook.md` — operator runbook.
- `docs/CODEMAP.md` — regenerated if the generator reports drift.

---

### Task 1: Purge script + IT (TDD)

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/PurgeRestartScriptIT.java`
- Create: `scripts/purge-restart.sql`

**Interfaces:**
- Consumes: `AbstractIntegrationTest` (auto DB reset per test), `DatabasePopulator.populateUser(String email) → UUID`, `PantryItemPopulator.createFood(UUID owner, String name, LocalDate expires)`, `WeightLogPopulator.createWeightLog(UUID owner, LocalDate date, BigDecimal weightKg)`, `HabitPopulator.pendingDay(UUID owner, LocalDate date)` (seeds habit_chain + habit_def catalog AND habit_day rows).
- Produces: `scripts/purge-restart.sql` — runnable via psql or JDBC; dry-run unless session GUC `purge.dry_run = 'off'`.

- [ ] **Step 1: Write the failing IT**

`backend/src/test/java/io/mrkuhne/mezo/PurgeRestartScriptIT.java` (root test package, alongside `MezoApplicationIT`; NOT `@Transactional` — the script manages its own atomicity, and `ResetDatabase` cleans up before the next test):

```java
package io.mrkuhne.mezo;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.HabitPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Exercises scripts/purge-restart.sql (bd mezo-rcsy) against the real schema:
 * dry run touches nothing; live run truncates everything outside the whitelist
 * and provably keeps the whitelist rows. Guards the script against schema drift
 * (a renamed kept table makes the script's whitelist-existence check raise).
 */
class PurgeRestartScriptIT extends AbstractIntegrationTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private HabitPopulator habitPopulator;

    private static final Path SCRIPT = Path.of("..", "scripts", "purge-restart.sql");

    private UUID seed() {
        UUID owner = databasePopulator.populateUser("purge@test.local");
        pantryItemPopulator.createFood(owner, "purge-keep-food", LocalDate.parse("2027-01-01"));
        weightLogPopulator.createWeightLog(owner, LocalDate.parse("2026-08-01"), new BigDecimal("80.00"));
        habitPopulator.pendingDay(owner, LocalDate.parse("2026-08-01")); // seeds chains+defs+day rows
        return owner;
    }

    private long count(String table) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table, Long.class);
    }

    /** Runs SET + script + RESET on ONE pooled connection (a plain JdbcTemplate.execute
     *  per statement may hit different pool connections, leaking the GUC). */
    private void runScript(boolean live) throws IOException {
        String sql = Files.readString(SCRIPT);
        jdbc.execute((ConnectionCallback<Void>) con -> {
            try (Statement st = con.createStatement()) {
                if (live) {
                    st.execute("SET purge.dry_run = 'off'");
                }
                st.execute(sql);
                st.execute("RESET purge.dry_run");
            }
            return null;
        });
    }

    @Test
    void testDryRun_shouldDeleteNothing_whenGucUnset() throws IOException {
        seed();
        long pantry = count("pantry_item");
        long weight = count("weight_log");
        long habitDays = count("habit_day");
        assertThat(weight).isPositive();

        runScript(false);

        assertThat(count("pantry_item")).isEqualTo(pantry);
        assertThat(count("weight_log")).isEqualTo(weight);
        assertThat(count("habit_day")).isEqualTo(habitDays);
    }

    @Test
    void testLiveRun_shouldPurgeComplementAndKeepWhitelist_whenGucOff() throws IOException {
        seed();
        long users = count("app_user");
        long pantry = count("pantry_item");
        long chains = count("habit_chain");
        long defs = count("habit_def");
        assertThat(count("weight_log")).isPositive();
        assertThat(count("habit_day")).isPositive();

        runScript(true);

        // purged side: logs gone, routine day-ticks gone
        assertThat(count("weight_log")).isZero();
        assertThat(count("habit_day")).isZero();
        // kept side: identity, pantry, routine definitions untouched
        assertThat(count("app_user")).isEqualTo(users);
        assertThat(count("pantry_item")).isEqualTo(pantry);
        assertThat(count("habit_chain")).isEqualTo(chains);
        assertThat(count("habit_def")).isEqualTo(defs);
        assertThat(count("databasechangelog")).isPositive(); // Liquibase history intact
    }
}
```

- [ ] **Step 2: Run the IT, verify it fails for the right reason**

```bash
cd backend && ./mvnw test -Dtest=PurgeRestartScriptIT -Dmezo.test.use-testcontainers=true
```

Expected: FAIL — `NoSuchFileException: ../scripts/purge-restart.sql` (the script does not exist yet).

- [ ] **Step 3: Write the script**

`scripts/purge-restart.sql`:

```sql
-- =============================================================================
-- purge-restart.sql — brand-new-user purge (bd mezo-rcsy)
-- Spec: docs/superpowers/specs/2026-08-23-database-purge-restart-design.md
-- Runbook: docs/infrastructure/purge-restart-runbook.md
--
-- DELIBERATE PHYSICAL DELETE (the mezo-lwmq precedent), overriding the repo's
-- is_deleted soft-delete convention: the point of the restart is that no trace
-- remains. Normal app deletion paths are unchanged.
--
-- Mechanics: everything in schema `public` EXCEPT the whitelist below is
-- TRUNCATE ... CASCADE'd. The delete side is never enumerated, so tables added
-- after this script was written are purged too. Safe by default: unless the
-- session GUC purge.dry_run is exactly 'off', the script only REPORTS what it
-- would do. The whole script is one DO block => one implicit transaction; any
-- RAISE EXCEPTION aborts it completely.
--
--   dry run : psql -v ON_ERROR_STOP=1 -f scripts/purge-restart.sql
--   live    : see the runbook (sets purge.dry_run=off via PGOPTIONS)
-- =============================================================================
DO $$
DECLARE
    whitelist constant text[] := ARRAY[
        'app_user', 'user_profiles',                    -- identity
        'pantry_item',                                  -- kamra
        'recipe', 'recipe_ingredient',                  -- receptek
        'exercise_catalog',                             -- gyakorlattar
        'habit_chain', 'habit_def',                     -- routine definitions (not habit_day!)
        'databasechangelog', 'databasechangeloglock'];  -- Liquibase bookkeeping
    dry_run  constant boolean := coalesce(current_setting('purge.dry_run', true), 'on') <> 'off';
    kept_counts jsonb := '{}'::jsonb;
    t           record;
    n           bigint;
    purge_list  text;
    missing     text[];
BEGIN
    -- Schema-drift guard: every whitelist table must exist under exactly this name.
    SELECT array_agg(w) INTO missing
      FROM unnest(whitelist) AS w
     WHERE NOT EXISTS (SELECT 1 FROM pg_tables p
                        WHERE p.schemaname = 'public' AND p.tablename = w);
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'whitelist table(s) missing from schema: % — script is stale, do not run', missing;
    END IF;

    RAISE NOTICE 'purge-restart mode: %', CASE WHEN dry_run THEN 'DRY RUN (reporting only)' ELSE 'LIVE' END;

    FOR t IN SELECT tablename FROM pg_tables
              WHERE schemaname = 'public' ORDER BY tablename LOOP
        EXECUTE format('SELECT count(*) FROM %I', t.tablename) INTO n;
        IF t.tablename = ANY (whitelist) THEN
            kept_counts := kept_counts || jsonb_build_object(t.tablename, n);
            RAISE NOTICE 'KEEP   % (% rows)', rpad(t.tablename, 40), n;
        ELSE
            purge_list := concat_ws(', ', purge_list, format('%I', t.tablename));
            RAISE NOTICE 'PURGE  % (% rows)', rpad(t.tablename, 40), n;
        END IF;
    END LOOP;

    IF purge_list IS NULL THEN
        RAISE NOTICE 'nothing to purge';
        RETURN;
    END IF;

    IF dry_run THEN
        RAISE NOTICE 'dry run — nothing deleted. Live run: set purge.dry_run=off (see runbook).';
        RETURN;
    END IF;

    EXECUTE 'TRUNCATE TABLE ' || purge_list || ' CASCADE';

    -- Assert the CASCADE never reached a kept table: identical row counts or abort.
    FOR t IN SELECT unnest(whitelist) AS tablename LOOP
        EXECUTE format('SELECT count(*) FROM %I', t.tablename) INTO n;
        IF n <> (kept_counts ->> t.tablename)::bigint THEN
            RAISE EXCEPTION 'kept table % changed (% -> % rows) — aborting, transaction rolls back',
                t.tablename, kept_counts ->> t.tablename, n;
        END IF;
    END LOOP;

    RAISE NOTICE 'purge complete — whitelist tables verified unchanged';
END $$;
```

- [ ] **Step 4: Run the IT, verify it passes**

```bash
cd backend && ./mvnw test -Dtest=PurgeRestartScriptIT -Dmezo.test.use-testcontainers=true
```

Expected: both tests PASS.

- [ ] **Step 5: Regenerate the codemap (new test file)**

```bash
node scripts/gen-codemap.mjs
```

Writes `docs/CODEMAP.md` only on change; commit it if it changed.

- [ ] **Step 6: Commit**

```bash
git add scripts/purge-restart.sql backend/src/test/java/io/mrkuhne/mezo/PurgeRestartScriptIT.java docs/CODEMAP.md
git commit -m "feat(scripts): brand-new-user DB purge script + IT (mezo-rcsy)"
```

---

### Task 2: Operator runbook

**Files:**
- Create: `docs/infrastructure/purge-restart-runbook.md`

**Interfaces:**
- Consumes: `scripts/purge-restart.sql` (Task 1), `scripts/backup-live-db.sh` (existing; dumps to `~/MrKuhne/mezo-live-backups/`), cluster facts: namespace `mezo`, pod `postgres-0`, DB/user `mezo`, deployment `backend`.
- Produces: the document the owner follows for the live purge.

- [ ] **Step 1: Write the runbook**

`docs/infrastructure/purge-restart-runbook.md`:

````markdown
# Purge-restart runbook — brand-new-user reset (mezo-rcsy)

One-off, hand-executed reset of the LIVE database. Keeps: `app_user`,
`user_profiles`, `pantry_item`, `recipe`, `recipe_ingredient`,
`exercise_catalog`, `habit_chain`, `habit_def` (+ Liquibase tables).
Deletes: everything else. Design:
[2026-08-23-database-purge-restart-design.md](../superpowers/specs/2026-08-23-database-purge-restart-design.md).

The script is safe by default: without `purge.dry_run=off` it only reports.

## 1. Fresh backup (mandatory)

```bash
./scripts/backup-live-db.sh
```

Verify the newest dump is readable:

```bash
ls -1t ~/MrKuhne/mezo-live-backups/mezo-*.dump | head -1
pg_restore --list "$(ls -1t ~/MrKuhne/mezo-live-backups/mezo-*.dump | head -1)" | head
```

## 2. Stop writes

```bash
kubectl scale -n mezo deploy/backend --replicas=0
```

ArgoCD self-heal may scale it back within minutes — either pause auto-sync for
the app in the ArgoCD UI first, or simply proceed immediately (the script runs
in seconds) and keep the PWA closed meanwhile.

## 3. Dry run

```bash
kubectl exec -i -n mezo postgres-0 -- psql -U mezo -d mezo -v ON_ERROR_STOP=1 -f - < scripts/purge-restart.sql
```

Read the `KEEP`/`PURGE` report. The `KEEP` row counts must match expectations
(pantry items, recipes, catalog rows, habit chains/defs, 1 app_user).

## 4. Live run

```bash
kubectl exec -i -n mezo postgres-0 -- env PGOPTIONS="-c purge.dry_run=off" psql -U mezo -d mezo -v ON_ERROR_STOP=1 -f - < scripts/purge-restart.sql
```

Expect `purge-restart mode: LIVE` and the final
`purge complete — whitelist tables verified unchanged`. Any exception means the
transaction rolled back and nothing changed.

## 5. Restart + smoke-check

```bash
kubectl scale -n mezo deploy/backend --replicas=1
```

In the PWA, open each surface and expect (spec §4):

- Today / Week: empty states; routine chains present with zero streak
- Train: no mesocycles/templates/futás/sport/gym; `/exercises` library intact
- Fuel: kamra + recipes intact; meals / slots / stack empty, settings default
- Sleep / weight / gyógyszer / ritual / napló: empty
- Chat / memória / knowledge / people / insights / predictions / memoir: empty
- medals / growth / progression: 0 XP, nothing owned
- értesítések: prefs default; re-enable push in the browser
- me / goals: profile present; goal + biometrics to re-enter

Any 500 → file its own bd issue (first-run bug, not a purge bug).

## 6. Rollback (if needed)

Restore the §1 dump (full overwrite, drops what was written since):

```bash
kubectl scale -n mezo deploy/backend --replicas=0
kubectl exec -i -n mezo postgres-0 -- pg_restore -U mezo -d mezo --clean --if-exists < ~/MrKuhne/mezo-live-backups/mezo-<STAMP>.dump
kubectl scale -n mezo deploy/backend --replicas=1
```
````

- [ ] **Step 2: Lint the docs**

```bash
node scripts/lint-docs.mjs
```

Expected: no new violations (fix any it reports for the new file).

- [ ] **Step 3: Commit**

```bash
git add docs/infrastructure/purge-restart-runbook.md
git commit -m "docs(infrastructure): purge-restart runbook (mezo-rcsy)"
```

---

### Task 3: Gates, push, PR

**Files:** none new.

- [ ] **Step 1: Focused verification once more, clean**

```bash
cd backend && ./mvnw test -Dtest=PurgeRestartScriptIT -Dmezo.test.use-testcontainers=true
```

Expected: PASS.

- [ ] **Step 2: Update the bd issue**

```bash
bd update mezo-rcsy --claim
bd comment mezo-rcsy "Script + IT + runbook implemented; live execution pending (owner runs the runbook)."
```

- [ ] **Step 3: Push branch and open the self-PR (CI gate)**

```bash
git push -u origin claude/database-purge-prep-ed40c3
gh pr create --title "feat(scripts): brand-new-user DB purge script + runbook (mezo-rcsy)" --body "One-off purge script (whitelist-complement TRUNCATE, dry-run by default) + IT + operator runbook. Spec: docs/superpowers/specs/2026-08-23-database-purge-restart-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Wait for CI green; then merge per the house flow (`git pull --rebase` on main → `--no-ff` merge → push). The bd issue stays open until the owner has actually run the runbook against live.
