# API — HU-02, HU-03 y HU-04 (Envíos, Rutas, Asignación) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender la API Go (ya con HU-01 completa) con el registro de envíos (HU-02), la gestión de rutas diarias (HU-03) y la asignación de envíos a rutas (HU-04), end-to-end contra la base Supabase real.

**Architecture:** Mismas capas y convenciones que HU-01: `handlers → services → repository` sobre `pgx/v5`, router `chi`. El alta de un envío crea remitente + destinatario + envío en una sola transacción (`pgx.Tx`), por lo que se introduce una interfaz `repository.Querier` que both `*pgxpool.Pool` y `pgx.Tx` satisfacen, permitiendo reusar los mismos métodos de repository dentro o fuera de una transacción.

**Tech Stack:** El mismo de HU-01 — Go 1.27, chi v5, pgx v5, testify. No se agregan dependencias nuevas.

**Spec:** [docs/superpowers/specs/2026-09-05-sprint1-movii-design.md](../specs/2026-09-05-sprint1-movii-design.md)

## Global Constraints

- Módulo Go: `movii/api` (ya existente en `gestion-envios/services/api`).
- Todas las respuestas HTTP son JSON. Error: `{"error":{"code":"...","message":"..."}}`.
- Roles válidos: `operador`, `repartidor`, `supervisor`.
- Alta de envíos, alta/edición de rutas y asignación/desasignación: solo `operador` o `supervisor`.
- Base de datos: PostgreSQL en Supabase, vía `DATABASE_URL` en `gestion-envios/services/api/.env` (ya existe, gitignorado — **nunca** imprimir ni loguear su valor).
- El esquema de las 5 tablas (`usuarios`, `remitentes`, `destinatarios`, `rutas`, `envios`) **ya existe** en la base (migración `0001_init`, del plan de HU-01) — este plan no agrega migraciones nuevas.
- Commits en español, cierran con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- `gofmt` y `go vet` limpios antes de cada commit.
- Código de guía: formato `MOV-YYYYMMDD-XXXX` (4 dígitos, secuencia diaria), único.

---

## Task 1: Dominio — Envio, Remitente, Destinatario, Ruta

**Files:**
- Create: `gestion-envios/services/api/internal/domain/envio.go`
- Create: `gestion-envios/services/api/internal/domain/ruta.go`

**Interfaces:**
- Produces:
  ```go
  // domain/envio.go
  type Remitente struct { ID, Nombre, Telefono, Direccion string }
  type Destinatario struct {
      ID, Nombre, Telefono, Calle, Numero, PisoDepto, Localidad, CodigoPostal string
  }
  type Envio struct {
      ID, CodigoGuia, Estado, Tamano, TipoContenido string
      Peso                                          float64
      Fragil, Urgente                               bool
      RemitenteID, DestinatarioID                   string
      RutaID                                        *string // nil si no está asignado
  }
  type EnvioConDetalle struct {
      Envio
      Destinatario Destinatario
  }

  const (
      EstadoEnvioPendiente   = "pendiente"
      EstadoEnvioAsignado    = "asignado"
      EstadoEnvioEnCamino    = "en_camino"
      EstadoEnvioEntregado   = "entregado"
      EstadoEnvioNoEntregado = "no_entregado"
  )

  // domain/ruta.go
  type Ruta struct {
      ID, Nombre, Zona, Fecha, Estado, RepartidorID string // Fecha en formato "YYYY-MM-DD"
  }
  type RutaConConteo struct {
      Ruta
      CantidadEnvios int
  }

  const (
      EstadoRutaPlanificada = "planificada"
      EstadoRutaEnCurso     = "en_curso"
      EstadoRutaCompletada  = "completada"
  )
  ```

- [ ] **Paso 1: Crear `domain/envio.go`**

```go
package domain

// Remitente es quien origina un envío.
type Remitente struct {
	ID        string
	Nombre    string
	Telefono  string
	Direccion string
}

// Destinatario es quien recibe un envío.
type Destinatario struct {
	ID           string
	Nombre       string
	Telefono     string
	Calle        string
	Numero       string
	PisoDepto    string
	Localidad    string
	CodigoPostal string
}

// Envio representa un paquete a entregar.
type Envio struct {
	ID             string
	CodigoGuia     string
	Estado         string
	Peso           float64
	Tamano         string
	TipoContenido  string
	Fragil         bool
	Urgente        bool
	RemitenteID    string
	DestinatarioID string
	RutaID         *string // nil si el envío todavía no fue asignado a una ruta
}

// EnvioConDetalle agrega los datos del destinatario, usados en listados y detalle.
type EnvioConDetalle struct {
	Envio
	Destinatario Destinatario
}

const (
	EstadoEnvioPendiente   = "pendiente"
	EstadoEnvioAsignado    = "asignado"
	EstadoEnvioEnCamino    = "en_camino"
	EstadoEnvioEntregado   = "entregado"
	EstadoEnvioNoEntregado = "no_entregado"
)

const (
	TamanoChico   = "chico"
	TamanoMediano = "mediano"
	TamanoGrande  = "grande"
)
```

- [ ] **Paso 2: Crear `domain/ruta.go`**

```go
package domain

// Ruta es un recorrido de reparto diario asignado a un repartidor.
type Ruta struct {
	ID           string
	Nombre       string
	Zona         string
	Fecha        string // formato "YYYY-MM-DD"
	Estado       string
	RepartidorID string
}

// RutaConConteo agrega la cantidad de envíos asignados, usada en el listado.
type RutaConConteo struct {
	Ruta
	CantidadEnvios int
}

const (
	EstadoRutaPlanificada = "planificada"
	EstadoRutaEnCurso     = "en_curso"
	EstadoRutaCompletada  = "completada"
)
```

- [ ] **Paso 3: Compilar**

Run: `go build ./...` (desde `gestion-envios/services/api`)
Expected: sin errores (son structs nuevos, nada más los usa todavía).

- [ ] **Paso 4: Commit**

```bash
cd "gestion-envios/services/api"
gofmt -l .
git add internal/domain
git commit -m "feat: agregar dominio Envio, Remitente, Destinatario y Ruta

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `repository.Querier` + RemitenteRepo + DestinatarioRepo

**Files:**
- Create: `gestion-envios/services/api/internal/repository/querier.go`
- Create: `gestion-envios/services/api/internal/repository/contacto_repo.go`
- Create: `gestion-envios/services/api/internal/repository/contacto_repo_test.go`

**Interfaces:**
- Consumes: `domain.Remitente`, `domain.Destinatario` (Task 1).
- Produces:
  ```go
  // Querier: lo implementan *pgxpool.Pool y pgx.Tx.
  type Querier interface {
      Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
      Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
      QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
  }

  func CreateRemitente(ctx context.Context, q Querier, r domain.Remitente) (domain.Remitente, error)
  func CreateDestinatario(ctx context.Context, q Querier, d domain.Destinatario) (domain.Destinatario, error)
  ```

- [ ] **Paso 1: Crear la interfaz `Querier`**

`internal/repository/querier.go`:

```go
package repository

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Querier es lo mínimo que un repository necesita para ejecutar SQL. Tanto
// *pgxpool.Pool como pgx.Tx lo implementan, así los mismos métodos de
// repository sirven dentro o fuera de una transacción.
type Querier interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}
```

- [ ] **Paso 2: Escribir el test de RemitenteRepo/DestinatarioRepo (falla)**

`internal/repository/contacto_repo_test.go`:

```go
package repository

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

func nuevoPoolDeTestContacto(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	return pool
}

func TestCreateRemitente(t *testing.T) {
	pool := nuevoPoolDeTestContacto(t)
	ctx := context.Background()

	creado, err := CreateRemitente(ctx, pool, domain.Remitente{
		Nombre: "Test Remitente", Telefono: "3564-000000", Direccion: "Calle Falsa 123",
	})
	require.NoError(t, err)
	require.NotEmpty(t, creado.ID)
	require.Equal(t, "Test Remitente", creado.Nombre)

	_, err = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", creado.ID)
	require.NoError(t, err)
}

func TestCreateDestinatario(t *testing.T) {
	pool := nuevoPoolDeTestContacto(t)
	ctx := context.Background()

	creado, err := CreateDestinatario(ctx, pool, domain.Destinatario{
		Nombre: "Test Destinatario", Telefono: "3564-111111", Calle: "San Martín", Numero: "450",
		Localidad: "San Francisco", CodigoPostal: "X2400",
	})
	require.NoError(t, err)
	require.NotEmpty(t, creado.ID)
	require.Equal(t, "San Francisco", creado.Localidad)

	_, err = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", creado.ID)
	require.NoError(t, err)
}
```

- [ ] **Paso 3: Correr el test y verificar que falla**

Con `DATABASE_URL` exportada desde `.env` (`export $(grep -v '^#' .env | xargs)`):

Run: `go test ./internal/repository/... -run "TestCreateRemitente|TestCreateDestinatario" -v`
Expected: FAIL (`CreateRemitente`/`CreateDestinatario` no existen).

- [ ] **Paso 4: Implementar `contacto_repo.go`**

`internal/repository/contacto_repo.go`:

```go
package repository

import (
	"context"

	"movii/api/internal/domain"
)

// CreateRemitente inserta un remitente nuevo. q puede ser el pool o una transacción.
func CreateRemitente(ctx context.Context, q Querier, r domain.Remitente) (domain.Remitente, error) {
	row := q.QueryRow(ctx, `
		INSERT INTO remitentes (nombre, telefono, direccion)
		VALUES ($1, $2, $3)
		RETURNING id, nombre, telefono, direccion
	`, r.Nombre, r.Telefono, r.Direccion)

	var creado domain.Remitente
	if err := row.Scan(&creado.ID, &creado.Nombre, &creado.Telefono, &creado.Direccion); err != nil {
		return domain.Remitente{}, err
	}
	return creado, nil
}

// CreateDestinatario inserta un destinatario nuevo. q puede ser el pool o una transacción.
func CreateDestinatario(ctx context.Context, q Querier, d domain.Destinatario) (domain.Destinatario, error) {
	row := q.QueryRow(ctx, `
		INSERT INTO destinatarios (nombre, telefono, calle, numero, piso_depto, localidad, codigo_postal)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, nombre, telefono, calle, numero, COALESCE(piso_depto, ''), localidad, codigo_postal
	`, d.Nombre, d.Telefono, d.Calle, d.Numero, d.PisoDepto, d.Localidad, d.CodigoPostal)

	var creado domain.Destinatario
	err := row.Scan(&creado.ID, &creado.Nombre, &creado.Telefono, &creado.Calle, &creado.Numero,
		&creado.PisoDepto, &creado.Localidad, &creado.CodigoPostal)
	if err != nil {
		return domain.Destinatario{}, err
	}
	return creado, nil
}
```

- [ ] **Paso 5: Correr el test y verificar que pasa**

Run: `go test ./internal/repository/... -run "TestCreateRemitente|TestCreateDestinatario" -v`
Expected: PASS (2 tests).

- [ ] **Paso 6: Commit**

```bash
go vet ./...
git add internal/repository
git commit -m "feat: agregar Querier y repository de Remitente/Destinatario

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: EnvioRepo (Create, List, GetByID, Asignar, Desasignar)

