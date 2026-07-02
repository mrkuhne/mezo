-- Fuel P5 day-planner settings on the goal (mezo-9ys): eating-occasion count + wake/bed anchors.
alter table goal add column meals_per_day smallint;
alter table goal add column wake_time varchar(5);
alter table goal add column bed_time varchar(5);
alter table goal add constraint ck_goal_meals_per_day check (meals_per_day is null or meals_per_day between 3 and 6);
