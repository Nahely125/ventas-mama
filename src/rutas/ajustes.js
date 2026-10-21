const express = require("express");
const pool = require("../db");
const { requiereJefe, leerId } = require("../autenticacion");

// Códigos de ajuste (descuentos sobre el total de una venta): los registra el jefe y se los da al
// empleado. monto null = monto libre: el empleado lo escribe al vender.
const router = express.Router();

// Límite para el empleado: solo regala productos de menos de esto por unidad, y en total
// (al costo) no más de esto por venta.
const COSTO_MAXIMO_OBSEQUIO = 5;

// Nombre con el que queda el descuento que hace el jefe directamente, sin código.
const AJUSTE_DEL_JEFE = "DESCUENTO DEL JEFE";

const COLUMNAS = `
    id,
    codigo,
    descripcion,
    monto,
    activo,
    (SELECT COUNT(DISTINCT grupo) FROM ventas WHERE ventas.codigo_ajuste = codigos_ajuste.codigo)::INT AS usos
`;

// " descuento10 " → "DESCUENTO10" (mayúsculas y un solo espacio entre palabras).
function normalizarCodigo(codigo) {
    return typeof codigo === "string" ? codigo.trim().toUpperCase().replace(/\s+/g, " ") : "";
}

/* Convierte lo pedido al vender en { codigo, monto } o { error }.
   ajuste: { codigo, monto } con un código registrado, o { libre: true, monto } (solo el jefe). */
async function resolverAjuste(db, ajuste, esJefe) {
    if (ajuste?.libre === true) {
        if (!esJefe) {
            return { error: "Solo el jefe puede hacer un descuento sin código.", prohibido: true };
        }

        return conMonto(AJUSTE_DEL_JEFE, null, ajuste.monto);
    }

    const codigo = normalizarCodigo(ajuste?.codigo);
    const resultado = codigo
        ? await db.query(`SELECT codigo, monto FROM codigos_ajuste WHERE codigo = $1 AND activo`, [codigo])
        : { rows: [] };

    if (resultado.rows.length === 0) {
        return { error: "El código de descuento no es válido.", codigoInvalido: true };
    }

    const fila = resultado.rows[0];
    return conMonto(fila.codigo, fila.monto === null ? null : Number(fila.monto), ajuste.monto);
}

function conMonto(codigo, fijo, escrito) {
    const monto = fijo ?? Number(escrito);

    if (!Number.isFinite(monto) || monto <= 0) {
        return { error: "Escribe el monto del descuento (mayor que cero)." };
    }

    return { codigo, monto: Number(monto.toFixed(2)) };
}

// Reparte el ajuste entre los productos según su importe, al céntimo y sin pasar ninguno de su importe.
function repartirAjuste(importes, monto) {
    const centimos = importes.map((importe) => Math.round(importe * 100));
    const subtotal = centimos.reduce((suma, c) => suma + c, 0);
    let pendiente = Math.round(monto * 100);
    const partes = centimos.map((c) => Math.min(c, Math.floor((pendiente * c) / subtotal)));
    pendiente -= partes.reduce((suma, p) => suma + p, 0);

    for (let i = 0; pendiente > 0 && i < partes.length; i++) {
        const extra = Math.min(centimos[i] - partes[i], pendiente);
        partes[i] += extra;
        pendiente -= extra;
    }

    return partes.map((p) => p / 100);
}