**Files:**
- Create: `gestion-envios/services/api/internal/repository/envio_repo.go`
- Create: `gestion-envios/services/api/internal/repository/envio_repo_test.go`

**Interfaces:**
- Consumes: `domain.Envio`, `domain.EnvioConDetalle` (Task 1); `Querier` (Task 2); `ErrNoEncontrado`, `ErrDuplicado`, `pgUniqueViolation` (ya existen en `usuario_repo.go`, mismo paquete).
- Produces:
  ```go
  var ErrEnvioNoDisponible = errors.New("uno o mas envios no estan disponibles para asignar")

  type EnvioRepo struct{ /* pool *pgxpool.Pool */ }
  func NewEnvioRepo(pool *pgxpool.Pool) *EnvioRepo

  func (r *EnvioRepo) Create(ctx context.Context, q Querier, e domain.Envio) (domain.Envio, error)
  func (r *EnvioRepo) ContarPorPrefijoCodigo(ctx context.Context, q Querier, prefijo string) (int, error)
  func (r *EnvioRepo) List(ctx context.Context, estado, fecha string) ([]domain.EnvioConDetalle, error)
  func (r *EnvioRepo) GetByID(ctx context.Context, id string) (domain.EnvioConDetalle, error)
  func (r *EnvioRepo) AsignarEnvios(ctx context.Context, envioIDs []string, rutaID string) error
  func (r *EnvioRepo) DesasignarEnvio(ctx context.Context, envioID, rutaID string) error
  ```

- [ ] **Paso 1: Escribir el test de `EnvioRepo` (falla)**

`internal/repository/envio_repo_test.go`:

```go
package repository

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

func nuevoPoolDeTestEnvio(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	return pool
}

// crearRemitenteYDestinatarioDeTest crea los contactos que un envío necesita y
// devuelve una función para limpiarlos al final del test.
func crearRemitenteYDestinatarioDeTest(t *testing.T, pool *pgxpool.Pool) (remitenteID, destinatarioID string) {
	t.Helper()
	ctx := context.Background()

	rem, err := CreateRemitente(ctx, pool, domain.Remitente{Nombre: "Rem Test", Direccion: "Calle 1"})
	require.NoError(t, err)
	dest, err := CreateDestinatario(ctx, pool, domain.Destinatario{
		Nombre: "Dest Test", Calle: "Calle 2", Numero: "100", Localidad: "San Francisco", CodigoPostal: "X2400",
	})
	require.NoError(t, err)

	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", rem.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", dest.ID)
	})
	return rem.ID, dest.ID
}

func TestEnvioRepo_CreateYGetByID(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()
	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	creado, err := repo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9001", Peso: 3.5, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	require.NotEmpty(t, creado.ID)
	require.Equal(t, domain.EstadoEnvioPendiente, creado.Estado)

	detalle, err := repo.GetByID(ctx, creado.ID)
	require.NoError(t, err)
	require.Equal(t, "Dest Test", detalle.Destinatario.Nombre)

	_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", creado.ID)
}

func TestEnvioRepo_CreateCodigoGuiaDuplicado(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()
	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	primero, err := repo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9002", Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)

	_, err = repo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9002", Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.ErrorIs(t, err, ErrDuplicado)

	_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", primero.ID)
}

func TestEnvioRepo_ListFiltraPorEstado(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()
	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	creado, err := repo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9003", Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", creado.ID) })

	lista, err := repo.List(ctx, domain.EstadoEnvioPendiente, "")
	require.NoError(t, err)

	var encontrado bool
	for _, e := range lista {
		if e.ID == creado.ID {
			encontrado = true
		}
	}
	require.True(t, encontrado, "el envío creado debería aparecer en el listado filtrado por pendiente")
}

func TestEnvioRepo_AsignarYDesasignar(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()
	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	envio, err := repo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9004", Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID) })

	// repartidor de demo (seed de HU-01) para usar como dueño de la ruta de test
	var repartidorID string
	err = pool.QueryRow(ctx, "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID)
	require.NoError(t, err)

	var rutaID string
	err = pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id) VALUES ('Ruta Test', 'Zona Test', CURRENT_DATE, $1)
		RETURNING id
	`, repartidorID).Scan(&rutaID)
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", rutaID) })

	err = repo.AsignarEnvios(ctx, []string{envio.ID}, rutaID)
	require.NoError(t, err)

	asignado, err := repo.GetByID(ctx, envio.ID)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoEnvioAsignado, asignado.Estado)
	require.NotNil(t, asignado.RutaID)
	require.Equal(t, rutaID, *asignado.RutaID)

	err = repo.DesasignarEnvio(ctx, envio.ID, rutaID)
	require.NoError(t, err)

	desasignado, err := repo.GetByID(ctx, envio.ID)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoEnvioPendiente, desasignado.Estado)
	require.Nil(t, desasignado.RutaID)
}

func TestEnvioRepo_AsignarEnvioNoDisponibleDevuelveError(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()

	err := repo.AsignarEnvios(ctx, []string{"00000000-0000-0000-0000-000000000000"}, "11111111-1111-1111-1111-111111111111")
	require.ErrorIs(t, err, ErrEnvioNoDisponible)
}
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `go test ./internal/repository/... -run TestEnvioRepo -v`
Expected: FAIL (`EnvioRepo` no existe).

- [ ] **Paso 3: Implementar `envio_repo.go`**

`internal/repository/envio_repo.go`:

```go
package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/domain"
)

// ErrEnvioNoDisponible indica que uno o más envíos no están en estado
// "pendiente" y por lo tanto no se pueden asignar a una ruta.
var ErrEnvioNoDisponible = errors.New("uno o mas envios no estan disponibles para asignar")

// EnvioRepo accede a la tabla envios (y datos de destinatario para el detalle).
type EnvioRepo struct {
	pool *pgxpool.Pool
}

// NewEnvioRepo crea un EnvioRepo sobre el pool dado.
func NewEnvioRepo(pool *pgxpool.Pool) *EnvioRepo {
	return &EnvioRepo{pool: pool}
}

// Create inserta un envío nuevo. q puede ser el pool o una transacción (se
// usa dentro de una transacción junto con CreateRemitente/CreateDestinatario).
func (r *EnvioRepo) Create(ctx context.Context, q Querier, e domain.Envio) (domain.Envio, error) {
	row := q.QueryRow(ctx, `
		INSERT INTO envios (codigo_guia, peso, tamano, tipo_contenido, fragil, urgente, remitente_id, destinatario_id)
		VALUES ($1, $2, $3::tamano_paquete, $4, $5, $6, $7, $8)
		RETURNING id, codigo_guia, estado, peso, tamano, tipo_contenido, fragil, urgente, remitente_id, destinatario_id
	`, e.CodigoGuia, e.Peso, e.Tamano, e.TipoContenido, e.Fragil, e.Urgente, e.RemitenteID, e.DestinatarioID)

	var creado domain.Envio
	err := row.Scan(&creado.ID, &creado.CodigoGuia, &creado.Estado, &creado.Peso, &creado.Tamano,
		&creado.TipoContenido, &creado.Fragil, &creado.Urgente, &creado.RemitenteID, &creado.DestinatarioID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
			return domain.Envio{}, ErrDuplicado
		}
		return domain.Envio{}, err
	}
	return creado, nil
}

// ContarPorPrefijoCodigo cuenta los envíos cuyo código de guía empieza con
// prefijo. Se usa para generar el siguiente número de secuencia diaria.
func (r *EnvioRepo) ContarPorPrefijoCodigo(ctx context.Context, q Querier, prefijo string) (int, error) {
	var count int
	err := q.QueryRow(ctx, `SELECT COUNT(*) FROM envios WHERE codigo_guia LIKE $1`, prefijo+"%").Scan(&count)
	return count, err
}

// List devuelve los envíos que matchean el filtro. estado o fecha vacíos
// ("") no filtran por ese campo. fecha tiene formato "YYYY-MM-DD".
func (r *EnvioRepo) List(ctx context.Context, estado, fecha string) ([]domain.EnvioConDetalle, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT e.id, e.codigo_guia, e.estado, e.peso, e.tamano, e.tipo_contenido, e.fragil, e.urgente,
		       e.remitente_id, e.destinatario_id, e.ruta_id,
		       d.id, d.nombre, d.telefono, d.calle, d.numero, COALESCE(d.piso_depto, ''), d.localidad, d.codigo_postal
		FROM envios e
		JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE ($1 = '' OR e.estado::text = $1)
		  AND ($2 = '' OR e.created_at::date = $2::date)
		ORDER BY e.created_at DESC
	`, estado, fecha)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lista []domain.EnvioConDetalle
	for rows.Next() {
		var e domain.EnvioConDetalle
		var rutaID sql.NullString
		if err := rows.Scan(&e.ID, &e.CodigoGuia, &e.Estado, &e.Peso, &e.Tamano, &e.TipoContenido, &e.Fragil, &e.Urgente,
			&e.RemitenteID, &e.DestinatarioID, &rutaID,
			&e.Destinatario.ID, &e.Destinatario.Nombre, &e.Destinatario.Telefono, &e.Destinatario.Calle,
			&e.Destinatario.Numero, &e.Destinatario.PisoDepto, &e.Destinatario.Localidad, &e.Destinatario.CodigoPostal,
		); err != nil {
			return nil, err
		}
		if rutaID.Valid {
			e.RutaID = &rutaID.String
		}
		lista = append(lista, e)
	}
	return lista, rows.Err()
}

// GetByID devuelve el detalle de un envío con los datos del destinatario.
// Devuelve ErrNoEncontrado si no existe.
func (r *EnvioRepo) GetByID(ctx context.Context, id string) (domain.EnvioConDetalle, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT e.id, e.codigo_guia, e.estado, e.peso, e.tamano, e.tipo_contenido, e.fragil, e.urgente,
		       e.remitente_id, e.destinatario_id, e.ruta_id,
		       d.id, d.nombre, d.telefono, d.calle, d.numero, COALESCE(d.piso_depto, ''), d.localidad, d.codigo_postal
		FROM envios e
		JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE e.id = $1
	`, id)

	var e domain.EnvioConDetalle
	var rutaID sql.NullString
	err := row.Scan(&e.ID, &e.CodigoGuia, &e.Estado, &e.Peso, &e.Tamano, &e.TipoContenido, &e.Fragil, &e.Urgente,
		&e.RemitenteID, &e.DestinatarioID, &rutaID,
		&e.Destinatario.ID, &e.Destinatario.Nombre, &e.Destinatario.Telefono, &e.Destinatario.Calle,
		&e.Destinatario.Numero, &e.Destinatario.PisoDepto, &e.Destinatario.Localidad, &e.Destinatario.CodigoPostal,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.EnvioConDetalle{}, ErrNoEncontrado
	}
	if err != nil {
		return domain.EnvioConDetalle{}, err
	}
	if rutaID.Valid {
		e.RutaID = &rutaID.String
	}
	return e, nil
}

// AsignarEnvios asigna los envíos dados (deben estar "pendiente" y sin ruta)
// a rutaID, y los pasa a estado "asignado". Devuelve ErrEnvioNoDisponible si
// alguno no estaba pendiente (o no existe).
func (r *EnvioRepo) AsignarEnvios(ctx context.Context, envioIDs []string, rutaID string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE envios SET ruta_id = $1, estado = 'asignado'
		WHERE id = ANY($2) AND estado = 'pendiente'
	`, rutaID, envioIDs)
	if err != nil {
		return err
	}
	if int(tag.RowsAffected()) != len(envioIDs) {
		return ErrEnvioNoDisponible
	}
	return nil
}

