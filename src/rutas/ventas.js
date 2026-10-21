const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");
const { requiereSesion, requiereJefe } = require("../autenticacion");

const router = express.Router();

const {
    METODOS_PAGO,
    MODALIDADES,
    MAXIMO_PRODUCTOS,
    INTENTOS_MAXIMOS,
    BLOQUEO_MS,
    consultarVentas,
    totalesVentas,
    armarBoleta
} = require("./consultasVentas");
const { COSTO_MAXIMO_OBSEQUIO, normalizarCodigo, resolverAjuste, repartirAjuste } = require("./ajustes");

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
            (item.obsequio === true ? item.precio !== 0 : item.precio <= 0)
        ) {
            return "Revisa la cantidad y el precio de cada producto.";
        }

        if (item.obsequio === true && (item.modalidad ?? "unidad") !== "unidad") {
            return "Los obsequios se registran por unidad.";
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

// Bloqueo por sesión tras varios intentos fallidos (contraseña del jefe o código de ajuste).
function bloqueado(req, clave) {
    return (req.session[clave]?.hasta ?? 0) > Date.now();
}

function anotarFallo(req, clave) {
    const bloqueo = req.session[clave] ?? { fallos: 0, hasta: 0 };
    bloqueo.fallos += 1;

    if (bloqueo.fallos >= INTENTOS_MAXIMOS) {
        bloqueo.fallos = 0;
        bloqueo.hasta = Date.now() + BLOQUEO_MS;
    }

    req.session[clave] = bloqueo;
}

/* Comprueba un código de ajuste antes de cobrar: { codigo } → { codigo, monto }
   (monto null = monto libre: se escribe al vender). */
router.post("/validar-ajuste", requiereSesion, async (req, res) => {
    if (bloqueado(req, "bloqueoAjuste")) {
        return res.status(429).json({ error: "Demasiados códigos incorrectos. Espera 10 minutos." });
    }

    try {
        const codigo = normalizarCodigo(req.body?.codigo);
        const resultado = codigo
            ? await pool.query(`SELECT codigo, monto FROM codigos_ajuste WHERE codigo = $1 AND activo`, [codigo])
            : { rows: [] };

        if (resultado.rows.length === 0) {
            anotarFallo(req, "bloqueoAjuste");
            return res.status(400).json({ error: "El código de ajuste no es válido." });
        }

        req.session.bloqueoAjuste = { fallos: 0, hasta: 0 };
        const fila = resultado.rows[0];
        res.json({ codigo: fila.codigo, monto: fila.monto === null ? null : Number(fila.monto) });
    } catch (error) {
        console.error("Error al validar el código de ajuste:", error.message);
        res.status(500).json({ error: "No se pudo validar el código." });
    }
});

/* Registrar una venta con uno o varios productos.
   items: [{ productoId, cantidad, modalidad, precio, obsequio }]
     cantidad: número de unidades o de docenas, según la modalidad.
     precio: precio por unidad o por docena; puede ajustarse. Obsequio: precio 0, por unidad.
   ajuste: { codigo, monto } descuento sobre el total con un código que registró el jefe,
           o { libre: true, monto } ajuste directo del jefe (sin código).
   Si algún precio está por debajo del mínimo, un trabajador necesita passwordJefe. */
router.post("/", requiereSesion, async (req, res) => {
    const { items, metodoPago = "efectivo", passwordJefe, clienteId = null, ajuste = null } = req.body;
    const usuario = req.session.usuario;
    const esJefe = usuario.rol === "jefe";

    const errorItems = validarItems(items);

    if (errorItems || !METODOS_PAGO.includes(metodoPago)) {
        return res.status(400).json({ error: errorItems ?? "Elige un método de pago válido." });
    }

    let ajusteVenta = null;

    if (ajuste !== null) {
        if (bloqueado(req, "bloqueoAjuste")) {
            return res.status(400).json({ error: "Demasiados códigos incorrectos. Espera 10 minutos." });
        }

        try {
            ajusteVenta = await resolverAjuste(pool, ajuste, esJefe);
        } catch (error) {
            console.error("Error al validar el ajuste:", error.message);
            return res.status(500).json({ error: "No se pudo validar el ajuste." });
        }

        if (ajusteVenta.error) {
            if (ajusteVenta.codigoInvalido) anotarFallo(req, "bloqueoAjuste");
            return res.status(400).json({ error: ajusteVenta.error });
        }

        const subtotal = items.reduce((suma, item) => suma + Number(item.precio.toFixed(2)) * item.cantidad, 0);

        if (Math.round(ajusteVenta.monto * 100) > Math.round(subtotal * 100)) {
            return res.status(400).json({ error: "El ajuste no puede ser mayor que el total de la venta." });
        }
    }

    if (clienteId !== null && (!Number.isInteger(clienteId) || clienteId <= 0)) {
        return res.status(400).json({ error: "El cliente elegido no es válido." });
    }

    // Una venta fiada queda como deuda del cliente: hay que saber quién es.
    if (metodoPago === "fiado" && clienteId === null) {
        return res.status(400).json({ error: "Para vender fiado elige o registra al cliente." });
    }

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        // Se bloquean los productos en orden de id para evitar bloqueos cruzados.
        const ids = [...new Set(items.map((item) => item.productoId))].sort((a, b) => a - b);
        const resultado = await client.query(
            `SELECT id, nombre, precio_minimo, precio_minimo_docena, precio_compra, stock, stock_2025
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

            if (item.obsequio === true) {
                // Un empleado solo puede obsequiar mercadería barata; el jefe, cualquiera.
                const costo = producto.precio_compra === null ? null : Number(producto.precio_compra);

                if (!esJefe && (costo === null || costo >= COSTO_MAXIMO_OBSEQUIO)) {
                    await client.query("ROLLBACK");
                    return res.status(400).json({
                        error: `${producto.nombre} no se puede obsequiar: solo mercadería que cueste menos de S/ ${COSTO_MAXIMO_OBSEQUIO.toFixed(2)} por unidad.`
                    });
                }

                continue;
            }

            const minimo = Number(esDocena ? producto.precio_minimo_docena : producto.precio_minimo);

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
                if (bloqueado(req, "bloqueoAutorizacion")) {
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
                    anotarFallo(req, "bloqueoAutorizacion");
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

        // El ajuste se reparte entre los productos: así totales, ganancias y deudas ya lo descuentan.
        const importes = items.map((item) => Number((Number(item.precio.toFixed(2)) * item.cantidad).toFixed(2)));
        const descuentos = ajusteVenta ? repartirAjuste(importes, ajusteVenta.monto) : importes.map(() => 0);

        // Unidades del 2025 que quedan por producto: se descuentan primero.
        const quedan2025 = new Map([...productos.values()].map((p) => [p.id, p.stock_2025]));

        for (const [indice, item] of items.entries()) {
            const producto = productos.get(item.productoId);
            const modalidad = item.modalidad ?? "unidad";
            const esDocena = modalidad === "docena";
            const unidades = item.cantidad * (esDocena ? 12 : 1);
            const precioVenta = Number(item.precio.toFixed(2));
            const descuento = descuentos[indice];
            const total = Number((importes[indice] - descuento).toFixed(2));
            const precioUnitario = Number((esDocena ? precioVenta / 12 : precioVenta).toFixed(2));
            const unidades2025 = Math.min(quedan2025.get(producto.id), unidades);
            quedan2025.set(producto.id, quedan2025.get(producto.id) - unidades2025);

            await client.query(
                `INSERT INTO ventas
                    (producto_id, cantidad, precio_unitario, costo_unitario, total,
                     usuario_id, metodo_pago, modalidad, grupo, autorizado_por, unidades_2025, cliente_id,
                     descuento, codigo_ajuste, obsequio, fecha)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
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
                    autorizadoPor,
                    unidades2025,
                    clienteId,
                    descuento,
                    ajusteVenta?.codigo ?? null,
                    item.obsequio === true
                ]
            );
        }

        for (const [id, unidades] of unidadesPorProducto) {
            await client.query(
                `UPDATE productos SET stock = stock - $1, stock_2025 = $2 WHERE id = $3`,
                [unidades, quedan2025.get(id), id]
            );
        }

        await client.query("COMMIT");

        const boleta = armarBoleta(await consultarVentas(pool, esJefe, { grupo }));

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

/* Historial por partes: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&pagina=0
   Devuelve { filas, hayMas }: hasta 30 ventas completas por página (una fila por producto). */
router.get("/", requiereSesion, async (req, res) => {
    try {
        const esJefe = req.session.usuario.rol === "jefe";
        const filas = await consultarVentas(pool, esJefe, req.query);
        const grupos = [...new Set(filas.map((f) => f.grupo))];
        const hayMas = grupos.length > 30;
        const visibles = new Set(grupos.slice(0, 30));

        res.json({ filas: filas.filter((f) => visibles.has(f.grupo)), hayMas });
    } catch (error) {
        console.error("Error al consultar las ventas:", error.message);
        res.status(500).json({ error: "No se pudo consultar el historial de ventas." });
    }
});

// Totales del periodo (ventas, unidades y, para el jefe, dinero y ganancias). Sin anuladas.
router.get("/totales", requiereSesion, async (req, res) => {
    try {
        res.json(await totalesVentas(pool, req.session.usuario.rol === "jefe", req.query));
    } catch (error) {
        console.error("Error al calcular los totales:", error.message);
        res.status(500).json({ error: "No se pudieron calcular los totales." });
    }
});

const FORMATO_GRUPO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Anular una venta completa (solo el jefe). Devuelve el stock (y las unidades del 2025),
   deja anotado quién la anuló y por qué, y la venta deja de contar en totales y ganancias. */
router.post("/:grupo/anular", requiereJefe, async (req, res) => {
    const { grupo } = req.params;
    const motivo = typeof req.body?.motivo === "string" ? req.body.motivo.trim() : "";

    if (!FORMATO_GRUPO.test(grupo)) {
        return res.status(404).json({ error: "Venta no encontrada." });
    }

    if (!motivo || motivo.length > 200) {
        return res.status(400).json({ error: "Escribe el motivo de la anulación (máximo 200 caracteres)." });
    }

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const filas = await client.query(
            `SELECT id, producto_id, cantidad, unidades_2025, anulada_en
             FROM ventas WHERE grupo = $1
             ORDER BY producto_id
             FOR UPDATE`,
            [grupo]
        );

        if (filas.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Venta no encontrada." });
        }

        if (filas.rows.some((f) => f.anulada_en)) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "Esta venta ya estaba anulada." });
        }

        for (const fila of filas.rows) {
            await client.query(
                `UPDATE productos
                 SET stock = stock + $1, stock_2025 = stock_2025 + $2
                 WHERE id = $3`,
                [fila.cantidad, fila.unidades_2025, fila.producto_id]
            );
        }

        await client.query(
            `UPDATE ventas
             SET anulada_en = CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima',
                 anulada_por = $1,
                 motivo_anulacion = $2
             WHERE grupo = $3`,
            [req.session.usuario.id, motivo, grupo]
        );

        await client.query("COMMIT");
        res.json({ mensaje: "Venta anulada. El stock se devolvió al inventario." });
    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        console.error("Error al anular la venta:", error.message);
        res.status(500).json({ error: "No se pudo anular la venta." });
    } finally {
        client?.release();
    }
});

module.exports = { router };
