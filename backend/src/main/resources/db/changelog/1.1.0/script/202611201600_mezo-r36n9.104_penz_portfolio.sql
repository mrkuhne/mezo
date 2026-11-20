-- Boop Pénz L6 (mezo-r36n9.104): the portfolio by horizon and the daily news digest.
-- Money columns are bigint minor units (1/100 of the major unit, HUF included) in their own currency plus a HUF
-- twin booked once at write time (the L4 FX policy). Quotes are NOT ledger money: a per-unit market price is kept
-- as numeric. Global tables (quotes, articles, provider status) have no created_by.

-- A holding = one product in one sleeve. The same product in two sleeves is two holdings (spec §10.1.3).
create table penz_holding (
    id              uuid           not null default gen_random_uuid(),
    created_by      uuid           not null,
    is_deleted      boolean        not null default false,
    created_at      timestamptz    not null default now(),
    updated_at      timestamptz    not null default now(),
    name            varchar(80)    not null,
    asset_type      varchar(8)     not null,
    symbol          varchar(20),
    platform        varchar(8)     not null,
    platform_name   varchar(40),
    sleeve          varchar(5)     not null,
    currency        varchar(3)     not null,
    bond_rate_pct   numeric(7, 4),
    news_terms      jsonb          not null default '[]',
    note            varchar(500),
    position        integer        not null default 0,
    archived        boolean        not null default false,
    client_ref      uuid,
    constraint pk_penz_holding_id primary key (id),
    constraint fk_penz_holding_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_penz_holding_asset_type check (asset_type in ('bond', 'etf', 'stock', 'fund', 'crypto', 'cash')),
    constraint ck_penz_holding_platform check (platform in ('mbh', 'revolut', 'other')),
    constraint ck_penz_holding_sleeve check (sleeve in ('short', 'mid', 'long')),
    constraint ck_penz_holding_currency check (currency in ('HUF', 'EUR', 'USD', 'GBP', 'CHF')),
    constraint ck_penz_holding_position check (position >= 0)
);
create index idx_penz_holding_created_by on penz_holding (created_by) where is_deleted = false;
create unique index uq_penz_holding_created_by_client_ref on penz_holding (created_by, client_ref)
    where client_ref is not null and is_deleted = false;

