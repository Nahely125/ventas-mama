const express = require("express");
const pool = require("../db");
const { requiereSesion, requiereJefe, leerId } = require("../autenticacion");

// Clientes frecuentes y fiados: lo que debe cada cliente = ventas fiadas (no anuladas) − abonos.
const router = express.Router();

const METODOS_ABONO = ["efectivo", "yape", "plin", "transferencia"];

const SALDO = `
    COALESCE((SELECT SUM(v.total) FROM ventas v
              WHERE v.cliente_id = clientes.id AND v.metodo_pago = 'fiado' AND v.anulada_en IS NULL), 0)
  - COALESCE((SELECT SUM(a.monto) FROM abonos a WHERE a.cliente_id = clientes.id), 0)`;

const COLUMNAS = `
    clientes.id,
    clientes.nombre,
    clientes.telefono,
    clientes.notas,
    ROUND(${SALDO}, 2) AS saldo,
    (SELECT COUNT(DISTINCT v.grupo)::INT FROM ventas v
     WHERE v.cliente_id = clientes.id AND v.anulada_en IS NULL) AS compras
`;

// Deja solo los dígitos; los números peruanos de 9 dígitos se guardan con el 51 delante.
function normalizarTelefono(texto) {
    if (texto === undefined || texto === null || String(texto).trim() === "") return null;
    const digitos = String(texto).replace(/\D/g, "");
    if (/^9\d{8}$/.test(digitos)) return `51${digitos}`;
    return digitos.length >= 9 && digitos.length <= 15 ? digitos : undefined;
}

function validarCliente({ nombre, telefono, notas = "" }) {
    if (typeof nombre !== "string" || !nombre.trim() || nombre.trim().length > 100) {
        return { error: "El nombre del cliente es obligatorio (máximo 100 caracteres)." };
    }

    const numero = normalizarTelefono(telefono);

    if (numero === undefined) {
        return { error: "El número de WhatsApp no es válido. Ej. 987654321." };
    }

    if (typeof notas !== "string" || notas.length > 200) {
        return { error: "Las notas pueden tener hasta 200 caracteres." };
    }

    return { datos: { nombre: nombre.trim(), telefono: numero, notas: notas.trim() || null } };
}

function errorTelefonoRepetido(error, res) {
    if (error.code === "23505") {
        res.status(409).json({ error: "Ya hay un cliente con ese número de WhatsApp." });
        return true;
    }
    return false;
}

// Lista de clientes (con lo que deben). ?q= busca por nombre o número.
router.get("/", requiereSesion, async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    try {
        const resultado = await pool.query(
            `SELECT ${COLUMNAS}
             FROM clientes
             ${q ? "WHERE clientes.nombre ILIKE $1 OR clientes.telefono LIKE $2" : ""}
             ORDER BY (${SALDO}) > 0 DESC, clientes.nombre`,
            q ? [`%${q}%`, `%${q.replace(/\D/g, "") || "-"}%`] : []
        );
        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al consultar los clientes:", error.message);
        res.status(500).json({ error: "No se pudieron consultar los clientes." });
    }
});

router.post("/", requiereSesion, async (req, res) => {
    const { datos, error } = validarCliente(req.body ?? {});
    if (error) return res.status(400).json({ error });

    try {
        const resultado = await pool.query(
            `INSERT INTO clientes (nombre, telefono, notas) VALUES ($1, $2, $3) RETURNING id`,
            [datos.nombre, datos.telefono, datos.notas]
        );
        const cliente = await pool.query(`SELECT ${COLUMNAS} FROM clientes WHERE id = $1`, [resultado.rows[0].id]);
        res.status(201).json({ mensaje: "Cliente registrado.", cliente: cliente.rows[0] });
    } catch (err) {
        if (errorTelefonoRepetido(err, res)) return;
        console.error("Error al registrar el cliente:", err.message);
        res.status(500).json({ error: "No se pudo registrar el cliente." });
    }
});

router.put("/:id", requiereJefe, async (req, res) => {
    const id = leerId(req);
    const { datos, error } = validarCliente(req.body ?? {});
    if (!id) return res.status(400).json({ error: "Cliente inválido." });
    if (error) return res.status(400).json({ error });

    try {
        const resultado = await pool.query(
            `UPDATE clientes SET nombre = $1, telefono = $2, notas = $3 WHERE id = $4 RETURNING id`,
            [datos.nombre, datos.telefono, datos.notas, id]
        );
        if (resultado.rows.length === 0) return res.status(404).json({ error: "Cliente no encontrado." });
        res.json({ mensaje: "Cliente actualizado." });
    } catch (err) {
        if (errorTelefonoRepetido(err, res)) return;
        console.error("Error al actualizar el cliente:", err.message);
        res.status(500).json({ error: "No se pudo actualizar el cliente." });
    }
});