function validarCodigo(cuerpo) {
    const codigo = normalizarCodigo(cuerpo?.codigo);
    const descripcion = typeof cuerpo?.descripcion === "string" ? cuerpo.descripcion.trim() : "";
    const monto = cuerpo?.monto === null || cuerpo?.monto === undefined || cuerpo?.monto === ""
        ? null
        : Number(cuerpo.monto);

    if (!/^[A-Z0-9Ñ][A-Z0-9Ñ -]{2,19}$/.test(codigo)) {
        return { error: "El código debe tener de 3 a 20 letras o números (puede llevar espacios o guiones)." };
    }

    if (codigo === AJUSTE_DEL_JEFE) {
        return { error: "Ese nombre está reservado para los descuentos del jefe." };
    }

    if (descripcion.length > 100) {
        return { error: "La descripción puede tener hasta 100 caracteres." };
    }

    if (monto !== null && (!Number.isFinite(monto) || monto <= 0 || monto > 99999)) {
        return { error: "El monto debe ser mayor que cero (o déjalo libre)." };
    }

    return {
        datos: {
            codigo,
            descripcion: descripcion || null,
            monto: monto === null ? null : Number(monto.toFixed(2)),
            activo: cuerpo?.activo !== false
        }
    };
}

router.get("/", requiereJefe, async (req, res) => {
    try {
        const resultado = await pool.query(`SELECT ${COLUMNAS} FROM codigos_ajuste ORDER BY activo DESC, codigo`);
        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al listar los códigos de ajuste:", error.message);
        res.status(500).json({ error: "No se pudieron cargar los códigos de descuento." });
    }
});

router.post("/", requiereJefe, async (req, res) => {
    const { datos, error } = validarCodigo(req.body);

    if (error) {
        return res.status(400).json({ error });
    }

    try {
        const resultado = await pool.query(
            `INSERT INTO codigos_ajuste (codigo, descripcion, monto, activo)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [datos.codigo, datos.descripcion, datos.monto, datos.activo]
        );
        const fila = await pool.query(`SELECT ${COLUMNAS} FROM codigos_ajuste WHERE id = $1`, [resultado.rows[0].id]);
        res.status(201).json({ mensaje: "Código de descuento registrado.", codigo: fila.rows[0] });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ error: "Ya existe un código de descuento con ese nombre." });
        }

        console.error("Error al registrar el código de ajuste:", error.message);
        res.status(500).json({ error: "No se pudo registrar el código de descuento." });
    }
});

router.put("/:id", requiereJefe, async (req, res) => {
    const id = leerId(req);
    const { datos, error } = validarCodigo(req.body);

    if (!id) {
        return res.status(404).json({ error: "Código de descuento no encontrado." });
    }

    if (error) {
        return res.status(400).json({ error });
    }

    try {
        const resultado = await pool.query(
            `UPDATE codigos_ajuste SET codigo = $1, descripcion = $2, monto = $3, activo = $4
             WHERE id = $5
             RETURNING id`,
            [datos.codigo, datos.descripcion, datos.monto, datos.activo, id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: "Código de descuento no encontrado." });
        }

        const fila = await pool.query(`SELECT ${COLUMNAS} FROM codigos_ajuste WHERE id = $1`, [id]);
        res.json({ mensaje: "Código de descuento actualizado.", codigo: fila.rows[0] });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ error: "Ya existe un código de descuento con ese nombre." });
        }

        console.error("Error al actualizar el código de ajuste:", error.message);
        res.status(500).json({ error: "No se pudo actualizar el código de descuento." });
    }
});

// Las ventas guardan el texto del código, así que borrarlo no cambia el historial.
router.delete("/:id", requiereJefe, async (req, res) => {
    const id = leerId(req);

    if (!id) {
        return res.status(404).json({ error: "Código de descuento no encontrado." });
    }

    try {
        const resultado = await pool.query(`DELETE FROM codigos_ajuste WHERE id = $1 RETURNING id`, [id]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: "Código de descuento no encontrado." });
        }

        res.json({ mensaje: "Código de descuento eliminado." });
    } catch (error) {
        console.error("Error al eliminar el código de ajuste:", error.message);
        res.status(500).json({ error: "No se pudo eliminar el código de descuento." });
    }
});

module.exports = {
    router,
    AJUSTE_DEL_JEFE,
    COSTO_MAXIMO_OBSEQUIO,
    normalizarCodigo,
    resolverAjuste,
    repartirAjuste
};
