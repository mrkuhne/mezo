-- mezo-8xdl.1: demo stills on exercise_catalog — a start/end position pair.
-- The free-exercise-db source ships exactly 2 frames per exercise; alternating them is what
-- conveys the movement, hence a typed pair rather than one column or a jsonb array.
-- image_start_url is the presence flag: no start frame = no image at all. Settable on ANY row
-- (master or user) like video_url, and the loader never clobbers a user-attached value.
-- Values are same-origin vendored paths (/exercises/{slug}-a.jpg) or an absolute http(s) URL.
ALTER TABLE exercise_catalog ADD COLUMN image_start_url TEXT;
ALTER TABLE exercise_catalog ADD COLUMN image_end_url TEXT;
