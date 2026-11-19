-- Boop Pénz L4 (mezo-r36n9.102, spec §7, plan §2): the money foundation, modelled on the old Finance Tracker
-- entities. Every amount is a bigint in MINOR units (1/100 of the major unit for EVERY currency, HUF included:
-- 15 500 Ft = 1550000) in its own currency, plus a HUF twin (amount_huf_minor) computed ONCE at write time from
-- the ECB reference rate of the row's own date and stored — never re-derived. fx_rate / fx_rate_date are null
-- for HUF rows (rate 1, no conversion) and hold the rate actually used (and its ECB publication date) otherwise.

-- One row per owner: the knobs of the allowance. practice_monthly_minor is the Gyakorlás cap (spec §10.1.2),
-- deducted like a fixed cost. month_overrides: {"YYYY-MM": {"savingsTargetHufMinor": n, "categoryBudgets": {...}}}.
create table penz_settings (
    id                      uuid         not null default gen_random_uuid(),
    created_by              uuid         not null,
    is_deleted              boolean      not null default false,
    created_at              timestamptz  not null default now(),
    updated_at              timestamptz  not null default now(),
    savings_target_minor    bigint       not null default 0,
    practice_monthly_minor  bigint       not null default 2000000,
    week_start              varchar(10)  not null default 'monday',
    emergency_fund_months   integer      not null default 6,
    timezone                varchar(64)  not null default 'Europe/Budapest',
    month_overrides         jsonb        not null default '{}'::jsonb,
    constraint pk_penz_settings_id primary key (id),
    constraint fk_penz_settings_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_penz_settings_week_start check (week_start in ('monday')),
    constraint ck_penz_settings_savings_target_minor check (savings_target_minor >= 0),
    constraint ck_penz_settings_practice_monthly_minor check (practice_monthly_minor >= 0),
    constraint ck_penz_settings_emergency_fund_months check (emergency_fund_months between 0 and 60)
);
create unique index uq_penz_settings_created_by on penz_settings (created_by) where is_deleted = false;

create table penz_account (
    id                     uuid          not null default gen_random_uuid(),
    created_by             uuid          not null,
    is_deleted             boolean       not null default false,
    created_at             timestamptz   not null default now(),
    updated_at             timestamptz   not null default now(),
    name                   varchar(80)   not null,
    type                   varchar(12)   not null,
    currency               varchar(3)    not null,
    opening_balance_minor  bigint        not null default 0,
    is_default             boolean       not null default false,
    is_savings_target      boolean       not null default false,
    archived               boolean       not null default false,
    sms_sender             varchar(100),
    constraint pk_penz_account_id primary key (id),
    constraint fk_penz_account_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_penz_account_type check (type in ('checking', 'savings', 'cash', 'investment')),
    constraint ck_penz_account_currency check (currency in ('HUF', 'EUR', 'USD', 'GBP', 'CHF'))
);
create index ix_penz_account_created_by on penz_account (created_by) where is_deleted = false;
-- At most one default and one savings-target account per owner.
create unique index uq_penz_account_created_by_default on penz_account (created_by)
    where is_default = true and is_deleted = false;
create unique index uq_penz_account_created_by_savings_target on penz_account (created_by)
    where is_savings_target = true and is_deleted = false;

-- monthly_budget_minor is HUF minor units. The 15 Hungarian defaults are seeded per owner on first access.
create table penz_category (
    id                    uuid          not null default gen_random_uuid(),
    created_by            uuid          not null,
    is_deleted            boolean       not null default false,
    created_at            timestamptz   not null default now(),
    updated_at            timestamptz   not null default now(),
    name                  varchar(60)   not null,
    kind                  varchar(8)    not null,
    icon                  varchar(40),
    monthly_budget_minor  bigint,
    position              integer       not null default 0,
    constraint pk_penz_category_id primary key (id),
    constraint fk_penz_category_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_penz_category_kind check (kind in ('expense', 'income')),
    constraint ck_penz_category_monthly_budget_minor check (monthly_budget_minor >= 0)
);
create unique index uq_penz_category_created_by_kind_name on penz_category (created_by, kind, lower(name))
    where is_deleted = false;

