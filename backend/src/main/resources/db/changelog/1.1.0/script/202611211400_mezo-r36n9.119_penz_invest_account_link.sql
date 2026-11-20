-- Boop Pénz (mezo-r36n9.119): an investment buy / sell linked to the money account it was paid from / into.
-- The linked money row is an ordinary penz_transaction (kind invest_buy / invest_sell, in the account's currency,
-- its own HUF twin), so the account balance and the allowance "invested" line see it. Null = not linked (every
-- row recorded before this change, and a buy recorded without an account).
alter table penz_invest_txn add column transaction_id uuid;
alter table penz_invest_txn add constraint fk_penz_invest_txn_transaction_id_penz_transaction_id
    foreign key (transaction_id) references penz_transaction (id);
create index idx_penz_invest_txn_transaction_id on penz_invest_txn (transaction_id)
    where transaction_id is not null and is_deleted = false;
