package db

import (
	"errors"
	"fmt"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// pgx5URL adapta el esquema de databaseURL al que espera el driver
// database/pgx/v5 de golang-migrate, que se registra como "pgx5"
// (postgres:// y postgresql:// son válidos para pgxpool pero no para migrate).
func pgx5URL(databaseURL string) string {
	if i := strings.Index(databaseURL, "://"); i != -1 {
		return "pgx5" + databaseURL[i:]
	}
	return databaseURL
}

// RunMigrations aplica todas las migraciones pendientes en migrationsDir
// contra databaseURL.
func RunMigrations(databaseURL, migrationsDir string) error {
	m, err := migrate.New("file://"+migrationsDir, pgx5URL(databaseURL))
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
	m, err := migrate.New("file://"+migrationsDir, pgx5URL(databaseURL))
	if err != nil {
		return fmt.Errorf("db: no se pudo iniciar migrate: %w", err)
	}
	defer m.Close()

	if err := m.Steps(-1); err != nil && !errors.Is(err, migrate.ErrNoChange) && !errors.Is(err, migrate.ErrNilVersion) {
		return fmt.Errorf("db: error revirtiendo migración: %w", err)
	}
	return nil
}
