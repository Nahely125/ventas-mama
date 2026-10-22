const METODOS_PAGO = ["efectivo", "yape", "plin", "transferencia", "fiado"];
const MODALIDADES = ["unidad", "media", "docena"];
// Unidades que trae cada modalidad (media = media docena).
const UNIDADES_MODALIDAD = { unidad: 1, media: 6, docena: 12 };
const MAXIMO_PRODUCTOS = 40;
const POR_PAGINA = 30;

// Límite de intentos con la contraseña del jefe (por sesión), para que no se pueda adivinar probando.
const INTENTOS_MAXIMOS = 5;
const BLOQUEO_MS = 10 * 60 * 1000;

// Ganancia de cada fila: las unidades del 2025 ya se pagaron el año pasado (no restan costo).
const GANANCIA = `ROUND(ventas.total - COALESCE(ventas.costo_unitario, 0) * (ventas.cantidad - ventas.unidades_2025), 2)`;
const GANANCIA_2025 = `ROUND(ventas.total * ventas.unidades_2025 / ventas.cantidad, 2)`;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Condiciones del filtro por fechas (días en hora de Lima, ambos incluidos).
function filtroFechas({ desde, hasta } = {}, parametros) {
    const condiciones = [];

    if (FECHA.test(desde ?? "")) {
        parametros.push(desde);
        condiciones.push(`ventas.fecha >= $${parametros.length}::DATE`);
    }

    if (FECHA.test(hasta ?? "")) {
        parametros.push(hasta);
        condiciones.push(`ventas.fecha < $${parametros.length}::DATE + 1`);
    }

    return condiciones;
}

/* Filas de ventas (una por producto) para el historial y la boleta.
   opciones: { grupo } para una sola venta, o { desde, hasta, pagina } para el historial
   (la página trae POR_PAGINA ventas completas, con todos sus productos). */
async function consultarVentas(pool, esJefe, opciones = {}) {
    const parametros = [];
    const condiciones = [];

    if (opciones.grupo) {
        parametros.push(opciones.grupo);
        condiciones.push(`ventas.grupo = $${parametros.length}`);
    } else {
        condiciones.push(...filtroFechas(opciones, parametros));
    }

    const donde = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

    // Paginación por ventas completas (grupos), de la más reciente a la más antigua.
    const externas = [...condiciones];

    if (!opciones.grupo) {
        const pagina = Math.max(0, Number.parseInt(opciones.pagina, 10) || 0);
        parametros.push(POR_PAGINA + 1, pagina * POR_PAGINA);
        externas.push(`ventas.grupo IN (
            SELECT ventas.grupo FROM ventas ${donde}
            GROUP BY ventas.grupo
            ORDER BY MAX(ventas.fecha) DESC, MAX(ventas.id) DESC
            LIMIT $${parametros.length - 1} OFFSET $${parametros.length}
        )`);
    }

    const resultado = await pool.query(
        `SELECT
            ventas.id,
            ventas.grupo,
            TO_CHAR(ventas.fecha, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha,
            productos.nombre || COALESCE(' · ' || ventas.color, '') AS producto,
            ventas.color,
            productos.codigo,
            ventas.modalidad,
            ventas.cantidad,
            ventas.precio_unitario AS "precioUnitario",
            ventas.total,
            ventas.descuento,
            ventas.codigo_ajuste AS "codigoAjuste",
            ventas.obsequio,
            ventas.unidades_devueltas AS "unidadesDevueltas",
            ventas.metodo_pago AS "metodoPago",
            COALESCE(usuarios.nombre, 'No registrado') AS vendedor,
            autoriza.nombre AS "autorizadoPor",
            clientes.id AS "clienteId",
            clientes.nombre AS cliente,
            clientes.telefono AS "clienteTelefono",
            TO_CHAR(ventas.anulada_en, 'YYYY-MM-DD"T"HH24:MI:SS') AS "anuladaEn",
            anula.nombre AS "anuladaPor",
            ventas.motivo_anulacion AS "motivoAnulacion"
            ${esJefe ? `,
            ventas.costo_unitario AS "costoUnitario",
            ventas.unidades_2025 AS "unidades2025",
            ${GANANCIA} AS ganancia,
            ${GANANCIA_2025} AS "ganancia2025"` : ""}
         FROM ventas
         INNER JOIN productos ON ventas.producto_id = productos.id
         LEFT JOIN usuarios ON ventas.usuario_id = usuarios.id
         LEFT JOIN usuarios AS autoriza ON ventas.autorizado_por = autoriza.id
         LEFT JOIN usuarios AS anula ON ventas.anulada_por = anula.id
         LEFT JOIN clientes ON ventas.cliente_id = clientes.id
         ${externas.length ? `WHERE ${externas.join(" AND ")}` : ""}
         ORDER BY ventas.fecha DESC, ventas.grupo, ventas.id ASC`,
        parametros
    );

    return resultado.rows;
}

