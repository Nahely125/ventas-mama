const express = require("express");
const pool = require("../db");
const { requiereJefe } = require("../autenticacion");

// Reportes para el jefe: cierre de caja, ventas por empleado y productos (todo en hora de Lima).
const router = express.Router();

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const METODOS_CAJA = ["efectivo", "yape", "plin", "transferencia"];

// Ganancia de cada fila de ventas (igual que en el historial): lo del 2025 no resta costo.
const GANANCIA = `(ventas.total - COALESCE(ventas.costo_unitario, 0) * (ventas.cantidad - ventas.unidades_2025))`;

// Lo que se cobró en una fila de ventas el día de la venta: lo que queda (si sigue vigente) más lo que
// se devolvió después (ese día sí entró). Las filas anuladas sin devoluciones no cuentan.
const COBRADO = (v) => `(CASE WHEN ${v}.anulada_en IS NULL THEN ${v}.total ELSE 0 END
    + COALESCE((SELECT SUM(d.monto) FROM devoluciones d WHERE d.venta_id = ${v}.id), 0))`;
const CUENTA_EN_CAJA = (v) => `NOT (${v}.anulada_en IS NOT NULL AND ${v}.unidades_devueltas = 0)`;

// Hoy en Lima (YYYY-MM-DD).
const HOY = `TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima', 'YYYY-MM-DD')`;

// Periodo ?desde&hasta (días incluidos); sin fechas, los últimos 30 días.
async function periodo(query) {
    if (FECHA.test(query.desde ?? "") && FECHA.test(query.hasta ?? "") && query.desde <= query.hasta) {
        return { desde: query.desde, hasta: query.hasta };
    }

    const fila = await pool.query(
        `SELECT TO_CHAR((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::DATE - 29, 'YYYY-MM-DD') AS desde,
                ${HOY} AS hasta`
    );
    return fila.rows[0];
}

/* Cierre de caja de un día (?dia=YYYY-MM-DD, por defecto hoy):
   - entradas por método: lo cobrado en ventas de ese día (lo devuelto después se suma de nuevo,
     porque ese día sí entró) y los abonos de fiados;
   - salidas: devoluciones hechas ese día;
   - fiado: lo vendido fiado (no entra dinero);
   - efectivo esperado = entradas − salidas en efectivo; y el cierre guardado, si ya se hizo. */
router.get("/caja", requiereJefe, async (req, res) => {
    try {
        const dia = FECHA.test(req.query.dia ?? "") ? req.query.dia : (await pool.query(`SELECT ${HOY} AS dia`)).rows[0].dia;

        const [ventas, abonos, devoluciones, gastos, cierre] = await Promise.all([
            pool.query(
                `SELECT ventas.metodo_pago AS metodo,
                        COUNT(DISTINCT ventas.grupo)::INT AS ventas,
                        SUM(${COBRADO("ventas")}) AS monto
                 FROM ventas
                 WHERE ventas.fecha >= $1::DATE AND ventas.fecha < $1::DATE + 1
                   AND ${CUENTA_EN_CAJA("ventas")}
                 GROUP BY 1`,
                [dia]
            ),
            pool.query(
                `SELECT metodo_pago AS metodo, COUNT(*)::INT AS cantidad, SUM(monto) AS monto
                 FROM abonos
                 WHERE fecha >= $1::DATE AND fecha < $1::DATE + 1
                 GROUP BY 1`,
                [dia]
            ),
            pool.query(
                `SELECT metodo_pago AS metodo, COUNT(*)::INT AS cantidad, SUM(monto) AS monto
                 FROM devoluciones
                 WHERE fecha >= $1::DATE AND fecha < $1::DATE + 1
                 GROUP BY 1`,
                [dia]
            ),
            pool.query(`SELECT COALESCE(SUM(monto), 0) AS monto FROM gastos WHERE fecha = $1::DATE`, [dia]),
            pool.query(
                `SELECT cierres_caja.efectivo_esperado AS "efectivoEsperado",
                        cierres_caja.efectivo_contado AS "efectivoContado",
                        cierres_caja.nota,
                        COALESCE(usuarios.nombre, 'No registrado') AS "cerradoPor",
                        TO_CHAR(cierres_caja.creado_en, 'YYYY-MM-DD"T"HH24:MI:SS') AS "creadoEn"
                 FROM cierres_caja
                 LEFT JOIN usuarios ON usuarios.id = cierres_caja.usuario_id
                 WHERE cierres_caja.dia = $1::DATE`,
                [dia]
            )
        ]);

        const porMetodo = (filas, metodo) => Number(filas.rows.find((f) => f.metodo === metodo)?.monto ?? 0);
        const metodos = METODOS_CAJA.map((metodo) => {
            const vendido = porMetodo(ventas, metodo);
            const abonado = porMetodo(abonos, metodo);
            const devuelto = porMetodo(devoluciones, metodo);
            return {
                metodo,
                ventas: vendido.toFixed(2),
                abonos: abonado.toFixed(2),
                devoluciones: devuelto.toFixed(2),
                total: (vendido + abonado - devuelto).toFixed(2)
            };
        });

        res.json({
            dia,
            metodos,
            ventas: ventas.rows.filter((f) => f.metodo !== "fiado").reduce((suma, f) => suma + f.ventas, 0),
            fiado: porMetodo(ventas, "fiado").toFixed(2),
            fiadoDevuelto: porMetodo(devoluciones, "fiado").toFixed(2),
            total: metodos.reduce((suma, m) => suma + Number(m.total), 0).toFixed(2),
            efectivoEsperado: metodos.find((m) => m.metodo === "efectivo").total,
            gastos: Number(gastos.rows[0].monto).toFixed(2),
            cierre: cierre.rows[0] ?? null
        });
    } catch (error) {
        console.error("Error al calcular el cierre de caja:", error.message);
        res.status(500).json({ error: "No se pudo calcular el cierre de caja." });
    }
});

