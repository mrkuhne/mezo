-- Pénz L4 naming fix (mezo-r36n9.102): 202611191400_mezo-r36n9.102_penz.sql was released (deployed)
-- with five ix_-prefixed indexes; released changesets are immutable, so the live schema is renamed here
-- to the idx_ convention (lint-liquibase), and the original file is grandfathered.
alter index ix_penz_account_created_by rename to idx_penz_account_created_by;
alter index ix_penz_recurring_rule_created_by rename to idx_penz_recurring_rule_created_by;
alter index ix_penz_transaction_created_by_date rename to idx_penz_transaction_created_by_date;
alter index ix_penz_transaction_transfer_pair_id rename to idx_penz_transaction_transfer_pair_id;
alter index ix_penz_api_key_created_by rename to idx_penz_api_key_created_by;
