import { pedir } from "./api.js";

const LADO_MAXIMO = 800;
// Foto con estilo de catálogo: vertical 3:4, como las tarjetas del catálogo.
const ANCHO_CATALOGO = 750;
const ALTO_CATALOGO = 1000;

// Dirección de la foto de un producto, o null si no tiene.
// La versión cambia cada vez que se sube una foto nueva, así no se queda la vieja en caché.
export function urlFoto(producto) {
    return producto?.tieneFoto
        ? `/api/productos/${producto.id}/foto?v=${producto.fotoVersion}`
        : null;
}

// Abre la imagen elegida (archivo del celular o foto ya guardada) para editarla.
export async function leerImagen(origen) {
    if (typeof origen === "string") {
        const respuesta = await fetch(origen);
        if (!respuesta.ok) throw new Error("No se pudo abrir la foto guardada.");
        origen = await respuesta.blob();
    }

    if (!origen.type.startsWith("image/")) {
        throw new Error("El archivo debe ser una imagen.");
    }

    return createImageBitmap(origen);
}

// Dibuja la imagen girada (0, 90, 180 o 270 grados) a la escala pedida.
function girar(imagen, giro, escala) {
    const ancho = Math.round(imagen.width * escala);
    const alto = Math.round(imagen.height * escala);
    const deLado = giro % 180 !== 0;
    const lienzo = document.createElement("canvas");

    lienzo.width = deLado ? alto : ancho;
    lienzo.height = deLado ? ancho : alto;

    const ctx = lienzo.getContext("2d");
    ctx.fillStyle = "#ffffff"; // fondo blanco para PNG con transparencia
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.translate(lienzo.width / 2, lienzo.height / 2);
    ctx.rotate((giro * Math.PI) / 180);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(imagen, -ancho / 2, -alto / 2, ancho, alto);

    return lienzo;
}

/* Corrige la luz y el color: lleva los tonos más claros hacia el blanco, aclara los medios
   si la foto está oscura (sin oscurecer nada) y aviva un poco los colores.
   Devuelve el color promedio de la foto ya corregida (para el fondo). */
function mejorarColor(lienzo) {
    const ctx = lienzo.getContext("2d");
    const datos = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
    const p = datos.data;
    const histograma = new Uint32Array(256);

    for (let i = 0; i < p.length; i += 4) {
        histograma[(p[i] * 77 + p[i + 1] * 150 + p[i + 2] * 29) >> 8]++;
    }

    const total = p.length / 4;
    const percentil = (fraccion) => {
        let acumulado = 0;
        for (let v = 0; v < 256; v++) {
            acumulado += histograma[v];
            if (acumulado >= total * fraccion) return v;
        }
        return 255;
    };

    // Sin exagerar: el negro se mueve poco (hasta 20) y el blanco, como mucho desde 170.
    const bajo = Math.min(percentil(0.005), 20);
    const alto = Math.max(percentil(0.995), 170);
    let mediana = (percentil(0.5) - bajo) / (alto - bajo);
    mediana = Math.min(Math.max(mediana, 0.05), 0.95);
    // Si los tonos medios quedan oscuros, se aclaran hasta cerca de la mitad.
    const gamma = mediana < 0.45 ? Math.max(0.6, Math.log(0.48) / Math.log(mediana)) : 1;
    const tabla = new Uint8ClampedArray(256);

    for (let v = 0; v < 256; v++) {
        const estirado = Math.min(1, Math.max(0, (v - bajo) / (alto - bajo)));
        tabla[v] = Math.round(255 * estirado ** gamma);
    }

    const saturacion = 1.1;
    let sumaR = 0, sumaG = 0, sumaB = 0;

    for (let i = 0; i < p.length; i += 4) {
        const r = tabla[p[i]];
        const g = tabla[p[i + 1]];
        const b = tabla[p[i + 2]];
        const luz = 0.299 * r + 0.587 * g + 0.114 * b;
        p[i] = luz + (r - luz) * saturacion;
        p[i + 1] = luz + (g - luz) * saturacion;
        p[i + 2] = luz + (b - luz) * saturacion;
        sumaR += p[i];
        sumaG += p[i + 1];
        sumaB += p[i + 2];
    }

    ctx.putImageData(datos, 0, 0);
    return [sumaR / total, sumaG / total, sumaB / total];
}

