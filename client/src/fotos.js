import { pedir } from "./api.js";
import { pintarEscena } from "./escenas.js";

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

/* Separa el producto: devuelve { tipo: "producto", lienzo } con el producto recortado (fondo
   transparente, ajustado a su tamaño) y la luz corregida; o, si el recorte no es confiable,
   { tipo: "foto", lienzo } con la foto completa corregida (las horizontales, cuadradas). */
async function recortar(imagen, giro) {
    const escala = Math.min(1, LADO_TRABAJO / Math.max(imagen.width, imagen.height));
    const base = girar(imagen, giro, escala);
    const ctxBase = base.getContext("2d", { willReadFrequently: true });
    const datos = ctxBase.getImageData(0, 0, base.width, base.height);

    let mascara = null;
    try {
        const { mascaraProducto } = await import("./fondoBlanco.js");
        mascara = await mascaraProducto(base);
        if (!recorteConfiable(mascara, base.width, base.height)) mascara = null;
    } catch (error) {
        console.error("No se pudo quitar el fondo:", error);
    }

    mejorarColor(datos, mascara);

    if (!mascara) {
        ctxBase.putImageData(datos, 0, 0);
        const lado = Math.min(base.width, base.height);
        const ancho = base.width > base.height ? lado : base.width;
        const lienzo = document.createElement("canvas");
        lienzo.width = ancho;
        lienzo.height = base.height;
        lienzo.getContext("2d").drawImage(base, (base.width - ancho) / 2, 0, ancho, base.height, 0, 0, ancho, base.height);
        return { tipo: "foto", lienzo };
    }

    const p = datos.data;
    let izquierda = base.width, derecha = -1, arriba = base.height, abajo = -1;

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

    const lienzo = document.createElement("canvas");
    lienzo.width = derecha - izquierda + 1;
    lienzo.height = abajo - arriba + 1;
    lienzo.getContext("2d").drawImage(base, -izquierda, -arriba);
    return { tipo: "producto", lienzo };
}

// El recorte de cada foto (y giro) se calcula una sola vez: cambiar de escena es rápido.
const recortes = new WeakMap();

function recorteDe(imagen, giro) {
    if (!recortes.has(imagen)) recortes.set(imagen, new Map());
    const porGiro = recortes.get(imagen);

    if (!porGiro.has(giro)) {
        porGiro.set(giro, recortar(imagen, giro));
    }

    return porGiro.get(giro);
}

