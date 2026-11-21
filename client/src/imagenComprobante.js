import { moneda } from "./api.js";
import { UNIDADES_MODALIDAD, enlaceCatalogo, importeItem, nombreCortoPago, nombreMetodoPago, precioCobrado } from "./venta.js";

/* Imagen de la boleta para enviar por WhatsApp, con el diseño de la boleta impresa de Mil Deseos:
   papel crema con acuarela, adornos navideños y mochilas, casillas de fecha, tabla
   CANT. / DESCRIPCIÓN / P. UNIT. / IMPORTE y el total en su recuadro. */

// Datos del negocio que van impresos en la boleta.
export const NEGOCIO = {
    duena: "Carolina Rojas",
    rubro: [
        "VENTA DE PRODUCTOS NAVIDEÑOS (ZG) Y ESCOLARES (PORTA,",
        "SCHOOL, CHILDREN, RECREO Y DISNEY) AL POR MAYOR Y MENOR"
    ],
    telefono: "917303705"
};

const ANCHO = 707;
const ESCALA = 2; // 1414 px de ancho: igual que la boleta impresa, nítida en el celular.

// Columnas de la tabla (como en la boleta impresa).
const X0 = 59;
const COLUMNAS = [59, 134, 448, 543, 662];
const ALTO_ENCABEZADO_TABLA = 66;
const ALTO_FILA = 56;
const FILAS_MINIMAS = 6;

const TINTA = "#1f1a17";
const SUAVE = "#5b4f47";
const SERIF = "'Playfair Display', Georgia, serif";
// Letra del texto: la del sistema (en el canvas se ve pareja y con el grosor correcto en todos los celulares).
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const CURSIVA = "'Great Vibes', 'Segoe Script', cursive";

const ADORNOS = {
    luces: { src: "/boleta/luces.png", x: 50, y: 0, ancho: 235 },
    esferas: { src: "/boleta/esferas.png", x: 0, y: 29, ancho: 84 },
    mochilas: { src: "/boleta/mochilas.png", x: 274, y: 14, ancho: 152 },
    arbol: { src: "/boleta/arbol.png", x: 404, y: 62, ancho: 114 }
};

function cargarImagen(src) {
    return new Promise((resolver) => {
        const imagen = new Image();
        imagen.onload = () => resolver(imagen);
        imagen.onerror = () => resolver(null); // Sin el adorno, la boleta igual sale.
        imagen.src = src;
    });
}

async function cargarFuentes() {
    try {
        await Promise.all([
            document.fonts?.load(`40px ${CURSIVA}`),
            document.fonts?.load(`italic 800 34px Montserrat`),
            document.fonts?.load(`700 30px ${SERIF}`),
            document.fonts?.load(`500 30px ${SERIF}`)
        ]);
        await document.fonts?.ready;
    } catch {
        // Si una fuente no carga, se usa la de respaldo.
    }
}