// Solo se elimina si no debe nada; sus ventas se conservan, sin el nombre del cliente.
router.delete("/:id", requiereJefe, async (req, res) => {
    const id = leerId(req);
    if (!id) return res.status(400).json({ error: "Cliente inválido." });

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const fila = await client.query(`SELECT ROUND(${SALDO}, 2) AS saldo FROM clientes WHERE id = $1 FOR UPDATE`, [id]);

        if (fila.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Cliente no encontrado." });
        }

        const saldo = Number(fila.rows[0].saldo);

        if (saldo > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "No se puede eliminar: el cliente todavía tiene deuda." });
        }

        if (saldo < 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({
                error: `No se puede eliminar: el cliente tiene S/ ${(-saldo).toFixed(2)} a favor. Revisa sus abonos primero.`
            });
        }

        await client.query(`UPDATE ventas SET cliente_id = NULL WHERE cliente_id = $1`, [id]);
        await client.query(`DELETE FROM clientes WHERE id = $1`, [id]);
        await client.query("COMMIT");
        res.json({ mensaje: "Cliente eliminado." });
    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        console.error("Error al eliminar el cliente:", error.message);
        res.status(500).json({ error: "No se pudo eliminar el cliente." });
    } finally {
        client?.release();
    }
});

// Detalle: compras fiadas y abonos de un cliente.
router.get("/:id", requiereSesion, async (req, res) => {
    const id = leerId(req);
    if (!id) return res.status(400).json({ error: "Cliente inválido." });

    try {
        const cliente = await pool.query(`SELECT ${COLUMNAS} FROM clientes WHERE id = $1`, [id]);
        if (cliente.rows.length === 0) return res.status(404).json({ error: "Cliente no encontrado." });

        const fiados = await pool.query(
            `SELECT
                ventas.grupo,
                MIN(ventas.id) AS numero,
                TO_CHAR(MIN(ventas.fecha), 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha,
                SUM(ventas.total) AS total,
                STRING_AGG(productos.nombre, ', ' ORDER BY ventas.id) AS productos,
                BOOL_OR(ventas.anulada_en IS NOT NULL) AS anulada
             FROM ventas
             INNER JOIN productos ON ventas.producto_id = productos.id
             WHERE ventas.cliente_id = $1 AND ventas.metodo_pago = 'fiado'
             GROUP BY ventas.grupo
             ORDER BY MIN(ventas.fecha) DESC`,
            [id]
        );

        const abonos = await pool.query(
            `SELECT abonos.id, abonos.monto, abonos.metodo_pago AS "metodoPago", abonos.nota,
                    TO_CHAR(abonos.fecha, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha,
                    COALESCE(usuarios.nombre, 'No registrado') AS "registradoPor"
             FROM abonos
             LEFT JOIN usuarios ON abonos.usuario_id = usuarios.id
             WHERE abonos.cliente_id = $1
             ORDER BY abonos.fecha DESC, abonos.id DESC`,
            [id]
        );

        res.json({ ...cliente.rows[0], fiados: fiados.rows, abonos: abonos.rows });
    } catch (error) {
        console.error("Error al consultar el cliente:", error.message);
        res.status(500).json({ error: "No se pudo consultar el cliente." });
    }
});

// Registrar un pago a cuenta (no puede superar lo que debe).
router.post("/:id/abonos", requiereSesion, async (req, res) => {
    const id = leerId(req);
    const { monto, metodoPago = "efectivo", nota = "" } = req.body ?? {};

    if (!id) return res.status(400).json({ error: "Cliente inválido." });

    if (typeof monto !== "number" || !Number.isFinite(monto) || monto <= 0) {
        return res.status(400).json({ error: "El monto del abono debe ser mayor que cero." });
    }

    if (!METODOS_ABONO.includes(metodoPago) || typeof nota !== "string" || nota.length > 200) {
        return res.status(400).json({ error: "Revisa el método de pago y la nota." });
    }

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const fila = await client.query(`SELECT ROUND(${SALDO}, 2) AS saldo FROM clientes WHERE id = $1 FOR UPDATE`, [id]);

        if (fila.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Cliente no encontrado." });
        }

        const saldo = Number(fila.rows[0].saldo);

        if (Math.round(monto * 100) > Math.round(saldo * 100)) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: `El abono no puede ser mayor que la deuda (S/ ${saldo.toFixed(2)}).` });
        }

        await client.query(
            `INSERT INTO abonos (cliente_id, monto, metodo_pago, nota, usuario_id) VALUES ($1, $2, $3, $4, $5)`,
            [id, Number(monto.toFixed(2)), metodoPago, nota.trim() || null, req.session.usuario.id]
        );

        await client.query("COMMIT");
        res.status(201).json({ mensaje: "Abono registrado.", saldo: (saldo - monto).toFixed(2) });
    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        console.error("Error al registrar el abono:", error.message);
        res.status(500).json({ error: "No se pudo registrar el abono." });
    } finally {
        client?.release();
    }
});

router.delete("/abonos/:id", requiereJefe, async (req, res) => {
    const id = leerId(req);
    if (!id) return res.status(400).json({ error: "Abono inválido." });

    try {
        const resultado = await pool.query(`DELETE FROM abonos WHERE id = $1 RETURNING id`, [id]);
        if (resultado.rows.length === 0) return res.status(404).json({ error: "Abono no encontrado." });
        res.json({ mensaje: "Abono eliminado." });
    } catch (error) {
        console.error("Error al eliminar el abono:", error.message);
        res.status(500).json({ error: "No se pudo eliminar el abono." });
    }
});

module.exports = { router, SALDO };
