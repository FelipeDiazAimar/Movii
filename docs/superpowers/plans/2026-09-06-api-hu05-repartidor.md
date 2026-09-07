# API — HU-05 (Listado del repartidor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer `GET /repartidor/envios-del-dia`: el repartidor logueado ve únicamente los envíos de sus rutas de hoy, agrupados por ruta, con un resumen de contadores por estado.

**Architecture:** Mismas capas que HU-01 a HU-04: `handlers → services → repository`. El repartidor se identifica por el JWT (no por un parámetro de URL), usando `middleware.ClaimsFromContext`. La fecha "hoy" se calcula en UTC, siguiendo la convención ya fijada en `AsignacionService` para evitar el bug de huso horario ya corregido en el plan anterior.

**Tech Stack:** El mismo de los planes anteriores — Go 1.27, chi v5, pgx v5, testify. Sin dependencias nuevas.

**Spec:** [docs/superpowers/specs/2026-09-05-sprint1-movii-design.md](../specs/2026-09-05-sprint1-movii-design.md)

## Global Constraints

- Módulo Go: `movii/api`.
- Todas las respuestas HTTP son JSON. Error: `{"error":{"code":"...","message":"..."}}`.
- `GET /repartidor/envios-del-dia` solo accesible con rol `repartidor`.
- El repartidor solo ve envíos de SUS rutas (repartidor_id = el id del JWT), nunca los de otro repartidor.
- "Hoy" se calcula en UTC (mismo criterio que la corrección de zona horaria del plan de HU-02/03/04).
- Base de datos: PostgreSQL en Supabase vía `DATABASE_URL` en `.env` (ya existe) — nunca imprimir su valor.
- Commits en español, cierran con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- `gofmt` y `go vet` limpios antes de cada commit.

---

## Task 1: Dominio — EnvioDelDia y ResumenDelDia

**Files:**
- Create: `gestion-envios/services/api/internal/domain/repartidor.go`

**Interfaces:**
- Consumes: `domain.Envio`, `domain.Destinatario` (ya existen).
- Produces:
  ```go
  type EnvioDelDia struct {
      Envio
      Destinatario Destinatario
      RutaNombre   string
  }

  type RutaConEnviosDelDia struct {
      RutaID     string
      RutaNombre string
      Envios     []EnvioDelDia
  }

  type ResumenDelDia struct {
      Fecha        string
      Rutas        []RutaConEnviosDelDia
      Total        int
      Pendientes   int
      Asignados    int
      EnCamino     int
      Entregados   int
      NoEntregados int
  }
  ```

- [ ] **Paso 1: Crear `domain/repartidor.go`**

```go
package domain

// EnvioDelDia es un envío en el contexto del listado del repartidor: incluye
// los datos del destinatario y el nombre de la ruta a la que pertenece.
type EnvioDelDia struct {
	Envio
	Destinatario Destinatario `json:"destinatario"`
	RutaNombre   string       `json:"ruta_nombre"`
}

// RutaConEnviosDelDia agrupa los envíos del día de un repartidor por ruta
// (HU-05, CA-03).
type RutaConEnviosDelDia struct {
	RutaID     string        `json:"ruta_id"`
	RutaNombre string        `json:"ruta_nombre"`
	Envios     []EnvioDelDia `json:"envios"`
}

// ResumenDelDia es la respuesta completa de HU-05: los envíos del repartidor
// agrupados por ruta más los contadores por estado (CA-05).
type ResumenDelDia struct {
	Fecha        string                 `json:"fecha"`
	Rutas        []RutaConEnviosDelDia  `json:"rutas"`
	Total        int                    `json:"total"`
	Pendientes   int                    `json:"pendientes"`
	Asignados    int                    `json:"asignados"`
	EnCamino     int                    `json:"en_camino"`
	Entregados   int                    `json:"entregados"`
	NoEntregados int                    `json:"no_entregados"`
}
```

- [ ] **Paso 2: Compilar**

Run: `go build ./...` (desde `gestion-envios/services/api`)
Expected: sin errores.

- [ ] **Paso 3: Commit**

