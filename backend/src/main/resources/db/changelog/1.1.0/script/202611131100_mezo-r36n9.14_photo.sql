-- Boop B4 (mezo-r36n9.14, decisions 14/19/20): the image store. Nothing stored images before.
--  * stored_image — one row per kept image (a meal photo or a recipe image), bytes in the row so the
--    nightly pg_dump covers them and a pod restart cannot lose them. Hard-deleted on request
--    (no soft-delete flag: a flag would keep the bytes).
--  * meal.photo_id / recipe.image_id — optional pointers; ON DELETE SET NULL, so removing an image row
--    can never leave a dangling reference.
-- NB: no bare question mark anywhere in a changeset (a JDBC placeholder).

create table stored_image (
    id           uuid         not null default gen_random_uuid(),
    created_by   uuid         not null,
    content_type varchar(64)  not null,
    bytes        bytea        not null,
    byte_size    integer      not null,
    width        integer      not null,
    height       integer      not null,
    created_at   timestamptz  not null default now(),
    constraint pk_stored_image_id primary key (id),
    constraint fk_stored_image_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_stored_image_content_type check (content_type in ('image/jpeg', 'image/png')),
    constraint ck_stored_image_dimensions check (width > 0 and height > 0 and byte_size > 0)
);
create index idx_stored_image_created_by on stored_image (created_by);

alter table meal add column photo_id uuid;
alter table meal add constraint fk_meal_photo_id_stored_image_id
    foreign key (photo_id) references stored_image (id) on delete set null;
create index idx_meal_photo_id on meal (photo_id) where photo_id is not null;

alter table recipe add column image_id uuid;
alter table recipe add constraint fk_recipe_image_id_stored_image_id
    foreign key (image_id) references stored_image (id) on delete set null;
create index idx_recipe_image_id on recipe (image_id) where image_id is not null;
