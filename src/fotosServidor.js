const pool = require("./db");
const { leerId } = require("./autenticacion");
const almacen = require("./almacenR2");

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

    // Foto en Cloudflare R2: se envía al navegador a descargarla de allí (no pasa por la base).
    if (foto.redireccion) {
        return res.redirect(302, foto.redireccion);
    }

    res.type(foto.tipo).send(foto.datos);
}

// Pesa casi nada: solo la dirección, no la foto.
const PESO_REDIRECCION = 200;

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
        // Si la foto está en R2 no se trae ningún byte de la foto: solo su nombre.
        const resultado = await pool.query(
            `SELECT foto_tipo, foto_actualizada::TEXT AS marca, foto_r2,
                    CASE WHEN foto_r2 IS NULL THEN ${mini ? "foto_mini" : "foto"} END AS datos,
                    COALESCE(EXTRACT(EPOCH FROM foto_actualizada)::BIGINT, 0)::INT AS version
             FROM productos WHERE id = $1 AND (foto IS NOT NULL OR foto_r2 IS NOT NULL)`,
            [id]
        );
        const fila = resultado.rows[0];

        if (!fila) {
            return res.status(404).end();
        }

        if (fila.foto_r2 && almacen.activo) {
            const archivo = req.query.tam === "mini" ? almacen.claveMini(fila.foto_r2) : almacen.claveFoto(fila.foto_r2, fila.foto_tipo);
            const foto = { version: fila.version, redireccion: almacen.direccionPublica(archivo), datos: { length: PESO_REDIRECCION } };
            recordar(clave, foto);
            return responder(res, foto, versionPedida);
        }

        // Foto completa que no está en la base (por ejemplo, está en R2 pero R2 no está configurado).
        if (fila.datos === null && !mini) {
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
                    `UPDATE productos SET foto_mini = $1 WHERE id = $2 AND foto_actualizada::TEXT IS NOT DISTINCT FROM $3`,
                    [miniatura, id, fila.marca]
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
// Si una foto no se puede guardar tras varios intentos, se deja para el próximo arranque.
const MAXIMO_REINTENTOS = 5;

async function crearMiniaturasPendientes() {
    if (!sharp) return;

    let creadas = 0;
    let reintentos = 0;

    try {
        for (;;) {
            const resultado = await pool.query(
                `SELECT id, foto, foto_actualizada::TEXT AS marca FROM productos
                 WHERE foto IS NOT NULL AND foto_mini IS NULL
                 ORDER BY id LIMIT 1`
            );
            const fila = resultado.rows[0];
            if (!fila) break;

            const miniatura = await crearMiniatura(fila.foto);
            const guardado = await pool.query(
                `UPDATE productos SET foto_mini = $1 WHERE id = $2 AND foto_actualizada::TEXT IS NOT DISTINCT FROM $3`,
                [miniatura, fila.id, fila.marca]
            );
            if (guardado.rowCount === 0) {
                // La foto cambió justo ahora: se vuelve a intentar, pero sin repetir sin fin.
                if (++reintentos > MAXIMO_REINTENTOS) break;
                continue;
            }
            creadas++;
        }

        if (creadas > 0) console.log(`Miniaturas creadas para ${creadas} fotos.`);
    } catch (error) {
        console.error("No se pudieron crear las miniaturas pendientes:", error.message);
    }
}

/* Mudanza a Cloudflare R2: pasa, de a una, las fotos que todavía están en la base
   (foto, miniatura y original) y luego vacía esas columnas. También las imágenes de la tienda.
   Se llama al arrancar el servidor cuando R2 está configurado. Si algo falla, se detiene y
   sigue en el próximo arranque (no se pierde nada: la foto solo se borra de la base
   cuando ya está guardada en R2). Esta mudanza saca las fotos de la base una sola vez. */
async function migrarFotosAR2() {
    if (!almacen.activo) return;

    let movidas = 0;
    let reintentos = 0;

    try {
        for (;;) {
            const resultado = await pool.query(
                `SELECT id, foto, foto_tipo, foto_mini, foto_original, foto_original_tipo, foto_actualizada::TEXT AS marca,
                        COALESCE(EXTRACT(EPOCH FROM foto_actualizada)::BIGINT, 0) AS version
                 FROM productos
                 WHERE foto IS NOT NULL AND foto_r2 IS NULL
                 ORDER BY id LIMIT 1`
            );
            const fila = resultado.rows[0];
            if (!fila) break;

            const base = almacen.baseProducto(fila.id, `${fila.version}-m`);
            const miniatura = fila.foto_mini ?? (await crearMiniatura(fila.foto).catch(() => null));
            const claveOriginal = fila.foto_original ? almacen.claveOriginal(base, fila.foto_original_tipo) : null;
            const claves = [almacen.claveFoto(base, fila.foto_tipo), almacen.claveMini(base), claveOriginal];

            await almacen.subir(claves[0], fila.foto, fila.foto_tipo);
            await almacen.subir(claves[1], miniatura ?? fila.foto, miniatura ? "image/jpeg" : fila.foto_tipo);
            if (claveOriginal) {
                await almacen.subir(claveOriginal, fila.foto_original, fila.foto_original_tipo);
            }

            // La versión (foto_actualizada) no cambia: las direcciones que ya tienen los clientes siguen sirviendo.
            const guardado = await pool.query(
                `UPDATE productos
                 SET foto = NULL, foto_mini = NULL, foto_original = NULL, foto_r2 = $2,
                     foto_original_r2 = COALESCE($3, foto_original_r2)
                 WHERE id = $1 AND foto_r2 IS NULL AND foto_actualizada::TEXT IS NOT DISTINCT FROM $4`,
                [fila.id, base, claveOriginal, fila.marca]
            );

            if (guardado.rowCount === 0) {
                // La foto cambió mientras se copiaba: se borra la copia y se vuelve a intentar.
                await almacen.borrar(...claves);
                if (++reintentos > MAXIMO_REINTENTOS) {
                    console.error("La mudanza a R2 se detuvo: una foto no se pudo marcar como movida.");
                    break;
                }
                continue;
            }

            olvidarFoto(fila.id);
            movidas++;
        }

        // Imágenes de la página web (portada y logo).
        const imagenes = await pool.query(
            `SELECT clave, datos, tipo, EXTRACT(EPOCH FROM actualizada)::BIGINT AS version
             FROM tienda_imagenes WHERE datos IS NOT NULL AND clave_r2 IS NULL`
        );
        for (const imagen of imagenes.rows) {
            const claveR2 = `tienda/${imagen.clave}-${imagen.version}.${almacen.extension(imagen.tipo)}`;
            await almacen.subir(claveR2, imagen.datos, imagen.tipo);
            await pool.query(
                `UPDATE tienda_imagenes SET datos = NULL, clave_r2 = $2 WHERE clave = $1 AND clave_r2 IS NULL`,
                [imagen.clave, claveR2]
            );
            movidas++;
        }

        if (movidas > 0) console.log(`Fotos pasadas a Cloudflare R2: ${movidas}.`);
    } catch (error) {
        console.error(`No se pudieron pasar todas las fotos a R2 (se sigue en el próximo arranque): ${error.message}`);
    }
}

module.exports = { enviarFoto, crearMiniatura, olvidarFoto, crearMiniaturasPendientes, migrarFotosAR2 };
