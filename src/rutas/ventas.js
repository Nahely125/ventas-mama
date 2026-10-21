const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");
const { requiereSesion, requiereJefe } = require("../autenticacion");

const router = express.Router();

const {
    METODOS_PAGO,
    MODALIDADES,
    UNIDADES_MODALIDAD,
    MAXIMO_PRODUCTOS,
    INTENTOS_MAXIMOS,
    BLOQUEO_MS,
    consultarVentas,
    totalesVentas,
    armarBoleta
} = require("./consultasVentas");
const { SALDO } = require("./clientes");
const { COSTO_MAXIMO_OBSEQUIO, OBSEQUIABLE, normalizarCodigo, resolverAjuste, repartirAjuste } = require("./ajustes");

const NOMBRE_MODALIDAD = { unidad: "unidad", media: "media docena", docena: "docena" };

// Precio mínimo de la modalidad: la media docena tiene la mitad del mínimo de la docena.
function minimoDe(producto, modalidad) {
    if (modalidad === "docena") return Number(producto.precio_minimo_docena);
    if (modalidad === "media") return Number((Number(producto.precio_minimo_docena) / 2).toFixed(2));
    return Number(producto.precio_minimo);
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

/* Revisa los obsequios de un empleado: [{ producto, unidades }] (producto con obsequiable,
   stock_2025, precio_docena y precio_compra). Las unidades del 2025 salen primero y valen su precio
   por unidad en la docena; las nuevas, su costo (que debe ser menor a S/ 5).
   Devuelve el mensaje de error o null. Los mensajes no muestran montos (el empleado no ve costos). */
function errorObsequios(regalos) {
    const quedan2025 = new Map();
    let valor = 0;

    for (const { producto, unidades } of regalos) {
        if (!producto.obsequiable) {
            return `${producto.nombre} no se puede obsequiar.`;
        }

        const disponibles = quedan2025.get(producto.id) ?? Number(producto.stock_2025);
        const de2025 = Math.min(disponibles, unidades);
        const nuevas = unidades - de2025;
        const costo = producto.precio_compra === null ? null : Number(producto.precio_compra);
        quedan2025.set(producto.id, disponibles - de2025);

        if (nuevas > 0 && (costo === null || costo >= COSTO_MAXIMO_OBSEQUIO)) {
            return `${producto.nombre} no se puede obsequiar en esa cantidad.`;
        }

        valor += de2025 * (Number(producto.precio_docena) / 12) + nuevas * (costo ?? 0);
    }

    // Máximo de S/ 5 por venta.
    return Math.round(valor * 100) > COSTO_MAXIMO_OBSEQUIO * 100
        ? "El obsequio pasa del máximo permitido. Regala menos unidades u otro producto, o pídeselo al jefe."
        : null;
}

// Revisiones de obsequio permitidas a un empleado cada 10 minutos. Se cuentan por usuario (en memoria
// del servidor), así volver a iniciar sesión no las reinicia. También cuentan las ventas con obsequio.
const MAXIMO_CONSULTAS_OBSEQUIO = 30;
const consultasObsequio = new Map();

function puedeRevisarObsequio(usuarioId) {
    const ahora = Date.now();
    const actual = consultasObsequio.get(usuarioId);
    const vigente = actual && actual.desde > ahora - BLOQUEO_MS ? actual : { cantidad: 0, desde: ahora };

    if (vigente.cantidad >= MAXIMO_CONSULTAS_OBSEQUIO) {
        return false;
    }

    consultasObsequio.set(usuarioId, { ...vigente, cantidad: vigente.cantidad + 1 });
    return true;
}

/* Antes de agregar un obsequio a la venta: { obsequios: [{ productoId, cantidad }] } con todos los
   regalos de la venta (los que ya están y el nuevo). Responde { ok: true } o el error. El jefe no tiene límite. */
router.post("/validar-obsequio", requiereSesion, async (req, res) => {
    const obsequios = req.body?.obsequios;

    if (
        !Array.isArray(obsequios) || obsequios.length === 0 || obsequios.length > MAXIMO_PRODUCTOS ||
        obsequios.some((o) => !Number.isInteger(o?.productoId) || o.productoId <= 0 || !Number.isInteger(o.cantidad) || o.cantidad <= 0)
    ) {
        return res.status(400).json({ error: "Revisa el producto y la cantidad del obsequio." });
    }

    if (req.session.usuario.rol === "jefe") {
        return res.json({ ok: true });
    }

    // Límite de consultas: probando cantidades se podría deducir el costo, que el empleado no ve.
    if (!puedeRevisarObsequio(req.session.usuario.id)) {
        return res.status(429).json({ error: "Demasiadas revisiones de obsequios. Espera unos minutos." });
    }

    try {
        const resultado = await pool.query(
            `SELECT id, nombre, stock_2025, precio_docena, precio_compra, ${OBSEQUIABLE} AS obsequiable
             FROM productos
             WHERE id = ANY($1::int[])`,
            [[...new Set(obsequios.map((o) => o.productoId))]]
        );
        const productos = new Map(resultado.rows.map((p) => [p.id, p]));

        if (obsequios.some((o) => !productos.has(o.productoId))) {
            return res.status(404).json({ error: "Uno de los productos ya no existe." });
        }

        const error = errorObsequios(obsequios.map((o) => ({ producto: productos.get(o.productoId), unidades: o.cantidad })));
        return error ? res.status(400).json({ error }) : res.json({ ok: true });
    } catch (error) {
        console.error("Error al revisar el obsequio:", error.message);
        res.status(500).json({ error: "No se pudo revisar el obsequio." });
    }
});

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
            return res.status(400).json({ error: "El código de descuento no es válido." });
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
     cantidad: número de unidades, medias docenas o docenas, según la modalidad.
     precio: precio por unidad, por media docena o por docena; puede ajustarse. Obsequio: precio 0, por unidad.
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
            return res.status(500).json({ error: "No se pudo validar el descuento." });
        }

        if (ajusteVenta.error) {
            if (ajusteVenta.codigoInvalido) anotarFallo(req, "bloqueoAjuste");
            return res.status(400).json({ error: ajusteVenta.error });
        }

        const subtotal = items.reduce((suma, item) => suma + Number(item.precio.toFixed(2)) * item.cantidad, 0);

        if (Math.round(ajusteVenta.monto * 100) > Math.round(subtotal * 100)) {
            return res.status(400).json({ error: "El descuento no puede ser mayor que el total de la venta." });
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
            `SELECT id, nombre, precio_minimo, precio_minimo_docena, precio_docena, precio_compra, stock, stock_2025,
                    ${OBSEQUIABLE} AS obsequiable
             FROM productos
             WHERE id = ANY($1::int[])
             ORDER BY id
             FOR UPDATE`,
            [ids]
        );

        const productos = new Map(resultado.rows.map((p) => [p.id, p]));
        const unidadesPorProducto = new Map();
        const bajoMinimo = [];
        // Lo que se regala en esta venta (un empleado tiene límites).
        const regalos = [];

        for (const item of items) {
            const producto = productos.get(item.productoId);

            if (!producto) {
                await client.query("ROLLBACK");
                return res.status(404).json({ error: "Uno de los productos ya no existe." });
            }

            const modalidad = item.modalidad ?? "unidad";
            const unidades = item.cantidad * UNIDADES_MODALIDAD[modalidad];
            unidadesPorProducto.set(producto.id, (unidadesPorProducto.get(producto.id) ?? 0) + unidades);

            if (item.obsequio === true) {
                regalos.push({ producto, unidades });
                continue;
            }

            const minimo = minimoDe(producto, modalidad);

            if (Math.round(item.precio * 100) < Math.round(minimo * 100)) {
                bajoMinimo.push(`${producto.nombre} (mínimo S/ ${minimo.toFixed(2)} por ${NOMBRE_MODALIDAD[modalidad]})`);
            }
        }

        // Un descuento tampoco puede dejar la venta (sin obsequios) por debajo de la suma de los
        // mínimos: el empleado necesita la contraseña del jefe, igual que con un precio bajo el mínimo.
        if (ajusteVenta && !esJefe) {
            let minimoVenta = 0;
            let subtotalVenta = 0;

            for (const item of items) {
                if (item.obsequio === true) continue;
                minimoVenta += minimoDe(productos.get(item.productoId), item.modalidad ?? "unidad") * item.cantidad;
                subtotalVenta += Number(item.precio.toFixed(2)) * item.cantidad;
            }

            if (Math.round((subtotalVenta - ajusteVenta.monto) * 100) < Math.round(minimoVenta * 100)) {
                bajoMinimo.push(`descuento ${ajusteVenta.codigo} (la venta queda por debajo del mínimo de S/ ${minimoVenta.toFixed(2)})`);
            }
        }

        // Se vuelve a revisar al cobrar (por si cambió algo); el jefe regala lo que quiera.
        // Esta revisión también cuenta para el límite (si no, se podría usar para deducir costos).
        if (!esJefe && regalos.length > 0 && !puedeRevisarObsequio(usuario.id)) {
            await client.query("ROLLBACK");
            return res.status(429).json({ error: "Demasiadas revisiones de obsequios. Espera unos minutos." });
        }

        const errorRegalos = esJefe ? null : errorObsequios(regalos);

        if (errorRegalos) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: errorRegalos });
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

        // Unidades del 2025 que quedan por producto: se descuentan primero, y antes en los obsequios
        // (así el obsequio vale lo que se revisó y lo ya pagado se regala antes que lo nuevo).
        const quedan2025 = new Map([...productos.values()].map((p) => [p.id, p.stock_2025]));
        const unidades2025Por = new Map();
        const ordenReparto = [...items.keys()].sort(
            (a, b) => Number(items[b].obsequio === true) - Number(items[a].obsequio === true)
        );

        for (const indice of ordenReparto) {
            const item = items[indice];
            const unidades = item.cantidad * UNIDADES_MODALIDAD[item.modalidad ?? "unidad"];
            const disponibles = quedan2025.get(item.productoId);
            const de2025 = Math.min(disponibles, unidades);
            quedan2025.set(item.productoId, disponibles - de2025);
            unidades2025Por.set(indice, de2025);
        }

        for (const [indice, item] of items.entries()) {
            const producto = productos.get(item.productoId);
            const modalidad = item.modalidad ?? "unidad";
            const unidades = item.cantidad * UNIDADES_MODALIDAD[modalidad];
            const precioVenta = Number(item.precio.toFixed(2));
            const descuento = descuentos[indice];
            const total = Number((importes[indice] - descuento).toFixed(2));
            const precioUnitario = Number((precioVenta / UNIDADES_MODALIDAD[modalidad]).toFixed(2));
            const unidades2025 = unidades2025Por.get(indice);

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

// Fiado: si el cliente ya abonó, quitarle deuda podría dejarle saldo a favor (deuda negativa).
async function errorSaldoFiado(client, fila, monto, accion) {
    if (fila.metodo_pago !== "fiado" || !fila.cliente_id) return null;

    const deuda = await client.query(
        `SELECT ROUND(${SALDO}, 2) AS saldo FROM clientes WHERE id = $1 FOR UPDATE`,
        [fila.cliente_id]
    );
    const saldo = Number(deuda.rows[0]?.saldo ?? 0);

    return Math.round((saldo - monto) * 100) < 0
        ? `El cliente ya abonó parte de esta venta: su deuda es S/ ${saldo.toFixed(2)} y ${accion} es de S/ ${monto.toFixed(2)}. Elimina primero los abonos que sobren (en Clientes) y luego vuelve a intentarlo.`
        : null;
}

/* Anular una venta completa (solo el jefe). Devuelve el stock (y las unidades del 2025),
   deja anotado quién la anuló y por qué, y la venta deja de contar en totales y ganancias.
   Si algún producto ya se había devuelto entero, solo se anula lo que queda. */
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
            `SELECT id, producto_id, cantidad, unidades_2025, anulada_en, total, metodo_pago, cliente_id
             FROM ventas WHERE grupo = $1
             ORDER BY producto_id
             FOR UPDATE`,
            [grupo]
        );

        if (filas.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Venta no encontrada." });
        }

        const activas = filas.rows.filter((f) => !f.anulada_en);

        if (activas.length === 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "Esta venta ya estaba anulada." });
        }

        const totalVenta = activas.reduce((suma, f) => suma + Number(f.total), 0);
        const errorFiado = await errorSaldoFiado(client, activas[0], totalVenta, "la venta");

        if (errorFiado) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: errorFiado });
        }

        for (const fila of activas) {
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
             WHERE grupo = $3 AND anulada_en IS NULL`,
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

/* Devolución parcial (solo el jefe): { ventaId, unidades, motivo } devuelve unidades de un
   producto de la boleta. La fila se reduce en proporción (cantidad, total y descuento), el stock
   vuelve al inventario (primero como mercadería nueva) y queda anotada en devoluciones con su
   fecha, para el cierre de caja. Si se devuelve todo el producto, esa fila queda como anulada. */
router.post("/:grupo/devolver", requiereJefe, async (req, res) => {
    const { grupo } = req.params;
    const { ventaId, unidades } = req.body ?? {};
    const motivo = typeof req.body?.motivo === "string" ? req.body.motivo.trim() : "";

    if (!FORMATO_GRUPO.test(grupo)) {
        return res.status(404).json({ error: "Venta no encontrada." });
    }

    if (!Number.isInteger(ventaId) || ventaId <= 0 || !Number.isInteger(unidades) || unidades <= 0) {
        return res.status(400).json({ error: "Indica el producto y cuántas unidades se devuelven." });
    }

    if (!motivo || motivo.length > 200) {
        return res.status(400).json({ error: "Escribe el motivo de la devolución (máximo 200 caracteres)." });
    }

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const filas = await client.query(
            `SELECT id, producto_id, cantidad, modalidad, total, descuento, unidades_2025, anulada_en,
                    metodo_pago, cliente_id
             FROM ventas WHERE grupo = $1
             ORDER BY id
             FOR UPDATE`,
            [grupo]
        );
        const fila = filas.rows.find((f) => f.id === ventaId);

        if (!fila) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Ese producto no está en la venta." });
        }

        if (fila.anulada_en) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "Ese producto ya se anuló o se devolvió completo." });
        }

        if (unidades > fila.cantidad) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: `Solo se vendieron ${fila.cantidad} unidades de ese producto.` });
        }

        const devuelveTodo = unidades === fila.cantidad;

        if (devuelveTodo && filas.rows.filter((f) => !f.anulada_en).length === 1) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Es el único producto de la venta: para devolverlo todo, anula la venta." });
        }

        // Lo que queda de la fila, en proporción a las unidades que quedan.
        const quedan = fila.cantidad - unidades;
        const total = Number(fila.total);
        const nuevoTotal = devuelveTodo ? 0 : Number((total * quedan / fila.cantidad).toFixed(2));
        const monto = Number((total - nuevoTotal).toFixed(2));
        const nuevoDescuento = devuelveTodo ? Number(fila.descuento) : Number((Number(fila.descuento) * quedan / fila.cantidad).toFixed(2));
        // Se devuelven primero unidades nuevas; las del 2025, solo si no alcanzan.
        const devueltas2025 = Math.max(0, unidades - (fila.cantidad - fila.unidades_2025));
        // Si ya no completa la media docena o la docena, lo que queda se muestra por unidad.
        const modalidad = quedan % UNIDADES_MODALIDAD[fila.modalidad] === 0 ? fila.modalidad : "unidad";

        const errorFiado = await errorSaldoFiado(client, fila, monto, "la devolución");

        if (errorFiado) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: errorFiado });
        }

        if (devuelveTodo) {
            await client.query(
                `UPDATE ventas
                 SET anulada_en = CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima',
                     anulada_por = $1,
                     motivo_anulacion = $2,
                     unidades_devueltas = unidades_devueltas + $3
                 WHERE id = $4`,
                [req.session.usuario.id, `Devolución: ${motivo}`.slice(0, 200), unidades, fila.id]
            );
        } else {
            await client.query(
                `UPDATE ventas
                 SET cantidad = $1, total = $2, descuento = $3, unidades_2025 = unidades_2025 - $4,
                     modalidad = $5, unidades_devueltas = unidades_devueltas + $6
                 WHERE id = $7`,
                [quedan, nuevoTotal, nuevoDescuento, devueltas2025, modalidad, unidades, fila.id]
            );
        }

        await client.query(
            `UPDATE productos SET stock = stock + $1, stock_2025 = stock_2025 + $2 WHERE id = $3`,
            [unidades, devueltas2025, fila.producto_id]
        );

        await client.query(
            `INSERT INTO devoluciones
                (grupo, venta_id, producto_id, unidades, monto, unidades_2025, metodo_pago, motivo, usuario_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [grupo, fila.id, fila.producto_id, unidades, monto, devueltas2025, fila.metodo_pago, motivo, req.session.usuario.id]
        );

        await client.query("COMMIT");
        res.json({
            mensaje: fila.metodo_pago === "fiado"
                ? `Devolución registrada: se descontaron S/ ${monto.toFixed(2)} de la deuda del cliente.`
                : `Devolución registrada: devuelve S/ ${monto.toFixed(2)} al cliente.`,
            monto: monto.toFixed(2)
        });
    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        console.error("Error al registrar la devolución:", error.message);
        res.status(500).json({ error: "No se pudo registrar la devolución." });
    } finally {
        client?.release();
    }
});

module.exports = { router };
