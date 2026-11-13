const express = require("express");
const pool = require("../db");
const { requiereJefe, leerId } = require("../autenticacion");
const { anotarMovimiento } = require("../movimientos");

/* Rotos y faltantes (mermas): la mercadería que salió rota, perdida o que faltó en un conteo.
   Cada caso se sigue hasta el final: si el proveedor la cambió (vuelve al stock) o si quedó
   como pérdida. Así se sabe cuánta mercadería se pierde y cuánta se recupera. Solo el jefe. */
const router = express.Router();
router.use(requiereJefe);

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS = ["pendiente", "cambiado", "perdida"];

function texto(valor, limite = 200) {
    return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

// Filtro por fecha (?desde&hasta, opcionales) y estado (?estado).
function filtros(query) {
    const condiciones = [];
    const valores = [];

    if (FECHA.test(query.desde ?? "")) {
        valores.push(query.desde);
        condiciones.push(`m.fecha >= $${valores.length}::DATE`);
    }
    if (FECHA.test(query.hasta ?? "")) {
        valores.push(query.hasta);
        condiciones.push(`m.fecha < $${valores.length}::DATE + 1`);
    }

    return { donde: condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "", valores };
}

// Valor al costo: lo perdido, lo recuperado con cambios, lo que falta reclamar y la pérdida definitiva.
const SUMAS = `
    COUNT(*)::INT AS registros,
    COALESCE(SUM(m.cantidad), 0)::INT AS unidades,
    ROUND(COALESCE(SUM(m.cantidad * COALESCE(m.costo_unitario, 0)), 0), 2) AS valor,
    COALESCE(SUM(m.cantidad_cambiada), 0)::INT AS unidades_cambiadas,
    ROUND(COALESCE(SUM(m.cantidad_cambiada * COALESCE(m.costo_unitario, 0)), 0), 2) AS recuperado,
    COALESCE(SUM(m.cantidad - m.cantidad_cambiada) FILTER (WHERE m.estado = 'pendiente'), 0)::INT AS unidades_por_reclamar,
    ROUND(COALESCE(SUM((m.cantidad - m.cantidad_cambiada) * COALESCE(m.costo_unitario, 0)) FILTER (WHERE m.estado = 'pendiente'), 0), 2) AS por_reclamar,
    COALESCE(SUM(m.cantidad - m.cantidad_cambiada) FILTER (WHERE m.estado = 'perdida'), 0)::INT AS unidades_perdidas,
    ROUND(COALESCE(SUM((m.cantidad - m.cantidad_cambiada) * COALESCE(m.costo_unitario, 0)) FILTER (WHERE m.estado = 'perdida'), 0), 2) AS perdida`;

async function leerMermas(query) {
    const { donde, valores } = filtros(query);
    const estado = ESTADOS.includes(query.estado) ? query.estado : null;
    const valoresLista = estado ? [...valores, estado] : valores;
    const dondeLista = estado
        ? `${donde ? `${donde} AND` : "WHERE"} m.estado = $${valoresLista.length}`
        : donde;

    const [resumen, porMes, porProducto, lista] = await Promise.all([
        pool.query(`SELECT ${SUMAS} FROM mermas m ${donde}`, valores),
        pool.query(
            `SELECT TO_CHAR(m.fecha, 'YYYY-MM') AS mes, ${SUMAS}
             FROM mermas m ${donde}
             GROUP BY 1 ORDER BY 1 DESC LIMIT 12`,
            valores
        ),
        pool.query(
            `SELECT p.id, p.nombre, p.codigo, ${SUMAS}
             FROM mermas m INNER JOIN productos p ON p.id = m.producto_id
             ${donde}
             GROUP BY p.id ORDER BY valor DESC, unidades DESC LIMIT 8`,
            valores
        ),
        pool.query(
            `SELECT m.id, m.producto_id AS "productoId", p.nombre AS producto, p.codigo,
                    (p.foto IS NOT NULL OR p.foto_r2 IS NOT NULL) AS "tieneFoto",
                    COALESCE(EXTRACT(EPOCH FROM p.foto_actualizada)::BIGINT, 0)::INT AS "fotoVersion",
                    m.color_id AS "colorId", m.color_nombre AS "colorNombre",
                    COALESCE((
                        SELECT JSON_AGG(JSON_BUILD_OBJECT('id', c.id, 'nombre', c.nombre) ORDER BY c.orden, c.id)
                        FROM producto_colores c WHERE c.producto_id = p.id
                    ), '[]') AS colores,
                    m.motivo, m.cantidad, m.cantidad_cambiada AS "cantidadCambiada",
                    m.costo_unitario AS "costoUnitario",
                    ROUND(m.cantidad * COALESCE(m.costo_unitario, 0), 2) AS valor,
                    m.nota, m.estado,
                    TO_CHAR(m.fecha, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha,
                    TO_CHAR(m.fecha_resuelta, 'YYYY-MM-DD"T"HH24:MI:SS') AS "fechaResuelta",
                    m.nota_resuelta AS "notaResuelta",
                    u.nombre AS usuario, r.nombre AS "resueltaPor"
             FROM mermas m
             INNER JOIN productos p ON p.id = m.producto_id
             LEFT JOIN usuarios u ON u.id = m.usuario_id
             LEFT JOIN usuarios r ON r.id = m.resuelta_por
             ${dondeLista}
             ORDER BY (m.estado = 'pendiente') DESC, m.fecha DESC, m.id DESC
             LIMIT 300`,
            valoresLista
        )
    ]);

    return { resumen: resumen.rows[0], porMes: porMes.rows, porProducto: porProducto.rows, mermas: lista.rows };
}

router.get("/", async (req, res) => {
    try {
        res.json(await leerMermas(req.query));
    } catch (error) {
        console.error("Error al consultar rotos y faltantes:", error.message);
        res.status(500).json({ error: "No se pudieron cargar los rotos y faltantes." });
    }
});

/* El proveedor cambió la mercadería: { cantidad, colorId?, nota? }.
   Las unidades vuelven al stock (queda en el historial del producto como «Cambio del proveedor»).
   Se puede cambiar una parte: el resto sigue por reclamar. */
router.post("/:id/cambio", async (req, res) => {
    const id = leerId(req);
    const cantidad = req.body?.cantidad;
    const nota = texto(req.body?.nota);

    if (!id) {
        return res.status(400).json({ error: "Registro inválido." });
    }

    if (!Number.isInteger(cantidad) || cantidad < 1) {
        return res.status(400).json({ error: "Escribe cuántas unidades cambió el proveedor (1 o más)." });
    }

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const fila = await client.query(
            `SELECT m.*, p.nombre AS producto FROM mermas m INNER JOIN productos p ON p.id = m.producto_id
             WHERE m.id = $1 FOR UPDATE OF m`,
            [id]
        );
        const merma = fila.rows[0];

        if (!merma) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "No se encontró ese registro." });
        }

        if (merma.estado !== "pendiente") {
            await client.query("ROLLBACK");
            return res.status(409).json({
                error: merma.estado === "cambiado"
                    ? "Ya se cambió todo lo de este registro."
                    : "Este registro está marcado como pérdida. Reábrelo si al final sí se cambió."
            });
        }

        const restante = merma.cantidad - merma.cantidad_cambiada;
        if (cantidad > restante) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: `Solo faltan ${restante} ${restante === 1 ? "unidad" : "unidades"} por cambiar.` });
        }

        // ¿A qué color vuelve? Al del registro; si no tiene y el producto usa colores, se elige.
        const colores = await client.query(
            `SELECT id, nombre FROM producto_colores WHERE producto_id = $1 FOR UPDATE`,
            [merma.producto_id]
        );
        let color = null;

        if (colores.rows.length > 0) {
            const elegido = merma.color_id ?? req.body?.colorId;
            color = colores.rows.find((c) => c.id === elegido) ?? null;

            if (!color) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Elige de qué color son las unidades que llegaron." });
            }

            await client.query(`UPDATE producto_colores SET stock = stock + $1 WHERE id = $2`, [cantidad, color.id]);
        }

        await anotarMovimiento(client, {
            tipo: "cambio",
            motivo: merma.motivo,
            referencia: `merma-${merma.id}`,
            detalle: ["Cambio del proveedor", color?.nombre, `${cantidad} u.`, nota || null].filter(Boolean).join(" · "),
            usuarioId: req.session.usuario.id
        });
        await client.query(`UPDATE productos SET stock = stock + $1 WHERE id = $2`, [cantidad, merma.producto_id]);

        const completo = merma.cantidad_cambiada + cantidad === merma.cantidad;
        await client.query(
            `UPDATE mermas
             SET cantidad_cambiada = cantidad_cambiada + $2,
                 estado = CASE WHEN $3::BOOLEAN THEN 'cambiado' ELSE 'pendiente' END,
                 fecha_resuelta = CASE WHEN $3::BOOLEAN THEN (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima') END,
                 nota_resuelta = COALESCE(NULLIF($4, ''), nota_resuelta),
                 resuelta_por = $5
             WHERE id = $1`,
            [id, cantidad, completo, nota, req.session.usuario.id]
        );

        await client.query("COMMIT");

        res.json({
            mensaje: completo
                ? `¡Listo! ${cantidad} ${cantidad === 1 ? "unidad volvió" : "unidades volvieron"} al stock de ${merma.producto}.`
                : `${cantidad} ${cantidad === 1 ? "unidad volvió" : "unidades volvieron"} al stock. Faltan ${restante - cantidad} por cambiar.`,
            ...(await leerMermas(req.query))
        });
    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        console.error("Error al registrar el cambio:", error.message);
        res.status(500).json({ error: "No se pudo registrar el cambio." });
    } finally {
        client?.release();
    }
});

