const express = require("express");
const pool = require("../db");
const { requiereJefe, leerId } = require("../autenticacion");
const { STOCK_ALERTA } = require("./productos");
const { registrarCompra, ErrorCompra } = require("./compras");

/* Lista de reposición (solo el jefe): productos por comprar, con cuánto y a qué costo.
   Muestra cuánto costaría comprar lo marcado. Al marcar "Se adquirió", se registra como
   una compra normal (stock nuevo + inversión) y sale de la lista. */
const router = express.Router();
router.use(requiereJefe);

const CONTABILIZAR = ["inversion", "gasto", "ninguno"];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Fecha de hoy en Lima (YYYY-MM-DD).
const hoyLima = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });

const COLUMNAS = `
    reposicion.id,
    reposicion.producto_id AS "productoId",
    productos.nombre,
    productos.codigo,
    productos.stock,
    productos.unidades_por_caja AS "unidadesPorCaja",
    reposicion.color_id AS "colorId",
    producto_colores.nombre AS color,
    producto_colores.stock AS "stockColor",
    reposicion.cantidad,
    -- Si no se escribió un costo, vale el costo actual del producto.
    COALESCE(reposicion.costo_unitario, productos.precio_compra) AS "costoUnitario",
    reposicion.costo_unitario IS NOT NULL AS "costoPropio",
    reposicion.comprar,
    (SELECT COALESCE(json_agg(json_build_object('id', c.id, 'nombre', c.nombre, 'stock', c.stock) ORDER BY c.orden, c.id), '[]'::json)
     FROM producto_colores c WHERE c.producto_id = productos.id) AS colores,
    (SELECT COALESCE(SUM(ventas.cantidad), 0) FROM ventas
     WHERE ventas.producto_id = productos.id AND ventas.anulada_en IS NULL
       AND ventas.fecha >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::DATE - 29)::INT AS "vendidas30"
`;

async function leerLista(consulta = pool) {
    const [items, sugerencias] = await Promise.all([
        consulta.query(
            `SELECT ${COLUMNAS}
             FROM reposicion
             INNER JOIN productos ON productos.id = reposicion.producto_id
             LEFT JOIN producto_colores ON producto_colores.id = reposicion.color_id
             ORDER BY reposicion.comprar DESC, productos.stock ASC, productos.nombre, producto_colores.nombre`
        ),
        consulta.query(
            `SELECT COUNT(*)::INT AS total FROM productos
             WHERE stock < $1 AND NOT EXISTS (SELECT 1 FROM reposicion WHERE reposicion.producto_id = productos.id)`,
            [STOCK_ALERTA]
        )
    ]);

    const marcados = items.rows.filter((i) => i.comprar);
    return {
        items: items.rows,
        sugerencias: sugerencias.rows[0].total,
        stockAlerta: STOCK_ALERTA,
        totales: {
            productos: marcados.length,
            unidades: marcados.reduce((suma, i) => suma + i.cantidad, 0),
            costo: marcados.reduce((suma, i) => suma + i.cantidad * Number(i.costoUnitario ?? 0), 0).toFixed(2),
            sinCosto: marcados.filter((i) => i.costoUnitario === null).length
        }
    };
}

// Cantidad sugerida: una caja si se compra por caja; si no, lo que falta para llegar a 12.
function cantidadSugerida(producto) {
    return producto.unidades_por_caja > 1 ? producto.unidades_por_caja : Math.max(12 - producto.stock, 1);
}

const esCantidad = (valor) => Number.isInteger(valor) && valor > 0 && valor <= 100000;
const esCosto = (valor) => valor === null || (typeof valor === "number" && Number.isFinite(valor) && valor >= 0 && valor <= 1000000);

router.get("/", async (req, res) => {
    try {
        res.json(await leerLista());
    } catch (error) {
        console.error("Error al leer la lista de reposición:", error.message);
        res.status(500).json({ error: "No se pudo cargar la lista de reposición." });
    }
});

