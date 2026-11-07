-- Sprint 3 (HU-16, HU-17): acceso con código por WhatsApp y avisos.

-- Teléfono del usuario en formato internacional sin '+' (ej. 5493564123456).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_telefono ON usuarios (telefono) WHERE telefono IS NOT NULL;

-- Códigos de un solo uso. Se guarda el hash (HMAC con el secreto del JWT), nunca el código.
CREATE TABLE IF NOT EXISTS codigos_otp (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telefono    VARCHAR(20) NOT NULL,
    usuario_id  UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    codigo_hash VARCHAR(64) NOT NULL,
    intentos    INT         NOT NULL DEFAULT 0,
    usado       BOOLEAN     NOT NULL DEFAULT false,
    expira_at   TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_codigos_otp_telefono_fecha ON codigos_otp (telefono, created_at DESC);

-- Registro de cada aviso enviado (o fallido). La clave evita mandar dos veces el mismo aviso.
CREATE TABLE IF NOT EXISTS notificaciones_whatsapp (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clave      VARCHAR(160) NOT NULL UNIQUE,
    telefono   VARCHAR(20)  NOT NULL,
    tipo       VARCHAR(30)  NOT NULL,
    envio_id   UUID REFERENCES envios(id) ON DELETE SET NULL,
    ruta_id    UUID REFERENCES rutas(id) ON DELETE SET NULL,
    mensaje    TEXT         NOT NULL,
    estado     VARCHAR(12)  NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviado', 'fallido', 'omitido')),
    error      TEXT,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    enviado_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notificaciones_envio ON notificaciones_whatsapp (envio_id);
