const CAMPOS_NUMERICOS = [
    "precio",
    "precioDocena",
    "precioMinimo",
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
        precioDocena: Number(valores.precioDocena),
        precioMinimo: Number(valores.precioMinimo),
        precioCompra: Number(valores.precioCompra),
        unidadesPorCaja: Number(valores.unidadesPorCaja),
        stock: Number(valores.stock)
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
        !Number.isFinite(datos.precioCompra) ||
        !Number.isInteger(datos.unidadesPorCaja) ||
        !Number.isInteger(datos.stock) ||
        datos.precio < 0 ||
        datos.precioDocena < 0 ||
        datos.precioMinimo < 0 ||
        datos.precioCompra < 0 ||
        datos.unidadesPorCaja < 1 ||
        datos.stock < 0
    ) {
        return {
            error: "Verifica los datos ingresados. Los precios no pueden ser negativos, las unidades por caja deben ser un entero mayor que cero y el stock debe ser un entero no negativo."
        };
    }

    if (datos.precio < datos.precioMinimo) {
        return { error: "El precio de venta no puede ser menor que el precio mínimo." };
    }

    if (Math.round(datos.precioDocena * 100) < Math.round(datos.precioMinimo * 1200)) {
        return {
            error: `El precio por docena no puede ser menor que S/ ${(datos.precioMinimo * 12).toFixed(2)} (precio mínimo × 12).`
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
