package geo

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type geocoderContador struct{ llamadas int }

func (g *geocoderContador) Geocodificar(context.Context, string, string, string, string) (Punto, error) {
	g.llamadas++
	return Punto{Lat: 1, Lng: 2}, nil
}

func TestConCache_NoRepiteGeocodificacion(t *testing.T) {
	g := &geocoderContador{}
	p := ConCache(NewOSM(g, ""), 24*time.Hour)
	for i := 0; i < 3; i++ {
		_, conf, err := p.Geocodificar(context.Background(), "Belgrano", "100", "SF", "2400")
		require.NoError(t, err)
		require.Equal(t, 0.9, conf)
	}
	require.Equal(t, 1, g.llamadas)
}

func TestOSM_MatrizParseaTable(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Contains(t, r.URL.Path, "/table/v1/driving/")
		_, _ = w.Write([]byte(`{"code":"Ok","distances":[[0,2000],[2000,0]],"durations":[[0,120],[120,0]]}`))
	}))
	defer srv.Close()
	m, err := NewOSM(nil, srv.URL).Matriz(context.Background(), []Punto{{Lat: 1, Lng: 1}, {Lat: 2, Lng: 2}})
	require.NoError(t, err)
	require.Equal(t, 2.0, m.KM[0][1])
	require.Equal(t, 2.0, m.Min[1][0])
}
