const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");
const { requiereJefe, leerId } = require("../autenticacion");

const router = express.Router();

const COLUMNAS = `
    id,
    usuario,
    nombre,
    rol,
    activo,
    TO_CHAR(fecha_creacion, 'YYYY-MM-DD') AS "fechaCreacion",
    (SELECT COUNT(*) FROM ventas WHERE ventas.usuario_id = usuarios.id)::int AS "totalVentas"
`;

// Valida nombre, usuario y (opcionalmente) contraseña. Devuelve un mensaje de error o null.
function validarCuenta({ nombre, usuario, password }, passwordObligatoria) {
    if (
        typeof nombre !== "string" ||
        typeof usuario !== "string" ||
        !nombre.trim() ||
        !usuario.trim()
    ) {
        return "El nombre y el usuario son obligatorios.";
    }

    if (nombre.trim().length > 100 || usuario.trim().length > 50) {
        return "El nombre o el usuario son demasiado largos.";
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(usuario.trim())) {
        return "El usuario solo puede tener letras, números, puntos, guiones y guiones bajos (sin espacios).";
    }

    if (passwordObligatoria || password) {
        if (typeof password !== "string" || password.length < 12) {
            return "La contraseña debe tener al menos 12 caracteres.";
        }
    }

    return null;
}

function errorUsuarioDuplicado(error, res) {
    if (error.code === "23505") {
        res.status(409).json({ error: "Ese nombre de usuario ya existe. Prueba otro." });
        return true;
    }
    return false;
}

router.get("/", requiereJefe, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT ${COLUMNAS} FROM usuarios ORDER BY rol, nombre`
        );

        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al consultar los usuarios:", error.message);
        res.status(500).json({ error: "No se pudo consultar la lista de empleados." });
    }
});

router.post("/", requiereJefe, async (req, res) => {
    const error = validarCuenta(req.body, true);

    if (error) {
        return res.status(400).json({ error });
    }

    try {
        const hash = await bcrypt.hash(req.body.password, 12);

        const resultado = await pool.query(
            `INSERT INTO usuarios (usuario, nombre, password_hash, rol)
             VALUES ($1, $2, $3, 'trabajador')
             RETURNING ${COLUMNAS}`,
            [req.body.usuario.trim(), req.body.nombre.trim(), hash]
        );

        res.status(201).json({
            mensaje: "Empleado registrado correctamente.",
            usuario: resultado.rows[0]
        });
    } catch (err) {
        if (errorUsuarioDuplicado(err, res)) return;
        console.error("Error al registrar el empleado:", err.message);
        res.status(500).json({ error: "No se pudo registrar el empleado." });
    }
});

/* Editar una cuenta.
   - Los trabajadores se pueden editar por completo (nombre, usuario, contraseña, activo).
   - El jefe puede editar su propia cuenta, pero no desactivarse.
   - No se pueden editar otras cuentas de jefe. */
router.put("/:id", requiereJefe, async (req, res) => {
    const id = leerId(req);

    if (!id) {
        return res.status(400).json({ error: "ID de usuario inválido." });
    }

    const error = validarCuenta(req.body, false);

    if (error) {
        return res.status(400).json({ error });
    }

    const { activo } = req.body;

    if (typeof activo !== "boolean") {
        return res.status(400).json({ error: "Indica si la cuenta está activa." });
    }

    try {
        const actual = await pool.query(`SELECT id, rol FROM usuarios WHERE id = $1`, [id]);
        const cuenta = actual.rows[0];

        if (!cuenta) {
            return res.status(404).json({ error: "Empleado no encontrado." });
        }

        const esPropia = id === req.session.usuario.id;

        if (cuenta.rol === "jefe" && !esPropia) {
            return res.status(403).json({ error: "No puedes modificar la cuenta de otro jefe." });
        }

        if (esPropia && !activo) {
            return res.status(400).json({ error: "No puedes desactivar tu propia cuenta." });
        }

        const hash = req.body.password ? await bcrypt.hash(req.body.password, 12) : null;

        const resultado = await pool.query(
            `UPDATE usuarios
             SET nombre = $1,
                 usuario = $2,
                 activo = $3,
                 password_hash = COALESCE($4, password_hash)
             WHERE id = $5
             RETURNING ${COLUMNAS}`,
            [req.body.nombre.trim(), req.body.usuario.trim(), activo, hash, id]
        );

        const usuario = resultado.rows[0];

        if (esPropia) {
            req.session.usuario = {
                ...req.session.usuario,
                nombre: usuario.nombre,
                usuario: usuario.usuario
            };
        }

        res.json({ mensaje: "Cuenta actualizada correctamente.", usuario });
    } catch (err) {
        if (errorUsuarioDuplicado(err, res)) return;
        console.error("Error al actualizar el empleado:", err.message);
        res.status(500).json({ error: "No se pudo actualizar la cuenta." });
    }
});

// Eliminar un trabajador. Si ya registró ventas, solo se puede desactivar.
router.delete("/:id", requiereJefe, async (req, res) => {
    const id = leerId(req);

    if (!id) {
        return res.status(400).json({ error: "ID de usuario inválido." });
    }

    try {
        const resultado = await pool.query(
            `DELETE FROM usuarios
             WHERE id = $1 AND rol = 'trabajador'
             RETURNING id, nombre`,
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: "Solo se pueden eliminar cuentas de trabajador." });
        }

        res.json({ mensaje: "Empleado eliminado correctamente.", usuario: resultado.rows[0] });
    } catch (error) {
        if (error.code === "23503") {
            return res.status(409).json({
                error: "Este empleado tiene ventas o gastos registrados, así que no se puede eliminar. Desactívalo para que ya no pueda ingresar."
            });
        }

        console.error("Error al eliminar el empleado:", error.message);
        res.status(500).json({ error: "No se pudo eliminar el empleado." });
    }
});

module.exports = router;
