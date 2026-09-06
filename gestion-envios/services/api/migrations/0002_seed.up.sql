INSERT INTO usuarios (id, nombre, email, password_hash, rol) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Ana Supervisora', 'supervisor@movii.demo', '$2a$10$X5OtxtXJ/IAxmM7DGNo.C.usc7NHAE9svUkLpyEzUMv4DUhXi/vja', 'supervisor'),
    ('22222222-2222-2222-2222-222222222222', 'Beto Operador', 'operador@movii.demo', '$2a$10$X5OtxtXJ/IAxmM7DGNo.C.usc7NHAE9svUkLpyEzUMv4DUhXi/vja', 'operador'),
    ('33333333-3333-3333-3333-333333333333', 'Carla Repartidora', 'repartidor@movii.demo', '$2a$10$X5OtxtXJ/IAxmM7DGNo.C.usc7NHAE9svUkLpyEzUMv4DUhXi/vja', 'repartidor');

INSERT INTO remitentes (id, nombre, telefono, direccion) VALUES
    ('44444444-4444-4444-4444-444444444444', 'Depósito Central Movii', '3564-100100', 'Ruta 19 km 4, San Francisco');

INSERT INTO destinatarios (id, nombre, telefono, calle, numero, piso_depto, localidad, codigo_postal) VALUES
    ('55555555-5555-5555-5555-555555555555', 'Juan Pérez', '3564-200200', 'San Martín', '450', NULL, 'San Francisco', 'X2400'),
    ('66666666-6666-6666-6666-666666666666', 'María Gómez', '3564-300300', 'Belgrano', '120', '2A', 'San Francisco', 'X2400');

INSERT INTO rutas (id, nombre, zona, fecha, estado, repartidor_id) VALUES
    ('77777777-7777-7777-7777-777777777777', 'Ruta Centro 01', 'Centro', CURRENT_DATE, 'planificada', '33333333-3333-3333-3333-333333333333');

INSERT INTO envios (codigo_guia, estado, peso, tamano, tipo_contenido, remitente_id, destinatario_id, ruta_id) VALUES
    ('MOV-20260905-0001', 'asignado', 2.5, 'chico', 'Ropa', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', '77777777-7777-7777-7777-777777777777'),
    ('MOV-20260905-0002', 'pendiente', 8.0, 'mediano', 'Electrónica', '44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666', NULL);
