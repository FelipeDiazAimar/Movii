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
