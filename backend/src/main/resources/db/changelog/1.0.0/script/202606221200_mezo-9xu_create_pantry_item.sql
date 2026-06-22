create table pantry_item (
    id              uuid         not null default gen_random_uuid(),
    created_by      uuid         not null,
    is_deleted      boolean      not null default false,
    created_at      timestamptz  not null default now(),
    updated_at      timestamptz,
    kind            text         not null,
    name            text         not null,
    brand           text,
    source          text         not null default 'manual',
    category        text,
    notes           text,
    -- food / nutrition
    serving_amount  numeric,
    serving_unit    text,
    kcal            numeric,
    protein_g       numeric,
    carbs_g         numeric,
    fat_g           numeric,
    price_huf       integer,
    price_unit      text,
    package_label   text,
    micros          jsonb,
    nova            smallint,
    -- stock (expiry food-only)
    stock_qty       numeric,
    stock_unit      text,
    stock_expires   date,
    -- supplement / stim
    dose            text,
    form            text,
    protocol        text,
    timing          text,
    taken           boolean      not null default false,
    caffeine        boolean,
    constraint pk_pantry_item_id primary key (id),
    constraint fk_pantry_item_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_pantry_item_kind check (kind in ('food','supplement','stim','med')),
    constraint ck_pantry_item_source check (source in ('kifli.hu','myprotein.hu','tesco.hu','auchan.hu','manual')),
    constraint ck_pantry_item_nova check (nova is null or nova between 1 and 4)
);

create index idx_pantry_item_created_by on pantry_item (created_by);
create index idx_pantry_item_created_by_kind on pantry_item (created_by, kind);
