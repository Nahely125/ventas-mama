const express = require("express");
const pool = require("../db");
const { requiereSesion, requiereJefe, leerId } = require("../autenticacion");
const { OBSEQUIABLE } = require("./ajustes");
const { COLORES_JSON, validarColores, guardarColores } = require("./colores");

const router = express.Router();

const STOCK_BAJO = 5;

// Columnas visibles para todos (el precio mínimo también lo ven los empleados)
// y columnas exclusivas del jefe (costos).
const COLUMNAS_COMUNES = `
    id,
    codigo,
    nombre,
    precio,
    precio_minimo AS "precioMinimo",
    precio_docena AS "precioDocena",
    precio_minimo_docena AS "precioMinimoDocena",
    stock,
    seccion_id AS "seccionId",
    categoria_id AS "categoriaId",
    (foto IS NOT NULL) AS "tieneFoto",
    -- Se puede regalar (el empleado solo ve si sí o no, nunca el costo).
    ${OBSEQUIABLE} AS "obsequiable",
    ${COLORES_JSON} AS colores,
    COALESCE(EXTRACT(EPOCH FROM foto_actualizada)::BIGINT, 0)::INT AS "fotoVersion"
`;

const COLUMNAS_JEFE = `
    ${COLUMNAS_COMUNES},
    precio_compra AS "precioCompra",
    unidades_por_caja AS "unidadesPorCaja",
    stock_2025 AS "stock2025"
`;

function columnasSegunRol(req) {
    return req.session.usuario.rol === "jefe" ? COLUMNAS_JEFE : COLUMNAS_COMUNES;
}

function esNumero(valor) {
    return typeof valor === "number" && Number.isFinite(valor);
}

function centimos(valor) {
    return Math.round(valor * 100);
}

// Valida los datos de un producto. Devuelve { datos } o { error }.
function validarProducto(cuerpo) {
    const {
        codigo,
        nombre,
        precio,
        precioDocena,
        precioMinimo,
        precioMinimoDocena,
        precioCompra,
        unidadesPorCaja,
        stock,
        stock2025 = 0,
        seccionId = null,
        categoriaId = null
    } = cuerpo;
    const { colores, error: errorColores } = validarColores(cuerpo.colores);

    if (errorColores) {
        return { error: errorColores };
    }

    // Con colores, el stock del producto es la suma de sus colores.
    const stockTotal = colores ? colores.reduce((suma, c) => suma + c.stock, 0) : stock;

    if (typeof codigo !== "string" || !codigo.trim() || codigo.trim().length > 50) {
        return { error: "El código del producto es obligatorio (máximo 50 caracteres)." };
    }

    if (typeof nombre !== "string" || !nombre.trim() || nombre.trim().length > 150) {
        return { error: "El nombre del producto es obligatorio (máximo 150 caracteres)." };
    }

    if (
        !esNumero(precio) ||
        !esNumero(precioDocena) ||
        !esNumero(precioMinimo) ||
        !esNumero(precioMinimoDocena) ||
        !esNumero(precioCompra) ||
        !Number.isInteger(unidadesPorCaja) ||
        !Number.isInteger(stockTotal) ||
        precio < 0 ||
        precioDocena < 0 ||
        precioMinimo < 0 ||
        precioMinimoDocena < 0 ||
        precioCompra < 0 ||
        unidadesPorCaja < 1 ||
        stockTotal < 0
    ) {
        return {
            error: "Datos inválidos. Verifica los precios, las unidades por caja y el stock."
        };
    }

    // El costo admite hasta 4 decimales (por ejemplo, S/ 0.0833).
    if (Math.abs(precioCompra * 10000 - Math.round(precioCompra * 10000)) > 1e-6) {
        return { error: "El costo puede tener hasta 4 decimales." };
    }

    if (categoriaId !== null && (!Number.isInteger(categoriaId) || categoriaId <= 0)) {
        return { error: "La categoría elegida no es válida." };
    }

    if (seccionId !== null && (!Number.isInteger(seccionId) || seccionId <= 0)) {
        return { error: "La sección elegida no es válida." };
    }

    if (!Number.isInteger(stock2025) || stock2025 < 0 || stock2025 > stockTotal) {
        return { error: "Las unidades del 2025 deben estar entre 0 y el stock total." };
    }

    return {
        datos: {
            codigo: codigo.trim(),
            nombre: nombre.trim(),
            precio,
            precioDocena,
            precioMinimo,
            precioMinimoDocena,
            // Se recibe el costo de la caja y se guarda el costo por unidad.
            costoUnitario: Number((precioCompra / unidadesPorCaja).toFixed(4)),
            unidadesPorCaja,
            stock: stockTotal,
            stock2025,
            seccionId,
            categoriaId,
            colores
        }
    };
}