create table penz_recurring_rule (
    id                      uuid           not null default gen_random_uuid(),
    created_by              uuid           not null,
    is_deleted              boolean        not null default false,
    created_at              timestamptz    not null default now(),
    updated_at              timestamptz    not null default now(),
    name                    varchar(80)    not null,
    kind                    varchar(8)     not null,
    amount_minor            bigint         not null,
    currency                varchar(3)     not null,
    amount_huf_minor        bigint         not null,
    fx_rate                 numeric(18, 8),
    fx_rate_date            date,
    category_id             uuid,
    account_id              uuid           not null,
    frequency               varchar(8)     not null,
    start_date              date           not null,
    end_date                date,
    last_materialized_date  date,
    active                  boolean        not null default true,
    constraint pk_penz_recurring_rule_id primary key (id),
    constraint fk_penz_recurring_rule_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_penz_recurring_rule_category_id_penz_category_id foreign key (category_id) references penz_category (id) on delete set null,
    constraint fk_penz_recurring_rule_account_id_penz_account_id foreign key (account_id) references penz_account (id) on delete cascade,
    constraint ck_penz_recurring_rule_kind check (kind in ('expense', 'income')),
    constraint ck_penz_recurring_rule_frequency check (frequency in ('weekly', 'monthly', 'yearly')),
    constraint ck_penz_recurring_rule_currency check (currency in ('HUF', 'EUR', 'USD', 'GBP', 'CHF')),
    constraint ck_penz_recurring_rule_amount_minor check (amount_minor > 0),
    constraint ck_penz_recurring_rule_dates check (end_date is null or end_date >= start_date)
);
create index ix_penz_recurring_rule_created_by on penz_recurring_rule (created_by) where is_deleted = false;

-- The bank SMS the iOS Shortcut posts (spec §10.1.7). Dedupe key: text_hash = sha256(trim(sender)|trim(text)),
-- written with native INSERT ... ON CONFLICT DO NOTHING (soft delete hides rows from derived finders).
-- text is dropped (null) for an SMS that does not look like money. transaction_id is a plain reference (the
-- transaction holds the FK back via sms_message_id).
create table penz_sms_message (
    id             uuid          not null default gen_random_uuid(),
    created_by     uuid          not null,
    is_deleted     boolean       not null default false,
    created_at     timestamptz   not null default now(),
    sender         varchar(100)  not null,
    text           text,
    text_hash      varchar(64)   not null,
    received_at    timestamptz   not null,
    status         varchar(10)   not null,
    reason         varchar(60),
    kind           varchar(8),
    amount_minor   bigint,
    currency       varchar(3),
    merchant       varchar(200),
    parsed_date    date,
    category_name  varchar(60),
    transaction_id uuid,
    constraint pk_penz_sms_message_id primary key (id),
    constraint fk_penz_sms_message_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_penz_sms_message_status check (status in ('parsed', 'ignored', 'failed', 'converted')),
    constraint ck_penz_sms_message_kind check (kind in ('expense', 'income'))
);
create unique index uq_penz_sms_message_created_by_text_hash on penz_sms_message (created_by, text_hash)
    where is_deleted = false;

create table penz_transaction (
    id                 uuid           not null default gen_random_uuid(),
    created_by         uuid           not null,
    is_deleted         boolean        not null default false,
    created_at         timestamptz    not null default now(),
    updated_at         timestamptz    not null default now(),
    account_id         uuid           not null,
    kind               varchar(12)    not null,
    amount_minor       bigint         not null,
    currency           varchar(3)     not null,
    amount_huf_minor   bigint         not null,
    fx_rate            numeric(18, 8),
    fx_rate_date       date,
    category_id        uuid,
    date               date           not null,
    note               varchar(500),
    source             varchar(10)    not null default 'manual',
    needs_review       boolean        not null default false,
    recurring_rule_id  uuid,
    transfer_pair_id   uuid,
    sms_message_id     uuid,
    client_ref         uuid,
    constraint pk_penz_transaction_id primary key (id),
    constraint fk_penz_transaction_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_penz_transaction_account_id_penz_account_id foreign key (account_id) references penz_account (id) on delete cascade,
    constraint fk_penz_transaction_category_id_penz_category_id foreign key (category_id) references penz_category (id) on delete set null,
    constraint fk_penz_transaction_recurring_rule_id_penz_recurring_rule_id foreign key (recurring_rule_id) references penz_recurring_rule (id) on delete set null,
    constraint fk_penz_transaction_sms_message_id_penz_sms_message_id foreign key (sms_message_id) references penz_sms_message (id) on delete set null,
    constraint ck_penz_transaction_kind check (kind in ('expense', 'income', 'transfer_out', 'transfer_in', 'invest_buy', 'invest_sell')),
    constraint ck_penz_transaction_source check (source in ('manual', 'sms', 'recurring')),
    constraint ck_penz_transaction_currency check (currency in ('HUF', 'EUR', 'USD', 'GBP', 'CHF')),
    constraint ck_penz_transaction_amount_minor check (amount_minor > 0),
    constraint ck_penz_transaction_fx check (
        (currency = 'HUF' and fx_rate is null and fx_rate_date is null)
        or (currency <> 'HUF' and fx_rate is not null and fx_rate_date is not null))
);
create index ix_penz_transaction_created_by_date on penz_transaction (created_by, date) where is_deleted = false;
create index ix_penz_transaction_transfer_pair_id on penz_transaction (transfer_pair_id) where transfer_pair_id is not null;
create unique index uq_penz_transaction_created_by_client_ref on penz_transaction (created_by, client_ref)
    where client_ref is not null and is_deleted = false;
