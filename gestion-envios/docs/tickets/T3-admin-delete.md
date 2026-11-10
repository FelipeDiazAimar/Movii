# T3 — Solo admin puede eliminar (borrado físico) + rename supervisor→admin

**Prioridad:** Media-Alta | **Tipo:** Feature breaking / Refactor

## Historia
Como admin quiero ser el único que puede eliminar rutas, usuarios y envíos.

## Decisión
Borrado **físico** (`DELETE` real). Rename total: `supervisor` desaparece de DB/API/UI → `admin`.

## Alcance
### Backend `services/api`
- Migración: rename enum/valor `supervisor`→`admin` en `usuarios.rol` + datos. Actualizar `domain.RolSupervisor`→`RolAdmin`, `internal/httprouter/router.go` `allow=["admin"]`.
- Nuevos:
  - `DELETE /rutas/:id` solo admin. Bloquear `423` si estado `en_curso`.
  - `DELETE /envios/:id` solo admin. Bloquear si `ruta_id != null` o estado `en_camino/entregado`.
  - `DELETE /users/:id` solo admin. Bloquear auto-borrado y último admin.
- `GET /users` sigue solo admin (ya era así). Operador que llama a DELETE → `403`.
- ⚠️ FKs con `ON DELETE RESTRICT`. Backup previo obligatorio.

### Frontend `apps/web`
- `src/App.tsx`: `ProtectedRoute allow={["admin"]}`.
- `src/components/layout/AppLayout.tsx`: `type Rol="operador"|"admin"`, menú Usuarios/WhatsApp solo admin.
- `features/usuarios/api.ts`, `RepartidorSelect`, páginas `Rutas/Envios/Usuarios`: botón Eliminar solo si `rol==="admin"` + modal confirm con nombre + llamada DELETE.
- Buscar/reemplazar `supervisor` en web, mobile, `supabase/seeds`, docs.

## Criterios de aceptación
1. Operador no ve botones Eliminar; por API recibe `403`.
2. Admin elimina ruta `planificada`, envío `pendiente`, usuario inactivo.
3. Intentar borrar ruta en curso / envío asignado → error claro, no borra.
4. `grep -r supervisor` da 0 resultados (salvo histórico en migraciones viejas).
5. Tests: `delete_rbac_test.go` (operador 403, admin 204, bloqueos 423).

## Fuera de alcance
Papelera / restaurar, auditoría (proponer como T3-bis).