```bash
cd "gestion-envios/services/api"
gofmt -l .
git add internal/domain/repartidor.go
git commit -m "feat: agregar dominio EnvioDelDia y ResumenDelDia (HU-05)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: EnvioRepo.ListDelDiaPorRepartidor

**Files:**
- Modify: `gestion-envios/services/api/internal/repository/envio_repo.go`
- Create: `gestion-envios/services/api/internal/repository/envio_repo_dia_test.go`

**Interfaces:**
- Consumes: `domain.EnvioDelDia` (Task 1).
- Produces:
  ```go
  func (r *EnvioRepo) ListDelDiaPorRepartidor(ctx context.Context, repartidorID, fecha, estado string) ([]domain.EnvioDelDia, error)
  ```
  `fecha` en formato `"YYYY-MM-DD"`. `estado` vacío ("") no filtra. Devuelve ordenado por nombre de ruta y luego por fecha de creación del envío.

- [ ] **Paso 1: Escribir el test (falla)**

`internal/repository/envio_repo_dia_test.go`:

```go
package repository

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

func TestEnvioRepo_ListDelDiaPorRepartidor(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()

	var repartidorID string
	err := pool.QueryRow(ctx, "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID)
	require.NoError(t, err)

	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	var rutaID string
	err = pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id) VALUES ('Ruta Dia Test', 'Zona Test', CURRENT_DATE, $1)
		RETURNING id
	`, repartidorID).Scan(&rutaID)
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", rutaID) })

	envio, err := repo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9101", Peso: 2, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID) })
	require.NoError(t, repo.AsignarEnvios(ctx, []string{envio.ID}, rutaID))

	hoy := currentDateUTC()
	lista, err := repo.ListDelDiaPorRepartidor(ctx, repartidorID, hoy, "")
	require.NoError(t, err)

	var encontrado bool
	for _, e := range lista {
		if e.ID == envio.ID {
			encontrado = true
			require.Equal(t, "Ruta Dia Test", e.RutaNombre)
			require.Equal(t, "Dest Test", e.Destinatario.Nombre)
		}
	}
	require.True(t, encontrado, "el envío asignado debería aparecer en el listado del día del repartidor")

	// Filtrado por estado que no matchea: no debería aparecer.
	listaFiltrada, err := repo.ListDelDiaPorRepartidor(ctx, repartidorID, hoy, domain.EstadoEnvioEntregado)
	require.NoError(t, err)
	for _, e := range listaFiltrada {
		require.NotEqual(t, envio.ID, e.ID)
	}
}
```

Nota: `currentDateUTC()` todavía no existe — se define en el Paso 3 como helper del paquete `repository` (usado también por el test). `crearRemitenteYDestinatarioDeTest` y `nuevoPoolDeTestEnvio` ya existen en `envio_repo_test.go` del plan anterior.

- [ ] **Paso 2: Correr el test y verificar que falla**

Con `DATABASE_URL` exportada: `export $(grep -v '^#' .env | xargs)`

Run: `go test ./internal/repository/... -run TestEnvioRepo_ListDelDiaPorRepartidor -v`
Expected: FAIL (`ListDelDiaPorRepartidor` y `currentDateUTC` no existen).

- [ ] **Paso 3: Implementar el método**

Agregar a `internal/repository/envio_repo.go` (al final del archivo):

```go
// currentDateUTC devuelve la fecha de hoy en UTC, formato "YYYY-MM-DD". Se
// usa en vez de time.Now().Format en horario local para no repetir el bug
// de huso horario ya corregido en AsignacionService (una fecha calculada en
// el huso local de la máquina puede diferir de la fecha real en UTC cerca
// de la medianoche).
func currentDateUTC() string {
	return time.Now().UTC().Format("2006-01-02")
}

// ListDelDiaPorRepartidor devuelve los envíos de las rutas de repartidorID
// con fecha == fecha, agrupables por ruta (incluye el nombre de la ruta).
// estado vacío ("") no filtra por estado.
func (r *EnvioRepo) ListDelDiaPorRepartidor(ctx context.Context, repartidorID, fecha, estado string) ([]domain.EnvioDelDia, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT e.id, e.codigo_guia, e.estado, e.peso, e.tamano, e.tipo_contenido, e.fragil, e.urgente,
		       e.remitente_id, e.destinatario_id, e.ruta_id,
		       d.id, d.nombre, d.telefono, d.calle, d.numero, COALESCE(d.piso_depto, ''), d.localidad, d.codigo_postal,
		       r.id, r.nombre
		FROM envios e
		JOIN rutas r ON r.id = e.ruta_id
		JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE r.repartidor_id = $1 AND r.fecha = $2::date
		  AND ($3 = '' OR e.estado::text = $3)
		ORDER BY r.nombre, e.created_at
	`, repartidorID, fecha, estado)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lista []domain.EnvioDelDia
	for rows.Next() {
		var e domain.EnvioDelDia
		var rutaID sql.NullString
		if err := rows.Scan(&e.ID, &e.CodigoGuia, &e.Estado, &e.Peso, &e.Tamano, &e.TipoContenido, &e.Fragil, &e.Urgente,
			&e.RemitenteID, &e.DestinatarioID, &rutaID,
			&e.Destinatario.ID, &e.Destinatario.Nombre, &e.Destinatario.Telefono, &e.Destinatario.Calle,
			&e.Destinatario.Numero, &e.Destinatario.PisoDepto, &e.Destinatario.Localidad, &e.Destinatario.CodigoPostal,
			&e.Envio.RutaID, &e.RutaNombre,
		); err != nil {
			return nil, err
		}
		if rutaID.Valid {
			e.Envio.RutaID = &rutaID.String
		}
		lista = append(lista, e)
	}
	return lista, rows.Err()
}
```

**Atención:** `e.Envio.RutaID` es `*string` pero la columna 11 (`e.ruta_id`) se escanea dos veces por error en el borrador de arriba (una vez en el bloque `Scan` como `&rutaID` sql.NullString, y de nuevo mencionado como `&e.Envio.RutaID` en el mismo `Scan`, que en realidad corresponde a `r.id` — la columna 20). Al escribir el código real, revisar con cuidado el orden: la lista de columnas del `SELECT` es (1) e.id, (2) e.codigo_guia, (3) e.estado, (4) e.peso, (5) e.tamano, (6) e.tipo_contenido, (7) e.fragil, (8) e.urgente, (9) e.remitente_id, (10) e.destinatario_id, (11) e.ruta_id, (12) d.id, (13) d.nombre, (14) d.telefono, (15) d.calle, (16) d.numero, (17) d.piso_depto, (18) d.localidad, (19) d.codigo_postal, (20) r.id, (21) r.nombre. El `Scan` debe tener exactamente 21 destinos en ese orden: los primeros 10 campos de `Envio`, luego `&rutaID` (columna 11), luego los 8 campos de `Destinatario` (columnas 12-19), y **no** un campo para `r.id` (columna 20) salvo que se descarte con una variable — usar `var rutaIDDeLaRuta string` para la columna 20 (no se usa, pero hay que escanearla) y `&e.RutaNombre` para la columna 21. Escribir el `Scan` con los 21 argumentos exactos, en ese orden, antes de correr el test.

- [ ] **Paso 4: Agregar el import de `time` si no está**

`internal/repository/envio_repo.go` ya importa `"database/sql"`, `"errors"`, pgx, etc. — agregar `"time"` al bloque de imports si el Paso 3 lo necesita y no está.

- [ ] **Paso 5: Correr el test y verificar que pasa**

Run: `go test ./internal/repository/... -run TestEnvioRepo_ListDelDiaPorRepartidor -v`
Expected: PASS (1 test, con 2 sub-verificaciones: aparece sin filtro, no aparece con filtro que no matchea).

- [ ] **Paso 6: Commit**

```bash
go vet ./...
gofmt -l .
git add internal/repository/envio_repo.go internal/repository/envio_repo_dia_test.go
git commit -m "feat: agregar EnvioRepo.ListDelDiaPorRepartidor (HU-05)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: RepartidorService (agrupación por ruta + resumen)

