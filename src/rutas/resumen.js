const express = require("express");
const pool = require("../db");
const { requiereSesion } = require("../autenticacion");
const { STOCK_BAJO } = require("./productos");

const router = express.Router();

// Resumen general del inventario.
router.get("/", requiereSesion, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT
                COUNT(*) AS "totalProductos",
                COALESCE(SUM(stock), 0) AS "unidadesTotales",
                COUNT(*) FILTER (WHERE stock <= $1) AS "productosStockBajo"
             FROM productos`,
            [STOCK_BAJO]
        );

        const resumen = resultado.rows[0];

        if (req.session.usuario.rol === "jefe") {
            const datos = await pool.query(
                `SELECT
                    (SELECT COALESCE(SUM(precio * stock), 0) FROM productos)
                        AS "valorInventario",
                    (SELECT COALESCE(SUM(total - costo_unitario * cantidad), 0) FROM ventas)
                        AS "gananciaTotal",
                    (SELECT COALESCE(SUM(monto), 0) FROM gastos)
                        AS "gastosTotales",
                    (SELECT COALESCE(SUM(monto), 0) FROM inversiones)
                        AS "inversionTotal"`
            );

            Object.assign(resumen, datos.rows[0]);

            const gananciaVentas = Number(resumen.gananciaTotal);
            const gastos = Number(resumen.gastosTotales);
            const inversiones = Number(resumen.inversionTotal);

            resumen.gananciaNeta = (gananciaVentas - gastos).toFixed(2);

            // Los gastos también cuentan como inversión: todo lo que salió del bolsillo
            // (inversiones + gastos) se recupera con la ganancia de las ventas.
            const totalInvertido = inversiones + gastos;

            resumen.inversionesRegistradas = inversiones.toFixed(2);
            resumen.inversionTotal = totalInvertido.toFixed(2);
            resumen.inversionRecuperada = Math.min(Math.max(gananciaVentas, 0), totalInvertido).toFixed(2);
            resumen.faltaRecuperar = Math.max(totalInvertido - gananciaVentas, 0).toFixed(2);
            resumen.porcentajeRecuperado = totalInvertido > 0
                ? Math.min(Math.max(gananciaVentas / totalInvertido, 0) * 100, 100).toFixed(1)
                : "0.0";
        }

        res.json(resumen);
    } catch (error) {
        console.error("Error al generar el resumen:", error.message);
        res.status(500).json({ error: "Error al generar el resumen del inventario" });
    }
});

module.exports = router;
