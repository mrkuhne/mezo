-- Progressive overload Plan 3 (bd mezo-gj42): the deterministic daily "overload" challenge type.
-- Extends the released ck_challenge_type CHECK (202607072100) — dropped + recreated (immutable rule).
alter table challenge drop constraint ck_challenge_type;
alter table challenge add constraint ck_challenge_type check (type in ('PR', 'Depth', 'Volume', 'overload'));
