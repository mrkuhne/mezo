-- Reflexió S2 (bd mezo-eq85.2, spec 2026-09-06 §4.2–4.3): one lifecycle for every pattern kind.
-- The `reflection` kind joins statistical/ai_hypothesis; `refuted`/`dormant` join the four user
-- states as ENGINE-owned terminal/parked states (a user-judged confirmed/rejected row is never
-- moved by the engine). belief/evidence_hits/evidence_misses are deterministic code outputs —
-- never an LLM estimate.
alter table pattern drop constraint ck_pattern_kind;
alter table pattern add constraint ck_pattern_kind check (kind in ('statistical', 'ai_hypothesis', 'reflection'));
alter table pattern drop constraint ck_pattern_status;
alter table pattern add constraint ck_pattern_status check (status in ('proposed', 'monitoring', 'confirmed', 'rejected', 'refuted', 'dormant'));

alter table pattern
    add column hypothesis_key  varchar(80),
    add column test_plan       jsonb,
    add column belief          numeric(4, 3),
    add column evidence_hits   integer not null default 0,
    add column evidence_misses integer not null default 0,
    add column origin          varchar(24);

alter table pattern add constraint ck_pattern_origin
    check (origin is null or origin in ('pair_catalog', 'weekly_hypothesis', 'quick_notice', 'nightly_reflection'));

-- Hypothesis identity: one LIVE row per (user, hypothesis key) — partial so a soft-deleted row
-- doesn't block a re-proposal, and so the pre-S2 rows (key null) are unaffected.
create unique index uq_pattern_created_by_hypothesis_key on pattern (created_by, hypothesis_key)
    where hypothesis_key is not null and is_deleted = false;

alter table pattern_event drop constraint ck_pattern_event_kind;
alter table pattern_event add constraint ck_pattern_event_kind
    check (kind in ('snapshot', 'confirmed', 'monitoring', 'rejected', 'reinforced', 'promoted',
                    'observation', 'evidence', 'user_reply', 'revised', 'refuted', 'dormant'));
