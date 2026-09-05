# API — Fundaciones, Modelo de Datos y HU-01 (Auth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tener la API Go corriendo contra Supabase, con las 5 tablas del modelo de datos migradas y HU-01 (registro, login, listado de usuarios) completa, testeada y protegida por JWT + rol.

**Architecture:** Módulo Go independiente en `gestion-envios/services/api`, capas `handlers → services → repository` sobre `pgx/v5`, router `chi`, migraciones con `golang-migrate`. Auth propia con JWT (`golang-jwt/v5`) y `bcrypt`. Sin ORM.

**Tech Stack:** Go 1.22, chi v5, pgx v5, golang-migrate v4, golang-jwt v5, golang.org/x/crypto/bcrypt, testify, godotenv (dev).

**Spec:** [docs/superpowers/specs/2026-09-05-sprint1-movii-design.md](../specs/2026-09-05-sprint1-movii-design.md)

## Global Constraints

- Módulo Go: `movii/api` (no necesita resolver como URL pública).
- Todas las respuestas HTTP son JSON. Error: `{"error":{"code":"...","message":"..."}}`.
- Contraseñas: `bcrypt` costo 10. Nunca loguear ni devolver `password_hash`.
- JWT: HS256, claims `sub` (id de usuario), `rol`, `exp` (24 h desde emisión), secreto en `JWT_SECRET`.
- Roles válidos: `operador`, `repartidor`, `supervisor`.
- Base de datos: PostgreSQL en Supabase, accedida vía `DATABASE_URL` (nunca commitear el valor real, solo `.env.example`).
- Commits en español, cierran con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- `gofmt` y `go vet` limpios antes de cada commit.

---

## Task 0: Instalar Go y crear el proyecto Supabase

Esta tarea es manual (no hay test automatizado) porque habilita todo lo demás.

**Archivos:** ninguno de código; se crea `services/api/.env` (no commiteado) y `services/api/.env.example` (sí commiteado).

- [ ] **Paso 1: Instalar Go 1.22+ en Windows**

Con `winget` (PowerShell):

```powershell
winget install --id GoLang.Go -e
```

Cerrar y reabrir la terminal. Verificar:

```bash
go version
```

Esperado: `go version go1.22.x windows/amd64` (o superior).

- [ ] **Paso 2: Crear el proyecto en Supabase**

1. Entrar a https://supabase.com, crear cuenta/organización si no existe.
2. "New project" → nombre `movii-sprint1`, región más cercana, generar y **guardar** la contraseña de la base.
3. Ir a **Project Settings → Database → Connection string → URI**, copiar la cadena en modo *Session pooler* (puerto 5432 o 6543 según lo que ofrezca el panel).

- [ ] **Paso 3: Crear los archivos de entorno**

Crear `gestion-envios/services/api/.env` (real, con la contraseña) — este archivo **no se commitea**:

```
DATABASE_URL=postgresql://postgres.xxxxx:TU_PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres
JWT_SECRET=cambia-esto-por-una-cadena-larga-y-aleatoria
PORT=8080
CORS_ORIGINS=http://localhost:5173
ENV=development
```

Crear `gestion-envios/services/api/.env.example` (sí se commitea, sin secretos reales):

```
DATABASE_URL=postgresql://user:password@host:5432/postgres
JWT_SECRET=changeme
PORT=8080
CORS_ORIGINS=http://localhost:5173
ENV=development
```

Crear `gestion-envios/services/api/.gitignore`:

```
.env
```

- [ ] **Paso 4: Verificar la conexión con `psql` (si está disponible) o dejarlo para el Task 3**

Si tenés `psql` instalado: `psql "$DATABASE_URL" -c "select 1;"` debe devolver `1`. Si no tenés `psql`, no pasa nada: el Task 3 verifica la conexión desde Go.

- [ ] **Paso 5: Commit**

```bash
cd "gestion-envios/services/api"
git add .env.example .gitignore
git commit -m "chore: agregar plantilla de variables de entorno de la API

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 1: Scaffold del módulo Go + config + health endpoint

**Files:**
- Create: `gestion-envios/services/api/go.mod`
- Create: `gestion-envios/services/api/internal/config/config.go`
- Create: `gestion-envios/services/api/internal/config/config_test.go`
- Create: `gestion-envios/services/api/internal/platform/http/response.go`
- Create: `gestion-envios/services/api/internal/handlers/health.go`
- Create: `gestion-envios/services/api/internal/handlers/health_test.go`
- Create: `gestion-envios/services/api/internal/platform/http/router.go`
- Create: `gestion-envios/services/api/cmd/api/main.go`

**Interfaces:**
- Produces: `config.Config{Port, DatabaseURL, JWTSecret, CORSOrigins, Env string}` y `config.Load() (Config, error)`.
- Produces: `httpx.WriteJSON(w http.ResponseWriter, status int, payload any)` y `httpx.WriteError(w http.ResponseWriter, status int, code, message string)`.
- Produces: `handlers.Health(w http.ResponseWriter, r *http.Request)`.
- Produces: `httprouter.New(deps httprouter.Deps) http.Handler` — router que monta todas las rutas (por ahora solo `/health`); `Deps` se irá ampliando en tareas siguientes.

- [ ] **Paso 1: Inicializar el módulo Go**

```bash
cd "gestion-envios/services/api"
go mod init movii/api
```

- [ ] **Paso 2: Agregar dependencias**

```bash
go get github.com/go-chi/chi/v5@v5.1.0
go get github.com/go-chi/cors@v1.2.1
go get github.com/joho/godotenv@v1.5.1
go get github.com/stretchr/testify@v1.9.0
```

- [ ] **Paso 3: Escribir el test de config (falla)**

`internal/config/config_test.go`:

```go
package config

import (
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLoad_UsaVariablesDeEntorno(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://test")
	t.Setenv("JWT_SECRET", "secreto-de-test")
	t.Setenv("PORT", "9090")
	t.Setenv("CORS_ORIGINS", "http://a.com,http://b.com")
	t.Setenv("ENV", "test")

	cfg, err := Load()

	require.NoError(t, err)
	require.Equal(t, "postgres://test", cfg.DatabaseURL)
	require.Equal(t, "secreto-de-test", cfg.JWTSecret)
	require.Equal(t, "9090", cfg.Port)
	require.Equal(t, []string{"http://a.com", "http://b.com"}, cfg.CORSOrigins)
	require.Equal(t, "test", cfg.Env)
}

func TestLoad_FaltaDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("JWT_SECRET", "secreto")

	_, err := Load()

	require.ErrorContains(t, err, "DATABASE_URL")
}

func TestLoad_UsaPuertoPorDefecto(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://test")
	t.Setenv("JWT_SECRET", "secreto")
	os.Unsetenv("PORT")
	os.Unsetenv("CORS_ORIGINS")

	cfg, err := Load()

	require.NoError(t, err)
	require.Equal(t, "8080", cfg.Port)
	require.Equal(t, []string{"http://localhost:5173"}, cfg.CORSOrigins)
}
```

- [ ] **Paso 4: Correr el test y verificar que falla**

Run: `go test ./internal/config/... -v`
Expected: FAIL (el paquete `config` no existe todavía).

- [ ] **Paso 5: Implementar `config.Load`**

`internal/config/config.go`:

```go
package config

import (
	"fmt"
	"os"
	"strings"
)

// Config agrupa toda la configuración de la API leída desde el entorno.
type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	CORSOrigins []string
	Env         string
}

