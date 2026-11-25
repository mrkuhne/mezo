-- Boop Éves terv (mezo-r36n9.113): one mesocycle is linked to at most one live year block. The service keeps this
-- (unlink-elsewhere before every link); the partial unique index makes it a database guarantee and replaces the
-- plain lookup index.
drop index if exists idx_training_year_block_mesocycle_id;
create unique index uq_training_year_block_mesocycle_id on training_year_block (mesocycle_id)
    where mesocycle_id is not null and is_deleted = false;