// DesasignarEnvio quita un envío de una ruta y lo vuelve a "pendiente".
// Devuelve ErrNoEncontrado si el envío no existe o no pertenece a esa ruta.
func (r *EnvioRepo) DesasignarEnvio(ctx context.Context, envioID, rutaID string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE envios SET ruta_id = NULL, estado = 'pendiente'
		WHERE id = $1 AND ruta_id = $2
	`, envioID, rutaID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNoEncontrado
	}
	return nil
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `go test ./internal/repository/... -run TestEnvioRepo -v`
Expected: PASS (5 tests).

- [ ] **Paso 5: Commit**

```bash
go vet ./...
git add internal/repository
git commit -m "feat: agregar EnvioRepo (create, list, detalle, asignar, desasignar)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: EnvioService (HU-02 — alta con transacción, código de guía, listado)

**Files:**
- Create: `gestion-envios/services/api/internal/services/envio_service.go`
- Create: `gestion-envios/services/api/internal/services/envio_service_test.go`

**Interfaces:**
- Consumes: `domain.Envio`, `domain.Remitente`, `domain.Destinatario`, `domain.EnvioConDetalle` (Task 1); `repository.CreateRemitente`, `repository.CreateDestinatario`, `repository.EnvioRepo`, `repository.ErrDuplicado` (Tasks 2-3).
- Produces:
  ```go
  var ErrCamposObligatorios = errors.New("faltan campos obligatorios")

  type CrearEnvioInput struct {
      RemitenteNombre, RemitenteTelefono, RemitenteDireccion string
      DestinatarioNombre, DestinatarioTelefono                string
      Calle, Numero, PisoDepto, Localidad, CodigoPostal       string
      Peso                                                    float64
      Tamano, TipoContenido                                   string
      Fragil, Urgente                                         bool
  }

  type EnvioService struct{ /* pool *pgxpool.Pool; envioRepo *repository.EnvioRepo */ }
  func NewEnvioService(pool *pgxpool.Pool, envioRepo *repository.EnvioRepo) *EnvioService

  func (s *EnvioService) Create(ctx context.Context, in CrearEnvioInput) (domain.Envio, error)
  func (s *EnvioService) List(ctx context.Context, estado, fecha string) ([]domain.EnvioConDetalle, error)
  func (s *EnvioService) GetByID(ctx context.Context, id string) (domain.EnvioConDetalle, error)
  ```

- [ ] **Paso 1: Escribir el test de validación pura (falla)**

Este primer bloque no necesita base de datos — testea `validarCrearEnvioInput` directamente.

`internal/services/envio_service_test.go` (parte 1):

```go
package services

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

func TestValidarCrearEnvioInput_RechazaSinDestinatario(t *testing.T) {
	err := validarCrearEnvioInput(CrearEnvioInput{Calle: "Calle 1", Localidad: "San Francisco", Peso: 1})
	require.ErrorIs(t, err, ErrCamposObligatorios)
}

func TestValidarCrearEnvioInput_RechazaSinDireccion(t *testing.T) {
	err := validarCrearEnvioInput(CrearEnvioInput{DestinatarioNombre: "Juan", Localidad: "San Francisco", Peso: 1})
	require.ErrorIs(t, err, ErrCamposObligatorios)
}

func TestValidarCrearEnvioInput_RechazaPesoInvalido(t *testing.T) {
	err := validarCrearEnvioInput(CrearEnvioInput{
		DestinatarioNombre: "Juan", Calle: "Calle 1", Localidad: "San Francisco", Peso: 0,
	})
	require.ErrorIs(t, err, ErrCamposObligatorios)
}

func TestValidarCrearEnvioInput_AceptaInputCompleto(t *testing.T) {
	err := validarCrearEnvioInput(CrearEnvioInput{
		DestinatarioNombre: "Juan", Calle: "Calle 1", Localidad: "San Francisco", Peso: 2.5,
	})
	require.NoError(t, err)
}
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `go test ./internal/services/... -run TestValidarCrearEnvioInput -v`
Expected: FAIL (`validarCrearEnvioInput`, `CrearEnvioInput`, `ErrCamposObligatorios` no existen).

- [ ] **Paso 3: Implementar `envio_service.go`**

`internal/services/envio_service.go`:

```go
package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

// ErrCamposObligatorios indica que faltan datos requeridos para crear un envío.
var ErrCamposObligatorios = errors.New("faltan campos obligatorios")

// CrearEnvioInput agrupa los datos del formulario de alta de envío (HU-02, CA-01).
type CrearEnvioInput struct {
	RemitenteNombre      string
	RemitenteTelefono    string
	RemitenteDireccion   string
	DestinatarioNombre   string
	DestinatarioTelefono string
	Calle                string
	Numero               string
	PisoDepto            string
	Localidad            string
	CodigoPostal         string
	Peso                 float64
	Tamano               string
	TipoContenido        string
	Fragil               bool
	Urgente              bool
}

// validarCrearEnvioInput chequea los campos obligatorios del CA-04 de HU-02:
// nombre destinatario, dirección, localidad, peso.
func validarCrearEnvioInput(in CrearEnvioInput) error {
	if in.DestinatarioNombre == "" || in.Calle == "" || in.Localidad == "" || in.Peso <= 0 {
		return ErrCamposObligatorios
	}
	return nil
}

// EnvioService contiene la lógica de negocio de HU-02.
type EnvioService struct {
	pool      *pgxpool.Pool
	envioRepo *repository.EnvioRepo
}

// NewEnvioService crea un EnvioService.
func NewEnvioService(pool *pgxpool.Pool, envioRepo *repository.EnvioRepo) *EnvioService {
	return &EnvioService{pool: pool, envioRepo: envioRepo}
}

// Create valida el input y crea remitente + destinatario + envío en una sola
// transacción, generando un código de guía único (CA-02).
func (s *EnvioService) Create(ctx context.Context, in CrearEnvioInput) (domain.Envio, error) {
	if err := validarCrearEnvioInput(in); err != nil {
		return domain.Envio{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return domain.Envio{}, fmt.Errorf("envios: no se pudo iniciar la transacción: %w", err)
	}
	defer tx.Rollback(ctx) // no-op si ya se hizo commit

	remitente, err := repository.CreateRemitente(ctx, tx, domain.Remitente{
		Nombre: in.RemitenteNombre, Telefono: in.RemitenteTelefono, Direccion: in.RemitenteDireccion,
	})
	if err != nil {
		return domain.Envio{}, fmt.Errorf("envios: no se pudo crear el remitente: %w", err)
	}

	destinatario, err := repository.CreateDestinatario(ctx, tx, domain.Destinatario{
		Nombre: in.DestinatarioNombre, Telefono: in.DestinatarioTelefono, Calle: in.Calle,
		Numero: in.Numero, PisoDepto: in.PisoDepto, Localidad: in.Localidad, CodigoPostal: in.CodigoPostal,
	})
	if err != nil {
		return domain.Envio{}, fmt.Errorf("envios: no se pudo crear el destinatario: %w", err)
	}

	envio, err := s.crearConCodigoUnico(ctx, tx, in, remitente.ID, destinatario.ID)
	if err != nil {
		return domain.Envio{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Envio{}, fmt.Errorf("envios: no se pudo confirmar la transacción: %w", err)
	}
	return envio, nil
}

// crearConCodigoUnico genera un código de guía MOV-YYYYMMDD-XXXX y reintenta
// con el siguiente número si otro envío tomó ese código en simultáneo.
func (s *EnvioService) crearConCodigoUnico(ctx context.Context, q repository.Querier, in CrearEnvioInput, remitenteID, destinatarioID string) (domain.Envio, error) {
	fecha := time.Now().Format("20060102")
	prefijo := "MOV-" + fecha + "-"

	var ultimoErr error
	for intento := 0; intento < 5; intento++ {
		count, err := s.envioRepo.ContarPorPrefijoCodigo(ctx, q, prefijo)
		if err != nil {
			return domain.Envio{}, fmt.Errorf("envios: no se pudo generar el código de guía: %w", err)
		}
		codigo := fmt.Sprintf("%s%04d", prefijo, count+1+intento)

		envio, err := s.envioRepo.Create(ctx, q, domain.Envio{
			CodigoGuia: codigo, Peso: in.Peso, Tamano: in.Tamano, TipoContenido: in.TipoContenido,
			Fragil: in.Fragil, Urgente: in.Urgente, RemitenteID: remitenteID, DestinatarioID: destinatarioID,
		})
		if errors.Is(err, repository.ErrDuplicado) {
			ultimoErr = err
			continue
		}
		if err != nil {
			return domain.Envio{}, fmt.Errorf("envios: no se pudo crear el envío: %w", err)
		}
		return envio, nil
	}
	return domain.Envio{}, fmt.Errorf("envios: no se pudo generar un código de guía único tras varios intentos: %w", ultimoErr)
}

// List devuelve los envíos filtrados por estado y/o fecha (CA-05).
func (s *EnvioService) List(ctx context.Context, estado, fecha string) ([]domain.EnvioConDetalle, error) {
	return s.envioRepo.List(ctx, estado, fecha)
}

// GetByID devuelve el detalle de un envío.
func (s *EnvioService) GetByID(ctx context.Context, id string) (domain.EnvioConDetalle, error) {
	return s.envioRepo.GetByID(ctx, id)
}
```

- [ ] **Paso 4: Correr el test de validación y verificar que pasa**

Run: `go test ./internal/services/... -run TestValidarCrearEnvioInput -v`
Expected: PASS (4 tests).

- [ ] **Paso 5: Agregar y correr el test de integración de `Create`/`List`/`GetByID` contra la base real**

Agregar al mismo archivo `internal/services/envio_service_test.go`:

```go
func nuevoEnvioServiceDeTest(t *testing.T) (*EnvioService, *pgxpool.Pool) {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	return NewEnvioService(pool, repository.NewEnvioRepo(pool)), pool
}

func TestEnvioService_CreateGeneraCodigoYPersiste(t *testing.T) {
	svc, pool := nuevoEnvioServiceDeTest(t)
	ctx := context.Background()

	envio, err := svc.Create(ctx, CrearEnvioInput{
		RemitenteNombre: "Dep. Central", DestinatarioNombre: "Cliente Test",
		Calle: "Belgrano", Numero: "500", Localidad: "San Francisco", CodigoPostal: "X2400",
		Peso: 4.2, Tamano: domain.TamanoMediano,
	})
	require.NoError(t, err)
	require.Contains(t, envio.CodigoGuia, "MOV-")
	require.Equal(t, domain.EstadoEnvioPendiente, envio.Estado)

	detalle, err := svc.GetByID(ctx, envio.ID)
	require.NoError(t, err)
	require.Equal(t, "Cliente Test", detalle.Destinatario.Nombre)

	lista, err := svc.List(ctx, domain.EstadoEnvioPendiente, "")
	require.NoError(t, err)
	var encontrado bool
	for _, e := range lista {
		if e.ID == envio.ID {
			encontrado = true
		}
	}
	require.True(t, encontrado)

	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", envio.RemitenteID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", envio.DestinatarioID)
	})
}