// Load lee la configuración desde variables de entorno. DATABASE_URL y
// JWT_SECRET son obligatorias; el resto tiene valores por defecto.
func Load() (Config, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return Config{}, fmt.Errorf("config: falta la variable de entorno DATABASE_URL")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return Config{}, fmt.Errorf("config: falta la variable de entorno JWT_SECRET")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	env := os.Getenv("ENV")
	if env == "" {
		env = "development"
	}

	origins := []string{"http://localhost:5173"}
	if raw := os.Getenv("CORS_ORIGINS"); raw != "" {
		origins = strings.Split(raw, ",")
	}

	return Config{
		Port:        port,
		DatabaseURL: dbURL,
		JWTSecret:   jwtSecret,
		CORSOrigins: origins,
		Env:         env,
	}, nil
}
```

- [ ] **Paso 6: Correr el test y verificar que pasa**

Run: `go test ./internal/config/... -v`
Expected: PASS (3 tests).

- [ ] **Paso 7: Escribir el test del endpoint de salud (falla)**

`internal/handlers/health_test.go`:

```go
package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHealth_DevuelveOK(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	Health(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.JSONEq(t, `{"status":"ok"}`, rec.Body.String())
}
```

- [ ] **Paso 8: Correr el test y verificar que falla**

Run: `go test ./internal/handlers/... -v`
Expected: FAIL (el paquete `handlers` y la función `Health` no existen).

- [ ] **Paso 9: Implementar `response.go` y `health.go`**

`internal/platform/http/response.go`:

```go
package httpx

import (
	"encoding/json"
	"net/http"
)

// WriteJSON escribe payload como JSON con el status dado.
func WriteJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// APIError es el cuerpo estándar de error de la API.
type APIError struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// WriteError escribe un error con el formato estándar {"error":{"code","message"}}.
func WriteError(w http.ResponseWriter, status int, code, message string) {
	var body APIError
	body.Error.Code = code
	body.Error.Message = message
	WriteJSON(w, status, body)
}
```

`internal/handlers/health.go`:

```go
package handlers

import (
	"net/http"

	httpx "movii/api/internal/platform/http"
)

// Health responde 200 con {"status":"ok"} para chequeos de disponibilidad.
func Health(w http.ResponseWriter, r *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
```

- [ ] **Paso 10: Correr el test y verificar que pasa**

Run: `go test ./internal/handlers/... -v`
Expected: PASS.

- [ ] **Paso 11: Crear el router y `main.go`**

`internal/platform/http/router.go`:

```go
package httpx

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"movii/api/internal/handlers"
)

// Deps son las dependencias que el router necesita para montar las rutas.
// Se amplía en tareas siguientes (repos, services).
type Deps struct {
	CORSOrigins []string
}

// NewRouter arma el router HTTP completo de la API.
func NewRouter(deps Deps) http.Handler {
	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   deps.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	r.Get("/health", handlers.Health)

	return r
}
```

`cmd/api/main.go`:

```go
package main

import (
	"log"
	"net/http"

	"github.com/joho/godotenv"

	"movii/api/internal/config"
	httpx "movii/api/internal/platform/http"
)

func main() {
	_ = godotenv.Load() // en producción las variables ya están en el entorno

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	router := httpx.NewRouter(httpx.Deps{CORSOrigins: cfg.CORSOrigins})

	log.Printf("API escuchando en :%s (env=%s)", cfg.Port, cfg.Env)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatalf("server: %v", err)
	}
}
```

- [ ] **Paso 12: Compilar y levantar el servidor manualmente**

Run: `go build ./... && go run ./cmd/api`
Expected: log `API escuchando en :8080 (env=development)`. En otra terminal: `curl http://localhost:8080/health` debe devolver `{"status":"ok"}`. Detener el servidor (Ctrl+C).

- [ ] **Paso 13: Commit**

```bash
cd "gestion-envios/services/api"
go vet ./...
gofmt -l .
git add go.mod go.sum internal cmd
git commit -m "feat: scaffold del modulo Go con config y endpoint de salud

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Pool de conexión a Postgres (pgx)

**Files:**
- Create: `gestion-envios/services/api/internal/platform/db/db.go`
- Create: `gestion-envios/services/api/internal/platform/db/db_test.go`
- Modify: `gestion-envios/services/api/cmd/api/main.go`

**Interfaces:**
- Consumes: `config.Config.DatabaseURL` (Task 1).
- Produces: `db.New(ctx context.Context, databaseURL string) (*pgxpool.Pool, error)`.

- [ ] **Paso 1: Agregar dependencia pgx**

```bash
go get github.com/jackc/pgx/v5@v5.6.0
```

- [ ] **Paso 2: Escribir el test de conexión (falla)**

`internal/platform/db/db_test.go`:

```go
package db

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestNew_ConectaYHacePing requiere DATABASE_URL apuntando a la base de
// Supabase creada en el Task 0. Se salta si la variable no está seteada.
func TestNew_ConectaYHacePing(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan")
	}

	pool, err := New(context.Background(), url)
	require.NoError(t, err)
	defer pool.Close()

	require.NoError(t, pool.Ping(context.Background()))
}

func TestNew_URLInvalida(t *testing.T) {
	_, err := New(context.Background(), "no-es-una-url")
	require.Error(t, err)
}
```

- [ ] **Paso 3: Correr el test y verificar que falla**

Run: `go test ./internal/platform/db/... -v`
Expected: FAIL (el paquete `db` no existe).

- [ ] **Paso 4: Implementar `db.New`**

`internal/platform/db/db.go`:

```go
package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// New crea y valida un pool de conexiones pgx contra databaseURL.
func New(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("db: no se pudo crear el pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("db: ping falló: %w", err)
	}

	return pool, nil
}
```

- [ ] **Paso 5: Cargar `.env` en la sesión de test y correr**

Con `DATABASE_URL` del `.env` del Task 0 exportada en la shell:

Bash: `export $(grep -v '^#' .env | xargs) && go test ./internal/platform/db/... -v`
PowerShell: `Get-Content .env | ForEach-Object { if ($_ -match '^(.*?)=(.*)$') { [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2]) } }; go test ./internal/platform/db/... -v`

Expected: PASS (2 tests). Si `TestNew_ConectaYHacePing` se saltea, revisar que `DATABASE_URL` esté exportada.

- [ ] **Paso 6: Conectar el pool en `main.go`**

Modificar `cmd/api/main.go` para crear el pool al arrancar y cerrarlo al salir:

```go
package main

import (
	"context"
	"log"
	"net/http"

	"github.com/joho/godotenv"

	"movii/api/internal/config"
	"movii/api/internal/platform/db"
	httpx "movii/api/internal/platform/http"
)

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx := context.Background()
	pool, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()

	router := httpx.NewRouter(httpx.Deps{CORSOrigins: cfg.CORSOrigins})

	log.Printf("API escuchando en :%s (env=%s)", cfg.Port, cfg.Env)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatalf("server: %v", err)
	}
}
```

- [ ] **Paso 7: Verificar que arranca contra Supabase**

Run: `go run ./cmd/api`
Expected: arranca sin el error `db: ping falló`. Ctrl+C para detener.

- [ ] **Paso 8: Commit**

```bash
go vet ./...
git add go.mod go.sum internal cmd
git commit -m "feat: agregar pool de conexion pgx a Supabase

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Migración 0001 — esquema de las 5 tablas

**Files:**
- Create: `gestion-envios/services/api/migrations/0001_init.up.sql`
- Create: `gestion-envios/services/api/migrations/0001_init.down.sql`
- Create: `gestion-envios/services/api/internal/platform/db/migrate.go`
- Create: `gestion-envios/services/api/internal/platform/db/migrate_test.go`
- Create: `gestion-envios/services/api/cmd/migrate/main.go`

**Interfaces:**
- Consumes: `db.New` (Task 2).
- Produces: `db.RunMigrations(databaseURL string, migrationsDir string) error` (up) y `db.RollbackLast(databaseURL string, migrationsDir string) error` (down, para el test).

- [ ] **Paso 1: Agregar dependencias de golang-migrate**

```bash
go get github.com/golang-migrate/migrate/v4@v4.17.1
go get github.com/golang-migrate/migrate/v4/database/pgx/v5@v4.17.1
go get github.com/golang-migrate/migrate/v4/source/file@v4.17.1
```

- [ ] **Paso 2: Escribir el SQL de la migración 0001**

`migrations/0001_init.up.sql`:

```sql
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
```

`migrations/0001_init.down.sql`:

```sql
DROP TABLE IF EXISTS envios;
DROP TABLE IF EXISTS rutas;
DROP TABLE IF EXISTS destinatarios;
DROP TABLE IF EXISTS remitentes;
DROP TABLE IF EXISTS usuarios;

DROP FUNCTION IF EXISTS set_updated_at();

DROP TYPE IF EXISTS estado_ruta;
DROP TYPE IF EXISTS tamano_paquete;
DROP TYPE IF EXISTS estado_envio;
DROP TYPE IF EXISTS rol_usuario;
```

