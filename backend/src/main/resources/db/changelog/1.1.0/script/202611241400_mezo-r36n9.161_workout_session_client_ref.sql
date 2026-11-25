-- Boop gym catch-up (mezo-r36n9.161): a past template day booked as completed with the plan's prescribed sets, in one
-- idempotent call. `client_ref` is the phone's idempotency key: a retry after a lost answer finds the instance it made.
alter table workout_session add column client_ref uuid;
create unique index uq_workout_session_owner_client_ref on workout_session (created_by, client_ref) where client_ref is not null;
