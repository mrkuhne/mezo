create table gratitude_entry (
    id          uuid         not null default gen_random_uuid(),
    created_by  uuid         not null,
    is_deleted  boolean      not null default false,
    created_at  timestamptz  not null default now(),
    occurred_on date         not null,
    text        varchar(280) not null,
    life_area   varchar(16),
    constraint pk_gratitude_entry_id primary key (id),
    constraint fk_gratitude_entry_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_gratitude_entry_life_area check (life_area is null or life_area in
      ('mindfulness','mindset','cooking','financial','productivity','learning','connection','recovery'))
);
create index idx_gratitude_entry_created_by_occurred_on on gratitude_entry (created_by, occurred_on desc);
