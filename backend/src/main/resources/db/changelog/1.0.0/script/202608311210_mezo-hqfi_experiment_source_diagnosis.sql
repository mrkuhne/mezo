-- Diagnosis → experiment hand-off (bd mezo-hqfi.3, spec 2026-08-31 §4). The tap on
-- "✓ Próbáljuk ki" IS the acceptance, so the row is created active. source_diagnosis_id mirrors
-- source_pattern_id (202608141110_mezo-tk88.2_experiment_source_pattern.sql); source records
-- WHICH origin produced the row, so the pre-existing proposal-generated ones stay honest.

alter table experiment add column source varchar(20) not null default 'proposal';
alter table experiment add column source_diagnosis_id uuid;

alter table experiment add constraint ck_experiment_source check (source in ('proposal', 'diagnosis'));

alter table experiment add constraint fk_experiment_source_diagnosis_id_diagnosis_id
    foreign key (source_diagnosis_id) references diagnosis (id) on delete set null;

create index idx_experiment_source_diagnosis_id on experiment (source_diagnosis_id)
    where source_diagnosis_id is not null;
