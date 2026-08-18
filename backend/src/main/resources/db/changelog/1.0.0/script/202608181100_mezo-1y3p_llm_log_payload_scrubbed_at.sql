-- mezo-1y3p: retention scrub stamp. NULL = payload intact (or never present — embed rows);
-- non-null = the 4 payload columns were hard-removed by retention at this instant. The column
-- is the honest marker the /me/ai-usage detail view renders. Cost/token metadata is never
-- scrubbed — ADR 0014's founding purpose (cost attribution) is retention-proof.
alter table llm_log_history add column payload_scrubbed_at timestamptz;