// No se pudo cambiar: lo que falta queda como pérdida definitiva. { nota? }
router.post("/:id/perdida", async (req, res) => {
    const id = leerId(req);

    if (!id) {
        return res.status(400).json({ error: "Registro inválido." });
    }

    try {
        const resultado = await pool.query(
            `UPDATE mermas
             SET estado = 'perdida', fecha_resuelta = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima'),
                 nota_resuelta = COALESCE(NULLIF($2, ''), nota_resuelta), resuelta_por = $3
             WHERE id = $1 AND estado = 'pendiente'
             RETURNING id`,
            [id, texto(req.body?.nota), req.session.usuario.id]
        );

        if (resultado.rows.length === 0) {
            return res.status(409).json({ error: "Solo se puede marcar como pérdida lo que está por reclamar." });
        }

        res.json({ mensaje: "Marcado como pérdida: no se pudo cambiar.", ...(await leerMermas(req.query)) });
    } catch (error) {
        console.error("Error al marcar la pérdida:", error.message);
        res.status(500).json({ error: "No se pudo marcar como pérdida." });
    }
});

// Reabrir una pérdida (por ejemplo, el proveedor aceptó el cambio después).
router.post("/:id/reabrir", async (req, res) => {
    const id = leerId(req);

    if (!id) {
        return res.status(400).json({ error: "Registro inválido." });
    }

    try {
        const resultado = await pool.query(
            `UPDATE mermas SET estado = 'pendiente', fecha_resuelta = NULL, resuelta_por = NULL
             WHERE id = $1 AND estado = 'perdida'
             RETURNING id`,
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(409).json({ error: "Solo se puede reabrir lo que está marcado como pérdida." });
        }

        res.json({ mensaje: "Reabierto: vuelve a estar por reclamar.", ...(await leerMermas(req.query)) });
    } catch (error) {
        console.error("Error al reabrir:", error.message);
        res.status(500).json({ error: "No se pudo reabrir." });
    }
});

module.exports = router;
