import { moneda } from "./api.js";
import { RECARGO_TARJETA, cobroConTarjeta } from "./datosPago.js";
import { fraseDeBoleta } from "./frases.js";
import { UNIDADES_MODALIDAD, enlaceCatalogo, importeItem, nombreCortoPago, nombreMetodoPago, precioCobrado } from "./venta.js";

/* Imagen de la boleta para enviar por WhatsApp, con los colores de Mil Deseos (morado y dorado):
   encabezado morado con la marca, fotos de los productos como decoración, la tabla de productos,
   el total, una frase inspiradora (distinta en cada boleta) y el enlace al catálogo. */

// Datos del negocio que van impresos en la boleta.
export const NEGOCIO = {
    duena: "Carolina Rojas",
    rubro: "Productos navideños (ZG) y escolares (Porta, School, Children, Recreo y Disney) · Por mayor y menor",
    telefono: "917303705"
};

const ANCHO = 707;
const ESCALA = 2; // 1414 px de ancho: nítida en el celular.
const MARGEN = 40;
const DERECHA = ANCHO - MARGEN;

// Paleta de la app.
const C = {
    fondo: "#faf7ff",
    fondo2: "#f3ecff",
    morado900: "#3b1677",
    morado800: "#4c1d95",
    morado700: "#6d28d9",
    morado200: "#e9d5ff",
    morado150: "#ede9fe",
    dorado: "#b8892f",
    doradoClaro: "#f3d38b",
    doradoOscuro: "#6b4e12",
    tinta: "#241736",
    suave: "#6b5b7a"
};

const SERIF = "'Playfair Display', Georgia, serif";
// Letra del texto: la del sistema (en el canvas se ve pareja y con el grosor correcto en todos los celulares).
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const CURSIVA = "'Great Vibes', 'Segoe Script', cursive";

// Columnas de la tabla: cantidad (centro), descripción (inicio), precio e importe (bordes derechos).
const COL = { cant: MARGEN + 24, desc: MARGEN + 60, precio: DERECHA - 118, importe: DERECHA - 14 };
const ALTO_ENCABEZADO = 196;
const RADIO_FOTO = 36;
const MAXIMO_FOTOS = 6;