func TestEnvioService_CreateRechazaInputInvalido(t *testing.T) {
	svc, _ := nuevoEnvioServiceDeTest(t)

	_, err := svc.Create(context.Background(), CrearEnvioInput{})
	require.ErrorIs(t, err, ErrCamposObligatorios)
}
```

Run: `go test ./internal/services/... -run TestEnvioService -v`
Expected: PASS (2 tests) contra la base real.

- [ ] **Paso 6: Commit**

```bash
go vet ./...
gofmt -l .
git add internal/services
git commit -m "feat: agregar EnvioService con alta transaccional y codigo de guia

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Handlers de envíos — POST/GET /envios, GET /envios/:id

**Files:**
- Create: `gestion-envios/services/api/internal/handlers/envio_handler.go`
- Create: `gestion-envios/services/api/internal/handlers/envio_handler_test.go`

**Interfaces:**
- Consumes: `services.EnvioService`, `services.ErrCamposObligatorios` (Task 4); `httpx.WriteJSON`, `httpx.WriteError` (ya existen); `repository.ErrNoEncontrado` (ya existe).
- Produces:
  ```go
  type EnvioHandler struct{ /* svc *services.EnvioService */ }
  func NewEnvioHandler(svc *services.EnvioService) *EnvioHandler
  func (h *EnvioHandler) Create(w http.ResponseWriter, r *http.Request)
  func (h *EnvioHandler) List(w http.ResponseWriter, r *http.Request)
  func (h *EnvioHandler) GetByID(w http.ResponseWriter, r *http.Request)
  ```
  `Create` espera body `{"remitente":{...},"destinatario":{...},"paquete":{...}}` → 201 con el envío creado (incluye `codigo_guia`).
  `List` lee query params `?estado=&fecha=` → 200 con array.
  `GetByID` usa `chi.URLParam(r, "id")` → 200 con detalle, 404 si no existe.

- [ ] **Paso 1: Escribir el test de los handlers con `EnvioService` real sobre la base de test (falla)**

Nota: a diferencia de HU-01 (que usaba fakes), `EnvioService.Create` necesita transacciones reales, así que estos tests de handler corren directamente contra la base de Supabase (igual que los tests de repository/service de este mismo plan).

`internal/handlers/envio_handler_test.go`:

```go
package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/repository"
	"movii/api/internal/services"
)

func nuevoEnvioHandlerDeTest(t *testing.T) (*EnvioHandler, *pgxpool.Pool) {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	envioRepo := repository.NewEnvioRepo(pool)
	svc := services.NewEnvioService(pool, envioRepo)
	return NewEnvioHandler(svc), pool
}

func TestEnvioHandler_CreateDevuelve201(t *testing.T) {
	h, pool := nuevoEnvioHandlerDeTest(t)
	ctx := context.Background()

	body, _ := json.Marshal(map[string]any{
		"remitente":    map[string]string{"nombre": "Dep. Central"},
		"destinatario": map[string]string{"nombre": "Cliente Handler Test", "calle": "Belgrano", "numero": "10", "localidad": "San Francisco", "codigo_postal": "X2400"},
		"paquete":      map[string]any{"peso": 2.0, "tamano": "chico"},
	})
	req := httptest.NewRequest(http.MethodPost, "/envios", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Create(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Contains(t, resp["codigo_guia"], "MOV-")

	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", resp["id"])
	})
}

func TestEnvioHandler_CreateCamposFaltantesDevuelve400(t *testing.T) {
	h, _ := nuevoEnvioHandlerDeTest(t)

	body, _ := json.Marshal(map[string]any{})
	req := httptest.NewRequest(http.MethodPost, "/envios", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Create(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestEnvioHandler_GetByIDNoEncontradoDevuelve404(t *testing.T) {
	h, _ := nuevoEnvioHandlerDeTest(t)

	req := httptest.NewRequest(http.MethodGet, "/envios/00000000-0000-0000-0000-000000000000", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "00000000-0000-0000-0000-000000000000")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	rec := httptest.NewRecorder()

	h.GetByID(rec, req)

	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestEnvioHandler_ListDevuelve200(t *testing.T) {
	h, _ := nuevoEnvioHandlerDeTest(t)

	req := httptest.NewRequest(http.MethodGet, "/envios", nil)
	rec := httptest.NewRecorder()

	h.List(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
}
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `go test ./internal/handlers/... -run TestEnvioHandler -v`
Expected: FAIL (`EnvioHandler` no existe).

- [ ] **Paso 3: Implementar `envio_handler.go`**

`internal/handlers/envio_handler.go`:

```go
package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	httpx "movii/api/internal/platform/http"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

// EnvioHandler expone HU-02: alta, listado y detalle de envíos.
type EnvioHandler struct {
	svc *services.EnvioService
}

// NewEnvioHandler crea un EnvioHandler.
func NewEnvioHandler(svc *services.EnvioService) *EnvioHandler {
	return &EnvioHandler{svc: svc}
}

type crearEnvioRequest struct {
	Remitente struct {
		Nombre    string `json:"nombre"`
		Telefono  string `json:"telefono"`
		Direccion string `json:"direccion"`
	} `json:"remitente"`
	Destinatario struct {
		Nombre       string `json:"nombre"`
		Telefono     string `json:"telefono"`
		Calle        string `json:"calle"`
		Numero       string `json:"numero"`
		PisoDepto    string `json:"piso_depto"`
		Localidad    string `json:"localidad"`
		CodigoPostal string `json:"codigo_postal"`
	} `json:"destinatario"`
	Paquete struct {
		Peso          float64 `json:"peso"`
		Tamano        string  `json:"tamano"`
		TipoContenido string  `json:"tipo_contenido"`
		Fragil        bool    `json:"fragil"`
		Urgente       bool    `json:"urgente"`
	} `json:"paquete"`
}

// Create maneja POST /envios.
func (h *EnvioHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req crearEnvioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}

	envio, err := h.svc.Create(r.Context(), services.CrearEnvioInput{
		RemitenteNombre:      req.Remitente.Nombre,
		RemitenteTelefono:    req.Remitente.Telefono,
		RemitenteDireccion:   req.Remitente.Direccion,
		DestinatarioNombre:   req.Destinatario.Nombre,
		DestinatarioTelefono: req.Destinatario.Telefono,
		Calle:                req.Destinatario.Calle,
		Numero:               req.Destinatario.Numero,
		PisoDepto:            req.Destinatario.PisoDepto,
		Localidad:            req.Destinatario.Localidad,
		CodigoPostal:         req.Destinatario.CodigoPostal,
		Peso:                 req.Paquete.Peso,
		Tamano:               req.Paquete.Tamano,
		TipoContenido:        req.Paquete.TipoContenido,
		Fragil:               req.Paquete.Fragil,
		Urgente:              req.Paquete.Urgente,
	})
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusCreated, map[string]any{
			"id": envio.ID, "codigo_guia": envio.CodigoGuia, "estado": envio.Estado,
			"peso": envio.Peso, "tamano": envio.Tamano,
		})
	case errors.Is(err, services.ErrCamposObligatorios):
		httpx.WriteError(w, http.StatusBadRequest, "campos_obligatorios", "faltan datos obligatorios del envío")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo registrar el envío")
	}
}

type envioListItemResponse struct {
	ID            string  `json:"id"`
	CodigoGuia    string  `json:"codigo_guia"`
	Estado        string  `json:"estado"`
	Peso          float64 `json:"peso"`
	Tamano        string  `json:"tamano"`
	Destinatario  string  `json:"destinatario"`
	Direccion     string  `json:"direccion"`
	RutaID        *string `json:"ruta_id"`
}

