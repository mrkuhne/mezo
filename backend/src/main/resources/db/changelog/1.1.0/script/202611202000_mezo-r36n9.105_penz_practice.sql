-- Boop Pénz L7 (mezo-r36n9.105): Gyakorlás — paper trades (plan -> open -> closed, or cancelled).
-- Prices are per-unit minor units (1/100 of the major unit, HUF included) of the instrument's own currency, typed
-- by the owner (no market data). HUF twins follow the L4 booking policy at the trade's own dates and are stored:
-- fx_rate/fx_rate_date = the rate the plan figures were valued at (the entry date's once opened), cost/risk at the
-- entry date, P/L at the exit date, the unrealized P/L at the typed last close's date. `paper` is true on every row
-- in phase 1. `tags` is a jsonb array of the eight fixed keys, read in Java only.
create table penz_paper_trade (
    id                       uuid           not null default gen_random_uuid(),
    created_by               uuid           not null,
    is_deleted               boolean        not null default false,
    created_at               timestamptz    not null default now(),
    updated_at               timestamptz    not null default now(),
    paper                    boolean        not null default true,
    status                   varchar(9)     not null default 'planned',
    instrument               varchar(60)    not null,
    direction                varchar(5)     not null,
    why                      varchar(500)   not null,
    currency                 varchar(3)     not null,
    quantity                 numeric(24, 8) not null,
    planned_entry_minor      bigint,
    stop_minor               bigint         not null,
    target_minor             bigint,
    fx_rate                  numeric(18, 8),
    fx_rate_date             date,
    entry_minor              bigint,
    entry_date               date,
    risk_minor               bigint,
    risk_huf_minor           bigint,
    cost_huf_minor           bigint,
    exit_minor               bigint,
    exit_date                date,
    exit_fx_rate             numeric(18, 8),
    exit_fx_rate_date        date,
    pnl_minor                bigint,
    pnl_huf_minor            bigint,
    r_multiple               numeric(10, 2),
    last_close_minor         bigint,
    last_close_date          date,
    last_close_fx_rate       numeric(18, 8),
    last_close_fx_rate_date  date,
    unrealized_huf_minor     bigint,
    tags                     jsonb          not null default '[]',
    mistake                  boolean        not null default false,
    line                     varchar(140),
    client_ref               uuid,
    constraint pk_penz_paper_trade_id primary key (id),
    constraint fk_penz_paper_trade_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_penz_paper_trade_status check (status in ('planned', 'open', 'closed', 'cancelled')),
    constraint ck_penz_paper_trade_direction check (direction in ('long', 'short')),
    constraint ck_penz_paper_trade_currency check (currency in ('HUF', 'EUR', 'USD', 'GBP', 'CHF')),
    constraint ck_penz_paper_trade_quantity check (quantity > 0),
    constraint ck_penz_paper_trade_prices check (stop_minor > 0
        and (planned_entry_minor is null or planned_entry_minor > 0)
        and (target_minor is null or target_minor > 0)
        and (entry_minor is null or entry_minor > 0)
        and (exit_minor is null or exit_minor > 0)
        and (last_close_minor is null or last_close_minor > 0)),
    constraint ck_penz_paper_trade_opened check (status in ('planned', 'cancelled')
        or (entry_minor is not null and entry_date is not null and cost_huf_minor is not null)),
    constraint ck_penz_paper_trade_closed check (status <> 'closed'
        or (exit_minor is not null and exit_date is not null and pnl_huf_minor is not null)),
    constraint ck_penz_paper_trade_fx check ((currency = 'HUF' and fx_rate is null and fx_rate_date is null)
        or (currency <> 'HUF' and fx_rate is not null and fx_rate_date is not null))
);
create index idx_penz_paper_trade_created_by_status on penz_paper_trade (created_by, status) where is_deleted = false;
create unique index uq_penz_paper_trade_created_by_client_ref on penz_paper_trade (created_by, client_ref)
    where client_ref is not null and is_deleted = false;
