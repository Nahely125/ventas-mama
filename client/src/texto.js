// Para buscar sin importar tildes ni mayúsculas: "Árbol", "arbol" y "ARBOL" son lo mismo.
export function normalizar(texto) {
    return String(texto ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();
}

// ¿Alguno de los textos contiene lo buscado? (busqueda ya normalizada)
export function contiene(busqueda, ...textos) {
    return textos.some((texto) => normalizar(texto).includes(busqueda));
}
