-- W3.1b (bd mezo-b3pp.28): the memories ambient recall injected into an answer's prompt,
-- persisted next to refs/tool_calls as a typed jsonb envelope so history re-renders the
-- „Emlékek" disclosure. Additive; null on user rows and on every pre-W3.1 answer.
alter table ai_message add column recalled_memories jsonb;