- [ ] **Paso 3: Escribir el test del runner de migraciones (falla)**

`internal/platform/db/migrate_test.go`:

```go
package db

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

func TestRunMigrations_CreaTablas(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan")
	}

	// Empezar limpio por si quedó estado de una corrida anterior.
	_ = RollbackLast(url, "../../../migrations")

	err := RunMigrations(url, "../../../migrations")
	require.NoError(t, err)

	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	defer pool.Close()

	var existe bool
	err = pool.QueryRow(context.Background(),
		`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuarios')`,
	).Scan(&existe)
	require.NoError(t, err)
	require.True(t, existe, "la tabla usuarios debería existir tras migrar")

	// Dejar el down probado también.
	require.NoError(t, RollbackLast(url, "../../../migrations"))
}
```

- [ ] **Paso 4: Correr el test y verificar que falla**

Run: `go test ./internal/platform/db/... -run TestRunMigrations -v`
Expected: FAIL (`RunMigrations` y `RollbackLast` no existen).

- [ ] **Paso 5: Implementar el runner de migraciones**

`internal/platform/db/migrate.go`:

```go
package db

import (
	"errors"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// RunMigrations aplica todas las migraciones pendientes en migrationsDir
// contra databaseURL.
func RunMigrations(databaseURL, migrationsDir string) error {
	m, err := migrate.New("file://"+migrationsDir, databaseURL)
	if err != nil {
		return fmt.Errorf("db: no se pudo iniciar migrate: %w", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("db: error aplicando migraciones: %w", err)
	}
	return nil
}

// RollbackLast revierte la última migración aplicada. Se usa en tests para
// dejar la base limpia.
func RollbackLast(databaseURL, migrationsDir string) error {
	m, err := migrate.New("file://"+migrationsDir, databaseURL)
	if err != nil {
		return fmt.Errorf("db: no se pudo iniciar migrate: %w", err)
	}
	defer m.Close()

	if err := m.Steps(-1); err != nil && !errors.Is(err, migrate.ErrNoChange) && !errors.Is(err, migrate.ErrNilVersion) {
		return fmt.Errorf("db: error revirtiendo migración: %w", err)
	}
	return nil
}
```

- [ ] **Paso 6: Correr el test y verificar que pasa**

Run: `go test ./internal/platform/db/... -run TestRunMigrations -v`
Expected: PASS.

- [ ] **Paso 7: Crear el comando CLI para migrar**

`cmd/migrate/main.go`:

```go
package main

import (
	"log"
	"os"

	"github.com/joho/godotenv"

	"movii/api/internal/config"
	"movii/api/internal/platform/db"
)

// Uso: go run ./cmd/migrate up | go run ./cmd/migrate down
func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	if len(os.Args) < 2 {
		log.Fatal("uso: migrate [up|down]")
	}

	switch os.Args[1] {
	case "up":
		if err := db.RunMigrations(cfg.DatabaseURL, "migrations"); err != nil {
			log.Fatal(err)
		}
		log.Println("migraciones aplicadas")
	case "down":
		if err := db.RollbackLast(cfg.DatabaseURL, "migrations"); err != nil {
			log.Fatal(err)
		}
		log.Println("última migración revertida")
	default:
		log.Fatalf("comando desconocido: %s", os.Args[1])
	}
}
```

- [ ] **Paso 8: Aplicar la migración de verdad y dejarla aplicada**

Run: `go run ./cmd/migrate up`
Expected: `migraciones aplicadas`. (El test del paso 6 hace su propio ciclo up/down y no deja el schema aplicado; este paso sí lo deja aplicado para las tareas siguientes.)

- [ ] **Paso 9: Commit**

```bash
go vet ./...
git add go.mod go.sum migrations internal cmd
git commit -m "feat: agregar migracion 0001 con las 5 tablas del modelo de datos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Migración 0002 — seed de demo

**Files:**
- Create: `gestion-envios/services/api/migrations/0002_seed.up.sql`
- Create: `gestion-envios/services/api/migrations/0002_seed.down.sql`
- Create: `gestion-envios/services/api/internal/platform/db/seed_test.go`

**Interfaces:**
- Consumes: `db.RunMigrations` (Task 3).
- No produce interfaces nuevas; valida datos, no código.

- [ ] **Paso 1: Escribir el SQL de seed**

Nota: las contraseñas ya van hasheadas con bcrypt (`Movii2026!`, costo 10) para poder loguear con esos usuarios en la demo.

`migrations/0002_seed.up.sql`:

```sql
INSERT INTO usuarios (id, nombre, email, password_hash, rol) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Ana Supervisora', 'supervisor@movii.demo', '$2a$10$7EqJtq98hPqEX7fNZaFWoO4/nzcS8t.LrN.5s4v/tYUvV/2c6r6Vy', 'supervisor'),
    ('22222222-2222-2222-2222-222222222222', 'Beto Operador', 'operador@movii.demo', '$2a$10$7EqJtq98hPqEX7fNZaFWoO4/nzcS8t.LrN.5s4v/tYUvV/2c6r6Vy', 'operador'),
    ('33333333-3333-3333-3333-333333333333', 'Carla Repartidora', 'repartidor@movii.demo', '$2a$10$7EqJtq98hPqEX7fNZaFWoO4/nzcS8t.LrN.5s4v/tYUvV/2c6r6Vy', 'repartidor');

INSERT INTO remitentes (id, nombre, telefono, direccion) VALUES
    ('44444444-4444-4444-4444-444444444444', 'Depósito Central Movii', '3564-100100', 'Ruta 19 km 4, San Francisco');

INSERT INTO destinatarios (id, nombre, telefono, calle, numero, piso_depto, localidad, codigo_postal) VALUES
    ('55555555-5555-5555-5555-555555555555', 'Juan Pérez', '3564-200200', 'San Martín', '450', NULL, 'San Francisco', 'X2400'),
    ('66666666-6666-6666-6666-666666666666', 'María Gómez', '3564-300300', 'Belgrano', '120', '2A', 'San Francisco', 'X2400');

INSERT INTO rutas (id, nombre, zona, fecha, estado, repartidor_id) VALUES
    ('77777777-7777-7777-7777-777777777777', 'Ruta Centro 01', 'Centro', CURRENT_DATE, 'planificada', '33333333-3333-3333-3333-333333333333');

INSERT INTO envios (codigo_guia, estado, peso, tamano, tipo_contenido, remitente_id, destinatario_id, ruta_id) VALUES
    ('MOV-20260905-0001', 'asignado', 2.5, 'chico', 'Ropa', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', '77777777-7777-7777-7777-777777777777'),
    ('MOV-20260905-0002', 'pendiente', 8.0, 'mediano', 'Electrónica', '44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666', NULL);
```

`migrations/0002_seed.down.sql`:

```sql
DELETE FROM envios WHERE codigo_guia IN ('MOV-20260905-0001', 'MOV-20260905-0002');
DELETE FROM rutas WHERE id = '77777777-7777-7777-7777-777777777777';
DELETE FROM destinatarios WHERE id IN ('55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666');
DELETE FROM remitentes WHERE id = '44444444-4444-4444-4444-444444444444';
DELETE FROM usuarios WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');
```

- [ ] **Paso 2: Escribir el test de verificación del seed (falla porque el seed no está aplicado)**

`internal/platform/db/seed_test.go`:

```go
package db

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

func TestSeed_UsuariosDeDemoExisten(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan")
	}

	require.NoError(t, RunMigrations(url, "../../../migrations"))

	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	defer pool.Close()

	var count int
	err = pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM usuarios WHERE email = 'repartidor@movii.demo'`,
	).Scan(&count)
	require.NoError(t, err)
	require.Equal(t, 1, count)
}
```

- [ ] **Paso 3: Correr el test y verificar que falla**

Run: `go test ./internal/platform/db/... -run TestSeed -v`
Expected: FAIL (`count` da 0 porque `0002_seed.up.sql` todavía no existe).

- [ ] **Paso 4: Verificar que el paso 1 ya creó los archivos y aplicar**

Los archivos SQL ya se escribieron en el Paso 1. Aplicar:

Run: `go run ./cmd/migrate up`
Expected: `migraciones aplicadas`.

- [ ] **Paso 5: Correr el test y verificar que pasa**

Run: `go test ./internal/platform/db/... -run TestSeed -v`
Expected: PASS.

- [ ] **Paso 6: Commit**

```bash
git add migrations internal
git commit -m "feat: agregar seed de demo (usuarios, envios y ruta de ejemplo)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Dominio Usuario + repository

