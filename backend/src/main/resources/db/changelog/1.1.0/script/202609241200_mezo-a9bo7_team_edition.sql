create table team_edition (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 day date not null,
 status varchar(16) not null,
 generated_at timestamptz not null,
 conference_id uuid,
 constraint pk_team_edition_id primary key(id),
 constraint fk_team_edition_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint fk_team_edition_conference_id foreign key(conference_id) references character_conference(id),
 constraint ck_team_edition_status check(status in ('PUBLISHED','QUIET'))
);
create unique index uq_team_edition_day on team_edition(created_by, day) where is_deleted=false;
create index idx_team_edition_conference_id on team_edition(conference_id);

create table team_edition_post (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 edition_id uuid not null,
 rank smallint not null,
 character_key varchar(16) not null,
 genre varchar(16) not null,
 source_kind varchar(24) not null,
 source_id varchar(64) not null,
 source_route varchar(160) not null,
 title text,
 body text not null,
 voiced boolean not null default false,
 facts jsonb not null default '{"facts":[]}',
 refs jsonb not null default '{"refs":[]}',
 guests jsonb not null default '{"guests":[]}',
 constraint pk_team_edition_post_id primary key(id),
 constraint fk_team_edition_post_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint fk_team_edition_post_edition_id foreign key(edition_id) references team_edition(id) on delete cascade,
 constraint ck_team_edition_post_character check(character_key in ('szunya','mocor','falat','deru','mezo')),
 constraint ck_team_edition_post_genre check(genre in ('megfigyeles','sejtes','kerdes','kiserlet','elorejelzes','konzilium','keres','ertekeles')),
 constraint ck_team_edition_post_rank check(rank between 1 and 6)
);
create unique index uq_team_edition_post_rank on team_edition_post(edition_id, rank) where is_deleted=false;
create index idx_team_edition_post_edition_id on team_edition_post(edition_id);

alter table character_run drop constraint ck_character_run_kind;
alter table character_run add constraint ck_character_run_kind check (kind in ('NIGHTLY','WEEKLY','MONTHLY','BOOTSTRAP','EDITION'));
