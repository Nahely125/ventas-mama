import { pedir } from "./api.js";

const LADO_MAXIMO = 800;
// Lado mayor de la foto con la que se trabaja al editarla.
const LADO_TRABAJO = 1200;
// Foto con estilo de catálogo: vertical 3:4, como las tarjetas del catálogo, en fondo blanco.
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

    const ctx = lienzo.getContext("2d", { willReadFrequently: true });
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
   mascara (opcional): solo se mide la luz del producto, no la del fondo. */
function mejorarColor(datos, mascara = null) {
    const p = datos.data;
    const histograma = new Uint32Array(256);
    let total = 0;

    for (let i = 0; i < p.length; i += 4) {
        if (mascara && mascara[i + 3] < 128) continue;
        histograma[(p[i] * 77 + p[i + 1] * 150 + p[i + 2] * 29) >> 8]++;
        total++;
    }

    if (total === 0) return;

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

    for (let i = 0; i < p.length; i += 4) {
        const r = tabla[p[i]];
        const g = tabla[p[i + 1]];
        const b = tabla[p[i + 2]];
        const luz = 0.299 * r + 0.587 * g + 0.114 * b;
        p[i] = luz + (r - luz) * saturacion;
        p[i + 1] = luz + (g - luz) * saturacion;
        p[i + 2] = luz + (b - luz) * saturacion;
    }
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

function lienzoBlanco() {
    const lienzo = document.createElement("canvas");
    lienzo.width = ANCHO_CATALOGO;
    lienzo.height = ALTO_CATALOGO;
    const ctx = lienzo.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ANCHO_CATALOGO, ALTO_CATALOGO);
    ctx.imageSmoothingQuality = "high";
    return { lienzo, ctx };
}

/* Producto recortado sobre blanco: se quita el fondo, el producto se centra y se agranda
   para llenar la foto, y se le pone una sombra suave debajo (como en las tiendas en línea). */
