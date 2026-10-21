const express = require("express");
const pool = require("../db");
const { consultarVentas, armarBoleta } = require("./ventas");

// Rutas públicas: se abren sin iniciar sesión (catálogo y boletas enviadas a clientes).
// Nunca devuelven costos, ganancias ni datos internos.
const router = express.Router();

// Catálogo: secciones visibles y sus productos (precio mínimo y foto).
// Los productos de secciones ocultas no se muestran; los que no tienen sección sí.
router.get("/catalogo", async (req, res) => {
    try {
        const secciones = await pool.query(
            `SELECT
                id, nombre, descripcion, tema,
                COALESCE((
                    SELECT JSON_AGG(JSON_BUILD_OBJECT('id', c.id, 'nombre', c.nombre, 'icono', c.icono)
                                    ORDER BY c.orden, c.nombre)
                    FROM categorias c
                    WHERE c.seccion_id = secciones.id
                ), '[]') AS categorias
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
                productos.precio_minimo_docena AS "precioMinimoDocena",
                productos.seccion_id AS "seccionId",
                productos.categoria_id AS "categoriaId",
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
        // El enlace usa el grupo de la venta. Los enlaces antiguos (de una sola fila) usaban
        // su token, que es igual al grupo de esas ventas.
        const filas = await consultarVentas(false, req.params.token);

        if (filas.length === 0) {
            return res.status(404).json({ error: "Boleta no encontrada." });
        }

        res.json(armarBoleta(filas));
    } catch (error) {
        console.error("Error al consultar la boleta:", error.message);
        res.status(500).json({ error: "No se pudo cargar la boleta." });
    }
});

module.exports = router;
