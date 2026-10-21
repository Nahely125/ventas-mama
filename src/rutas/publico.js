const express = require("express");
const pool = require("../db");

// Rutas públicas: se abren sin iniciar sesión (catálogo y boletas enviadas a clientes).
// Nunca devuelven costos, ganancias ni datos internos.
const router = express.Router();

// Catálogo: secciones visibles y sus productos (precio mínimo y foto).
// Los productos de secciones ocultas no se muestran; los que no tienen sección sí.
router.get("/catalogo", async (req, res) => {
    try {
        const secciones = await pool.query(
            `SELECT id, nombre, descripcion, tema
             FROM secciones
             WHERE visible
             ORDER BY orden, nombre`
        );

        const productos = await pool.query(
            `SELECT
                productos.id,
                productos.codigo,
                productos.nombre,
                productos.precio_minimo AS "precioMinimo",
                productos.precio_docena AS "precioDocena",
                productos.seccion_id AS "seccionId",
                (productos.stock > 0) AS disponible,
                (productos.foto IS NOT NULL) AS "tieneFoto",
                COALESCE(EXTRACT(EPOCH FROM productos.foto_actualizada)::BIGINT, 0)::INT AS "fotoVersion"
             FROM productos
             LEFT JOIN secciones ON productos.seccion_id = secciones.id
             WHERE productos.seccion_id IS NULL OR secciones.visible
             ORDER BY (productos.stock > 0) DESC, productos.nombre`
        );

        res.set("Cache-Control", "public, max-age=60");
        res.json({ secciones: secciones.rows, productos: productos.rows });
    } catch (error) {
        console.error("Error al consultar el catálogo:", error.message);
        res.status(500).json({ error: "No se pudo cargar el catálogo." });
    }
});

const FORMATO_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Boleta de una venta, a partir del enlace que se envía por WhatsApp.
router.get("/boletas/:token", async (req, res) => {
    if (!FORMATO_TOKEN.test(req.params.token)) {
        return res.status(404).json({ error: "Boleta no encontrada." });
    }

    try {
        const resultado = await pool.query(
            `SELECT
                ventas.id,
                ventas.token,
                TO_CHAR(ventas.fecha, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha,
                productos.nombre AS producto,
                productos.codigo,
                ventas.modalidad,
                ventas.cantidad,
                ventas.precio_unitario AS "precioUnitario",
                ventas.total,
                ventas.metodo_pago AS "metodoPago",
                COALESCE(usuarios.nombre, 'Mil Deseos') AS vendedor
             FROM ventas
             INNER JOIN productos ON ventas.producto_id = productos.id
             LEFT JOIN usuarios ON ventas.usuario_id = usuarios.id
             WHERE ventas.token = $1`,
            [req.params.token]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: "Boleta no encontrada." });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error("Error al consultar la boleta:", error.message);
        res.status(500).json({ error: "No se pudo cargar la boleta." });
    }
});

module.exports = router;
