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
    (SELECT COUNT(*)::INT FROM productos WHERE productos.seccion_id = secciones.id) AS "totalProductos",
    COALESCE((
        SELECT JSON_AGG(JSON_BUILD_OBJECT(
            'id', categorias.id,
            'nombre', categorias.nombre,
            'icono', categorias.icono,
            'orden', categorias.orden,
            'totalProductos', (SELECT COUNT(*) FROM productos WHERE productos.categoria_id = categorias.id)
        ) ORDER BY categorias.orden, categorias.nombre)
        FROM categorias
        WHERE categorias.seccion_id = secciones.id
    ), '[]') AS categorias
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

/* Categorías de una sección */

function validarCategoria({ nombre, icono = "", orden = 0 }) {
    if (typeof nombre !== "string" || !nombre.trim() || nombre.trim().length > 60) {
        return { error: "El nombre de la categoría es obligatorio (máximo 60 caracteres)." };
    }

    if (typeof icono !== "string" || [...icono].length > 4) {
        return { error: "El ícono debe ser un emoji." };
    }

    if (!Number.isInteger(orden) || orden < 0 || orden > 999) {
        return { error: "El orden debe ser un número entre 0 y 999." };
    }

    return { datos: { nombre: nombre.trim(), icono: icono.trim() || null, orden } };
}

function errorCategoriaRepetida(error, res) {
    if (error.code === "23505") {
        res.status(409).json({ error: "Esa sección ya tiene una categoría con ese nombre." });
        return true;
    }
    return false;
}

router.post("/:id/categorias", requiereJefe, async (req, res) => {
    const seccionId = leerId(req);
    const { datos, error } = validarCategoria(req.body);

    if (!seccionId) return res.status(400).json({ error: "Sección inválida." });
    if (error) return res.status(400).json({ error });

    try {
        const resultado = await pool.query(
            `INSERT INTO categorias (seccion_id, nombre, icono, orden)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [seccionId, datos.nombre, datos.icono, datos.orden]
        );
        res.status(201).json({ mensaje: "Categoría creada.", id: resultado.rows[0].id });
    } catch (err) {
        if (errorCategoriaRepetida(err, res)) return;
        if (err.code === "23503") return res.status(404).json({ error: "Sección no encontrada." });
        console.error("Error al crear la categoría:", err.message);
        res.status(500).json({ error: "No se pudo crear la categoría." });
    }
});

router.put("/categorias/:id", requiereJefe, async (req, res) => {
    const id = leerId(req);
    const { datos, error } = validarCategoria(req.body);

    if (!id) return res.status(400).json({ error: "Categoría inválida." });
    if (error) return res.status(400).json({ error });

    try {
        const resultado = await pool.query(
            `UPDATE categorias SET nombre = $1, icono = $2, orden = $3 WHERE id = $4 RETURNING id`,
            [datos.nombre, datos.icono, datos.orden, id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: "Categoría no encontrada." });
        }

        res.json({ mensaje: "Categoría actualizada." });
    } catch (err) {
        if (errorCategoriaRepetida(err, res)) return;
        console.error("Error al actualizar la categoría:", err.message);
        res.status(500).json({ error: "No se pudo actualizar la categoría." });
    }
});

// Al eliminar una categoría, sus productos siguen en la sección pero sin categoría.
router.delete("/categorias/:id", requiereJefe, async (req, res) => {
    const id = leerId(req);

    if (!id) return res.status(400).json({ error: "Categoría inválida." });

    try {
        const resultado = await pool.query(`DELETE FROM categorias WHERE id = $1 RETURNING id`, [id]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: "Categoría no encontrada." });
        }

        res.json({ mensaje: "Categoría eliminada." });
    } catch (error) {
        console.error("Error al eliminar la categoría:", error.message);
        res.status(500).json({ error: "No se pudo eliminar la categoría." });
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
