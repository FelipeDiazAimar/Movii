-- Sprint 2 (HU-06/07/09/10): historial de eventos de cada envío.
-- Cada transición válida de estado registra una fila acá (HU-06 cambia de
-- estado, HU-07 motivo de fallo, HU-09 reprogramación, HU-08 entrega).
-- HU-10 (tracking público) lee esta tabla; nunca expone actor_id.

CREATE TYPE motivo_fallo AS ENUM (
    'cliente_ausente',
    'direccion_incorrecta',
    'rechazado',
    'zona_insegura',
    'otro'
);

CREATE TABLE eventos_envio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    envio_id UUID NOT NULL REFERENCES envios(id) ON DELETE CASCADE,
    estado_anterior estado_envio,
    estado_nuevo estado_envio NOT NULL,
    motivo motivo_fallo,
    comentario TEXT,
    -- Quien hizo el cambio. NULL en el backfill y si el usuario se borra
    -- (SET NULL: el historial sobrevive a la baja de usuarios, y el DOWN del
    -- seed de demo no se rompe por FK).
    actor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eventos_envio_id ON eventos_envio(envio_id, created_at);

-- Backfill: un evento raíz por cada envío ya existente. El historial previo
-- al Sprint 2 no se registró en ningún lado, así que se deja constancia con
-- estado_anterior NULL en vez de inventar eventos.
INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, comentario)
SELECT id, NULL, estado, 'historial previo al Sprint 2 (migración 0003)'
FROM envios;