function errorDuplicado(error, res) {
    if (error.code === "23503" && /seccion|categoria/.test(error.constraint ?? error.detail ?? "")) {
        res.status(400).json({ error: "La sección o categoría elegida ya no existe." });
        return true;
    }

    if (error.code === "23505" && /colores/.test(error.constraint ?? "")) {
        res.status(409).json({ error: "Hay dos colores con el mismo nombre." });
        return true;
    }

    if (error.code === "23505") {
        res.status(409).json({ error: "Ya existe un producto con ese código." });
        return true;
    }
    return false;
}

// Consultar todos los productos.
router.get("/", requiereSesion, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT ${columnasSegunRol(req)}
             FROM productos
             ORDER BY nombre`
        );

        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al consultar los productos:", error.message);
        res.status(500).json({ error: "Error al consultar los productos" });
    }
});

// Consultar productos con stock bajo.
router.get("/stock-bajo", requiereSesion, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT
                ${columnasSegunRol(req)},
                GREATEST($1 - stock, 0) AS "unidadesParaReponer",
                -- Unidades vendidas en los últimos 30 días (para saber cuánto conviene reponer).
                (SELECT COALESCE(SUM(ventas.cantidad), 0) FROM ventas
                 WHERE ventas.producto_id = productos.id AND ventas.anulada_en IS NULL
                   AND ventas.fecha >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::DATE - 29)::INT AS "vendidas30"
             FROM productos
             WHERE stock <= $1
             ORDER BY stock ASC, "vendidas30" DESC, nombre`,
            [STOCK_BAJO]
        );

        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al consultar el stock bajo:", error.message);
        res.status(500).json({ error: "Error al consultar productos con stock bajo" });
    }
});

// Registrar un producto nuevo.
router.post("/", requiereJefe, async (req, res) => {
    const { datos, error } = validarProducto(req.body);

    if (error) {
        return res.status(400).json({ error });
    }

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const resultado = await client.query(
            `INSERT INTO productos
                (codigo, nombre, precio, precio_docena, precio_minimo,
                 precio_compra, unidades_por_caja, stock, seccion_id, categoria_id,
                 precio_minimo_docena, stock_2025)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                     COALESCE((SELECT seccion_id FROM categorias WHERE id = $10), $9), $10, $11, $12)
             RETURNING id`,
            [
                datos.codigo,
                datos.nombre,
                datos.precio,
                datos.precioDocena,
                datos.precioMinimo,
                datos.costoUnitario,
                datos.unidadesPorCaja,
                datos.stock,
                datos.seccionId,
                datos.categoriaId,
                datos.precioMinimoDocena,
                datos.stock2025
            ]
        );

        const id = resultado.rows[0].id;
        await guardarColores(client, id, datos.colores);
        const producto = await client.query(`SELECT ${COLUMNAS_JEFE} FROM productos WHERE id = $1`, [id]);
        await client.query("COMMIT");

        res.status(201).json({
            mensaje: "Producto registrado correctamente",
            producto: producto.rows[0]
        });
    } catch (err) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        if (errorDuplicado(err, res)) return;
        console.error("Error al registrar el producto:", err.message);
        res.status(500).json({ error: "Error al registrar el producto" });
    } finally {
        client?.release();
    }
});