**Files:**
- Create: `gestion-envios/services/api/internal/domain/usuario.go`
- Create: `gestion-envios/services/api/internal/repository/usuario_repo.go`
- Create: `gestion-envios/services/api/internal/repository/usuario_repo_test.go`

**Interfaces:**
- Consumes: `db.New`, `db.RunMigrations` (Tasks 2-3).
- Produces:
  ```go
  type domain.Usuario struct {
      ID           string
      Nombre       string
      Email        string
      PasswordHash string
      Rol          string // "operador" | "repartidor" | "supervisor"
      Activo       bool
  }

  type repository.UsuarioRepo struct{ /* pool *pgxpool.Pool */ }
  func repository.NewUsuarioRepo(pool *pgxpool.Pool) *UsuarioRepo
  func (r *UsuarioRepo) Create(ctx context.Context, u domain.Usuario) (domain.Usuario, error)
  func (r *UsuarioRepo) GetByEmail(ctx context.Context, email string) (domain.Usuario, error) // devuelve ErrNoEncontrado si no existe
  func (r *UsuarioRepo) List(ctx context.Context) ([]domain.Usuario, error)

  var repository.ErrNoEncontrado = errors.New("registro no encontrado")
  var repository.ErrDuplicado = errors.New("registro duplicado")
  ```

- [ ] **Paso 1: Definir el dominio**

`internal/domain/usuario.go`:

```go
package domain

// Usuario representa a un usuario del sistema (operador, repartidor o supervisor).
type Usuario struct {
	ID           string
	Nombre       string
	Email        string
	PasswordHash string
	Rol          string
	Activo       bool
}

const (
	RolOperador   = "operador"
	RolRepartidor = "repartidor"
	RolSupervisor = "supervisor"
)
```

- [ ] **Paso 2: Escribir el test del repository (falla)**

`internal/repository/usuario_repo_test.go`:

```go
package repository

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

func nuevoPoolDeTest(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	return pool
}

func TestUsuarioRepo_CreateYGetByEmail(t *testing.T) {
	pool := nuevoPoolDeTest(t)
	repo := NewUsuarioRepo(pool)
	ctx := context.Background()

	email := fmt.Sprintf("test-%s@movii.demo", uuid.NewString())
	creado, err := repo.Create(ctx, domain.Usuario{
		Nombre:       "Usuario de Test",
		Email:        email,
		PasswordHash: "hash-falso",
		Rol:          domain.RolOperador,
	})
	require.NoError(t, err)
	require.NotEmpty(t, creado.ID)
	require.True(t, creado.Activo)

	encontrado, err := repo.GetByEmail(ctx, email)
	require.NoError(t, err)
	require.Equal(t, creado.ID, encontrado.ID)
	require.Equal(t, email, encontrado.Email)

	_, err = pool.Exec(ctx, "DELETE FROM usuarios WHERE id = $1", creado.ID)
	require.NoError(t, err)
}

func TestUsuarioRepo_CreateEmailDuplicado(t *testing.T) {
	pool := nuevoPoolDeTest(t)
	repo := NewUsuarioRepo(pool)
	ctx := context.Background()

	email := fmt.Sprintf("test-dup-%s@movii.demo", uuid.NewString())
	primero, err := repo.Create(ctx, domain.Usuario{
		Nombre: "Uno", Email: email, PasswordHash: "hash", Rol: domain.RolOperador,
	})
	require.NoError(t, err)

	_, err = repo.Create(ctx, domain.Usuario{
		Nombre: "Dos", Email: email, PasswordHash: "hash", Rol: domain.RolOperador,
	})
	require.ErrorIs(t, err, ErrDuplicado)

	_, _ = pool.Exec(ctx, "DELETE FROM usuarios WHERE id = $1", primero.ID)
}

func TestUsuarioRepo_GetByEmailNoEncontrado(t *testing.T) {
	pool := nuevoPoolDeTest(t)
	repo := NewUsuarioRepo(pool)

	_, err := repo.GetByEmail(context.Background(), "no-existe@movii.demo")
	require.ErrorIs(t, err, ErrNoEncontrado)
}

func TestUsuarioRepo_List(t *testing.T) {
	pool := nuevoPoolDeTest(t)
	repo := NewUsuarioRepo(pool)

	usuarios, err := repo.List(context.Background())
	require.NoError(t, err)
	require.NotEmpty(t, usuarios) // al menos los 3 del seed
}
```

- [ ] **Paso 2b: Agregar dependencia uuid usada por el test**

```bash
go get github.com/google/uuid@v1.6.0
```

- [ ] **Paso 3: Correr el test y verificar que falla**

Run: `go test ./internal/repository/... -v`
Expected: FAIL (el paquete `repository` no existe).

- [ ] **Paso 4: Implementar el repository**

`internal/repository/usuario_repo.go`:

```go
package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/domain"
)

// ErrNoEncontrado indica que el registro buscado no existe.
var ErrNoEncontrado = errors.New("registro no encontrado")

// ErrDuplicado indica una violación de restricción UNIQUE (ej. email repetido).
var ErrDuplicado = errors.New("registro duplicado")

const pgUniqueViolation = "23505"

// UsuarioRepo accede a la tabla usuarios.
type UsuarioRepo struct {
	pool *pgxpool.Pool
}

// NewUsuarioRepo crea un UsuarioRepo sobre el pool dado.
func NewUsuarioRepo(pool *pgxpool.Pool) *UsuarioRepo {
	return &UsuarioRepo{pool: pool}
}

// Create inserta un usuario nuevo. Devuelve ErrDuplicado si el email ya existe.
func (r *UsuarioRepo) Create(ctx context.Context, u domain.Usuario) (domain.Usuario, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO usuarios (nombre, email, password_hash, rol)
		VALUES ($1, $2, $3, $4)
		RETURNING id, nombre, email, password_hash, rol, activo
	`, u.Nombre, u.Email, u.PasswordHash, u.Rol)

	var creado domain.Usuario
	err := row.Scan(&creado.ID, &creado.Nombre, &creado.Email, &creado.PasswordHash, &creado.Rol, &creado.Activo)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
			return domain.Usuario{}, ErrDuplicado
		}
		return domain.Usuario{}, err
	}
	return creado, nil
}

