-- Boop drinks (mezo-r36n9.160): a sixth meal slot, `drink` — a drink with calories counts in the day's totals but
-- the day plan never places it in a window and the scorer never judges it (score and breakdown stay NULL).
alter table meal drop constraint ck_meal_slot;
alter table meal add constraint ck_meal_slot check (slot in ('breakfast','lunch','dinner','snack','drink'));