// Agregar un producto (o un color de un producto). Si ya estaba, se actualiza la cantidad.
router.post("/", async (req, res) => {
    const { productoId, colorId = null, cantidad = null, costoUnitario = null } = req.body ?? {};

    if (!Number.isInteger(productoId) || (colorId !== null && !Number.isInteger(colorId)) ||
        (cantidad !== null && !esCantidad(cantidad)) || !esCosto(costoUnitario)) {
        return res.status(400).json({ error: "Revisa el producto, la cantidad y el costo." });
    }

    try {
        const fila = await pool.query(`SELECT id, stock, unidades_por_caja FROM productos WHERE id = $1`, [productoId]);
        const producto = fila.rows[0];

        if (!producto) {
            return res.status(404).json({ error: "El producto no existe." });
        }

        if (colorId !== null) {
            const color = await pool.query(`SELECT 1 FROM producto_colores WHERE id = $1 AND producto_id = $2`, [colorId, productoId]);
            if (color.rows.length === 0) {
                return res.status(400).json({ error: "Ese color no es de este producto." });
            }
        }

        await pool.query(
            `INSERT INTO reposicion (producto_id, color_id, cantidad, costo_unitario, usuario_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (producto_id, (COALESCE(color_id, 0)))
             DO UPDATE SET cantidad = EXCLUDED.cantidad, comprar = TRUE,
                           costo_unitario = COALESCE(EXCLUDED.costo_unitario, reposicion.costo_unitario)`,
            [productoId, colorId, cantidad ?? cantidadSugerida(producto), costoUnitario, req.session.usuario.id]
        );

        res.status(201).json({ mensaje: "Agregado a la lista de reposición.", ...(await leerLista()) });
    } catch (error) {
        console.error("Error al agregar a la reposición:", error.message);
        res.status(500).json({ error: "No se pudo agregar a la lista." });
    }
});

// Agregar de una vez todos los productos con poco stock (menos de STOCK_ALERTA) que aún no están.
router.post("/sugerir", async (req, res) => {
    try {
        const resultado = await pool.query(
            `INSERT INTO reposicion (producto_id, cantidad, usuario_id)
             SELECT id, CASE WHEN unidades_por_caja > 1 THEN unidades_por_caja ELSE GREATEST(12 - stock, 1) END, $2
             FROM productos
             WHERE stock < $1 AND NOT EXISTS (SELECT 1 FROM reposicion WHERE reposicion.producto_id = productos.id)
             ON CONFLICT DO NOTHING`,
            [STOCK_ALERTA, req.session.usuario.id]
        );

        res.json({
            mensaje: resultado.rowCount === 0
                ? "No hay productos nuevos con poco stock para agregar."
                : `Se agregaron ${resultado.rowCount} ${resultado.rowCount === 1 ? "producto" : "productos"} con poco stock.`,
            ...(await leerLista())
        });
    } catch (error) {
        console.error("Error al sugerir la reposición:", error.message);
        res.status(500).json({ error: "No se pudieron agregar los productos con poco stock." });
    }
});

// Cambiar cantidad, costo, color o si se va a comprar ("comprar": false = no se adquirirá por ahora).
router.put("/:id", async (req, res) => {
    const id = leerId(req);
    const cambios = req.body ?? {};

    if (!id) return res.status(400).json({ error: "Elemento inválido." });

    if (("cantidad" in cambios && !esCantidad(cambios.cantidad)) ||
        ("costoUnitario" in cambios && !esCosto(cambios.costoUnitario)) ||
        ("comprar" in cambios && typeof cambios.comprar !== "boolean") ||
        ("colorId" in cambios && cambios.colorId !== null && !Number.isInteger(cambios.colorId))) {
        return res.status(400).json({ error: "Revisa la cantidad, el costo o el color." });
    }

    try {
        const actual = await pool.query(`SELECT * FROM reposicion WHERE id = $1`, [id]);
        const fila = actual.rows[0];

        if (!fila) return res.status(404).json({ error: "Ese producto ya no está en la lista." });

        if ("colorId" in cambios && cambios.colorId !== null) {
            const color = await pool.query(`SELECT 1 FROM producto_colores WHERE id = $1 AND producto_id = $2`, [cambios.colorId, fila.producto_id]);
            if (color.rows.length === 0) return res.status(400).json({ error: "Ese color no es de este producto." });
        }

        await pool.query(
            `UPDATE reposicion SET cantidad = $1, costo_unitario = $2, comprar = $3, color_id = $4 WHERE id = $5`,
            [
                cambios.cantidad ?? fila.cantidad,
                "costoUnitario" in cambios ? cambios.costoUnitario : fila.costo_unitario,
                cambios.comprar ?? fila.comprar,
                "colorId" in cambios ? cambios.colorId : fila.color_id,
                id
            ]
        );

        res.json(await leerLista());
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ error: "Ese color ya está en la lista." });
        }
        console.error("Error al cambiar la reposición:", error.message);
        res.status(500).json({ error: "No se pudo guardar el cambio." });
    }
});

