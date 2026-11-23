import { moneda } from "./api.js";
import { RECARGO_TARJETA, cobroConTarjeta } from "./datosPago.js";
import { fraseDeBoleta } from "./frases.js";
import { UNIDADES_MODALIDAD, enlaceCatalogo, importeItem, nombreCortoPago, nombreMetodoPago, precioCobrado } from "./venta.js";

/* Imagen de la boleta para enviar por WhatsApp, con la identidad del catálogo (logo, morado y dorado)
   y decorada según la campaña actual:
   - encabezado festivo con el logo, la campaña y su descripción;
   - «Tus productos»: lo que compró, cada uno con su foto, y el total;
   - una frase inspiradora (distinta en cada boleta);
   - «Lo más vendido» de la campaña, con foto, nombre y precio;
   - pie con el agradecimiento y el enlace al catálogo. */

// Datos del negocio que van impresos en la boleta.
export const NEGOCIO = {
    duena: "Carolina Rojas",
    // Si no hay campaña visible en el catálogo, se usa esta descripción.
    rubro: "Productos navideños y escolares, al por mayor y menor.",
    telefono: "917303705"
};

const ANCHO = 707;
const ESCALA = 2; // 1414 px de ancho: nítida en el celular.
const M = 32; // margen
const DERECHA = ANCHO - M;
const ALTO_ENCABEZADO = 262;

// Paleta del catálogo.
const C = {
    fondo: "#f7f2ff",
    morado900: "#2e1065",
    morado800: "#4c1d95",
    morado700: "#6d28d9",
    morado500: "#8b5cf6",
    morado200: "#e9d5ff",
    morado150: "#ede9fe",
    morado50: "#faf7ff",
    dorado: "#b8892f",
    doradoClaro: "#f3d38b",
    doradoSuave: "#fbf3e2",
    doradoOscuro: "#6b4e12",
    tinta: "#241736",
    suave: "#6b5b7a"
};

// Colores alegres de cada campaña (esferas, banderines y confeti).
const TEMAS = {
    navidad: { icono: "🎄", acentos: ["#d4343b", "#e7b53c", "#1f8a5b", "#f3d38b", "#c084fc"], adorno: "esferas" },
    escolar: { icono: "🎒", acentos: ["#f5b301", "#3b82f6", "#ec4899", "#22c55e", "#f97316"], adorno: "banderines" },
    general: { icono: "✨", acentos: ["#f3d38b", "#ec4899", "#a78bfa", "#38bdf8", "#f59e0b"], adorno: "banderines" }
};

const SERIF = "'Playfair Display', Georgia, serif";
// Letra del texto: la del sistema (en el canvas se ve pareja y con el grosor correcto en todos los celulares).
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const CURSIVA = "'Great Vibes', 'Segoe Script', cursive";

const MAXIMO_DESTACADOS = 4;

function cargarImagen(src) {
    return new Promise((resolver) => {
        if (!src) return resolver(null);
        const imagen = new Image();
        const tiempo = setTimeout(() => resolver(null), 6000);
        imagen.onload = () => { clearTimeout(tiempo); resolver(imagen); };
        imagen.onerror = () => { clearTimeout(tiempo); resolver(null); }; // Sin esa imagen, la boleta igual sale.
        imagen.src = src;
    });
}

async function cargarFuentes() {
    try {
        await Promise.all([
            document.fonts?.load(`40px ${CURSIVA}`),
            document.fonts?.load(`700 30px ${SERIF}`),
            document.fonts?.load(`italic 500 30px ${SERIF}`),
            document.fonts?.load(`600 30px ${SERIF}`)
        ]);
        await document.fonts?.ready;
    } catch {
        // Si una fuente no carga, se usa la de respaldo.
    }
}

// Miniatura de un producto, desde la misma dirección de la app (directo=1) para poder dibujarla.
const urlMiniatura = (id, version) => `/api/productos/${id}/foto?v=${version ?? 0}&tam=mini&directo=1`;

/* Todo lo que la boleta necesita además de la venta: campaña, logo, fotos de lo comprado
   y los más vendidos de la campaña (sin repetir lo que ya compró). */