**Files:**
- Create: `gestion-envios/services/api/internal/services/repartidor_service.go`
- Create: `gestion-envios/services/api/internal/services/repartidor_service_test.go`

**Interfaces:**
- Consumes: `domain.EnvioDelDia`, `domain.RutaConEnviosDelDia`, `domain.ResumenDelDia` (Task 1); `repository.EnvioRepo.ListDelDiaPorRepartidor` (Task 2).
- Produces:
  ```go
  type RepartidorService struct{ /* envioRepo *repository.EnvioRepo */ }
  func NewRepartidorService(envioRepo *repository.EnvioRepo) *RepartidorService
  func (s *RepartidorService) EnviosDelDia(ctx context.Context, repartidorID, estado string) (domain.ResumenDelDia, error)

  // agruparPorRuta y calcularResumen son funciones puras (testeables sin DB).
  func agruparPorRuta(envios []domain.EnvioDelDia) []domain.RutaConEnviosDelDia
  func calcularContadores(envios []domain.EnvioDelDia) (total, pendientes, asignados, enCamino, entregados, noEntregados int)
  ```

- [ ] **Paso 1: Escribir el test de las funciones puras (falla)**

`internal/services/repartidor_service_test.go`:

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

func TestAgruparPorRuta_AgrupaEnOrdenDeAparicion(t *testing.T) {
	envios := []domain.EnvioDelDia{
		{Envio: domain.Envio{ID: "e1"}, RutaNombre: "Ruta A"},
		{Envio: domain.Envio{ID: "e2"}, RutaNombre: "Ruta B"},
		{Envio: domain.Envio{ID: "e3"}, RutaNombre: "Ruta A"},
	}

	grupos := agruparPorRuta(envios)

	require.Len(t, grupos, 2)
	require.Equal(t, "Ruta A", grupos[0].RutaNombre)
	require.Len(t, grupos[0].Envios, 2)
	require.Equal(t, "Ruta B", grupos[1].RutaNombre)
	require.Len(t, grupos[1].Envios, 1)
}

