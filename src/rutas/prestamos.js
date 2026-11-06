const express = require("express");
const pool = require("../db");
const { requiereJefe, leerId } = require("../autenticacion");

/* Préstamos (capital financiado), solo el jefe.
   - Cada préstamo: quién prestó, cuánto se recibió y cuánto hay que devolver (con intereses).
   - Usos: en qué se gastó el dinero, como inversión en productos o como gasto. Se guardan en
     las tablas de inversiones y gastos de siempre (con prestamo_id), así cuentan en los reportes.
   - Pagos: lo que se devuelve. La parte de interés se registra como gasto ("Intereses"). */
const router = express.Router();
router.use(requiereJefe);

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIAS_USO = ["Mercadería", "Transporte", "Alquiler", "Servicios", "Sueldos", "Embalaje", "Otros"];

const esMonto = (valor, maximo = 99999999) =>
    typeof valor === "number" && Number.isFinite(valor) && valor > 0 && valor <= maximo;
const esFecha = (valor) => typeof valor === "string" && FECHA.test(valor) && !Number.isNaN(Date.parse(valor));
const texto = (valor, limite) => (typeof valor === "string" ? valor.trim().slice(0, limite) : "");
const redondear = (valor) => Math.round(valor * 100) / 100;

// Lista de préstamos con sus usos, pagos y saldos.
async function leerPrestamos(consulta = pool) {
    const [prestamos, usos, pagos] = await Promise.all([
        consulta.query(
            `SELECT prestamos.id, prestamos.prestamista, prestamos.monto,
                    COALESCE(prestamos.total_devolver, prestamos.monto) AS "totalDevolver",
                    TO_CHAR(prestamos.fecha, 'YYYY-MM-DD') AS fecha, prestamos.nota,
                    COALESCE(usuarios.nombre, 'No registrado') AS "registradoPor"
             FROM prestamos LEFT JOIN usuarios ON usuarios.id = prestamos.usuario_id
             ORDER BY prestamos.fecha DESC, prestamos.id DESC`
        ),
        consulta.query(
            `SELECT 'inversion' AS tipo, id, prestamo_id AS "prestamoId", descripcion, NULL AS categoria, monto,
                    TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha
             FROM inversiones WHERE prestamo_id IS NOT NULL
             UNION ALL
             SELECT 'gasto', id, prestamo_id, descripcion, categoria, monto, TO_CHAR(fecha, 'YYYY-MM-DD')
             FROM gastos WHERE prestamo_id IS NOT NULL
             ORDER BY fecha DESC, id DESC`
        ),
        consulta.query(
            `SELECT prestamo_pagos.id, prestamo_pagos.prestamo_id AS "prestamoId", prestamo_pagos.monto,
                    COALESCE(gastos.monto, 0) AS interes, TO_CHAR(prestamo_pagos.fecha, 'YYYY-MM-DD') AS fecha,
                    prestamo_pagos.nota
             FROM prestamo_pagos LEFT JOIN gastos ON gastos.id = prestamo_pagos.gasto_id
             ORDER BY prestamo_pagos.fecha DESC, prestamo_pagos.id DESC`
        )
    ]);

    return prestamos.rows.map((p) => {
        const suyos = usos.rows.filter((u) => u.prestamoId === p.id);
        const susPagos = pagos.rows.filter((pg) => pg.prestamoId === p.id);
        const enInversion = suyos.filter((u) => u.tipo === "inversion").reduce((s, u) => s + Number(u.monto), 0);
        const enGastos = suyos.filter((u) => u.tipo === "gasto").reduce((s, u) => s + Number(u.monto), 0);
        const pagado = susPagos.reduce((s, pg) => s + Number(pg.monto), 0);

        return {
            ...p,
            enInversion: redondear(enInversion).toFixed(2),
            enGastos: redondear(enGastos).toFixed(2),
            sinUsar: redondear(Math.max(Number(p.monto) - enInversion - enGastos, 0)).toFixed(2),
            pagado: redondear(pagado).toFixed(2),
            porPagar: redondear(Math.max(Number(p.totalDevolver) - pagado, 0)).toFixed(2),
            usos: suyos,
            pagos: susPagos
        };
    });
}

// Cuánto queda sin usar de un préstamo (dentro de una transacción, para validar un uso nuevo).
async function disponibleDe(consulta, prestamoId) {
    const resultado = await consulta.query(
        `SELECT prestamos.prestamista, prestamos.monto
                - COALESCE((SELECT SUM(monto) FROM inversiones WHERE prestamo_id = prestamos.id), 0)
                - COALESCE((SELECT SUM(monto) FROM gastos WHERE prestamo_id = prestamos.id), 0) AS disponible
         FROM prestamos WHERE id = $1 FOR UPDATE`,
        [prestamoId]
    );
    return resultado.rows[0] ? { prestamista: resultado.rows[0].prestamista, disponible: Number(resultado.rows[0].disponible) } : null;
}

