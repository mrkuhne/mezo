-- mezo-06o0.5: a kézzel archiválás tartós felhasználói SZÁNDÉK, nem gép-származtatott állapot.
-- A `status` a forrás tükre marad (a promoterek írják); ez az oszlop az egyetlen hely, ahol a
-- felhasználó akarata él. Külön oszlop, nem új status-érték: a status varchar(10), a
-- ck_knowledge_node_status, az entity @Pattern, a kontraktus StatusEnum és négy hardkódolt
-- `status = 'active'` SQL-literál mind ellene szólt (spec D2).
-- Nincs backfill: a ma archivált node-ok gép-archiváltnak számítanak, mert ma nem is tudjuk
-- megkülönböztetni őket.
alter table knowledge_node add column user_archived_at timestamptz null;
