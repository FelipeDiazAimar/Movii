package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/domain"
	"movii/api/internal/platform/geo"
	"movii/api/internal/repository"
)

// maxParadasExacto: hasta esta cantidad de paradas el orden se calcula exacto
// (programación dinámica, 2^n·n²); con más, vecino más cercano + 2-opt.
const maxParadasExacto = 11

// OrdenMasCorto devuelve el orden de visita de las paradas que minimiza el
// costo total del recorrido. costo es una matriz cuadrada sobre los puntos
// [0 = salida, 1..n = paradas, n+1 = llegada]; la llegada (el depósito) es
// opcional: si la matriz tiene n+1 filas el recorrido termina en la última
// parada. Devuelve los índices de las paradas (1..n) en el orden a visitar.
func OrdenMasCorto(costo [][]float64, conLlegada bool) []int {
	total := len(costo)
	n := total - 1
	if conLlegada {
		n = total - 2
	}
	if n <= 0 {
		return nil
	}
	fin := func(j int) float64 {
		if conLlegada {
			return costo[j][total-1]
		}
		return 0
	}
	if n <= maxParadasExacto {
		return ordenExacto(costo, n, fin)
	}
	return mejorar2Opt(costo, vecinoMasCercano(costo, n), fin)
}

// ordenExacto resuelve el recorrido con programación dinámica (Held-Karp).
func ordenExacto(costo [][]float64, n int, fin func(int) float64) []int {
	completo := 1 << n
	dp := make([][]float64, completo)
	desde := make([][]int, completo)
	for m := range dp {
		dp[m] = make([]float64, n)
		desde[m] = make([]int, n)
		for j := range dp[m] {
			dp[m][j] = math.Inf(1)
			desde[m][j] = -1
		}
	}
	for j := 0; j < n; j++ {
		dp[1<<j][j] = costo[0][j+1]
	}
	for m := 1; m < completo; m++ {
		for j := 0; j < n; j++ {
			if m&(1<<j) == 0 || math.IsInf(dp[m][j], 1) {
				continue
			}
			for k := 0; k < n; k++ {
				if m&(1<<k) != 0 {
					continue
				}
				sig := m | 1<<k
				if c := dp[m][j] + costo[j+1][k+1]; c < dp[sig][k] {
					dp[sig][k], desde[sig][k] = c, j
				}
			}
		}
	}
	mejor, ultimo := math.Inf(1), 0
	for j := 0; j < n; j++ {
		if c := dp[completo-1][j] + fin(j+1); c < mejor {
			mejor, ultimo = c, j
		}
	}
	orden := make([]int, 0, n)
	for m, j := completo-1, ultimo; j >= 0; {
		orden = append(orden, j+1)
		m, j = m&^(1<<j), desde[m][j]
	}
	for i, k := 0, len(orden)-1; i < k; i, k = i+1, k-1 {
		orden[i], orden[k] = orden[k], orden[i]
	}
	return orden
}

func vecinoMasCercano(costo [][]float64, n int) []int {
	usado := make([]bool, n+1)
	orden := make([]int, 0, n)
	actual := 0
	for len(orden) < n {
		mejor, elegido := math.Inf(1), -1
		for j := 1; j <= n; j++ {
			if !usado[j] && costo[actual][j] < mejor {
				mejor, elegido = costo[actual][j], j
			}
		}
		usado[elegido] = true
		orden = append(orden, elegido)
		actual = elegido
	}
	return orden
}

// mejorar2Opt invierte tramos del recorrido mientras eso lo acorte.
func mejorar2Opt(costo [][]float64, orden []int, fin func(int) float64) []int {
	largo := func(o []int) float64 {
		t, prev := 0.0, 0
		for _, j := range o {
			t += costo[prev][j]
			prev = j
		}
		return t + fin(prev)
	}
	mejor := largo(orden)
	for mejoro := true; mejoro; {
		mejoro = false
		for i := 0; i < len(orden)-1; i++ {
			for k := i + 1; k < len(orden); k++ {
				prueba := append([]int(nil), orden...)
				for a, b := i, k; a < b; a, b = a+1, b-1 {
					prueba[a], prueba[b] = prueba[b], prueba[a]
				}
				if l := largo(prueba); l < mejor-1e-9 {
					orden, mejor, mejoro = prueba, l, true
				}
			}
		}
	}
	return orden
}

// OrdenadorRutas calcula el orden de visita de los envíos de una ruta: el
// recorrido más corto por calles que sale del depósito (o, con la ruta en
// curso, de donde está el camión), pasa por las paradas pendientes y vuelve
// al depósito. Las paradas ya resueltas conservan su lugar.
type OrdenadorRutas struct {
	pool      *pgxpool.Pool
	proveedor geo.GeoProvider
	// Deposito es la salida y la vuelta de las rutas.
	Deposito geo.Punto
}

