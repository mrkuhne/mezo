-- Fuel Stack/Protocol (mezo-09g). protocol persists ONLY selection + version metadata (spec
-- 2026-07-02): timing slots are recomputed by the FE buildProtocol, so no slot snapshot here.
-- protocol_item is the normalized selection (FK -> pantry_item, RESTRICT). supplement_intake is
-- an append-only taken-ledger mirroring medication_dose (ADR 0005: supplements live in pantry_item).
create table protocol (
    id                 uuid        not null default gen_random_uuid(),
    created_by         uuid        not null,
    is_deleted         boolean     not null default false,
    created_at         timestamptz not null default now(),
    version            integer     not null,
    built_at           timestamptz not null,
    status             text        not null,
    confidence         numeric,
    last_replan_reason text,
    constraint pk_protocol_id primary key (id),
    constraint fk_protocol_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_protocol_status check (status in ('active','superseded')),
    constraint uq_protocol_created_by_version unique (created_by, version)
);

create unique index uq_protocol_active_per_user on protocol (created_by) where status = 'active' and is_deleted = false;
create index idx_protocol_created_by on protocol (created_by);

create table protocol_item (
    id             uuid        not null default gen_random_uuid(),
    created_by     uuid        not null,
    is_deleted     boolean     not null default false,
    created_at     timestamptz not null default now(),
    protocol_id    uuid        not null,
    pantry_item_id uuid        not null,
    item_order     integer     not null,
    constraint pk_protocol_item_id primary key (id),
    constraint fk_protocol_item_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_protocol_item_protocol_id_protocol_id foreign key (protocol_id) references protocol (id) on delete cascade,
    constraint fk_protocol_item_pantry_item_id_pantry_item_id foreign key (pantry_item_id) references pantry_item (id) on delete restrict
);

create index idx_protocol_item_protocol_id on protocol_item (protocol_id);
create index idx_protocol_item_pantry_item_id on protocol_item (pantry_item_id);

create table supplement_intake (
    id             uuid        not null default gen_random_uuid(),
    created_by     uuid        not null,
    is_deleted     boolean     not null default false,
    created_at     timestamptz not null default now(),
    pantry_item_id uuid        not null,
    taken_at       timestamptz not null,
    taken_date     date        not null,
    slot_key       text,
    dose           text,
    note           text,
    constraint pk_supplement_intake_id primary key (id),
    constraint fk_supplement_intake_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_supplement_intake_pantry_item_id_pantry_item_id foreign key (pantry_item_id) references pantry_item (id) on delete restrict
);

create index idx_supplement_intake_created_by_taken_date on supplement_intake (created_by, taken_date);
