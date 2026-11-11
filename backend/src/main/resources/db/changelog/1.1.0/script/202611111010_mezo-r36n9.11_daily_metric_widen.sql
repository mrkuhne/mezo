-- Boop B1 (mezo-r36n9.11): more day rollups from Apple Health. All nullable; non-negative checks
-- except the wrist temperature (a signed value).
alter table daily_metric add column distance_m   integer;
alter table daily_metric add column basal_kcal   integer;
alter table daily_metric add column exercise_min integer;
alter table daily_metric add column mindful_min  integer;
alter table daily_metric add column daylight_min integer;
alter table daily_metric add column walking_hr   integer;
alter table daily_metric add column hrv_ms       numeric(6,1);
alter table daily_metric add column resp_rate    numeric(4,1);
alter table daily_metric add column spo2_pct     numeric(4,1);
alter table daily_metric add column vo2max       numeric(4,1);
alter table daily_metric add column wrist_temp_c numeric(4,2);
alter table daily_metric add constraint ck_daily_metric_distance_m_nonneg   check (distance_m is null or distance_m >= 0);
alter table daily_metric add constraint ck_daily_metric_basal_kcal_nonneg   check (basal_kcal is null or basal_kcal >= 0);
alter table daily_metric add constraint ck_daily_metric_exercise_min_nonneg check (exercise_min is null or exercise_min >= 0);
alter table daily_metric add constraint ck_daily_metric_mindful_min_nonneg  check (mindful_min is null or mindful_min >= 0);
alter table daily_metric add constraint ck_daily_metric_daylight_min_nonneg check (daylight_min is null or daylight_min >= 0);
alter table daily_metric add constraint ck_daily_metric_walking_hr_nonneg   check (walking_hr is null or walking_hr >= 0);
alter table daily_metric add constraint ck_daily_metric_hrv_ms_nonneg       check (hrv_ms is null or hrv_ms >= 0);
alter table daily_metric add constraint ck_daily_metric_resp_rate_nonneg    check (resp_rate is null or resp_rate >= 0);
alter table daily_metric add constraint ck_daily_metric_spo2_pct_nonneg     check (spo2_pct is null or spo2_pct >= 0);
alter table daily_metric add constraint ck_daily_metric_vo2max_nonneg       check (vo2max is null or vo2max >= 0);
