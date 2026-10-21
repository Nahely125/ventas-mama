// Interpreta un pedido dictado ("tres cintas rojas y dos docenas de esferas doradas")
// y lo convierte en productos del inventario con su cantidad y modalidad.

const NUMEROS = {
    un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
    nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
    dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
    veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
    treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
    noventa: 90, cien: 100, ciento: 100
};

// Palabras que no ayudan a identificar el producto.
const RELLENO = new Set([
    "de", "del", "la", "las", "el", "los", "unidad", "unidades", "docena", "docenas", "media", "medias",
    "quiero", "dame", "deme", "vende", "vendo", "agrega", "agregar", "pon", "ponme", "por", "favor",
    "con", "para", "porfa", "porfavor", "x", "pieza", "piezas"
]);

export function normalizar(texto) {
    return texto
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9ñ\s.-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// Raíz simple para comparar singular y plural ("esferas" ~ "esfera", "luces" ~ "luz").
function raiz(palabra) {
    if (palabra.endsWith("ces")) return palabra.slice(0, -3) + "z";
    if (palabra.length > 4 && palabra.endsWith("es")) return palabra.slice(0, -2);
    if (palabra.length > 3 && palabra.endsWith("s")) return palabra.slice(0, -1);
    return palabra;
}

function palabras(texto) {
    return normalizar(texto).split(" ").filter(Boolean);
}

// Lee la cantidad de un fragmento: número escrito o en palabras ("treinta y dos" llega como "32" o "treinta").
function leerCantidad(tokens) {
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (/^\d+$/.test(token)) {
            return { cantidad: Number(token), indice: i };
        }

        if (NUMEROS[token] !== undefined) {
            let valor = NUMEROS[token];
            // "treinta y dos" → 32 (cuando el dictado no lo convierte a número)
            if (valor >= 30 && tokens[i + 1] === "y" && NUMEROS[tokens[i + 2]] < 10) {
                valor += NUMEROS[tokens[i + 2]];
                return { cantidad: valor, indice: i, largo: 3 };
            }
            return { cantidad: valor, indice: i };
        }
    }

    return null;
}

// Puntaje de coincidencia entre lo dictado y un producto (0 a 1).
function puntaje(tokensBuscados, producto) {
    const codigo = normalizar(producto.codigo ?? "").replace(/[\s.-]/g, "");
    const juntos = tokensBuscados.join("");

    if (codigo && juntos.includes(codigo)) {
        return 1;
    }

    const delProducto = new Set(palabras(producto.nombre).map(raiz));
    const buscados = tokensBuscados.map(raiz);

    if (buscados.length === 0) return 0;

    const coinciden = buscados.filter((t) => delProducto.has(t) || [...delProducto].some((p) => p.length > 3 && (p.startsWith(t) || t.startsWith(p)))).length;

    // Se premia que coincidan casi todas las palabras dichas y, de desempate, que el nombre sea corto.
    return coinciden / buscados.length - delProducto.size * 0.001;
}

function mejorProducto(tokens, productos) {
    let mejor = null;

    for (const producto of productos) {
        const valor = puntaje(tokens, producto);

        if (!mejor || valor > mejor.valor) {
            mejor = { producto, valor };
        }
    }

    return mejor && mejor.valor >= 0.5 ? mejor.producto : null;
}

/* Devuelve una lista de { texto, cantidad, modalidad, producto | null }.
   "media docena" se vende como media docena (6 u.). Si no se dice cantidad, es 1. */
export function interpretarPedido(texto, productos) {
    // Primero se separa por comas, punto y coma o puntos (que no sean decimales como "1.80"),
    // y luego por "y", "más", "además"... salvo en números como "treinta y dos".
    const fragmentos = texto
        .split(/[,;]|\.(?!\d)/)
        .map(normalizar)
        .flatMap((parte) =>
            parte.split(/(?<!treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+y\s+|\s+(?:mas|ademas|tambien|luego)\s+/)
        )
        .map((f) => f.trim())
        .filter(Boolean);

    return fragmentos
        .map((fragmento) => {
            const tokens = fragmento.split(" ");
            let modalidad = "unidad";
            let cantidad = 1;

            const lectura = leerCantidad(tokens);
            if (lectura) {
                cantidad = lectura.cantidad;
                tokens.splice(lectura.indice, lectura.largo ?? 1);
            }

            if (/\bmedias? docenas?\b/.test(fragmento)) {
                modalidad = "media";
            } else if (/\bdocenas?\b/.test(fragmento)) {
                modalidad = "docena";
            }

            const buscados = tokens.filter((t) => t && !RELLENO.has(t) && !/^\d+$/.test(t));

            if (buscados.length === 0) return null;

            return {
                texto: fragmento,
                cantidad,
                modalidad,
                producto: mejorProducto(buscados, productos)
            };
        })
        .filter(Boolean);
}

export function vozDisponible() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}