// Sombra suave (una elipse difuminada) apoyada bajo el producto.
function sombraBajo(ctx, centroX, pisoY, ancho, opacidad) {
    ctx.save();
    ctx.translate(centroX, pisoY);
    ctx.scale(1, 0.14);
    const radio = ancho * 0.5;
    const sombra = ctx.createRadialGradient(0, 0, 0, 0, 0, radio);
    sombra.addColorStop(0, `rgba(30, 20, 40, ${opacidad})`);
    sombra.addColorStop(0.6, `rgba(30, 20, 40, ${opacidad * 0.35})`);
    sombra.addColorStop(1, "rgba(30, 20, 40, 0)");
    ctx.fillStyle = sombra;
    ctx.beginPath();
    ctx.arc(0, 0, radio, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// Reflejo del producto en el piso, que se desvanece hacia abajo.
function reflejoBajo(ctx, producto, x, pisoY, ancho, alto, opacidad) {
    const largo = Math.min(alto * 0.45, ALTO_CATALOGO - pisoY);
    if (largo <= 0) return;

    const capa = document.createElement("canvas");
    capa.width = Math.ceil(ancho);
    capa.height = Math.ceil(largo);
    const c = capa.getContext("2d");
    c.translate(0, alto);
    c.scale(1, -1);
    c.drawImage(producto, 0, 0, ancho, alto);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "destination-in";
    const desvanecer = c.createLinearGradient(0, 0, 0, largo);
    desvanecer.addColorStop(0, `rgba(0, 0, 0, ${opacidad})`);
    desvanecer.addColorStop(1, "rgba(0, 0, 0, 0)");
    c.fillStyle = desvanecer;
    c.fillRect(0, 0, capa.width, capa.height);

    ctx.drawImage(capa, x, pisoY);
}

// Coloca el producto (o la foto, si no se pudo recortar) en la escena elegida.
function componer(recorte, estilo, semilla) {
    const lienzo = document.createElement("canvas");
    lienzo.width = ANCHO_CATALOGO;
    lienzo.height = ALTO_CATALOGO;
    const ctx = lienzo.getContext("2d");
    ctx.imageSmoothingQuality = "high";

    const escena = pintarEscena(ctx, ANCHO_CATALOGO, ALTO_CATALOGO, estilo, semilla);
    const pisoY = ALTO_CATALOGO * escena.piso;
    const fuente = recorte.lienzo;

    if (recorte.tipo === "foto") {
        // La foto completa como un cuadro centrado, con esquinas redondeadas y sombra.
        const escala = Math.min((ANCHO_CATALOGO * 0.84) / fuente.width, (ALTO_CATALOGO * 0.86) / fuente.height, 2);
        const ancho = Math.round(fuente.width * escala);
        const alto = Math.round(fuente.height * escala);
        const x = Math.round((ANCHO_CATALOGO - ancho) / 2);
        const y = Math.round((ALTO_CATALOGO - alto) / 2);

        ctx.save();
        ctx.shadowColor = "rgba(40, 20, 60, 0.3)";
        ctx.shadowBlur = 28;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = "#ffffff";
        rectanguloRedondeado(ctx, x, y, ancho, alto, 20);
        ctx.fill();
        ctx.restore();

        ctx.save();
        rectanguloRedondeado(ctx, x, y, ancho, alto, 20);
        ctx.clip();
        ctx.drawImage(fuente, x, y, ancho, alto);
        ctx.restore();
        return lienzo;
    }

    const maximoAncho = ANCHO_CATALOGO * Math.min(0.8, escena.anchoMaximo ?? 0.8);
    const maximoAlto = Math.min(ALTO_CATALOGO * 0.72, pisoY - ALTO_CATALOGO * 0.07);
    const escala = Math.min(maximoAncho / fuente.width, maximoAlto / fuente.height, 3);
    const ancho = fuente.width * escala;
    const alto = fuente.height * escala;
    const x = (ANCHO_CATALOGO - ancho) / 2;
    const y = pisoY - alto;

    if (escena.reflejo > 0) reflejoBajo(ctx, fuente, x, pisoY, ancho, alto, escena.reflejo);
    sombraBajo(ctx, ANCHO_CATALOGO / 2, pisoY, ancho, escena.sombra);
    ctx.drawImage(fuente, x, y, ancho, alto);
    return lienzo;
}

/* Prepara la foto para guardarla (JPEG liviano; las del celular pesan varios MB).
   estilo: una escena de escenas.js ("blanco", "estudio", "navidad", "madera", "lila")
   o "original" (la foto tal cual, solo reducida). */
export async function prepararFoto(imagen, { giro = 0, estilo = "blanco" } = {}) {
    if (estilo === "original") {
        return girar(imagen, giro, Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height))).toDataURL("image/jpeg", 0.86);
    }

    const recorte = await recorteDe(imagen, giro);
    return componer(recorte, estilo, imagen.width * 31 + imagen.height).toDataURL("image/jpeg", 0.88);
}

// Foto original (girada y reducida) que se guarda para poder cambiar de escena después.
export function prepararOriginal(imagen, giro = 0) {
    return girar(imagen, giro, Math.min(1, LADO_TRABAJO / Math.max(imagen.width, imagen.height))).toDataURL("image/jpeg", 0.88);
}

// Guarda o quita la foto según lo elegido en el formulario.
// foto: data URL nueva, null para quitarla, undefined para dejarla igual.
// editada: ya tiene una escena del catálogo; original: la foto sin editar (para cambiar de escena).
export async function guardarFoto(productoId, foto, { editada = false, original = null } = {}) {
    if (foto === undefined) return;

    if (foto === null) {
        await pedir(`/api/productos/${productoId}/foto`, { method: "DELETE" });
    } else {
        await pedir(`/api/productos/${productoId}/foto`, { method: "PUT", cuerpo: { foto, editada, original } });
    }
}

// Dirección de la foto sin editar (o la foto guardada, si no hay original). Solo el jefe.
export function urlFotoOriginal(producto) {
    return `/api/productos/${producto.id}/foto-original?v=${producto.fotoVersion}`;
}
