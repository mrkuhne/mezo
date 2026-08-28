-- mezo-p2tr: anchored conversations — an optional week/day anchor carried on the conversation
-- itself, so every turn (and the server-generated opening turn) can render the [Heti adatok]
-- block for the SAME week/day without the client re-sending it. Nullable = plain conversation.
alter table ai_conversation add column context_kind varchar(10);
alter table ai_conversation add column context_date date;
