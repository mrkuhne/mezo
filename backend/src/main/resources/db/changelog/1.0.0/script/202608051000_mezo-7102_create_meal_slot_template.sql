-- Meal-slot templates (bd mezo-7102, spec docs/superpowers/specs/2026-08-05-fuel-meal-slot-templates-design.md).
-- One row per owner per day type; `slots` is a typed jsonb list (label/slotKind/role/anchor/budgetPct)
-- always read/written whole. No template row => the automatic placeWindows recommendation stays live.

create table meal_slot_template (
    id         uuid        not null default gen_random_uuid(),
    created_by uuid        not null,
    is_deleted boolean     not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz,
    day_type   varchar(11) not null,
    slots      jsonb       not null,
    constraint pk_meal_slot_template_id primary key (id),
    constraint fk_meal_slot_template_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_meal_slot_template_day_type check (day_type in ('rest', 'training_am', 'training_pm'))
);
create unique index uq_meal_slot_template_user_day_type on meal_slot_template (created_by, day_type) where is_deleted = false;