// GetByEmail busca un usuario por email. Devuelve ErrNoEncontrado si no existe.
func (r *UsuarioRepo) GetByEmail(ctx context.Context, email string) (domain.Usuario, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, nombre, email, password_hash, rol, activo
		FROM usuarios WHERE email = $1
	`, email)

	var u domain.Usuario
	err := row.Scan(&u.ID, &u.Nombre, &u.Email, &u.PasswordHash, &u.Rol, &u.Activo)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Usuario{}, ErrNoEncontrado
	}
	if err != nil {
		return domain.Usuario{}, err
	}
	return u, nil
}

// List devuelve todos los usuarios ordenados por nombre.
func (r *UsuarioRepo) List(ctx context.Context) ([]domain.Usuario, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, nombre, email, password_hash, rol, activo
		FROM usuarios ORDER BY nombre
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var usuarios []domain.Usuario
	for rows.Next() {
		var u domain.Usuario
		if err := rows.Scan(&u.ID, &u.Nombre, &u.Email, &u.PasswordHash, &u.Rol, &u.Activo); err != nil {
			return nil, err
		}
		usuarios = append(usuarios, u)
	}
	return usuarios, rows.Err()
}
```

- [ ] **Paso 5: Correr el test y verificar que pasa**

Run: `go test ./internal/repository/... -v`
Expected: PASS (4 tests).

- [ ] **Paso 6: Commit**

```bash
go vet ./...
git add go.mod go.sum internal
git commit -m "feat: agregar dominio Usuario y UsuarioRepo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Service de autenticación (register + login + JWT)

**Files:**
- Create: `gestion-envios/services/api/internal/services/auth_service.go`
- Create: `gestion-envios/services/api/internal/services/auth_service_test.go`

**Interfaces:**
- Consumes: `domain.Usuario`, `repository.ErrDuplicado`, `repository.ErrNoEncontrado` (Task 5). Depende de una interfaz `usuarioRepo` (no del struct concreto) para poder testear con un fake.
- Produces:
  ```go
  type services.AuthService struct{ /* repo usuarioRepo; jwtSecret string */ }
  func services.NewAuthService(repo usuarioRepo, jwtSecret string) *AuthService

  func (s *AuthService) Register(ctx context.Context, nombre, email, password, rol string) (domain.Usuario, error)
  func (s *AuthService) Login(ctx context.Context, email, password string) (token string, err error)

  var services.ErrEmailInvalido = errors.New("email invalido")
  var services.ErrRolInvalido = errors.New("rol invalido")
  var services.ErrEmailEnUso = errors.New("el email ya esta registrado")
  var services.ErrCredencialesInvalidas = errors.New("credenciales invalidas")
  ```

- [ ] **Paso 1: Agregar dependencias de JWT y bcrypt**

```bash
go get github.com/golang-jwt/jwt/v5@v5.2.1
go get golang.org/x/crypto@v0.26.0
```

- [ ] **Paso 2: Escribir el test del service con un repo fake (falla)**

`internal/services/auth_service_test.go`:

```go
package services

import (
	"context"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

// repoFake implementa usuarioRepo en memoria para testear AuthService sin DB.
type repoFake struct {
	porEmail map[string]domain.Usuario
}

func nuevoRepoFake() *repoFake {
	return &repoFake{porEmail: map[string]domain.Usuario{}}
}

func (f *repoFake) Create(ctx context.Context, u domain.Usuario) (domain.Usuario, error) {
	if _, existe := f.porEmail[u.Email]; existe {
		return domain.Usuario{}, repository.ErrDuplicado
	}
	u.ID = "id-" + u.Email
	u.Activo = true
	f.porEmail[u.Email] = u
	return u, nil
}

func (f *repoFake) GetByEmail(ctx context.Context, email string) (domain.Usuario, error) {
	u, existe := f.porEmail[email]
	if !existe {
		return domain.Usuario{}, repository.ErrNoEncontrado
	}
	return u, nil
}

func TestRegister_CreaUsuarioConPasswordHasheada(t *testing.T) {
	svc := NewAuthService(nuevoRepoFake(), "secreto-de-test")

	u, err := svc.Register(context.Background(), "Ana", "ana@movii.demo", "clave-segura-123", domain.RolOperador)

	require.NoError(t, err)
	require.NotEmpty(t, u.ID)
	require.NotEqual(t, "clave-segura-123", u.PasswordHash)
}

func TestRegister_RechazaEmailInvalido(t *testing.T) {
	svc := NewAuthService(nuevoRepoFake(), "secreto-de-test")

	_, err := svc.Register(context.Background(), "Ana", "no-es-un-email", "clave-segura-123", domain.RolOperador)

	require.ErrorIs(t, err, ErrEmailInvalido)
}

func TestRegister_RechazaRolInvalido(t *testing.T) {
	svc := NewAuthService(nuevoRepoFake(), "secreto-de-test")

	_, err := svc.Register(context.Background(), "Ana", "ana@movii.demo", "clave-segura-123", "rol-inventado")

	require.ErrorIs(t, err, ErrRolInvalido)
}

func TestRegister_RechazaEmailDuplicado(t *testing.T) {
	repo := nuevoRepoFake()
	svc := NewAuthService(repo, "secreto-de-test")
	ctx := context.Background()

	_, err := svc.Register(ctx, "Ana", "ana@movii.demo", "clave-segura-123", domain.RolOperador)
	require.NoError(t, err)

	_, err = svc.Register(ctx, "Ana Dos", "ana@movii.demo", "otra-clave-123", domain.RolOperador)
	require.ErrorIs(t, err, ErrEmailEnUso)
}

func TestLogin_DevuelveTokenValidoConCredencialesCorrectas(t *testing.T) {
	repo := nuevoRepoFake()
	svc := NewAuthService(repo, "secreto-de-test")
	ctx := context.Background()

	_, err := svc.Register(ctx, "Ana", "ana@movii.demo", "clave-segura-123", domain.RolSupervisor)
	require.NoError(t, err)

	token, err := svc.Login(ctx, "ana@movii.demo", "clave-segura-123")
	require.NoError(t, err)
	require.NotEmpty(t, token)

	parsed, err := jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
		return []byte("secreto-de-test"), nil
	})
	require.NoError(t, err)
	claims := parsed.Claims.(jwt.MapClaims)
	require.Equal(t, domain.RolSupervisor, claims["rol"])
}

func TestLogin_RechazaPasswordIncorrecta(t *testing.T) {
	repo := nuevoRepoFake()
	svc := NewAuthService(repo, "secreto-de-test")
	ctx := context.Background()

	_, err := svc.Register(ctx, "Ana", "ana@movii.demo", "clave-segura-123", domain.RolOperador)
	require.NoError(t, err)

	_, err = svc.Login(ctx, "ana@movii.demo", "clave-incorrecta")
	require.ErrorIs(t, err, ErrCredencialesInvalidas)
}

func TestLogin_RechazaEmailInexistente(t *testing.T) {
	svc := NewAuthService(nuevoRepoFake(), "secreto-de-test")

	_, err := svc.Login(context.Background(), "no-existe@movii.demo", "cualquier-clave")

	require.ErrorIs(t, err, ErrCredencialesInvalidas)
}
```

- [ ] **Paso 3: Correr el test y verificar que falla**

Run: `go test ./internal/services/... -v`
Expected: FAIL (el paquete `services` no existe).

- [ ] **Paso 4: Implementar `AuthService`**

`internal/services/auth_service.go`:

```go
package services

