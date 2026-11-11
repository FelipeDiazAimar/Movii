-- Orden de visita de cada envío dentro de su ruta. Lo calcula el ordenador de
-- rutas (recorrido más corto por calles) al asignar envíos y al iniciar la ruta.
-- NULL = sin calcular: va al final, por orden de alta.
ALTER TABLE envios ADD COLUMN IF NOT EXISTS orden_ruta INT;

-- Los envíos que ya están en una ruta toman el orden que tenían (por alta).
UPDATE envios e SET orden_ruta = o.n
FROM (
    SELECT id, row_number() OVER (PARTITION BY ruta_id ORDER BY created_at, id) AS n
    FROM envios WHERE ruta_id IS NOT NULL
) o
WHERE e.id = o.id;

CREATE INDEX IF NOT EXISTS idx_envios_ruta_orden ON envios (ruta_id, orden_ruta);