func TestCalcularContadores(t *testing.T) {
	envios := []domain.EnvioDelDia{
		{Envio: domain.Envio{Estado: domain.EstadoEnvioPendiente}},
		{Envio: domain.Envio{Estado: domain.EstadoEnvioAsignado}},
		{Envio: domain.Envio{Estado: domain.EstadoEnvioAsignado}},
		{Envio: domain.Envio{Estado: domain.EstadoEnvioEnCamino}},
		{Envio: domain.Envio{Estado: domain.EstadoEnvioEntregado}},
		{Envio: domain.Envio{Estado: domain.EstadoEnvioNoEntregado}},
	}

	total, pendientes, asignados, enCamino, entregados, noEntregados := calcularContadores(envios)

	require.Equal(t, 6, total)
	require.Equal(t, 1, pendientes)
	require.Equal(t, 2, asignados)
	require.Equal(t, 1, enCamino)
	require.Equal(t, 1, entregados)
	require.Equal(t, 1, noEntregados)
}

func nuevoRepartidorServiceDeTest(t *testing.T) (*RepartidorService, *pgxpool.Pool, string) {
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

	return NewRepartidorService(repository.NewEnvioRepo(pool)), pool, repartidorID
}

func TestRepartidorService_EnviosDelDia(t *testing.T) {
	svc, pool, repartidorID := nuevoRepartidorServiceDeTest(t)
	ctx := context.Background()

	rem, err := repository.CreateRemitente(ctx, pool, domain.Remitente{Nombre: "Rem"})
	require.NoError(t, err)
	dest, err := repository.CreateDestinatario(ctx, pool, domain.Destinatario{
		Nombre: "Dest", Calle: "Calle", Numero: "1", Localidad: "San Francisco", CodigoPostal: "X2400",
	})
	require.NoError(t, err)
	envioRepo := repository.NewEnvioRepo(pool)
	envio, err := envioRepo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9102", Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: rem.ID, DestinatarioID: dest.ID,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", rem.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", dest.ID)
	})

	var rutaID string
	err = pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id) VALUES ('Ruta Service Dia', 'Zona', CURRENT_DATE, $1)
		RETURNING id
	`, repartidorID).Scan(&rutaID)
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", rutaID) })
	require.NoError(t, envioRepo.AsignarEnvios(ctx, []string{envio.ID}, rutaID))

	resumen, err := svc.EnviosDelDia(ctx, repartidorID, "")
	require.NoError(t, err)
	require.GreaterOrEqual(t, resumen.Total, 1)
	require.GreaterOrEqual(t, resumen.Asignados, 1)

	var encontrado bool
	for _, grupo := range resumen.Rutas {
		if grupo.RutaID == rutaID {
			encontrado = true
			require.Equal(t, "Ruta Service Dia", grupo.RutaNombre)
		}
	}
	require.True(t, encontrado)
}
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `go test ./internal/services/... -run "TestAgruparPorRuta|TestCalcularContadores|TestRepartidorService" -v`
Expected: FAIL (nada de esto existe todavía).

- [ ] **Paso 3: Implementar `repartidor_service.go`**

```go
package services

