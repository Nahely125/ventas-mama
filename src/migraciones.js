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

    -- Ventas con varios productos: cada producto es una fila y todas las filas de la
    -- misma venta comparten "grupo" (que también es la clave del enlace de la boleta).
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS grupo UUID;
    UPDATE ventas SET grupo = token WHERE grupo IS NULL;
    ALTER TABLE ventas ALTER COLUMN grupo SET NOT NULL;
    CREATE INDEX IF NOT EXISTS ventas_grupo_idx ON ventas (grupo);

    -- Jefe que autorizó vender por debajo del precio mínimo (NULL si no hizo falta).
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS autorizado_por INTEGER REFERENCES usuarios(id);

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

    -- Registro de los cambios de datos que solo deben hacerse una vez.
    CREATE TABLE IF NOT EXISTS migraciones_unicas (
        nombre VARCHAR(100) PRIMARY KEY,
        aplicada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`;

// Nombres que empiezan con "Árbol"/"Arbol" (así "Estrella para árbol" no cuenta como árbol).
const PATRON_ARBOL = "^\\s*[aáAÁ]rbol";

/* Cambios de datos que se aplican UNA sola vez (quedan anotados en migraciones_unicas).
   Así, si luego se borra o cambia algo a mano, no vuelve a aparecer. */
const MIGRACIONES_UNICAS = [
    {
        nombre: "2026-10-seccion-arboles",
        async aplicar(client) {
            const existente = await client.query(
                `SELECT id FROM secciones WHERE nombre ~* $1 LIMIT 1`,
                ["[aá]rbol"]
            );

            let seccionId = existente.rows[0]?.id;

            if (!seccionId) {
                // Se ubica justo después de la Feria Navideña.
                const navidad = await client.query(
                    `SELECT orden FROM secciones WHERE tema = 'navidad' ORDER BY orden LIMIT 1`
                );
                const base = navidad.rows[0]?.orden ?? 0;

                await client.query(`UPDATE secciones SET orden = orden + 1 WHERE orden > $1`, [base]);

                const creada = await client.query(
                    `INSERT INTO secciones (nombre, descripcion, tema, visible, orden)
                     VALUES ('Árboles de Navidad', 'Árboles navideños de todos los tamaños.', 'navidad', TRUE, $1)
                     RETURNING id`,
                    [base + 1]
                );
                seccionId = creada.rows[0].id;
            }

            await client.query(
                `UPDATE productos SET seccion_id = $1 WHERE nombre ~* $2`,
                [seccionId, PATRON_ARBOL]
            );
        }
    }
];

async function ejecutarMigraciones() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        await client.query(MIGRACIONES);

        for (const migracion of MIGRACIONES_UNICAS) {
            const aplicada = await client.query(
                `SELECT 1 FROM migraciones_unicas WHERE nombre = $1`,
                [migracion.nombre]
            );

            if (aplicada.rows.length === 0) {
                await migracion.aplicar(client);
                await client.query(`INSERT INTO migraciones_unicas (nombre) VALUES ($1)`, [migracion.nombre]);
                console.log(`Cambio de datos aplicado: ${migracion.nombre}`);
            }
        }

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

module.exports = ejecutarMigraciones;
