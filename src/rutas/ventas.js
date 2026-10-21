const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");
const { requiereSesion } = require("../autenticacion");

const router = express.Router();

const METODOS_PAGO = ["efectivo", "yape", "plin", "transferencia"];
const MODALIDADES = ["unidad", "docena"];
const MAXIMO_PRODUCTOS = 40;

// Límite de intentos con la contraseña del jefe (por sesión), para que no se pueda adivinar probando.
const INTENTOS_MAXIMOS = 5;
const BLOQUEO_MS = 10 * 60 * 1000;

// Consulta las filas de ventas (una por producto) para el historial y la boleta.
async function consultarVentas(esJefe, grupo = null) {
    const resultado = await pool.query(
        `SELECT
            ventas.id,
            ventas.grupo,
            TO_CHAR(ventas.fecha, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha,
            productos.nombre AS producto,
            productos.codigo,
            ventas.modalidad,
            ventas.cantidad,
            ventas.precio_unitario AS "precioUnitario",
            ventas.total,
            ventas.metodo_pago AS "metodoPago",
            COALESCE(usuarios.nombre, 'No registrado') AS vendedor,
            autoriza.nombre AS "autorizadoPor"
            ${esJefe ? `,
            ventas.costo_unitario AS "costoUnitario",
            CASE
                WHEN ventas.costo_unitario IS NOT NULL
                THEN ROUND(ventas.total - ventas.costo_unitario * ventas.cantidad, 2)
            END AS ganancia` : ""}
         FROM ventas
         INNER JOIN productos ON ventas.producto_id = productos.id
         LEFT JOIN usuarios ON ventas.usuario_id = usuarios.id
         LEFT JOIN usuarios AS autoriza ON ventas.autorizado_por = autoriza.id
         ${grupo ? "WHERE ventas.grupo = $1" : ""}
         ORDER BY ventas.fecha DESC, ventas.id ASC`,
        grupo ? [grupo] : []
    );

    return resultado.rows;
}

// Junta las filas de una venta en una boleta (sin costos ni ganancias).
function armarBoleta(filas) {
    const primera = filas[0];

    return {
        numero: Math.min(...filas.map((f) => f.id)),
        grupo: primera.grupo,
        fecha: primera.fecha,
        vendedor: primera.vendedor,
        metodoPago: primera.metodoPago,
        total: filas.reduce((suma, f) => suma + Number(f.total), 0).toFixed(2),
        items: filas.map((f) => ({
            producto: f.producto,
            codigo: f.codigo,
            modalidad: f.modalidad,
            cantidad: f.cantidad,
            precioUnitario: f.precioUnitario,
            total: f.total
        }))
    };
}

function validarItems(items) {
    if (!Array.isArray(items) || items.length === 0 || items.length > MAXIMO_PRODUCTOS) {
        return `Agrega entre 1 y ${MAXIMO_PRODUCTOS} productos a la venta.`;
    }

    for (const item of items) {
        if (
            !item ||
            !Number.isInteger(item.productoId) ||
            item.productoId <= 0 ||
            !Number.isInteger(item.cantidad) ||
            item.cantidad <= 0 ||
            !MODALIDADES.includes(item.modalidad ?? "unidad") ||
            typeof item.precio !== "number" ||
            !Number.isFinite(item.precio) ||
            item.precio <= 0
        ) {
            return "Revisa la cantidad y el precio de cada producto.";
        }
    }

    return null;
}

// Comprueba la contraseña contra las cuentas de jefe activas. Devuelve el id del jefe o null.
async function verificarJefe(password) {
    const jefes = await pool.query(
        `SELECT id, password_hash FROM usuarios WHERE rol = 'jefe' AND activo = TRUE`
    );

    for (const jefe of jefes.rows) {
        if (await bcrypt.compare(password, jefe.password_hash)) {
            return jefe.id;
        }
    }

    return null;
}

/* Registrar una venta con uno o varios productos.
   items: [{ productoId, cantidad, modalidad, precio }]
     cantidad: número de unidades o de docenas, según la modalidad.
     precio: precio por unidad o por docena; puede ajustarse.
   Si algún precio está por debajo del mínimo, un trabajador necesita passwordJefe. */