import (
	"context"
	"errors"
	"net/mail"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

var (
	ErrEmailInvalido         = errors.New("email invalido")
	ErrRolInvalido           = errors.New("rol invalido")
	ErrEmailEnUso            = errors.New("el email ya esta registrado")
	ErrCredencialesInvalidas = errors.New("credenciales invalidas")
)

// usuarioRepo es lo mínimo que AuthService necesita de un repositorio de
// usuarios. UsuarioRepo (repository.UsuarioRepo) lo implementa; los tests
// usan un fake.
type usuarioRepo interface {
	Create(ctx context.Context, u domain.Usuario) (domain.Usuario, error)
	GetByEmail(ctx context.Context, email string) (domain.Usuario, error)
}

// AuthService contiene la lógica de negocio de HU-01 (registro y login).
type AuthService struct {
	repo      usuarioRepo
	jwtSecret string
}

// NewAuthService crea un AuthService.
func NewAuthService(repo usuarioRepo, jwtSecret string) *AuthService {
	return &AuthService{repo: repo, jwtSecret: jwtSecret}
}

var rolesValidos = map[string]bool{
	domain.RolOperador:   true,
	domain.RolRepartidor: true,
	domain.RolSupervisor: true,
}

// Register valida y crea un usuario nuevo con la contraseña hasheada.
func (s *AuthService) Register(ctx context.Context, nombre, email, password, rol string) (domain.Usuario, error) {
	if _, err := mail.ParseAddress(email); err != nil {
		return domain.Usuario{}, ErrEmailInvalido
	}
	if !rolesValidos[rol] {
		return domain.Usuario{}, ErrRolInvalido
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	if err != nil {
		return domain.Usuario{}, err
	}

	creado, err := s.repo.Create(ctx, domain.Usuario{
		Nombre:       nombre,
		Email:        email,
		PasswordHash: string(hash),
		Rol:          rol,
	})
	if errors.Is(err, repository.ErrDuplicado) {
		return domain.Usuario{}, ErrEmailEnUso
	}
	return creado, err
}

// Login valida las credenciales y devuelve un JWT firmado si son correctas.
// No distingue entre "email no existe" y "password incorrecta" en el error
// devuelto, para no filtrar información (CA-04 de HU-01).
func (s *AuthService) Login(ctx context.Context, email, password string) (string, error) {
	u, err := s.repo.GetByEmail(ctx, email)
	if errors.Is(err, repository.ErrNoEncontrado) {
		return "", ErrCredencialesInvalidas
	}
	if err != nil {
		return "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return "", ErrCredencialesInvalidas
	}

	claims := jwt.MapClaims{
		"sub": u.ID,
		"rol": u.Rol,
		"exp": time.Now().Add(24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}
```

- [ ] **Paso 5: Correr el test y verificar que pasa**

Run: `go test ./internal/services/... -v`
Expected: PASS (7 tests).

- [ ] **Paso 6: Commit**

```bash
go vet ./...
git add go.mod go.sum internal
git commit -m "feat: agregar AuthService con register, login y emision de JWT

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Handlers de auth — POST /auth/register y POST /auth/login

**Files:**
- Create: `gestion-envios/services/api/internal/handlers/auth_handler.go`
- Create: `gestion-envios/services/api/internal/handlers/auth_handler_test.go`

**Interfaces:**
- Consumes: `services.AuthService`, `services.ErrEmailInvalido`, `services.ErrRolInvalido`, `services.ErrEmailEnUso`, `services.ErrCredencialesInvalidas` (Task 6). `httpx.WriteJSON`, `httpx.WriteError` (Task 1).
- Produces:
  ```go
  type handlers.AuthHandler struct{ /* svc *services.AuthService */ }
  func handlers.NewAuthHandler(svc *services.AuthService) *AuthHandler
  func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request)
  func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request)
  ```
  Body de `Register`: `{"nombre","email","password","rol"}` → 201 `{"id","nombre","email","rol"}`.
  Body de `Login`: `{"email","password"}` → 200 `{"token"}`.

- [ ] **Paso 1: Escribir el test de los handlers con un AuthService real + repo fake (falla)**

`internal/handlers/auth_handler_test.go`:

```go
package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

type repoFakeAuth struct {
	porEmail map[string]domain.Usuario
}

func nuevoRepoFakeAuth() *repoFakeAuth {
	return &repoFakeAuth{porEmail: map[string]domain.Usuario{}}
}

func (f *repoFakeAuth) Create(ctx context.Context, u domain.Usuario) (domain.Usuario, error) {
	if _, existe := f.porEmail[u.Email]; existe {
		return domain.Usuario{}, repository.ErrDuplicado
	}
	u.ID = "id-" + u.Email
	u.Activo = true
	f.porEmail[u.Email] = u
	return u, nil
}

func (f *repoFakeAuth) GetByEmail(ctx context.Context, email string) (domain.Usuario, error) {
	u, existe := f.porEmail[email]
	if !existe {
		return domain.Usuario{}, repository.ErrNoEncontrado
	}
	return u, nil
}

func TestRegisterHandler_Devuelve201(t *testing.T) {
	svc := services.NewAuthService(nuevoRepoFakeAuth(), "secreto-de-test")
	h := NewAuthHandler(svc)

	body, _ := json.Marshal(map[string]string{
		"nombre": "Ana", "email": "ana@movii.demo", "password": "clave-segura-123", "rol": domain.RolOperador,
	})
	req := httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Register(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Equal(t, "ana@movii.demo", resp["email"])
	require.NotContains(t, rec.Body.String(), "password")
}

func TestRegisterHandler_EmailDuplicadoDevuelve409(t *testing.T) {
	svc := services.NewAuthService(nuevoRepoFakeAuth(), "secreto-de-test")
	h := NewAuthHandler(svc)
	body, _ := json.Marshal(map[string]string{
		"nombre": "Ana", "email": "ana@movii.demo", "password": "clave-segura-123", "rol": domain.RolOperador,
	})

	h.Register(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(body)))

	rec := httptest.NewRecorder()
	h.Register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(body)))

	require.Equal(t, http.StatusConflict, rec.Code)
}

func TestRegisterHandler_BodyInvalidoDevuelve400(t *testing.T) {
	svc := services.NewAuthService(nuevoRepoFakeAuth(), "secreto-de-test")
	h := NewAuthHandler(svc)

	req := httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader([]byte("no-es-json")))
	rec := httptest.NewRecorder()

	h.Register(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestLoginHandler_CredencialesCorrectasDevuelveToken(t *testing.T) {
	repo := nuevoRepoFakeAuth()
	svc := services.NewAuthService(repo, "secreto-de-test")
	h := NewAuthHandler(svc)

	regBody, _ := json.Marshal(map[string]string{
		"nombre": "Ana", "email": "ana@movii.demo", "password": "clave-segura-123", "rol": domain.RolOperador,
	})
	h.Register(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(regBody)))

	loginBody, _ := json.Marshal(map[string]string{"email": "ana@movii.demo", "password": "clave-segura-123"})
	req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(loginBody))
	rec := httptest.NewRecorder()

	h.Login(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.NotEmpty(t, resp["token"])
}

func TestLoginHandler_CredencialesIncorrectasDevuelve401(t *testing.T) {
	svc := services.NewAuthService(nuevoRepoFakeAuth(), "secreto-de-test")
	h := NewAuthHandler(svc)

	body, _ := json.Marshal(map[string]string{"email": "no-existe@movii.demo", "password": "x"})
	req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Login(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `go test ./internal/handlers/... -run "Register|Login" -v`
Expected: FAIL (`AuthHandler` no existe).

- [ ] **Paso 3: Implementar `AuthHandler`**

`internal/handlers/auth_handler.go`:

```go
package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	httpx "movii/api/internal/platform/http"
	"movii/api/internal/services"
)

// AuthHandler expone HU-01: registro, login.
type AuthHandler struct {
	svc *services.AuthService
}

// NewAuthHandler crea un AuthHandler.
func NewAuthHandler(svc *services.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

type registerRequest struct {
	Nombre   string `json:"nombre"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Rol      string `json:"rol"`
}

// Register maneja POST /auth/register.
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}

	u, err := h.svc.Register(r.Context(), req.Nombre, req.Email, req.Password, req.Rol)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusCreated, map[string]any{
			"id": u.ID, "nombre": u.Nombre, "email": u.Email, "rol": u.Rol,
		})
	case errors.Is(err, services.ErrEmailInvalido):
		httpx.WriteError(w, http.StatusBadRequest, "email_invalido", "el email no tiene un formato válido")
	case errors.Is(err, services.ErrRolInvalido):
		httpx.WriteError(w, http.StatusBadRequest, "rol_invalido", "el rol debe ser operador, repartidor o supervisor")
	case errors.Is(err, services.ErrEmailEnUso):
		httpx.WriteError(w, http.StatusConflict, "email_en_uso", "ya existe un usuario con ese email")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo registrar el usuario")
	}
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Login maneja POST /auth/login.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}

	token, err := h.svc.Login(r.Context(), req.Email, req.Password)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"token": token})
	case errors.Is(err, services.ErrCredencialesInvalidas):
		httpx.WriteError(w, http.StatusUnauthorized, "credenciales_invalidas", "email o contraseña incorrectos")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo iniciar sesión")
	}
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `go test ./internal/handlers/... -run "Register|Login" -v`
Expected: PASS (5 tests).

- [ ] **Paso 5: Commit**

```bash
go vet ./...
git add internal
git commit -m "feat: agregar handlers POST /auth/register y POST /auth/login

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Middleware RequireAuth + RequireRole

**Files:**
- Create: `gestion-envios/services/api/internal/middleware/auth.go`
- Create: `gestion-envios/services/api/internal/middleware/auth_test.go`

**Interfaces:**
- Consumes: nada de tareas anteriores directamente (implementa su propia verificación de JWT con `golang-jwt/v5` para no acoplarse a `services`).
- Produces:
  ```go
  type middleware.Claims struct { UsuarioID string; Rol string }

  func middleware.RequireAuth(jwtSecret string) func(http.Handler) http.Handler
  func middleware.RequireRole(roles ...string) func(http.Handler) http.Handler
  func middleware.ClaimsFromContext(ctx context.Context) (Claims, bool)
  ```
  `RequireAuth` guarda `Claims` en el contexto de la request con la key `middleware.claimsKey`; `RequireRole` la lee con `ClaimsFromContext` y debe montarse **después** de `RequireAuth` en la cadena.

- [ ] **Paso 1: Escribir el test del middleware (falla)**

`internal/middleware/auth_test.go`:

```go
package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"
)

func tokenDePrueba(t *testing.T, secret, rol string) string {
	t.Helper()
	claims := jwt.MapClaims{"sub": "user-1", "rol": rol, "exp": time.Now().Add(time.Hour).Unix()}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, err := token.SignedString([]byte(secret))
	require.NoError(t, err)
	return s
}

func handlerDePrueba() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			http.Error(w, "sin claims", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(claims.Rol))
	})
}

func TestRequireAuth_SinHeaderDevuelve401(t *testing.T) {
	mw := RequireAuth("secreto")
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	mw(handlerDePrueba()).ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestRequireAuth_TokenInvalidoDevuelve401(t *testing.T) {
	mw := RequireAuth("secreto")
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer token-invalido")
	rec := httptest.NewRecorder()

	mw(handlerDePrueba()).ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestRequireAuth_TokenValidoContinua(t *testing.T) {
	mw := RequireAuth("secreto")
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenDePrueba(t, "secreto", "supervisor"))
	rec := httptest.NewRecorder()

	mw(handlerDePrueba()).ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "supervisor", rec.Body.String())
}

func TestRequireRole_RolIncorrectoDevuelve403(t *testing.T) {
	auth := RequireAuth("secreto")
	role := RequireRole("supervisor")
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenDePrueba(t, "secreto", "operador"))
	rec := httptest.NewRecorder()

	auth(role(handlerDePrueba())).ServeHTTP(rec, req)

	require.Equal(t, http.StatusForbidden, rec.Code)
}

func TestRequireRole_RolCorrectoContinua(t *testing.T) {
	auth := RequireAuth("secreto")
	role := RequireRole("supervisor", "operador")
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenDePrueba(t, "secreto", "operador"))
	rec := httptest.NewRecorder()

	auth(role(handlerDePrueba())).ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
}
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `go test ./internal/middleware/... -v`
Expected: FAIL (el paquete `middleware` no existe).

- [ ] **Paso 3: Implementar el middleware**

`internal/middleware/auth.go`:

```go
package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"

	httpx "movii/api/internal/platform/http"
)

type contextKey string

const claimsKey contextKey = "claims"

// Claims son los datos del usuario autenticado extraídos del JWT.
type Claims struct {
	UsuarioID string
	Rol       string
}

// ClaimsFromContext recupera las Claims guardadas por RequireAuth.
func ClaimsFromContext(ctx context.Context) (Claims, bool) {
	c, ok := ctx.Value(claimsKey).(Claims)
	return c, ok
}

// RequireAuth valida el JWT del header Authorization: Bearer <token> y
// guarda las Claims en el contexto de la request.
func RequireAuth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			tokenStr := strings.TrimPrefix(header, "Bearer ")
			if header == "" || tokenStr == header {
				httpx.WriteError(w, http.StatusUnauthorized, "sin_token", "falta el header Authorization")
				return
			}

			token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
				return []byte(jwtSecret), nil
			})
			if err != nil || !token.Valid {
				httpx.WriteError(w, http.StatusUnauthorized, "token_invalido", "el token es inválido o expiró")
				return
			}

			claimsMap, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				httpx.WriteError(w, http.StatusUnauthorized, "token_invalido", "el token es inválido")
				return
			}

			claims := Claims{
				UsuarioID: toString(claimsMap["sub"]),
				Rol:       toString(claimsMap["rol"]),
			}
			ctx := context.WithValue(r.Context(), claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole exige que el usuario autenticado tenga uno de los roles dados.
// Debe montarse después de RequireAuth.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	permitido := make(map[string]bool, len(roles))
	for _, r := range roles {
		permitido[r] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFromContext(r.Context())
			if !ok || !permitido[claims.Rol] {
				httpx.WriteError(w, http.StatusForbidden, "rol_no_autorizado", "no tenés permisos para esta acción")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func toString(v interface{}) string {
	s, _ := v.(string)
	return s
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `go test ./internal/middleware/... -v`
Expected: PASS (5 tests).

- [ ] **Paso 5: Commit**

```bash
go vet ./...
git add internal
git commit -m "feat: agregar middleware RequireAuth y RequireRole

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Handler GET /users (protegido, solo supervisor)

**Files:**
- Create: `gestion-envios/services/api/internal/handlers/users_handler.go`
- Create: `gestion-envios/services/api/internal/handlers/users_handler_test.go`

**Interfaces:**
- Consumes: `domain.Usuario` (Task 5), `httpx.WriteJSON` (Task 1).
- Produces:
  ```go
  type handlers.UsuariosHandler struct{ /* repo interface{ List(ctx) ([]domain.Usuario, error) } */ }
  func handlers.NewUsuariosHandler(repo listaUsuariosRepo) *UsuariosHandler
  func (h *UsuariosHandler) List(w http.ResponseWriter, r *http.Request)
  ```
  Respuesta: `200 [{"id","nombre","email","rol","activo"}, ...]`.

- [ ] **Paso 1: Escribir el test del handler (falla)**

`internal/handlers/users_handler_test.go`:

```go
package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

type repoFakeUsuarios struct {
	usuarios []domain.Usuario
}

func (f *repoFakeUsuarios) List(ctx context.Context) ([]domain.Usuario, error) {
	return f.usuarios, nil
}

func TestUsuariosHandler_List_Devuelve200ConLista(t *testing.T) {
	repo := &repoFakeUsuarios{usuarios: []domain.Usuario{
		{ID: "1", Nombre: "Ana", Email: "ana@movii.demo", Rol: domain.RolSupervisor, Activo: true, PasswordHash: "no-deberia-viajar"},
	}}
	h := NewUsuariosHandler(repo)

	req := httptest.NewRequest(http.MethodGet, "/users", nil)
	rec := httptest.NewRecorder()

	h.List(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.NotContains(t, rec.Body.String(), "no-deberia-viajar")

	var resp []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Len(t, resp, 1)
	require.Equal(t, "ana@movii.demo", resp[0]["email"])
}
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `go test ./internal/handlers/... -run TestUsuariosHandler -v`
Expected: FAIL (`UsuariosHandler` no existe).

- [ ] **Paso 3: Implementar el handler**

`internal/handlers/users_handler.go`:

```go
package handlers

import (
	"context"
	"net/http"

	"movii/api/internal/domain"
	httpx "movii/api/internal/platform/http"
)

// listaUsuariosRepo es lo mínimo que UsuariosHandler necesita.
type listaUsuariosRepo interface {
	List(ctx context.Context) ([]domain.Usuario, error)
}

// UsuariosHandler expone el listado de usuarios (HU-01, CA-06).
type UsuariosHandler struct {
	repo listaUsuariosRepo
}

// NewUsuariosHandler crea un UsuariosHandler.
func NewUsuariosHandler(repo listaUsuariosRepo) *UsuariosHandler {
	return &UsuariosHandler{repo: repo}
}

type usuarioResponse struct {
	ID     string `json:"id"`
	Nombre string `json:"nombre"`
	Email  string `json:"email"`
	Rol    string `json:"rol"`
	Activo bool   `json:"activo"`
}

// List maneja GET /users.
func (h *UsuariosHandler) List(w http.ResponseWriter, r *http.Request) {
	usuarios, err := h.repo.List(r.Context())
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener la lista de usuarios")
		return
	}

	resp := make([]usuarioResponse, 0, len(usuarios))
	for _, u := range usuarios {
		resp = append(resp, usuarioResponse{ID: u.ID, Nombre: u.Nombre, Email: u.Email, Rol: u.Rol, Activo: u.Activo})
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `go test ./internal/handlers/... -run TestUsuariosHandler -v`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
go vet ./...
git add internal
git commit -m "feat: agregar handler GET /users

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Montaje final del router + smoke test end-to-end

**Files:**
- Modify: `gestion-envios/services/api/internal/platform/http/router.go`
- Modify: `gestion-envios/services/api/cmd/api/main.go`
- Create: `gestion-envios/services/api/tests/auth_flow_test.go`

**Interfaces:**
- Consumes: todo lo anterior (`repository.UsuarioRepo`, `services.AuthService`, `handlers.AuthHandler`, `handlers.UsuariosHandler`, `middleware.RequireAuth`, `middleware.RequireRole`).
- Produces: `httpx.NewRouter` ahora acepta `Deps{CORSOrigins, JWTSecret, AuthHandler, UsuariosHandler}` y monta `POST /auth/register`, `POST /auth/login`, `GET /users` (protegida).

- [ ] **Paso 1: Ampliar `Deps` y montar las rutas**

`internal/platform/http/router.go` (reemplaza el contenido del Task 1):

```go
package httpx

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"movii/api/internal/domain"
	"movii/api/internal/handlers"
	"movii/api/internal/middleware"
)

// Deps son las dependencias que el router necesita para montar las rutas.
type Deps struct {
	CORSOrigins      []string
	JWTSecret        string
	AuthHandler      *handlers.AuthHandler
	UsuariosHandler  *handlers.UsuariosHandler
}

// NewRouter arma el router HTTP completo de la API.
func NewRouter(deps Deps) http.Handler {
	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   deps.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	r.Get("/health", handlers.Health)

	r.Post("/auth/register", deps.AuthHandler.Register)
	r.Post("/auth/login", deps.AuthHandler.Login)

	r.Group(func(protected chi.Router) {
		protected.Use(middleware.RequireAuth(deps.JWTSecret))

		protected.Group(func(supervisorOnly chi.Router) {
			supervisorOnly.Use(middleware.RequireRole(domain.RolSupervisor))
			supervisorOnly.Get("/users", deps.UsuariosHandler.List)
		})
	})

	return r
}
```

- [ ] **Paso 2: Conectar todo en `main.go`**

```go
package main

import (
	"context"
	"log"
	"net/http"

	"github.com/joho/godotenv"

	"movii/api/internal/config"
	"movii/api/internal/handlers"
	"movii/api/internal/platform/db"
	httpx "movii/api/internal/platform/http"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx := context.Background()
	pool, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()

	usuarioRepo := repository.NewUsuarioRepo(pool)
	authService := services.NewAuthService(usuarioRepo, cfg.JWTSecret)

	router := httpx.NewRouter(httpx.Deps{
		CORSOrigins:     cfg.CORSOrigins,
		JWTSecret:       cfg.JWTSecret,
		AuthHandler:     handlers.NewAuthHandler(authService),
		UsuariosHandler: handlers.NewUsuariosHandler(usuarioRepo),
	})

	log.Printf("API escuchando en :%s (env=%s)", cfg.Port, cfg.Env)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatalf("server: %v", err)
	}
}
```

- [ ] **Paso 3: Escribir el smoke test end-to-end (falla si algo del cableado está mal)**

`tests/auth_flow_test.go`:

```go
package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/handlers"
	"movii/api/internal/platform/db"
	httpx "movii/api/internal/platform/http"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

func TestFlujoCompleto_RegistroLoginYListadoDeUsuarios(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan")
	}

	pool, err := db.New(t.Context(), url)
	require.NoError(t, err)
	defer pool.Close()

	usuarioRepo := repository.NewUsuarioRepo(pool)
	authService := services.NewAuthService(usuarioRepo, "secreto-de-test")
	router := httpx.NewRouter(httpx.Deps{
		CORSOrigins:     []string{"*"},
		JWTSecret:       "secreto-de-test",
		AuthHandler:     handlers.NewAuthHandler(authService),
		UsuariosHandler: handlers.NewUsuariosHandler(usuarioRepo),
	})

	// 1. Registrar un supervisor nuevo.
	regBody, _ := json.Marshal(map[string]string{
		"nombre": "Flujo Test", "email": "flujo-test@movii.demo",
		"password": "clave-segura-123", "rol": domain.RolSupervisor,
	})
	regReq := httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(regBody))
	regRec := httptest.NewRecorder()
	router.ServeHTTP(regRec, regReq)
	require.Equal(t, http.StatusCreated, regRec.Code)

	// 2. Loguearse y obtener el token.
	loginBody, _ := json.Marshal(map[string]string{"email": "flujo-test@movii.demo", "password": "clave-segura-123"})
	loginReq := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(loginBody))
	loginRec := httptest.NewRecorder()
	router.ServeHTTP(loginRec, loginReq)
	require.Equal(t, http.StatusOK, loginRec.Code)

	var loginResp map[string]string
	require.NoError(t, json.Unmarshal(loginRec.Body.Bytes(), &loginResp))
	token := loginResp["token"]
	require.NotEmpty(t, token)

	// 3. Usar el token para listar usuarios (requiere rol supervisor).
	listReq := httptest.NewRequest(http.MethodGet, "/users", nil)
	listReq.Header.Set("Authorization", "Bearer "+token)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)
	require.Equal(t, http.StatusOK, listRec.Code)

	// 4. Sin token, /users debe devolver 401.
	sinTokenReq := httptest.NewRequest(http.MethodGet, "/users", nil)
	sinTokenRec := httptest.NewRecorder()
	router.ServeHTTP(sinTokenRec, sinTokenReq)
	require.Equal(t, http.StatusUnauthorized, sinTokenRec.Code)

	// Limpieza.
	_, _ = pool.Exec(t.Context(), "DELETE FROM usuarios WHERE email = $1", "flujo-test@movii.demo")
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `go test ./... -v`
Expected: PASS en todos los paquetes (config, db, repository, services, middleware, handlers, tests).

- [ ] **Paso 5: Probar manualmente con el servidor real**

Run: `go run ./cmd/api`

En otra terminal:

```bash
curl -X POST http://localhost:8080/auth/register -H "Content-Type: application/json" \
  -d '{"nombre":"Demo","email":"demo@movii.demo","password":"clave-segura-123","rol":"supervisor"}'

curl -X POST http://localhost:8080/auth/login -H "Content-Type: application/json" \
  -d '{"email":"repartidor@movii.demo","password":"Movii2026!"}'
```

Expected: el primer `curl` devuelve 201 con el usuario creado; el segundo devuelve `{"token": "..."}` usando el usuario del seed (Task 4). Ctrl+C para detener el servidor.

- [ ] **Paso 6: Commit**

```bash
go vet ./...
gofmt -l .
git add internal cmd tests
git commit -m "feat: montar rutas de HU-01 en el router y agregar smoke test end-to-end

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: CI mínima (lint + test)

**Files:**
- Create: `.github/workflows/api-ci.yml` (en la raíz del repo `Movii/`, aplica también a `gestion-envios/`)

**Interfaces:** ninguna (configuración de CI).

- [ ] **Paso 1: Escribir el workflow**

`.github/workflows/api-ci.yml`:

```yaml
name: API CI

on:
  push:
    paths:
      - "gestion-envios/services/api/**"
  pull_request:
    paths:
      - "gestion-envios/services/api/**"

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: gestion-envios/services/api
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      JWT_SECRET: ci-secret-de-pruebas
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.22"
      - name: Vet
        run: go vet ./...
      - name: Aplicar migraciones
        run: go run ./cmd/migrate up
      - name: Test
        run: go test ./... -v
```

- [ ] **Paso 2: Documentar el secreto necesario**

Agregar una línea al final de `gestion-envios/services/api/.env.example`:

```
# En GitHub: Settings -> Secrets and variables -> Actions -> agregar DATABASE_URL
```

- [ ] **Paso 3: Commit**

```bash
git add .github/workflows/api-ci.yml "gestion-envios/services/api/.env.example"
git commit -m "ci: agregar workflow de lint y test para la API Go

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Paso 4: Cargar el secreto en GitHub (manual)**

En el repo de GitHub: Settings → Secrets and variables → Actions → New repository secret → nombre `DATABASE_URL`, valor la cadena de conexión de Supabase. Push de esta rama y verificar que el workflow corre en verde en la pestaña Actions.

---

## Self-Review

**Cobertura del spec:** este plan cubre las secciones 3.2 (API Go), 4 (auth), 5 (contrato — endpoints de HU-01), 6 (tablas), 7 (estrategia de tests, parte Go) del spec. Quedan para los planes siguientes: 3.3/3.4 (web, móvil), el resto del contrato de la sección 5 (envíos, rutas, asignación, repartidor), y la sección 8 (despliegue).

**Placeholders:** ninguno — todos los pasos tienen código completo o comandos exactos.

**Consistencia de tipos:** `domain.Usuario`, `repository.UsuarioRepo`, `services.AuthService`, `handlers.AuthHandler` / `UsuariosHandler`, `middleware.Claims` se usan con la misma forma en todas las tareas que los consumen; verificado nombre por nombre al escribir los Tasks 6-10.