import (
	"context"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

// RepartidorService contiene la lógica de negocio de HU-05.
type RepartidorService struct {
	envioRepo *repository.EnvioRepo
}

// NewRepartidorService crea un RepartidorService.
func NewRepartidorService(envioRepo *repository.EnvioRepo) *RepartidorService {
	return &RepartidorService{envioRepo: envioRepo}
}

// EnviosDelDia devuelve los envíos de hoy del repartidor dado, agrupados por
// ruta, con el resumen de contadores por estado.
func (s *RepartidorService) EnviosDelDia(ctx context.Context, repartidorID, estado string) (domain.ResumenDelDia, error) {
	hoy := currentDateUTC()

	envios, err := s.envioRepo.ListDelDiaPorRepartidor(ctx, repartidorID, hoy, estado)
	if err != nil {
		return domain.ResumenDelDia{}, err
	}

	total, pendientes, asignados, enCamino, entregados, noEntregados := calcularContadores(envios)

	return domain.ResumenDelDia{
		Fecha:        hoy,
		Rutas:        agruparPorRuta(envios),
		Total:        total,
		Pendientes:   pendientes,
		Asignados:    asignados,
		EnCamino:     enCamino,
		Entregados:   entregados,
		NoEntregados: noEntregados,
	}, nil
}

// agruparPorRuta agrupa los envíos por ruta, preservando el orden de
// aparición de cada ruta en la lista de entrada.
func agruparPorRuta(envios []domain.EnvioDelDia) []domain.RutaConEnviosDelDia {
	var grupos []domain.RutaConEnviosDelDia
	indicePorRuta := make(map[string]int)

	for _, e := range envios {
		rutaID := ""
		if e.Envio.RutaID != nil {
			rutaID = *e.Envio.RutaID
		}
		idx, existe := indicePorRuta[rutaID]
		if !existe {
			grupos = append(grupos, domain.RutaConEnviosDelDia{RutaID: rutaID, RutaNombre: e.RutaNombre})
			idx = len(grupos) - 1
			indicePorRuta[rutaID] = idx
		}
		grupos[idx].Envios = append(grupos[idx].Envios, e)
	}
	return grupos
}

// calcularContadores cuenta los envíos por estado para el resumen del día.
func calcularContadores(envios []domain.EnvioDelDia) (total, pendientes, asignados, enCamino, entregados, noEntregados int) {
	for _, e := range envios {
		total++
		switch e.Estado {
		case domain.EstadoEnvioPendiente:
			pendientes++
		case domain.EstadoEnvioAsignado:
			asignados++
		case domain.EstadoEnvioEnCamino:
			enCamino++
		case domain.EstadoEnvioEntregado:
			entregados++
		case domain.EstadoEnvioNoEntregado:
			noEntregados++
		}
	}
	return
}
```

Nota: `currentDateUTC()` ya está definida en el paquete `repository` (Task 2), no en `services`. `RepartidorService.EnviosDelDia` no puede llamarla directamente (paquetes distintos). Definir una copia idéntica de `currentDateUTC` como función no exportada en `internal/services/repartidor_service.go` (mismo cuerpo, un `import "time"` en este archivo) — es una función de una línea; duplicarla entre paquetes es más simple que exportarla desde `repository` solo para esto.

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `go test ./internal/services/... -run "TestAgruparPorRuta|TestCalcularContadores|TestRepartidorService" -v`
Expected: PASS (3 tests).

- [ ] **Paso 5: Commit**

```bash
go vet ./...
gofmt -l .
git add internal/services/repartidor_service.go internal/services/repartidor_service_test.go
git commit -m "feat: agregar RepartidorService con agrupacion por ruta y resumen (HU-05)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Handler — GET /repartidor/envios-del-dia

**Files:**
- Create: `gestion-envios/services/api/internal/handlers/repartidor_handler.go`
- Create: `gestion-envios/services/api/internal/handlers/repartidor_handler_test.go`

**Interfaces:**
- Consumes: `services.RepartidorService` (Task 3); `middleware.ClaimsFromContext` (ya existe, de HU-01).
- Produces:
  ```go
  type RepartidorHandler struct{ /* svc *services.RepartidorService */ }
  func NewRepartidorHandler(svc *services.RepartidorService) *RepartidorHandler
  func (h *RepartidorHandler) EnviosDelDia(w http.ResponseWriter, r *http.Request)
  ```
  Usa `middleware.ClaimsFromContext(r.Context())` para obtener el `UsuarioID` del repartidor logueado — **no** viene de la URL ni del body, así un repartidor nunca puede pedir los envíos de otro.

- [ ] **Paso 1: Escribir el test (falla)**

`internal/handlers/repartidor_handler_test.go`:

```go
package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/middleware"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

func nuevoRepartidorHandlerDeTest(t *testing.T) (*RepartidorHandler, *pgxpool.Pool, string) {
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

	envioRepo := repository.NewEnvioRepo(pool)
	h := NewRepartidorHandler(services.NewRepartidorService(envioRepo))
	return h, pool, repartidorID
}

// conClaimsDeRepartidor simula lo que RequireAuth deja en el contexto:
// el UsuarioID del token, sin pasar por un JWT real.
func conClaimsDeRepartidor(req *http.Request, usuarioID string) *http.Request {
	ctx := context.WithValue(req.Context(), claimsContextKeyParaTests, middleware.Claims{UsuarioID: usuarioID, Rol: "repartidor"})
	return req.WithContext(ctx)
}

func TestRepartidorHandler_EnviosDelDiaDevuelve200(t *testing.T) {
	h, _, repartidorID := nuevoRepartidorHandlerDeTest(t)

	req := httptest.NewRequest(http.MethodGet, "/repartidor/envios-del-dia", nil)
	req = conClaimsDeRepartidor(req, repartidorID)
	rec := httptest.NewRecorder()

	h.EnviosDelDia(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Contains(t, resp, "rutas")
	require.Contains(t, resp, "total")
}
```

**Problema a resolver antes de implementar:** `middleware.ClaimsFromContext` lee las Claims desde una `contextKey` **no exportada** del paquete `middleware` (`claimsKey`), seteada únicamente por `middleware.RequireAuth`. Un test de handler no puede fabricar ese contexto desde otro paquete sin pasar por un JWT real. En vez de inventar un helper que no puede compilar (`claimsContextKeyParaTests` no existe y no puede crearse desde `handlers`), este test debe generar un JWT real de la misma forma que `auth_handler_test.go`/`users_handler_test.go` no lo necesitan — usar en cambio el patrón de HU-01: envolver el handler con `middleware.RequireAuth` en el propio test, igual que hace `tests/auth_flow_test.go`, o exponer una función `middleware.WithClaims(ctx, claims) context.Context` de test-helper. La opción más simple y consistente con el resto del código: agregar una función exportada `middleware.ContextWithClaims(ctx context.Context, c Claims) context.Context` al paquete `middleware` (mismo archivo `auth.go`), pensada explícitamente para tests y para cualquier código que necesite inyectar claims sin pasar por HTTP. Reemplazar `conClaimsDeRepartidor` así:

```go
func conClaimsDeRepartidor(req *http.Request, usuarioID string) *http.Request {
	return req.WithContext(middleware.ContextWithClaims(req.Context(), middleware.Claims{UsuarioID: usuarioID, Rol: "repartidor"}))
}
```

Y agregar a `internal/middleware/auth.go`:

```go
// ContextWithClaims agrega Claims al contexto manualmente. Pensada para
// tests y para cualquier código que necesite construir un contexto con
// claims sin pasar por RequireAuth/un JWT real.
func ContextWithClaims(ctx context.Context, c Claims) context.Context {
	return context.WithValue(ctx, claimsKey, c)
}
```

- [ ] **Paso 2: Correr el test y verificar que falla**

Run: `go test ./internal/handlers/... -run TestRepartidorHandler -v`
Expected: FAIL (`RepartidorHandler`, `middleware.ContextWithClaims` no existen).

- [ ] **Paso 3: Implementar `ContextWithClaims` y `RepartidorHandler`**

Agregar la función `ContextWithClaims` de arriba a `internal/middleware/auth.go`.

`internal/handlers/repartidor_handler.go`:

```go
package handlers

import (
	"net/http"

	httpx "movii/api/internal/platform/http"
	"movii/api/internal/middleware"
	"movii/api/internal/services"
)

// RepartidorHandler expone HU-05: el listado de envíos del día del
// repartidor logueado.
type RepartidorHandler struct {
	svc *services.RepartidorService
}

// NewRepartidorHandler crea un RepartidorHandler.
func NewRepartidorHandler(svc *services.RepartidorService) *RepartidorHandler {
	return &RepartidorHandler{svc: svc}
}

// EnviosDelDia maneja GET /repartidor/envios-del-dia?estado=. El repartidor
// se identifica por el JWT (RequireAuth ya dejó las Claims en el contexto),
// nunca por un parámetro que el cliente pudiera manipular.
func (h *RepartidorHandler) EnviosDelDia(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "sin_token", "falta autenticación")
		return
	}

	estado := r.URL.Query().Get("estado")

	resumen, err := h.svc.EnviosDelDia(r.Context(), claims.UsuarioID, estado)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener el listado del día")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resumen)
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `go test ./internal/handlers/... -run TestRepartidorHandler -v`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
go vet ./...
gofmt -l .
git add internal/middleware/auth.go internal/handlers/repartidor_handler.go internal/handlers/repartidor_handler_test.go
git commit -m "feat: agregar handler GET /repartidor/envios-del-dia (HU-05)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Montaje final + smoke test end-to-end de HU-05

**Files:**
- Modify: `gestion-envios/services/api/internal/httprouter/router.go`
- Modify: `gestion-envios/services/api/cmd/api/main.go`
- Create: `gestion-envios/services/api/tests/repartidor_flow_test.go`

**Interfaces:**
- Consumes: `handlers.RepartidorHandler` (Task 4).
- Produces: `httprouter.Deps.RepartidorHandler`, ruta `GET /repartidor/envios-del-dia` montada dentro del grupo protegido, restringida a `domain.RolRepartidor`.

- [ ] **Paso 1: Ampliar `Deps` y montar la ruta**

En `internal/httprouter/router.go`, agregar el campo `RepartidorHandler *handlers.RepartidorHandler` al struct `Deps`, y dentro de `r.Group(func(protected chi.Router) {...})` (después del grupo `operativo` existente) agregar:

```go
		protected.Group(func(repartidorOnly chi.Router) {
			repartidorOnly.Use(middleware.RequireRole(domain.RolRepartidor))
			repartidorOnly.Get("/repartidor/envios-del-dia", deps.RepartidorHandler.EnviosDelDia)
		})
```

- [ ] **Paso 2: Conectar en `main.go`**

En `cmd/api/main.go`, agregar:

```go
	repartidorService := services.NewRepartidorService(envioRepo)
```

(después de `asignacionService := ...`), y agregar `RepartidorHandler: handlers.NewRepartidorHandler(repartidorService),` al literal `httprouter.Deps{...}`.

- [ ] **Paso 3: Escribir el smoke test end-to-end (falla si el cableado está mal)**

`tests/repartidor_flow_test.go`:

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

	"movii/api/internal/handlers"
	"movii/api/internal/httprouter"
	"movii/api/internal/platform/db"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

func TestFlujoCompleto_EnviosDelDiaDelRepartidor(t *testing.T) {
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
		CORSOrigins:       []string{"*"},
		JWTSecret:         "secreto-de-test",
		AuthHandler:       handlers.NewAuthHandler(authService),
		UsuariosHandler:   handlers.NewUsuariosHandler(usuarioRepo),
		EnvioHandler:      handlers.NewEnvioHandler(services.NewEnvioService(pool, envioRepo)),
		RutaHandler:       handlers.NewRutaHandler(services.NewRutaService(rutaRepo), services.NewAsignacionService(rutaRepo, envioRepo)),
		RepartidorHandler: handlers.NewRepartidorHandler(services.NewRepartidorService(envioRepo)),
	})

	// 0. Login como repartidor de la demo.
	loginBody, _ := json.Marshal(map[string]string{"email": "repartidor@movii.demo", "password": "Movii2026!"})
	loginReq := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(loginBody))
	loginRec := httptest.NewRecorder()
	router.ServeHTTP(loginRec, loginReq)
	require.Equal(t, http.StatusOK, loginRec.Code)
	var loginResp map[string]string
	require.NoError(t, json.Unmarshal(loginRec.Body.Bytes(), &loginResp))
	token := loginResp["token"]

	// 1. Pedir el listado del día como repartidor: debe dar 200.
	req := httptest.NewRequest(http.MethodGet, "/repartidor/envios-del-dia", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Contains(t, resp, "rutas")

	// 2. Un operador (rol distinto) NO puede acceder a este endpoint: 403.
	loginOpBody, _ := json.Marshal(map[string]string{"email": "operador@movii.demo", "password": "Movii2026!"})
	loginOpReq := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(loginOpBody))
	loginOpRec := httptest.NewRecorder()
	router.ServeHTTP(loginOpRec, loginOpReq)
	require.Equal(t, http.StatusOK, loginOpRec.Code)
	var loginOpResp map[string]string
	require.NoError(t, json.Unmarshal(loginOpRec.Body.Bytes(), &loginOpResp))
	tokenOperador := loginOpResp["token"]

	reqOperador := httptest.NewRequest(http.MethodGet, "/repartidor/envios-del-dia", nil)
	reqOperador.Header.Set("Authorization", "Bearer "+tokenOperador)
	recOperador := httptest.NewRecorder()
	router.ServeHTTP(recOperador, reqOperador)
	require.Equal(t, http.StatusForbidden, recOperador.Code)
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

Run: `go test ./... -p 1 -count=1`
Expected: todos los paquetes en verde, sin correr en paralelo con ninguna otra invocación de `go test` contra la misma base (ver la lección del plan anterior sobre carreras entre procesos).

- [ ] **Paso 5: Probar manualmente con el servidor real**

Run: `go run ./cmd/api`

```bash
curl http://localhost:8080/repartidor/envios-del-dia -H "Authorization: Bearer $TOKEN_REPARTIDOR"
```

Expected: 200 con `{"fecha":...,"rutas":[...],"total":...,...}`.

- [ ] **Paso 6: Commit**

```bash
go vet ./...
gofmt -l .
git add internal/httprouter/router.go cmd/api/main.go tests/repartidor_flow_test.go
git commit -m "feat: montar GET /repartidor/envios-del-dia y agregar smoke test (HU-05)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Cobertura del spec:** completa el contrato de la sección 5 del spec para las 5 HU del Sprint 1 (el último endpoint pendiente, `GET /repartidor/envios-del-dia`). Con esto, la API cubre HU-01 a HU-05 por completo. Quedan para planes siguientes: la app web (HU-01 a HU-04) y la app móvil (HU-05), y el despliegue.

**Placeholders:** ninguno en los pasos finales de código — el Paso 3 de la Task 2 incluye una nota de atención explícita sobre el orden de columnas del `Scan` porque es el punto más propenso a error de todo el plan (21 columnas); no es un placeholder, es una advertencia con la lista exacta de columnas a seguir.

**Consistencia de tipos:** `domain.EnvioDelDia`/`RutaConEnviosDelDia`/`ResumenDelDia` (Task 1) se usan igual en `repository.EnvioRepo.ListDelDiaPorRepartidor` (Task 2), `services.RepartidorService` (Task 3) y `handlers.RepartidorHandler` (Task 4). `middleware.ContextWithClaims` (nueva, Task 4) es simétrica con `middleware.ClaimsFromContext` ya existente.
