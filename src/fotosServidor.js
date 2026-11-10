const pool = require("./db");
const { leerId } = require("./autenticacion");

/* Envío de las fotos de los productos, lo más rápido posible:
   - va antes de las sesiones (las fotos son públicas): no lee ni escribe la sesión en cada foto;
   - las fotos enviadas hace poco quedan en la memoria del servidor (no se vuelve a pedir a la base);
   - las miniaturas se crean al subir la foto (y, para las fotos antiguas, al arrancar el servidor). */

// Miniatura: hasta 480 × 640 px (las tarjetas son 3:4). Pesa 3 a 4 veces menos que la foto.
const LADO_MINI = { width: 480, height: 640 };
// Memoria para fotos: hasta 60 MB (las menos usadas salen primero).
const MAXIMO_MEMORIA = 60 * 1024 * 1024;

let sharp = null;
try {
    sharp = require("sharp");
} catch (error) {
    console.error("No se pudo cargar sharp: las miniaturas usarán la foto completa.", error.message);
}

async function crearMiniatura(foto) {
    if (!sharp) return null;
    return sharp(foto)
        .rotate()
        .resize({ ...LADO_MINI, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 78, mozjpeg: true })
        .toBuffer();
}

// Memoria de fotos: { version, tipo, datos } por "id:foto" o "id:mini".
const memoria = new Map();
let enUso = 0;

function sacar(clave) {
    const valor = memoria.get(clave);
    if (!valor) return;
    memoria.delete(clave);
    enUso -= valor.datos.length;
}

function recordar(clave, valor) {
    sacar(clave);
    memoria.set(clave, valor);
    enUso += valor.datos.length;

    for (const viejaClave of memoria.keys()) {
        if (enUso <= MAXIMO_MEMORIA) break;
        sacar(viejaClave);
    }
}

function consultar(clave) {
    const valor = memoria.get(clave);
    // Se vuelve a poner al final: así salen primero las que nadie mira.
    if (valor) {
        memoria.delete(clave);
        memoria.set(clave, valor);
    }
    return valor;
}

// Al cambiar o quitar la foto de un producto, se olvida lo que había en memoria.
function olvidarFoto(id) {
    sacar(`${id}:foto`);
    sacar(`${id}:mini`);
}

function responder(res, foto, versionPedida) {
    // La URL lleva ?v=<versión>: si coincide, el navegador la guarda un año sin volver a preguntar.
    res.set("Cache-Control", foto.version === versionPedida ? "public, max-age=31536000, immutable" : "public, max-age=60");
    res.type(foto.tipo).send(foto.datos);
}

// GET /api/productos/:id/foto?v=<versión>[&tam=mini] (pública: inventario y catálogo).
async function enviarFoto(req, res) {
    const id = leerId(req);
    const mini = req.query.tam === "mini" && Boolean(sharp);
    const versionPedida = Number(req.query.v);
    const clave = `${id}:${mini ? "mini" : "foto"}`;

    if (!id) {
        return res.status(404).end();
    }

    const guardada = consultar(clave);
    if (guardada && guardada.version === versionPedida) {
        return responder(res, guardada, versionPedida);
    }

    try {
        // Solo se trae de la base lo que se va a enviar: la miniatura O la foto, nunca las dos.
        // (Cada byte que sale de la base cuenta para el límite mensual de transferencia de Neon.)
        const resultado = await pool.query(
            `SELECT foto_tipo, foto_actualizada,
                    ${mini ? "foto_mini" : "foto"} AS datos,
                    COALESCE(EXTRACT(EPOCH FROM foto_actualizada)::BIGINT, 0)::INT AS version
             FROM productos WHERE id = $1 AND foto IS NOT NULL`,
            [id]
        );
        const fila = resultado.rows[0];

        if (!fila) {
            return res.status(404).end();
        }

        let foto = { version: fila.version, tipo: fila.foto_tipo, datos: fila.datos };

        if (mini) {
            let miniatura = fila.datos;

            if (!miniatura) {
                // Falta la miniatura (foto antigua): solo entonces se trae la foto completa para crearla.
                const original = await pool.query(`SELECT foto FROM productos WHERE id = $1`, [id]);
                if (!original.rows[0]?.foto) {
                    return res.status(404).end();
                }
                miniatura = await crearMiniatura(original.rows[0].foto);
                // Se guarda para la próxima vez (si nadie cambió la foto mientras tanto).
                await pool.query(
                    `UPDATE productos SET foto_mini = $1 WHERE id = $2 AND foto_actualizada IS NOT DISTINCT FROM $3`,
                    [miniatura, id, fila.foto_actualizada]
                );
            }

            foto = { version: fila.version, tipo: "image/jpeg", datos: miniatura };
        }

        recordar(clave, foto);
        responder(res, foto, versionPedida);
    } catch (error) {
        console.error("Error al enviar la foto:", error.message);
        res.status(500).end();
    }
}

/* Crea, de a una, las miniaturas que falten (fotos subidas antes de que existieran).
   Se llama al arrancar el servidor; si algo falla, solo se anota y se sigue después. */
async function crearMiniaturasPendientes() {
    if (!sharp) return;

    let creadas = 0;

    try {
        for (;;) {
            const resultado = await pool.query(
                `SELECT id, foto, foto_actualizada FROM productos
                 WHERE foto IS NOT NULL AND foto_mini IS NULL
                 ORDER BY id LIMIT 1`
            );
            const fila = resultado.rows[0];
            if (!fila) break;

            const miniatura = await crearMiniatura(fila.foto);
            const guardado = await pool.query(
                `UPDATE productos SET foto_mini = $1 WHERE id = $2 AND foto_actualizada IS NOT DISTINCT FROM $3`,
                [miniatura, fila.id, fila.foto_actualizada]
            );
            if (guardado.rowCount === 0) continue; // la foto cambió justo ahora: se vuelve a intentar
            creadas++;
        }

        if (creadas > 0) console.log(`Miniaturas creadas para ${creadas} fotos.`);
    } catch (error) {
        console.error("No se pudieron crear las miniaturas pendientes:", error.message);
    }
}

module.exports = { enviarFoto, crearMiniatura, olvidarFoto, crearMiniaturasPendientes };