// Actualizar un producto existente.
router.put("/:id", requiereJefe, async (req, res) => {
    const id = leerId(req);

    if (!id) {
        return res.status(400).json({ error: "ID de producto inválido" });
    }

    const { datos, error } = validarProducto(req.body);

    if (error) {
        return res.status(400).json({ error });
    }

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const resultado = await client.query(
            `UPDATE productos
             SET codigo = $1,
                 nombre = $2,
                 precio = $3,
                 precio_docena = $4,
                 precio_minimo = $5,
                 precio_compra = $6,
                 unidades_por_caja = $7,
                 stock = $8,
                 seccion_id = COALESCE((SELECT seccion_id FROM categorias WHERE id = $11), $9),
                 categoria_id = $11,
                 precio_minimo_docena = $12,
                 stock_2025 = $13
             WHERE id = $10
             RETURNING id`,
            [
                datos.codigo,
                datos.nombre,
                datos.precio,
                datos.precioDocena,
                datos.precioMinimo,
                datos.costoUnitario,
                datos.unidadesPorCaja,
                datos.stock,
                datos.seccionId,
                id,
                datos.categoriaId,
                datos.precioMinimoDocena,
                datos.stock2025
            ]
        );

        if (resultado.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Producto no encontrado" });
        }

        await guardarColores(client, id, datos.colores);
        const producto = await client.query(`SELECT ${COLUMNAS_JEFE} FROM productos WHERE id = $1`, [id]);
        await client.query("COMMIT");

        res.json({
            mensaje: "Producto actualizado correctamente",
            producto: producto.rows[0]
        });
    } catch (err) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        if (errorDuplicado(err, res)) return;
        console.error("Error al actualizar el producto:", err.message);
        res.status(500).json({ error: "Error al actualizar el producto" });
    } finally {
        client?.release();
    }
});

// Eliminar un producto existente.
router.delete("/:id", requiereJefe, async (req, res) => {
    const id = leerId(req);

    if (!id) {
        return res.status(400).json({ error: "ID de producto inválido" });
    }

    try {
        const resultado = await pool.query(
            `DELETE FROM productos WHERE id = $1 RETURNING id, nombre`,
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: "Producto no encontrado" });
        }

        res.json({
            mensaje: "Producto eliminado correctamente",
            producto: resultado.rows[0]
        });
    } catch (error) {
        if (error.code === "23503") {
            return res.status(409).json({
                error: "No se puede eliminar: este producto tiene ventas registradas. Puedes dejar su stock en 0."
            });
        }

        console.error("Error al eliminar el producto:", error.message);
        res.status(500).json({ error: "Error al eliminar el producto" });
    }
});

/* Fotos de productos.
   El navegador reduce la imagen antes de enviarla (JPEG o WEBP, ~600 px). */

const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
const TAMANO_MAXIMO_FOTO = 1.5 * 1024 * 1024;

// Pública: la usan el inventario y el catálogo.
router.get("/:id/foto", async (req, res) => {
    const id = leerId(req);

    if (!id) {
        return res.status(404).end();
    }

    try {
        const resultado = await pool.query(
            `SELECT foto, foto_tipo FROM productos WHERE id = $1 AND foto IS NOT NULL`,
            [id]
        );

        const fila = resultado.rows[0];

        if (!fila) {
            return res.status(404).end();
        }

        // La URL lleva ?v=<versión>, así que se puede guardar en caché mucho tiempo.
        res.set("Cache-Control", "public, max-age=31536000, immutable");
        res.type(fila.foto_tipo).send(fila.foto);
    } catch (error) {
        console.error("Error al enviar la foto:", error.message);
        res.status(500).end();
    }
});

router.put("/:id/foto", requiereJefe, async (req, res) => {
    const id = leerId(req);
    const coincidencia = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.foto ?? "");

    if (!id) {
        return res.status(400).json({ error: "ID de producto inválido" });
    }

    if (!coincidencia || !TIPOS_FOTO.includes(coincidencia[1])) {
        return res.status(400).json({ error: "La foto debe ser JPG, PNG o WEBP." });
    }

    const foto = Buffer.from(coincidencia[2], "base64");

    if (foto.length > TAMANO_MAXIMO_FOTO) {
        return res.status(400).json({ error: "La foto es demasiado grande." });
    }

    try {
        const resultado = await pool.query(
            `UPDATE productos
             SET foto = $1, foto_tipo = $2, foto_actualizada = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING id`,
            [foto, coincidencia[1], id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: "Producto no encontrado" });
        }

        res.json({ mensaje: "Foto guardada correctamente." });
    } catch (error) {
        console.error("Error al guardar la foto:", error.message);
        res.status(500).json({ error: "No se pudo guardar la foto." });
    }
});

router.delete("/:id/foto", requiereJefe, async (req, res) => {
    const id = leerId(req);

    if (!id) {
        return res.status(400).json({ error: "ID de producto inválido" });
    }

    try {
        await pool.query(
            `UPDATE productos
             SET foto = NULL, foto_tipo = NULL, foto_actualizada = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [id]
        );

        res.json({ mensaje: "Foto eliminada." });
    } catch (error) {
        console.error("Error al eliminar la foto:", error.message);
        res.status(500).json({ error: "No se pudo eliminar la foto." });
    }
});

module.exports = { router, STOCK_BAJO };