async function cargarExtras(boleta) {
    let extras = { campana: null, logoVersion: null, masVendidos: [] };

    try {
        const respuesta = await fetch("/api/publico/boleta-extras");
        if (respuesta.ok) extras = await respuesta.json();
    } catch {
        // Sin conexión: la boleta sale sin campaña ni destacados.
    }

    const comprados = new Set((boleta.items ?? []).map((item) => item.productoId));
    const destacados = (extras.masVendidos ?? []).filter((p) => !comprados.has(p.id)).slice(0, MAXIMO_DESTACADOS);

    const fotosComprados = new Map();
    for (const item of boleta.items ?? []) {
        if (item.tieneFoto && item.productoId && !fotosComprados.has(item.productoId)) {
            fotosComprados.set(item.productoId, urlMiniatura(item.productoId, item.fotoVersion));
        }
    }

    const [logo, imagenesComprados, imagenesDestacados] = await Promise.all([
        extras.logoVersion ? cargarImagen(`/api/tienda/imagen/logo?v=${extras.logoVersion}&directo=1`) : null,
        Promise.all([...fotosComprados.entries()].map(async ([id, url]) => [id, await cargarImagen(url)])),
        Promise.all(destacados.map(async (p) => ({ ...p, imagen: await cargarImagen(urlMiniatura(p.id, p.fotoVersion)) })))
    ]);

    return {
        campana: extras.campana,
        logo,
        fotos: new Map(imagenesComprados.filter(([, imagen]) => imagen)),
        destacados: imagenesDestacados.filter((p) => p.imagen)
    };
}

// Parte un texto en líneas que quepan en el ancho indicado.
function partirTexto(ctx, texto, anchoMaximo) {
    const lineas = [];
    let actual = "";

    for (const palabra of String(texto ?? "").split(" ")) {
        const prueba = actual ? `${actual} ${palabra}` : palabra;
        if (ctx.measureText(prueba).width > anchoMaximo && actual) {
            lineas.push(actual);
            actual = palabra;
        } else {
            actual = prueba;
        }
    }

    if (actual) lineas.push(actual);
    return lineas;
}

// Recorta un texto con «…» si no entra en el ancho.
function recortar(ctx, texto, ancho) {
    if (ctx.measureText(texto).width <= ancho) return texto;
    let corto = texto;
    while (corto.length > 1 && ctx.measureText(`${corto}…`).width > ancho) corto = corto.slice(0, -1);
    return `${corto.trimEnd()}…`;
}

function redondeado(ctx, x, y, ancho, alto, radio) {
    ctx.beginPath();
    ctx.roundRect(x, y, ancho, alto, radio);
}

// Tarjeta blanca con sombra suave.
function tarjeta(ctx, x, y, ancho, alto, radio = 22) {
    ctx.save();
    ctx.shadowColor = "rgba(76, 29, 149, 0.12)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    redondeado(ctx, x, y, ancho, alto, radio);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
}

// Destello de cuatro puntas.
function destello(ctx, x, y, tamano, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - tamano);
    ctx.quadraticCurveTo(x, y, x + tamano, y);
    ctx.quadraticCurveTo(x, y, x, y + tamano);
    ctx.quadraticCurveTo(x, y, x - tamano, y);
    ctx.quadraticCurveTo(x, y, x, y - tamano);
    ctx.fill();
    ctx.restore();
}