/* Guardar (o corregir) el cierre de caja de un día: { dia, efectivoContado, nota }.
   El efectivo esperado se calcula aquí mismo, para que no dependa de lo que mande el navegador. */
router.post("/caja", requiereJefe, async (req, res) => {
    const { dia, nota } = req.body ?? {};
    const contado = Number(req.body?.efectivoContado);

    if (!FECHA.test(dia ?? "") || Number.isNaN(Date.parse(dia))) {
        return res.status(400).json({ error: "El día no es válido." });
    }

    if (!Number.isFinite(contado) || contado < 0 || contado > 9999999) {
        return res.status(400).json({ error: "Escribe cuánto efectivo contaste (0 o más)." });
    }

    if (nota !== undefined && nota !== null && (typeof nota !== "string" || nota.length > 300)) {
        return res.status(400).json({ error: "La nota puede tener hasta 300 caracteres." });
    }

    try {
        const resultado = await pool.query(
            `WITH efectivo AS (
                SELECT
                    COALESCE((SELECT SUM(${COBRADO("v")})
                              FROM ventas v
                              WHERE v.metodo_pago = 'efectivo' AND v.fecha >= $1::DATE AND v.fecha < $1::DATE + 1
                                AND ${CUENTA_EN_CAJA("v")}), 0)
                  + COALESCE((SELECT SUM(monto) FROM abonos
                              WHERE metodo_pago = 'efectivo' AND fecha >= $1::DATE AND fecha < $1::DATE + 1), 0)
                  - COALESCE((SELECT SUM(monto) FROM devoluciones
                              WHERE metodo_pago = 'efectivo' AND fecha >= $1::DATE AND fecha < $1::DATE + 1), 0) AS esperado
            )
            INSERT INTO cierres_caja (dia, efectivo_esperado, efectivo_contado, nota, usuario_id)
            SELECT $1::DATE, ROUND(esperado, 2), $2, $3, $4 FROM efectivo
            ON CONFLICT (dia) DO UPDATE
                SET efectivo_esperado = EXCLUDED.efectivo_esperado,
                    efectivo_contado = EXCLUDED.efectivo_contado,
                    nota = EXCLUDED.nota,
                    usuario_id = EXCLUDED.usuario_id,
                    creado_en = CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima'
            RETURNING efectivo_esperado AS "efectivoEsperado", efectivo_contado AS "efectivoContado"`,
            [dia, Number(contado.toFixed(2)), nota?.trim() || null, req.session.usuario.id]
        );

        const fila = resultado.rows[0];
        const diferencia = Number(fila.efectivoContado) - Number(fila.efectivoEsperado);

        res.status(201).json({
            mensaje: Math.abs(diferencia) < 0.005
                ? "Caja cerrada: el efectivo cuadra."
                : diferencia > 0
                    ? `Caja cerrada: sobran S/ ${diferencia.toFixed(2)}.`
                    : `Caja cerrada: faltan S/ ${(-diferencia).toFixed(2)}.`,
            ...fila,
            diferencia: diferencia.toFixed(2)
        });
    } catch (error) {
        console.error("Error al guardar el cierre de caja:", error.message);
        res.status(500).json({ error: "No se pudo guardar el cierre de caja." });
    }
});

/* Ventas por empleado en un periodo (?desde&hasta): ventas, unidades, lo vendido, descuentos que
   dio, obsequios (unidades y costo) y la ganancia de sus ventas. Sin ventas anuladas. */
