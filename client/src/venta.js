import { moneda } from "./api.js";

export const METODOS_PAGO = [
    { valor: "efectivo", nombre: "Efectivo", icono: "💵" },
    { valor: "yape", nombre: "Yape", icono: "💜" },
    { valor: "plin", nombre: "Plin", icono: "💚" },
    { valor: "transferencia", nombre: "Transferencia", icono: "🏦" },
    { valor: "fiado", nombre: "Fiado", icono: "📝" }
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

// Una boleta junta todos los productos de una misma venta (mismo "grupo").
export function numeroComprobante(boleta) {
    return String(boleta.numero).padStart(6, "0");
}

// Agrupa las filas del historial (una por producto) en boletas.
export function boletaDesdeFilas(filas) {
    const ordenadas = [...filas].sort((a, b) => a.id - b.id);
    const primera = ordenadas[0];

    return {
        numero: primera.id,
        grupo: primera.grupo,
        fecha: primera.fecha,
        vendedor: primera.vendedor,
        metodoPago: primera.metodoPago,
        cliente: primera.cliente,
        clienteTelefono: primera.clienteTelefono,
        anulada: Boolean(primera.anuladaEn),
        total: ordenadas.reduce((suma, f) => suma + Number(f.total), 0).toFixed(2),
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
