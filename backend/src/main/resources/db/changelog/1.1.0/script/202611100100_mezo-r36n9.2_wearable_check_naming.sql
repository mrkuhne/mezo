-- mezo-r36n9.2: 202611092310_mezo-r36n9.2_wearable_tables.sql was released (deployed) with unnamed
-- inline CHECK constraints; give them the house ck_ names in the live schema.
alter table daily_metric rename constraint daily_metric_steps_check       to ck_daily_metric_steps_nonneg;
alter table daily_metric rename constraint daily_metric_resting_hr_check  to ck_daily_metric_resting_hr_nonneg;
alter table daily_metric rename constraint daily_metric_avg_hr_check      to ck_daily_metric_avg_hr_nonneg;
alter table daily_metric rename constraint daily_metric_min_hr_check      to ck_daily_metric_min_hr_nonneg;
alter table daily_metric rename constraint daily_metric_max_hr_check      to ck_daily_metric_max_hr_nonneg;
alter table daily_metric rename constraint daily_metric_active_kcal_check to ck_daily_metric_active_kcal_nonneg;
alter table wearable_workout rename constraint wearable_workout_kcal_check   to ck_wearable_workout_kcal_nonneg;
alter table wearable_workout rename constraint wearable_workout_avg_hr_check to ck_wearable_workout_avg_hr_nonneg;
