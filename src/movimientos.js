/* Historial de movimientos del stock (kardex).
   Cada cambio del stock de un producto lo anota la base de datos sola (trigger en productos).
   Antes de cambiar el stock, cada ruta dice qué movimiento es con anotarMovimiento(): tipo,
   detalle y quién lo hizo. Vale solo para esa transacción. */

const TIPOS = ["registro", "edicion", "venta", "anulacion", "devolucion", "compra", "compra_anulada", "ajuste", "inicio"];

// Motivos de un conteo o ajuste de stock.
const MOTIVOS_AJUSTE = {
    conteo: "Conteo físico",
    roto: "Roto o dañado",
    perdido: "Perdido o faltante",
    regalado: "Regalado (fuera de una venta)",
    uso: "Uso del negocio",
    otro: "Otro motivo"
};

async function anotarMovimiento(client, { tipo, detalle = null, referencia = null, motivo = null, usuarioId = null }) {
    await client.query(`SELECT set_config('app.movimiento', $1, true)`, [
        JSON.stringify({
            tipo,
            detalle: detalle ? String(detalle).slice(0, 200) : null,
            referencia,
            motivo,
            usuarioId
        })
    ]);
}

// "Boleta N° 000123" a partir del id más bajo de la venta.
function textoBoleta(id) {
    return `Boleta N° ${String(id).padStart(6, "0")}`;
}

module.exports = { TIPOS, MOTIVOS_AJUSTE, anotarMovimiento, textoBoleta };
