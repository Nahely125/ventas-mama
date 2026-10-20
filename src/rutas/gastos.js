const express = require("express");
const pool = require("../db");
const { requiereJefe, leerId } = require("../autenticacion");

const router = express.Router();

const CATEGORIAS = [
    "Mercadería",
    "Transporte",
    "Alquiler",
    "Servicios",
    "Sueldos",
    "Embalaje",
    "Otros"
];

const COLUMNAS = `
    gastos.id,
    gastos.descripcion,
    gastos.categoria,
    gastos.monto,
    TO_CHAR(gastos.fecha, 'YYYY-MM-DD') AS fecha,
    COALESCE(usuarios.nombre, 'No registrado') AS "registradoPor"
`;

function validarGasto({ descripcion, categoria, monto, fecha }) {
    if (typeof descripcion !== "string" || !descripcion.trim() || descripcion.trim().length > 200) {
        return "La descripción es obligatoria (máximo 200 caracteres).";
    }

    if (!CATEGORIAS.includes(categoria)) {
        return "Selecciona una categoría válida.";
    }

    if (typeof monto !== "number" || !Number.isFinite(monto) || monto <= 0 || monto > 99999999) {
        return "El monto debe ser mayor que cero.";
    }

    if (
        typeof fecha !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
        Number.isNaN(Date.parse(fecha))
    ) {
        return "La fecha no es válida.";
    }

    return null;
}

router.get("/categorias", requiereJefe, (req, res) => {
    res.json(CATEGORIAS);
});

router.get("/", requiereJefe, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT ${COLUMNAS}
             FROM gastos
             LEFT JOIN usuarios ON gastos.usuario_id = usuarios.id
             ORDER BY gastos.fecha DESC, gastos.id DESC`
        );

        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al consultar los gastos:", error.message);
        res.status(500).json({ error: "No se pudieron consultar los gastos." });
    }
});

router.post("/", requiereJefe, async (req, res) => {
    const error = validarGasto(req.body);

    if (error) {
        return res.status(400).json({ error });
    }

    try {
        const insertado = await pool.query(
            `INSERT INTO gastos (descripcion, categoria, monto, fecha, usuario_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [
                req.body.descripcion.trim(),
                req.body.categoria,
                Number(req.body.monto.toFixed(2)),
                req.body.fecha,
                req.session.usuario.id
            ]
        );

        const resultado = await pool.query(
            `SELECT ${COLUMNAS}
             FROM gastos
             LEFT JOIN usuarios ON gastos.usuario_id = usuarios.id
             WHERE gastos.id = $1`,
            [insertado.rows[0].id]
        );

        res.status(201).json({
            mensaje: "Gasto registrado correctamente.",
            gasto: resultado.rows[0]
        });
    } catch (err) {
        console.error("Error al registrar el gasto:", err.message);
        res.status(500).json({ error: "No se pudo registrar el gasto." });
    }
});

router.delete("/:id", requiereJefe, async (req, res) => {
    const id = leerId(req);

    if (!id) {
        return res.status(400).json({ error: "ID de gasto inválido." });
    }

    try {
        const resultado = await pool.query(
            `DELETE FROM gastos WHERE id = $1 RETURNING id`,
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: "Gasto no encontrado." });
        }

        res.json({ mensaje: "Gasto eliminado correctamente." });
    } catch (error) {
        console.error("Error al eliminar el gasto:", error.message);
        res.status(500).json({ error: "No se pudo eliminar el gasto." });
    }
});

module.exports = router;
