const express = require("express");
const pool = require("../db");
const { requiereJefe, leerId } = require("../autenticacion");

const router = express.Router();

const COLUMNAS = `
    inversiones.id,
    inversiones.descripcion,
    inversiones.monto,
    TO_CHAR(inversiones.fecha, 'YYYY-MM-DD') AS fecha,
    COALESCE(usuarios.nombre, 'No registrado') AS "registradoPor"
`;

function validarInversion({ descripcion, monto, fecha }) {
    if (typeof descripcion !== "string" || !descripcion.trim() || descripcion.trim().length > 200) {
        return "La descripción es obligatoria (máximo 200 caracteres).";
    }

    if (typeof monto !== "number" || !Number.isFinite(monto) || monto <= 0 || monto > 9999999999) {
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

router.get("/", requiereJefe, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT ${COLUMNAS}
             FROM inversiones
             LEFT JOIN usuarios ON inversiones.usuario_id = usuarios.id
             ORDER BY inversiones.fecha DESC, inversiones.id DESC`
        );

        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al consultar las inversiones:", error.message);
        res.status(500).json({ error: "No se pudieron consultar las inversiones." });
    }
});

router.post("/", requiereJefe, async (req, res) => {
    const error = validarInversion(req.body);

    if (error) {
        return res.status(400).json({ error });
    }

    try {
        const insertada = await pool.query(
            `INSERT INTO inversiones (descripcion, monto, fecha, usuario_id)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [
                req.body.descripcion.trim(),
                Number(req.body.monto.toFixed(2)),
                req.body.fecha,
                req.session.usuario.id
            ]
        );

        const resultado = await pool.query(
            `SELECT ${COLUMNAS}
             FROM inversiones
             LEFT JOIN usuarios ON inversiones.usuario_id = usuarios.id
             WHERE inversiones.id = $1`,
            [insertada.rows[0].id]
        );

        res.status(201).json({
            mensaje: "Inversión registrada correctamente.",
            inversion: resultado.rows[0]
        });
    } catch (err) {
        console.error("Error al registrar la inversión:", err.message);
        res.status(500).json({ error: "No se pudo registrar la inversión." });
    }
});

router.delete("/:id", requiereJefe, async (req, res) => {
    const id = leerId(req);

    if (!id) {
        return res.status(400).json({ error: "ID de inversión inválido." });
    }

    try {
        const resultado = await pool.query(
            `DELETE FROM inversiones WHERE id = $1 RETURNING id`,
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: "Inversión no encontrada." });
        }

        res.json({ mensaje: "Inversión eliminada correctamente." });
    } catch (error) {
        console.error("Error al eliminar la inversión:", error.message);
        res.status(500).json({ error: "No se pudo eliminar la inversión." });
    }
});

module.exports = router;