// List maneja GET /envios?estado=&fecha=.
func (h *EnvioHandler) List(w http.ResponseWriter, r *http.Request) {
	estado := r.URL.Query().Get("estado")
	fecha := r.URL.Query().Get("fecha")

	envios, err := h.svc.List(r.Context(), estado, fecha)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener la lista de envíos")
		return
	}

	resp := make([]envioListItemResponse, 0, len(envios))
	for _, e := range envios {
		resp = append(resp, envioListItemResponse{
			ID: e.ID, CodigoGuia: e.CodigoGuia, Estado: e.Estado, Peso: e.Peso, Tamano: e.Tamano,
			Destinatario: e.Destinatario.Nombre,
			Direccion:    e.Destinatario.Calle + " " + e.Destinatario.Numero + ", " + e.Destinatario.Localidad,
			RutaID:       e.RutaID,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

// GetByID maneja GET /envios/{id}.
func (h *EnvioHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	envio, err := h.svc.GetByID(r.Context(), id)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, envio)
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "el envío no existe")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener el envío")
	}
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `go test ./internal/handlers/... -run TestEnvioHandler -v`
Expected: PASS (4 tests).

- [ ] **Paso 5: Commit**

```bash
go vet ./...
gofmt -l .
git add internal/handlers
git commit -m "feat: agregar handlers POST/GET /envios y GET /envios/:id

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: RutaRepo (Create, List, GetByID, Update, EnviosDeRuta)

**Files:**
- Create: `gestion-envios/services/api/internal/repository/ruta_repo.go`
- Create: `gestion-envios/services/api/internal/repository/ruta_repo_test.go`

**Interfaces:**
- Consumes: `domain.Ruta`, `domain.RutaConConteo`, `domain.Envio` (Task 1); `ErrNoEncontrado` (ya existe).
- Produces:
  ```go
  var ErrRutaNoEditable = errors.New("la ruta no se puede editar en su estado actual")

  type RutaRepo struct{ /* pool *pgxpool.Pool */ }
  func NewRutaRepo(pool *pgxpool.Pool) *RutaRepo

  func (r *RutaRepo) Create(ctx context.Context, ruta domain.Ruta) (domain.Ruta, error)
  func (r *RutaRepo) List(ctx context.Context, fecha string) ([]domain.RutaConConteo, error)
  func (r *RutaRepo) GetByID(ctx context.Context, id string) (domain.Ruta, error)
  func (r *RutaRepo) Update(ctx context.Context, id string, ruta domain.Ruta) (domain.Ruta, error)
  func (r *RutaRepo) EnviosDeRuta(ctx context.Context, rutaID string) ([]domain.Envio, error)
  ```

- [ ] **Paso 1: Escribir el test de `RutaRepo` (falla)**

`internal/repository/ruta_repo_test.go`:

```go
package repository

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

func nuevoPoolDeTestRuta(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	return pool
}

func repartidorDeDemo(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	var id string
	err := pool.QueryRow(context.Background(), "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&id)
	require.NoError(t, err)
	return id
}

func TestRutaRepo_CreateYGetByID(t *testing.T) {
	pool := nuevoPoolDeTestRuta(t)
	repo := NewRutaRepo(pool)
	ctx := context.Background()
	repartidorID := repartidorDeDemo(t, pool)

	creada, err := repo.Create(ctx, domain.Ruta{
		Nombre: "Ruta Test Create", Zona: "Centro", Fecha: "2026-09-10", RepartidorID: repartidorID,
	})
	require.NoError(t, err)
	require.NotEmpty(t, creada.ID)
	require.Equal(t, domain.EstadoRutaPlanificada, creada.Estado)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", creada.ID) })

	encontrada, err := repo.GetByID(ctx, creada.ID)
	require.NoError(t, err)
	require.Equal(t, "Ruta Test Create", encontrada.Nombre)
}

func TestRutaRepo_GetByIDNoEncontrado(t *testing.T) {
	pool := nuevoPoolDeTestRuta(t)
	repo := NewRutaRepo(pool)

	_, err := repo.GetByID(context.Background(), "00000000-0000-0000-0000-000000000000")
	require.ErrorIs(t, err, ErrNoEncontrado)
}

func TestRutaRepo_UpdateSoloSiPlanificada(t *testing.T) {
	pool := nuevoPoolDeTestRuta(t)
	repo := NewRutaRepo(pool)
	ctx := context.Background()
	repartidorID := repartidorDeDemo(t, pool)

	creada, err := repo.Create(ctx, domain.Ruta{
		Nombre: "Ruta Test Update", Zona: "Centro", Fecha: "2026-09-10", RepartidorID: repartidorID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", creada.ID) })

	actualizada, err := repo.Update(ctx, creada.ID, domain.Ruta{
		Nombre: "Ruta Renombrada", Zona: "Norte", Fecha: "2026-09-11", RepartidorID: repartidorID,
	})
	require.NoError(t, err)
	require.Equal(t, "Ruta Renombrada", actualizada.Nombre)

	_, err = pool.Exec(ctx, "UPDATE rutas SET estado = 'en_curso' WHERE id = $1", creada.ID)
	require.NoError(t, err)

	_, err = repo.Update(ctx, creada.ID, domain.Ruta{
		Nombre: "No Debería Aplicar", Zona: "Norte", Fecha: "2026-09-11", RepartidorID: repartidorID,
	})
	require.ErrorIs(t, err, ErrRutaNoEditable)
}

func TestRutaRepo_ListIncluyeConteoDeEnvios(t *testing.T) {
	pool := nuevoPoolDeTestRuta(t)
	repo := NewRutaRepo(pool)
	ctx := context.Background()
	repartidorID := repartidorDeDemo(t, pool)

	creada, err := repo.Create(ctx, domain.Ruta{
		Nombre: "Ruta Test List", Zona: "Centro", Fecha: "2026-09-12", RepartidorID: repartidorID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", creada.ID) })

	lista, err := repo.List(ctx, "2026-09-12")
	require.NoError(t, err)
	require.Len(t, lista, 1)
	require.Equal(t, 0, lista[0].CantidadEnvios)
}
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `go test ./internal/repository/... -run TestRutaRepo -v`
Expected: FAIL (`RutaRepo` no existe).

- [ ] **Paso 3: Implementar `ruta_repo.go`**

`internal/repository/ruta_repo.go`:

```go
package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/domain"
)

// ErrRutaNoEditable indica que la ruta no está en estado "planificada" y por
// lo tanto no se puede editar ni desasignar envíos de ella.
var ErrRutaNoEditable = errors.New("la ruta no se puede editar en su estado actual")

// RutaRepo accede a la tabla rutas.
type RutaRepo struct {
	pool *pgxpool.Pool
}

// NewRutaRepo crea un RutaRepo sobre el pool dado.
func NewRutaRepo(pool *pgxpool.Pool) *RutaRepo {
	return &RutaRepo{pool: pool}
}

// Create inserta una ruta nueva en estado "planificada".
func (r *RutaRepo) Create(ctx context.Context, ruta domain.Ruta) (domain.Ruta, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id)
		VALUES ($1, $2, $3::date, $4)
		RETURNING id, nombre, zona, to_char(fecha, 'YYYY-MM-DD'), estado, repartidor_id
	`, ruta.Nombre, ruta.Zona, ruta.Fecha, ruta.RepartidorID)

	var creada domain.Ruta
	if err := row.Scan(&creada.ID, &creada.Nombre, &creada.Zona, &creada.Fecha, &creada.Estado, &creada.RepartidorID); err != nil {
		return domain.Ruta{}, err
	}
	return creada, nil
}

// List devuelve las rutas (filtradas por fecha si no está vacía) con la
// cantidad de envíos asignados a cada una.
func (r *RutaRepo) List(ctx context.Context, fecha string) ([]domain.RutaConConteo, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT r.id, r.nombre, r.zona, to_char(r.fecha, 'YYYY-MM-DD'), r.estado, r.repartidor_id, COUNT(e.id)
		FROM rutas r
		LEFT JOIN envios e ON e.ruta_id = r.id
		WHERE ($1 = '' OR r.fecha = $1::date)
		GROUP BY r.id
		ORDER BY r.fecha
	`, fecha)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lista []domain.RutaConConteo
	for rows.Next() {
		var rc domain.RutaConConteo
		if err := rows.Scan(&rc.ID, &rc.Nombre, &rc.Zona, &rc.Fecha, &rc.Estado, &rc.RepartidorID, &rc.CantidadEnvios); err != nil {
			return nil, err
		}
		lista = append(lista, rc)
	}
	return lista, rows.Err()
}

// GetByID devuelve una ruta por id. Devuelve ErrNoEncontrado si no existe.
func (r *RutaRepo) GetByID(ctx context.Context, id string) (domain.Ruta, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, nombre, zona, to_char(fecha, 'YYYY-MM-DD'), estado, repartidor_id
		FROM rutas WHERE id = $1
	`, id)

	var ruta domain.Ruta
	err := row.Scan(&ruta.ID, &ruta.Nombre, &ruta.Zona, &ruta.Fecha, &ruta.Estado, &ruta.RepartidorID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Ruta{}, ErrNoEncontrado
	}
	if err != nil {
		return domain.Ruta{}, err
	}
	return ruta, nil
}

// Update edita nombre/zona/fecha/repartidor de una ruta, solo si está en
// estado "planificada" (CA-03 de HU-03). Devuelve ErrNoEncontrado si la ruta
// no existe, o ErrRutaNoEditable si no está planificada.
func (r *RutaRepo) Update(ctx context.Context, id string, ruta domain.Ruta) (domain.Ruta, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE rutas SET nombre = $1, zona = $2, fecha = $3::date, repartidor_id = $4
		WHERE id = $5 AND estado = 'planificada'
		RETURNING id, nombre, zona, to_char(fecha, 'YYYY-MM-DD'), estado, repartidor_id
	`, ruta.Nombre, ruta.Zona, ruta.Fecha, ruta.RepartidorID, id)

	var actualizada domain.Ruta
	err := row.Scan(&actualizada.ID, &actualizada.Nombre, &actualizada.Zona, &actualizada.Fecha, &actualizada.Estado, &actualizada.RepartidorID)
	if errors.Is(err, pgx.ErrNoRows) {
		// El UPDATE no afectó filas: puede ser que la ruta no exista, o que
		// exista pero no esté planificada. Distinguimos con un SELECT.
		if _, errGet := r.GetByID(ctx, id); errors.Is(errGet, ErrNoEncontrado) {
			return domain.Ruta{}, ErrNoEncontrado
		}
		return domain.Ruta{}, ErrRutaNoEditable
	}
	if err != nil {
		return domain.Ruta{}, err
	}
	return actualizada, nil
}

// EnviosDeRuta devuelve los envíos asignados a una ruta.
func (r *RutaRepo) EnviosDeRuta(ctx context.Context, rutaID string) ([]domain.Envio, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, codigo_guia, estado, peso, tamano, tipo_contenido, fragil, urgente, remitente_id, destinatario_id
		FROM envios WHERE ruta_id = $1
	`, rutaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lista []domain.Envio
	for rows.Next() {
		var e domain.Envio
		if err := rows.Scan(&e.ID, &e.CodigoGuia, &e.Estado, &e.Peso, &e.Tamano, &e.TipoContenido, &e.Fragil, &e.Urgente, &e.RemitenteID, &e.DestinatarioID); err != nil {
			return nil, err
		}
		rutaIDCopia := rutaID
		e.RutaID = &rutaIDCopia
		lista = append(lista, e)
	}
	return lista, rows.Err()
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `go test ./internal/repository/... -run TestRutaRepo -v`
Expected: PASS (4 tests).

- [ ] **Paso 5: Commit**

```bash
go vet ./...
git add internal/repository
git commit -m "feat: agregar RutaRepo (create, list, detalle, update, envios)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: RutaService + AsignacionService (HU-03 + HU-04)

**Files:**
- Create: `gestion-envios/services/api/internal/services/ruta_service.go`
- Create: `gestion-envios/services/api/internal/services/asignacion_service.go`
- Create: `gestion-envios/services/api/internal/services/ruta_service_test.go`
- Create: `gestion-envios/services/api/internal/services/asignacion_service_test.go`

**Interfaces:**
- Consumes: `domain.Ruta`, `domain.Envio` (Task 1); `repository.RutaRepo`, `repository.EnvioRepo`, `repository.ErrNoEncontrado`, `repository.ErrRutaNoEditable`, `repository.ErrEnvioNoDisponible` (Tasks 3, 6).
- Produces:
  ```go
  var ErrRutaCamposObligatorios = errors.New("faltan campos obligatorios de la ruta")
  var ErrFechaVencida = errors.New("no se puede asignar a una ruta con fecha vencida")

  type DetalleRuta struct {
      Ruta           domain.Ruta
      Envios         []domain.Envio
      PesoTotal      float64
      CantidadEnvios int
  }

  type RutaService struct{ /* repo *repository.RutaRepo */ }
  func NewRutaService(repo *repository.RutaRepo) *RutaService
  func (s *RutaService) Create(ctx context.Context, ruta domain.Ruta) (domain.Ruta, error)
  func (s *RutaService) List(ctx context.Context, fecha string) ([]domain.RutaConConteo, error)
  func (s *RutaService) Detalle(ctx context.Context, id string) (DetalleRuta, error)
  func (s *RutaService) Update(ctx context.Context, id string, ruta domain.Ruta) (domain.Ruta, error)

  type AsignacionService struct{ /* rutaRepo *repository.RutaRepo; envioRepo *repository.EnvioRepo */ }
  func NewAsignacionService(rutaRepo *repository.RutaRepo, envioRepo *repository.EnvioRepo) *AsignacionService
  func (s *AsignacionService) Asignar(ctx context.Context, rutaID string, envioIDs []string) error
  func (s *AsignacionService) Desasignar(ctx context.Context, rutaID, envioID string) error
  ```

- [ ] **Paso 1: Escribir el test de validación pura de `RutaService` (falla)**

`internal/services/ruta_service_test.go` (parte 1, sin DB):

```go
package services

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

func TestValidarRuta_RechazaSinRepartidor(t *testing.T) {
	err := validarRuta(domain.Ruta{Fecha: "2026-09-10"})
	require.ErrorIs(t, err, ErrRutaCamposObligatorios)
}

func TestValidarRuta_RechazaSinFecha(t *testing.T) {
	err := validarRuta(domain.Ruta{RepartidorID: "algún-id"})
	require.ErrorIs(t, err, ErrRutaCamposObligatorios)
}

func TestValidarRuta_AceptaCompleta(t *testing.T) {
	err := validarRuta(domain.Ruta{RepartidorID: "algún-id", Fecha: "2026-09-10"})
	require.NoError(t, err)
}
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `go test ./internal/services/... -run TestValidarRuta -v`
Expected: FAIL (`validarRuta`, `ErrRutaCamposObligatorios` no existen).

- [ ] **Paso 3: Implementar `ruta_service.go`**

`internal/services/ruta_service.go`:

```go
package services

import (
	"context"
	"errors"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

// ErrRutaCamposObligatorios indica que falta el repartidor o la fecha al
// crear/editar una ruta (CA-05 de HU-03).
var ErrRutaCamposObligatorios = errors.New("faltan campos obligatorios de la ruta")

// validarRuta chequea los campos obligatorios de una ruta.
func validarRuta(ruta domain.Ruta) error {
	if ruta.RepartidorID == "" || ruta.Fecha == "" {
		return ErrRutaCamposObligatorios
	}
	return nil
}

// DetalleRuta agrupa una ruta con sus envíos y los totales (CA-04 de HU-03,
// CA-06 de HU-04).
type DetalleRuta struct {
	Ruta           domain.Ruta
	Envios         []domain.Envio
	PesoTotal      float64
	CantidadEnvios int
}

// RutaService contiene la lógica de negocio de HU-03.
type RutaService struct {
	repo *repository.RutaRepo
}

// NewRutaService crea un RutaService.
func NewRutaService(repo *repository.RutaRepo) *RutaService {
	return &RutaService{repo: repo}
}

// Create valida y crea una ruta nueva.
func (s *RutaService) Create(ctx context.Context, ruta domain.Ruta) (domain.Ruta, error) {
	if err := validarRuta(ruta); err != nil {
		return domain.Ruta{}, err
	}
	return s.repo.Create(ctx, ruta)
}

// List devuelve las rutas filtradas por fecha (CA-02).
func (s *RutaService) List(ctx context.Context, fecha string) ([]domain.RutaConConteo, error) {
	return s.repo.List(ctx, fecha)
}

// Detalle devuelve una ruta con sus envíos, peso total y cantidad (CA-04).
func (s *RutaService) Detalle(ctx context.Context, id string) (DetalleRuta, error) {
	ruta, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return DetalleRuta{}, err
	}
	envios, err := s.repo.EnviosDeRuta(ctx, id)
	if err != nil {
		return DetalleRuta{}, err
	}
	var peso float64
	for _, e := range envios {
		peso += e.Peso
	}
	return DetalleRuta{Ruta: ruta, Envios: envios, PesoTotal: peso, CantidadEnvios: len(envios)}, nil
}

// Update valida y edita una ruta, solo si está planificada (CA-03).
func (s *RutaService) Update(ctx context.Context, id string, ruta domain.Ruta) (domain.Ruta, error) {
	if err := validarRuta(ruta); err != nil {
		return domain.Ruta{}, err
	}
	return s.repo.Update(ctx, id, ruta)
}
```

- [ ] **Paso 4: Correr el test de validación y verificar que pasa**

Run: `go test ./internal/services/... -run TestValidarRuta -v`
Expected: PASS (3 tests).

- [ ] **Paso 5: Escribir el test de integración de `RutaService` contra la base real**

Agregar al mismo archivo `internal/services/ruta_service_test.go`:

```go
func nuevoRutaServiceDeTest(t *testing.T) (*RutaService, *pgxpool.Pool, string) {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	var repartidorID string
	err = pool.QueryRow(context.Background(), "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID)
	require.NoError(t, err)

	return NewRutaService(repository.NewRutaRepo(pool)), pool, repartidorID
}

func TestRutaService_CreateYDetalle(t *testing.T) {
	svc, pool, repartidorID := nuevoRutaServiceDeTest(t)
	ctx := context.Background()

	ruta, err := svc.Create(ctx, domain.Ruta{Nombre: "Ruta Service Test", Zona: "Centro", Fecha: "2026-09-15", RepartidorID: repartidorID})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })

	detalle, err := svc.Detalle(ctx, ruta.ID)
	require.NoError(t, err)
	require.Equal(t, 0, detalle.CantidadEnvios)
	require.Equal(t, float64(0), detalle.PesoTotal)
}

func TestRutaService_CreateRechazaSinDatos(t *testing.T) {
	svc, _, _ := nuevoRutaServiceDeTest(t)

	_, err := svc.Create(context.Background(), domain.Ruta{})
	require.ErrorIs(t, err, ErrRutaCamposObligatorios)
}
```

Run: `go test ./internal/services/... -run TestRutaService -v`
Expected: PASS (2 tests).

- [ ] **Paso 6: Escribir el test de `AsignacionService` (falla)**

`internal/services/asignacion_service_test.go`:

```go
package services

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

func nuevoAsignacionServiceDeTest(t *testing.T) (*AsignacionService, *pgxpool.Pool, string) {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	var repartidorID string
	err = pool.QueryRow(context.Background(), "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID)
	require.NoError(t, err)

	rutaRepo := repository.NewRutaRepo(pool)
	envioRepo := repository.NewEnvioRepo(pool)
	return NewAsignacionService(rutaRepo, envioRepo), pool, repartidorID
}

func crearEnvioPendienteDeTest(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	ctx := context.Background()
	rem, err := repository.CreateRemitente(ctx, pool, domain.Remitente{Nombre: "Rem"})
	require.NoError(t, err)
	dest, err := repository.CreateDestinatario(ctx, pool, domain.Destinatario{
		Nombre: "Dest", Calle: "Calle", Numero: "1", Localidad: "San Francisco", CodigoPostal: "X2400",
	})
	require.NoError(t, err)
	envioRepo := repository.NewEnvioRepo(pool)
	envio, err := envioRepo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-TEST-" + time.Now().Format("150405.000"), Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: rem.ID, DestinatarioID: dest.ID,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", rem.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", dest.ID)
	})
	return envio.ID
}

func TestAsignacionService_AsignarYDesasignar(t *testing.T) {
	svc, pool, repartidorID := nuevoAsignacionServiceDeTest(t)
	ctx := context.Background()
	rutaRepo := repository.NewRutaRepo(pool)

	ruta, err := rutaRepo.Create(ctx, domain.Ruta{
		Nombre: "Ruta Asig Test", Zona: "Centro", Fecha: time.Now().Format("2006-01-02"), RepartidorID: repartidorID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })

	envioID := crearEnvioPendienteDeTest(t, pool)

	err = svc.Asignar(ctx, ruta.ID, []string{envioID})
	require.NoError(t, err)

	err = svc.Desasignar(ctx, ruta.ID, envioID)
	require.NoError(t, err)
}

func TestAsignacionService_AsignarRechazaFechaVencida(t *testing.T) {
	svc, pool, repartidorID := nuevoAsignacionServiceDeTest(t)
	ctx := context.Background()
	rutaRepo := repository.NewRutaRepo(pool)

	ayer := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	ruta, err := rutaRepo.Create(ctx, domain.Ruta{
		Nombre: "Ruta Vencida Test", Zona: "Centro", Fecha: ayer, RepartidorID: repartidorID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })

	envioID := crearEnvioPendienteDeTest(t, pool)

	err = svc.Asignar(ctx, ruta.ID, []string{envioID})
	require.ErrorIs(t, err, ErrFechaVencida)
}

func TestAsignacionService_DesasignarRechazaRutaNoPlanificada(t *testing.T) {
	svc, pool, repartidorID := nuevoAsignacionServiceDeTest(t)
	ctx := context.Background()
	rutaRepo := repository.NewRutaRepo(pool)

	ruta, err := rutaRepo.Create(ctx, domain.Ruta{
		Nombre: "Ruta EnCurso Test", Zona: "Centro", Fecha: time.Now().Format("2006-01-02"), RepartidorID: repartidorID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })

	envioID := crearEnvioPendienteDeTest(t, pool)
	require.NoError(t, svc.Asignar(ctx, ruta.ID, []string{envioID}))

	_, err = pool.Exec(ctx, "UPDATE rutas SET estado = 'en_curso' WHERE id = $1", ruta.ID)
	require.NoError(t, err)

	err = svc.Desasignar(ctx, ruta.ID, envioID)
	require.ErrorIs(t, err, repository.ErrRutaNoEditable)
}
```

- [ ] **Paso 7: Correr el test y verificar que falla**

Run: `go test ./internal/services/... -run TestAsignacionService -v`
Expected: FAIL (`AsignacionService` no existe).

- [ ] **Paso 8: Implementar `asignacion_service.go`**

`internal/services/asignacion_service.go`:

```go
package services

import (
	"context"
	"errors"
	"time"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

// ErrFechaVencida indica que se intentó asignar un envío a una ruta cuya
// fecha de reparto ya pasó (CA-05 de HU-04).
var ErrFechaVencida = errors.New("no se puede asignar a una ruta con fecha vencida")

// AsignacionService contiene la lógica de negocio de HU-04.
type AsignacionService struct {
	rutaRepo  *repository.RutaRepo
	envioRepo *repository.EnvioRepo
}

// NewAsignacionService crea un AsignacionService.
func NewAsignacionService(rutaRepo *repository.RutaRepo, envioRepo *repository.EnvioRepo) *AsignacionService {
	return &AsignacionService{rutaRepo: rutaRepo, envioRepo: envioRepo}
}

// Asignar valida que la ruta exista y su fecha no haya vencido, y asigna los
// envíos dados (deben estar pendientes).
func (s *AsignacionService) Asignar(ctx context.Context, rutaID string, envioIDs []string) error {
	ruta, err := s.rutaRepo.GetByID(ctx, rutaID)
	if err != nil {
		return err
	}

	fechaRuta, err := time.Parse("2006-01-02", ruta.Fecha)
	if err != nil {
		return err
	}
	hoy := time.Now()
	hoySinHora := time.Date(hoy.Year(), hoy.Month(), hoy.Day(), 0, 0, 0, 0, hoy.Location())
	if fechaRuta.Before(hoySinHora) {
		return ErrFechaVencida
	}

	return s.envioRepo.AsignarEnvios(ctx, envioIDs, rutaID)
}

// Desasignar valida que la ruta esté planificada y quita el envío de ella.
func (s *AsignacionService) Desasignar(ctx context.Context, rutaID, envioID string) error {
	ruta, err := s.rutaRepo.GetByID(ctx, rutaID)
	if err != nil {
		return err
	}
	if ruta.Estado != domain.EstadoRutaPlanificada {
		return repository.ErrRutaNoEditable
	}
	return s.envioRepo.DesasignarEnvio(ctx, envioID, rutaID)
}
```

- [ ] **Paso 9: Correr el test y verificar que pasa**

Run: `go test ./internal/services/... -run TestAsignacionService -v`
Expected: PASS (3 tests).

- [ ] **Paso 10: Commit**

```bash
go vet ./...
gofmt -l .
git add internal/services
git commit -m "feat: agregar RutaService y AsignacionService (HU-03 y HU-04)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Handlers de rutas y asignación

**Files:**
- Create: `gestion-envios/services/api/internal/handlers/ruta_handler.go`
- Create: `gestion-envios/services/api/internal/handlers/ruta_handler_test.go`

**Interfaces:**
- Consumes: `services.RutaService`, `services.AsignacionService`, `services.ErrRutaCamposObligatorios`, `services.ErrFechaVencida`, `services.DetalleRuta` (Task 7); `repository.ErrNoEncontrado`, `repository.ErrRutaNoEditable`, `repository.ErrEnvioNoDisponible` (Tasks 3, 6).
- Produces:
  ```go
  type RutaHandler struct{ /* rutaSvc *services.RutaService; asigSvc *services.AsignacionService */ }
  func NewRutaHandler(rutaSvc *services.RutaService, asigSvc *services.AsignacionService) *RutaHandler
  func (h *RutaHandler) Create(w http.ResponseWriter, r *http.Request)
  func (h *RutaHandler) List(w http.ResponseWriter, r *http.Request)
  func (h *RutaHandler) Detail(w http.ResponseWriter, r *http.Request)
  func (h *RutaHandler) Update(w http.ResponseWriter, r *http.Request)
  func (h *RutaHandler) AsignarEnvios(w http.ResponseWriter, r *http.Request)
  func (h *RutaHandler) DesasignarEnvio(w http.ResponseWriter, r *http.Request)
  ```
  Rutas chi correspondientes: `POST /rutas`, `GET /rutas`, `GET /rutas/{id}`, `PUT /rutas/{id}`, `POST /rutas/{id}/envios`, `DELETE /rutas/{id}/envios/{envioId}`.

- [ ] **Paso 1: Escribir el test de los handlers contra la base real (falla)**

`internal/handlers/ruta_handler_test.go`:

```go
package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

func nuevoRutaHandlerDeTest(t *testing.T) (*RutaHandler, *pgxpool.Pool, string) {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	var repartidorID string
	err = pool.QueryRow(context.Background(), "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID)
	require.NoError(t, err)

	rutaRepo := repository.NewRutaRepo(pool)
	envioRepo := repository.NewEnvioRepo(pool)
	h := NewRutaHandler(services.NewRutaService(rutaRepo), services.NewAsignacionService(rutaRepo, envioRepo))
	return h, pool, repartidorID
}

func withURLParam(req *http.Request, key, value string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func TestRutaHandler_CreateDevuelve201(t *testing.T) {
	h, pool, repartidorID := nuevoRutaHandlerDeTest(t)

	body, _ := json.Marshal(map[string]string{
		"nombre": "Ruta Handler Test", "zona": "Centro", "fecha": "2026-09-20", "repartidor_id": repartidorID,
	})
	req := httptest.NewRequest(http.MethodPost, "/rutas", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Create(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), "DELETE FROM rutas WHERE id = $1", resp["id"]) })
}

func TestRutaHandler_DetailDevuelveConteosYTotales(t *testing.T) {
	h, pool, repartidorID := nuevoRutaHandlerDeTest(t)
	ctx := context.Background()

	rutaRepo := repository.NewRutaRepo(pool)
	ruta, err := rutaRepo.Create(ctx, domain.Ruta{Nombre: "Ruta Detail Test", Zona: "Centro", Fecha: "2026-09-21", RepartidorID: repartidorID})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })

	req := httptest.NewRequest(http.MethodGet, "/rutas/"+ruta.ID, nil)
	req = withURLParam(req, "id", ruta.ID)
	rec := httptest.NewRecorder()

	h.Detail(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Equal(t, float64(0), resp["cantidad_envios"])
}

func TestRutaHandler_AsignarYDesasignarEnvios(t *testing.T) {
	h, pool, repartidorID := nuevoRutaHandlerDeTest(t)
	ctx := context.Background()

	rutaRepo := repository.NewRutaRepo(pool)
	ruta, err := rutaRepo.Create(ctx, domain.Ruta{Nombre: "Ruta Asig Handler", Zona: "Centro", Fecha: time.Now().Format("2006-01-02"), RepartidorID: repartidorID})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })

	envioID := crearEnvioPendienteDeTest(t, pool)

	body, _ := json.Marshal(map[string]any{"envio_ids": []string{envioID}})
	req := httptest.NewRequest(http.MethodPost, "/rutas/"+ruta.ID+"/envios", bytes.NewReader(body))
	req = withURLParam(req, "id", ruta.ID)
	rec := httptest.NewRecorder()

	h.AsignarEnvios(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	delReq := httptest.NewRequest(http.MethodDelete, "/rutas/"+ruta.ID+"/envios/"+envioID, nil)
	delReq = withURLParam(delReq, "id", ruta.ID)
	delReq = withURLParam(delReq, "envioId", envioID)
	delRec := httptest.NewRecorder()

	h.DesasignarEnvio(delRec, delReq)
	require.Equal(t, http.StatusOK, delRec.Code)
}
```

Nota: `crearEnvioPendienteDeTest` ya está definida en `internal/services/asignacion_service_test.go` — el handler test define su propia copia local (los tests de distintos paquetes no comparten funciones). Agregar antes de los tests de este archivo:

```go
func crearEnvioPendienteDeTest(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	ctx := context.Background()
	rem, err := repository.CreateRemitente(ctx, pool, domain.Remitente{Nombre: "Rem"})
	require.NoError(t, err)
	dest, err := repository.CreateDestinatario(ctx, pool, domain.Destinatario{
		Nombre: "Dest", Calle: "Calle", Numero: "1", Localidad: "San Francisco", CodigoPostal: "X2400",
	})
	require.NoError(t, err)
	envioRepo := repository.NewEnvioRepo(pool)
	envio, err := envioRepo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-HTEST-" + time.Now().Format("150405.000"), Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: rem.ID, DestinatarioID: dest.ID,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", rem.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", dest.ID)
	})
	return envio.ID
}
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `go test ./internal/handlers/... -run TestRutaHandler -v`
Expected: FAIL (`RutaHandler` no existe).

