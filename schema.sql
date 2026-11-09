-- =================================================================================
-- SCRIPT DE MIGRACIÓN INICIAL - ÓPALO NAILS SPA (PEREIRA, COLOMBIA)
-- Archivo: schema.sql
-- Instrucciones: Copia y pega todo este script en el SQL Editor de tu nuevo
-- proyecto en Supabase y presiona "Run" para crear toda la estructura y catálogo.
-- =================================================================================

-- 1. EXTENSIONES REQUERIDAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- =================================================================================
-- 2. ESTRUCTURA DE TABLAS PRINCIPALES
-- =================================================================================

-- 2.1 Tabla: complejos (Configuración principal de la sede Ópalo Nails Spa)
CREATE TABLE IF NOT EXISTS complejos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL DEFAULT 'opalo-nails',
    tipo_negocio VARCHAR(50) NOT NULL DEFAULT 'belleza_unas',
    nombre VARCHAR(120) NOT NULL,
    ciudad VARCHAR(80) NOT NULL DEFAULT 'Pereira, Colombia',
    direccion TEXT DEFAULT 'Pereira, Risaralda, Colombia',
    telefono_whatsapp VARCHAR(30) DEFAULT '',
    telefono_contacto VARCHAR(30) DEFAULT '',
    whatsapp_phone_number_id VARCHAR(100),
    whatsapp_token TEXT,
    instagram_url TEXT DEFAULT 'https://www.instagram.com/opalo_nailspereira?cplk=MW9ncWJwMG50anlsMQ==',
    nequi_numero VARCHAR(50) DEFAULT '',
    daviplata_numero VARCHAR(50) DEFAULT '',
    titular_cuenta VARCHAR(120) DEFAULT 'Ópalo Nails Spa',
    hora_apertura TIME NOT NULL DEFAULT '08:00:00',
    hora_cierre TIME NOT NULL DEFAULT '19:00:00',
    porcentaje_anticipo_minimo NUMERIC(10, 2) NOT NULL DEFAULT 0,
    monto_anticipo_fijo NUMERIC(10, 2) NOT NULL DEFAULT 20000,
    reglas_turnos JSONB NOT NULL DEFAULT '{
      "hora_apertura": "08:00",
      "hora_cierre": "19:00",
      "exige_anticipo": false,
      "monto_anticipo_fijo": 20000,
      "porcentaje_anticipo": 20000
    }'::jsonb,
    configuracion_pagos JSONB NOT NULL DEFAULT '{
      "nequi": "",
      "bancolombia": "",
      "titular": "Ópalo Nails Spa"
    }'::jsonb,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 Tabla: canchas (Especialistas / Profesionales de Uñas, Cejas y Pestañas)
