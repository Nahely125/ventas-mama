const pool = require("./db");

// Cambios de estructura de la base de datos.
// Solo agregan columnas/tablas y se pueden ejecutar varias veces sin problema.
const MIGRACIONES = `
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS codigo VARCHAR(50);
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_docena NUMERIC(10, 2);

    UPDATE productos
    SET precio_docena = precio_minimo * 12
    WHERE precio_docena IS NULL;

    ALTER TABLE productos ALTER COLUMN precio_docena SET NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS productos_codigo_unico
        ON productos (LOWER(codigo))
        WHERE codigo IS NOT NULL;

    ALTER TABLE ventas
        ADD COLUMN IF NOT EXISTS modalidad VARCHAR(10) NOT NULL DEFAULT 'unidad';

    -- Foto del producto (se guarda comprimida en la base de datos).
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS foto BYTEA;
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS foto_tipo VARCHAR(30);
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS foto_actualizada TIMESTAMP;

    -- Clave aleatoria para el enlace público de cada boleta (no se puede adivinar).
    ALTER TABLE ventas
        ADD COLUMN IF NOT EXISTS token UUID NOT NULL DEFAULT gen_random_uuid();
    CREATE UNIQUE INDEX IF NOT EXISTS ventas_token_unico ON ventas (token);

    -- Secciones del catálogo (ferias). tema define los colores del banner.
    CREATE TABLE IF NOT EXISTS secciones (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(80) NOT NULL UNIQUE,
        descripcion VARCHAR(200),
        tema VARCHAR(20) NOT NULL DEFAULT 'general',
        visible BOOLEAN NOT NULL DEFAULT TRUE,
        orden INTEGER NOT NULL DEFAULT 0,
        creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Secciones iniciales: solo la primera vez (si la tabla está vacía).
    INSERT INTO secciones (nombre, descripcion, tema, visible, orden)
    SELECT * FROM (VALUES
        ('Feria Navideña', 'Adornos, regalos y todo para decorar tu Navidad.', 'navidad', TRUE, 1),
        ('Feria Escolar', 'Útiles y todo lo necesario para el regreso a clases.', 'escolar', FALSE, 2)
    ) AS iniciales (nombre, descripcion, tema, visible, orden)
    WHERE NOT EXISTS (SELECT 1 FROM secciones);

    ALTER TABLE productos
        ADD COLUMN IF NOT EXISTS seccion_id INTEGER REFERENCES secciones(id) ON DELETE SET NULL;

    -- Acelera los filtros del historial por día y mes.
    CREATE INDEX IF NOT EXISTS ventas_fecha_idx ON ventas (fecha);

    CREATE TABLE IF NOT EXISTS gastos (
        id SERIAL PRIMARY KEY,
        descripcion VARCHAR(200) NOT NULL,
        categoria VARCHAR(50) NOT NULL,
        monto NUMERIC(10, 2) NOT NULL CHECK (monto > 0),
        fecha DATE NOT NULL,
        usuario_id INTEGER REFERENCES usuarios(id),
        creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inversiones (
        id SERIAL PRIMARY KEY,
        descripcion VARCHAR(200) NOT NULL,
        monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
        fecha DATE NOT NULL,
        usuario_id INTEGER REFERENCES usuarios(id),
        creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`;

async function ejecutarMigraciones() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        await client.query(MIGRACIONES);
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

module.exports = ejecutarMigraciones;