router.delete("/:id", async (req, res) => {
    const id = leerId(req);
    if (!id) return res.status(400).json({ error: "Elemento inválido." });

    try {
        await pool.query(`DELETE FROM reposicion WHERE id = $1`, [id]);
        res.json(await leerLista());
    } catch (error) {
        console.error("Error al quitar de la reposición:", error.message);
        res.status(500).json({ error: "No se pudo quitar de la lista." });
    }
});

/* "Se adquirieron": { ids, proveedor, fecha, contabilizar }. Cada producto entra como una compra
   (stock nuevo + inversión, o gasto) con su cantidad y costo, y sale de la lista.
   Si uno falla (por ejemplo, falta elegir el color), no se registra ninguno. */
router.post("/adquirir", async (req, res) => {
    const { ids, proveedor = "", fecha = hoyLima(), contabilizar = "inversion" } = req.body ?? {};

    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every((i) => Number.isInteger(i) && i > 0) ||
        typeof proveedor !== "string" || proveedor.length > 120 || !FECHA.test(fecha) || !CONTABILIZAR.includes(contabilizar)) {
        return res.status(400).json({ error: "Elige los productos adquiridos y revisa la fecha y el proveedor." });
    }

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const filas = await client.query(
            `SELECT reposicion.*, productos.nombre, productos.precio_compra
             FROM reposicion INNER JOIN productos ON productos.id = reposicion.producto_id
             WHERE reposicion.id = ANY($1::int[])
             FOR UPDATE OF reposicion`,
            [ids]
        );

        if (filas.rows.length !== new Set(ids).size) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Algunos productos ya no están en la lista. Recarga la página." });
        }

        const compras = [];
        let total = 0;

        for (const fila of filas.rows) {
            const costo = Number(fila.costo_unitario ?? fila.precio_compra ?? 0);
            const costoTotal = Number((costo * fila.cantidad).toFixed(4));

            try {
                compras.push(await registrarCompra(client, {
                    productoId: fila.producto_id,
                    colorId: fila.color_id,
                    cantidad: fila.cantidad,
                    costoTotal,
                    proveedor,
                    fecha,
                    contabilizar,
                    detalle: "Reposición adquirida"
                }, req.session.usuario.id));
            } catch (error) {
                if (error instanceof ErrorCompra) {
                    await client.query("ROLLBACK");
                    return res.status(error.estado).json({ error: `${fila.nombre}: ${error.message}` });
                }
                throw error;
            }

            total += costoTotal;
        }

        await client.query(`DELETE FROM reposicion WHERE id = ANY($1::int[])`, [ids]);
        await client.query("COMMIT");

        res.json({
            mensaje: `${compras.length === 1 ? "Se registró 1 producto adquirido" : `Se registraron ${compras.length} productos adquiridos`} por S/ ${total.toFixed(2)}`
                + (contabilizar === "inversion" ? " (como inversión)." : contabilizar === "gasto" ? " (como gasto)." : "."),
            compras,
            ...(await leerLista())
        });
    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        console.error("Error al registrar la reposición:", error.message);
        res.status(500).json({ error: "No se pudo registrar la compra de la reposición." });
    } finally {
        client?.release();
    }
});

module.exports = router;
