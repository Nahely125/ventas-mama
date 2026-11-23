const express = require("express");
const pool = require("../db");
const { consultarVentas, armarBoleta } = require("./consultasVentas");

// Rutas públicas: se abren sin iniciar sesión (catálogo y boletas enviadas a clientes).
// Nunca devuelven costos, ganancias ni datos internos.
const router = express.Router();

// Con esta cantidad o menos, el catálogo muestra «Últimas unidades».
const ULTIMAS_UNIDADES = 5;

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
            `WITH vendidos AS (
                -- Los 8 más vendidos de los últimos 90 días (unidades, sin anuladas).
                SELECT producto_id, ROW_NUMBER() OVER (ORDER BY SUM(cantidad) DESC, producto_id) AS puesto
                FROM ventas
                WHERE anulada_en IS NULL AND fecha >= CURRENT_DATE - INTERVAL '90 days'
                GROUP BY producto_id
                ORDER BY SUM(cantidad) DESC, producto_id
                LIMIT 8
             )
             SELECT
                productos.id,
                productos.codigo,
                productos.nombre,
                productos.precio_minimo AS "precioMinimo",
                productos.precio_docena AS "precioDocena",
                productos.precio_minimo_docena AS "precioMinimoDocena",
                productos.seccion_id AS "seccionId",
                productos.categoria_id AS "categoriaId",
                (productos.stock > 0) AS disponible,
                (productos.stock BETWEEN 1 AND ${ULTIMAS_UNIDADES}) AS "ultimasUnidades",
                COALESCE(productos.creado_en >= CURRENT_TIMESTAMP - INTERVAL '30 days', FALSE) AS nuevo,
                vendidos.puesto::INT AS "puestoVendido",
                COALESCE((
                    SELECT JSON_AGG(JSON_BUILD_OBJECT('nombre', pc.nombre, 'disponible', pc.stock > 0) ORDER BY pc.orden, pc.id)
                    FROM producto_colores pc WHERE pc.producto_id = productos.id
                ), '[]') AS colores,
                (productos.foto IS NOT NULL OR productos.foto_r2 IS NOT NULL) AS "tieneFoto",
                COALESCE(EXTRACT(EPOCH FROM productos.foto_actualizada)::BIGINT, 0)::INT AS "fotoVersion"
             FROM productos
             LEFT JOIN secciones ON productos.seccion_id = secciones.id
             LEFT JOIN vendidos ON vendidos.producto_id = productos.id
             WHERE (productos.seccion_id IS NULL OR secciones.visible) AND productos.eliminado_en IS NULL
             ORDER BY (productos.stock > 0) DESC, productos.nombre`
        );

        res.set("Cache-Control", "public, max-age=60");
        res.json({ secciones: secciones.rows, productos: productos.rows });
    } catch (error) {
        console.error("Error al consultar el catálogo:", error.message);
        res.status(500).json({ error: "No se pudo cargar el catálogo." });
    }
});

/* Lo que la boleta necesita además de la venta:
   - campana: la campaña actual (la primera feria visible del catálogo) con su descripción;
   - logoVersion: el logo subido en «Página web» (o null: se usa el monograma «MD»);
   - masVendidos: hasta 8 productos con foto de esa campaña, los más vendidos de los últimos 90 días
     (si faltan, los más recientes), sin los de la papelera. */
// Se recuerdan 5 minutos: abrir varias boletas seguidas no vuelve a consultar la base.
const RECORDAR_EXTRAS_MS = 5 * 60 * 1000;
let extrasRecordados = null; // { datos, hasta }

router.get("/boleta-extras", async (req, res) => {
    res.set("Cache-Control", "public, max-age=300");

    if (extrasRecordados && extrasRecordados.hasta > Date.now()) {
        return res.json(extrasRecordados.datos);
    }

    try {
        const [campanas, logo] = await Promise.all([
            pool.query(
                `SELECT id, nombre, descripcion, tema FROM secciones WHERE visible ORDER BY orden, id LIMIT 1`
            ),
            pool.query(`SELECT EXTRACT(EPOCH FROM actualizada)::BIGINT AS version FROM tienda_imagenes WHERE clave = 'logo'`)
        ]);
        const campana = campanas.rows[0] ?? null;

        const productos = await pool.query(
            `SELECT productos.id, productos.nombre, productos.precio,
                    COALESCE(EXTRACT(EPOCH FROM productos.foto_actualizada)::BIGINT, 0)::INT AS "fotoVersion"
             FROM productos
             LEFT JOIN categorias ON categorias.id = productos.categoria_id
             LEFT JOIN (
                SELECT producto_id, SUM(cantidad) AS unidades FROM ventas
                WHERE anulada_en IS NULL AND NOT obsequio AND fecha >= CURRENT_DATE - 90
                GROUP BY producto_id
             ) vendidos ON vendidos.producto_id = productos.id
             WHERE (productos.foto IS NOT NULL OR productos.foto_r2 IS NOT NULL)
               AND productos.eliminado_en IS NULL AND productos.stock > 0
               AND ($1::INT IS NULL OR COALESCE(categorias.seccion_id, productos.seccion_id) = $1)
             ORDER BY vendidos.unidades DESC NULLS LAST, productos.creado_en DESC NULLS LAST, productos.id DESC
             LIMIT 8`,
            [campana?.id ?? null]
        );

        const datos = {
            campana,
            logoVersion: logo.rows[0] ? String(logo.rows[0].version) : null,
            masVendidos: productos.rows.map((p) => ({ ...p, precio: Number(p.precio).toFixed(2) }))
        };
        extrasRecordados = { datos, hasta: Date.now() + RECORDAR_EXTRAS_MS };
        res.json(datos);
    } catch (error) {
        console.error("Error al consultar los datos de la boleta:", error.message);
        res.status(500).json({ error: "No se pudieron consultar los datos de la boleta." });
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
        const filas = await consultarVentas(pool, false, { grupo: req.params.token });

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
