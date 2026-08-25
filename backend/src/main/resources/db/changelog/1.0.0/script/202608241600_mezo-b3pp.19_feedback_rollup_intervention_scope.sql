-- W5.2 (bd mezo-b3pp.19, spec §9.2): a fourth feedback_rollup scope shape,
-- 'intervention:<key>' — per-intervention-library-entry effectiveness, the selection weight
-- InterventionService reads back (up/total). CK swap only; table shape unchanged. Task 7 writes
-- these rows nightly; this task only needs the shape to exist so InterventionService/its tests
-- can seed and read them.

alter table feedback_rollup drop constraint ck_feedback_rollup_scope;
alter table feedback_rollup add constraint ck_feedback_rollup_scope
    check (scope = 'style' or scope like 'surface:%' or scope like 'feed:%' or scope like 'intervention:%');
