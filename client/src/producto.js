const CAMPOS_NUMERICOS = [
    "precio",
    "precioMinimo",
    "precioUnidadDocena",
    "precioCompra",
    "unidadesPorCaja",
    "stock"
];

/* Unidades del 2025 al guardar:
   - casilla sin marcar: ninguna;
   - producto nuevo, casilla recién marcada o producto que era todo del 2025: todo el stock;
   - producto con solo una parte del 2025 (por ejemplo, después de una compra): esa parte se
     conserva (sin pasar del stock). */
function calcularStock2025(valores) {
    const stock = Number(valores.stock);

    if (!valores.es2025) return 0;
    if (valores.stock2025Inicial === undefined || !valores.es2025Inicial) return stock;
    if (valores.stock2025Inicial >= valores.stockInicial) return stock;

    return Math.min(valores.stock2025Inicial, stock);
}

// Stock total de los colores del formulario (vacío si alguna cantidad no es válida).
export function sumaColores(colores) {
    const cantidades = (colores ?? []).map((c) => Number(c.stock));
    return cantidades.every((n) => String(n) !== "NaN" && Number.isInteger(n) && n >= 0)
        ? cantidades.reduce((suma, n) => suma + n, 0)
        : null;
}

// Revisa los colores del formulario. Devuelve { colores } o { error }.
function validarColores(valores) {
    if (!valores.usaColores) return { colores: null };

    const colores = (valores.colores ?? []).map((c) => ({
        ...(c.id ? { id: c.id } : {}),
        nombre: String(c.nombre ?? "").trim(),
        stock: String(c.stock ?? "").trim() === "" ? NaN : Number(c.stock)
    }));

    if (colores.length === 0) {
        return { error: "Agrega al menos un color, o desmarca «Este producto tiene colores»." };
    }

    if (colores.some((c) => !c.nombre)) {
        return { error: "Escribe el nombre de cada color." };
    }

    if (colores.some((c) => !Number.isInteger(c.stock) || c.stock < 0)) {
        return { error: "La cantidad de cada color debe ser un número entero de 0 o más." };
    }

    const nombres = colores.map((c) => c.nombre.toLowerCase());
    if (new Set(nombres).size !== nombres.length) {
        return { error: "Hay dos colores con el mismo nombre." };
    }

    return { colores };
}

// Convierte los valores del formulario y valida un producto.
// Devuelve { datos } si es válido o { error } si no lo es.
export function validarProducto(valoresFormulario) {
    // Con colores, el stock es la suma de sus cantidades.
    const { colores, error: errorColores } = validarColores(valoresFormulario);

    if (errorColores) {
        return { error: errorColores };
    }

    const valores = colores
        ? { ...valoresFormulario, stock: String(colores.reduce((suma, c) => suma + c.stock, 0)) }
        : valoresFormulario;

    // Al editar sin tocar el precio por unidad en la docena, se conservan la docena y su mínimo
    // exactos (S/ 50 ÷ 12 = 4.17 y 4.17 × 12 daría 50.04).
    const sinCambioDocena = valores.precioDocenaInicial !== undefined
        && valores.precioUnidadDocena === valores.precioUnidadDocenaInicial;
    const docenaCalculada = Number((Number(valores.precioUnidadDocena) * 12).toFixed(2));

    const datos = {
        codigo: valores.codigo.trim(),
        nombre: valores.nombre.trim(),
        precio: Number(valores.precio),
        // Precio de la docena = precio por unidad en la docena × 12.
        precioDocena: sinCambioDocena ? Number(valores.precioDocenaInicial) : docenaCalculada,
        precioMinimo: Number(valores.precioMinimo),
        // Mínimo por docena = precio por unidad en la docena × 12 (un empleado no cobra menos).
        precioMinimoDocena: sinCambioDocena ? Number(valores.precioMinimoDocenaInicial) : docenaCalculada,
        precioCompra: Number(valores.precioCompra),
        unidadesPorCaja: Number(valores.unidadesPorCaja),
        stock: Number(valores.stock),
        stock2025: calcularStock2025(valores),
        seccionId: valores.seccionId ? Number(valores.seccionId) : null,
        categoriaId: valores.categoriaId ? Number(valores.categoriaId) : null,
        colores
    };

    if (!datos.codigo) {
        return { error: "Ingresa el código del producto." };
    }

    const vacio = CAMPOS_NUMERICOS.some((campo) => String(valores[campo]).trim() === "");

    if (
        vacio ||
        !datos.nombre ||
        !Number.isFinite(datos.precio) ||
        !Number.isFinite(datos.precioDocena) ||
        !Number.isFinite(datos.precioMinimo) ||
        !Number.isFinite(datos.precioMinimoDocena) ||
        !Number.isFinite(datos.precioCompra) ||
        !Number.isInteger(datos.unidadesPorCaja) ||
        !Number.isInteger(datos.stock) ||
        datos.precio < 0 ||
        datos.precioDocena < 0 ||
        datos.precioMinimo < 0 ||
        datos.precioMinimoDocena < 0 ||
        datos.precioCompra < 0 ||
        datos.unidadesPorCaja < 1 ||
        datos.stock < 0
    ) {
        return {
            error: "Verifica los datos ingresados. Los precios no pueden ser negativos, las unidades por caja deben ser un entero mayor que cero y el stock debe ser un entero no negativo."
        };
    }

    return { datos };
}

