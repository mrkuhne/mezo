-- Boop B1 (mezo-r36n9.11): the winning app of a Health night and the heart rate while asleep.
alter table sleep_log add column source_app  varchar(80);
alter table sleep_log add column sleeping_hr integer;
alter table sleep_log add constraint ck_sleep_log_sleeping_hr_nonneg check (sleeping_hr is null or sleeping_hr >= 0);