- [ ] **Paso 3: Implementar `ruta_handler.go`**

`internal/handlers/ruta_handler.go`:

```go
package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"movii/api/internal/domain"
	httpx "movii/api/internal/platform/http"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

// RutaHandler expone HU-03 (rutas) y HU-04 (asignación de envíos a rutas).
type RutaHandler struct {
	rutaSvc *services.RutaService
	asigSvc *services.AsignacionService
}

// NewRutaHandler crea un RutaHandler.
func NewRutaHandler(rutaSvc *services.RutaService, asigSvc *services.AsignacionService) *RutaHandler {
	return &RutaHandler{rutaSvc: rutaSvc, asigSvc: asigSvc}
}

type rutaRequest struct {
	Nombre       string `json:"nombre"`
	Zona         string `json:"zona"`
	Fecha        string `json:"fecha"`
	RepartidorID string `json:"repartidor_id"`
}

// Create maneja POST /rutas.
func (h *RutaHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req rutaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}

	ruta, err := h.rutaSvc.Create(r.Context(), domain.Ruta{
		Nombre: req.Nombre, Zona: req.Zona, Fecha: req.Fecha, RepartidorID: req.RepartidorID,
	})
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusCreated, ruta)
	case errors.Is(err, services.ErrRutaCamposObligatorios):
		httpx.WriteError(w, http.StatusBadRequest, "campos_obligatorios", "faltan el repartidor o la fecha de la ruta")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo crear la ruta")
	}
}

// List maneja GET /rutas?fecha=.
func (h *RutaHandler) List(w http.ResponseWriter, r *http.Request) {
	fecha := r.URL.Query().Get("fecha")

	rutas, err := h.rutaSvc.List(r.Context(), fecha)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener la lista de rutas")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, rutas)
}

type detalleRutaResponse struct {
	ID             string         `json:"id"`
	Nombre         string         `json:"nombre"`
	Zona           string         `json:"zona"`
	Fecha          string         `json:"fecha"`
	Estado         string         `json:"estado"`
	RepartidorID   string         `json:"repartidor_id"`
	Envios         []domain.Envio `json:"envios"`
	PesoTotal      float64        `json:"peso_total"`
	CantidadEnvios int            `json:"cantidad_envios"`
}

// Detail maneja GET /rutas/{id}.
func (h *RutaHandler) Detail(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	detalle, err := h.rutaSvc.Detalle(r.Context(), id)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, detalleRutaResponse{
			ID: detalle.Ruta.ID, Nombre: detalle.Ruta.Nombre, Zona: detalle.Ruta.Zona,
			Fecha: detalle.Ruta.Fecha, Estado: detalle.Ruta.Estado, RepartidorID: detalle.Ruta.RepartidorID,
			Envios: detalle.Envios, PesoTotal: detalle.PesoTotal, CantidadEnvios: detalle.CantidadEnvios,
		})
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "la ruta no existe")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener la ruta")
	}
}

// Update maneja PUT /rutas/{id}.
func (h *RutaHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req rutaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}

	ruta, err := h.rutaSvc.Update(r.Context(), id, domain.Ruta{
		Nombre: req.Nombre, Zona: req.Zona, Fecha: req.Fecha, RepartidorID: req.RepartidorID,
	})
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, ruta)
	case errors.Is(err, services.ErrRutaCamposObligatorios):
		httpx.WriteError(w, http.StatusBadRequest, "campos_obligatorios", "faltan el repartidor o la fecha de la ruta")
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "la ruta no existe")
	case errors.Is(err, repository.ErrRutaNoEditable):
		httpx.WriteError(w, http.StatusConflict, "ruta_no_editable", "la ruta no se puede editar en su estado actual")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo editar la ruta")
	}
}

type asignarEnviosRequest struct {
	EnvioIDs []string `json:"envio_ids"`
}

// AsignarEnvios maneja POST /rutas/{id}/envios.
func (h *RutaHandler) AsignarEnvios(w http.ResponseWriter, r *http.Request) {
	rutaID := chi.URLParam(r, "id")

	var req asignarEnviosRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "body_invalido", "el cuerpo de la petición no es JSON válido")
		return
	}

	err := h.asigSvc.Asignar(r.Context(), rutaID, req.EnvioIDs)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"asignados": len(req.EnvioIDs)})
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "la ruta no existe")
	case errors.Is(err, services.ErrFechaVencida):
		httpx.WriteError(w, http.StatusBadRequest, "fecha_vencida", "la fecha de la ruta ya pasó")
	case errors.Is(err, repository.ErrEnvioNoDisponible):
		httpx.WriteError(w, http.StatusConflict, "envio_no_disponible", "uno o más envíos no están pendientes")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo asignar los envíos")
	}
}

// DesasignarEnvio maneja DELETE /rutas/{id}/envios/{envioId}.
func (h *RutaHandler) DesasignarEnvio(w http.ResponseWriter, r *http.Request) {
	rutaID := chi.URLParam(r, "id")
	envioID := chi.URLParam(r, "envioId")

	err := h.asigSvc.Desasignar(r.Context(), rutaID, envioID)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"estado": "pendiente"})
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "la ruta o el envío no existen")
	case errors.Is(err, repository.ErrRutaNoEditable):
		httpx.WriteError(w, http.StatusConflict, "ruta_no_editable", "la ruta no se puede editar en su estado actual")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo desasignar el envío")
	}
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `go test ./internal/handlers/... -run TestRutaHandler -v`
Expected: PASS (3 tests).

- [ ] **Paso 5: Commit**

```bash
go vet ./...
gofmt -l .
git add internal/handlers
git commit -m "feat: agregar handlers de rutas y asignacion de envios

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Montaje final del router + smoke test end-to-end de HU-02/03/04

