-- T2: login con Google (OAuth2).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'password';
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_google_id ON usuarios (google_id) WHERE google_id IS NOT NULL;
