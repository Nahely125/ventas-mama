const express = require("express");
const pool = require("../db");
const { requiereSesion } = require("../autenticacion");

const router = express.Router();

const METODOS_PAGO = ["efectivo", "yape", "plin", "transferencia"];
const MODALIDADES = ["unidad", "docena"];

// Consulta las ventas con los datos necesarios para el historial y el comprobante.
async function consultarVentas(esJefe, ventaId = null) {
    const resultado = await pool.query(
        `SELECT
            ventas.id,
            TO_CHAR(ventas.fecha, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha,
            productos.nombre AS producto,
            productos.codigo,
            ventas.modalidad,
            ventas.cantidad,
            ventas.precio_unitario AS "precioUnitario",
            ventas.total,
            ventas.metodo_pago AS "metodoPago",
            COALESCE(usuarios.nombre, 'No registrado') AS vendedor
            ${esJefe ? `,
            ventas.costo_unitario AS "costoUnitario",
            CASE
                WHEN ventas.costo_unitario IS NOT NULL
                THEN ROUND(ventas.total - ventas.costo_unitario * ventas.cantidad, 2)
            END AS ganancia` : ""}
         FROM ventas
         INNER JOIN productos ON ventas.producto_id = productos.id
         LEFT JOIN usuarios ON ventas.usuario_id = usuarios.id
         ${ventaId ? "WHERE ventas.id = $1" : ""}
         ORDER BY ventas.fecha DESC, ventas.id DESC`,
        ventaId ? [ventaId] : []
    );

    return resultado.rows;
}

/* Registrar una venta.
   cantidad: número de unidades o de docenas, según la modalidad.
   precio: precio por unidad o por docena; puede ajustarse, pero nunca por debajo del mínimo. */
router.post("/", requiereSesion, async (req, res) => {
    const { productoId, cantidad, modalidad = "unidad", precio, metodoPago = "efectivo" } = req.body;

    if (
        !Number.isInteger(productoId) ||
        productoId <= 0 ||
        !Number.isInteger(cantidad) ||
        cantidad <= 0 ||
        !MODALIDADES.includes(modalidad) ||
        typeof precio !== "number" ||
        !Number.isFinite(precio) ||
        precio <= 0 ||
        !METODOS_PAGO.includes(metodoPago)
    ) {
        return res.status(400).json({
            error: "Revisa el producto, la cantidad, el precio y el método de pago."
        });
    }

    const esDocena = modalidad === "docena";
    const unidades = esDocena ? cantidad * 12 : cantidad;
    const precioVenta = Number(precio.toFixed(2));

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const resultado = await client.query(
            `SELECT id, nombre, precio_minimo, precio_compra, stock
             FROM productos
             WHERE id = $1
             FOR UPDATE`,
            [productoId]
        );

        const producto = resultado.rows[0];

        if (!producto) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "El producto no existe." });
        }

        if (producto.stock < unidades) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                error: `Stock insuficiente. Solo quedan ${producto.stock} unidades.`
            });
        }

        const minimo = Number(producto.precio_minimo) * (esDocena ? 12 : 1);

        if (Math.round(precioVenta * 100) < Math.round(minimo * 100)) {
            await client.query("ROLLBACK");

            const esJefe = req.session.usuario.rol === "jefe";

            return res.status(400).json({
                error: esJefe
                    ? `El precio no puede ser menor que el mínimo (S/ ${minimo.toFixed(2)} por ${modalidad}).`
                    : "El precio está por debajo del mínimo permitido. Consulta con el jefe."
            });
        }

        const total = Number((precioVenta * cantidad).toFixed(2));
        const precioUnitario = Number((esDocena ? precioVenta / 12 : precioVenta).toFixed(2));

        const venta = await client.query(
            `INSERT INTO ventas
                (producto_id, cantidad, precio_unitario, costo_unitario, total,
                 usuario_id, metodo_pago, modalidad, fecha)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                     CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')
             RETURNING id`,
            [
                producto.id,
                unidades,
                precioUnitario,
                producto.precio_compra,
                total,
                req.session.usuario.id,
                metodoPago,
                modalidad
            ]
        );

        await client.query(
            `UPDATE productos SET stock = stock - $1 WHERE id = $2`,
            [unidades, producto.id]
        );

        await client.query("COMMIT");

        const [ventaRegistrada] = await consultarVentas(
            req.session.usuario.rol === "jefe",
            venta.rows[0].id
        );

        res.status(201).json({
            mensaje: "Venta registrada correctamente.",
            venta: ventaRegistrada,
            stockRestante: producto.stock - unidades
        });
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Error al registrar la venta:", error.message);

        if (!res.headersSent) {
            res.status(500).json({ error: "No se pudo registrar la venta." });
        }
    } finally {
        client?.release();
    }
});

// Consultar el historial de ventas.
router.get("/", requiereSesion, async (req, res) => {
    try {
        res.json(await consultarVentas(req.session.usuario.rol === "jefe"));
    } catch (error) {
        console.error("Error al consultar las ventas:", error.message);
        res.status(500).json({ error: "No se pudo consultar el historial de ventas." });
    }
});

module.exports = router;
