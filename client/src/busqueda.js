import { normalizar } from "./texto.js";

/* Búsqueda de productos que entiende parecidos:
   - sinónimos: "árbol" encuentra "pino", "pack de bolas" encuentra "maleta de esferas";
   - singular y plural: "luz" = "luces";
   - errores de ortografía comunes: "lucez" = "luces", "adas" = "hadas", "vola" = "bola";
   - y un error de tipeo por palabra ("guirlanda" = "guirnalda").
   Cada palabra buscada tiene que aparecer (o parecerse) en el nombre o el código. */

// Grupos de palabras que significan lo mismo en la tienda (se escriben en singular).
const SINONIMOS = [
    ["arbol", "pino", "arbolito", "abeto"],
    ["luz", "luces", "foco", "led", "serie", "lucecita", "instalacion"],
    ["pack", "maleta", "set", "kit", "caja", "juego", "paquete", "estuche"],
    ["bola", "esfera", "bolita"],
    ["adorno", "decoracion", "colgante"],
    ["lazo", "mono", "moño"],
    ["cinta", "liston"],
    ["vela", "cirio"],
    ["noel", "santa", "papanoel", "papa"],
    ["nacimiento", "pesebre", "belen"],
    ["muneco", "figura", "peluche"],
    ["regalo", "obsequio", "presente"],
    ["taza", "jarro", "mug"],
    ["reno", "venado"],
    ["angel", "angelito"],
    ["campana", "cascabel"],
    ["corona", "guirnalda"],
    ["lapicero", "boligrafo", "lapicera"],
    ["cuaderno", "libreta"],
    ["mochila", "morral"],
    ["estrella", "estrellita"],
    ["chico", "pequeno", "mini"],
    ["grande", "gigante", "jumbo"]
];

// Palabras que no ayudan a buscar.
const VACIAS = new Set(["de", "del", "la", "el", "los", "las", "para", "con", "y", "en", "un", "una", "por", "al", "x"]);

/* Clave por sonido (español): lo que suena igual se escribe igual.
   h muda, b/v, s/z/c(e,i), c/k/qu, ll/y, g(e,i)/j; letras repetidas una sola vez; sin la «s» final (plural). */
function clave(palabra) {
    let p = normalizar(palabra).replace(/[^a-z0-9ñ]/g, "");
    if (/^\d+$/.test(p)) return p;

    p = p
        .replace(/ñ/g, "n")
        .replace(/ch/g, "X")
        .replace(/h/g, "")
        .replace(/ll/g, "y")
        .replace(/qu/g, "k")
        .replace(/gu([ei])/g, "g$1")
        .replace(/g([ei])/g, "j$1")
        .replace(/c([ei])/g, "s$1")
        .replace(/c/g, "k")
        .replace(/z/g, "s")
        .replace(/v/g, "b")
        .replace(/w/g, "u")
        .replace(/y$/, "i")
        .replace(/(.)\1+/g, "$1");

    // Plural: «luces» → «luse», «bolas» → «bola» (la «e» que queda se tolera al comparar).
    if (p.length > 3 && p.endsWith("s")) p = p.slice(0, -1);
    return p;
}

// Distancia de edición (cuántas letras cambiar, quitar o poner), cortando si pasa del máximo.
function distancia(a, b, maximo) {
    if (Math.abs(a.length - b.length) > maximo) return maximo + 1;
    let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);

    for (let i = 1; i <= a.length; i++) {
        const fila = [i];
        let menor = i;
        for (let j = 1; j <= b.length; j++) {
            fila[j] = Math.min(anterior[j] + 1, fila[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            menor = Math.min(menor, fila[j]);
        }
        if (menor > maximo) return maximo + 1;
        anterior = fila;
    }

    return anterior[b.length];
}

// ¿La palabra buscada (clave) se parece a la palabra del producto (clave)?
function parecida(buscada, delProducto) {
    if (buscada === delProducto) return true;
    // Mientras se escribe: «arb» ya encuentra «arbol».
    if (buscada.length >= 2 && delProducto.startsWith(buscada)) return true;
    const largo = Math.max(buscada.length, delProducto.length);
    // Errores de tipeo solo en palabras de 5 letras o más (en las cortas confunde: «bela» y «tela»).
    if (largo < 5) return false;
    return distancia(buscada, delProducto, largo >= 8 ? 2 : 1) <= (largo >= 8 ? 2 : 1);
}

// Clave → claves de sus sinónimos.
const GRUPOS = SINONIMOS.map((grupo) => grupo.map(clave));

function variantes(palabra) {
    const propia = clave(palabra);
    const todas = new Set([propia]);

    for (const grupo of GRUPOS) {
        if (grupo.some((c) => c === propia || (propia.length >= 5 && distancia(c, propia, 1) <= 1))) {
            grupo.forEach((c) => todas.add(c));
        }
    }

    return [...todas];
}

const clavesDeTexto = new Map();

function clavesDe(texto) {
    if (!clavesDeTexto.has(texto)) {
        clavesDeTexto.set(texto, normalizar(texto).split(/[^a-z0-9ñ]+/).filter(Boolean).map(clave));
    }
    return clavesDeTexto.get(texto);
}

/* Prepara lo buscado una sola vez (para filtrar muchos productos).
   Devuelve una función: producto → 0 (contiene el texto tal cual), 1 (se parece) o null (no coincide). */
export function buscadorDeProductos(texto) {
    const busqueda = normalizar(texto);
    if (!busqueda) return () => 0;

    const palabras = busqueda.split(/[^a-z0-9ñ]+/).filter((p) => p && !VACIAS.has(p));
    const buscadas = palabras.map(variantes);
    // Lo escrito tal cual, desde el inicio de una palabra («adas» no es «doradas»).
    const espacios = (t) => ` ${t.replace(/[^a-z0-9ñ]+/g, " ").trim()}`;
    const buscadoConEspacio = espacios(busqueda);
    const alInicio = (nombre) => espacios(nombre).includes(buscadoConEspacio);

    return (producto) => {
        const nombre = normalizar(producto.nombre);
        const codigo = normalizar(producto.codigo);
        if (alInicio(nombre) || codigo.includes(busqueda)) return 0;
        if (buscadas.length === 0) return null;

        const delProducto = [...clavesDe(producto.nombre ?? ""), ...clavesDe(producto.codigo ?? "")];
        const coincide = buscadas.every((opciones) =>
            opciones.some((opcion) => delProducto.some((palabra) => parecida(opcion, palabra)))
        );
        return coincide ? 1 : null;
    };
}

// Filtra y ordena: primero los que contienen lo escrito tal cual, luego los parecidos.
export function buscarProductos(productos, texto) {
    const puntaje = buscadorDeProductos(texto);
    return productos
        .map((producto) => ({ producto, puntos: puntaje(producto) }))
        .filter((r) => r.puntos !== null)
        .sort((a, b) => a.puntos - b.puntos)
        .map((r) => r.producto);
}
