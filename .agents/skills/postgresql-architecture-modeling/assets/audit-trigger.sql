-- Ejemplo de Trigger de Auditoría Genérico en PL/pgSQL
-- Skill: SKL-DB-001

-- 1. Crear función de auditoría
CREATE OR REPLACE FUNCTION public.fn_audit_log_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Capturar el cambio, el usuario y el timestamp
    NEW.updated_at = CURRENT_TIMESTAMP;
    
    -- Opcional: Podrías insertar en una tabla de auditoría externa aquí
    -- INSERT INTO audit_logs (table_name, operation, old_data, new_data, user_id)
    -- VALUES (TG_TABLE_NAME, TG_OP, to_jsonb(OLD), to_jsonb(NEW), current_setting('app.current_user_id', true));

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Aplicar a una tabla ejemplo
-- CREATE TABLE testimonials (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     content TEXT NOT NULL,
--     created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
-- );

-- CREATE TRIGGER tr_audit_testimonials
-- BEFORE UPDATE ON testimonials
-- FOR EACH ROW
-- EXECUTE FUNCTION public.fn_audit_log_changes();
