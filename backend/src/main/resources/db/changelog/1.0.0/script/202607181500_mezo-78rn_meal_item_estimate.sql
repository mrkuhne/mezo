-- mezo-78rn: allow FK-less AI-estimated meal lines (source='estimate', snapshots carry macros)
alter table meal_item drop constraint ck_meal_item_source;
alter table meal_item add constraint ck_meal_item_source
    check (source in ('recipe', 'pantry', 'estimate'));

alter table meal_item drop constraint ck_meal_item_arm;
alter table meal_item add constraint ck_meal_item_arm
    check (
        (source = 'recipe' and recipe_id is not null and pantry_item_id is null)
        or (source = 'pantry' and pantry_item_id is not null and recipe_id is null)
        or (source = 'estimate' and recipe_id is null and pantry_item_id is null)
    );
