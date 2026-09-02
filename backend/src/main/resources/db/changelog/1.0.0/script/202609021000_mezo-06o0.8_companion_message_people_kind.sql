-- Emberek S6 (mezo-06o0.8): a Mezo-észrevétel sáv valódi companion-üzenetté válik.
-- A 'people' egy NAPI megfigyelés az emberi körről — a többi fajtával egy sorban áll,
-- a (created_by, message_date, kind) parciális uniq index rá is érvényes.
ALTER TABLE companion_message DROP CONSTRAINT ck_companion_message_kind;
ALTER TABLE companion_message
    ADD CONSTRAINT ck_companion_message_kind
        CHECK (kind IN ('morning','sleep','weight','midday','evening','intervention','people'));
