// Sugiere la categoría de un producto por su nombre.
// Copia de las reglas de src/categoriasIniciales.js (servidor): si cambias una, cambia la otra.
// Se prueban en orden: gana la primera que coincide.
const REGLAS = [
    // Todo lo que empieza con "Luces" es luz lineal.
    { nombre: "Luces lineales", patron: "^\\s*luces|lineal|manguera|cortina de luces|tira (de )?led|serie (de )?luces|cable de luces" },
    { nombre: "Renos de luces", patron: "reno.*(luz|luces|led)|(luz|luces|led).*reno" },
    { nombre: "Cascanueces", patron: "cascanueces" },
    { nombre: "Puntas de árbol", patron: "^\\s*punta|punta (de|para) [aá]rbol|estrella (de|para) (la )?punta" },
    { nombre: "Pisos de árbol", patron: "^\\s*piso|falda (de|para) [aá]rbol|cubre ?pie|pie de [aá]rbol" },
    { nombre: "Árboles y pinos", patron: "^\\s*([aá]rbol|arbolito|pino)" },
    { nombre: "Luces decorativas", patron: "(^|\\s)(luz|luces|led|foco|focos|farol|faroles)(\\s|$)" },
    { nombre: "Coronas y guirnaldas", patron: "corona|guirnalda" },
    { nombre: "Nacimientos", patron: "nacimiento|pesebre|bel[eé]n" },
    { nombre: "Muñecos", patron: "mu[ñn]ec|pap[aá] noel|santa|duende|elfo|reno|figura" },
    { nombre: "Decoración de árbol", patron: "esfera|bola|adorno|colgante|campana|estrella|escarchad|lazo|cinta|bast[oó]n" },
    { nombre: "Útiles escolares", patron: "l[aá]piz|lapicero|borrador|tajador|regla|tijera|goma|cartuchera|resaltador|corrector" },
    { nombre: "Cuadernos", patron: "cuaderno|libreta|block|archivador|folder|f[oó]lder" },
    { nombre: "Mochilas", patron: "mochila|maleta escolar" },
    { nombre: "Loncheras", patron: "lonchera|tomatodo|tupper|taper" },
    { nombre: "Arte y manualidades", patron: "t[eé]mpera|plastilina|crayola|cray[oó]n|colores|acuarela|pincel|cartulina|papel lustre|silicona|plum[oó]n" },
    { nombre: "Forros y etiquetas", patron: "forro|etiqueta|vinifan|contact" }
].map((regla) => ({ ...regla, expresion: new RegExp(regla.patron, "i") }));

// Devuelve la categoría sugerida (de la lista de secciones con sus categorías) o null.
export function sugerirCategoria(nombreProducto, secciones) {
    const texto = nombreProducto.trim();

    if (texto.length < 3) return null;

    const todas = secciones.flatMap((seccion) => seccion.categorias.map((categoria) => ({ ...categoria, seccionId: seccion.id })));

    for (const regla of REGLAS) {
        if (regla.expresion.test(texto)) {
            const categoria = todas.find((c) => c.nombre.toLowerCase() === regla.nombre.toLowerCase());
            if (categoria) return categoria;
        }
    }

    return null;
}