function productoSobreBlanco(base, mascara) {
    const ctxBase = base.getContext("2d", { willReadFrequently: true });
    const datos = ctxBase.getImageData(0, 0, base.width, base.height);
    const p = datos.data;
    let izquierda = base.width, derecha = -1, arriba = base.height, abajo = -1;

    mejorarColor(datos, mascara);

    for (let y = 0; y < base.height; y++) {
        for (let x = 0; x < base.width; x++) {
            const i = (y * base.width + x) * 4;
            // Bordes más definidos: lo dudoso se vuelve fondo o producto.
            const certeza = Math.min(1, Math.max(0, (mascara[i + 3] - 70) / 115));
            p[i + 3] = Math.round(255 * certeza * certeza * (3 - 2 * certeza));

            if (p[i + 3] > 128) {
                if (x < izquierda) izquierda = x;
                if (x > derecha) derecha = x;
                if (y < arriba) arriba = y;
                if (y > abajo) abajo = y;
            }
        }
    }

    ctxBase.putImageData(datos, 0, 0);

    const anchoProducto = derecha - izquierda + 1;
    const altoProducto = abajo - arriba + 1;
    const escala = Math.min((ANCHO_CATALOGO * 0.8) / anchoProducto, (ALTO_CATALOGO * 0.74) / altoProducto, 3);
    const ancho = anchoProducto * escala;
    const alto = altoProducto * escala;
    const x = (ANCHO_CATALOGO - ancho) / 2;
    const y = (ALTO_CATALOGO - alto) / 2 - ALTO_CATALOGO * 0.02;

    const { lienzo, ctx } = lienzoBlanco();

    // Sombra suave (una elipse difuminada) apoyada bajo el producto.
    ctx.save();
    ctx.translate(ANCHO_CATALOGO / 2, y + alto);
    ctx.scale(1, 0.14);
    const radio = ancho * 0.48;
    const sombra = ctx.createRadialGradient(0, 0, 0, 0, 0, radio);
    sombra.addColorStop(0, "rgba(40, 30, 50, 0.24)");
    sombra.addColorStop(0.6, "rgba(40, 30, 50, 0.08)");
    sombra.addColorStop(1, "rgba(40, 30, 50, 0)");
    ctx.fillStyle = sombra;
    ctx.beginPath();
    ctx.arc(0, 0, radio, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.drawImage(base, izquierda, arriba, anchoProducto, altoProducto, x, y, ancho, alto);
    return lienzo;
}

/* Si no se pudo separar el producto: la foto completa (luz y color corregidos), centrada en
   blanco con esquinas redondeadas y sombra suave. Las horizontales se recortan a cuadradas. */
function fotoSobreBlanco(base) {
    const ctxBase = base.getContext("2d", { willReadFrequently: true });
    const datos = ctxBase.getImageData(0, 0, base.width, base.height);
    mejorarColor(datos);
    ctxBase.putImageData(datos, 0, 0);

    const margen = ANCHO_CATALOGO * 0.07;
    const anchoVisible = Math.min(base.width, base.height);
    const escala = Math.min((ANCHO_CATALOGO - margen * 2) / anchoVisible, (ALTO_CATALOGO - margen * 2) / base.height, 2);
    const ancho = Math.round(anchoVisible * escala);
    const alto = Math.round(base.height * escala);
    const x = Math.round((ANCHO_CATALOGO - ancho) / 2);
    const y = Math.round((ALTO_CATALOGO - alto) / 2);
    const recorteX = (base.width - anchoVisible) / 2;

    const { lienzo, ctx } = lienzoBlanco();

    ctx.save();
    ctx.shadowColor = "rgba(60, 30, 80, 0.18)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#ffffff";
    rectanguloRedondeado(ctx, x, y, ancho, alto, 20);
    ctx.fill();
    ctx.restore();

    ctx.save();
    rectanguloRedondeado(ctx, x, y, ancho, alto, 20);
    ctx.clip();
    ctx.drawImage(base, recorteX, 0, anchoVisible, base.height, x, y, ancho, alto);
    ctx.restore();

    return lienzo;
}

/* ¿Se puede confiar en el recorte? No, si casi todo o casi nada parece producto, si quedó
   en pedazos sueltos (varias cosas amontonadas), si hay mucha zona dudosa o si el producto
   se sale por los bordes de la foto. En esos casos se usa la foto completa. */
function recorteConfiable(mascara, ancho, alto) {
    let producto = 0, dudosos = 0, enBorde = 0;
    let izquierda = ancho, derecha = -1, arriba = alto, abajo = -1;

    for (let y = 0; y < alto; y++) {
        for (let x = 0; x < ancho; x++) {
            const valor = mascara[(y * ancho + x) * 4 + 3];
            if (valor > 40 && valor < 215) dudosos++;
            if (valor <= 128) continue;
            producto++;
            if (x === 0 || y === 0 || x === ancho - 1 || y === alto - 1) enBorde++;
            if (x < izquierda) izquierda = x;
            if (x > derecha) derecha = x;
            if (y < arriba) arriba = y;
            if (y > abajo) abajo = y;
        }
    }

    const medidas = {
        proporcion: producto / (ancho * alto),
        relleno: producto / Math.max(1, (derecha - izquierda + 1) * (abajo - arriba + 1)),
        dudosos: dudosos / Math.max(1, producto),
        borde: enBorde / (2 * (ancho + alto))
    };

    return medidas.proporcion >= 0.02 && medidas.proporcion <= 0.95 &&
        medidas.relleno >= 0.3 && medidas.dudosos <= 0.3 && medidas.borde <= 0.2;
}

async function estilizar(imagen, giro) {
    const escala = Math.min(1, LADO_TRABAJO / Math.max(imagen.width, imagen.height));
    const base = girar(imagen, giro, escala);

    let mascara = null;
    try {
        const { mascaraProducto } = await import("./fondoBlanco.js");
        mascara = await mascaraProducto(base);
        if (!recorteConfiable(mascara, base.width, base.height)) mascara = null;
    } catch (error) {
        console.error("No se pudo quitar el fondo:", error);
    }

    return mascara ? productoSobreBlanco(base, mascara) : fotoSobreBlanco(base);
}

/* Prepara la foto para guardarla (JPEG liviano; las del celular pesan varios MB).
   estilo: true = editada para el catálogo (fondo blanco); false = la foto tal cual, solo reducida. */
export async function prepararFoto(imagen, { giro = 0, estilo = true } = {}) {
    const lienzo = estilo
        ? await estilizar(imagen, giro)
        : girar(imagen, giro, Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height)));

    return lienzo.toDataURL("image/jpeg", 0.88);
}

// Guarda o quita la foto según lo elegido en el formulario.
// foto: data URL nueva, null para quitarla, undefined para dejarla igual.
// editada: true si ya tiene el estilo del catálogo (para no volver a editarla).
export async function guardarFoto(productoId, foto, editada = false) {
    if (foto === undefined) return;

    if (foto === null) {
        await pedir(`/api/productos/${productoId}/foto`, { method: "DELETE" });
    } else {
        await pedir(`/api/productos/${productoId}/foto`, { method: "PUT", cuerpo: { foto, editada } });
    }
}
