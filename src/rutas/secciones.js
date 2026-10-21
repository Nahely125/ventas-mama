const express = require("express");
const pool = require("../db");
const { requiereSesion, requiereJefe, leerId } = require("../autenticacion");

// Secciones del catálogo (por ejemplo, Feria Navideña y Feria Escolar).
const router = express.Router();

const TEMAS = ["navidad", "escolar", "general"];

const COLUMNAS = `
    secciones.id,
    secciones.nombre,
    secciones.descripcion,
    secciones.tema,
    secciones.visible,
    secciones.orden,
    (SELECT COUNT(*)::INT FROM productos WHERE productos.seccion_id = secciones.id) AS "totalProductos"
`;

function validarSeccion({ nombre, descripcion = "", tema, visible, orden }) {
    if (typeof nombre !== "string" || !nombre.trim() || nombre.trim().length > 80) {
        return { error: "El nombre de la sección es obligatorio (máximo 80 caracteres)." };
    }

    if (typeof descripcion !== "string" || descripcion.length > 200) {
        return { error: "La descripción puede tener hasta 200 caracteres." };
    }

    if (!TEMAS.includes(tema)) {
        return { error: "Elige un estilo válido para la sección." };
    }

    if (typeof visible !== "boolean" || !Number.isInteger(orden) || orden < 0 || orden > 999) {
        return { error: "Revisa la visibilidad y el orden de la sección." };
    }

    return {
        datos: { nombre: nombre.trim(), descripcion: descripcion.trim() || null, tema, visible, orden }
    };
}

function errorNombreRepetido(error, res) {
    if (error.code === "23505") {
        res.status(409).json({ error: "Ya existe una sección con ese nombre." });
        return true;
    }
    return false;
}

router.get("/", requiereSesion, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT ${COLUMNAS} FROM secciones ORDER BY orden, nombre`
        );
        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al consultar las secciones:", error.message);
        res.status(500).json({ error: "No se pudieron consultar las secciones." });
    }
});

router.post("/", requiereJefe, async (req, res) => {
    const { datos, error } = validarSeccion(req.body);

    if (error) {
        return res.status(400).json({ error });
    }

    try {
        const resultado = await pool.query(
            `INSERT INTO secciones (nombre, descripcion, tema, visible, orden)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [datos.nombre, datos.descripcion, datos.tema, datos.visible, datos.orden]
        );

        res.status(201).json({ mensaje: "Sección creada.", id: resultado.rows[0].id });
    } catch (err) {
        if (errorNombreRepetido(err, res)) return;
        console.error("Error al crear la sección:", err.message);
        res.status(500).json({ error: "No se pudo crear la sección." });
    }
});

router.put("/:id", requiereJefe, async (req, res) => {
    const id = leerId(req);
    const { datos, error } = validarSeccion(req.body);

    if (!id) {
        return res.status(400).json({ error: "Sección inválida." });
    }

    if (error) {
        return res.status(400).json({ error });
    }

    try {
        const resultado = await pool.query(
            `UPDATE secciones
             SET nombre = $1, descripcion = $2, tema = $3, visible = $4, orden = $5
             WHERE id = $6
             RETURNING id`,
            [datos.nombre, datos.descripcion, datos.tema, datos.visible, datos.orden, id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: "Sección no encontrada." });
        }

        res.json({ mensaje: "Sección actualizada." });
    } catch (err) {
        if (errorNombreRepetido(err, res)) return;
        console.error("Error al actualizar la sección:", err.message);
        res.status(500).json({ error: "No se pudo actualizar la sección." });
    }
});

// Al eliminar una sección, sus productos quedan sin sección (no se borran).
router.delete("/:id", requiereJefe, async (req, res) => {
    const id = leerId(req);

    if (!id) {
        return res.status(400).json({ error: "Sección inválida." });
    }

    try {
        const resultado = await pool.query(
            `DELETE FROM secciones WHERE id = $1 RETURNING id`,
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: "Sección no encontrada." });
        }

        res.json({ mensaje: "Sección eliminada. Sus productos quedaron sin sección." });
    } catch (error) {
        console.error("Error al eliminar la sección:", error.message);
        res.status(500).json({ error: "No se pudo eliminar la sección." });
    }
});

module.exports = router;
