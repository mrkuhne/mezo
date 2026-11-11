-- Boop B1 (mezo-r36n9.11): the DB guarantee behind "one night per date" — both writers merge.
create unique index uq_sleep_log_owner_date_live on sleep_log (created_by, date) where is_deleted = false;
