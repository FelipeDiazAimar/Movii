-- Sprint 2 (HU-07, Task 5 del plan de HU-08): foto opcional de la incidencia.
-- Nullable, sin backfill: NULL = sin foto. Las imágenes se guardan como
-- BYTEA en la misma base (decisión Sprint 2, igual que la 0004): vale igual
-- en Postgres local y en Supabase. Límite: 5 MB, validado en el service
-- (HTTP 413 si se supera). La API recibe la foto en base64 dentro del JSON
-- (foto_base64 opcional) y nunca la expone en el historial (ListarPorEnvio
-- no la selecciona).

ALTER TABLE eventos_envio ADD COLUMN foto BYTEA;
