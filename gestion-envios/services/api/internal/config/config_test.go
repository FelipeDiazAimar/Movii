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
