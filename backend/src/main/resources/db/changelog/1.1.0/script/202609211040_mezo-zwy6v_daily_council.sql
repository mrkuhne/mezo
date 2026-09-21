alter table character_conference drop constraint ck_character_conference_kind;
alter table character_conference add constraint ck_character_conference_kind check (kind in ('BOOTSTRAP','WEEKLY','MONTHLY','DAILY'));
create unique index uq_character_conference_daily on character_conference(created_by,week_start) where kind='DAILY' and is_deleted=false;

create table character_council_edition (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 day date not null,
 status varchar(16) not null,
 attempts integer not null default 0,
 processing_token uuid,
 started_at timestamptz,
 completed_at timestamptz,
 conference_id uuid,
 constraint ck_character_council_edition_attempts check(attempts>=0),
 constraint pk_character_council_edition_id primary key(id),
 constraint fk_character_council_edition_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint fk_character_council_edition_conference_id foreign key(conference_id) references character_conference(id),
 constraint ck_character_council_edition_status check(status in ('WAITING','PROCESSING','COMPLETED','QUIET','FAILED'))
);
create unique index uq_character_council_edition_day on character_council_edition(created_by,day) where is_deleted=false;
create index idx_character_council_edition_conference_id on character_council_edition(conference_id);

create table character_claim_revision (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 claim_id uuid not null,
 operation varchar(16) not null,
 before_snapshot jsonb,
 after_snapshot jsonb not null,
 reason text not null,
 undone_at timestamptz,
 constraint pk_character_claim_revision_id primary key(id),
 constraint fk_character_claim_revision_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint fk_character_claim_revision_claim_id foreign key(claim_id) references character_claim(id),
 constraint ck_character_claim_revision_operation check(operation in ('NEW','UP','DOWN','RETIRE','REVISE','MOVE','REPLY'))
);
create index idx_character_claim_revision_owner_claim on character_claim_revision(created_by,claim_id,created_at);
create index idx_character_claim_revision_claim_id on character_claim_revision(claim_id);
alter table character_claim add column observed_from date;
alter table character_claim add column observed_to date;
alter table character_claim add column valid_from date;
alter table character_claim add column valid_to date;
alter table character_claim add constraint ck_character_claim_observed_window check(observed_from is null or observed_to is null or observed_from<=observed_to);
alter table character_claim add constraint ck_character_claim_valid_window check(valid_from is null or valid_to is null or valid_from<=valid_to);
alter table character_reply add column discussion jsonb;

alter table character_reply drop constraint ck_character_reply_source_type;
alter table character_reply add constraint ck_character_reply_source_type check(source_type in ('OBSERVATION','CLAIM','CONFERENCE_CHANGE','CONFERENCE_ITEM'));
alter table character_reply drop constraint ck_character_reply_source_index;
alter table character_reply add constraint ck_character_reply_source_index check(source_index between 0 and 9999 and (source_type in ('CONFERENCE_CHANGE','CONFERENCE_ITEM') or source_index=0));

-- Historical completion was not verified; only a fresh successful pass unblocks a daily edition.
alter table character_run add column status varchar(10) not null default 'UNKNOWN';
alter table character_run add column failure_count integer not null default 0;
alter table character_run add constraint ck_character_run_status check (status in ('UNKNOWN','SUCCESS','FAILED'));
alter table character_run add constraint ck_character_run_failure_count check (failure_count >= 0);

-- Operational counters intentionally have no account FK: independent reservations must not
-- wait on the caller's account lock or disappear when its domain transaction rolls back.
-- No source/user content is retained; configured retention removes old owner/day counters.
CREATE TABLE character_council_quota (
    created_by uuid NOT NULL,
    day date NOT NULL,
    total_calls integer NOT NULL,
    autonomous_calls integer NOT NULL,
    CONSTRAINT pk_character_council_quota PRIMARY KEY (created_by, day),
    CONSTRAINT ck_character_council_quota_counts CHECK (total_calls >= 0 AND autonomous_calls >= 0 AND autonomous_calls <= total_calls)
);
CREATE INDEX idx_character_council_quota_day ON character_council_quota(day);

alter table character_conference add column followups jsonb;
