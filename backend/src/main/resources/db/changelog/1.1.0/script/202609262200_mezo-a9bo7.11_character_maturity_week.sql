create table character_maturity_week (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 dimension_id uuid not null,
 week_start date not null,
 maturity smallint not null,
 claim_count smallint not null,
 mean_confidence numeric(4,3),
 updated_at timestamptz not null default now(),
 constraint pk_character_maturity_week_id primary key(id),
 constraint fk_character_maturity_week_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint fk_character_maturity_week_dimension_id foreign key(dimension_id) references character_dimension(id) on delete cascade,
 constraint ck_character_maturity_week_maturity check(maturity between 0 and 100),
 constraint ck_character_maturity_week_claim_count check(claim_count >= 0),
 constraint ck_character_maturity_week_monday check(extract(isodow from week_start) = 1)
);
create unique index uq_character_maturity_week on character_maturity_week(created_by, dimension_id, week_start) where is_deleted=false;
create index idx_character_maturity_week_dimension_id on character_maturity_week(dimension_id);
create index idx_character_maturity_week_owner_week on character_maturity_week(created_by, week_start);
