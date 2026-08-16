-- Companion-feed (bd mezo-gst9, spec §2/§4): the briefing + heartbeat_note tables are replaced
-- by companion_message; old generated rows are deliberately discarded (no migration — decision).
drop table if exists heartbeat_note;
drop table if exists briefing;