// Parte un texto en líneas que quepan en el ancho indicado.
function partirTexto(ctx, texto, anchoMaximo) {
    const lineas = [];
    let actual = "";

    for (const palabra of String(texto).split(" ")) {
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

// Generador de números al azar con semilla: la acuarela sale igual en cada boleta.
function azar(semilla) {
    let s = semilla;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

// Papel crema con manchas de acuarela salmón (como el fondo de la boleta impresa).
function pintarPapel(ctx, alto) {
    ctx.fillStyle = "#f6eee5";
    ctx.fillRect(0, 0, ANCHO, alto);

    const manchas = [
        [ANCHO * 0.82, alto * 0.08, 260, "rgba(240, 196, 168, 0.45)"],
        [ANCHO * 0.95, alto * 0.42, 300, "rgba(243, 206, 180, 0.35)"],
        [ANCHO * 0.1, alto * 0.18, 220, "rgba(244, 214, 192, 0.35)"],
        [ANCHO * 0.5, alto * 0.3, 260, "rgba(250, 244, 236, 0.55)"]
    ];
    for (const [x, y, radio, color] of manchas) {
        const degradado = ctx.createRadialGradient(x, y, 0, x, y, radio);
        degradado.addColorStop(0, color);
        degradado.addColorStop(1, "rgba(246, 238, 229, 0)");
        ctx.fillStyle = degradado;
        ctx.fillRect(0, 0, ANCHO, alto);
    }

    // Gran trazo de acuarela en diagonal: de la izquierda (a media hoja) hasta abajo a la derecha.
    const borde = (t) => ({
        x: ANCHO * t,
        y: alto * (0.47 + 0.47 * t) + Math.sin(t * 9) * 10
    });
    const aleatorio = azar(7);

    for (let capa = 0; capa < 3; capa++) {
        ctx.beginPath();
        ctx.moveTo(0, alto);
        for (let t = 0; t <= 1.0001; t += 0.05) {
            const p = borde(t);
            ctx.lineTo(p.x, p.y + capa * 14 + (aleatorio() - 0.5) * 8);
        }
        ctx.lineTo(ANCHO, alto);
        ctx.closePath();
        const relleno = ctx.createLinearGradient(ANCHO * 0.6, alto * 0.6, 0, alto);
        relleno.addColorStop(0, `rgba(238, 168, 140, ${0.18 + capa * 0.08})`);
        relleno.addColorStop(1, `rgba(228, 132, 102, ${0.3 + capa * 0.1})`);
        ctx.fillStyle = relleno;
        ctx.fill();
    }

    // Vetas más oscuras en el borde de la acuarela.
    ctx.save();
    ctx.lineCap = "round";
    for (let veta = 0; veta < 5; veta++) {
        ctx.beginPath();
        const desplazamiento = 8 + veta * 9;
        for (let t = 0; t <= 0.62; t += 0.03) {
            const p = borde(t);
            const y = p.y + desplazamiento + (aleatorio() - 0.5) * 6;
            if (t === 0) ctx.moveTo(p.x, y);
            else ctx.lineTo(p.x, y);
        }
        ctx.strokeStyle = `rgba(214, 112, 86, ${0.12 + aleatorio() * 0.12})`;
        ctx.lineWidth = 1 + aleatorio() * 2.5;
        ctx.stroke();
    }
    ctx.restore();
}

function lineaPunteada(ctx, x1, x2, y) {
    ctx.save();
    ctx.fillStyle = TINTA;
    for (let x = x1; x < x2; x += 5) ctx.fillRect(x, y - 1, 1.6, 1.6);
    ctx.restore();
}

function cuadro(ctx, x, y, ancho, alto) {
    ctx.strokeStyle = TINTA;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(x, y, ancho, alto);
}

// Fecha en hora de Lima: { dia, mes, anio }.
function fechaLima(fecha) {
    const partes = new Intl.DateTimeFormat("es-PE", {
        timeZone: "America/Lima",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).formatToParts(new Date(fecha));
    const valor = (tipo) => partes.find((p) => p.type === tipo)?.value ?? "";
    return { dia: valor("day"), mes: valor("month"), anio: valor("year") };
}

// Cantidad (en paquetes si es docena o media) y descripción de cada producto.
function filaDeProducto(item) {
    const porPaquete = UNIDADES_MODALIDAD[item.modalidad] ?? 1;
    const paquetes = item.cantidad / porPaquete;
    const cantidad = Number.isInteger(paquetes) ? String(paquetes) : paquetes.toFixed(1);
    const modo = item.modalidad === "docena"
        ? (paquetes === 1 ? "docena" : "docenas")
        : item.modalidad === "media"
            ? (paquetes === 1 ? "media docena" : "medias docenas")
            : "";
    const extras = [
        modo && `${modo} (${item.cantidad} u.)`,
        item.obsequio && "Obsequio",
        Number(item.unidadesDevueltas ?? 0) > 0 && `${item.unidadesDevueltas} devueltas`
    ].filter(Boolean).join(" · ");

    return {
        cantidad,
        nombre: item.producto,
        extras,
        precio: item.obsequio ? "—" : moneda(precioCobrado(item)).replace("S/ ", ""),
        importe: item.obsequio ? "Gratis" : moneda(importeItem(item)).replace("S/ ", "")
    };
}

// Dibuja la boleta (uno o varios productos) y devuelve un archivo PNG listo para compartir.
export async function generarImagenComprobante(boleta) {
    const [, imagenes] = await Promise.all([
        cargarFuentes(),
        Promise.all(Object.entries(ADORNOS).map(async ([clave, a]) => [clave, await cargarImagen(a.src)]))
    ]);

    const lienzo = document.createElement("canvas");
    const ctx = lienzo.getContext("2d");

    // Medir las filas de productos (el nombre puede ocupar varias líneas).
    const anchoDescripcion = COLUMNAS[2] - COLUMNAS[1] - 20;
    ctx.font = `600 15px ${SANS}`;
    const filas = boleta.items.map((item) => {
        const fila = filaDeProducto(item);
        const lineas = partirTexto(ctx, fila.nombre, anchoDescripcion);
        const alto = Math.max(ALTO_FILA, 22 + lineas.length * 19 + (fila.extras ? 18 : 0));
        return { ...fila, lineas, alto };
    });
    const vacias = Math.max(FILAS_MINIMAS - filas.length, 0);
    const altoFilas = filas.reduce((suma, f) => suma + f.alto, 0) + vacias * ALTO_FILA + ALTO_FILA; // + fila de «Gracias»
    const inicioTabla = 258;
    const finTabla = inicioTabla + ALTO_ENCABEZADO_TABLA + altoFilas;
    const conDescuento = Number(boleta.ajuste?.monto ?? 0) > 0;
    // Recuadro de abajo: quién atendió y cómo pagó (una línea por medio si pagó con varios).
    const pagosMixtos = boleta.metodoPago === "mixto" && Array.isArray(boleta.pagos) ? boleta.pagos : null;
    const altoRecuadro = Math.max(60, 22 + (pagosMixtos ? 2 + pagosMixtos.length : 2) * 20);
    const alto = finTabla + (conDescuento ? 50 : 0) + 140 + altoRecuadro;

    lienzo.width = ANCHO * ESCALA;
    lienzo.height = alto * ESCALA;
    ctx.scale(ESCALA, ESCALA);
    ctx.textBaseline = "alphabetic";

    pintarPapel(ctx, alto);

    // Adornos
    for (const [clave, imagen] of imagenes) {
        if (!imagen) continue;
        const a = ADORNOS[clave];
        ctx.drawImage(imagen, a.x, a.y, a.ancho, (imagen.height / imagen.width) * a.ancho);
    }

    // Encabezado: dueña, marca y rubro
    ctx.fillStyle = TINTA;
    ctx.textAlign = "center";
    ctx.font = `500 16px ${SANS}`;
    ctx.fillText(`De: ${NEGOCIO.duena}`, 182, 62);
    ctx.font = `italic 800 33px Montserrat, 'Arial Black', sans-serif`;
    ctx.fillText("Mil Deseos", 186, 98);
    ctx.font = `500 11px ${SANS}`;
    NEGOCIO.rubro.forEach((linea, i) => ctx.fillText(linea, 242, 121 + i * 16));

    // «BOLETA DE VENTA»
    ctx.textAlign = "right";
    ctx.font = `500 41px ${SERIF}`;
    ctx.fillText("BOLETA DE", 662, 52);
    ctx.fillText("VENTA", 662, 110);

    // Casillas de fecha
    const { dia, mes, anio } = fechaLima(boleta.fecha);
    const xFecha = 520;
    const anchoCasilla = 47.3;
    cuadro(ctx, xFecha, 144, anchoCasilla * 3, 94);
    ctx.beginPath();
    ctx.moveTo(xFecha, 191);
    ctx.lineTo(xFecha + anchoCasilla * 3, 191);
    for (let i = 1; i < 3; i++) {
        ctx.moveTo(xFecha + anchoCasilla * i, 144);
        ctx.lineTo(xFecha + anchoCasilla * i, 238);
    }
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.font = `600 16px ${SERIF}`;
    ["Día", "Mes", "Año"].forEach((t, i) => ctx.fillText(t, xFecha + anchoCasilla * (i + 0.5), 174));
    ctx.font = `600 15px ${SANS}`;
    [dia, mes, anio].forEach((t, i) => ctx.fillText(t, xFecha + anchoCasilla * (i + 0.5), 221));

    // N° de boleta, cliente y teléfono
    ctx.textAlign = "left";
    ctx.font = `500 16px ${SANS}`;
    ctx.fillText(`N° DE BOLETA: ${String(boleta.numero).padStart(9, "0")}`, 54, 163);
    ctx.font = `700 16px ${SANS}`;
    ctx.fillText("Señor(es):", 54, 190);
    const xCliente = 54 + ctx.measureText("Señor(es): ").width;
    if (boleta.cliente) {
        ctx.font = `600 16px ${SANS}`;
        const lineasCliente = partirTexto(ctx, boleta.cliente, 405 - xCliente).slice(0, 2);
        ctx.fillText(lineasCliente[0], xCliente, 188);
        if (lineasCliente[1]) ctx.fillText(lineasCliente[1], 54, 208);
    } else {
        lineaPunteada(ctx, xCliente, 405, 190);
        lineaPunteada(ctx, 54, 205, 210);
    }
    ctx.font = `500 16px ${SANS}`;
    ctx.fillText(`Teléfono: ${NEGOCIO.telefono} - WhatsApp`, 54, 236);

    // Tabla
    ctx.fillStyle = TINTA;
    ctx.font = `700 17px ${SERIF}`;
    ctx.textAlign = "center";
    const encabezados = ["CANT.", "DESCRIPCIÓN", "P. UNIT.", "IMPORTE"];
    encabezados.forEach((t, i) => ctx.fillText(t, (COLUMNAS[i] + COLUMNAS[i + 1]) / 2, inicioTabla + 40));

    let y = inicioTabla + ALTO_ENCABEZADO_TABLA;
    const lineasHorizontales = [inicioTabla, y];

    for (const fila of filas) {
        const centro = y + fila.alto / 2;
        ctx.font = `600 16px ${SANS}`;
        ctx.textAlign = "center";
        ctx.fillText(fila.cantidad, (COLUMNAS[0] + COLUMNAS[1]) / 2, centro + 6);

        ctx.textAlign = "left";
        const altoTexto = fila.lineas.length * 19 + (fila.extras ? 18 : 0);
        let yTexto = centro - altoTexto / 2 + 14;
        ctx.font = `600 15px ${SANS}`;
        fila.lineas.forEach((linea) => {
            ctx.fillText(linea, COLUMNAS[1] + 10, yTexto);
            yTexto += 19;
        });
        if (fila.extras) {
            ctx.font = `500 12.5px ${SANS}`;
            ctx.fillStyle = SUAVE;
            ctx.fillText(fila.extras, COLUMNAS[1] + 10, yTexto - 1);
            ctx.fillStyle = TINTA;
        }

        ctx.font = `600 15px ${SANS}`;
        ctx.textAlign = "right";
        ctx.fillText(fila.precio, COLUMNAS[3] - 10, centro + 6);
        ctx.fillText(fila.importe, COLUMNAS[4] - 10, centro + 6);

        y += fila.alto;
        lineasHorizontales.push(y);
    }

    for (let i = 0; i < vacias; i++) {
        y += ALTO_FILA;
        lineasHorizontales.push(y);
    }

    // Última fila: «Gracias por tu preferencia»
    ctx.textAlign = "center";
    ctx.font = `32px ${CURSIVA}`;
    ctx.fillText("Gracias por tu preferencia", (COLUMNAS[1] + COLUMNAS[2]) / 2, y + ALTO_FILA / 2 + 10);
    y += ALTO_FILA;
    lineasHorizontales.push(y);

    ctx.strokeStyle = TINTA;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (const lineaY of lineasHorizontales) {
        ctx.moveTo(COLUMNAS[0], lineaY);
        ctx.lineTo(COLUMNAS[4], lineaY);
    }
    for (const x of COLUMNAS) {
        ctx.moveTo(x, inicioTabla);
        ctx.lineTo(x, finTabla);
    }
    ctx.stroke();

    // Pie: forma de pago y quién atendió (recuadro izquierdo) y el total.
    let yPie = finTabla + 50;

    if (conDescuento) {
        ctx.textAlign = "right";
        ctx.font = `500 14px ${SANS}`;
        ctx.fillStyle = SUAVE;
        ctx.fillText(`Subtotal S/ ${Number(boleta.subtotal).toFixed(2)}   ·   Descuento − S/ ${Number(boleta.ajuste.monto).toFixed(2)}`, 662, yPie - 14);
        ctx.fillStyle = TINTA;
        yPie += 20;
    }

    const anchoRecuadro = 290;
    cuadro(ctx, X0, yPie, anchoRecuadro, altoRecuadro);
    ctx.textAlign = "left";
    let yLinea = yPie + 26;
    ctx.font = `500 13.5px ${SANS}`;
    ctx.fillText("Atendido por:", X0 + 12, yLinea);
    const xNombre = X0 + 12 + ctx.measureText("Atendido por: ").width;
    ctx.font = `700 13.5px ${SANS}`;
    ctx.fillText(partirTexto(ctx, boleta.vendedor ?? "", X0 + anchoRecuadro - 12 - xNombre)[0] ?? "", xNombre, yLinea);
    yLinea += 20;

    ctx.font = `500 13.5px ${SANS}`;
    if (pagosMixtos) {
        ctx.fillText("Pagó con:", X0 + 12, yLinea);
        for (const pago of pagosMixtos) {
            yLinea += 20;
            ctx.font = `600 13.5px ${SANS}`;
            ctx.textAlign = "left";
            ctx.fillText(`• ${nombreCortoPago(pago.metodo)}`, X0 + 20, yLinea);
            ctx.textAlign = "right";
            ctx.fillText(moneda(pago.monto), X0 + anchoRecuadro - 12, yLinea);
        }
        ctx.textAlign = "left";
    } else {
        ctx.fillText("Pago:", X0 + 12, yLinea);
        ctx.font = `700 13.5px ${SANS}`;
        ctx.fillText(nombreMetodoPago(boleta.metodoPago), X0 + 12 + ctx.measureText("Pago: ").width + 4, yLinea);
    }

    cuadro(ctx, 543, yPie, 119, 60);
    ctx.textAlign = "right";
    ctx.font = `500 26px ${SERIF}`;
    ctx.fillText("TOTAL S/.", 533, yPie + 40);
    ctx.textAlign = "center";
    ctx.font = `700 20px ${SANS}`;
    ctx.fillText(Number(boleta.total).toFixed(2), 602.5, yPie + 37);

    // Enlace al catálogo
    ctx.font = `600 13px ${SANS}`;
    ctx.fillStyle = SUAVE;
    ctx.fillText(`Mira nuestro catálogo: ${enlaceCatalogo().replace(/^https?:\/\//, "")}`, ANCHO / 2, alto - 34);

    // Boleta anulada: sello en diagonal.
    if (boleta.anulada) {
        ctx.save();
        ctx.translate(ANCHO / 2, (inicioTabla + finTabla) / 2);
        ctx.rotate(-0.35);
        ctx.font = `800 70px ${SANS}`;
        ctx.fillStyle = "rgba(185, 28, 28, 0.35)";
        ctx.fillText("ANULADA", 0, 20);
        ctx.restore();
    }

    const blob = await new Promise((resolver, rechazar) =>
        lienzo.toBlob(
            (resultado) => (resultado ? resolver(resultado) : rechazar(new Error("No se pudo crear la imagen."))),
            // PNG: es el único formato que el celular deja copiar para pegarlo en WhatsApp.
            "image/png"
        )
    );

    return new File([blob], `boleta-${String(boleta.numero).padStart(9, "0")}.png`, { type: "image/png" });
}
