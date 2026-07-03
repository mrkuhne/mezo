-- V1.3 (bd mezo-fnnq.8): the advisor chain marks answers that failed the post-response
-- self-check twice (old docs §4.5 [degraded] delivery). Additive; existing rows are clean.

alter table ai_message add column degraded boolean not null default false;
