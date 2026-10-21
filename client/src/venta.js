import { moneda } from "./api.js";

export const METODOS_PAGO = [
    { valor: "efectivo", nombre: "Efectivo", icono: "💵" },
    { valor: "yape", nombre: "Yape", icono: "💜" },
    { valor: "plin", nombre: "Plin", icono: "💚" },
    { valor: "transferencia", nombre: "Transferencia", icono: "🏦" }
];

export function nombreMetodoPago(valor) {
    return METODOS_PAGO.find((metodo) => metodo.valor === valor)?.nombre ?? valor;
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

// En la base de datos la cantidad siempre está en unidades.
export function describirCantidad(venta) {
    if (venta.modalidad === "docena") {
        const docenas = venta.cantidad / 12;
        return `${docenas} ${docenas === 1 ? "docena" : "docenas"} (${venta.cantidad} u.)`;
    }

    return `${venta.cantidad} ${venta.cantidad === 1 ? "unidad" : "unidades"}`;
}

// Precio cobrado por unidad o por docena, según cómo se vendió.
export function precioCobrado(venta) {
    return venta.modalidad === "docena"
        ? Number(venta.total) / (venta.cantidad / 12)
        : Number(venta.precioUnitario);
}

export function numeroComprobante(venta) {
    return String(venta.id).padStart(6, "0");
}

// Enlaces públicos (se abren sin iniciar sesión).
export function enlaceCatalogo() {
    return `${window.location.origin}/catalogo`;
}

export function enlaceBoleta(venta) {
    return venta.token ? `${window.location.origin}/boleta/${venta.token}` : null;
}

export function textoComprobante(venta) {
    const porDocena = venta.modalidad === "docena";

    return [
        "*Mil Deseos*",
        `Boleta de venta N° ${numeroComprobante(venta)}`,
        `Fecha: ${formatearFecha(venta.fecha)}`,
        `Atendido por: ${venta.vendedor}`,
        "",
        `Producto: ${venta.producto}${venta.codigo ? ` (${venta.codigo})` : ""}`,
        `Cantidad: ${describirCantidad(venta)}`,
        `Precio por ${porDocena ? "docena" : "unidad"}: ${moneda(precioCobrado(venta))}`,
        `*Total: ${moneda(venta.total)}*`,
        `Método de pago: ${nombreMetodoPago(venta.metodoPago)}`,
        "",
        ...(enlaceBoleta(venta) ? [`🧾 Ver boleta: ${enlaceBoleta(venta)}`] : []),
        `🛍️ Catálogo: ${enlaceCatalogo()}`,
        "",
        "¡Gracias por su compra!"
    ].join("\n");
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
