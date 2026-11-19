import { UNIDADES_MODALIDAD } from "./venta.js";

/* Cálculos de los productos de una venta (los usan «Registrar venta» y el inventario). */

export const unidadesDe = (modalidad) => UNIDADES_MODALIDAD[modalidad] ?? 1;

// Docena y media docena: se escribe el precio por unidad y se calcula el del paquete.
export const esPaquete = (modalidad) => modalidad === "docena" || modalidad === "media";

// Precio de lista del paquete: unidad, media docena (mitad de la docena), docena o gratis (obsequio).
export function precioPaquete(producto, modalidad) {
    if (modalidad === "obsequio") return 0;
    if (modalidad === "docena") return Number(producto.precioDocena);
    if (modalidad === "media") return Number((Number(producto.precioDocena) / 2).toFixed(2));
    return Number(producto.precio);
}

// Mínimo del paquete (el que valida el servidor): la media docena tiene la mitad del de la docena.
export function minimoDe(producto, modalidad) {
    if (modalidad === "obsequio") return 0;
    if (modalidad === "docena") return Number(producto.precioMinimoDocena);
    if (modalidad === "media") return Number((Number(producto.precioMinimoDocena) / 2).toFixed(2));
    return Number(producto.precioMinimo);
}

// Lo que se escribe en el formulario: siempre el precio por unidad.
export function precioDeLista(producto, modalidad) {
    if (!producto) return "";
    return (precioPaquete(producto, modalidad) / unidadesDe(modalidad)).toFixed(2);
}

export function centimos(valor) {
    return Math.round(Number(valor) * 100);
}

let siguienteClave = 1;

// Clave única de cada línea del carrito.
export function nuevaClave() {
    return siguienteClave++;
}

export const tieneColores = (producto) => (producto?.colores ?? []).length > 0;

// Unidades de un producto (o de un color) que ya están en el carrito.
export function unidadesEnCarrito(carrito, productoId) {
    return carrito
        .filter((item) => item.producto.id === productoId)
        .reduce((suma, item) => suma + item.cantidad * unidadesDe(item.modalidad), 0);
}

export function unidadesColorEnCarrito(carrito, colorId) {
    return carrito
        .filter((item) => item.color?.id === colorId)
        .reduce((suma, item) => suma + item.cantidad * unidadesDe(item.modalidad), 0);
}

export const MODALIDADES_VENTA = [
    { valor: "unidad", texto: "Unidad" },
    { valor: "media", texto: "Media docena (6 u.)" },
    { valor: "docena", texto: "Docena (12 u.)" }
];
