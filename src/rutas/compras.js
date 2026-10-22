const express = require("express");
const pool = require("../db");
const { requiereJefe, leerId } = require("../autenticacion");

/* Compras y reposiciones de mercadería (solo el jefe).
   Al ingresar mercadería: se suma al stock, se recalcula el costo por unidad (promedio)
   y, según se elija, se registra como inversión o como gasto. */
const router = express.Router();

const CONTABILIZAR = ["inversion", "gasto", "ninguno"];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function descripcion(producto, cantidad, proveedor) {
    return `Compra: ${producto} × ${cantidad} u.${proveedor ? ` (${proveedor})` : ""}`.slice(0, 200);
}

router.get("/", requiereJefe, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT
                compras.id,
                compras.producto_id AS "productoId",
                productos.nombre || COALESCE(' · ' || compras.color, '') AS producto,
                productos.codigo,
                compras.cantidad,
                compras.costo_total AS "costoTotal",
                ROUND(compras.costo_total / compras.cantidad, 2) AS "costoUnitario",
                compras.proveedor,
                TO_CHAR(compras.fecha, 'YYYY-MM-DD') AS fecha,
                compras.contabilizar,
                COALESCE(usuarios.nombre, 'No registrado') AS "registradoPor"
             FROM compras
             INNER JOIN productos ON compras.producto_id = productos.id
             LEFT JOIN usuarios ON compras.usuario_id = usuarios.id
             ORDER BY compras.fecha DESC, compras.id DESC
             LIMIT 200`
        );
        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al consultar las compras:", error.message);
        res.status(500).json({ error: "No se pudieron consultar las compras." });
    }
});

router.post("/", requiereJefe, async (req, res) => {
    const { productoId, cantidad, costoTotal, proveedor = "", fecha, contabilizar = "inversion", colorId = null } = req.body ?? {};

    if (
        !Number.isInteger(productoId) || productoId <= 0 ||
        !Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 100000 ||
        typeof costoTotal !== "number" || !Number.isFinite(costoTotal) || costoTotal < 0 ||
        typeof proveedor !== "string" || proveedor.length > 120 ||
        typeof fecha !== "string" || !FECHA.test(fecha) || Number.isNaN(Date.parse(fecha)) ||
        !CONTABILIZAR.includes(contabilizar) ||
        (colorId !== null && (!Number.isInteger(colorId) || colorId <= 0))
    ) {
        return res.status(400).json({ error: "Revisa el producto, la cantidad, el costo, la fecha y cómo contabilizarlo." });
    }

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const fila = await client.query(
            `SELECT id, nombre, stock, stock_2025, precio_compra FROM productos WHERE id = $1 FOR UPDATE`,
            [productoId]
        );
        const producto = fila.rows[0];

        if (!producto) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "El producto no existe." });
        }

        // Si el producto tiene colores, la mercadería entra a uno de ellos.
        const filasColores = await client.query(
            `SELECT id, nombre FROM producto_colores WHERE producto_id = $1 FOR UPDATE`,
            [producto.id]
        );
        const color = filasColores.rows.find((c) => c.id === colorId) ?? null;

        if (filasColores.rows.length > 0 && !color) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: `Elige a qué color de ${producto.nombre} entra la mercadería.` });
        }

        if (color) {
            await client.query(`UPDATE producto_colores SET stock = stock + $1 WHERE id = $2`, [cantidad, color.id]);
        }

        // Costo promedio de la mercadería de este año (lo del 2025 no entra en el cálculo).
        // Si no tenía costo registrado, no se mezcla un S/ 0 inventado: vale el de esta compra.
        const nuevas = producto.precio_compra === null ? 0 : Math.max(producto.stock - producto.stock_2025, 0);
        const costoActual = Number(producto.precio_compra ?? 0);
        const costoPromedio = (nuevas * costoActual + costoTotal) / (nuevas + cantidad);

        await client.query(
            `UPDATE productos SET stock = stock + $1, precio_compra = $2 WHERE id = $3`,
            [cantidad, Number(costoPromedio.toFixed(2)), producto.id]
        );

        // Se registra como inversión o gasto (si costó algo).
        let gastoId = null;
        let inversionId = null;
        const texto = descripcion(color ? `${producto.nombre} · ${color.nombre}` : producto.nombre, cantidad, proveedor.trim());

        if (costoTotal > 0 && contabilizar === "gasto") {
            const gasto = await client.query(
                `INSERT INTO gastos (descripcion, categoria, monto, fecha, usuario_id)
                 VALUES ($1, 'Mercadería', $2, $3, $4) RETURNING id`,
                [texto, Number(costoTotal.toFixed(2)), fecha, req.session.usuario.id]
            );
            gastoId = gasto.rows[0].id;
        }

        if (costoTotal > 0 && contabilizar === "inversion") {
            const inversion = await client.query(
                `INSERT INTO inversiones (descripcion, monto, fecha, usuario_id)
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [texto, Number(costoTotal.toFixed(2)), fecha, req.session.usuario.id]
            );
            inversionId = inversion.rows[0].id;
        }

        const compra = await client.query(
            `INSERT INTO compras (producto_id, cantidad, costo_total, proveedor, fecha, contabilizar,
                                  gasto_id, inversion_id, usuario_id, color_id, color)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
            [producto.id, cantidad, Number(costoTotal.toFixed(2)), proveedor.trim() || null, fecha,
             contabilizar, gastoId, inversionId, req.session.usuario.id, color?.id ?? null, color?.nombre ?? null]
        );

        await client.query("COMMIT");

        res.status(201).json({
            mensaje: `Se ingresaron ${cantidad} unidades de ${producto.nombre}${color ? ` (${color.nombre})` : ""}.`,
            id: compra.rows[0].id,
            stock: producto.stock + cantidad,
            costoUnitario: costoPromedio.toFixed(2)
        });
    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        console.error("Error al registrar la compra:", error.message);
        res.status(500).json({ error: "No se pudo registrar la compra." });
    } finally {
        client?.release();
    }
});

// Deshacer una compra (por error al registrarla): se quitan las unidades y su gasto o inversión.
router.delete("/:id", requiereJefe, async (req, res) => {
    const id = leerId(req);
    if (!id) return res.status(400).json({ error: "Compra inválida." });

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const fila = await client.query(`SELECT * FROM compras WHERE id = $1 FOR UPDATE`, [id]);
        const compra = fila.rows[0];

        if (!compra) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Compra no encontrada." });
        }

        const prod = await client.query(
            `SELECT stock, stock_2025, precio_compra FROM productos WHERE id = $1 FOR UPDATE`,
            [compra.producto_id]
        );
        const producto = prod.rows[0];
        const nuevas = producto.stock - producto.stock_2025;

        if (nuevas < compra.cantidad) {
            await client.query("ROLLBACK");
            return res.status(409).json({
                error: `No se puede deshacer: ya se vendió parte de esa mercadería (quedan ${Math.max(nuevas, 0)} u. nuevas).`
            });
        }

        if (compra.color_id) {
            const color = await client.query(`SELECT stock FROM producto_colores WHERE id = $1 FOR UPDATE`, [compra.color_id]);

            if (color.rows.length > 0 && color.rows[0].stock < compra.cantidad) {
                await client.query("ROLLBACK");
                return res.status(409).json({
                    error: `No se puede deshacer: ya se vendió parte de ese color (quedan ${color.rows[0].stock} u.).`
                });
            }

            await client.query(`UPDATE producto_colores SET stock = stock - $1 WHERE id = $2`, [compra.cantidad, compra.color_id]);
        }

        // Se quita la compra del costo promedio.
        const restantes = nuevas - compra.cantidad;
        const costo = restantes > 0
            ? Math.max((nuevas * Number(producto.precio_compra) - Number(compra.costo_total)) / restantes, 0)
            : Number(producto.precio_compra);

        await client.query(
            `UPDATE productos SET stock = stock - $1, precio_compra = $2 WHERE id = $3`,
            [compra.cantidad, Number(costo.toFixed(2)), compra.producto_id]
        );

        await client.query(`DELETE FROM compras WHERE id = $1`, [id]);
        if (compra.gasto_id) await client.query(`DELETE FROM gastos WHERE id = $1`, [compra.gasto_id]);
        if (compra.inversion_id) await client.query(`DELETE FROM inversiones WHERE id = $1`, [compra.inversion_id]);

        await client.query("COMMIT");
        res.json({ mensaje: "Compra eliminada y stock corregido." });
    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        console.error("Error al eliminar la compra:", error.message);
        res.status(500).json({ error: "No se pudo eliminar la compra." });
    } finally {
        client?.release();
    }
});

module.exports = router;