export function textoCostoUnitario(precioCompra, unidadesPorCaja) {
    const costo = Number(precioCompra);
    const unidades = Number(unidadesPorCaja);

    if (!Number.isFinite(costo) || !Number.isInteger(unidades) || costo < 0 || unidades < 1) {
        return "Ingresa un precio y una cantidad válidos.";
    }

    return `Costo por unidad: S/ ${(costo / unidades).toFixed(2)}`;
}

// Precio × 12 como texto con 2 decimales ("" si el precio no es válido).
export function porDocena(precio) {
    const numero = Number(precio);
    return String(precio).trim() !== "" && Number.isFinite(numero) && numero >= 0
        ? (numero * 12).toFixed(2)
        : "";
}

// Ganancia estimada al vender, para mostrarla mientras se registra el producto.
// Devuelve null si faltan datos.
export function calcularGanancias(valores) {
    const unidades = Number(valores.unidadesPorCaja);
    const costoCaja = Number(valores.precioCompra);

    if (String(valores.precioCompra).trim() === "" || !Number.isInteger(unidades) || unidades < 1 || !Number.isFinite(costoCaja)) {
        return null;
    }

    const costo = costoCaja / unidades;
    const numero = (campo) => (String(valores[campo] ?? "").trim() === "" ? null : Number(valores[campo]));
    const ganancia = (precio, porDocena) => (precio === null || !Number.isFinite(precio) ? null : precio - costo * (porDocena ? 12 : 1));
    const margen = (precio, valor) => (valor === null || !precio ? null : (valor / precio) * 100);

    const precio = numero("precio");
    const minimo = numero("precioMinimo");
    const unidadDocena = numero("precioUnidadDocena");
    const porCaja = (precioUnidad) =>
        precioUnidad === null || !Number.isFinite(precioUnidad) ? null : precioUnidad * unidades - costoCaja;

    const resultado = {
        costo,
        unidades,
        unidad: ganancia(precio, false),
        minimo: ganancia(minimo, false),
        unidadDocena: ganancia(unidadDocena, false),
        docena: ganancia(unidadDocena === null ? null : unidadDocena * 12, true),
        // Ganancia de vender toda la caja a cada precio.
        cajaUnidad: porCaja(precio),
        cajaMinimo: porCaja(minimo),
        cajaDocena: porCaja(unidadDocena)
    };

    resultado.margenUnidad = margen(precio, resultado.unidad);
    resultado.margenMinimo = margen(minimo, resultado.minimo);
    resultado.margenDocena = margen(unidadDocena, resultado.unidadDocena);

    // Ganancia si se vende todo el stock al precio por unidad (las unidades del 2025 no restan costo).
    const stock = Number(valores.stock);
    const stock2025 = valores.es2025 ? stock : 0;
    resultado.todoElStock = precio !== null && Number.isInteger(stock) && stock > 0
        ? precio * stock - costo * Math.max(stock - stock2025, 0)
        : null;

    return resultado;
}
