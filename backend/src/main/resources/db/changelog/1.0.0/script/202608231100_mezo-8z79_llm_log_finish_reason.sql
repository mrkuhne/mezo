-- mezo-8z79: the provider's finishReason on the FINAL generation (STOP / MAX_TOKENS / SAFETY / ...).
-- The 2026-08-23 empty-answer incident was undiagnosable precisely because this was not recorded:
-- a candidate with zero text parts is indistinguishable from a thinking-only round that hit the
-- output cap unless the finish reason is on the row. NULL = the provider reported none (or the
-- call never reached a generation — every ERROR row).
alter table llm_log_history add column finish_reason text;
