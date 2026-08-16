-- mezo-q71s: a chat beszélgetés-előzménye valódi üzenetlistaként megy a modellnek, nem a system
-- promptba renderelve. Enélkül az audit elveszítené — a system_prompt oszlop szemantikája viszont
-- nem változhat (az pontosan azt tartalmazza, amit a modell system promptként kapott), ezért kap
-- a beszélgetés a saját oszlopát. Nullable, de a null NEM azt jelenti, hogy "nem chat hívás": a
-- CHAT/TOOL/CHAT_STREAM hívások — a system promptot előzmény nélkül küldő egylépéses pipeline-ok
-- (pl. FactExtractionService, DailySummaryService, ActivityClassifier) éppúgy, mint egy beszélgetés
-- első köre — ChatHistory.render(...) eredményét kapják, ami üres előzményre '' (üres string), nem
-- null. Null csak azoknál a hívástípusoknál marad, amelyeknek sosincs beszélgetése (SMART, VISION,
-- TRANSCRIBE). Az oszlopnév szándékosan nem history_text: a tábla neve már llm_log_history, ahol a
-- "history" a hívásnaplót jelenti.

alter table llm_log_history add column conversation_history text;
