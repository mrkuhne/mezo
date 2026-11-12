-- Boop B3 (mezo-r36n9.13, spec §7.6): where a conversation was started. 'boop' conversations (the native
-- app's Boop tab) get the pushed "Ma" day block every turn and see only today's turns as history; every
-- existing row and every web-started conversation stays 'web'.
alter table ai_conversation add column channel varchar(8) not null default 'web';
alter table ai_conversation add constraint ck_ai_conversation_channel check (channel in ('web', 'boop'));
