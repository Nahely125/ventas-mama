// Ajustes (descuentos sobre el total de una venta) que el jefe permite dándole el código al empleado.
// monto null = ajuste propio: se escribe el monto.
const CODIGOS_AJUSTE = {
    AJUSTE10: 10,
    AJUSTE20: 20,
    "AJUSTE PROPIO": null
};

// Solo se puede obsequiar mercadería que cueste menos de esto por unidad (límite para empleados).
const COSTO_MAXIMO_OBSEQUIO = 5;

// "ajuste propio", "AjustePropio", " ajuste10 " → forma oficial del código.
function normalizarCodigo(codigo) {
    if (typeof codigo !== "string") return "";
    const limpio = codigo.trim().toUpperCase().replace(/\s+/g, " ");
    return limpio === "AJUSTEPROPIO" ? "AJUSTE PROPIO" : limpio;
}

// Devuelve { codigo, monto } con el monto fijo del código (o el escrito si es propio), o { error }.
function resolverAjuste(ajuste) {
    const codigo = normalizarCodigo(ajuste?.codigo);

    if (!Object.hasOwn(CODIGOS_AJUSTE, codigo)) {
        return { error: "El código de ajuste no es válido." };
    }

    const fijo = CODIGOS_AJUSTE[codigo];
    const monto = fijo ?? Number(ajuste.monto);

    if (!Number.isFinite(monto) || monto <= 0) {
        return { error: "Escribe el monto del ajuste (mayor que cero)." };
    }

    return { codigo, monto: Number(monto.toFixed(2)) };
}

// Reparte el ajuste entre los productos según su importe, al céntimo y sin pasar ninguno de su importe.
function repartirAjuste(importes, monto) {
    const centimos = importes.map((importe) => Math.round(importe * 100));
    const subtotal = centimos.reduce((suma, c) => suma + c, 0);
    let pendiente = Math.round(monto * 100);
    const partes = centimos.map((c) => Math.min(c, Math.floor((pendiente * c) / subtotal)));
    pendiente -= partes.reduce((suma, p) => suma + p, 0);

    for (let i = 0; pendiente > 0 && i < partes.length; i++) {
        const extra = Math.min(centimos[i] - partes[i], pendiente);
        partes[i] += extra;
        pendiente -= extra;
    }

    return partes.map((p) => p / 100);
}

module.exports = { CODIGOS_AJUSTE, COSTO_MAXIMO_OBSEQUIO, normalizarCodigo, resolverAjuste, repartirAjuste };
