-- Boop Levél (mezo-r36n9.38): the morning post. A read-only mirror mailbox, its per-folder cursors, one row per
-- pipeline run, the stored messages (sensitive ones headers-only), the classified items and the owner's feedback.
-- Seed sender lists live in code; mail_sender_rule holds owner rules at runtime (origin 'seed' is reserved).

create table mail_mailbox (
    id              uuid          not null default gen_random_uuid(),
    created_by      uuid          not null,
    is_deleted      boolean       not null default false,
    created_at      timestamptz   not null default now(),
    address         varchar(254)  not null,
    secret_cipher   bytea,
    secret_nonce    bytea,
    state           varchar(16)   not null default 'connected',
    zero_run_streak integer       not null default 0,
    last_run_at     timestamptz,
    constraint pk_mail_mailbox_id primary key (id),
    constraint fk_mail_mailbox_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_mail_mailbox_state check (state in ('connected', 'auth_failed', 'silent', 'disconnected')),
    constraint ck_mail_mailbox_zero_run_streak check (zero_run_streak >= 0)
);
create unique index uq_mail_mailbox_created_by on mail_mailbox (created_by) where is_deleted = false;

create table mail_folder_cursor (
    id           uuid         not null default gen_random_uuid(),
    created_by   uuid         not null,
    is_deleted   boolean      not null default false,
    created_at   timestamptz  not null default now(),
    mailbox_id   uuid         not null,
    folder       varchar(64)  not null,
    uidvalidity  bigint       not null,
    last_uid     bigint       not null default 0,
    constraint pk_mail_folder_cursor_id primary key (id),
    constraint fk_mail_folder_cursor_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_mail_folder_cursor_mailbox_id_mail_mailbox_id foreign key (mailbox_id) references mail_mailbox (id) on delete cascade,
    constraint ck_mail_folder_cursor_last_uid check (last_uid >= 0)
);
create unique index uq_mail_folder_cursor_mailbox_id_folder on mail_folder_cursor (mailbox_id, folder);

create table mail_run (
    id           uuid         not null default gen_random_uuid(),
    created_by   uuid         not null,
    is_deleted   boolean      not null default false,
    created_at   timestamptz  not null default now(),
    mailbox_id   uuid         not null,
    started_at   timestamptz  not null,
    finished_at  timestamptz,
    trigger      varchar(8)   not null,
    fetched      integer      not null default 0,
    classified   integer      not null default 0,
    rules_only   boolean      not null default false,
    rules_only_reason varchar(8),
    outcome      varchar(16)  not null,
    error_code   varchar(64),
    constraint pk_mail_run_id primary key (id),
    constraint fk_mail_run_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_mail_run_mailbox_id_mail_mailbox_id foreign key (mailbox_id) references mail_mailbox (id) on delete cascade,
    constraint ck_mail_run_trigger check (trigger in ('cron', 'manual')),
    constraint ck_mail_run_rules_only_reason check (rules_only_reason is null or rules_only_reason in ('cap', 'failure'))
);
create index idx_mail_run_mailbox_id_started_at on mail_run (mailbox_id, started_at);

create table mail_message (
    id             uuid          not null default gen_random_uuid(),
    created_by     uuid          not null,
    is_deleted     boolean       not null default false,
    created_at     timestamptz   not null default now(),
    mailbox_id     uuid          not null,
    gm_msgid       bigint,
    message_id     varchar(998)  not null,
    content_hash   char(64)      not null,
    folder         varchar(64)   not null,
    uid            bigint        not null,
    uidvalidity    bigint        not null,
    received_at    timestamptz   not null,
    from_addr      varchar(254)  not null,
    from_name      varchar(200),
    via            varchar(8)    not null default 'unknown',
    subject        text,
    body_redacted  text,
    body_purged    boolean       not null default false,
    sensitive      boolean       not null default false,
    processed_at   timestamptz,
    constraint pk_mail_message_id primary key (id),
    constraint fk_mail_message_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_mail_message_mailbox_id_mail_mailbox_id foreign key (mailbox_id) references mail_mailbox (id) on delete cascade,
    constraint ck_mail_message_via check (via in ('gmail', 'icloud', 'unknown'))
);
create unique index uq_mail_message_mailbox_id_gm_msgid on mail_message (mailbox_id, gm_msgid) where gm_msgid is not null;
create unique index uq_mail_message_mailbox_id_content_hash on mail_message (mailbox_id, content_hash);
create index idx_mail_message_mailbox_id_received_at on mail_message (mailbox_id, received_at);

