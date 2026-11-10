const { AwsClient } = require("aws4fetch");

/* Almacén de fotos en Cloudflare R2 (compatible con S3).
   Las fotos se guardan como archivos en R2 y los clientes las descargan directo de allí:
   así casi no sale nada de la base de datos (Neon cobra/limita esa transferencia) y R2 no
   cobra por las descargas.

   Variables de entorno (si falta alguna, las fotos siguen guardándose en la base, como antes):
   - R2_ACCOUNT_ID          ID de la cuenta de Cloudflare (o R2_ENDPOINT con la dirección completa)
   - R2_ACCESS_KEY_ID       clave de acceso del token de R2
   - R2_SECRET_ACCESS_KEY   clave secreta del token de R2
   - R2_BUCKET              nombre del bucket (por ejemplo, mil-deseos-fotos)
   - R2_URL_PUBLICA         dirección pública del bucket (https://pub-xxxx.r2.dev o un dominio propio) */

const {
    R2_ACCOUNT_ID,
    R2_ENDPOINT,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_URL_PUBLICA
} = process.env;

const extremo = (R2_ENDPOINT || (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "")).replace(/\/+$/, "");
const urlPublica = (R2_URL_PUBLICA || "").replace(/\/+$/, "");

const activo = Boolean(extremo && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && urlPublica);

const cliente = activo
    ? new AwsClient({
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
        service: "s3",
        region: "auto"
    })
    : null;

const EXTENSIONES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function extension(tipo) {
    return EXTENSIONES[tipo] ?? "jpg";
}

function direccionInterna(clave) {
    return `${extremo}/${R2_BUCKET}/${clave.split("/").map(encodeURIComponent).join("/")}`;
}

// Dirección pública para que el navegador descargue el archivo.
function direccionPublica(clave) {
    return `${urlPublica}/${clave.split("/").map(encodeURIComponent).join("/")}`;
}

// Guarda un archivo. Cada foto tiene un nombre único (lleva su versión), así que se puede
// guardar en la caché del navegador por un año.
async function subir(clave, datos, tipo) {
    const respuesta = await cliente.fetch(direccionInterna(clave), {
        method: "PUT",
        body: datos,
        headers: {
            "Content-Type": tipo,
            "Cache-Control": "public, max-age=31536000, immutable"
        }
    });

    if (!respuesta.ok) {
        throw new Error(`R2 no guardó ${clave} (${respuesta.status})`);
    }
}

// Descarga un archivo (lo usa el servidor, por ejemplo para editar la foto original).
async function descargar(clave) {
    const respuesta = await cliente.fetch(direccionInterna(clave));

    if (!respuesta.ok) {
        throw new Error(`R2 no encontró ${clave} (${respuesta.status})`);
    }

    return Buffer.from(await respuesta.arrayBuffer());
}

// Borra archivos que ya no se usan. Si falla, solo se anota: no debe frenar al usuario.
async function borrar(...claves) {
    await Promise.all(claves.filter(Boolean).map(async (clave) => {
        try {
            const respuesta = await cliente.fetch(direccionInterna(clave), { method: "DELETE" });
            if (!respuesta.ok && respuesta.status !== 404) {
                console.error(`R2 no borró ${clave} (${respuesta.status})`);
            }
        } catch (error) {
            console.error(`R2 no borró ${clave}:`, error.message);
        }
    }));
}

/* Nombres de los archivos de la foto de un producto. En la base se guarda solo el nombre base
   («productos/<id>/<versión>»); de él salen la foto (<base>.<ext>) y la miniatura (<base>-mini.jpg).
   La original tiene su propio nombre porque puede conservarse al cambiar la foto. */
function baseProducto(id, version) {
    return `productos/${id}/${version}`;
}

function claveFoto(base, tipo) {
    return `${base}.${extension(tipo)}`;
}

function claveMini(base) {
    return `${base}-mini.jpg`;
}

function claveOriginal(base, tipo) {
    return `${base}-original.${extension(tipo)}`;
}

module.exports = {
    activo,
    subir,
    descargar,
    borrar,
    direccionPublica,
    baseProducto,
    claveFoto,
    claveMini,
    claveOriginal,
    extension
};
