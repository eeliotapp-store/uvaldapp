-- Rol 'pruebas': cuentas de capacitación confinadas a /demo (datos de ejemplo
-- en el cliente, nunca llaman a los endpoints reales) — ver middleware.ts.
ALTER TYPE employee_role ADD VALUE IF NOT EXISTS 'pruebas';
