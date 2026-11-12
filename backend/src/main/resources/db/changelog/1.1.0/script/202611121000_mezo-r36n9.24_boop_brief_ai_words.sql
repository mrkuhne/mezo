-- mezo-r36n9.24: whether the stored brief carries the model's words (true) or the rule fallback (false).
-- A rule-only row is filled later by the model's late answer, or retried by an open 10 minutes on.
alter table boop_brief add column ai_words boolean not null default false;
