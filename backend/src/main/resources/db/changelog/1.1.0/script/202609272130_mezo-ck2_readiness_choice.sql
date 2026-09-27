-- Check-in 2.0 training readiness (mezo-ck2, spec 2026-09-27 §3.3): the user's per-day answer to
-- the Edzés "Könnyebb nap javasolt" card. LIGHTEN = today's prescriptions hold every weight and the
-- pain-loaded exercises drop their heavy sets (a READ-TIME overlay in WorkoutService.getToday, the
-- workout_day_adjustment idiom — the template is never touched); KEEP = the card is hidden for the
-- day. One live row per user per date; undo ("Visszaállítom a tervet") is a soft delete.
create table readiness_choice (
    id         uuid        not null default gen_random_uuid(),
    created_by uuid        not null,
    is_deleted boolean     not null default false,
    created_at timestamptz not null default now(),
    date       date        not null,
    choice     varchar(8)  not null,
    constraint pk_readiness_choice_id primary key (id),
    constraint fk_readiness_choice_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_readiness_choice_choice check (choice in ('LIGHTEN', 'KEEP'))
);
create unique index uq_readiness_choice_user_date
    on readiness_choice (created_by, date) where is_deleted = false;