function cargarImagen(src) {
    return new Promise((resolver) => {
        const imagen = new Image();
        const tiempo = setTimeout(() => resolver(null), 6000);
        imagen.onload = () => { clearTimeout(tiempo); resolver(imagen); };
        imagen.onerror = () => { clearTimeout(tiempo); resolver(null); }; // Sin esa foto, la boleta igual sale.
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

/* Fotos para decorar: primero las de los productos de la venta y, si faltan, las de los más
   vendidos de la tienda. Se piden desde la misma dirección de la app (directo=1) para poder dibujarlas. */
async function fotosDecoracion(boleta) {
    const elegidas = new Map();

    for (const item of boleta.items ?? []) {
        if (item.tieneFoto && item.productoId && !elegidas.has(item.productoId)) {
            elegidas.set(item.productoId, item.fotoVersion ?? 0);
        }
    }

    if (elegidas.size < MAXIMO_FOTOS) {
        try {
            const respuesta = await fetch("/api/publico/fotos-boleta");
            if (respuesta.ok) {
                for (const p of await respuesta.json()) {
                    if (elegidas.size >= MAXIMO_FOTOS) break;
                    if (!elegidas.has(p.id)) elegidas.set(p.id, p.fotoVersion ?? 0);
                }
            }
        } catch {
            // Sin conexión: solo las fotos de la venta.
        }
    }

    const imagenes = await Promise.all(
        [...elegidas.entries()].slice(0, MAXIMO_FOTOS).map(([id, version]) =>
            cargarImagen(`/api/productos/${id}/foto?v=${version}&tam=mini&directo=1`)
        )
    );
    return imagenes.filter(Boolean);
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

function redondeado(ctx, x, y, ancho, alto, radio) {
    ctx.beginPath();
    ctx.roundRect(x, y, ancho, alto, radio);
}

// Destello dorado de cuatro puntas (decoración).
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

// Generador con semilla: los destellos salen en el mismo lugar en cada boleta.
function azar(semilla) {
    let s = semilla;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

// Fecha en hora de Lima: «23 / 11 / 2026».
function fechaLima(fecha) {
    const partes = new Intl.DateTimeFormat("es-PE", {
        timeZone: "America/Lima",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).formatToParts(new Date(fecha));
    const valor = (tipo) => partes.find((p) => p.type === tipo)?.value ?? "";
    return `${valor("day")} / ${valor("month")} / ${valor("year")}`;
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
        precio: item.obsequio ? "—" : moneda(precioCobrado(item)),
        importe: item.obsequio ? "Gratis" : moneda(importeItem(item))
    };
}

// Foto redonda con aro blanco y dorado (recortada al centro, sin deformarla).
function fotoRedonda(ctx, imagen, x, y, radio) {
    ctx.save();
    ctx.shadowColor = "rgba(59, 22, 119, 0.28)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, radio + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radio, 0, Math.PI * 2);
    ctx.clip();
    const lado = Math.min(imagen.width, imagen.height);
    ctx.drawImage(imagen, (imagen.width - lado) / 2, (imagen.height - lado) / 2, lado, lado, x - radio, y - radio, radio * 2, radio * 2);
    ctx.restore();

    ctx.strokeStyle = C.dorado;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, radio + 5, 0, Math.PI * 2);
    ctx.stroke();
}

// Dibuja la boleta (uno o varios productos) y devuelve un archivo JPG listo para compartir.
export async function generarImagenComprobante(boleta) {
    const [, fotos] = await Promise.all([cargarFuentes(), fotosDecoracion(boleta)]);

    const lienzo = document.createElement("canvas");
    const ctx = lienzo.getContext("2d");

    // ---- Medidas (el alto depende de los productos, el pago y la frase) ----
    const anchoDescripcion = COL.precio - 76 - COL.desc;
    ctx.font = `600 15px ${SANS}`;
    const filas = boleta.items.map((item) => {
        const fila = filaDeProducto(item);
        const lineas = partirTexto(ctx, fila.nombre, anchoDescripcion);
        return { ...fila, lineas, alto: 22 + lineas.length * 19 + (fila.extras ? 17 : 0) };
    });

    const pagosMixtos = boleta.metodoPago === "mixto" && Array.isArray(boleta.pagos) ? boleta.pagos : null;
    const baseTarjeta = boleta.metodoPago === "tarjeta"
        ? Number(boleta.total)
        : Number(pagosMixtos?.find((p) => p.metodo === "tarjeta")?.monto ?? 0);
    const tarjeta = baseTarjeta > 0 ? cobroConTarjeta(baseTarjeta) : null;
    const conDescuento = Number(boleta.ajuste?.monto ?? 0) > 0;

    const frase = fraseDeBoleta(boleta.numero);
    ctx.font = `italic 500 19px ${SERIF}`;
    const lineasFrase = partirTexto(ctx, `“${frase}”`, ANCHO - 2 * MARGEN - 80);

    const conFotos = fotos.length > 0;
    const inicioDatos = ALTO_ENCABEZADO + (conFotos ? RADIO_FOTO + 30 : 24);
    const inicioTabla = inicioDatos + 64;
    const altoFilas = filas.reduce((suma, f) => suma + f.alto, 0);
    const finTabla = inicioTabla + 38 + altoFilas;
    const lineasPago = pagosMixtos ? 1 + pagosMixtos.length : 2;
    const altoPago = 22 + lineasPago * 20;
    const altoTotales = (conDescuento ? 48 : 0) + 50 + (tarjeta ? 48 : 0);
    const inicioPie = finTabla + 24;
    const finPie = inicioPie + Math.max(altoPago, altoTotales);
    const inicioFrase = finPie + 44;
    const alto = inicioFrase + 30 + lineasFrase.length * 28 + 120;

    lienzo.width = ANCHO * ESCALA;
    lienzo.height = alto * ESCALA;
    ctx.scale(ESCALA, ESCALA);
    ctx.textBaseline = "alphabetic";

    // ---- Fondo lila ----
    const fondo = ctx.createLinearGradient(0, 0, ANCHO, alto);
    fondo.addColorStop(0, C.fondo);
    fondo.addColorStop(1, C.fondo2);
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, ANCHO, alto);

    // ---- Encabezado morado con borde curvo ----
    const banda = ctx.createLinearGradient(0, 0, ANCHO, ALTO_ENCABEZADO);
    banda.addColorStop(0, C.morado900);
    banda.addColorStop(0.6, C.morado800);
    banda.addColorStop(1, C.morado700);
    ctx.fillStyle = banda;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(ANCHO, 0);
    ctx.lineTo(ANCHO, ALTO_ENCABEZADO - 18);
    ctx.quadraticCurveTo(ANCHO / 2, ALTO_ENCABEZADO + 18, 0, ALTO_ENCABEZADO - 18);
    ctx.closePath();
    ctx.fill();

    // Brillo suave y destellos dorados.
    const brillo = ctx.createRadialGradient(ANCHO * 0.82, 30, 0, ANCHO * 0.82, 30, 260);
    brillo.addColorStop(0, "rgba(243, 211, 139, 0.22)");
    brillo.addColorStop(1, "rgba(243, 211, 139, 0)");
    ctx.fillStyle = brillo;
    ctx.fillRect(0, 0, ANCHO, ALTO_ENCABEZADO);
    // Solo en zonas sin texto: la franja de arriba y debajo de la fecha.
    const aleatorio = azar(11);
    const zonas = [[300, 8, 160, 22], [460, 122, 220, 40], [12, 150, 20, 30]];
    for (const [x, yZona, ancho, altoZona] of zonas) {
        for (let i = 0; i < 4; i++) {
            destello(ctx, x + aleatorio() * ancho, yZona + aleatorio() * altoZona, 2 + aleatorio() * 3.5, `rgba(243, 211, 139, ${0.35 + aleatorio() * 0.45})`);
        }
    }

    // Monograma «MD» y marca.
    ctx.strokeStyle = C.doradoClaro;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(MARGEN + 28, 60, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = `600 19px ${SERIF}`;
    ctx.fillText("MD", MARGEN + 28, 67);

    ctx.textAlign = "left";
    ctx.font = `700 34px ${SERIF}`;
    ctx.fillText("Mil Deseos", MARGEN + 70, 64);
    ctx.font = `500 13.5px ${SANS}`;
    ctx.fillStyle = C.morado200;
    ctx.fillText(`De: ${NEGOCIO.duena} · WhatsApp ${NEGOCIO.telefono}`, MARGEN + 70, 86);
    ctx.font = `500 11px ${SANS}`;
    ctx.fillStyle = "rgba(237, 233, 254, 0.85)";
    partirTexto(ctx, NEGOCIO.rubro, 390).slice(0, 2).forEach((l, i) => ctx.fillText(l, MARGEN, 120 + i * 15));

    // «Boleta de venta», número y fecha.
    ctx.textAlign = "right";
    ctx.fillStyle = C.doradoClaro;
    ctx.font = `600 12.5px ${SANS}`;
    ctx.fillText("B O L E T A   D E   V E N T A", DERECHA, 42);
    const numero = `N° ${String(boleta.numero).padStart(9, "0")}`;
    ctx.font = `700 15px ${SANS}`;
    const anchoNumero = ctx.measureText(numero).width + 28;
    redondeado(ctx, DERECHA - anchoNumero, 54, anchoNumero, 30, 15);
    ctx.fillStyle = C.dorado;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(numero, DERECHA - 14, 74);
    ctx.font = `500 14px ${SANS}`;
    ctx.fillText(fechaLima(boleta.fecha), DERECHA, 108);

    // ---- Fotos de productos como decoración, sobre el borde del encabezado ----
    if (conFotos) {
        const separacion = Math.min(104, (ANCHO - 2 * MARGEN - 2 * RADIO_FOTO) / Math.max(fotos.length - 1, 1));
        const x0 = ANCHO / 2 - (separacion * (fotos.length - 1)) / 2;
        fotos.forEach((imagen, i) => {
            // Siguen la curva del encabezado: las del centro, un poco más abajo.
            const desdeElCentro = Math.abs(i - (fotos.length - 1) / 2);
            fotoRedonda(ctx, imagen, x0 + i * separacion, ALTO_ENCABEZADO + 2 - desdeElCentro * 6, RADIO_FOTO);
        });
    }

    // ---- Datos: cliente (izquierda) y quién atendió (derecha) ----
    const yDatos = inicioDatos + 20;
    ctx.textAlign = "left";
    ctx.font = `700 14px ${SANS}`;
    ctx.fillStyle = C.morado800;
    ctx.fillText("Señor(es):", MARGEN, yDatos);
    const xCliente = MARGEN + ctx.measureText("Señor(es): ").width;
    if (boleta.cliente) {
        ctx.font = `500 14.5px ${SANS}`;
        ctx.fillStyle = C.tinta;
        ctx.fillText(partirTexto(ctx, boleta.cliente, 330 - xCliente)[0] ?? "", xCliente, yDatos);
    } else {
        ctx.fillStyle = C.morado200;
        ctx.fillRect(xCliente, yDatos + 3, 330 - xCliente, 1.2);
    }

    ctx.textAlign = "right";
    ctx.font = `700 14px ${SANS}`;
    const nombreVendedor = boleta.vendedor ?? "";
    const anchoVendedor = ctx.measureText(nombreVendedor).width;
    ctx.fillStyle = C.tinta;
    ctx.fillText(nombreVendedor, DERECHA, yDatos);
    ctx.font = `500 14px ${SANS}`;
    ctx.fillStyle = C.morado800;
    ctx.fillText("Atendido por: ", DERECHA - anchoVendedor, yDatos);

    // Línea dorada que se desvanece en los extremos.
    const linea = ctx.createLinearGradient(MARGEN, 0, DERECHA, 0);
    linea.addColorStop(0, "rgba(184, 137, 47, 0)");
    linea.addColorStop(0.5, C.dorado);
    linea.addColorStop(1, "rgba(184, 137, 47, 0)");
    ctx.fillStyle = linea;
    ctx.fillRect(MARGEN, yDatos + 22, DERECHA - MARGEN, 1.2);

    // ---- Tabla ----
    redondeado(ctx, MARGEN, inicioTabla, DERECHA - MARGEN, 36, 10);
    ctx.fillStyle = C.morado150;
    ctx.fill();
    ctx.fillStyle = C.morado800;
    ctx.font = `700 11.5px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillText("CANT.", COL.cant, inicioTabla + 23);
    ctx.textAlign = "left";
    ctx.fillText("DESCRIPCIÓN", COL.desc, inicioTabla + 23);
    ctx.textAlign = "right";
    ctx.fillText("P. UNIT.", COL.precio, inicioTabla + 23);
    ctx.fillText("IMPORTE", COL.importe, inicioTabla + 23);

    let y = inicioTabla + 38;
    filas.forEach((fila, indice) => {
        const centro = y + fila.alto / 2;
        ctx.textAlign = "center";
        ctx.font = `700 15px ${SANS}`;
        ctx.fillStyle = C.morado700;
        ctx.fillText(fila.cantidad, COL.cant, centro + 5);

        ctx.textAlign = "left";
        ctx.fillStyle = C.tinta;
        ctx.font = `600 15px ${SANS}`;
        let yTexto = y + 27;
        fila.lineas.forEach((l) => {
            ctx.fillText(l, COL.desc, yTexto);
            yTexto += 19;
        });
        if (fila.extras) {
            ctx.font = `500 12.5px ${SANS}`;
            ctx.fillStyle = C.suave;
            ctx.fillText(fila.extras, COL.desc, yTexto - 2);
        }

        ctx.textAlign = "right";
        ctx.font = `500 14px ${SANS}`;
        ctx.fillStyle = C.suave;
        ctx.fillText(fila.precio, COL.precio, centro + 5);
        ctx.font = `700 15px ${SANS}`;
        ctx.fillStyle = C.tinta;
        ctx.fillText(fila.importe, COL.importe, centro + 5);

        y += fila.alto;
        if (indice < filas.length - 1) {
            ctx.fillStyle = C.morado200;
            ctx.fillRect(MARGEN + 10, y, DERECHA - MARGEN - 20, 1);
        }
    });

    // ---- Forma de pago (izquierda) y total (derecha) ----
    const anchoPago = 290;
    redondeado(ctx, MARGEN, inicioPie, anchoPago, altoPago, 14);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = C.morado200;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = "left";
    let yPago = inicioPie + 26;
    ctx.font = `700 11.5px ${SANS}`;
    ctx.fillStyle = C.dorado;
    ctx.fillText(pagosMixtos ? "PAGÓ CON" : "FORMA DE PAGO", MARGEN + 16, yPago);
    if (pagosMixtos) {
        for (const pago of pagosMixtos) {
            yPago += 20;
            ctx.textAlign = "left";
            ctx.font = `600 14px ${SANS}`;
            ctx.fillStyle = C.tinta;
            ctx.fillText(nombreCortoPago(pago.metodo), MARGEN + 16, yPago);
            ctx.textAlign = "right";
            ctx.fillText(moneda(pago.monto), MARGEN + anchoPago - 16, yPago);
        }
    } else {
        yPago += 22;
        ctx.font = `600 15px ${SANS}`;
        ctx.fillStyle = C.tinta;
        ctx.fillText(nombreMetodoPago(boleta.metodoPago), MARGEN + 16, yPago);
    }

    const xTotales = MARGEN + anchoPago + 22;
    let yTotal = inicioPie;
    ctx.textAlign = "left";
    if (conDescuento) {
        ctx.font = `500 13.5px ${SANS}`;
        ctx.fillStyle = C.suave;
        ctx.fillText("Subtotal", xTotales + 4, yTotal + 16);
        ctx.fillText("Descuento", xTotales + 4, yTotal + 38);
        ctx.textAlign = "right";
        ctx.fillText(moneda(boleta.subtotal), DERECHA - 4, yTotal + 16);
        ctx.fillText(`− ${moneda(boleta.ajuste.monto)}`, DERECHA - 4, yTotal + 38);
        ctx.textAlign = "left";
        yTotal += 48;
    }

    const caja = ctx.createLinearGradient(xTotales, 0, DERECHA, 0);
    caja.addColorStop(0, C.morado800);
    caja.addColorStop(1, C.morado700);
    redondeado(ctx, xTotales, yTotal, DERECHA - xTotales, 50, 14);
    ctx.fillStyle = caja;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 13px ${SANS}`;
    ctx.fillText("TOTAL", xTotales + 16, yTotal + 30);
    ctx.textAlign = "right";
    ctx.fillStyle = C.doradoClaro;
    ctx.font = `700 24px ${SANS}`;
    ctx.fillText(moneda(boleta.total), DERECHA - 16, yTotal + 34);

    if (tarjeta) {
        const totalConRecargo = Number(boleta.total) + tarjeta.recargo;
        ctx.font = `500 12.5px ${SANS}`;
        ctx.fillStyle = C.suave;
        ctx.fillText(
            boleta.metodoPago === "tarjeta"
                ? `Tarjeta (Izipay) recargo ${RECARGO_TARJETA}%: + ${moneda(tarjeta.recargo)}`
                : `Tarjeta ${moneda(tarjeta.base)}, recargo ${RECARGO_TARJETA}%: + ${moneda(tarjeta.recargo)}`,
            DERECHA - 4, yTotal + 70
        );
        ctx.font = `700 14px ${SANS}`;
        ctx.fillStyle = C.morado800;
        ctx.fillText(`Total con recargo: ${moneda(totalConRecargo)}`, DERECHA - 4, yTotal + 90);
    }

    // ---- Frase inspiradora (distinta en cada boleta) ----
    ctx.textAlign = "center";
    ctx.fillStyle = C.dorado;
    ctx.fillRect(ANCHO / 2 - 118, inicioFrase, 94, 1);
    ctx.fillRect(ANCHO / 2 + 24, inicioFrase, 94, 1);
    destello(ctx, ANCHO / 2, inicioFrase, 7, C.dorado);

    ctx.font = `italic 500 19px ${SERIF}`;
    ctx.fillStyle = C.morado700;
    lineasFrase.forEach((l, i) => ctx.fillText(l, ANCHO / 2, inicioFrase + 34 + i * 28));

    // ---- Pie: gracias y catálogo ----
    ctx.font = `32px ${CURSIVA}`;
    ctx.fillStyle = C.doradoOscuro;
    ctx.fillText("Gracias por tu preferencia", ANCHO / 2, inicioFrase + 34 + lineasFrase.length * 28 + 26);

    ctx.fillStyle = C.morado150;
    ctx.fillRect(0, alto - 52, ANCHO, 52);
    ctx.fillStyle = C.morado800;
    ctx.font = `600 13.5px ${SANS}`;
    ctx.fillText(`Mira nuestro catálogo: ${enlaceCatalogo().replace(/^https?:\/\//, "")}`, ANCHO / 2, alto - 21);

    // Boleta anulada: sello en diagonal.
    if (boleta.anulada) {
        ctx.save();
        ctx.translate(ANCHO / 2, (inicioTabla + finTabla) / 2);
        ctx.rotate(-0.35);
        ctx.font = `800 70px ${SANS}`;
        ctx.fillStyle = "rgba(185, 28, 28, 0.32)";
        ctx.fillText("ANULADA", 0, 20);
        ctx.restore();
    }

    const blob = await new Promise((resolver, rechazar) =>
        lienzo.toBlob(
            (resultado) => (resultado ? resolver(resultado) : rechazar(new Error("No se pudo crear la imagen."))),
            // JPG: pesa varias veces menos que PNG y se comparte más rápido por WhatsApp.
            "image/jpeg",
            0.9
        )
    );

    return new File([blob], `boleta-${String(boleta.numero).padStart(9, "0")}.jpg`, { type: "image/jpeg" });
}
