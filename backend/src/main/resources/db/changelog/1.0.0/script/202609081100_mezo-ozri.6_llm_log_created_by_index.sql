-- mezo-ozri.6: the per-user rolling USD cap reads sum(cost_usd) for ONE account inside a moving
-- window on the PRE-FLIGHT path of every tagged LLM call. Every existing index on this table is
-- (created_at) or (dimension, created_at) — none of them leads with created_by, so that read would
-- degrade into a scan of the whole audit history as the log grows.
create index idx_llm_log_history_created_by_created_at
    on llm_log_history (created_by, created_at);