create table mail_item (
    id                uuid          not null default gen_random_uuid(),
    created_by        uuid          not null,
    is_deleted        boolean       not null default false,
    created_at        timestamptz   not null default now(),
    message_id        uuid          not null,
    grp               varchar(12)   not null,
    category          varchar(24)   not null,
    title             varchar(200)  not null,
    summary           varchar(400)  not null,
    why               varchar(300)  not null,
    score             smallint,
    due_at            timestamptz,
    valid_until       timestamptz,
    amount_minor      bigint,
    currency          varchar(3),
    carrier           varchar(16),
    parcel_key        varchar(64),
    parcel_state      varchar(12),
    state_changed_at  timestamptz   not null default now(),
    open_until        timestamptz   not null,
    screen            varchar(8)    not null default 'none',
    source            varchar(8)    not null,
    first_seen_run    uuid,
    constraint pk_mail_item_id primary key (id),
    constraint fk_mail_item_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_mail_item_message_id_mail_message_id foreign key (message_id) references mail_message (id) on delete cascade,
    constraint ck_mail_item_grp check (grp in ('deadline', 'parcel', 'deal', 'rest', 'person', 'sensitive')),
    constraint ck_mail_item_score check (score is null or score between 1 and 10),
    constraint ck_mail_item_parcel_state check (parcel_state is null or parcel_state in ('in_transit', 'today', 'pickup', 'delivered')),
    constraint ck_mail_item_screen check (screen in ('none', 'clean', 'flagged', 'unknown')),
    constraint ck_mail_item_source check (source in ('rule', 'jsonld', 'model'))
);
create index idx_mail_item_created_by_open_until on mail_item (created_by, open_until) where is_deleted = false;
create index idx_mail_item_message_id on mail_item (message_id);
create unique index uq_mail_item_created_by_carrier_parcel_key on mail_item (created_by, carrier, parcel_key)
    where parcel_key is not null;

create table mail_feedback (
    id          uuid          not null default gen_random_uuid(),
    created_by  uuid          not null,
    is_deleted  boolean       not null default false,
    created_at  timestamptz   not null default now(),
    item_id     uuid          not null,
    verdict     varchar(8)    not null,
    from_addr   varchar(254)  not null,
    summary     varchar(200)  not null,
    updated_at  timestamptz   not null default now(),
    constraint pk_mail_feedback_id primary key (id),
    constraint fk_mail_feedback_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_mail_feedback_item_id_mail_item_id foreign key (item_id) references mail_item (id) on delete cascade,
    constraint ck_mail_feedback_verdict check (verdict in ('interest', 'nope'))
);
create index idx_mail_feedback_created_by_created_at on mail_feedback (created_by, created_at) where is_deleted = false;

create table mail_sender_rule (
    id          uuid          not null default gen_random_uuid(),
    created_by  uuid          not null,
    is_deleted  boolean       not null default false,
    created_at  timestamptz   not null default now(),
    pattern     varchar(254)  not null,
    kind        varchar(10)   not null,
    origin      varchar(8)    not null default 'owner',
    constraint pk_mail_sender_rule_id primary key (id),
    constraint fk_mail_sender_rule_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_mail_sender_rule_kind check (kind in ('sensitive', 'silent', 'always')),
    constraint ck_mail_sender_rule_origin check (origin in ('seed', 'owner'))
);
create unique index uq_mail_sender_rule_created_by_pattern_kind on mail_sender_rule (created_by, pattern, kind)
    where is_deleted = false;
