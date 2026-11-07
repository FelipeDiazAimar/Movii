-- T1: primer login con cambio de contraseña obligatorio + código por WhatsApp o mail.

-- DEFAULT false: los usuarios que ya existen (incluidos los de la demo) no quedan
-- obligados. El alta por admin/API (POST /auth/register) lo pone en true.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- codigos_otp.telefono pasa a guardar el destino del código: el celular
-- (WhatsApp) o, si el usuario no tiene, su email. Se usa para el límite de pedidos.
ALTER TABLE codigos_otp ALTER COLUMN telefono TYPE VARCHAR(150);
