-- Password-change token revocation (mezo-qw37.1 review, Finding 4): AuthService.changePassword
-- rewrote password_hash and nothing else, so a token stolen before the change stayed valid for
-- the rest of its 30-day life. tokens_valid_from is stamped to now() on a successful password
-- change; CurrentUser.load() rejects any JWT whose `iat` precedes it.
-- Spec: docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md.

ALTER TABLE app_user ADD COLUMN tokens_valid_from TIMESTAMPTZ;
