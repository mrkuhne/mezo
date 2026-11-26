-- Boop Levél (mezo-r36n9.38) — Google sign-in to the owner's own Gmail (spec §12): how a mailbox is read. 'imap' keeps
-- the app-password path; 'google' means secret_cipher/secret_nonce hold a sealed OAuth refresh token and the Gmail
-- REST API reader is used (its cursor is the historyId in mail_folder_cursor, folder 'gmail-api').
alter table mail_mailbox add column kind varchar(8) not null default 'imap';
alter table mail_mailbox add constraint ck_mail_mailbox_kind check (kind in ('imap', 'google'));