// NewOrdenadorRutas crea el ordenador. proveedor da la matriz de distancias
// por calles; si es nil o falla, se usa la distancia en línea recta.
func NewOrdenadorRutas(pool *pgxpool.Pool, proveedor geo.GeoProvider) *OrdenadorRutas {
	return &OrdenadorRutas{pool: pool, proveedor: proveedor, Deposito: geo.CentroSanFrancisco}
}

type paradaAOrdenar struct {
	id     string
	estado string
	punto  *geo.Punto
}

// Ordenar recalcula y guarda envios.orden_ruta para la ruta.
func (o *OrdenadorRutas) Ordenar(ctx context.Context, rutaID string) error {
	var estadoRuta string
	var vLat, vLng *float64
	err := o.pool.QueryRow(ctx, `
		SELECT r.estado::text, v.latitud::float8, v.longitud::float8
		FROM rutas r LEFT JOIN vehiculos v ON v.id = r.vehiculo_id
		WHERE r.id::text = $1
	`, rutaID).Scan(&estadoRuta, &vLat, &vLng)
	if errors.Is(err, pgx.ErrNoRows) {
		return repository.ErrNoEncontrado
	}
	if err != nil {
		return err
	}
	rows, err := o.pool.Query(ctx, `
		SELECT e.id::text, e.estado::text, d.latitud::float8, d.longitud::float8
		FROM envios e JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE e.ruta_id::text = $1
		ORDER BY COALESCE(e.orden_ruta, 2147483647), e.created_at, e.id
	`, rutaID)
	if err != nil {
		return err
	}
	var resueltas, pendientes, sinUbicacion []paradaAOrdenar
	for rows.Next() {
		var p paradaAOrdenar
		var lat, lng *float64
		if err := rows.Scan(&p.id, &p.estado, &lat, &lng); err != nil {
			rows.Close()
			return err
		}
		switch {
		case p.estado == domain.EstadoEnvioEntregado || p.estado == domain.EstadoEnvioNoEntregado:
			resueltas = append(resueltas, p)
		case lat == nil || lng == nil:
			sinUbicacion = append(sinUbicacion, p)
		default:
			p.punto = &geo.Punto{Lat: *lat, Lng: *lng}
			pendientes = append(pendientes, p)
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	salida := o.Deposito
	if estadoRuta == domain.EstadoRutaEnCurso && vLat != nil && vLng != nil {
		salida = geo.Punto{Lat: *vLat, Lng: *vLng}
	}
	if len(pendientes) > 1 {
		puntos := make([]geo.Punto, 0, len(pendientes)+2)
		puntos = append(puntos, salida)
		for _, p := range pendientes {
			puntos = append(puntos, *p.punto)
		}
		puntos = append(puntos, o.Deposito)
		orden := OrdenMasCorto(o.matriz(ctx, puntos), true)
		ordenadas := make([]paradaAOrdenar, 0, len(pendientes))
		for _, i := range orden {
			ordenadas = append(ordenadas, pendientes[i-1])
		}
		pendientes = ordenadas
	}

	todas := append(append(resueltas, pendientes...), sinUbicacion...)
	ids := make([]string, len(todas))
	nums := make([]int32, len(todas))
	for i, p := range todas {
		ids[i], nums[i] = p.id, int32(i+1)
	}
	if _, err := o.pool.Exec(ctx, `
		UPDATE envios e SET orden_ruta = x.n
		FROM unnest($1::uuid[], $2::int[]) AS x(id, n)
		WHERE e.id = x.id
	`, ids, nums); err != nil {
		return fmt.Errorf("orden de la ruta: %w", err)
	}
	return nil
}

// matriz devuelve las distancias por calles (km) o, si el proveedor no
// responde, las distancias en línea recta.
func (o *OrdenadorRutas) matriz(ctx context.Context, puntos []geo.Punto) [][]float64 {
	if o.proveedor != nil {
		if m, err := o.proveedor.Matriz(ctx, puntos); err == nil && len(m.KM) == len(puntos) {
			return m.KM
		} else if err != nil {
			log.Printf("orden de ruta: sin matriz por calles (%v), uso línea recta", err)
		}
	}
	out := make([][]float64, len(puntos))
	for i := range puntos {
		out[i] = make([]float64, len(puntos))
		for j := range puntos {
			out[i][j] = geo.DistanciaM(puntos[i], puntos[j]) / 1000
		}
	}
	return out
}
