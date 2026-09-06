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