router.post("/", requiereSesion, async (req, res) => {
    const { items, metodoPago = "efectivo", passwordJefe } = req.body;
    const usuario = req.session.usuario;
    const esJefe = usuario.rol === "jefe";

    const errorItems = validarItems(items);

    if (errorItems || !METODOS_PAGO.includes(metodoPago)) {
        return res.status(400).json({ error: errorItems ?? "Elige un método de pago válido." });
    }

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        // Se bloquean los productos en orden de id para evitar bloqueos cruzados.
        const ids = [...new Set(items.map((item) => item.productoId))].sort((a, b) => a - b);
        const resultado = await client.query(
            `SELECT id, nombre, precio_minimo, precio_compra, stock
             FROM productos
             WHERE id = ANY($1::int[])
             ORDER BY id
             FOR UPDATE`,
            [ids]
        );

        const productos = new Map(resultado.rows.map((p) => [p.id, p]));
        const unidadesPorProducto = new Map();
        const bajoMinimo = [];

        for (const item of items) {
            const producto = productos.get(item.productoId);

            if (!producto) {
                await client.query("ROLLBACK");
                return res.status(404).json({ error: "Uno de los productos ya no existe." });
            }

            const esDocena = (item.modalidad ?? "unidad") === "docena";
            const unidades = item.cantidad * (esDocena ? 12 : 1);
            unidadesPorProducto.set(producto.id, (unidadesPorProducto.get(producto.id) ?? 0) + unidades);

            const minimo = Number(producto.precio_minimo) * (esDocena ? 12 : 1);

            if (Math.round(item.precio * 100) < Math.round(minimo * 100)) {
                bajoMinimo.push(`${producto.nombre} (mínimo S/ ${minimo.toFixed(2)} por ${esDocena ? "docena" : "unidad"})`);
            }
        }

        for (const [id, unidades] of unidadesPorProducto) {
            const producto = productos.get(id);

            if (producto.stock < unidades) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    error: `Stock insuficiente de ${producto.nombre}. Solo quedan ${producto.stock} unidades.`
                });
            }
        }

        // Autorización para vender por debajo del mínimo.
        let autorizadoPor = null;

        if (bajoMinimo.length > 0) {
            if (esJefe) {
                autorizadoPor = usuario.id;
            } else {
                const bloqueo = req.session.bloqueoAutorizacion ?? { fallos: 0, hasta: 0 };

                if (bloqueo.hasta > Date.now()) {
                    await client.query("ROLLBACK");
                    return res.status(429).json({
                        error: "Demasiados intentos con la contraseña del jefe. Espera 10 minutos.",
                        requiereAutorizacion: true
                    });
                }

                if (typeof passwordJefe !== "string" || !passwordJefe) {
                    await client.query("ROLLBACK");
                    return res.status(403).json({
                        error: `Precio por debajo del mínimo: ${bajoMinimo.join(", ")}. Se necesita la contraseña del jefe.`,
                        requiereAutorizacion: true
                    });
                }

                autorizadoPor = await verificarJefe(passwordJefe);

                if (!autorizadoPor) {
                    bloqueo.fallos += 1;

                    if (bloqueo.fallos >= INTENTOS_MAXIMOS) {
                        bloqueo.fallos = 0;
                        bloqueo.hasta = Date.now() + BLOQUEO_MS;
                    }

                    req.session.bloqueoAutorizacion = bloqueo;
                    await client.query("ROLLBACK");
                    return res.status(403).json({
                        error: "La contraseña del jefe no es correcta.",
                        requiereAutorizacion: true
                    });
                }

                req.session.bloqueoAutorizacion = { fallos: 0, hasta: 0 };
            }
        }

        const grupo = crypto.randomUUID();

        for (const item of items) {
            const producto = productos.get(item.productoId);
            const modalidad = item.modalidad ?? "unidad";
            const esDocena = modalidad === "docena";
            const unidades = item.cantidad * (esDocena ? 12 : 1);
            const precioVenta = Number(item.precio.toFixed(2));
            const total = Number((precioVenta * item.cantidad).toFixed(2));
            const precioUnitario = Number((esDocena ? precioVenta / 12 : precioVenta).toFixed(2));

            await client.query(
                `INSERT INTO ventas
                    (producto_id, cantidad, precio_unitario, costo_unitario, total,
                     usuario_id, metodo_pago, modalidad, grupo, autorizado_por, fecha)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                         CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')`,
                [
                    producto.id,
                    unidades,
                    precioUnitario,
                    producto.precio_compra,
                    total,
                    usuario.id,
                    metodoPago,
                    modalidad,
                    grupo,
                    autorizadoPor
                ]
            );
        }

        for (const [id, unidades] of unidadesPorProducto) {
            await client.query(`UPDATE productos SET stock = stock - $1 WHERE id = $2`, [unidades, id]);
        }

        await client.query("COMMIT");

        const boleta = armarBoleta(await consultarVentas(esJefe, grupo));

        res.status(201).json({
            mensaje: "Venta registrada correctamente.",
            boleta
        });
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Error al registrar la venta:", error.message);

        if (!res.headersSent) {
            res.status(500).json({ error: "No se pudo registrar la venta." });
        }
    } finally {
        client?.release();
    }
});

// Consultar el historial de ventas (una fila por producto; "grupo" une las de una misma venta).
router.get("/", requiereSesion, async (req, res) => {
    try {
        res.json(await consultarVentas(req.session.usuario.rol === "jefe"));
    } catch (error) {
        console.error("Error al consultar las ventas:", error.message);
        res.status(500).json({ error: "No se pudo consultar el historial de ventas." });
    }
});

module.exports = { router, consultarVentas, armarBoleta };
