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

    -- Categorías dentro de cada sección (por ejemplo, "Árboles y pinos" en la Feria Navideña).
    CREATE TABLE IF NOT EXISTS categorias (
        id SERIAL PRIMARY KEY,
        seccion_id INTEGER NOT NULL REFERENCES secciones(id) ON DELETE CASCADE,
        nombre VARCHAR(60) NOT NULL,
        icono VARCHAR(16),
        orden INTEGER NOT NULL DEFAULT 0,
        UNIQUE (seccion_id, nombre)
    );

    ALTER TABLE productos
        ADD COLUMN IF NOT EXISTS categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL;

    -- Precio mínimo por docena propio (antes se usaba precio mínimo × 12).
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_minimo_docena NUMERIC(10, 2);
    UPDATE productos SET precio_minimo_docena = precio_minimo * 12 WHERE precio_minimo_docena IS NULL;
    ALTER TABLE productos ALTER COLUMN precio_minimo_docena SET NOT NULL;

    -- Mercadería del año pasado (2025): unidades del stock que ya se pagaron.
    -- Al vender se descuentan primero; todo lo que se cobra por ellas es ganancia neta
    -- y no se usa para recuperar la inversión de este año.
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_2025 INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS unidades_2025 INTEGER NOT NULL DEFAULT 0;

    -- Ventas anuladas (las anula el jefe): se conservan, pero no cuentan en totales ni ganancias.
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS anulada_en TIMESTAMP;
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS anulada_por INTEGER REFERENCES usuarios(id);
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS motivo_anulacion VARCHAR(200);

    -- Clientes frecuentes y ventas fiadas (a crédito).
    CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        telefono VARCHAR(20),
        notas VARCHAR(200),
        creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS clientes_telefono_unico ON clientes (telefono) WHERE telefono IS NOT NULL;

    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clientes(id);

    -- Ajuste (descuento con código del jefe) repartido entre los productos, y obsequios (precio 0).
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS descuento NUMERIC(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS codigo_ajuste VARCHAR(20);
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS obsequio BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE INDEX IF NOT EXISTS ventas_cliente_idx ON ventas (cliente_id);

    -- Pagos a cuenta de lo que debe un cliente.
    CREATE TABLE IF NOT EXISTS abonos (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
        monto NUMERIC(10, 2) NOT NULL CHECK (monto > 0),
        metodo_pago VARCHAR(20) NOT NULL DEFAULT 'efectivo',
        nota VARCHAR(200),
        fecha TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima'),
        usuario_id INTEGER REFERENCES usuarios(id)
    );

    -- Códigos de ajuste que registra el jefe (monto NULL = monto libre al vender).
    CREATE TABLE IF NOT EXISTS codigos_ajuste (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(20) NOT NULL UNIQUE,
        descripcion VARCHAR(100),
        monto NUMERIC(10, 2) CHECK (monto IS NULL OR monto > 0),
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Compras y reposiciones de mercadería.
    CREATE TABLE IF NOT EXISTS compras (
        id SERIAL PRIMARY KEY,
        producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
        cantidad INTEGER NOT NULL CHECK (cantidad > 0),
        costo_total NUMERIC(12, 2) NOT NULL CHECK (costo_total >= 0),
        proveedor VARCHAR(120),
        fecha DATE NOT NULL,
        contabilizar VARCHAR(12) NOT NULL DEFAULT 'inversion',
        gasto_id INTEGER REFERENCES gastos(id) ON DELETE SET NULL,
        inversion_id INTEGER REFERENCES inversiones(id) ON DELETE SET NULL,
        usuario_id INTEGER REFERENCES usuarios(id),
        creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- El precio mínimo solo limita a los empleados al vender: el jefe puede fijar cualquier precio.
    ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_check;

    -- Registro de los cambios de datos que solo deben hacerse una vez.
    CREATE TABLE IF NOT EXISTS migraciones_unicas (
        nombre VARCHAR(100) PRIMARY KEY,
        aplicada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`;

const { CATEGORIAS_NAVIDAD, CATEGORIAS_ESCOLAR, PRIORIDAD_NAVIDAD } = require("./categoriasIniciales");

// Crea las categorías de una sección (si no existen) y devuelve { nombre: id }.
async function crearCategorias(client, seccionId, categorias) {
    const ids = {};

    for (const [indice, categoria] of categorias.entries()) {
        const fila = await client.query(
            `INSERT INTO categorias (seccion_id, nombre, icono, orden)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (seccion_id, nombre) DO UPDATE SET nombre = EXCLUDED.nombre
             RETURNING id`,
            [seccionId, categoria.nombre, categoria.icono, indice + 1]
        );
        ids[categoria.nombre] = fila.rows[0].id;
    }

    return ids;
}

// Asigna categoría según el nombre a los productos que aún no tienen una.
async function asignarPorNombre(client, condicionProductos, parametros, reglas, ids) {
    for (const regla of reglas) {
        await client.query(
            `UPDATE productos
             SET categoria_id = $${parametros.length + 1}
             WHERE categoria_id IS NULL AND nombre ~* $${parametros.length + 2} AND (${condicionProductos})`,
            [...parametros, ids[regla.nombre], regla.patron]
        );
    }
}

/* Cambios de datos que se aplican UNA sola vez (quedan anotados en migraciones_unicas).
   Así, si luego se borra o cambia algo a mano, no vuelve a aparecer. */
const MIGRACIONES_UNICAS = [
    {
        // Los códigos que antes estaban fijos pasan a la tabla: el jefe puede editarlos o borrarlos.
        nombre: "2026-10-codigos-ajuste-iniciales",
        async aplicar(client) {
            await client.query(
                `INSERT INTO codigos_ajuste (codigo, descripcion, monto) VALUES
                    ('AJUSTE10', 'Descuento de S/ 10', 10),
                    ('AJUSTE20', 'Descuento de S/ 20', 20),
                    ('AJUSTE PROPIO', 'El empleado escribe el monto', NULL)
                 ON CONFLICT (codigo) DO NOTHING`
            );
        }
    },
    {
        nombre: "2026-10-categorias-ferias",
        async aplicar(client) {
            const navidad = (await client.query(
                `SELECT id FROM secciones WHERE tema = 'navidad' AND nombre !~* '[aá]rbol' ORDER BY orden LIMIT 1`
            )).rows[0];
            const escolar = (await client.query(
                `SELECT id FROM secciones WHERE tema = 'escolar' ORDER BY orden LIMIT 1`
            )).rows[0];

            if (navidad) {
                const ids = await crearCategorias(client, navidad.id, CATEGORIAS_NAVIDAD);

                // Si existe una sección suelta de árboles (versión anterior), sus productos pasan
                // a la Feria Navideña, categoría "Árboles y pinos", y la sección se elimina.
                const arboles = await client.query(`SELECT id FROM secciones WHERE nombre ~* '[aá]rbol'`);

                for (const seccion of arboles.rows) {
                    await client.query(
                        `UPDATE productos SET seccion_id = $1, categoria_id = $2 WHERE seccion_id = $3`,
                        [navidad.id, ids["Árboles y pinos"], seccion.id]
                    );
                    await client.query(`DELETE FROM secciones WHERE id = $1`, [seccion.id]);
                }

                // Productos navideños o sin sección: se acomodan por su nombre.
                const reglas = PRIORIDAD_NAVIDAD.map((nombre) => CATEGORIAS_NAVIDAD.find((c) => c.nombre === nombre));
                await asignarPorNombre(
                    client,
                    "seccion_id IS NULL OR seccion_id = $1",
                    [navidad.id],
                    reglas,
                    ids
                );
                await client.query(
                    `UPDATE productos SET seccion_id = $1 WHERE seccion_id IS NULL AND categoria_id IS NOT NULL`,
                    [navidad.id]
                );
            }

            if (escolar) {
                const ids = await crearCategorias(client, escolar.id, CATEGORIAS_ESCOLAR);
                await asignarPorNombre(client, "seccion_id = $1", [escolar.id], CATEGORIAS_ESCOLAR, ids);
            }
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
