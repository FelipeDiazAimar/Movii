-- T3: el rol "supervisor" pasa a llamarse "admin" (único que puede borrar).
ALTER TYPE rol_usuario RENAME VALUE 'supervisor' TO 'admin';
