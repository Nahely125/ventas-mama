const express = require("express");
const pool = require("../db");
const { requiereSesion, requiereJefe } = require("../autenticacion");
const { STOCK_BAJO } = require("./productos");
const { SALDO } = require("./clientes");

const router = express.Router();

// Ganancia de una fila de ventas, separada según el origen de la mercadería:
// - de este año: lo cobrado por esas unidades menos su costo;
// - del 2025: todo lo cobrado (ya se pagó el año pasado).
const GANANCIA_NUEVA = `
    COALESCE(ventas.total * (ventas.cantidad - ventas.unidades_2025) / ventas.cantidad
             - COALESCE(ventas.costo_unitario, 0) * (ventas.cantidad - ventas.unidades_2025), 0)`;
const GANANCIA_2025 = `COALESCE(ventas.total * ventas.unidades_2025 / ventas.cantidad, 0)`;

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
                    (SELECT COALESCE(SUM(precio * stock), 0) FROM productos) AS "valorInventario",
                    (SELECT COALESCE(SUM(precio * GREATEST(stock - stock_2025, 0)), 0) FROM productos) AS "valorInventarioNuevo",
                    (SELECT COALESCE(SUM(stock_2025), 0) FROM productos) AS "unidades2025",
                    (SELECT COALESCE(SUM(precio * stock_2025), 0) FROM productos) AS "valorInventario2025",
                    (SELECT COALESCE(SUM(${GANANCIA_NUEVA}), 0) FROM ventas WHERE anulada_en IS NULL) AS "gananciaVentasNuevas",
                    (SELECT COALESCE(SUM(${GANANCIA_2025}), 0) FROM ventas WHERE anulada_en IS NULL) AS "ganancia2025",
                    (SELECT COALESCE(SUM(monto), 0) FROM gastos) AS "gastosTotales",
                    (SELECT COALESCE(SUM(monto), 0) FROM inversiones) AS "inversionTotal",
                    (SELECT COALESCE(SUM(GREATEST(${SALDO}, 0)), 0) FROM clientes) AS "porCobrar"`
            );

            const fila = datos.rows[0];
            const gananciaNueva = Number(fila.gananciaVentasNuevas);
            const ganancia2025 = Number(fila.ganancia2025);
            const gastos = Number(fila.gastosTotales);
            const inversiones = Number(fila.inversionTotal);

            resumen.valorInventario = Number(fila.valorInventario).toFixed(2);
            // Valor del stock separado: mercadería nueva y mercadería del 2025.
            resumen.valorInventarioNuevo = Number(fila.valorInventarioNuevo).toFixed(2);
            resumen.unidades2025 = Number(fila.unidades2025);
            resumen.valorInventario2025 = Number(fila.valorInventario2025).toFixed(2);
            resumen.gastosTotales = gastos.toFixed(2);
            // Lo que deben los clientes por ventas fiadas (ya cuenta como venta y ganancia).
            resumen.porCobrar = Number(fila.porCobrar).toFixed(2);
            resumen.ganancia2025 = ganancia2025.toFixed(2);
            resumen.gananciaVentasNuevas = gananciaNueva.toFixed(2);
            resumen.gananciaTotal = (gananciaNueva + ganancia2025).toFixed(2);

            // Ganancia neta: todas las ventas (incluido el inventario 2025) menos los gastos.
            resumen.gananciaNeta = (gananciaNueva + ganancia2025 - gastos).toFixed(2);

            // Recuperación: lo invertido este año (inversiones + gastos) se recupera solo con
            // la ganancia de la mercadería de este año. El inventario 2025 va aparte.
            const totalInvertido = inversiones + gastos;

            resumen.inversionesRegistradas = inversiones.toFixed(2);
            resumen.inversionTotal = totalInvertido.toFixed(2);
            resumen.inversionRecuperada = Math.min(Math.max(gananciaNueva, 0), totalInvertido).toFixed(2);
            resumen.faltaRecuperar = Math.max(totalInvertido - gananciaNueva, 0).toFixed(2);
            resumen.porcentajeRecuperado = totalInvertido > 0
                ? Math.min(Math.max(gananciaNueva / totalInvertido, 0) * 100, 100).toFixed(1)
                : "0.0";
        }

        res.json(resumen);
    } catch (error) {
        console.error("Error al generar el resumen:", error.message);
        res.status(500).json({ error: "Error al generar el resumen del inventario" });
    }
});

/* Ganancia neta por día de un mes: ?mes=YYYY-MM (por defecto, el mes actual en Lima).
   Para cada día con ventas o gastos: ventas, total vendido, ganancia, gastos y ganancia neta. */
router.get("/diario", requiereJefe, async (req, res) => {
    const mes = typeof req.query.mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.mes)
        ? req.query.mes
        : null;

    try {
        const resultado = await pool.query(
            `WITH limites AS (
                SELECT COALESCE(TO_DATE($1, 'YYYY-MM'),
                                DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::DATE) AS inicio
            ),
            por_venta AS (
                SELECT
                    ventas.fecha::DATE AS dia,
                    COUNT(DISTINCT ventas.grupo) AS ventas,
                    SUM(ventas.total) AS vendido,
                    SUM(${GANANCIA_NUEVA}) AS ganancia_nueva,
                    SUM(${GANANCIA_2025}) AS ganancia_2025
                FROM ventas, limites
                WHERE ventas.anulada_en IS NULL
                  AND ventas.fecha >= limites.inicio
                  AND ventas.fecha < limites.inicio + INTERVAL '1 month'
                GROUP BY 1
            ),
            por_gasto AS (
                SELECT gastos.fecha AS dia, SUM(gastos.monto) AS gastos
                FROM gastos, limites
                WHERE gastos.fecha >= limites.inicio
                  AND gastos.fecha < limites.inicio + INTERVAL '1 month'
                GROUP BY 1
            ),
            por_inversion AS (
                SELECT inversiones.fecha AS dia, SUM(inversiones.monto) AS invertido
                FROM inversiones, limites
                WHERE inversiones.fecha >= limites.inicio
                  AND inversiones.fecha < limites.inicio + INTERVAL '1 month'
                GROUP BY 1
            ),
            dias AS (
                SELECT dia FROM por_venta
                UNION SELECT dia FROM por_gasto
                UNION SELECT dia FROM por_inversion
            )
            SELECT
                TO_CHAR(dias.dia, 'YYYY-MM-DD') AS dia,
                COALESCE(v.ventas, 0)::INT AS ventas,
                ROUND(COALESCE(v.vendido, 0), 2) AS vendido,
                ROUND(COALESCE(v.ganancia_nueva, 0) + COALESCE(v.ganancia_2025, 0), 2) AS ganancia,
                ROUND(COALESCE(v.ganancia_nueva, 0), 2) AS "gananciaNueva",
                ROUND(COALESCE(v.ganancia_2025, 0), 2) AS "ganancia2025",
                ROUND(COALESCE(g.gastos, 0), 2) AS gastos,
                -- Lo invertido ese día (no se resta de la ganancia neta: se recupera con las ventas).
                ROUND(COALESCE(i.invertido, 0), 2) AS invertido,
                ROUND(COALESCE(v.ganancia_nueva, 0) + COALESCE(v.ganancia_2025, 0) - COALESCE(g.gastos, 0), 2) AS neta
            FROM dias
            LEFT JOIN por_venta v ON v.dia = dias.dia
            LEFT JOIN por_gasto g ON g.dia = dias.dia
            LEFT JOIN por_inversion i ON i.dia = dias.dia
            ORDER BY 1 DESC`,
            [mes]
        );

        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al generar el resumen diario:", error.message);
        res.status(500).json({ error: "No se pudo generar la ganancia por día." });
    }
});

module.exports = router;
