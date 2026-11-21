-- Boop B7 K3 (mezo-r36n9.17, spec 2026-11-21 §5.5): an accepted capacity proposal may skip a gym session through the
-- ordinary planned-skip path, with its own reason KAPACITAS (excused like coach advice, never spends the weekly pass).
alter table planned_skip drop constraint ck_planned_skip_reason;
alter table planned_skip add constraint ck_planned_skip_reason check (reason_category in
    ('ILLNESS', 'STOMACH', 'INJURY', 'TRAVEL', 'TIRED', 'NO_TIME', 'NO_MOOD', 'NOT_HUNGRY', 'OTHER', 'NONE', 'KAPACITAS'));
