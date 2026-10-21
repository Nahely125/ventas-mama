import { moneda } from "./api.js";
import {
    describirCantidad,
    enlaceCatalogo,
    formatearFecha,
    nombreMetodoPago,
    numeroComprobante,
    precioCobrado
} from "./venta.js";

const ANCHO = 600;
const ESCALA = 2; // Doble resolución para que se vea nítida en el celular.
const MARGEN = 40;

const COLORES = {
    fondo: "#ffffff",
    morado: "#6d28d9",
    moradoClaro: "#a78bfa",
    lila: "#f5f0ff",
    borde: "#e9d5ff",
    texto: "#3b2a50",
    suave: "#6b5b7a"
};

const SERIF = "'Playfair Display', Georgia, serif";
const SANS = "Montserrat, 'Segoe UI', Arial, sans-serif";

// Parte un texto en líneas que quepan en el ancho indicado.
function partirTexto(ctx, texto, anchoMaximo) {
    const palabras = texto.split(" ");
    const lineas = [];
    let actual = "";

    for (const palabra of palabras) {
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

function rectanguloRedondeado(ctx, x, y, ancho, alto, radio) {
    ctx.beginPath();
    ctx.roundRect(x, y, ancho, alto, radio);
}

function fila(ctx, y, etiqueta, valor, { negrita = true } = {}) {
    ctx.font = `500 17px ${SANS}`;
    ctx.fillStyle = COLORES.suave;
    ctx.textAlign = "left";
    ctx.fillText(etiqueta, MARGEN + 20, y);

    ctx.font = `${negrita ? 700 : 500} 17px ${SANS}`;
    ctx.fillStyle = COLORES.texto;
    ctx.textAlign = "right";
    ctx.fillText(valor, ANCHO - MARGEN - 20, y);
    ctx.textAlign = "left";
}

function lineaPunteada(ctx, y) {
    ctx.save();
    ctx.strokeStyle = COLORES.borde;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(MARGEN + 20, y);
    ctx.lineTo(ANCHO - MARGEN - 20, y);
    ctx.stroke();
    ctx.restore();
}

// Dibuja el comprobante y devuelve un archivo PNG listo para compartir.
export async function generarImagenComprobante(venta) {
    // Espera a que carguen las fuentes de la página para usarlas en el dibujo.
    if (document.fonts?.ready) {
        await document.fonts.ready;
    }

    const lienzo = document.createElement("canvas");
    const ctx = lienzo.getContext("2d");

    // Primero se calcula cuántas líneas ocupa el nombre del producto.
    ctx.font = `700 22px ${SANS}`;
    const lineasProducto = partirTexto(ctx, venta.producto, ANCHO - MARGEN * 2 - 40);
    const altoProducto = 30 + lineasProducto.length * 28 + (venta.codigo ? 24 : 0) + 10;

    const alto = 170 + 90 + altoProducto + 150 + 120 + 90 + 64;

    lienzo.width = ANCHO * ESCALA;
    lienzo.height = alto * ESCALA;
    ctx.scale(ESCALA, ESCALA);
    ctx.textBaseline = "alphabetic";

    // Fondo
    ctx.fillStyle = "#faf7ff";
    ctx.fillRect(0, 0, ANCHO, alto);

    // Tarjeta blanca
    rectanguloRedondeado(ctx, 20, 20, ANCHO - 40, alto - 40, 24);
    ctx.fillStyle = COLORES.fondo;
    ctx.fill();
    ctx.strokeStyle = COLORES.borde;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Encabezado con degradado
    const degradado = ctx.createLinearGradient(20, 20, ANCHO - 20, 150);
    degradado.addColorStop(0, COLORES.moradoClaro);
    degradado.addColorStop(1, COLORES.morado);
    ctx.save();
    rectanguloRedondeado(ctx, 20, 20, ANCHO - 40, 130, [24, 24, 0, 0]);
    ctx.fillStyle = degradado;
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = `700 38px ${SERIF}`;
    ctx.fillText("Mil Deseos", ANCHO / 2, 85);
    ctx.font = `500 17px ${SANS}`;
    ctx.fillText(`Boleta de venta N° ${numeroComprobante(venta)}`, ANCHO / 2, 120);
    ctx.textAlign = "left";

    let y = 195;

    fila(ctx, y, "Fecha", formatearFecha(venta.fecha), { negrita: false });
    y += 32;
    fila(ctx, y, "Atendido por", venta.vendedor, { negrita: false });
    y += 30;

    // Recuadro del producto
    rectanguloRedondeado(ctx, MARGEN, y, ANCHO - MARGEN * 2, altoProducto, 14);
    ctx.fillStyle = COLORES.lila;
    ctx.fill();

    let yProducto = y + 36;
    ctx.fillStyle = "#4c1d95";
    ctx.font = `700 22px ${SANS}`;
    for (const linea of lineasProducto) {
        ctx.fillText(linea, MARGEN + 20, yProducto);
        yProducto += 28;
    }

    if (venta.codigo) {
        ctx.fillStyle = COLORES.suave;
        ctx.font = `500 15px ${SANS}`;
        ctx.fillText(`Código: ${venta.codigo}`, MARGEN + 20, yProducto);
    }

    y += altoProducto + 38;

    const porDocena = venta.modalidad === "docena";
    fila(ctx, y, "Cantidad", describirCantidad(venta));
    y += 34;
    fila(ctx, y, `Precio por ${porDocena ? "docena" : "unidad"}`, moneda(precioCobrado(venta)));
    y += 34;
    fila(ctx, y, "Método de pago", nombreMetodoPago(venta.metodoPago));
    y += 30;

    lineaPunteada(ctx, y);
    y += 58;

    // Total
    ctx.font = `700 22px ${SANS}`;
    ctx.fillStyle = COLORES.morado;
    ctx.fillText("Total", MARGEN + 20, y);
    ctx.font = `800 40px ${SANS}`;
    ctx.textAlign = "right";
    ctx.fillText(moneda(venta.total), ANCHO - MARGEN - 20, y + 4);
    ctx.textAlign = "left";
    y += 40;

    lineaPunteada(ctx, y);
    y += 46;

    ctx.textAlign = "center";
    ctx.fillStyle = COLORES.suave;
    ctx.font = `600 18px ${SANS}`;
    ctx.fillText("¡Gracias por su compra! 💜", ANCHO / 2, y);

    // Enlace al catálogo para que el cliente vea más productos.
    y += 40;
    ctx.fillStyle = COLORES.morado;
    ctx.font = `700 16px ${SANS}`;
    ctx.fillText("🛍️ Mira nuestro catálogo:", ANCHO / 2, y);
    y += 24;
    ctx.font = `600 15px ${SANS}`;
    ctx.fillText(enlaceCatalogo().replace(/^https?:\/\//, ""), ANCHO / 2, y);
    ctx.textAlign = "left";

    const blob = await new Promise((resolver, rechazar) =>
        lienzo.toBlob((resultado) => (resultado ? resolver(resultado) : rechazar(new Error("No se pudo crear la imagen."))), "image/png")
    );

    return new File([blob], `comprobante-${numeroComprobante(venta)}.png`, { type: "image/png" });
}