function rectanguloRedondeado(ctx, x, y, ancho, alto, radio) {
    ctx.beginPath();
    ctx.moveTo(x + radio, y);
    ctx.arcTo(x + ancho, y, x + ancho, y + alto, radio);
    ctx.arcTo(x + ancho, y + alto, x, y + alto, radio);
    ctx.arcTo(x, y + alto, x, y, radio);
    ctx.arcTo(x, y, x + ancho, y, radio);
    ctx.closePath();
}

// Mezcla un color con blanco (cuanto = 0: el color; 1: blanco).
function aclarar([r, g, b], cuanto) {
    const mezcla = (v) => Math.round(v + (255 - v) * cuanto);
    return `rgb(${mezcla(r)}, ${mezcla(g)}, ${mezcla(b)})`;
}

/* Estilo de catálogo: la foto (con luz y color corregidos) va centrada, con esquinas
   redondeadas y sombra suave, sobre un fondo claro del color de la propia foto.
   Las fotos horizontales se recortan a cuadradas (por los costados) para que el producto
   se vea grande en la tarjeta vertical del catálogo. */
function estilizar(imagen, giro) {
    const margen = Math.round(ANCHO_CATALOGO * 0.07);
    const anchoUtil = ANCHO_CATALOGO - margen * 2;
    const altoUtil = ALTO_CATALOGO - margen * 2;
    const deLado = giro % 180 !== 0;
    const anchoGirado = deLado ? imagen.height : imagen.width;
    const altoGirado = deLado ? imagen.width : imagen.height;
    const anchoRecorte = Math.min(anchoGirado, altoGirado);
    const anchoVisible = anchoGirado > altoGirado ? anchoRecorte : anchoGirado;
    const escala = Math.min(anchoUtil / anchoVisible, altoUtil / altoGirado, 2);

    const foto = girar(imagen, giro, escala);
    const promedio = mejorarColor(foto);
    const ancho = Math.round(anchoVisible * escala);
    const alto = foto.height;
    const recorteX = Math.round((foto.width - ancho) / 2);

    const lienzo = document.createElement("canvas");
    lienzo.width = ANCHO_CATALOGO;
    lienzo.height = ALTO_CATALOGO;
    const ctx = lienzo.getContext("2d");
    ctx.imageSmoothingQuality = "high";

    // Fondo: degradado muy claro con el tono de la foto.
    const degradado = ctx.createLinearGradient(0, 0, 0, ALTO_CATALOGO);
    degradado.addColorStop(0, aclarar(promedio, 0.9));
    degradado.addColorStop(1, aclarar(promedio, 0.75));
    ctx.fillStyle = degradado;
    ctx.fillRect(0, 0, ANCHO_CATALOGO, ALTO_CATALOGO);

    // La foto, centrada, con sombra y esquinas redondeadas.
    const x = Math.round((ANCHO_CATALOGO - ancho) / 2);
    const y = Math.round((ALTO_CATALOGO - alto) / 2);
    const radio = 24;

    ctx.save();
    ctx.shadowColor = "rgba(60, 30, 80, 0.25)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = "#ffffff";
    rectanguloRedondeado(ctx, x, y, ancho, alto, radio);
    ctx.fill();
    ctx.restore();

    ctx.save();
    rectanguloRedondeado(ctx, x, y, ancho, alto, radio);
    ctx.clip();
    ctx.drawImage(foto, recorteX, 0, ancho, alto, x, y, ancho, alto);
    ctx.restore();

    return lienzo;
}

/* Prepara la foto para guardarla (JPEG liviano; las del celular pesan varios MB).
   estilo: true = estilo de catálogo; false = la foto tal cual, solo reducida. */
export function prepararFoto(imagen, { giro = 0, estilo = true } = {}) {
    const lienzo = estilo
        ? estilizar(imagen, giro)
        : girar(imagen, giro, Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height)));

    return lienzo.toDataURL("image/jpeg", 0.86);
}

// Guarda o quita la foto según lo elegido en el formulario.
// foto: data URL nueva, null para quitarla, undefined para dejarla igual.
export async function guardarFoto(productoId, foto) {
    if (foto === undefined) return;

    if (foto === null) {
        await pedir(`/api/productos/${productoId}/foto`, { method: "DELETE" });
    } else {
        await pedir(`/api/productos/${productoId}/foto`, { method: "PUT", cuerpo: { foto } });
    }
}