-- One buy or sell. Each buy is a lot; a sell consumes lots oldest first (FIFO) — the lot-level cost basis.
-- amount_minor = the total paid / received in `currency` (the holding's currency), amount_huf_minor its HUF twin.
create table penz_invest_txn (
    id                uuid            not null default gen_random_uuid(),
    created_by        uuid            not null,
    is_deleted        boolean         not null default false,
    created_at        timestamptz     not null default now(),
    updated_at        timestamptz     not null default now(),
    holding_id        uuid            not null,
    side              varchar(4)      not null,
    quantity          numeric(24, 8),
    amount_minor      bigint          not null,
    currency          varchar(3)      not null,
    amount_huf_minor  bigint          not null,
    fx_rate           numeric(18, 8),
    fx_rate_date      date,
    date              date            not null,
    note              varchar(500),
    client_ref        uuid,
    constraint pk_penz_invest_txn_id primary key (id),
    constraint fk_penz_invest_txn_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_penz_invest_txn_holding_id_penz_holding_id foreign key (holding_id) references penz_holding (id) on delete cascade,
    constraint ck_penz_invest_txn_side check (side in ('buy', 'sell')),
    constraint ck_penz_invest_txn_quantity check (quantity is null or quantity > 0),
    constraint ck_penz_invest_txn_amount_minor check (amount_minor > 0),
    constraint ck_penz_invest_txn_currency check (currency in ('HUF', 'EUR', 'USD', 'GBP', 'CHF')),
    constraint ck_penz_invest_txn_fx check ((currency = 'HUF' and fx_rate is null and fx_rate_date is null)
        or (currency <> 'HUF' and fx_rate is not null and fx_rate_date is not null))
);
create index idx_penz_invest_txn_created_by_holding_id on penz_invest_txn (created_by, holding_id) where is_deleted = false;
create unique index uq_penz_invest_txn_created_by_client_ref on penz_invest_txn (created_by, client_ref)
    where client_ref is not null and is_deleted = false;

-- The forward timeline (spec §5.2): maturities, coupons, ex-dividend, earnings — owner-entered.
create table penz_holding_event (
    id            uuid          not null default gen_random_uuid(),
    created_by    uuid          not null,
    is_deleted    boolean       not null default false,
    created_at    timestamptz   not null default now(),
    updated_at    timestamptz   not null default now(),
    holding_id    uuid          not null,
    kind          varchar(9)    not null,
    date          date          not null,
    amount_minor  bigint,
    currency      varchar(3),
    note          varchar(200),
    client_ref    uuid,
    constraint pk_penz_holding_event_id primary key (id),
    constraint fk_penz_holding_event_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_penz_holding_event_holding_id_penz_holding_id foreign key (holding_id) references penz_holding (id) on delete cascade,
    constraint ck_penz_holding_event_kind check (kind in ('maturity', 'coupon', 'dividend', 'earnings', 'other')),
    constraint ck_penz_holding_event_amount check ((amount_minor is null and currency is null)
        or (amount_minor > 0 and currency in ('HUF', 'EUR', 'USD', 'GBP', 'CHF')))
);
create index idx_penz_holding_event_created_by_date on penz_holding_event (created_by, date) where is_deleted = false;
create unique index uq_penz_holding_event_created_by_client_ref on penz_holding_event (created_by, client_ref)
    where client_ref is not null and is_deleted = false;

-- Global quote cache, one row per symbol (a security or an FX pair like EURHUF=X). The valuation policy reads it.
create table penz_quote (
    id               uuid            not null default gen_random_uuid(),
    created_at       timestamptz     not null default now(),
    updated_at       timestamptz     not null default now(),
    symbol           varchar(20)     not null,
    currency         varchar(3)      not null,
    price            numeric(24, 8)  not null,
    previous_close   numeric(24, 8),
    market_time      timestamptz     not null,
    as_of            date            not null,
    fetched_at       timestamptz     not null,
    constraint pk_penz_quote_id primary key (id),
    constraint uq_penz_quote_symbol unique (symbol),
    constraint ck_penz_quote_price check (price > 0),
    constraint ck_penz_quote_previous_close check (previous_close is null or previous_close > 0)
);

-- Global news articles from the allow-listed feeds. Dedupe by url. Title and summary are UNTRUSTED text.
create table penz_news_article (
    id            uuid           not null default gen_random_uuid(),
    created_at    timestamptz    not null default now(),
    url           varchar(1000)  not null,
    source_key    varchar(40)    not null,
    source_name   varchar(80)    not null,
    title         varchar(300)   not null,
    summary       varchar(600),
    published_at  timestamptz,
    fetched_at    timestamptz    not null,
    constraint pk_penz_news_article_id primary key (id),
    constraint uq_penz_news_article_url unique (url)
);
create index idx_penz_news_article_published_at on penz_news_article (published_at);

-- One digest per owner per day. items = the stories with their computed figures and the (validated) narration.
create table penz_digest (
    id             uuid          not null default gen_random_uuid(),
    created_by     uuid          not null,
    is_deleted     boolean       not null default false,
    created_at     timestamptz   not null default now(),
    updated_at     timestamptz   not null default now(),
    digest_date    date          not null,
    status         varchar(6)    not null,
    items          jsonb         not null default '[]',
    generated_at   timestamptz   not null,
    prices_as_of   date,
    constraint pk_penz_digest_id primary key (id),
    constraint fk_penz_digest_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_penz_digest_status check (status in ('ready', 'quiet', 'failed'))
);
create unique index uq_penz_digest_created_by_digest_date on penz_digest (created_by, digest_date) where is_deleted = false;

-- Health of every outbound provider (each feed, the quote source). Nothing else records a failing third party:
-- the poller makes no row and no LLM call when a feed is down, so this table + its metrics are the alert's source.
create table penz_provider_status (
    id               uuid          not null default gen_random_uuid(),
    created_at       timestamptz   not null default now(),
    updated_at       timestamptz   not null default now(),
    provider_key     varchar(60)   not null,
    kind             varchar(6)    not null,
    last_success_at  timestamptz,
    last_failure_at  timestamptz,
    fail_streak      integer       not null default 0,
    last_error       varchar(200),
    constraint pk_penz_provider_status_id primary key (id),
    constraint uq_penz_provider_status_provider_key unique (provider_key),
    constraint ck_penz_provider_status_kind check (kind in ('news', 'quotes')),
    constraint ck_penz_provider_status_fail_streak check (fail_streak >= 0)
);
