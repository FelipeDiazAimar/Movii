-- DOWN de 0003_eventos: borra el historial y el tipo motivo_fallo.
-- OJO: re-ejecutar el UP regenera el backfill (un evento raíz por envío),
-- pero NO recupera eventos registrados por la API entre medio.

DROP TABLE IF EXISTS eventos_envio;
DROP TYPE IF EXISTS motivo_fallo;
