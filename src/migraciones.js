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