CREATE TABLE IF NOT EXISTS canchas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complejo_id UUID NOT NULL REFERENCES complejos(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    deporte VARCHAR(50) NOT NULL DEFAULT 'belleza_unas',
    tipo VARCHAR(50) NOT NULL DEFAULT 'general',
    especialidad VARCHAR(100) DEFAULT 'Uñas, Cejas y Pestañas',
    precio_estandar NUMERIC(10, 2) NOT NULL DEFAULT 46000,
    precio_pico NUMERIC(10, 2) NOT NULL DEFAULT 46000,
    precio_base_hora NUMERIC(10, 2) NOT NULL DEFAULT 46000,
    foto TEXT,
    activa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.3 Tabla: servicios (Catálogo oficial de servicios: Uñas, Cejas y Pestañas)
CREATE TABLE IF NOT EXISTS servicios (
    id SERIAL PRIMARY KEY,
    complejo_id UUID NOT NULL REFERENCES complejos(id) ON DELETE CASCADE,
    nombre VARCHAR(140) NOT NULL,
    categoria VARCHAR(80) NOT NULL,
    duracion INTEGER NOT NULL DEFAULT 60, -- Duración en minutos
    precio NUMERIC(10, 2) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    orden INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.4 Tabla: clientes (Directorio de clientas por WhatsApp)
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telefono_wa VARCHAR(30) UNIQUE NOT NULL,
    nombre VARCHAR(120),
    email VARCHAR(120),
    notas_preferencias TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.5 Tabla: reservas (Citas agendadas, pre-reservas y bloqueos de horario)
CREATE TABLE IF NOT EXISTS reservas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cancha_id UUID NOT NULL REFERENCES canchas(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    servicio_id INTEGER REFERENCES servicios(id) ON DELETE SET NULL,
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente_pago'
        CHECK (estado IN ('pendiente_pago', 'pendiente_anticipo', 'confirmada', 'cancelada', 'expirada', 'completada', 'bloqueada')),
    valor_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    valor_anticipo_requerido NUMERIC(10, 2) NOT NULL DEFAULT 0,
    metodo_pago VARCHAR(40) DEFAULT 'pendiente',
    origen VARCHAR(30) DEFAULT 'web',
    notas TEXT,
    recordatorio_enviado BOOLEAN NOT NULL DEFAULT false,
    expiracion_reserva TIMESTAMPTZ,
    expira_en TIMESTAMPTZ,
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Restricción física anti-solapamiento (evita doble agendamiento para la misma especialista)
    CONSTRAINT no_solapamiento_citas EXCLUDE USING gist (
        cancha_id WITH =,
        tstzrange(fecha_inicio, fecha_fin, '[)') WITH &&
    ) WHERE (estado IN ('pendiente_pago', 'pendiente_anticipo', 'confirmada', 'completada', 'bloqueada'))
);

-- 2.6 Tabla: pagos_anticipos (Soportes de transferencia y verificación por IA)
CREATE TABLE IF NOT EXISTS pagos_anticipos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reserva_id UUID NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    metodo VARCHAR(40) DEFAULT 'nequi',
    monto NUMERIC(10, 2) DEFAULT 0,
    comprobante_url TEXT,
    banco_origen VARCHAR(50),
    referencia_transaccion VARCHAR(100),
    monto_detectado NUMERIC(10, 2),
    fecha_detectada TIMESTAMPTZ,
    confianza_ia NUMERIC(3, 2),
    datos_extraidos_ia JSONB,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    estado_verificacion VARCHAR(30) NOT NULL DEFAULT 'en_revision'
        CHECK (estado_verificacion IN ('en_revision', 'aprobado', 'rechazado', 'dudoso')),
    revisado_por VARCHAR(80),
    notas_admin TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.7 Tabla: faqs (Preguntas frecuentes para el Recepcionista IA de Ópalo Nails Spa)
CREATE TABLE IF NOT EXISTS faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complejo_id UUID NOT NULL REFERENCES complejos(id) ON DELETE CASCADE,
    categoria VARCHAR(60) NOT NULL,
    pregunta TEXT NOT NULL,
    respuesta TEXT NOT NULL,
    palabras_clave TEXT[],
    activa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =================================================================================
-- 3. FUNCIÓN RPC: obtener_horarios_disponibles
-- =================================================================================
CREATE OR REPLACE FUNCTION obtener_horarios_disponibles(
    p_cancha_id UUID,
    p_fecha DATE
)
RETURNS TABLE (
    hora_inicio TIME,
    hora_fin TIME,
    disponible BOOLEAN,
    precio NUMERIC(10, 2)
) AS $$
DECLARE
    v_apertura TIME;
    v_cierre TIME;
    v_precio_estandar NUMERIC(10, 2);
    v_hora_actual TIME;
    v_ts_inicio TIMESTAMPTZ;
    v_ts_fin TIMESTAMPTZ;
    v_ocupado BOOLEAN;
BEGIN
    -- Liberar reservas pendientes cuyo tiempo de expiración ya venció
    UPDATE reservas
    SET estado = 'expirada'
    WHERE estado IN ('pendiente_pago', 'pendiente_anticipo')
      AND expiracion_reserva IS NOT NULL
      AND expiracion_reserva < NOW();

    -- Obtener horario del complejo y tarifa base de la especialista
    SELECT comp.hora_apertura, comp.hora_cierre, c.precio_estandar
    INTO v_apertura, v_cierre, v_precio_estandar
    FROM canchas c
    JOIN complejos comp ON comp.id = c.complejo_id
    WHERE c.id = p_cancha_id;

    IF v_apertura IS NULL THEN v_apertura := '08:00:00'; END IF;
    IF v_cierre IS NULL THEN v_cierre := '19:00:00'; END IF;
    IF v_precio_estandar IS NULL THEN v_precio_estandar := 46000; END IF;

    v_hora_actual := v_apertura;

    WHILE v_hora_actual < v_cierre LOOP
        v_ts_inicio := (p_fecha || ' ' || v_hora_actual)::TIMESTAMP AT TIME ZONE 'America/Bogota';
        v_ts_fin := v_ts_inicio + INTERVAL '1 hour';

        SELECT EXISTS (
            SELECT 1 FROM reservas r
            WHERE r.cancha_id = p_cancha_id
              AND r.estado IN ('pendiente_pago', 'pendiente_anticipo', 'confirmada', 'completada', 'bloqueada')
              AND tstzrange(r.fecha_inicio, r.fecha_fin, '[)') && tstzrange(v_ts_inicio, v_ts_fin, '[)')
        ) INTO v_ocupado;

        hora_inicio := v_hora_actual;
        hora_fin := v_hora_actual + INTERVAL '1 hour';
        disponible := NOT v_ocupado;
        precio := v_precio_estandar;
        RETURN NEXT;

        v_hora_actual := v_hora_actual + INTERVAL '1 hour';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =================================================================================
-- 4. ÍNDICES DE RENDIMIENTO
-- =================================================================================
CREATE INDEX IF NOT EXISTS idx_canchas_complejo ON canchas (complejo_id);
CREATE INDEX IF NOT EXISTS idx_servicios_complejo ON servicios (complejo_id, categoria);
CREATE INDEX IF NOT EXISTS idx_reservas_cancha_fechas ON reservas (cancha_id, fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_reservas_estado_expira ON reservas (estado, expiracion_reserva) WHERE estado IN ('pendiente_pago', 'pendiente_anticipo');
CREATE INDEX IF NOT EXISTS idx_clientes_telefono_wa ON clientes (telefono_wa);
CREATE INDEX IF NOT EXISTS idx_faqs_complejo_activa ON faqs (complejo_id, activa);

-- =================================================================================
-- 5. SEGURIDAD RLS Y PERMISOS PARA EL FRONTEND Y BACKEND
-- =================================================================================
ALTER TABLE complejos ENABLE ROW LEVEL SECURITY;
ALTER TABLE canchas ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_anticipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso publico complejos" ON complejos;
CREATE POLICY "Acceso publico complejos" ON complejos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso publico canchas" ON canchas;
CREATE POLICY "Acceso publico canchas" ON canchas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso publico servicios" ON servicios;
CREATE POLICY "Acceso publico servicios" ON servicios FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso publico clientes" ON clientes;
CREATE POLICY "Acceso publico clientes" ON clientes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso publico reservas" ON reservas;
CREATE POLICY "Acceso publico reservas" ON reservas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso publico pagos_anticipos" ON pagos_anticipos;
CREATE POLICY "Acceso publico pagos_anticipos" ON pagos_anticipos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso publico faqs" ON faqs;
CREATE POLICY "Acceso publico faqs" ON faqs FOR ALL USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- =================================================================================
-- 6. DATOS INICIALES (SEED) - ÓPALO NAILS SPA (PEREIRA, COLOMBIA)
-- =================================================================================
DO $$
DECLARE
    v_complejo_id UUID;
BEGIN
    -- 6.1 Crear o actualizar la sede principal de Ópalo Nails Spa
    INSERT INTO complejos (
        nombre,
        slug,
        tipo_negocio,
        ciudad,
        direccion,
        titular_cuenta,
        instagram_url,
        hora_apertura,
        hora_cierre,
        porcentaje_anticipo_minimo,
        monto_anticipo_fijo,
        reglas_turnos,
        configuracion_pagos
    )
    VALUES (
        'Ópalo Nails Spa',
        'opalo-nails',
        'belleza_unas',
        'Pereira, Colombia',
        'Pereira, Risaralda, Colombia',
        'Ópalo Nails Spa',
        'https://www.instagram.com/opalo_nailspereira?cplk=MW9ncWJwMG50anlsMQ==',
        '08:00:00',
        '19:00:00',
        0,
        20000,
        '{
          "hora_apertura": "08:00",
          "hora_cierre": "19:00",
          "exige_anticipo": false,
          "monto_anticipo_fijo": 20000,
          "porcentaje_anticipo": 20000,
          "servicios": [
            { "id": 1, "nombre": "Depilación con cera", "categoria": "Cejas y Pestañas", "duracion": 30, "precio": 15000, "descripcion": "Diseño y perfilado de cejas con cera suave de alta precisión." },
            { "id": 2, "nombre": "Depilación con hilo", "categoria": "Cejas y Pestañas", "duracion": 30, "precio": 20000, "descripcion": "Diseño y depilación hindú con hilo orgánico para pieles sensibles." },
            { "id": 3, "nombre": "Henna", "categoria": "Cejas y Pestañas", "duracion": 30, "precio": 8000, "descripcion": "Sombreado semipermanente con pigmento de henna para definir la mirada." },
            { "id": 4, "nombre": "Cera y henna", "categoria": "Cejas y Pestañas", "duracion": 45, "precio": 22000, "descripcion": "Diseño de cejas con cera + sombreado en henna de acabado natural." },
            { "id": 5, "nombre": "Hilo y henna", "categoria": "Cejas y Pestañas", "duracion": 45, "precio": 16000, "descripcion": "Depilación con hilo + pigmentación con henna para cejas definidas." },
            { "id": 6, "nombre": "Bigote con cera", "categoria": "Cejas y Pestañas", "duracion": 20, "precio": 8000, "descripcion": "Depilación delicada de bozo con cera tibia." },
            { "id": 7, "nombre": "Bigote con hilo", "categoria": "Cejas y Pestañas", "duracion": 20, "precio": 10000, "descripcion": "Depilación de bozo con técnica de hilo sin irritación." },
            { "id": 8, "nombre": "Laminado de cejas", "categoria": "Cejas y Pestañas", "duracion": 60, "precio": 55000, "descripcion": "Alisado, direccionamiento, diseño e hidratación profunda de cejas." },
            { "id": 9, "nombre": "Lifting de pestañas", "categoria": "Cejas y Pestañas", "duracion": 60, "precio": 55000, "descripcion": "Realce y curvatura natural para tus pestañas con efecto alargador." },
            { "id": 10, "nombre": "Pestañas pelo a pelo clásicas", "categoria": "Cejas y Pestañas", "duracion": 120, "precio": 80000, "descripcion": "Extensiones pelo a pelo clásicas. Retoque $40.000 (pasados los 20 días tiene un adicional de $5.000 a $10.000)." },
            { "id": 11, "nombre": "Pestañas pelo a pelo efecto pestañina", "categoria": "Cejas y Pestañas", "duracion": 120, "precio": 80000, "descripcion": "Extensiones con acabado definido tipo rímel. Retoque $45.000 (pasados los 20 días tiene un adicional de $5.000 a $10.000)." },
            { "id": 12, "nombre": "Pestañas híbridas", "categoria": "Cejas y Pestañas", "duracion": 120, "precio": 100000, "descripcion": "Combinación perfecta entre técnica clásica y abanicos de volumen. Retoque $50.000 (pasados los 20 días adicional de $5.000 a $10.000)." },
            { "id": 13, "nombre": "Pestañas 3D", "categoria": "Cejas y Pestañas", "duracion": 120, "precio": 100000, "descripcion": "Volumen tridimensional ligero y expresivo. Retoque $50.000 (pasados los 20 días tiene un adicional de $5.000 a $10.000)." },
            { "id": 14, "nombre": "Pestañas pelo a pelo volumen ruso", "categoria": "Cejas y Pestañas", "duracion": 150, "precio": 110000, "descripcion": "Máxima densidad y mirada impactante. Retoque $60.000 (pasados los 20 días tiene un adicional de $5.000 a $10.000)." },
            { "id": 15, "nombre": "Pestañas pelo a pelo volumen brasileño", "categoria": "Cejas y Pestañas", "duracion": 120, "precio": 90000, "descripcion": "Fibras en Y de alta retención y acabado tupido con textura suave." },
            { "id": 16, "nombre": "Limpieza", "categoria": "Uñas Tradicional y Semi", "duracion": 40, "precio": 13000, "descripcion": "Limado, cuidado de cutícula, exfoliación e hidratación." },
            { "id": 17, "nombre": "Manicura tradicional", "categoria": "Uñas Tradicional y Semi", "duracion": 60, "precio": 18000, "descripcion": "Limpieza completa de manos y esmaltado tradicional. Los diseños elaborados tienen tiempo y costo adicional." },
            { "id": 18, "nombre": "Pedicura tradicional", "categoria": "Uñas Tradicional y Semi", "duracion": 60, "precio": 18000, "descripcion": "Limpieza profunda de pies, exfoliación y esmaltado tradicional." },
            { "id": 19, "nombre": "Manicura semipermanente full", "categoria": "Uñas Tradicional y Semi", "duracion": 90, "precio": 46000, "descripcion": "Manicura rusa/combinada con nivelación y esmaltado semipermanente full. Los diseños elaborados tienen tiempo y costo adicional." },
            { "id": 20, "nombre": "Manicura solo tono", "categoria": "Uñas Tradicional y Semi", "duracion": 75, "precio": 39000, "descripcion": "Limpieza + esmaltado semipermanente en tono liso uniforme." },
            { "id": 21, "nombre": "Pedicura Semi", "categoria": "Uñas Tradicional y Semi", "duracion": 80, "precio": 39000, "descripcion": "Pedicura spa completa con esmaltado en gel semipermanente de larga duración." },
            { "id": 22, "nombre": "Dipping + Semi", "categoria": "Uñas Tradicional y Semi", "duracion": 90, "precio": 53000, "descripcion": "Refuerzo en polvo Dipping sobre uña natural + acabado semipermanente." },
            { "id": 23, "nombre": "Base Ruber", "categoria": "Uñas Tradicional y Semi", "duracion": 90, "precio": 53000, "descripcion": "Nivelación con base rubber fortalecedora + esmaltado semipermanente." },
            { "id": 24, "nombre": "Recubrimiento en acrílico", "categoria": "Acrílico y Press On", "duracion": 120, "precio": 75000, "descripcion": "Baño de acrílico protector sobre el largo de tu uña natural + esmaltado semipermanente." },
            { "id": 25, "nombre": "Sistema Press On", "categoria": "Acrílico y Press On", "duracion": 120, "precio": 75000, "descripcion": "Extensión en tips de gel completo de acabado natural y ultraligero + semipermanente." },
            { "id": 26, "nombre": "Acrílicas con tip", "categoria": "Acrílico y Press On", "duracion": 120, "precio": 90000, "descripcion": "Extensión en acrílico con tip + esmaltado semipermanente. Los diseños elaborados tienen tiempo y costo adicional." },
            { "id": 27, "nombre": "Acrílicas esculpidas", "categoria": "Acrílico y Press On", "duracion": 150, "precio": 100000, "descripcion": "Estructura esculpida con molde a medida + esmaltado semipermanente. Los diseños elaborados tienen tiempo y costo adicional." },
            { "id": 28, "nombre": "Retoque de acrílico o Press On", "categoria": "Acrílico y Press On", "duracion": 120, "precio": 65000, "descripcion": "Mantenimiento de crecimiento + semipermanente. Incluye una uña perdida (adicional: con tip $6.000, esculpida $8.000)." },
            { "id": 29, "nombre": "Retiro de acrílico definitivo", "categoria": "Retiros y Adicionales", "duracion": 60, "precio": 15000, "descripcion": "Retiro seguro de estructura acrílica o Press On cuidando la lámina natural." },
            { "id": 30, "nombre": "Retiro definitivo semipermanente", "categoria": "Retiros y Adicionales", "duracion": 30, "precio": 8000, "descripcion": "Retiro cuidadoso de esmaltado semipermanente o base rubber." },
            { "id": 31, "nombre": "Uña en semipermanente", "categoria": "Retiros y Adicionales", "duracion": 20, "precio": 4000, "descripcion": "Reparación o esmaltado individual de 1 uña en semipermanente." },
            { "id": 32, "nombre": "Uña Press On o recubrimiento", "categoria": "Retiros y Adicionales", "duracion": 20, "precio": 7000, "descripcion": "Reposición individual de 1 uña en Press On o recubrimiento acrílico." },
            { "id": 33, "nombre": "Uña acrílica con tip", "categoria": "Retiros y Adicionales", "duracion": 25, "precio": 8000, "descripcion": "Reposición individual de 1 uña acrílica con tip." },
            { "id": 34, "nombre": "Uña esculpida", "categoria": "Retiros y Adicionales", "duracion": 30, "precio": 10000, "descripcion": "Reposición individual de 1 uña acrílica esculpida." }
          ]
        }'::jsonb,
        '{
          "nequi": "",
          "bancolombia": "",
          "titular": "Ópalo Nails Spa"
        }'::jsonb
    )
    ON CONFLICT (slug) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        ciudad = EXCLUDED.ciudad,
        instagram_url = EXCLUDED.instagram_url,
        reglas_turnos = EXCLUDED.reglas_turnos
    RETURNING id INTO v_complejo_id;

    -- 6.2 Insertar Especialistas iniciales si no existen
    IF NOT EXISTS (SELECT 1 FROM canchas WHERE complejo_id = v_complejo_id) THEN
        INSERT INTO canchas (complejo_id, nombre, deporte, tipo, especialidad, precio_estandar, precio_pico, precio_base_hora) VALUES
            (v_complejo_id, 'Especialista 1', 'belleza_unas', 'general', 'Uñas, Cejas y Pestañas', 46000, 46000, 46000),
            (v_complejo_id, 'Especialista 2', 'belleza_unas', 'general', 'Uñas, Cejas y Pestañas', 46000, 46000, 46000),
            (v_complejo_id, 'Especialista 3', 'belleza_unas', 'general', 'Uñas, Cejas y Pestañas', 46000, 46000, 46000),
            (v_complejo_id, 'Especialista 4', 'belleza_unas', 'general', 'Uñas, Cejas y Pestañas', 46000, 46000, 46000);
    END IF;

    -- 6.3 Insertar Catálogo Oficial en la tabla `servicios`
    DELETE FROM servicios WHERE complejo_id = v_complejo_id;
    INSERT INTO servicios (complejo_id, nombre, categoria, duracion, precio, descripcion, orden) VALUES
        -- Cejas y Pestañas
        (v_complejo_id, 'Depilación con cera', 'Cejas y Pestañas', 30, 15000, 'Diseño y perfilado de cejas con cera suave de alta precisión.', 1),
        (v_complejo_id, 'Depilación con hilo', 'Cejas y Pestañas', 30, 20000, 'Diseño y depilación hindú con hilo orgánico para pieles sensibles.', 2),
        (v_complejo_id, 'Henna', 'Cejas y Pestañas', 30, 8000, 'Sombreado semipermanente con pigmento de henna para definir la mirada.', 3),
        (v_complejo_id, 'Cera y henna', 'Cejas y Pestañas', 45, 22000, 'Diseño de cejas con cera + sombreado en henna de acabado natural.', 4),
        (v_complejo_id, 'Hilo y henna', 'Cejas y Pestañas', 45, 16000, 'Depilación con hilo + pigmentación con henna para cejas definidas.', 5),
        (v_complejo_id, 'Bigote con cera', 'Cejas y Pestañas', 20, 8000, 'Depilación delicada de bozo con cera tibia.', 6),
        (v_complejo_id, 'Bigote con hilo', 'Cejas y Pestañas', 20, 10000, 'Depilación de bozo con técnica de hilo sin irritación.', 7),
        (v_complejo_id, 'Laminado de cejas', 'Cejas y Pestañas', 60, 55000, 'Alisado, direccionamiento, diseño e hidratación profunda de cejas.', 8),
        (v_complejo_id, 'Lifting de pestañas', 'Cejas y Pestañas', 60, 55000, 'Realce y curvatura natural para tus pestañas con efecto alargador.', 9),
        (v_complejo_id, 'Pestañas pelo a pelo clásicas', 'Cejas y Pestañas', 120, 80000, 'Extensiones pelo a pelo clásicas. Retoque $40.000 (pasados los 20 días tiene un adicional de $5.000 a $10.000).', 10),
        (v_complejo_id, 'Pestañas pelo a pelo efecto pestañina', 'Cejas y Pestañas', 120, 80000, 'Extensiones con acabado definido tipo rímel. Retoque $45.000 (pasados los 20 días tiene un adicional de $5.000 a $10.000).', 11),
        (v_complejo_id, 'Pestañas híbridas', 'Cejas y Pestañas', 120, 100000, 'Combinación perfecta entre técnica clásica y abanicos de volumen. Retoque $50.000 (pasados los 20 días adicional de $5.000 a $10.000).', 12),
        (v_complejo_id, 'Pestañas 3D', 'Cejas y Pestañas', 120, 100000, 'Volumen tridimensional ligero y expresivo. Retoque $50.000 (pasados los 20 días tiene un adicional de $5.000 a $10.000).', 13),
        (v_complejo_id, 'Pestañas pelo a pelo volumen ruso', 'Cejas y Pestañas', 150, 110000, 'Máxima densidad y mirada impactante. Retoque $60.000 (pasados los 20 días tiene un adicional de $5.000 a $10.000).', 14),
        (v_complejo_id, 'Pestañas pelo a pelo volumen brasileño', 'Cejas y Pestañas', 120, 90000, 'Fibras en Y de alta retención y acabado tupido con textura suave.', 15),
        -- Uñas Tradicional y Semipermanente
        (v_complejo_id, 'Limpieza', 'Uñas Tradicional y Semi', 40, 13000, 'Limado, cuidado de cutícula, exfoliación e hidratación.', 16),
        (v_complejo_id, 'Manicura tradicional', 'Uñas Tradicional y Semi', 60, 18000, 'Limpieza completa de manos y esmaltado tradicional. Los diseños elaborados tienen tiempo y costo adicional.', 17),
        (v_complejo_id, 'Pedicura tradicional', 'Uñas Tradicional y Semi', 60, 18000, 'Limpieza profunda de pies, exfoliación y esmaltado tradicional.', 18),
        (v_complejo_id, 'Manicura semipermanente full', 'Uñas Tradicional y Semi', 90, 46000, 'Manicura rusa/combinada con nivelación y esmaltado semipermanente full. Los diseños elaborados tienen tiempo y costo adicional.', 19),
        (v_complejo_id, 'Manicura solo tono', 'Uñas Tradicional y Semi', 75, 39000, 'Limpieza + esmaltado semipermanente en tono liso uniforme.', 20),
        (v_complejo_id, 'Pedicura Semi', 'Uñas Tradicional y Semi', 80, 39000, 'Pedicura spa completa con esmaltado en gel semipermanente de larga duración.', 21),
        (v_complejo_id, 'Dipping + Semi', 'Uñas Tradicional y Semi', 90, 53000, 'Refuerzo en polvo Dipping sobre uña natural + acabado semipermanente.', 22),
        (v_complejo_id, 'Base Ruber', 'Uñas Tradicional y Semi', 90, 53000, 'Nivelación con base rubber fortalecedora + esmaltado semipermanente.', 23),
        -- Acrílico y Press On
        (v_complejo_id, 'Recubrimiento en acrílico', 'Acrílico y Press On', 120, 75000, 'Baño de acrílico protector sobre el largo de tu uña natural + esmaltado semipermanente.', 24),
        (v_complejo_id, 'Sistema Press On', 'Acrílico y Press On', 120, 75000, 'Extensión en tips de gel completo de acabado natural y ultraligero + semipermanente.', 25),
        (v_complejo_id, 'Acrílicas con tip', 'Acrílico y Press On', 120, 90000, 'Extensión en acrílico con tip + esmaltado semipermanente. Los diseños elaborados tienen tiempo y costo adicional.', 26),
        (v_complejo_id, 'Acrílicas esculpidas', 'Acrílico y Press On', 150, 100000, 'Estructura esculpida con molde a medida + esmaltado semipermanente. Los diseños elaborados tienen tiempo y costo adicional.', 27),
        (v_complejo_id, 'Retoque de acrílico o Press On', 'Acrílico y Press On', 120, 65000, 'Mantenimiento de crecimiento + semipermanente. Incluye una uña perdida (adicional: con tip $6.000, esculpida $8.000).', 28),
        -- Retiros y Adicionales
        (v_complejo_id, 'Retiro de acrílico definitivo', 'Retiros y Adicionales', 60, 15000, 'Retiro seguro de estructura acrílica o Press On cuidando la lámina natural.', 29),
        (v_complejo_id, 'Retiro definitivo semipermanente', 'Retiros y Adicionales', 30, 8000, 'Retiro cuidadoso de esmaltado semipermanente o base rubber.', 30),
        (v_complejo_id, 'Uña en semipermanente', 'Retiros y Adicionales', 20, 4000, 'Reparación o esmaltado individual de 1 uña en semipermanente.', 31),
        (v_complejo_id, 'Uña Press On o recubrimiento', 'Retiros y Adicionales', 20, 7000, 'Reposición individual de 1 uña en Press On o recubrimiento acrílico.', 32),
        (v_complejo_id, 'Uña acrílica con tip', 'Retiros y Adicionales', 25, 8000, 'Reposición individual de 1 uña acrílica con tip.', 33),
        (v_complejo_id, 'Uña esculpida', 'Retiros y Adicionales', 30, 10000, 'Reposición individual de 1 uña acrílica esculpida.', 34);

    -- 6.4 Insertar Preguntas Frecuentes (FAQs) para el Recepcionista IA
    DELETE FROM faqs WHERE complejo_id = v_complejo_id;
    INSERT INTO faqs (complejo_id, categoria, pregunta, respuesta, palabras_clave) VALUES
        (v_complejo_id, 'ubicacion', '¿Dónde están ubicados?', 'Estamos ubicados en Pereira, Colombia ✨. En nuestro perfil oficial de Instagram @opalo_nailspereira puedes ver nuestra ubicación exacta y referencias para llegar fácilmente.', ARRAY['ubicacion', 'direccion', 'donde', 'quedan', 'pereira', 'llegar', 'mapa']),
        (v_complejo_id, 'horarios', '¿Cuál es el horario de atención?', 'Atendemos de Lunes a Sábado de 8:00 AM a 7:00 PM con cita previa agendada por nuestra web o WhatsApp.', ARRAY['horario', 'abren', 'cierran', 'atencion', 'domingo', 'sabado', 'hora']),
        (v_complejo_id, 'precios_unas', '¿Qué servicios y precios tienen en uñas?', 'En Uñas manejamos: Limpieza ($13.000), Manicura o Pedicura tradicional ($18.000), Manicura solo tono ($39.000), Pedicura Semi ($39.000), Manicura semipermanente full ($46.000), Base Ruber o Dipping + Semi ($53.000), Recubrimiento en acrílico o Sistema Press On ($75.000), Acrílicas con tip ($90.000), Acrílicas esculpidas ($100.000) y Retoque ($65.000). Los diseños elaborados tienen tiempo y costo adicional 💅✨.', ARRAY['precio', 'precios', 'valor', 'cuanto', 'cuesta', 'unas', 'acrilicas', 'semipermanente', 'press on', 'rubber', 'pedicure', 'manicure']),
        (v_complejo_id, 'precios_cejas_pestanas', '¿Qué servicios y precios tienen en cejas y pestañas?', 'En Cejas y Pestañas ofrecemos: Depilación con cera ($15.000), Depilación con hilo ($20.000), Henna ($8.000), Cera y henna ($22.000), Hilo y henna ($16.000), Bigote con cera ($8.000) o hilo ($10.000), Laminado de cejas ($55.000), Lifting de pestañas ($55.000), Pestañas pelo a pelo clásicas o efecto pestañina ($80.000), Volumen brasileño ($90.000), Híbridas o 3D ($100.000) y Volumen ruso ($110.000) ✨👁️.', ARRAY['cejas', 'pestanas', 'lifting', 'laminado', 'pelo a pelo', 'volumen ruso', 'hibridas', '3d', 'henna', 'hilo', 'cera']),
        (v_complejo_id, 'pagos', '¿Qué medios de pago reciben?', 'Recibimos efectivo en el spa, transferencias por Nequi y Bancolombia.', ARRAY['pago', 'nequi', 'bancolombia', 'efectivo', 'transferencia', 'abono', 'anticipo']);
END $$;
