# Liquibase Conventions

## Directory Structure

```
src/main/resources/db/changelog/
├── db.changelog-master.yaml     # Main changelog (don't rename)
├── 1.0.0/
│   ├── 1.0.0_master.yml
│   └── script/
│       └── 202601150930_F001_create_users_table.sql
└── 1.1.0/
    ├── 1.1.0_master.yml
    └── script/
        └── 202602031415_F002_add_email_column.sql
```

## ChangeSet Format

```yaml
- changeSet:
    id: 1.2.0:202604221430_F006_task_short_description
    author: firstname.lastname
    changes:
      - sqlFile:
          relativeToChangelogFile: true
          path: script/202604221430_F006_task_short_description.sql
```

| Field | Rule | Example |
|---|---|---|
| `id` | `{version}:{YYYYMMDDHHMM}_F{NNN}_{short_description}` | `1.2.0:202604221430_F006_add_user_email` |
| `author` | Email prefix | `john.doe` |
| `path` | Under `script/`, prefixed with `{YYYYMMDDHHMM}_F{NNN}_` | `script/202604221430_F006_add_user_email.sql` |

### Filename prefix rule

Every script filename (and matching changeSet `id` suffix) **MUST** start with `{YYYYMMDDHHMM}_F{NNN}_` where:

- `{YYYYMMDDHHMM}` — the UTC minute the changeset was first authored (exactly 12 digits).
- `F{NNN}` — the spec-kit feature ID driving the change, zero-padded to 3 digits (e.g. `F001`, `F042`). Matches the folder name under `specs/` (e.g. `specs/006-…/` → `F006`).

Rationale:

- **Timestamp** guarantees deterministic chronological ordering inside a version folder, independent of filesystem sort locale, and makes `git log` archaeology trivial.
- **Feature prefix** lets you trace every migration back to the spec that motivated it — critical when diagnosing a migration in production or writing a rollback PR months later.
- Prevents duplicate `id`s when two features land in the same release version.

Rules:

- Timestamp: exactly 12 digits, UTC, minute granularity. Do not add seconds.
- Feature ID: always `F` + 3 digits, even for single-digit features (`F007`, not `F7`).
- Both parts are assigned **once** at creation and are immutable — never rename a released changeset to "fix" its timestamp or feature ID (see Core Rule #1).
- If two scripts would collide within the same minute, bump one of them by one minute — do not add suffixes like `_a` / `_b`.
- If a single feature needs multiple migrations, each gets its own timestamp; the `F{NNN}` stays the same.

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
# ✅ CORRECT — timestamp + feature ID + description
script/
├── 202604221430_F006_add_user_registration.sql
└── 202604231015_F007_add_payment_tables.sql

# ❌ WRONG — table-based
script/
├── users_ddl.sql
├── users_dml.sql
└── roles_ddl.sql

# ❌ WRONG — missing timestamp or feature prefix
script/
├── add_user_registration.sql
├── F006_add_user_registration.sql
└── 202604221430_add_user_registration.sql
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

```sql
-- 202604221430_F006_add_user_registration.sql

-- DDL
CREATE TABLE user_profile (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL
);

-- DML
INSERT INTO user_profile (user_id)
SELECT id FROM users WHERE profile_id IS NULL;
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
-- script/202601151045_F001_create_embeddings_pgvector.sql

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