create unique index uq_penz_transaction_sms_message_id on penz_transaction (sms_message_id)
    where sms_message_id is not null and is_deleted = false;
-- A recurring rule materializes at most once per date.
create unique index uq_penz_transaction_recurring_rule_id_date on penz_transaction (recurring_rule_id, date)
    where recurring_rule_id is not null and is_deleted = false;

-- One live close per owner and month ('YYYY-MM'). final_remaining_minor / deficit_minor are HUF minor units;
-- transfer_pair_id points at the transfer into the savings-target account when leftover_action = transferred.
create table penz_month_close (
    id                     uuid          not null default gen_random_uuid(),
    created_by             uuid          not null,
    is_deleted             boolean       not null default false,
    created_at             timestamptz   not null default now(),
    month                  varchar(7)    not null,
    final_remaining_minor  bigint        not null,
    deficit_minor          bigint        not null default 0,
    leftover_action        varchar(12)   not null,
    transfer_pair_id       uuid,
    closed_at              timestamptz   not null default now(),
    constraint pk_penz_month_close_id primary key (id),
    constraint fk_penz_month_close_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_penz_month_close_month check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    constraint ck_penz_month_close_leftover_action check (leftover_action in ('transferred', 'kept', 'none')),
    constraint ck_penz_month_close_deficit_minor check (deficit_minor >= 0)
);
create unique index uq_penz_month_close_created_by_month on penz_month_close (created_by, month) where is_deleted = false;

-- GLOBAL exchange-rate cache (not per user, no created_by): one HTTP fetch per (currency, date) ever.
-- rate_date is the date ASKED for; published_date is the ECB publication date frankfurter answered with (the
-- last one on or before rate_date — a weekend asks Friday's rate). rate = quote per one unit of base.
create table penz_fx_rate (
    id              uuid            not null default gen_random_uuid(),
    created_at      timestamptz     not null default now(),
    base            varchar(3)      not null,
    quote           varchar(3)      not null,
    rate_date       date            not null,
    published_date  date            not null,
    rate            numeric(18, 8)  not null,
    constraint pk_penz_fx_rate_id primary key (id),
    constraint uq_penz_fx_rate_base_quote_rate_date unique (base, quote, rate_date),
    constraint ck_penz_fx_rate_rate check (rate > 0),
    constraint ck_penz_fx_rate_published_date check (published_date <= rate_date)
);

-- The SMS ingest's API keys (spec §10.1.7): only the SHA-256 hex of the key and its last four characters.
create table penz_api_key (
    id            uuid          not null default gen_random_uuid(),
    created_by    uuid          not null,
    is_deleted    boolean       not null default false,
    created_at    timestamptz   not null default now(),
    name          varchar(60)   not null,
    key_hash      varchar(64)   not null,
    last4         varchar(4)    not null,
    revoked       boolean       not null default false,
    last_used_at  timestamptz,
    constraint pk_penz_api_key_id primary key (id),
    constraint fk_penz_api_key_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint uq_penz_api_key_key_hash unique (key_hash)
);
create index ix_penz_api_key_created_by on penz_api_key (created_by) where is_deleted = false;