// Generador con semilla: la decoración sale igual en cada boleta.
function azar(semilla) {
    let s = semilla;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

// Imagen recortada para cubrir el recuadro (sin deformarla).
function dibujarCubriendo(ctx, imagen, x, y, ancho, alto) {
    const escala = Math.max(ancho / imagen.width, alto / imagen.height);
    const anchoFuente = ancho / escala;
    const altoFuente = alto / escala;
    ctx.drawImage(imagen, (imagen.width - anchoFuente) / 2, (imagen.height - altoFuente) / 2, anchoFuente, altoFuente, x, y, ancho, alto);
}

// Fecha en hora de Lima: «23 nov. 2026».
function fechaLima(fecha) {
    return new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short", year: "numeric" })
        .format(new Date(fecha));
}

// Cantidad (en paquetes si es docena o media) y detalle de cada producto.
function filaDeProducto(item) {
    const porPaquete = UNIDADES_MODALIDAD[item.modalidad] ?? 1;
    const paquetes = item.cantidad / porPaquete;
    const cantidad = Number.isInteger(paquetes) ? String(paquetes) : paquetes.toFixed(1);
    const unidad = item.modalidad === "docena"
        ? (paquetes === 1 ? "docena" : "docenas")
        : item.modalidad === "media"
            ? (paquetes === 1 ? "media docena" : "medias docenas")
            : (paquetes === 1 ? "unidad" : "unidades");
    const detalle = item.obsequio
        ? `${cantidad} ${unidad} · 🎁 Obsequio`
        : `${cantidad} ${unidad} × ${moneda(precioCobrado(item))}`;
    const devueltas = Number(item.unidadesDevueltas ?? 0) > 0 ? ` · ${item.unidadesDevueltas} devueltas` : "";

    return {
        productoId: item.productoId,
        nombre: item.producto,
        detalle: detalle + devueltas,
        importe: item.obsequio ? "Gratis" : moneda(importeItem(item))
    };
}

/* ---------- Encabezado ---------- */

function dibujarEncabezado(ctx, boleta, extras, tema, lineasDescripcion) {
    const banda = ctx.createLinearGradient(0, 0, ANCHO, ALTO_ENCABEZADO);
    banda.addColorStop(0, C.morado900);
    banda.addColorStop(0.55, C.morado800);
    banda.addColorStop(1, C.morado700);
    ctx.fillStyle = banda;
    ctx.fillRect(0, 0, ANCHO, ALTO_ENCABEZADO);

    // Luces suaves (bokeh) de colores: alegres pero sin tapar el texto.
    const aleatorio = azar(7);
    for (let i = 0; i < 16; i++) {
        const x = aleatorio() * ANCHO;
        const y = aleatorio() * ALTO_ENCABEZADO;
        const radio = 18 + aleatorio() * 46;
        const color = tema.acentos[i % tema.acentos.length];
        const luz = ctx.createRadialGradient(x, y, 0, x, y, radio);
        luz.addColorStop(0, `${color}55`);
        luz.addColorStop(1, `${color}00`);
        ctx.fillStyle = luz;
        ctx.fillRect(x - radio, y - radio, radio * 2, radio * 2);
    }
    for (let i = 0; i < 14; i++) {
        destello(ctx, 140 + aleatorio() * 360, 8 + aleatorio() * 26, 1.5 + aleatorio() * 3, `rgba(243, 211, 139, ${0.4 + aleatorio() * 0.5})`);
    }

    // Logo del catálogo (o el monograma «MD») en un círculo blanco con aro dorado.
    const xLogo = M + 44;
    const yLogo = 80;
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(xLogo, yLogo, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (extras.logo) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(xLogo, yLogo, 38, 0, Math.PI * 2);
        ctx.clip();
        const escala = Math.min(70 / extras.logo.width, 70 / extras.logo.height);
        const ancho = extras.logo.width * escala;
        const alto = extras.logo.height * escala;
        ctx.drawImage(extras.logo, xLogo - ancho / 2, yLogo - alto / 2, ancho, alto);
        ctx.restore();
    } else {
        ctx.strokeStyle = C.dorado;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(xLogo, yLogo, 34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = C.morado800;
        ctx.textAlign = "center";
        ctx.font = `600 24px ${SERIF}`;
        ctx.fillText("MD", xLogo, yLogo + 8);
    }
    ctx.strokeStyle = C.doradoClaro;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(xLogo, yLogo, 44, 0, Math.PI * 2);
    ctx.stroke();

    // Marca.
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 36px ${SERIF}`;
    ctx.fillText("Mil Deseos", xLogo + 60, 78);
    ctx.font = `500 13px ${SANS}`;
    ctx.fillStyle = C.morado200;
    ctx.fillText(`De: ${NEGOCIO.duena} · WhatsApp ${NEGOCIO.telefono}`, xLogo + 62, 102);

    // Boleta, número y fecha.
    ctx.textAlign = "right";
    ctx.fillStyle = C.doradoClaro;
    ctx.font = `700 11.5px ${SANS}`;
    ctx.fillText("B O L E T A   D E   V E N T A", DERECHA, 40);
    const numero = `N° ${String(boleta.numero).padStart(9, "0")}`;
    ctx.font = `700 15px ${SANS}`;
    const anchoNumero = ctx.measureText(numero).width + 30;
    const brilloDorado = ctx.createLinearGradient(DERECHA - anchoNumero, 0, DERECHA, 0);
    brilloDorado.addColorStop(0, "#c99a3b");
    brilloDorado.addColorStop(1, C.dorado);
    redondeado(ctx, DERECHA - anchoNumero, 52, anchoNumero, 32, 16);
    ctx.fillStyle = brilloDorado;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(numero, DERECHA - 15, 73);
    ctx.font = `500 13.5px ${SANS}`;
    ctx.fillText(fechaLima(boleta.fecha), DERECHA, 106);

    // Campaña: etiqueta y descripción.
    let yCampana = 142;
    if (extras.campana) {
        const texto = `${tema.icono}  ${extras.campana.nombre.toUpperCase()}`;
        ctx.font = `700 12.5px ${SANS}`;
        const anchoEtiqueta = ctx.measureText(texto).width + 28;
        redondeado(ctx, M, yCampana, anchoEtiqueta, 28, 14);
        ctx.fillStyle = "rgba(243, 211, 139, 0.18)";
        ctx.fill();
        ctx.strokeStyle = "rgba(243, 211, 139, 0.7)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.textAlign = "left";
        ctx.fillStyle = C.doradoClaro;
        ctx.fillText(texto, M + 14, yCampana + 19);
        yCampana += 48;
    } else {
        yCampana += 18;
    }

    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = `500 15px ${SANS}`;
    lineasDescripcion.forEach((l, i) => ctx.fillText(l, M, yCampana + i * 20));

    // Borde inferior festivo: guirnalda con esferas (Navidad) o banderines (Escolar y otras).
    const yCuerda = ALTO_ENCABEZADO - 6;
    ctx.fillStyle = C.fondo;
    ctx.beginPath();
    ctx.moveTo(0, ALTO_ENCABEZADO);
    for (let x = 0; x <= ANCHO; x += 8) {
        ctx.lineTo(x, ALTO_ENCABEZADO - 4 + Math.sin(x / 38) * 4);
    }
    ctx.lineTo(ANCHO, ALTO_ENCABEZADO + 10);
    ctx.lineTo(0, ALTO_ENCABEZADO + 10);
    ctx.fill();

    const curva = (x) => yCuerda - 22 + Math.sin((x / ANCHO) * Math.PI * 3) * 8;
    ctx.strokeStyle = "rgba(243, 211, 139, 0.9)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = 0; x <= ANCHO; x += 6) {
        if (x === 0) ctx.moveTo(x, curva(x));
        else ctx.lineTo(x, curva(x));
    }
    ctx.stroke();

    const cantidad = 13;
    for (let i = 0; i < cantidad; i++) {
        const x = ((i + 0.5) / cantidad) * ANCHO;
        const y = curva(x);
        const color = tema.acentos[i % tema.acentos.length];

        if (tema.adorno === "esferas") {
            const largo = 10 + (i % 3) * 7;
            ctx.strokeStyle = "rgba(243, 211, 139, 0.8)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + largo);
            ctx.stroke();
            const radio = 8 + (i % 2) * 3;
            const cy = y + largo + radio;
            const esfera = ctx.createRadialGradient(x - radio / 3, cy - radio / 3, 1, x, cy, radio);
            esfera.addColorStop(0, "#ffffff");
            esfera.addColorStop(0.25, color);
            esfera.addColorStop(1, color);
            ctx.fillStyle = esfera;
            ctx.beginPath();
            ctx.arc(x, cy, radio, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = C.doradoClaro;
            ctx.fillRect(x - 3, y + largo - 2, 6, 4);
        } else {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(x - 13, y);
            ctx.lineTo(x + 13, y);
            ctx.lineTo(x, y + 24);
            ctx.closePath();
            ctx.fill();
        }
    }
}

/* ---------- Dibujo completo ---------- */

// Dibuja la boleta y devuelve un archivo JPG listo para compartir.
export async function generarImagenComprobante(boleta) {
    const [, extras] = await Promise.all([cargarFuentes(), cargarExtras(boleta)]);
    const tema = TEMAS[extras.campana?.tema] ?? TEMAS.general;

    const lienzo = document.createElement("canvas");
    const ctx = lienzo.getContext("2d");

    // ---- Medidas (todo crece según el contenido) ----
    ctx.font = `500 15px ${SANS}`;
    const lineasDescripcion = partirTexto(ctx, extras.campana?.descripcion || NEGOCIO.rubro, ANCHO - 2 * M - 30).slice(0, 2);

    const X_TARJETA = M;
    const ANCHO_TARJETA = ANCHO - 2 * M;
    const PAD = 24;
    const X_NOMBRE = X_TARJETA + PAD + 62;
    const X_IMPORTE = X_TARJETA + ANCHO_TARJETA - PAD;
    ctx.font = `600 15.5px ${SANS}`;
    const filas = boleta.items.map((item) => {
        const fila = filaDeProducto(item);
        const lineas = partirTexto(ctx, fila.nombre, X_IMPORTE - 110 - X_NOMBRE).slice(0, 3);
        return { ...fila, lineas, alto: Math.max(70, 24 + lineas.length * 20 + 22) };
    });

    const pagosMixtos = boleta.metodoPago === "mixto" && Array.isArray(boleta.pagos) ? boleta.pagos : null;
    const baseTarjeta = boleta.metodoPago === "tarjeta"
        ? Number(boleta.total)
        : Number(pagosMixtos?.find((p) => p.metodo === "tarjeta")?.monto ?? 0);
    const tarjetaIzipay = baseTarjeta > 0 ? cobroConTarjeta(baseTarjeta) : null;
    const conDescuento = Number(boleta.ajuste?.monto ?? 0) > 0;

    const altoPago = 30 + (pagosMixtos ? pagosMixtos.length : 1) * 22 + 10;
    const altoTotales = (conDescuento ? 48 : 0) + 56 + (tarjetaIzipay ? 46 : 0);
    const altoPie = Math.max(altoPago, altoTotales);

    const inicioTarjeta = ALTO_ENCABEZADO + 26;
    const yTitulo = inicioTarjeta + 92;
    const inicioFilas = yTitulo + 26;
    const finFilas = inicioFilas + filas.reduce((suma, f) => suma + f.alto, 0);
    const inicioPie = finFilas + 22;
    const finTarjeta = inicioPie + altoPie + PAD;

    const frase = fraseDeBoleta(boleta.numero);
    ctx.font = `italic 500 20px ${SERIF}`;
    const lineasFrase = partirTexto(ctx, frase, ANCHO - 2 * M - 120);
    const inicioFrase = finTarjeta + 26;
    const altoFrase = 56 + lineasFrase.length * 30;

    const hayDestacados = extras.destacados.length > 0;
    const inicioDestacados = inicioFrase + altoFrase + 34;
    const anchoDestacado = (ANCHO - 2 * M - 12 * (MAXIMO_DESTACADOS - 1)) / MAXIMO_DESTACADOS;
    const altoDestacado = anchoDestacado + 92;
    const finDestacados = hayDestacados ? inicioDestacados + 40 + altoDestacado : inicioFrase + altoFrase;

    const ALTO_PIE = 118;
    const inicioPieDePagina = finDestacados + 34;
    const alto = inicioPieDePagina + ALTO_PIE;

    lienzo.width = ANCHO * ESCALA;
    lienzo.height = alto * ESCALA;
    ctx.scale(ESCALA, ESCALA);
    ctx.textBaseline = "alphabetic";

    // ---- Fondo lila con confeti suave ----
    ctx.fillStyle = C.fondo;
    ctx.fillRect(0, 0, ANCHO, alto);
    const confeti = azar(23);
    for (let i = 0; i < 60; i++) {
        const lado = confeti() < 0.5 ? confeti() * 22 : ANCHO - confeti() * 22;
        const y = ALTO_ENCABEZADO + confeti() * (alto - ALTO_ENCABEZADO - ALTO_PIE);
        ctx.fillStyle = `${tema.acentos[i % tema.acentos.length]}66`;
        if (i % 3 === 0) destello(ctx, lado, y, 3, `${C.dorado}88`);
        else ctx.fillRect(lado, y, 3 + confeti() * 3, 3 + confeti() * 3);
    }

    dibujarEncabezado(ctx, boleta, extras, tema, lineasDescripcion);

    // ---- Tarjeta «Tus productos» ----
    tarjeta(ctx, X_TARJETA, inicioTarjeta, ANCHO_TARJETA, finTarjeta - inicioTarjeta);

    // Cliente y quién atendió.
    const yDatos = inicioTarjeta + 34;
    ctx.textAlign = "left";
    ctx.font = `600 12px ${SANS}`;
    ctx.fillStyle = C.dorado;
    ctx.fillText("CLIENTE", X_TARJETA + PAD, yDatos - 12);
    ctx.font = `600 15px ${SANS}`;
    ctx.fillStyle = C.tinta;
    ctx.fillText(recortar(ctx, boleta.cliente || "Público en general", 300), X_TARJETA + PAD, yDatos + 8);

    ctx.textAlign = "right";
    ctx.font = `600 12px ${SANS}`;
    ctx.fillStyle = C.dorado;
    ctx.fillText("ATENDIDO POR", X_IMPORTE, yDatos - 12);
    ctx.font = `600 15px ${SANS}`;
    ctx.fillStyle = C.tinta;
    ctx.fillText(recortar(ctx, boleta.vendedor ?? "", 260), X_IMPORTE, yDatos + 8);

    const linea = ctx.createLinearGradient(X_TARJETA + PAD, 0, X_IMPORTE, 0);
    linea.addColorStop(0, "rgba(184, 137, 47, 0)");
    linea.addColorStop(0.5, C.dorado);
    linea.addColorStop(1, "rgba(184, 137, 47, 0)");
    ctx.fillStyle = linea;
    ctx.fillRect(X_TARJETA + PAD, yDatos + 26, X_IMPORTE - X_TARJETA - PAD, 1.2);

    // Título de la sección.
    ctx.textAlign = "left";
    ctx.font = `700 21px ${SERIF}`;
    ctx.fillStyle = C.morado800;
    ctx.fillText("Tus productos", X_TARJETA + PAD + 26, yTitulo);
    ctx.font = `18px ${SANS}`;
    ctx.fillText("🛍️", X_TARJETA + PAD, yTitulo - 1);
    ctx.textAlign = "right";
    ctx.font = `600 12px ${SANS}`;
    ctx.fillStyle = C.suave;
    const piezas = boleta.items.reduce((suma, item) => suma + Number(item.cantidad), 0);
    ctx.fillText(`${piezas} ${piezas === 1 ? "pieza" : "piezas"}`, X_IMPORTE, yTitulo);

    // Productos comprados, cada uno con su foto.
    let y = inicioFilas;
    filas.forEach((fila, indice) => {
        const xFoto = X_TARJETA + PAD;
        const yFoto = y + (fila.alto - 50) / 2;
        const foto = extras.fotos.get(fila.productoId);
        ctx.save();
        redondeado(ctx, xFoto, yFoto, 50, 50, 12);
        ctx.clip();
        if (foto) {
            dibujarCubriendo(ctx, foto, xFoto, yFoto, 50, 50);
        } else {
            ctx.fillStyle = C.morado150;
            ctx.fillRect(xFoto, yFoto, 50, 50);
            ctx.fillStyle = C.morado700;
            ctx.textAlign = "center";
            ctx.font = `600 22px ${SERIF}`;
            ctx.fillText((fila.nombre ?? "?").trim().charAt(0).toUpperCase(), xFoto + 25, yFoto + 33);
        }
        ctx.restore();
        redondeado(ctx, xFoto, yFoto, 50, 50, 12);
        ctx.strokeStyle = C.morado200;
        ctx.lineWidth = 1;
        ctx.stroke();

        const altoTexto = fila.lineas.length * 20 + 20;
        let yTexto = y + (fila.alto - altoTexto) / 2 + 15;
        ctx.textAlign = "left";
        ctx.fillStyle = C.tinta;
        ctx.font = `600 15.5px ${SANS}`;
        fila.lineas.forEach((l) => {
            ctx.fillText(l, X_NOMBRE, yTexto);
            yTexto += 20;
        });
        ctx.font = `500 13px ${SANS}`;
        ctx.fillStyle = C.suave;
        ctx.fillText(fila.detalle, X_NOMBRE, yTexto);

        ctx.textAlign = "right";
        ctx.font = `700 16px ${SANS}`;
        ctx.fillStyle = C.morado800;
        ctx.fillText(fila.importe, X_IMPORTE, y + fila.alto / 2 + 6);

        y += fila.alto;
        if (indice < filas.length - 1) {
            ctx.fillStyle = C.morado150;
            ctx.fillRect(X_NOMBRE, y, X_IMPORTE - X_NOMBRE, 1);
        }
    });

    // Forma de pago (izquierda) y total (derecha).
    const anchoPago = 270;
    const xPago = X_TARJETA + PAD;
    redondeado(ctx, xPago, inicioPie, anchoPago, altoPago, 16);
    ctx.fillStyle = C.morado50;
    ctx.fill();
    ctx.strokeStyle = C.morado150;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.font = `700 11.5px ${SANS}`;
    ctx.fillStyle = C.dorado;
    ctx.fillText(pagosMixtos ? "PAGÓ CON" : "FORMA DE PAGO", xPago + 16, inicioPie + 24);
    let yPago = inicioPie + 24;
    for (const pago of pagosMixtos ?? [{ metodo: boleta.metodoPago, monto: null }]) {
        yPago += 22;
        ctx.textAlign = "left";
        ctx.font = `600 15px ${SANS}`;
        ctx.fillStyle = C.tinta;
        ctx.fillText(pago.monto === null ? nombreMetodoPago(pago.metodo) : nombreCortoPago(pago.metodo), xPago + 16, yPago);
        if (pago.monto !== null) {
            ctx.textAlign = "right";
            ctx.fillText(moneda(pago.monto), xPago + anchoPago - 16, yPago);
        }
    }

    const xTotales = xPago + anchoPago + 18;
    let yTotal = inicioPie;
    if (conDescuento) {
        ctx.font = `500 13.5px ${SANS}`;
        ctx.fillStyle = C.suave;
        ctx.textAlign = "left";
        ctx.fillText("Subtotal", xTotales + 6, yTotal + 16);
        ctx.fillText("Descuento", xTotales + 6, yTotal + 38);
        ctx.textAlign = "right";
        ctx.fillText(moneda(boleta.subtotal), X_IMPORTE - 6, yTotal + 16);
        ctx.fillText(`− ${moneda(boleta.ajuste.monto)}`, X_IMPORTE - 6, yTotal + 38);
        yTotal += 48;
    }
    const caja = ctx.createLinearGradient(xTotales, 0, X_IMPORTE, 0);
    caja.addColorStop(0, C.morado800);
    caja.addColorStop(1, C.morado700);
    ctx.save();
    ctx.shadowColor = "rgba(76, 29, 149, 0.3)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
    redondeado(ctx, xTotales, yTotal, X_IMPORTE - xTotales, 54, 16);
    ctx.fillStyle = caja;
    ctx.fill();
    ctx.restore();
    destello(ctx, xTotales + 16, yTotal + 14, 4, C.doradoClaro);
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 13px ${SANS}`;
    ctx.fillText("TOTAL", xTotales + 26, yTotal + 33);
    ctx.textAlign = "right";
    ctx.fillStyle = C.doradoClaro;
    ctx.font = `700 25px ${SANS}`;
    ctx.fillText(moneda(boleta.total), X_IMPORTE - 16, yTotal + 36);
    if (tarjetaIzipay) {
        const totalConRecargo = Number(boleta.total) + tarjetaIzipay.recargo;
        ctx.font = `500 12.5px ${SANS}`;
        ctx.fillStyle = C.suave;
        ctx.fillText(
            boleta.metodoPago === "tarjeta"
                ? `Tarjeta (Izipay) recargo ${RECARGO_TARJETA}%: + ${moneda(tarjetaIzipay.recargo)}`
                : `Tarjeta ${moneda(tarjetaIzipay.base)}, recargo ${RECARGO_TARJETA}%: + ${moneda(tarjetaIzipay.recargo)}`,
            X_IMPORTE - 4, yTotal + 74
        );
        ctx.font = `700 14px ${SANS}`;
        ctx.fillStyle = C.morado800;
        ctx.fillText(`Total con recargo: ${moneda(totalConRecargo)}`, X_IMPORTE - 4, yTotal + 94);
    }

    // ---- Frase inspiradora (distinta en cada boleta) ----
    const fondoFrase = ctx.createLinearGradient(M, inicioFrase, DERECHA, inicioFrase + altoFrase);
    fondoFrase.addColorStop(0, C.doradoSuave);
    fondoFrase.addColorStop(1, "#ffffff");
    redondeado(ctx, M, inicioFrase, ANCHO - 2 * M, altoFrase, 20);
    ctx.fillStyle = fondoFrase;
    ctx.fill();
    ctx.strokeStyle = "rgba(184, 137, 47, 0.55)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.font = `700 70px ${SERIF}`;
    ctx.fillStyle = "rgba(184, 137, 47, 0.25)";
    ctx.textAlign = "left";
    ctx.fillText("“", M + 18, inicioFrase + 62);
    ctx.textAlign = "right";
    ctx.fillText("”", DERECHA - 18, inicioFrase + altoFrase - 2);
    ctx.textAlign = "center";
    ctx.font = `700 11px ${SANS}`;
    ctx.fillStyle = C.dorado;
    ctx.fillText("✦  UN DESEO PARA TI  ✦", ANCHO / 2, inicioFrase + 26);
    ctx.font = `italic 500 20px ${SERIF}`;
    ctx.fillStyle = C.morado700;
    lineasFrase.forEach((l, i) => ctx.fillText(l, ANCHO / 2, inicioFrase + 56 + i * 30));

    // ---- «Lo más vendido» de la campaña ----
    if (hayDestacados) {
        ctx.textAlign = "left";
        ctx.font = `700 21px ${SERIF}`;
        ctx.fillStyle = C.morado800;
        const titulo = extras.campana ? `Lo más vendido de la ${extras.campana.nombre}` : "Lo más vendido";
        ctx.fillText(recortar(ctx, titulo, ANCHO - 2 * M - 30), M + 26, inicioDestacados + 22);
        ctx.font = `18px ${SANS}`;
        ctx.fillText("✨", M, inicioDestacados + 21);
        ctx.font = `500 12.5px ${SANS}`;
        ctx.fillStyle = C.suave;
        ctx.fillText("Pídelos por WhatsApp o en el catálogo", M + 26, inicioDestacados + 40);

        extras.destacados.forEach((producto, i) => {
            const x = M + i * (anchoDestacado + 12);
            const yCarta = inicioDestacados + 52;
            tarjeta(ctx, x, yCarta, anchoDestacado, altoDestacado - 12, 16);
            ctx.save();
            redondeado(ctx, x, yCarta, anchoDestacado, anchoDestacado, [16, 16, 0, 0]);
            ctx.clip();
            dibujarCubriendo(ctx, producto.imagen, x, yCarta, anchoDestacado, anchoDestacado);
            ctx.restore();
            if (i === 0) {
                ctx.font = `700 10px ${SANS}`;
                const etiqueta = "★ MÁS VENDIDO";
                const anchoEtiqueta = ctx.measureText(etiqueta).width + 14;
                redondeado(ctx, x + 8, yCarta + 8, anchoEtiqueta, 20, 10);
                ctx.fillStyle = C.dorado;
                ctx.fill();
                ctx.fillStyle = "#ffffff";
                ctx.textAlign = "left";
                ctx.fillText(etiqueta, x + 15, yCarta + 22);
            }
            ctx.textAlign = "left";
            ctx.font = `600 12.5px ${SANS}`;
            ctx.fillStyle = C.tinta;
            const lineasNombre = partirTexto(ctx, producto.nombre, anchoDestacado - 20);
            lineasNombre.slice(0, 2).forEach((l, j) => {
                // Si el nombre no entra en dos líneas, la segunda termina en «…».
                const texto = j === 1 && lineasNombre.length > 2 ? recortar(ctx, `${l} ${lineasNombre[2]}`, anchoDestacado - 20) : l;
                ctx.fillText(texto, x + 10, yCarta + anchoDestacado + 22 + j * 16);
            });
            ctx.font = `700 14px ${SANS}`;
            ctx.fillStyle = C.dorado;
            ctx.fillText(moneda(producto.precio), x + 10, yCarta + anchoDestacado + 66);
        });
    }

    // ---- Pie de página morado ----
    const pie = ctx.createLinearGradient(0, inicioPieDePagina, ANCHO, alto);
    pie.addColorStop(0, C.morado900);
    pie.addColorStop(1, C.morado700);
    ctx.fillStyle = pie;
    ctx.fillRect(0, inicioPieDePagina, ANCHO, ALTO_PIE);
    const brillos = azar(5);
    for (let i = 0; i < 10; i++) {
        destello(ctx, 20 + brillos() * (ANCHO - 40), inicioPieDePagina + 12 + brillos() * (ALTO_PIE - 24), 1.5 + brillos() * 2.5, "rgba(243, 211, 139, 0.6)");
    }
    ctx.textAlign = "center";
    ctx.font = `36px ${CURSIVA}`;
    ctx.fillStyle = C.doradoClaro;
    ctx.fillText("Gracias por tu preferencia", ANCHO / 2, inicioPieDePagina + 50);
    ctx.font = `600 13.5px ${SANS}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`🛍️ Mira el catálogo: ${enlaceCatalogo().replace(/^https?:\/\//, "")}`, ANCHO / 2, inicioPieDePagina + 84);

    // Boleta anulada: sello en diagonal.
    if (boleta.anulada) {
        ctx.save();
        ctx.translate(ANCHO / 2, (inicioTarjeta + finTarjeta) / 2);
        ctx.rotate(-0.35);
        ctx.font = `800 70px ${SANS}`;
        ctx.fillStyle = "rgba(185, 28, 28, 0.3)";
        ctx.fillText("ANULADA", 0, 20);
        ctx.restore();
    }

    const blob = await new Promise((resolver, rechazar) =>
        lienzo.toBlob(
            (resultado) => (resultado ? resolver(resultado) : rechazar(new Error("No se pudo crear la imagen."))),
            // JPG: pesa varias veces menos que PNG y se comparte más rápido por WhatsApp.
            "image/jpeg",
            0.84
        )
    );

    return new File([blob], `boleta-${String(boleta.numero).padStart(9, "0")}.jpg`, { type: "image/jpeg" });
}
