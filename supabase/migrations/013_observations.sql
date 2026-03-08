-- Tabla de observaciones del turno
-- Permite a las empleadas registrar notas/observaciones durante su turno
CREATE TABLE IF NOT EXISTS observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    shift_id UUID NOT NULL REFERENCES shifts(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_observations_employee ON observations(employee_id);
CREATE INDEX IF NOT EXISTS idx_observations_shift ON observations(shift_id);
CREATE INDEX IF NOT EXISTS idx_observations_created ON observations(created_at DESC);

-- Comentarios
COMMENT ON TABLE observations IS 'Observaciones registradas por empleadas durante sus turnos';
COMMENT ON COLUMN observations.content IS 'Contenido de la observación (cerveza rota, compra de hielo, etc.)';
