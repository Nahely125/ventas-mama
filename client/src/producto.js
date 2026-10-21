const CAMPOS_NUMERICOS = [
    "precio",
    "precioMinimo",
    "precioUnidadDocena",
    "precioMinimoDocena",
    "precioCompra",
    "unidadesPorCaja",
    "stock"
];

// Convierte los valores del formulario y valida un producto.
// Devuelve { datos } si es válido o { error } si no lo es.
export function validarProducto(valores) {
    const datos = {
        codigo: valores.codigo.trim(),
        nombre: valores.nombre.trim(),
        precio: Number(valores.precio),
        // Precio de la docena = precio por unidad en la docena × 12.
        precioDocena: Number((Number(valores.precioUnidadDocena) * 12).toFixed(2)),
        precioMinimo: Number(valores.precioMinimo),
        // El mínimo por docena se escribe aparte (es el precio de la docena completa).
        precioMinimoDocena: Number(valores.precioMinimoDocena),
        precioCompra: Number(valores.precioCompra),
        unidadesPorCaja: Number(valores.unidadesPorCaja),
        stock: Number(valores.stock),
        // Si se marca como mercadería del 2025, todo su stock cuenta como del año pasado.
        stock2025: valores.es2025 ? Number(valores.stock) : 0,
        seccionId: valores.seccionId ? Number(valores.seccionId) : null,
        categoriaId: valores.categoriaId ? Number(valores.categoriaId) : null
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
    const docena = unidadDocena === null ? null : unidadDocena * 12;
    const minimoDocena = numero("precioMinimoDocena");

    const resultado = {
        costo,
        unidad: ganancia(precio, false),
        minimo: ganancia(minimo, false),
        docena: ganancia(docena, true),
        minimoDocena: ganancia(minimoDocena, true)
    };

    resultado.margenUnidad = margen(precio, resultado.unidad);
    resultado.margenMinimo = margen(minimo, resultado.minimo);

    // Ganancia si se vende todo el stock al precio por unidad (las unidades del 2025 no restan costo).
    const stock = Number(valores.stock);
    const stock2025 = valores.es2025 ? stock : 0;
    resultado.todoElStock = precio !== null && Number.isInteger(stock) && stock > 0
        ? precio * stock - costo * Math.max(stock - stock2025, 0)
        : null;

    return resultado;
}
