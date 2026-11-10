package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/middleware"
	"movii/api/internal/repository"
)

const idInexistente = "00000000-0000-0000-0000-00000000dead"

func poolEliminarTest(t *testing.T) (*EliminarHandler, *pgxpool.Pool) {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	return NewEliminarHandler(pool), pool
}

func borrar(t *testing.T, fn http.HandlerFunc, id string) *httptest.ResponseRecorder {
	t.Helper()
	req := withURLParam(httptest.NewRequest(http.MethodDelete, "/x/"+id, nil), "id", id)
	rec := httptest.NewRecorder()
	fn(rec, req)
	return rec
}

func codigoDe(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var resp struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	return resp.Error.Code
}

// repartidorDePrueba crea un usuario repartidor propio del test (se borra al terminar).
func repartidorDePrueba(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	var id string
	email := "eliminar-test-" + time.Now().Format("150405.000000") + "@movii.test"
	require.NoError(t, pool.QueryRow(context.Background(),
		`INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ('Eliminar Test', $1, 'x', 'repartidor') RETURNING id::text`, email).Scan(&id))
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), "DELETE FROM usuarios WHERE id = $1", id) })
	return id
}

func vehiculoDePrueba(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	var id string
	patente := "ZZ" + time.Now().Format("0405.000")[:7]
	require.NoError(t, pool.QueryRow(context.Background(),
		`INSERT INTO vehiculos (patente, modelo) VALUES ($1, 'Test') RETURNING id::text`, patente).Scan(&id))
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "UPDATE rutas SET vehiculo_id = NULL WHERE vehiculo_id = $1", id)
		_, _ = pool.Exec(context.Background(), "DELETE FROM vehiculos WHERE id = $1", id)
	})
	return id
}

func TestEliminar_Ruta(t *testing.T) {
	h, pool := poolEliminarTest(t)
	ctx := context.Background()
	repID := repartidorDePrueba(t, pool)
	rutaRepo := repository.NewRutaRepo(pool)

	t.Run("inexistente da 404", func(t *testing.T) {
		rec := borrar(t, h.Ruta, idInexistente)
		require.Equal(t, http.StatusNotFound, rec.Code)
	})

	t.Run("planificada con envio asignado: se borra y el envio vuelve a pendiente", func(t *testing.T) {
		ruta, err := rutaRepo.Create(ctx, domain.Ruta{Nombre: "Eliminar OK", Zona: "Centro", RepartidorID: repID})
		require.NoError(t, err)
		t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })
		envioID := crearEnvioPendienteDeTest(t, pool)
		_, err = pool.Exec(ctx, "UPDATE envios SET ruta_id = $1, estado = 'asignado' WHERE id = $2", ruta.ID, envioID)
		require.NoError(t, err)

		rec := borrar(t, h.Ruta, ruta.ID)
		require.Equal(t, http.StatusNoContent, rec.Code)

		var estado string
		var rutaID *string
		require.NoError(t, pool.QueryRow(ctx, "SELECT estado::text, ruta_id::text FROM envios WHERE id = $1", envioID).Scan(&estado, &rutaID))
		require.Equal(t, "pendiente", estado)
		require.Nil(t, rutaID)
	})

	t.Run("en curso da 423", func(t *testing.T) {
		ruta, err := rutaRepo.Create(ctx, domain.Ruta{Nombre: "Eliminar EnCurso", Zona: "Centro", RepartidorID: repID})
		require.NoError(t, err)
		t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })
		_, err = pool.Exec(ctx, "UPDATE rutas SET estado = 'en_curso' WHERE id = $1", ruta.ID)
		require.NoError(t, err)

		rec := borrar(t, h.Ruta, ruta.ID)
		require.Equal(t, http.StatusLocked, rec.Code)
		require.Equal(t, "ruta_en_curso", codigoDe(t, rec))
	})

	t.Run("con envio en camino da 423 y no se borra", func(t *testing.T) {
		ruta, err := rutaRepo.Create(ctx, domain.Ruta{Nombre: "Eliminar ConEnvios", Zona: "Centro", RepartidorID: repID})
		require.NoError(t, err)
		envioID := crearEnvioPendienteDeTest(t, pool)
		_, err = pool.Exec(ctx, "UPDATE envios SET ruta_id = $1, estado = 'en_camino' WHERE id = $2", ruta.ID, envioID)
		require.NoError(t, err)
		t.Cleanup(func() {
			_, _ = pool.Exec(ctx, "UPDATE envios SET ruta_id = NULL, estado = 'pendiente' WHERE id = $1", envioID)
			_, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID)
		})

		rec := borrar(t, h.Ruta, ruta.ID)
		require.Equal(t, http.StatusLocked, rec.Code)
		require.Equal(t, "ruta_con_envios", codigoDe(t, rec))
		var existe bool
		require.NoError(t, pool.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM rutas WHERE id = $1)", ruta.ID).Scan(&existe))
		require.True(t, existe, "la ruta no debe borrarse")
	})
}

