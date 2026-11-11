package repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

const uuidInexistente = "00000000-0000-0000-0000-00000000beef"

// envioDeTestRepo crea un envío pendiente propio (con sus contactos) y lo borra al terminar.
func envioDeTestRepo(t *testing.T, pool *pgxpool.Pool) (envioID, destinatarioID string) {
	t.Helper()
	ctx := context.Background()
	remID, destID := crearRemitenteYDestinatarioDeTest(t, pool)
	envio, err := NewEnvioRepo(pool).Create(ctx, pool, domain.Envio{
		CodigoGuia: "R" + time.Now().Format("150405.000000"), Peso: 2, Tamano: domain.TamanoChico,
		RemitenteID: remID, DestinatarioID: destID,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM notificaciones_whatsapp WHERE envio_id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID)
	})
	return envio.ID, destID
}

func repartidorDemoID(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	var id string
	require.NoError(t, pool.QueryRow(context.Background(),
		"SELECT id::text FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&id))
	return id
}

// ---------- GeoRepo ----------

func TestGeoRepo_DireccionYDestinatarioDeEnvio(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewGeoRepo(pool)
	ctx := context.Background()
	envioID, destID := envioDeTestRepo(t, pool)

	d, err := repo.Direccion(ctx, destID)
	require.NoError(t, err)
	require.Equal(t, "Calle 2", d.Calle)
	require.Equal(t, "100", d.Numero)
	require.Equal(t, "San Francisco", d.Localidad)

	got, err := repo.DestinatarioDeEnvio(ctx, envioID)
	require.NoError(t, err)
	require.Equal(t, destID, got)

	_, err = repo.Direccion(ctx, uuidInexistente)
	require.True(t, errors.Is(err, ErrNoEncontrado))
	_, err = repo.DestinatarioDeEnvio(ctx, uuidInexistente)
	require.True(t, errors.Is(err, ErrNoEncontrado))
}

func TestGeoRepo_GuardarCoordenadasYBackfill(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewGeoRepo(pool)
	ctx := context.Background()
	_, destID := envioDeTestRepo(t, pool)

	estaEn := func(lista []DireccionDestinatario) bool {
		for _, d := range lista {
			if d.ID == destID {
				return true
			}
		}
		return false
	}

	// Recién creado: sin coordenadas, entra en el backfill.
	pendientes, err := repo.SinGeocodificar(ctx, 500)
	require.NoError(t, err)
	require.True(t, estaEn(pendientes), "un destinatario sin coordenadas debe estar en el backfill")

	// Geocodificado con una fuente real: sale del backfill y quedan guardadas las coordenadas.
	require.NoError(t, repo.GuardarCoordenadas(ctx, destID, -31.43, -62.08, "nominatim"))
	var lat, lng float64
	var fuente string
	require.NoError(t, pool.QueryRow(ctx, "SELECT latitud::float8, longitud::float8, geo_fuente FROM destinatarios WHERE id = $1", destID).Scan(&lat, &lng, &fuente))
	require.InDelta(t, -31.43, lat, 0.0001)
	require.InDelta(t, -62.08, lng, 0.0001)
	require.Equal(t, "nominatim", fuente)
	pendientes, err = repo.SinGeocodificar(ctx, 500)
	require.NoError(t, err)
	require.False(t, estaEn(pendientes))

	// Una ubicación aproximada vuelve a entrar para reintentar.
	require.NoError(t, repo.GuardarCoordenadas(ctx, destID, -31.43, -62.08, "aproximada"))
	pendientes, err = repo.SinGeocodificar(ctx, 500)
	require.NoError(t, err)
	require.True(t, estaEn(pendientes))
}

// ---------- PerfilRepo ----------

func TestEnmascararTelefono(t *testing.T) {
	require.Equal(t, "••••45", enmascararTelefono("+54 9 3564 123445"))
	require.Equal(t, "••••99", enmascararTelefono("99"))
	require.Equal(t, "", enmascararTelefono(""))
	require.Equal(t, "", enmascararTelefono("7"))
}

func TestPerfilRepo_DeRepartidor(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewPerfilRepo(pool)
	ctx := context.Background()
	hoy := time.Now().Format("2006-01-02")

	t.Run("inexistente", func(t *testing.T) {
		_, err := repo.DeRepartidor(ctx, uuidInexistente, hoy)
		require.True(t, errors.Is(err, ErrNoEncontrado))
	})

	t.Run("repartidor propio con una entrega y una falla", func(t *testing.T) {
		var uid string
		email := "perfil-test-" + time.Now().Format("150405.000000") + "@movii.test"
		require.NoError(t, pool.QueryRow(ctx,
			`INSERT INTO usuarios (nombre, email, password_hash, rol, telefono) VALUES ('Perfil Test', $1, 'x', 'repartidor', $2) RETURNING id::text`,
			email, "+5493564"+time.Now().Format("150405")).Scan(&uid))
		ruta, err := NewRutaRepo(pool).Create(ctx, domain.Ruta{Nombre: "Perfil Ruta", Zona: "Centro", Fecha: hoy, RepartidorID: uid})
		require.NoError(t, err)

		entregado, _ := envioDeTestRepo(t, pool)
		fallido, _ := envioDeTestRepo(t, pool)
		_, err = pool.Exec(ctx, "UPDATE envios SET ruta_id = $1, estado = 'entregado', fragil = true WHERE id = $2", ruta.ID, entregado)
		require.NoError(t, err)
		_, err = pool.Exec(ctx, "UPDATE envios SET ruta_id = $1, estado = 'no_entregado' WHERE id = $2", ruta.ID, fallido)
		require.NoError(t, err)
		_, err = pool.Exec(ctx, `INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, actor_id) VALUES ($1, 'en_camino', 'entregado', $2)`, entregado, uid)
		require.NoError(t, err)
		_, err = pool.Exec(ctx, `INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, motivo, actor_id) VALUES ($1, 'en_camino', 'no_entregado', 'cliente_ausente', $2)`, fallido, uid)
		require.NoError(t, err)
		t.Cleanup(func() {
			_, _ = pool.Exec(ctx, "UPDATE envios SET ruta_id = NULL WHERE ruta_id = $1", ruta.ID)
			_, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID)
			_, _ = pool.Exec(ctx, "DELETE FROM usuarios WHERE id = $1", uid)
		})

		p, err := repo.DeRepartidor(ctx, uid, hoy)
		require.NoError(t, err)
		require.Equal(t, "Perfil Test", p.Nombre)
		require.Equal(t, "repartidor", p.Rol)
		require.Regexp(t, `^••••\d\d$`, p.Telefono)
		require.False(t, p.ConGoogle)
		require.Equal(t, 1, p.Historico.Entregados)
		require.Equal(t, 1, p.Historico.NoEntregados)
		require.InDelta(t, 50.0, p.Historico.Efectividad, 0.01)
		require.Equal(t, 1, p.Historico.FragilesEntregados)
		require.Equal(t, 1, p.Historico.DiasTrabajados)
		require.NotNil(t, p.UltimosDias)
		require.NotNil(t, p.MotivosFallo)
		require.Len(t, p.MotivosFallo, 1)
		require.Equal(t, "cliente_ausente", p.MotivosFallo[0].Motivo)
		require.Equal(t, 1, p.RutasDeHoy)
	})

	t.Run("repartidor demo devuelve estructuras no nulas", func(t *testing.T) {
		p, err := repo.DeRepartidor(ctx, repartidorDemoID(t, pool), hoy)
		require.NoError(t, err)
		require.NotNil(t, p.UltimosDias)
		require.NotNil(t, p.MotivosFallo)
	})
}

// ---------- WhatsappRepo ----------

func TestWhatsappRepo_Notificaciones(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewWhatsappRepo(pool)
	ctx := context.Background()
	envioID, _ := envioDeTestRepo(t, pool)
	clave := "test-" + time.Now().Format("150405.000000")
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM notificaciones_whatsapp WHERE clave LIKE $1", clave+"%") })

	// Sin avisos todavía: lista vacía, nunca nil.
	lista, err := repo.NotificacionesDeEnvio(ctx, envioID)
	require.NoError(t, err)
	require.NotNil(t, lista)
	require.Empty(t, lista)

	id, nueva, err := repo.RegistrarNotificacion(ctx, Notificacion{Clave: clave + "-a", Telefono: "+5493564000000", Tipo: "en_camino", EnvioID: &envioID, Mensaje: "hola"})
	require.NoError(t, err)
	require.True(t, nueva)
	require.NotEmpty(t, id)

	// Misma clave: idempotente, no se registra otra vez.
	_, nueva, err = repo.RegistrarNotificacion(ctx, Notificacion{Clave: clave + "-a", Telefono: "+5493564000000", Tipo: "en_camino", EnvioID: &envioID, Mensaje: "hola"})
	require.NoError(t, err)
	require.False(t, nueva)

	require.NoError(t, repo.ResultadoNotificacion(ctx, id, "whatsapp", "5493564000000", nil))
	id2, _, err := repo.RegistrarNotificacion(ctx, Notificacion{Clave: clave + "-b", Telefono: "+5493564000000", Tipo: "entregado", EnvioID: &envioID, Mensaje: "chau"})
	require.NoError(t, err)
	require.NoError(t, repo.ResultadoNotificacion(ctx, id2, "mail", "ana@correo.com.ar", errors.New("sin conexion")))

	lista, err = repo.NotificacionesDeEnvio(ctx, envioID)
	require.NoError(t, err)
	require.Len(t, lista, 2)
	estados, canales := map[string]string{}, map[string]string{}
	for _, n := range lista {
		estados[n.Tipo] = n.Estado
		canales[n.Tipo] = n.Canal
	}
	require.Equal(t, "enviado", estados["en_camino"])
	require.Equal(t, "fallido", estados["entregado"])
	require.Equal(t, "whatsapp", canales["en_camino"])
	require.Equal(t, "mail", canales["entregado"])
}

func TestWhatsappRepo_DatosDeAviso(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewWhatsappRepo(pool)
	ctx := context.Background()

	t.Run("envio", func(t *testing.T) {
		envioID, _ := envioDeTestRepo(t, pool)
		d, err := repo.DatosAvisoEnvio(ctx, envioID)
		require.NoError(t, err)
		require.Equal(t, envioID, d.EnvioID)
		require.Equal(t, "pendiente", d.Estado)
		require.Equal(t, "Dest Test", d.Destinatario)
		require.Contains(t, d.Direccion, "Calle 2 100")
		require.Nil(t, d.Repartidor)

		_, err = repo.DatosAvisoEnvio(ctx, uuidInexistente)
		require.True(t, errors.Is(err, ErrNoEncontrado))
	})

	t.Run("ruta", func(t *testing.T) {
		ruta, err := NewRutaRepo(pool).Create(ctx, domain.Ruta{Nombre: "Aviso Ruta", Zona: "Centro", RepartidorID: repartidorDemoID(t, pool)})
		require.NoError(t, err)
		t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })

		d, err := repo.DatosAvisoRuta(ctx, ruta.ID)
		require.NoError(t, err)
		require.Equal(t, "Aviso Ruta", d.Nombre)
		require.Equal(t, 0, d.Envios)
		require.Equal(t, "", d.Patente)

		_, err = repo.DatosAvisoRuta(ctx, uuidInexistente)
		require.True(t, errors.Is(err, ErrNoEncontrado))
	})
}
