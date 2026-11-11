-- Avisos por mail como respaldo de WhatsApp y destinatarios de demostración.
--
-- destinatarios.email: mail opcional del destinatario; si WhatsApp no está
--   vinculado o el número no tiene WhatsApp, el aviso sale por mail.
-- destinatarios.demo: datos ficticios cargados por cmd/demo. Sus avisos se
--   registran como "simulado" y nunca se envían (los teléfonos y mails son
--   inventados y podrían pertenecer a otra persona).
-- notificaciones_whatsapp.canal: por dónde salió (o saldría) el aviso. La
--   columna telefono pasa a guardar el destino, sea celular o mail.
ALTER TABLE destinatarios ADD COLUMN IF NOT EXISTS email VARCHAR(150);
ALTER TABLE destinatarios ADD COLUMN IF NOT EXISTS demo BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE notificaciones_whatsapp ALTER COLUMN telefono TYPE VARCHAR(150);
ALTER TABLE notificaciones_whatsapp ADD COLUMN IF NOT EXISTS canal VARCHAR(10) NOT NULL DEFAULT 'whatsapp';
ALTER TABLE notificaciones_whatsapp DROP CONSTRAINT IF EXISTS notificaciones_whatsapp_canal_check;
ALTER TABLE notificaciones_whatsapp ADD CONSTRAINT notificaciones_whatsapp_canal_check CHECK (canal IN ('whatsapp', 'mail'));
ALTER TABLE notificaciones_whatsapp DROP CONSTRAINT IF EXISTS notificaciones_whatsapp_estado_check;
ALTER TABLE notificaciones_whatsapp ADD CONSTRAINT notificaciones_whatsapp_estado_check
    CHECK (estado IN ('pendiente', 'enviado', 'fallido', 'omitido', 'simulado'));