func TestEliminar_Envio(t *testing.T) {
	h, pool := poolEliminarTest(t)
	ctx := context.Background()

	t.Run("inexistente da 404", func(t *testing.T) {
		require.Equal(t, http.StatusNotFound, borrar(t, h.Envio, idInexistente).Code)
	})

	t.Run("pendiente sin ruta se borra", func(t *testing.T) {
		envioID := crearEnvioPendienteDeTest(t, pool)
		require.Equal(t, http.StatusNoContent, borrar(t, h.Envio, envioID).Code)
		var existe bool
		require.NoError(t, pool.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM envios WHERE id = $1)", envioID).Scan(&existe))
		require.False(t, existe)
	})

	t.Run("en camino da 423", func(t *testing.T) {
		envioID := crearEnvioPendienteDeTest(t, pool)
		_, err := pool.Exec(ctx, "UPDATE envios SET estado = 'en_camino' WHERE id = $1", envioID)
		require.NoError(t, err)
		rec := borrar(t, h.Envio, envioID)
		require.Equal(t, http.StatusLocked, rec.Code)
		require.Equal(t, "envio_no_eliminable", codigoDe(t, rec))
	})
}

func TestEliminar_Usuario(t *testing.T) {
	h, pool := poolEliminarTest(t)
	ctx := context.Background()

	t.Run("inexistente da 404", func(t *testing.T) {
		require.Equal(t, http.StatusNotFound, borrar(t, h.Usuario, idInexistente).Code)
	})

	t.Run("no puede borrarse a si mismo", func(t *testing.T) {
		id := repartidorDePrueba(t, pool)
		req := withURLParam(httptest.NewRequest(http.MethodDelete, "/users/"+id, nil), "id", id)
		req = req.WithContext(middleware.ContextWithClaims(req.Context(), middleware.Claims{UsuarioID: id, Rol: domain.RolAdmin}))
		rec := httptest.NewRecorder()
		h.Usuario(rec, req)
		require.Equal(t, http.StatusLocked, rec.Code)
		require.Equal(t, "auto_borrado", codigoDe(t, rec))
	})

	t.Run("repartidor sin rutas se borra", func(t *testing.T) {
		id := repartidorDePrueba(t, pool)
		require.Equal(t, http.StatusNoContent, borrar(t, h.Usuario, id).Code)
	})

	t.Run("repartidor con rutas da 423", func(t *testing.T) {
		id := repartidorDePrueba(t, pool)
		ruta, err := repository.NewRutaRepo(pool).Create(ctx, domain.Ruta{Nombre: "Eliminar Usuario", Zona: "Centro", RepartidorID: id})
		require.NoError(t, err)
		t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })
		rec := borrar(t, h.Usuario, id)
		require.Equal(t, http.StatusLocked, rec.Code)
		require.Equal(t, "usuario_con_registros", codigoDe(t, rec))
	})
}

func TestEliminar_Vehiculo(t *testing.T) {
	h, pool := poolEliminarTest(t)
	ctx := context.Background()

	t.Run("inexistente da 404", func(t *testing.T) {
		require.Equal(t, http.StatusNotFound, borrar(t, h.Vehiculo, idInexistente).Code)
	})

	t.Run("libre se borra", func(t *testing.T) {
		require.Equal(t, http.StatusNoContent, borrar(t, h.Vehiculo, vehiculoDePrueba(t, pool)).Code)
	})

	t.Run("con ruta planificada da 423", func(t *testing.T) {
		repID := repartidorDePrueba(t, pool)
		vehID := vehiculoDePrueba(t, pool)
		ruta, err := repository.NewRutaRepo(pool).Create(ctx, domain.Ruta{Nombre: "Eliminar Vehiculo", Zona: "Centro", RepartidorID: repID})
		require.NoError(t, err)
		t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })
		_, err = pool.Exec(ctx, "UPDATE rutas SET vehiculo_id = $1 WHERE id = $2", vehID, ruta.ID)
		require.NoError(t, err)
		rec := borrar(t, h.Vehiculo, vehID)
		require.Equal(t, http.StatusLocked, rec.Code)
		require.Equal(t, "vehiculo_en_uso", codigoDe(t, rec))
	})
}
