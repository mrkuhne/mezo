-- mezo-q71s: a chat beszélgetés-előzménye valódi üzenetlistaként megy a modellnek, nem a system
-- promptba renderelve. Enélkül az audit elveszítené — a system_prompt oszlop szemantikája viszont
-- nem változhat (az pontosan azt tartalmazza, amit a modell system promptként kapott), ezért kap
-- a beszélgetés a saját oszlopát. Nullable: minden nem-chat hívás (pipeline-ok) null-t hagy benne.
-- Az oszlopnév szándékosan nem history_text: a tábla neve már llm_log_history, ahol a "history" a
-- hívásnaplót jelenti.

alter table llm_log_history add column conversation_history text;
