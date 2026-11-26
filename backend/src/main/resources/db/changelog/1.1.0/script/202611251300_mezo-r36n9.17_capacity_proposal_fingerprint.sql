-- Boop B7 K3 (mezo-r36n9.17, Task 17): a stored proposal keeps a fingerprint of the week parts it was built from (the
-- touched days' plan, calendar and accepted changes); accept recomputes it and refuses a stale proposal (409).
alter table capacity_proposal add column fingerprint varchar(64);
