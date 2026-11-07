DROP INDEX IF EXISTS uq_usuarios_google_id;
ALTER TABLE usuarios DROP COLUMN IF EXISTS auth_provider;
ALTER TABLE usuarios DROP COLUMN IF EXISTS google_id;