**Files:**
- Modify: `gestion-envios/services/api/internal/httprouter/router.go`
- Modify: `gestion-envios/services/api/cmd/api/main.go`
- Create: `gestion-envios/services/api/tests/envios_rutas_flow_test.go`

**Interfaces:**
- Consumes: `handlers.EnvioHandler`, `handlers.RutaHandler` (Tasks 5, 8); todo lo de HU-01 ya montado.
- Produces: `httprouter.Deps` ahora acepta `EnvioHandler *handlers.EnvioHandler` y `RutaHandler *handlers.RutaHandler`, y el router monta `POST/GET /envios`, `GET /envios/{id}`, `POST/GET /rutas`, `GET/PUT /rutas/{id}`, `POST /rutas/{id}/envios`, `DELETE /rutas/{id}/envios/{envioId}`.

- [ ] **Paso 1: Ampliar `Deps` y montar las rutas**

`internal/httprouter/router.go` (reemplaza el contenido actual):

```go
package httprouter

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
	CORSOrigins     []string
	JWTSecret       string
	AuthHandler     *handlers.AuthHandler
	UsuariosHandler *handlers.UsuariosHandler
	EnvioHandler    *handlers.EnvioHandler
	RutaHandler     *handlers.RutaHandler
}

// New arma el router HTTP completo de la API.
func New(deps Deps) http.Handler {
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

		protected.Get("/envios", deps.EnvioHandler.List)
		protected.Get("/envios/{id}", deps.EnvioHandler.GetByID)
		protected.Get("/rutas", deps.RutaHandler.List)
		protected.Get("/rutas/{id}", deps.RutaHandler.Detail)

		protected.Group(func(operativo chi.Router) {
			operativo.Use(middleware.RequireRole(domain.RolOperador, domain.RolSupervisor))
			operativo.Post("/envios", deps.EnvioHandler.Create)
			operativo.Post("/rutas", deps.RutaHandler.Create)
			operativo.Put("/rutas/{id}", deps.RutaHandler.Update)
			operativo.Post("/rutas/{id}/envios", deps.RutaHandler.AsignarEnvios)
			operativo.Delete("/rutas/{id}/envios/{envioId}", deps.RutaHandler.DesasignarEnvio)
		})
	})

	return r
}
```

