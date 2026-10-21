import { moneda } from "./api.js";
import {
    describirCantidad,
    enlaceCatalogo,
    formatearFecha,
    importeItem,
    nombreMetodoPago,
    numeroComprobante,
    precioCobrado
} from "./venta.js";

const ANCHO = 600;
const ESCALA = 2; // Doble resolución para que se vea nítida en el celular.
const MARGEN = 40;
const IZQUIERDA = MARGEN + 20;
const DERECHA = ANCHO - MARGEN - 20;

const COLORES = {
    fondo: "#ffffff",
    morado: "#6d28d9",
    moradoOscuro: "#4c1d95",
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

function fila(ctx, y, etiqueta, valor) {
    ctx.font = `500 17px ${SANS}`;
    ctx.fillStyle = COLORES.suave;
    ctx.textAlign = "left";
    ctx.fillText(etiqueta, IZQUIERDA, y);

    ctx.font = `600 17px ${SANS}`;
    ctx.fillStyle = COLORES.texto;
    ctx.textAlign = "right";
    ctx.fillText(valor, DERECHA, y);
    ctx.textAlign = "left";
}

function lineaPunteada(ctx, y) {
    ctx.save();
    ctx.strokeStyle = COLORES.borde;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(IZQUIERDA, y);
    ctx.lineTo(DERECHA, y);
    ctx.stroke();
    ctx.restore();
}

// Prepara cada producto: líneas del nombre y alto que ocupa.
function medirItems(ctx, items) {
    ctx.font = `700 18px ${SANS}`;

    return items.map((item) => {
        // El nombre deja espacio a la derecha para el importe.
        const lineas = partirTexto(ctx, item.producto, DERECHA - IZQUIERDA - 130);
        const porPaquete = item.modalidad === "docena" ? " c/docena" : item.modalidad === "media" ? " c/media docena" : "";
        const devueltas = Number(item.unidadesDevueltas ?? 0) > 0 ? ` · ↩ ${item.unidadesDevueltas} devueltas` : "";
        const detalle = item.obsequio
            ? `${describirCantidad(item)} · 🎁 Obsequio${devueltas}`
            : `${describirCantidad(item)} × ${moneda(precioCobrado(item))}${porPaquete}${devueltas}`;
        return { item, lineas, detalle, alto: lineas.length * 24 + (item.codigo ? 20 : 0) + 26 + 18 };
    });
}

// Dibuja la boleta (uno o varios productos) y devuelve un archivo PNG listo para compartir.
export async function generarImagenComprobante(boleta) {
    // Espera a que carguen las fuentes de la página para usarlas en el dibujo.
    if (document.fonts?.ready) {
        await document.fonts.ready;
    }

    const lienzo = document.createElement("canvas");
    const ctx = lienzo.getContext("2d");

    const medidos = medirItems(ctx, boleta.items);
    const altoItems = medidos.reduce((suma, m) => suma + m.alto, 0);
    const conAjuste = Number(boleta.ajuste?.monto ?? 0) > 0;
    const alto = 150 + 110 + 50 + altoItems + 40 + 120 + 140 + (conAjuste ? 70 : 0);

    lienzo.width = ANCHO * ESCALA;
    lienzo.height = alto * ESCALA;
    ctx.scale(ESCALA, ESCALA);
    ctx.textBaseline = "alphabetic";

    // Fondo y tarjeta
    ctx.fillStyle = "#faf7ff";
    ctx.fillRect(0, 0, ANCHO, alto);

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
    ctx.fillText(`Boleta de venta N° ${numeroComprobante(boleta)}`, ANCHO / 2, 120);
    ctx.textAlign = "left";

    let y = 195;
    fila(ctx, y, "Fecha", formatearFecha(boleta.fecha));
    y += 32;
    fila(ctx, y, "Atendido por", boleta.vendedor);
    y += 32;
    fila(ctx, y, "Método de pago", nombreMetodoPago(boleta.metodoPago));
    y += 26;

    // Encabezado de la lista
    rectanguloRedondeado(ctx, MARGEN, y, ANCHO - MARGEN * 2, 34, 10);
    ctx.fillStyle = COLORES.lila;
    ctx.fill();
    ctx.font = `700 14px ${SANS}`;
    ctx.fillStyle = COLORES.moradoOscuro;
    ctx.fillText(`PRODUCTOS (${boleta.items.length})`, IZQUIERDA, y + 22);
    ctx.textAlign = "right";
    ctx.fillText("IMPORTE", DERECHA, y + 22);
    ctx.textAlign = "left";
    y += 34 + 16;

    // Productos
    medidos.forEach(({ item, lineas, detalle, alto: altoItem }, indice) => {
        let yItem = y + 22;

        ctx.font = `700 18px ${SANS}`;
        ctx.fillStyle = COLORES.moradoOscuro;
        lineas.forEach((linea, i) => {
            ctx.fillText(linea, IZQUIERDA, yItem + i * 24);
        });

        ctx.textAlign = "right";
        ctx.fillStyle = COLORES.texto;
        ctx.fillText(item.obsequio ? "Gratis" : moneda(importeItem(item)), DERECHA, yItem);
        ctx.textAlign = "left";

        yItem += (lineas.length - 1) * 24;

        if (item.codigo) {
            yItem += 20;
            ctx.font = `500 13px ${SANS}`;
            ctx.fillStyle = COLORES.suave;
            ctx.fillText(`Código: ${item.codigo}`, IZQUIERDA, yItem);
        }

        yItem += 24;
        ctx.font = `500 15px ${SANS}`;
        ctx.fillStyle = COLORES.suave;
        ctx.fillText(detalle, IZQUIERDA, yItem);

        y += altoItem;

        if (indice < medidos.length - 1) {
            lineaPunteada(ctx, y - 6);
        }
    });

    y += 10;
    ctx.strokeStyle = COLORES.borde;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(IZQUIERDA, y);
    ctx.lineTo(DERECHA, y);
    ctx.stroke();
    y += 52;

    // Subtotal y descuento (permitido por el jefe)
    if (conAjuste) {
        ctx.font = `500 17px ${SANS}`;
        ctx.fillStyle = COLORES.suave;
        ctx.fillText("Subtotal", IZQUIERDA, y - 12);
        ctx.fillText("Descuento", IZQUIERDA, y + 20);
        ctx.textAlign = "right";
        ctx.fillText(moneda(boleta.subtotal), DERECHA, y - 12);
        ctx.fillText(`− ${moneda(boleta.ajuste.monto)}`, DERECHA, y + 20);
        ctx.textAlign = "left";
        y += 70;
    }

    // Total
    ctx.font = `700 22px ${SANS}`;
    ctx.fillStyle = COLORES.morado;
    ctx.fillText("Total", IZQUIERDA, y);
    ctx.font = `800 40px ${SANS}`;
    ctx.textAlign = "right";
    ctx.fillText(moneda(boleta.total), DERECHA, y + 4);
    ctx.textAlign = "left";
    y += 38;

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
        lienzo.toBlob(
            (resultado) => (resultado ? resolver(resultado) : rechazar(new Error("No se pudo crear la imagen."))),
            "image/png"
        )
    );

    return new File([blob], `boleta-${numeroComprobante(boleta)}.png`, { type: "image/png" });
}
