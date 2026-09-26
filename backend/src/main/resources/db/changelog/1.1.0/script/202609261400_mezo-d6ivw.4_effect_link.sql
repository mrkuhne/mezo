create table effect_link (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 subject_kind varchar(8) not null,
 subject_key varchar(64) not null,
 metric varchar(8) not null,
 cliffs_delta numeric(5,3) not null,
 mean_diff numeric(5,2) not null,
 subject_days int not null,
 complement_days int not null,
 strength_band varchar(8) not null,
 confidence_tier varchar(8) not null,
 window_days int not null,
 computed_at timestamptz not null,
 constraint pk_effect_link_id primary key(id),
 constraint fk_effect_link_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint ck_effect_link_subject_kind check(subject_kind in ('person','event')),
 constraint ck_effect_link_metric check(metric in ('mental','energy','stress')),
 constraint ck_effect_link_strength check(strength_band in ('enyhe','kozepes','eros')),
 constraint ck_effect_link_confidence check(confidence_tier in ('gyenge','kozepes','eros'))
);
create unique index uq_effect_link_subject_metric on effect_link(created_by, subject_kind, subject_key, metric) where is_deleted = false;
