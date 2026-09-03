-- Mezo-kalauz seen-store (bd mezo-gb1s.1, spec docs/superpowers/specs/2026-09-02-mezo-kalauz-tutorial-design.md §6).
-- Per-user singleton (fuel_settings shape): one live row per owner, the whole guide-progress map as jsonb.
-- Keys are frontend registry ids; the backend stores, never validates them.

create table tutorial_progress (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz,
    progress    jsonb       not null default '{}'::jsonb,
    constraint pk_tutorial_progress_id primary key (id),
    constraint fk_tutorial_progress_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);
create unique index uq_tutorial_progress_user on tutorial_progress (created_by) where is_deleted = false;
