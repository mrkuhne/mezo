-- Kihagyás S3 (mezo-q4xt2.3, spec §10): a skipped MEAL slot. session_key = '<slotKind>#<n>'
-- (n = 1-based index among the day's planned windows of that kind); planned_kcal = the slot's
-- budget at skip time, a snapshot (windows exist only in the FE). New reason NOT_HUNGRY (MEAL only).
alter table planned_skip add column planned_kcal integer;
alter table planned_skip drop constraint ck_planned_skip_kind;
alter table planned_skip add constraint ck_planned_skip_kind check (kind in ('GYM', 'SPORT', 'RUN', 'MEAL'));
alter table planned_skip drop constraint ck_planned_skip_reason;
alter table planned_skip add constraint ck_planned_skip_reason check (reason_category in
    ('ILLNESS', 'STOMACH', 'INJURY', 'TRAVEL', 'TIRED', 'NO_TIME', 'NO_MOOD', 'NOT_HUNGRY', 'OTHER', 'NONE'));
alter table planned_skip drop constraint ck_planned_skip_target;
alter table planned_skip add constraint ck_planned_skip_target check (
    (kind = 'GYM'   and day_of_week is null and time is null and session_key is null) or
    (kind = 'SPORT' and day_of_week is not null and time is not null and session_key is null) or
    (kind = 'RUN'   and day_of_week is null and time is null and session_key is not null) or
    (kind = 'MEAL'  and day_of_week is null and time is null and session_key is not null));
alter table planned_skip add constraint ck_planned_skip_planned_kcal check (
    planned_kcal is null or (kind = 'MEAL' and planned_kcal between 0 and 5000));
