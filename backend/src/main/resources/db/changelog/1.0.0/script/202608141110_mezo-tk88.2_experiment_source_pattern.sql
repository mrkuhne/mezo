-- Minták lifecycle dashboard S2 (bd mezo-tk88.2, spec 2026-08-14 §Backend 3).
-- The generators already resolve the model's patternIndex to a confirmed PatternEntity
-- (the confidence copy) — now the grounding is queryable. Pre-existing rows stay NULL.

alter table experiment add column source_pattern_id uuid;

alter table experiment add constraint fk_experiment_source_pattern_id_pattern_id
    foreign key (source_pattern_id) references pattern (id) on delete set null;

create index idx_experiment_source_pattern_id on experiment (source_pattern_id)
    where source_pattern_id is not null;
