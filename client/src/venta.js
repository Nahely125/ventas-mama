import { moneda } from "./api.js";

export const METODOS_PAGO = [
    { valor: "efectivo", nombre: "Efectivo", icono: "💵" },
    { valor: "yape", nombre: "Yape", icono: "💜" },
    { valor: "plin", nombre: "Plin", icono: "💚" },
    { valor: "tarjeta", nombre: "Tarjeta (Izipay)", icono: "💳" },
    { valor: "transferencia", nombre: "Transferencia", icono: "🏦" },
    { valor: "fiado", nombre: "Fiado", icono: "📝" }
];

// Medios que se pueden combinar en un pago con varios medios (el fiado va solo).
export const METODOS_MIXTO = METODOS_PAGO.filter((metodo) => metodo.valor !== "fiado");

export function nombreMetodoPago(valor) {
    if (valor === "mixto") return "Varios medios";
    return METODOS_PAGO.find((metodo) => metodo.valor === valor)?.nombre ?? valor;
}

// Nombre corto del medio (para la boleta): «Tarjeta» en vez de «Tarjeta (Izipay)».
export function nombreCortoPago(valor) {
    return nombreMetodoPago(valor).replace(/\s*\(.*\)$/, "");
}

/* Cómo se pagó una venta: «Yape» o, con varios medios, «Yape S/ 20.00 + Efectivo S/ 30.00». */
export function textoPago(venta) {
    if (venta.metodoPago === "mixto" && Array.isArray(venta.pagos) && venta.pagos.length > 0) {
        return venta.pagos.map((p) => `${nombreCortoPago(p.metodo)} ${moneda(p.monto)}`).join(" + ");
    }
    return nombreMetodoPago(venta.metodoPago);
}

export function formatearFecha(fecha) {
    return new Date(fecha).toLocaleString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}

// Unidades que trae cada modalidad de venta (media = media docena).
export const UNIDADES_MODALIDAD = { unidad: 1, media: 6, docena: 12, obsequio: 1 };

export function nombreModalidad(modalidad, cantidad = 1) {
    const uno = cantidad === 1;
    if (modalidad === "docena") return uno ? "docena" : "docenas";
    if (modalidad === "media") return uno ? "media docena" : "medias docenas";
    return uno ? "unidad" : "unidades";
}

// En la base de datos la cantidad siempre está en unidades.
export function describirCantidad(venta) {
    const porPaquete = UNIDADES_MODALIDAD[venta.modalidad] ?? 1;

    if (porPaquete > 1) {
        const paquetes = venta.cantidad / porPaquete;
        return `${paquetes} ${nombreModalidad(venta.modalidad, paquetes)} (${venta.cantidad} u.)`;
    }

    return `${venta.cantidad} ${nombreModalidad("unidad", venta.cantidad)}`;
}

// Precio cobrado por unidad, por media docena o por docena, según cómo se vendió.
export function precioCobrado(venta) {
    const porPaquete = UNIDADES_MODALIDAD[venta.modalidad] ?? 1;
    return porPaquete > 1
        ? importeItem(venta) / (venta.cantidad / porPaquete)
        : Number(venta.precioUnitario);
}

// Importe del producto antes del ajuste de la venta (el total ya trae descontada su parte).
export function importeItem(venta) {
    return Number(venta.total) + Number(venta.descuento ?? 0);
}

// Una boleta junta todos los productos de una misma venta (mismo "grupo").
export function numeroComprobante(boleta) {
    return String(boleta.numero).padStart(6, "0");
}

// Agrupa las filas del historial (una por producto) en boletas.
export function boletaDesdeFilas(filas) {
    const todas = [...filas].sort((a, b) => a.id - b.id);
    const primera = todas[0];
    // Los productos devueltos completos ya no van en la boleta, salvo que toda la venta esté anulada.
    const vigentes = todas.filter((f) => !f.anuladaEn);
    const ordenadas = vigentes.length > 0 ? vigentes : todas;

    return {
        numero: primera.id,
        grupo: primera.grupo,
        fecha: primera.fecha,
        vendedor: primera.vendedor,
        metodoPago: primera.metodoPago,
        pagos: primera.pagos ?? null,
        cliente: primera.cliente,
        clienteTelefono: primera.clienteTelefono,
        anulada: vigentes.length === 0,
        total: ordenadas.reduce((suma, f) => suma + Number(f.total), 0).toFixed(2),
        subtotal: ordenadas.reduce((suma, f) => suma + importeItem(f), 0).toFixed(2),
        ajuste: {
            codigo: primera.codigoAjuste,
            monto: ordenadas.reduce((suma, f) => suma + Number(f.descuento ?? 0), 0).toFixed(2)
        },
        items: ordenadas
    };
}

// Enlaces públicos (se abren sin iniciar sesión).
export function enlaceCatalogo() {
    return `${window.location.origin}/catalogo`;
}

export function enlaceBoleta(boleta) {
    return boleta.grupo ? `${window.location.origin}/boleta/${boleta.grupo}` : null;
}

// Devuelve el número listo para wa.me (con código de país) o null si no es válido.
// Los números peruanos de 9 dígitos reciben el prefijo 51 automáticamente.
export function normalizarWhatsapp(numero) {
    const digitos = numero.replace(/\D/g, "");

    if (/^9\d{8}$/.test(digitos)) {
        return `51${digitos}`;
    }

    if (digitos.length >= 10 && digitos.length <= 15) {
        return digitos;
    }

    return null;
}

/* Mensaje de WhatsApp que acompaña la boleta: agradecimiento, la boleta (con su enlace si se
   manda por chat directo) e información del catálogo con su enlace. */
export function mensajeBoleta(boleta, { conEnlace = true } = {}) {
    const lineas = [
        "Hola 👋 ¡Gracias por tu compra en Mil Deseos! 🎁",
        `Te envío tu boleta N° ${numeroComprobante(boleta)} por ${moneda(boleta.total)}.`
    ];

    const enlace = enlaceBoleta(boleta);
    if (conEnlace && enlace) lineas.push(`🧾 Ver boleta: ${enlace}`);

    lineas.push(
        "",
        `🛍️ Mira nuestro catálogo: ${enlaceCatalogo()}`,
        "Adornos y árboles navideños, luces y útiles escolares (Porta, School, Children, Recreo y Disney), al por mayor y menor. Elige por unidad, media docena o docena y haz tu pedido por WhatsApp. ✨"
    );

    return lineas.join("\n");
}
