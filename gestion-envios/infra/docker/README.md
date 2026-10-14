# Postgres local (desarrollo sin Supabase)

> Vigente mientras el equipo no tenga acceso al proyecto Supabase compartido.
> Cuando llegue Supabase, **nada del código cambia**: solo 2 variables de
> entorno (ver "Migración a Supabase" abajo).

## Prerrequisito

Docker Desktop instalado y corriendo (Windows: https://www.docker.com/products/docker-desktop).

## Levantar la base

```bash
cd gestion-envios/infra/docker
docker compose up -d        # primera vez descarga postgres:17-alpine
docker compose ps           # db "healthy"/running
```

Baja con `docker compose down`. Los datos persisten en el volumen `movii-pgdata`.
Para empezar de cero: `docker compose down -v` (borra el volumen) y re-aplicar
migraciones.

## Configurar la API (una sola vez)

Crear `gestion-envios/services/api/.env` (está ignorado por git, no se sube):

```
DATABASE_URL=postgresql://movii:movii_dev@localhost:5432/movii?sslmode=disable
JWT_SECRET=dev-secret-local-no-usar-en-prod
PORT=8080
CORS_ORIGINS=http://localhost:5173
ENV=development
```

Web y móvil no cambian: usan sus valores por defecto (`http://localhost:8080`).

## Migraciones + seed + tests

```bash
cd gestion-envios/services/api
go run ./cmd/migrate up   # aplica 0001 (tablas) + 0002 (datos demo)
go run ./cmd/api          # API en :8080
go test ./... -p 1        # suite completa, SIEMPRE en serie
```

Usuarios demo (password de los tres: `Movii2026!`):
`supervisor@movii.demo` · `operador@movii.demo` · `repartidor@movii.demo`.

## Por qué esto replica Supabase exactamente

- Las migraciones son SQL estándar (`golang-migrate`): mismos archivos corren
  acá y en Supabase, en el mismo orden, con el mismo resultado.
- La migración `0001` solo usa la extensión `pgcrypto` (viene en el Postgres
  oficial y en Supabase) y nada específico de Supabase (no se usa Auth, RLS
  ni APIs propias).
- La API se conecta por `DATABASE_URL` con `pgx`: no distingue local de remoto.
- Si la versión de Supabase del equipo difiere de la 17, avisarlo: nuestro SQL
  no usa nada posterior a PG13, así que es compatible igual (dejar constancia
  acá cuando se sepa la versión del proyecto compartido).

## Migración a Supabase (cuando esté disponible)

1. Pedir al equipo: `DATABASE_URL` (connection string) y `JWT_SECRET`.
2. Reemplazar esos 2 valores en `services/api/.env`.
3. `go run ./cmd/migrate up` (aplica las mismas migraciones sobre Supabase).
4. `go test ./... -p 1` para verificar paridad.
5. Opcional: `docker compose down` y, si se quiere liberar disco,
   `docker compose down -v`.

## Problemas comunes

- Puerto 5432 ocupado (otro Postgres instalado): frenar el otro servicio o
  cambiar el mapeo a `"5433:5432"` y usar `...@localhost:5433/movii` en el `.env`.
- `migrate up` dice "dirty": una migración falló a la mitad → `go run ./cmd/migrate down 1`
  y reintentar (en local, lo más rápido suele ser `down -v` + `up`).
