DELETE FROM codigos_otp WHERE length(telefono) > 20;
ALTER TABLE codigos_otp ALTER COLUMN telefono TYPE VARCHAR(20);
ALTER TABLE usuarios DROP COLUMN IF EXISTS must_change_password;
