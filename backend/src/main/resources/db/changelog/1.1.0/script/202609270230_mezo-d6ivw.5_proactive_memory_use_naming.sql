-- mezo-d6ivw.5 follow-up: bring the released proactive_memory_use index onto the naming convention
-- (idx_). 202609261600_mezo-d6ivw.5_proactive_memory_use.sql is immutable once released, so the
-- name is fixed here instead; the original file is grandfathered in scripts/lint-liquibase.mjs.
alter index ix_proactive_memory_use_lookup rename to idx_proactive_memory_use_lookup;
