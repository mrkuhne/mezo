-- mezo-6g52f: a tervező ajánlott ablaka, amibe az étkezést logolták. NULL = régi sor vagy ablak
-- nélküli logolás; a pontozó ilyenkor a statikus slot-ablak configra esik vissza.
alter table meal add column window_from time;
alter table meal add column window_to time;
alter table meal add constraint ck_meal_window_pair
    check ((window_from is null) = (window_to is null));
