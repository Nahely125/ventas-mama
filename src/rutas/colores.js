/* Colores de un producto (opcional): cada color tiene su propio stock y el stock del producto es
   la suma. Si un producto no tiene colores, todo funciona como siempre (solo con su stock). */

const MAXIMO_COLORES = 30;

// Lista de colores de un producto como JSON: [{ id, nombre, stock }] (SQL sobre la tabla productos).
const COLORES_JSON = `COALESCE((
    SELECT JSON_AGG(JSON_BUILD_OBJECT('id', pc.id, 'nombre', pc.nombre, 'stock', pc.stock) ORDER BY pc.orden, pc.id)
    FROM producto_colores pc
    WHERE pc.producto_id = productos.id
), '[]')`;

/* Valida los colores que llegan del formulario: null o [] = sin colores;
   si no, [{ id?, nombre, stock }]. Devuelve { colores } (null o la lista limpia) o { error }. */
function validarColores(colores) {
    if (colores === undefined || colores === null || (Array.isArray(colores) && colores.length === 0)) {
        return { colores: null };
    }

    if (!Array.isArray(colores) || colores.length > MAXIMO_COLORES) {
        return { error: `Agrega entre 1 y ${MAXIMO_COLORES} colores.` };
    }

    const limpios = [];
    const nombres = new Set();

    for (const color of colores) {
        const nombre = typeof color?.nombre === "string" ? color.nombre.trim().replace(/\s+/g, " ") : "";

        if (!nombre || nombre.length > 40) {
            return { error: "Cada color necesita un nombre (máximo 40 caracteres)." };
        }

        if (!Number.isInteger(color.stock) || color.stock < 0 || color.stock > 1000000) {
            return { error: `La cantidad del color ${nombre} debe ser un número entero de 0 o más.` };
        }

        if (color.id !== undefined && color.id !== null && (!Number.isInteger(color.id) || color.id <= 0)) {
            return { error: "Uno de los colores no es válido." };
        }

        if (nombres.has(nombre.toLowerCase())) {
            return { error: `El color ${nombre} está repetido.` };
        }

        nombres.add(nombre.toLowerCase());
        limpios.push({ id: color.id ?? null, nombre, stock: color.stock });
    }

    return { colores: limpios };
}

/* Guarda los colores de un producto dentro de una transacción: actualiza los que ya existían
   (por id), agrega los nuevos y quita los que ya no están. Con null quita todos.
   Las ventas guardan el nombre del color, así que quitar uno no cambia el historial. */
async function guardarColores(client, productoId, colores) {
    const existentes = await client.query(
        `SELECT id FROM producto_colores WHERE producto_id = $1 FOR UPDATE`,
        [productoId]
    );
    const ids = new Set(existentes.rows.map((fila) => fila.id));
    const quedan = new Set((colores ?? []).filter((c) => c.id && ids.has(c.id)).map((c) => c.id));

    const quitar = [...ids].filter((id) => !quedan.has(id));
    if (quitar.length > 0) {
        await client.query(`DELETE FROM producto_colores WHERE id = ANY($1::int[])`, [quitar]);
    }

    for (const [orden, color] of (colores ?? []).entries()) {
        if (color.id && ids.has(color.id)) {
            await client.query(
                `UPDATE producto_colores SET nombre = $1, stock = $2, orden = $3 WHERE id = $4`,
                [color.nombre, color.stock, orden, color.id]
            );
        } else {
            await client.query(
                `INSERT INTO producto_colores (producto_id, nombre, stock, orden) VALUES ($1, $2, $3, $4)`,
                [productoId, color.nombre, color.stock, orden]
            );
        }
    }
}

module.exports = { COLORES_JSON, validarColores, guardarColores };