// Totales del periodo (sin las ventas anuladas). La ganancia solo la ve el jefe.
async function totalesVentas(pool, esJefe, opciones = {}) {
    const parametros = [];
    const condiciones = ["ventas.anulada_en IS NULL", ...filtroFechas(opciones, parametros)];
    const donde = `WHERE ${condiciones.join(" AND ")}`;

    const resultado = await pool.query(
        `SELECT
            COUNT(DISTINCT ventas.grupo)::INT AS ventas,
            COALESCE(SUM(ventas.cantidad), 0)::INT AS unidades
            ${esJefe ? `,
            COALESCE(SUM(ventas.total), 0) AS vendido,
            COALESCE(SUM(${GANANCIA}), 0) AS ganancia,
            COALESCE(SUM(${GANANCIA_2025}), 0) AS "ganancia2025"` : ""}
         FROM ventas ${donde}`,
        parametros
    );

    const totales = resultado.rows[0];

    if (esJefe) {
        const metodos = await pool.query(
            `SELECT ventas.metodo_pago AS metodo, SUM(ventas.total) AS total
             FROM ventas ${donde}
             GROUP BY 1`,
            parametros
        );
        totales.porMetodo = Object.fromEntries(metodos.rows.map((f) => [f.metodo, f.total]));
    }

    return totales;
}

// Junta las filas de una venta en una boleta (sin costos ni ganancias).
function armarBoleta(todas) {
    const primera = todas[0];
    // Los productos devueltos completos (filas anuladas) ya no van en la boleta, salvo que toda
    // la venta esté anulada.
    const vigentes = todas.filter((f) => !f.anuladaEn);
    const filas = vigentes.length > 0 ? vigentes : todas;

    return {
        numero: Math.min(...todas.map((f) => f.id)),
        grupo: primera.grupo,
        fecha: primera.fecha,
        vendedor: primera.vendedor,
        metodoPago: primera.metodoPago,
        cliente: primera.cliente,
        clienteTelefono: primera.clienteTelefono,
        anulada: vigentes.length === 0,
        total: filas.reduce((suma, f) => suma + Number(f.total), 0).toFixed(2),
        // Antes del ajuste y cuánto se descontó.
        subtotal: filas.reduce((suma, f) => suma + Number(f.total) + Number(f.descuento), 0).toFixed(2),
        ajuste: {
            codigo: primera.codigoAjuste,
            monto: filas.reduce((suma, f) => suma + Number(f.descuento), 0).toFixed(2)
        },
        items: filas.map((f) => ({
            producto: f.producto,
            codigo: f.codigo,
            modalidad: f.modalidad,
            cantidad: f.cantidad,
            precioUnitario: f.precioUnitario,
            total: f.total,
            descuento: f.descuento,
            obsequio: f.obsequio,
            unidadesDevueltas: f.unidadesDevueltas
        }))
    };
}

module.exports = {
    METODOS_PAGO,
    MODALIDADES,
    UNIDADES_MODALIDAD,
    MAXIMO_PRODUCTOS,
    POR_PAGINA,
    INTENTOS_MAXIMOS,
    BLOQUEO_MS,
    consultarVentas,
    totalesVentas,
    armarBoleta
};
