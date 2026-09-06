CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE rol_usuario AS ENUM ('operador', 'repartidor', 'supervisor');
CREATE TYPE estado_envio AS ENUM ('pendiente', 'asignado', 'en_camino', 'entregado', 'no_entregado');
CREATE TYPE tamano_paquete AS ENUM ('chico', 'mediano', 'grande');
CREATE TYPE estado_ruta AS ENUM ('planificada', 'en_curso', 'completada');

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol rol_usuario NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE remitentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    direccion VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE destinatarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    calle VARCHAR(200) NOT NULL,
    numero VARCHAR(10) NOT NULL,
    piso_depto VARCHAR(20),
    localidad VARCHAR(100) NOT NULL,
    codigo_postal VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rutas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    zona VARCHAR(100) NOT NULL,
    fecha DATE NOT NULL,
    estado estado_ruta NOT NULL DEFAULT 'planificada',
    repartidor_id UUID NOT NULL REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE envios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_guia VARCHAR(20) NOT NULL UNIQUE,
    estado estado_envio NOT NULL DEFAULT 'pendiente',
    peso NUMERIC(6, 2) NOT NULL,
    tamano tamano_paquete NOT NULL,
    tipo_contenido VARCHAR(100),
    fragil BOOLEAN NOT NULL DEFAULT false,
    urgente BOOLEAN NOT NULL DEFAULT false,
    remitente_id UUID NOT NULL REFERENCES remitentes(id),
    destinatario_id UUID NOT NULL REFERENCES destinatarios(id),
    ruta_id UUID REFERENCES rutas(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_envios_estado ON envios(estado);
CREATE INDEX idx_envios_ruta_id ON envios(ruta_id);
CREATE INDEX idx_rutas_fecha ON rutas(fecha);
CREATE INDEX idx_rutas_repartidor_id ON rutas(repartidor_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_rutas_updated_at BEFORE UPDATE ON rutas
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_envios_updated_at BEFORE UPDATE ON envios
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
