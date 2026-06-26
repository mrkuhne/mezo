-- Fuel Gyógyszer (mezo-d94): the medication master + its dose-administration ledger.
-- Both tables are OWNED (created_by FK -> app_user via app-level filtering, soft-delete via is_deleted).
-- medication is the catalog row (name, active ingredient, route, cadence, default dose + a jsonb cycle
-- envelope describing the on/off schedule). medication_dose is an append-only log of actual intakes,
-- each referencing its medication (ON DELETE RESTRICT so a logged dose pins its medication in place).

create table medication (
    id                uuid         not null default gen_random_uuid(),
    created_by        uuid         not null,
    name              varchar(120) not null,
    active_ingredient varchar(120),
    route             varchar(40),
    cadence           varchar(40),
    default_dose      numeric,
    dose_unit         varchar(20),
    cycle             jsonb        not null,
    is_active         boolean      not null default true,
    is_deleted        boolean      not null default false,
    created_at        timestamptz  not null default now(),
    updated_at        timestamptz  not null default now(),
    constraint pk_medication primary key (id)
);

create index idx_medication_owner on medication (created_by) where is_deleted = false;

create table medication_dose (
    id               uuid         not null default gen_random_uuid(),
    created_by       uuid         not null,
    medication_id    uuid         not null,
    administered_at  timestamptz  not null,
    administered_date date        not null,
    dose             numeric      not null,
    note             text,
    is_deleted       boolean      not null default false,
    created_at       timestamptz  not null default now(),
    updated_at       timestamptz  not null default now(),
    constraint pk_medication_dose primary key (id),
    constraint fk_medication_dose_medication foreign key (medication_id) references medication (id) on delete restrict
);

create index idx_medication_dose_lookup on medication_dose (created_by, medication_id, administered_date) where is_deleted = false;
