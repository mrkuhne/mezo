-- Boop Pénz L7 (mezo-r36n9.105): the curated product list and the investment proposals (build notes §1 calls
-- 10–16). Per owner. jsonb columns are read in Java only — never queried with the jsonb key operator in SQL (it
-- is a JDBC placeholder). Nothing here is ledger money: a proposal records what Boop suggested and what he chose,
-- never a transaction or a holding.

-- One product he may be offered. Seeded once per owner and seed key from a researched list (status suggested,
-- suggested_by research); added by him (approved, suggested_by owner). Only approved rows can appear in a proposal.
-- seed_key is unique per owner across deleted rows too, so a seed row is inserted at most once ever.
create table penz_product (
    id              uuid           not null default gen_random_uuid(),
    created_by      uuid           not null,
    is_deleted      boolean        not null default false,
    created_at      timestamptz    not null default now(),
    updated_at      timestamptz    not null default now(),
    seed_key        varchar(40),
    name            varchar(120)   not null,
    kind            varchar(13)    not null,
    currency        varchar(3)     not null,
    sleeves         jsonb          not null default '[]',
    what_it_is      varchar(600)   not null,
    ter_pct         numeric(6, 3),
    entry_fee_pct   numeric(6, 3),
    fee_note        varchar(300),
    distribution    varchar(12)    not null,
    isin            varchar(12),
    symbol          varchar(20),
    source_name     varchar(120),
    source_url      varchar(500),
    reviewed_at     date           not null,
    status          varchar(9)     not null,
    suggested_by    varchar(8)     not null,
    approved_at     timestamptz,
    constraint pk_penz_product_id primary key (id),
    constraint fk_penz_product_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_penz_product_kind check (kind in ('state_bond', 'money_market', 'bond_etf', 'equity_etf', 'mixed_fund', 'deposit')),
    constraint ck_penz_product_currency check (currency in ('HUF', 'EUR', 'USD', 'GBP', 'CHF')),
    constraint ck_penz_product_distribution check (distribution in ('accumulating', 'distributing', 'interest')),
    constraint ck_penz_product_status check (status in ('suggested', 'approved', 'declined')),
    constraint ck_penz_product_suggested_by check (suggested_by in ('research', 'owner')),
    constraint ck_penz_product_ter_pct check (ter_pct is null or ter_pct >= 0),
    constraint ck_penz_product_entry_fee_pct check (entry_fee_pct is null or entry_fee_pct >= 0)
);
create index idx_penz_product_created_by on penz_product (created_by) where is_deleted = false;
create unique index uq_penz_product_created_by_seed_key on penz_product (created_by, seed_key)
    where seed_key is not null;

-- One proposal: the split of one amount across the sleeves with the offered options and the (validated) narration
-- in `body`, and — once accepted — his own numbers as the checklist in `plan`. `month` = the Budapest month it was
-- made in (the monthly strategy reads last month's accepted figure from it).
create table penz_proposal (
    id                uuid          not null default gen_random_uuid(),
    created_by        uuid          not null,
    is_deleted        boolean       not null default false,
    created_at        timestamptz   not null default now(),
    updated_at        timestamptz   not null default now(),
    kind              varchar(8)    not null,
    status            varchar(10)   not null,
    amount_huf_minor  bigint        not null,
    month             varchar(7)    not null,
    body              jsonb         not null,
    plan              jsonb         not null default '[]',
    accepted_at       timestamptz,
    constraint pk_penz_proposal_id primary key (id),
    constraint fk_penz_proposal_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_penz_proposal_kind check (kind in ('lump_sum', 'monthly')),
    constraint ck_penz_proposal_status check (status in ('proposed', 'accepted', 'dismissed', 'superseded')),
    constraint ck_penz_proposal_amount_huf_minor check (amount_huf_minor > 0)
);
create index idx_penz_proposal_created_by_kind_status on penz_proposal (created_by, kind, status) where is_deleted = false;
