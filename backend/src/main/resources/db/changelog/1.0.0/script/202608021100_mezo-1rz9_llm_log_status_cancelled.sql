-- mezo-1rz9: a streamed call whose SSE client disconnected records as CANCELLED — before this the
-- turn simply vanished from the audit log although the provider billed the generated tokens.
-- The status CHECK is the enum's authority (CallStatus mirrors it), so it gains the third value.

alter table llm_log_history drop constraint ck_llm_log_history_status;
alter table llm_log_history add constraint ck_llm_log_history_status
    check (status in ('SUCCESS','ERROR','CANCELLED'));
