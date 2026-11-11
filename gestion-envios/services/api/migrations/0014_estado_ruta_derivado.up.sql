-- El estado de la ruta nunca se actualizaba (quedaba siempre "planificada").
-- Desde ahora se deriva de sus envíos al cambiar cada uno (ver sqlEstadoRuta en
-- envio_repo.go); acá se recalcula lo que ya existe.
UPDATE rutas r SET estado = (CASE
    WHEN EXISTS (SELECT 1 FROM envios e WHERE e.ruta_id = r.id)
     AND NOT EXISTS (SELECT 1 FROM envios e WHERE e.ruta_id = r.id AND e.estado IN ('pendiente', 'asignado', 'en_camino')) THEN 'completada'
    WHEN EXISTS (SELECT 1 FROM envios e WHERE e.ruta_id = r.id AND e.estado <> 'asignado') THEN 'en_curso'
    ELSE 'planificada' END)::estado_ruta;