router.get("/empleados", requiereJefe, async (req, res) => {
    try {
        const { desde, hasta } = await periodo(req.query);
        const resultado = await pool.query(
            `SELECT
                usuarios.id,
                COALESCE(usuarios.nombre, 'No registrado') AS nombre,
                usuarios.rol,
                COUNT(DISTINCT ventas.grupo) FILTER (WHERE NOT ventas.obsequio OR ventas.total > 0)::INT AS ventas,
                COALESCE(SUM(ventas.cantidad) FILTER (WHERE NOT ventas.obsequio), 0)::INT AS unidades,
                COALESCE(SUM(ventas.total), 0) AS vendido,
                COALESCE(SUM(ventas.descuento), 0) AS descuentos,
                COUNT(DISTINCT ventas.grupo) FILTER (WHERE ventas.descuento > 0)::INT AS "ventasConDescuento",
                COALESCE(SUM(ventas.cantidad) FILTER (WHERE ventas.obsequio), 0)::INT AS "unidadesObsequiadas",
                COALESCE(SUM(COALESCE(ventas.costo_unitario, 0) * (ventas.cantidad - ventas.unidades_2025))
                         FILTER (WHERE ventas.obsequio), 0) AS "costoObsequios",
                COALESCE(SUM(${GANANCIA}), 0) AS ganancia
             FROM ventas
             LEFT JOIN usuarios ON usuarios.id = ventas.usuario_id
             WHERE ventas.anulada_en IS NULL
               AND ventas.fecha >= $1::DATE AND ventas.fecha < $2::DATE + 1
             GROUP BY usuarios.id, usuarios.nombre, usuarios.rol
             ORDER BY vendido DESC`,
            [desde, hasta]
        );

        res.json({
            desde,
            hasta,
            empleados: resultado.rows.map((f) => ({
                ...f,
                vendido: Number(f.vendido).toFixed(2),
                descuentos: Number(f.descuentos).toFixed(2),
                costoObsequios: Number(f.costoObsequios).toFixed(2),
                ganancia: Number(f.ganancia).toFixed(2)
            }))
        });
    } catch (error) {
        console.error("Error al calcular las ventas por empleado:", error.message);
        res.status(500).json({ error: "No se pudieron calcular las ventas por empleado." });
    }
});

/* Productos en un periodo (?desde&hasta): los más vendidos (unidades y dinero), los que no se
   vendieron (con stock) y la ganancia por categoría. Sin ventas anuladas ni obsequios. */
router.get("/productos", requiereJefe, async (req, res) => {
    try {
        const { desde, hasta } = await periodo(req.query);
        const parametros = [desde, hasta];
        const enPeriodo = `ventas.anulada_en IS NULL AND NOT ventas.obsequio
                           AND ventas.fecha >= $1::DATE AND ventas.fecha < $2::DATE + 1`;

        const [masVendidos, sinMovimiento, categorias] = await Promise.all([
            pool.query(
                `SELECT productos.id, productos.codigo, productos.nombre, productos.stock,
                        SUM(ventas.cantidad)::INT AS unidades,
                        SUM(ventas.total) AS vendido,
                        SUM(${GANANCIA}) AS ganancia
                 FROM ventas
                 INNER JOIN productos ON productos.id = ventas.producto_id
                 WHERE ${enPeriodo}
                 GROUP BY productos.id
                 ORDER BY unidades DESC, vendido DESC
                 LIMIT 15`,
                parametros
            ),
            pool.query(
                `SELECT productos.id, productos.codigo, productos.nombre, productos.stock,
                        ROUND(productos.precio * productos.stock, 2) AS "valorStock",
                        (SELECT TO_CHAR(MAX(v.fecha), 'YYYY-MM-DD') FROM ventas v
                         WHERE v.producto_id = productos.id AND v.anulada_en IS NULL AND NOT v.obsequio) AS "ultimaVenta"
                 FROM productos
                 WHERE productos.stock > 0
                   AND NOT EXISTS (SELECT 1 FROM ventas WHERE ventas.producto_id = productos.id AND ${enPeriodo})
                 ORDER BY productos.precio * productos.stock DESC, productos.nombre
                 LIMIT 50`,
                parametros
            ),
            pool.query(
                `SELECT COALESCE(categorias.nombre, 'Sin categoría') AS categoria,
                        categorias.icono,
                        secciones.nombre AS seccion,
                        COUNT(DISTINCT ventas.producto_id)::INT AS productos,
                        SUM(ventas.cantidad)::INT AS unidades,
                        SUM(ventas.total) AS vendido,
                        SUM(${GANANCIA}) AS ganancia
                 FROM ventas
                 INNER JOIN productos ON productos.id = ventas.producto_id
                 LEFT JOIN categorias ON categorias.id = productos.categoria_id
                 LEFT JOIN secciones ON secciones.id = COALESCE(categorias.seccion_id, productos.seccion_id)
                 WHERE ${enPeriodo}
                 GROUP BY categorias.id, categorias.nombre, categorias.icono, secciones.nombre
                 ORDER BY ganancia DESC`,
                parametros
            )
        ]);

        const dinero = (filas, campos) => filas.map((f) => {
            const copia = { ...f };
            for (const campo of campos) copia[campo] = Number(f[campo]).toFixed(2);
            return copia;
        });

        res.json({
            desde,
            hasta,
            masVendidos: dinero(masVendidos.rows, ["vendido", "ganancia"]),
            sinMovimiento: dinero(sinMovimiento.rows, ["valorStock"]),
            categorias: dinero(categorias.rows, ["vendido", "ganancia"])
        });
    } catch (error) {
        console.error("Error al calcular el reporte de productos:", error.message);
        res.status(500).json({ error: "No se pudo calcular el reporte de productos." });
    }
});

module.exports = router;