- [ ] **Paso 2: Conectar todo en `main.go`**

`cmd/api/main.go` (reemplaza el contenido actual):

```go
package main

import (
	"context"
	"log"
	"net/http"

	"github.com/joho/godotenv"

	"movii/api/internal/config"
	"movii/api/internal/handlers"
	"movii/api/internal/httprouter"
	"movii/api/internal/platform/db"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

func main() {
	_ = godotenv.Load() // en producción las variables ya están en el entorno

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
	envioRepo := repository.NewEnvioRepo(pool)
	rutaRepo := repository.NewRutaRepo(pool)

	authService := services.NewAuthService(usuarioRepo, cfg.JWTSecret)
	envioService := services.NewEnvioService(pool, envioRepo)
	rutaService := services.NewRutaService(rutaRepo)
	asignacionService := services.NewAsignacionService(rutaRepo, envioRepo)

	router := httprouter.New(httprouter.Deps{
		CORSOrigins:     cfg.CORSOrigins,
		JWTSecret:       cfg.JWTSecret,
		AuthHandler:     handlers.NewAuthHandler(authService),
		UsuariosHandler: handlers.NewUsuariosHandler(usuarioRepo),
		EnvioHandler:    handlers.NewEnvioHandler(envioService),
		RutaHandler:     handlers.NewRutaHandler(rutaService, asignacionService),
	})

	log.Printf("API escuchando en :%s (env=%s)", cfg.Port, cfg.Env)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatalf("server: %v", err)
	}
}
```

- [ ] **Paso 3: Escribir el smoke test end-to-end (falla si algo del cableado está mal)**

`tests/envios_rutas_flow_test.go`:

```go
package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/handlers"
	"movii/api/internal/httprouter"
	"movii/api/internal/platform/db"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

func TestFlujoCompleto_EnvioRutaYAsignacion(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}

	pool, err := db.New(t.Context(), url)
	require.NoError(t, err)
	defer pool.Close()

	usuarioRepo := repository.NewUsuarioRepo(pool)
	envioRepo := repository.NewEnvioRepo(pool)
	rutaRepo := repository.NewRutaRepo(pool)
	authService := services.NewAuthService(usuarioRepo, "secreto-de-test")
	router := httprouter.New(httprouter.Deps{
		CORSOrigins:     []string{"*"},
		JWTSecret:       "secreto-de-test",
		AuthHandler:     handlers.NewAuthHandler(authService),
		UsuariosHandler: handlers.NewUsuariosHandler(usuarioRepo),
		EnvioHandler:    handlers.NewEnvioHandler(services.NewEnvioService(pool, envioRepo)),
		RutaHandler:     handlers.NewRutaHandler(services.NewRutaService(rutaRepo), services.NewAsignacionService(rutaRepo, envioRepo)),
	})

	// 0. Login como operador de la demo.
	loginBody, _ := json.Marshal(map[string]string{"email": "operador@movii.demo", "password": "Movii2026!"})
	loginReq := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(loginBody))
	loginRec := httptest.NewRecorder()
	router.ServeHTTP(loginRec, loginReq)
	require.Equal(t, http.StatusOK, loginRec.Code)
	var loginResp map[string]string
	require.NoError(t, json.Unmarshal(loginRec.Body.Bytes(), &loginResp))
	token := loginResp["token"]

	// 1. Registrar un envío.
	envioBody, _ := json.Marshal(map[string]any{
		"remitente":    map[string]string{"nombre": "Dep. Flujo Test"},
		"destinatario": map[string]string{"nombre": "Cliente Flujo Test", "calle": "Mitre", "numero": "200", "localidad": "San Francisco", "codigo_postal": "X2400"},
		"paquete":      map[string]any{"peso": 5.0, "tamano": "mediano"},
	})
	envioReq := httptest.NewRequest(http.MethodPost, "/envios", bytes.NewReader(envioBody))
	envioReq.Header.Set("Authorization", "Bearer "+token)
	envioRec := httptest.NewRecorder()
	router.ServeHTTP(envioRec, envioReq)
	require.Equal(t, http.StatusCreated, envioRec.Code)
	var envioResp map[string]any
	require.NoError(t, json.Unmarshal(envioRec.Body.Bytes(), &envioResp))
	envioID := envioResp["id"].(string)

	// 2. Crear una ruta para hoy.
	var repartidorID string
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID))
	rutaBody, _ := json.Marshal(map[string]string{
		"nombre": "Ruta Flujo Test", "zona": "Centro", "fecha": "2026-12-31", "repartidor_id": repartidorID,
	})
	rutaReq := httptest.NewRequest(http.MethodPost, "/rutas", bytes.NewReader(rutaBody))
	rutaReq.Header.Set("Authorization", "Bearer "+token)
	rutaRec := httptest.NewRecorder()
	router.ServeHTTP(rutaRec, rutaReq)
	require.Equal(t, http.StatusCreated, rutaRec.Code)
	var rutaResp map[string]any
	require.NoError(t, json.Unmarshal(rutaRec.Body.Bytes(), &rutaResp))
	rutaID := rutaResp["id"].(string)

	// 3. Asignar el envío a la ruta.
	asigBody, _ := json.Marshal(map[string]any{"envio_ids": []string{envioID}})
	asigReq := httptest.NewRequest(http.MethodPost, "/rutas/"+rutaID+"/envios", bytes.NewReader(asigBody))
	asigReq.Header.Set("Authorization", "Bearer "+token)
	asigRec := httptest.NewRecorder()
	router.ServeHTTP(asigRec, asigReq)
	require.Equal(t, http.StatusOK, asigRec.Code)

	// 4. Ver el detalle de la ruta: debe tener 1 envío y el peso total.
	detalleReq := httptest.NewRequest(http.MethodGet, "/rutas/"+rutaID, nil)
	detalleReq.Header.Set("Authorization", "Bearer "+token)
	detalleRec := httptest.NewRecorder()
	router.ServeHTTP(detalleRec, detalleReq)
	require.Equal(t, http.StatusOK, detalleRec.Code)
	var detalleResp map[string]any
	require.NoError(t, json.Unmarshal(detalleRec.Body.Bytes(), &detalleResp))
	require.Equal(t, float64(1), detalleResp["cantidad_envios"])
	require.Equal(t, float64(5), detalleResp["peso_total"])

	// 5. Desasignar el envío.
	desasigReq := httptest.NewRequest(http.MethodDelete, "/rutas/"+rutaID+"/envios/"+envioID, nil)
	desasigReq.Header.Set("Authorization", "Bearer "+token)
	desasigRec := httptest.NewRecorder()
	router.ServeHTTP(desasigRec, desasigReq)
	require.Equal(t, http.StatusOK, desasigRec.Code)

	// Limpieza.
	_, _ = pool.Exec(t.Context(), "DELETE FROM rutas WHERE id = $1", rutaID)
	var remitenteID, destinatarioID string
	_ = pool.QueryRow(t.Context(), "SELECT remitente_id, destinatario_id FROM envios WHERE id = $1", envioID).Scan(&remitenteID, &destinatarioID)
	_, _ = pool.Exec(t.Context(), "DELETE FROM envios WHERE id = $1", envioID)
	_, _ = pool.Exec(t.Context(), "DELETE FROM remitentes WHERE id = $1", remitenteID)
	_, _ = pool.Exec(t.Context(), "DELETE FROM destinatarios WHERE id = $1", destinatarioID)
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `go test ./... -p 1 -v`
Expected: PASS en todos los paquetes (incluye todos los tests de HU-01 y de este plan).

- [ ] **Paso 5: Probar manualmente con el servidor real**

Run: `go run ./cmd/api`

En otra terminal (con un token de operador ya obtenido vía `/auth/login`):

```bash
curl -X POST http://localhost:8080/envios -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"remitente":{"nombre":"Demo"},"destinatario":{"nombre":"Cliente Demo","calle":"Mitre","numero":"100","localidad":"San Francisco","codigo_postal":"X2400"},"paquete":{"peso":3,"tamano":"chico"}}'

curl http://localhost:8080/envios -H "Authorization: Bearer $TOKEN"
```

Expected: el primer `curl` devuelve 201 con un `codigo_guia` `MOV-...`; el segundo devuelve la lista incluyendo ese envío. Ctrl+C para detener el servidor.

- [ ] **Paso 6: Commit**

```bash
go vet ./...
gofmt -l .
git add internal/httprouter cmd/api tests
git commit -m "feat: montar rutas de HU-02, HU-03 y HU-04 y agregar smoke test end-to-end

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Cobertura del spec:** este plan cubre el resto de la sección 5 del spec (contrato de envíos, rutas y asignación) y las HU-02/03/04 completas del Sprint Backlog 1 (CA-01 a CA-06 de cada una). No cubre: HU-05 (repartidor, plan siguiente), la app web/móvil (planes siguientes), ni el despliegue (sección 8, plan siguiente).

**Placeholders:** ninguno — todos los pasos tienen código completo o comandos exactos.

**Consistencia de tipos:** verificado nombre por nombre — `domain.Envio`/`EnvioConDetalle`/`Ruta`/`RutaConConteo`, `repository.EnvioRepo`/`RutaRepo`/`Querier`/`CreateRemitente`/`CreateDestinatario`, `services.EnvioService`/`RutaService`/`AsignacionService`/`DetalleRuta`, `handlers.EnvioHandler`/`RutaHandler` se usan con la misma forma en todas las tareas que los consumen. El router y `main.go` del Task 9 reflejan exactamente las firmas producidas en los Tasks 5 y 8.