router.get("/", async (req, res) => {
    try {
        res.json(await leerPrestamos());
    } catch (error) {
        console.error("Error al leer los préstamos:", error.message);
        res.status(500).json({ error: "No se pudieron cargar los préstamos." });
    }
});

// Registrar un préstamo: { prestamista, monto, totalDevolver?, fecha, nota? }.
router.post("/", async (req, res) => {
    const prestamista = texto(req.body?.prestamista, 120);
    const { monto, totalDevolver = null, fecha } = req.body ?? {};

    if (!prestamista) return res.status(400).json({ error: "Escribe quién te prestó (banco, caja o persona)." });
    if (!esMonto(monto)) return res.status(400).json({ error: "Escribe cuánto dinero recibiste." });
    if (totalDevolver !== null && (!esMonto(totalDevolver) || totalDevolver < monto)) {
        return res.status(400).json({ error: "El total a devolver no puede ser menor que lo recibido." });
    }
    if (!esFecha(fecha)) return res.status(400).json({ error: "La fecha no es válida." });

    try {
        await pool.query(
            `INSERT INTO prestamos (prestamista, monto, total_devolver, fecha, nota, usuario_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [prestamista, redondear(monto), totalDevolver === null ? null : redondear(totalDevolver), fecha,
             texto(req.body?.nota, 200) || null, req.session.usuario.id]
        );
        res.status(201).json({ mensaje: `Préstamo de ${prestamista} registrado.`, prestamos: await leerPrestamos() });
    } catch (error) {
        console.error("Error al registrar el préstamo:", error.message);
        res.status(500).json({ error: "No se pudo registrar el préstamo." });
    }
});

// Eliminar un préstamo (solo si no tiene pagos). Sus usos siguen como inversión o gasto normales.
router.delete("/:id", async (req, res) => {
    const id = leerId(req);
    if (!id) return res.status(400).json({ error: "Préstamo inválido." });

    try {
        const pagos = await pool.query(`SELECT 1 FROM prestamo_pagos WHERE prestamo_id = $1 LIMIT 1`, [id]);
        if (pagos.rows.length > 0) {
            return res.status(409).json({ error: "Este préstamo ya tiene pagos: quítalos primero si fue un error." });
        }

        const borrado = await pool.query(`DELETE FROM prestamos WHERE id = $1`, [id]);
        if (borrado.rowCount === 0) return res.status(404).json({ error: "Préstamo no encontrado." });

        res.json({ mensaje: "Préstamo eliminado.", prestamos: await leerPrestamos() });
    } catch (error) {
        console.error("Error al eliminar el préstamo:", error.message);
        res.status(500).json({ error: "No se pudo eliminar el préstamo." });
    }
});

/* Registrar en qué se usó el dinero: { tipo: "inversion" | "gasto", descripcion, monto, fecha, categoria? }.
   No se puede usar más de lo que queda sin usar del préstamo. */
router.post("/:id/usos", async (req, res) => {
    const id = leerId(req);
    const { tipo, monto, fecha, categoria = "Otros" } = req.body ?? {};
    const descripcion = texto(req.body?.descripcion, 200);

    if (!id) return res.status(400).json({ error: "Préstamo inválido." });
    if (!["inversion", "gasto"].includes(tipo)) return res.status(400).json({ error: "Elige si fue inversión en productos o gasto." });
    if (!descripcion) return res.status(400).json({ error: "Escribe en qué se usó el dinero." });
    if (!esMonto(monto)) return res.status(400).json({ error: "Escribe el monto." });
    if (!esFecha(fecha)) return res.status(400).json({ error: "La fecha no es válida." });
    if (tipo === "gasto" && !CATEGORIAS_USO.includes(categoria)) return res.status(400).json({ error: "Elige la categoría del gasto." });

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const prestamo = await disponibleDe(client, id);
        if (!prestamo) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Préstamo no encontrado." });
        }

        if (redondear(monto) > redondear(prestamo.disponible)) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: `Del préstamo de ${prestamo.prestamista} solo quedan S/ ${prestamo.disponible.toFixed(2)} sin usar.` });
        }

        if (tipo === "inversion") {
            await client.query(
                `INSERT INTO inversiones (descripcion, monto, fecha, usuario_id, prestamo_id) VALUES ($1, $2, $3, $4, $5)`,
                [descripcion, redondear(monto), fecha, req.session.usuario.id, id]
            );
        } else {
            await client.query(
                `INSERT INTO gastos (descripcion, categoria, monto, fecha, usuario_id, prestamo_id) VALUES ($1, $2, $3, $4, $5, $6)`,
                [descripcion, categoria, redondear(monto), fecha, req.session.usuario.id, id]
            );
        }

        await client.query("COMMIT");
        res.status(201).json({
            mensaje: tipo === "inversion" ? "Uso registrado como inversión." : "Uso registrado como gasto.",
            prestamos: await leerPrestamos()
        });
    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        console.error("Error al registrar el uso del préstamo:", error.message);
        res.status(500).json({ error: "No se pudo registrar el uso." });
    } finally {
        client?.release();
    }
});

// Quitar un uso (por error): se borra esa inversión o gasto.
router.delete("/usos/:tipo/:id", async (req, res) => {
    const id = leerId(req);
    const tabla = { inversion: "inversiones", gasto: "gastos" }[req.params.tipo];
    if (!id || !tabla) return res.status(400).json({ error: "Uso inválido." });

    try {
        const borrado = await pool.query(`DELETE FROM ${tabla} WHERE id = $1 AND prestamo_id IS NOT NULL`, [id]);
        if (borrado.rowCount === 0) return res.status(404).json({ error: "Ese uso ya no existe." });
        res.json({ mensaje: "Uso eliminado.", prestamos: await leerPrestamos() });
    } catch (error) {
        console.error("Error al quitar el uso:", error.message);
        res.status(500).json({ error: "No se pudo quitar el uso." });
    }
});

/* Registrar un pago del préstamo: { monto, interes?, fecha, nota? }.
   La parte de interés es un costo: se registra como gasto "Intereses" (baja la ganancia neta). */
router.post("/:id/pagos", async (req, res) => {
    const id = leerId(req);
    const { monto, interes = 0, fecha } = req.body ?? {};

    if (!id) return res.status(400).json({ error: "Préstamo inválido." });
    if (!esMonto(monto)) return res.status(400).json({ error: "Escribe cuánto pagaste." });
    if (typeof interes !== "number" || !Number.isFinite(interes) || interes < 0 || interes > monto) {
        return res.status(400).json({ error: "El interés no puede ser mayor que el pago." });
    }
    if (!esFecha(fecha)) return res.status(400).json({ error: "La fecha no es válida." });

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const fila = await client.query(
            `SELECT prestamista, COALESCE(total_devolver, monto)
                    - COALESCE((SELECT SUM(monto) FROM prestamo_pagos WHERE prestamo_id = prestamos.id), 0) AS "porPagar"
             FROM prestamos WHERE id = $1 FOR UPDATE`,
            [id]
        );
        const prestamo = fila.rows[0];

        if (!prestamo) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Préstamo no encontrado." });
        }

        if (redondear(monto) > redondear(Number(prestamo.porPagar))) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: `Solo faltan pagar S/ ${Number(prestamo.porPagar).toFixed(2)} de este préstamo.` });
        }

        let gastoId = null;
        if (interes > 0) {
            const gasto = await client.query(
                `INSERT INTO gastos (descripcion, categoria, monto, fecha, usuario_id)
                 VALUES ($1, 'Intereses', $2, $3, $4) RETURNING id`,
                [`Interés del préstamo de ${prestamo.prestamista}`.slice(0, 200), redondear(interes), fecha, req.session.usuario.id]
            );
            gastoId = gasto.rows[0].id;
        }

        await client.query(
            `INSERT INTO prestamo_pagos (prestamo_id, monto, fecha, nota, gasto_id, usuario_id) VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, redondear(monto), fecha, texto(req.body?.nota, 200) || null, gastoId, req.session.usuario.id]
        );

        await client.query("COMMIT");
        res.status(201).json({ mensaje: "Pago registrado.", prestamos: await leerPrestamos() });
    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        console.error("Error al registrar el pago:", error.message);
        res.status(500).json({ error: "No se pudo registrar el pago." });
    } finally {
        client?.release();
    }
});

// Quitar un pago (por error): también se borra su gasto de interés.
router.delete("/pagos/:id", async (req, res) => {
    const id = leerId(req);
    if (!id) return res.status(400).json({ error: "Pago inválido." });

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");
        const borrado = await client.query(`DELETE FROM prestamo_pagos WHERE id = $1 RETURNING gasto_id`, [id]);

        if (borrado.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Ese pago ya no existe." });
        }

        if (borrado.rows[0].gasto_id) {
            await client.query(`DELETE FROM gastos WHERE id = $1`, [borrado.rows[0].gasto_id]);
        }

        await client.query("COMMIT");
        res.json({ mensaje: "Pago eliminado.", prestamos: await leerPrestamos() });
    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        console.error("Error al quitar el pago:", error.message);
        res.status(500).json({ error: "No se pudo quitar el pago." });
    } finally {
        client?.release();
    }
});

module.exports = { router, disponibleDe };
