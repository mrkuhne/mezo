# Liquibase Conventions

## Directory Structure

```
src/main/resources/db/changelog/
├── db.changelog-master.yaml     # Main changelog (don't rename)
├── 1.0.0/
│   ├── 1.0.0_master.yml
│   └── script/
│       └── 202606101300_mezo-v67_create_weight_log.sql
└── 1.1.0/
    ├── 1.1.0_master.yml
    └── script/
        └── 202607021015_mezo-ah18_add_note_column.sql
```

## ChangeSet Format

```yaml
- changeSet:
    id: 1.0.0:202606101300_mezo-v67_create_weight_log
    author: firstname.lastname
    changes:
      - sqlFile:
          relativeToChangelogFile: true
          path: script/202606101300_mezo-v67_create_weight_log.sql
```

| Field | Rule | Example |
|---|---|---|
| `id` | `{version}:{YYYYMMDDHHMM}_{bd-id}_{short_description}` | `1.0.0:202606101300_mezo-v67_create_weight_log` |
| `author` | Email prefix | `john.doe` |
| `path` | Under `script/`, prefixed with `{YYYYMMDDHHMM}_{bd-id}_` | `script/202606101300_mezo-v67_create_weight_log.sql` |

### Filename prefix rule

Every script filename (and matching changeSet `id` suffix) **MUST** start with `{YYYYMMDDHHMM}_{bd-id}_` where:

- `{YYYYMMDDHHMM}` — the UTC minute the changeset was first authored (exactly 12 digits).
- `{bd-id}` — the **driving beads issue ID** exactly as issued (e.g. `mezo-v67`, `mezo-n5q`). `bd show <id>` must resolve to the work that motivated the migration.

Rationale:

- **Timestamp** guarantees deterministic chronological ordering inside a version folder, independent of filesystem sort locale, and makes `git log` archaeology trivial.
- **Issue prefix** lets you trace every migration back to the bd issue that motivated it — critical when diagnosing a migration in production or writing a rollback months later.
- Prevents duplicate `id`s when two features land in the same release version.

Rules:

- Timestamp: exactly 12 digits, UTC, minute granularity. Do not add seconds.
- Issue ID: the beads ID verbatim, lowercase (`mezo-v67`) — never invent or abbreviate one.
- Both parts are assigned **once** at creation and are immutable — never rename a released changeset to "fix" its timestamp or issue ID (see Core Rule #1).
- If two scripts would collide within the same minute, bump one of them by one minute — do not add suffixes like `_a` / `_b`.
- If a single issue needs multiple migrations, each gets its own timestamp; the `{bd-id}` stays the same.

## Core Rules

### 1. NEVER modify released changesets

```
# ❌ FORBIDDEN — if 1.0.0 is in production, don't touch it
# Modifying 1.0.0/1.0.0_master.yml

# ✅ CORRECT — new changeset in 1.1.0
# 1.1.0/1.1.0_master.yml
```

### 2. One development = One SQL file

Feature-based, not table-based.

```
# ✅ CORRECT — timestamp + bd issue ID + description
script/
├── 202606101300_mezo-v67_create_weight_log.sql
└── 202606111400_mezo-n5q_create_train.sql

# ❌ WRONG — table-based
script/
├── users_ddl.sql
├── users_dml.sql
└── roles_ddl.sql

# ❌ WRONG — missing timestamp or issue prefix
script/
├── create_weight_log.sql
├── mezo-v67_create_weight_log.sql
└── 202606101300_create_weight_log.sql
```

### 3. Entity annotations must mirror constraints

Every constraint in the Liquibase script (`NOT NULL`, `VARCHAR(N)`, `CHECK`) MUST be reflected on the JPA entity. The entity is a runtime source of truth — if constraints diverge, Hibernate may try to persist data the DB will reject, or silently accept data the DB considers invalid.

| Liquibase | JPA Entity |
|---|---|
| `NOT NULL` | `@Column(nullable = false)` + `@NotNull` |
| `VARCHAR(255)` | `@Column(length = 255)` + `@Size(max = 255)` |
| `CHECK (status IN ('A','I'))` | `@Enumerated(EnumType.STRING)` or `@Pattern` |

```java
// Liquibase: VARCHAR(100) NOT NULL
@Column(name = "username", nullable = false, length = 100)
@NotNull
@Size(max = 100)
private String username;
```

### 4. DDL and DML in same file

Primary keys are **UUID** in this project (`gen_random_uuid()`), and every constraint gets an
explicit name (see Constraint Naming). Backfill DML that migrates existing rows is allowed
here; **seed/demo data is not** (see Demo / Seed Data).

```sql
-- 202607021015_mezo-ah18_add_user_profile.sql

-- DDL
CREATE TABLE user_profile (
    id UUID DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL,
    CONSTRAINT pk_user_profile_id PRIMARY KEY (id)
);

-- DML (backfill of existing data — allowed; seed data is NOT)
INSERT INTO user_profile (created_by)
SELECT id FROM app_user WHERE profile_id IS NULL;
```

## Constraint Naming (REQUIRED)

Format: `{type}_{table}_{column}` or `{type}_{table}_{column}_{ref_table}_{ref_column}`

| Type | Prefix | Example |
|---|---|---|
| Primary Key | `pk_` | `pk_users_id` |
| Foreign Key | `fk_` | `fk_loan_user_id_users_id` |
| Unique | `uq_` | `uq_users_email` |
| Check | `ck_` | `ck_energy_check_ins_energy_range` |
| Index | `idx_` | `idx_sleep_logs_user_id_date` |

```sql
-- ✅ CORRECT — explicit name
ALTER TABLE loan
ADD CONSTRAINT fk_loan_user_id_users_id
FOREIGN KEY (user_id) REFERENCES users(id);

-- ❌ WRONG — auto-generated name
ALTER TABLE loan
ADD FOREIGN KEY (user_id) REFERENCES users(id);
```

**Max constraint name length: 63 characters** (PostgreSQL limit).

## Indexing Convention (owned tables)

Every domain table is owner-scoped (`created_by`) and every repository query filters on it, so:

- **Lead composite indexes with `created_by`**, then the common filter/sort column:
  `idx_<table>_created_by_date`, `idx_<table>_created_by_status`. This is the established
  pattern across the slices — follow it for every new owned table.
- **Index every FK column** used for child-by-parent lookups (`idx_<table>_<parent>_id`).
- Before finishing a migration, check the feature's repository methods: **every derived query
  must have a supporting index** (a `findByCreatedByAndX` needs an index leading with
  `created_by`; a child-table query via the parent FK can lean on the FK index).

## Demo / Seed Data

Java `@Profile("demodata")`, NOT SQL scripts.

```java
@Component
@Profile("demodata")
@RequiredArgsConstructor
public class ExerciseSeedData implements CommandLineRunner {

    private final ExerciseRepository exerciseRepository;

    @Override
    public void run(String... args) {
        if (exerciseRepository.count() == 0) {
            exerciseRepository.saveAll(List.of(
                new ExerciseEntity("Squat", MuscleGroup.LEGS, ...),
                new ExerciseEntity("Bench Press", MuscleGroup.CHEST, ...)
            ));
        }
    }
}
```

## pgvector Specific

For the embeddings table with pgvector, use raw SQL since Liquibase doesn't natively support vector types:

```sql
-- script/202601151045_mezo-xxx_create_embeddings_pgvector.sql

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL,
    user_id UUID NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
) PARTITION BY HASH (user_id);

-- 32 hash partitions
CREATE TABLE embeddings_p00 PARTITION OF embeddings FOR VALUES WITH (MODULUS 32, REMAINDER 0);
CREATE TABLE embeddings_p01 PARTITION OF embeddings FOR VALUES WITH (MODULUS 32, REMAINDER 1);
-- ... repeat for p02-p31

-- HNSW index (created on each partition automatically)
CREATE INDEX idx_embeddings_vector ON embeddings USING hnsw (embedding vector_cosine_ops);
```
