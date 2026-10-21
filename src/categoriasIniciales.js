// Categorías iniciales de cada feria y reglas para reconocerlas por el nombre del producto.
// Las reglas se revisan en orden: gana la primera que coincide (por eso "Reno de luces"
// va antes que "Luces decorativas" y "Muñecos").
// IMPORTANTE: client/src/categoriasAuto.js tiene una copia de las reglas para el formulario.

const CATEGORIAS_NAVIDAD = [
    { nombre: "Árboles y pinos", icono: "🎄", patron: "^\\s*([aá]rbol|arbolito|pino)" },
    { nombre: "Puntas de árbol", icono: "⭐", patron: "^\\s*punta|punta (de|para) [aá]rbol|estrella (de|para) (la )?punta" },
    { nombre: "Decoración de árbol", icono: "🔴", patron: "esfera|bola|adorno|colgante|campana|estrella|escarchad|lazo|cinta|bast[oó]n" },
    { nombre: "Pisos de árbol", icono: "🎁", patron: "^\\s*piso|falda (de|para) [aá]rbol|cubre ?pie|pie de [aá]rbol" },
    { nombre: "Muñecos", icono: "🎅", patron: "mu[ñn]ec|pap[aá] noel|santa|duende|elfo|mu[ñn]eco de nieve|reno|figura" },
    { nombre: "Cascanueces", icono: "💂", patron: "cascanueces" },
    { nombre: "Luces lineales", icono: "💡", patron: "lineal|manguera|cortina de luces|tira (de )?led|serie (de )?luces|cable de luces" },
    { nombre: "Luces decorativas", icono: "✨", patron: "(^|\\s)(luz|luces|led|foco|focos|farol|faroles)(\\s|$)" },
    { nombre: "Renos de luces", icono: "🦌", patron: "reno.*(luz|luces|led)|(luz|luces|led).*reno" },
    { nombre: "Coronas y guirnaldas", icono: "🌿", patron: "corona|guirnalda" },
    { nombre: "Nacimientos", icono: "⛪", patron: "nacimiento|pesebre|bel[eé]n" }
];

const CATEGORIAS_ESCOLAR = [
    { nombre: "Útiles escolares", icono: "✏️", patron: "l[aá]piz|lapicero|borrador|tajador|regla|tijera|goma|cartuchera|resaltador|corrector" },
    { nombre: "Cuadernos", icono: "📓", patron: "cuaderno|libreta|block|archivador|folder|f[oó]lder" },
    { nombre: "Mochilas", icono: "🎒", patron: "mochila|maleta escolar" },
    { nombre: "Loncheras", icono: "🍱", patron: "lonchera|tomatodo|tupper|taper" },
    { nombre: "Arte y manualidades", icono: "🎨", patron: "t[eé]mpera|plastilina|crayola|cray[oó]n|colores|acuarela|pincel|cartulina|papel lustre|silicona|plumon|plum[oó]n" },
    { nombre: "Forros y etiquetas", icono: "🏷️", patron: "forro|etiqueta|vinifan|contact" }
];

// Orden en que se prueban las reglas (más específicas primero). El índice decide el orden
// de las pestañas en el catálogo; esta lista solo decide qué regla gana.
const PRIORIDAD_NAVIDAD = [
    "Renos de luces",
    "Cascanueces",
    "Puntas de árbol",
    "Pisos de árbol",
    "Árboles y pinos",
    "Luces lineales",
    "Luces decorativas",
    "Coronas y guirnaldas",
    "Nacimientos",
    "Muñecos",
    "Decoración de árbol"
];

module.exports = { CATEGORIAS_NAVIDAD, CATEGORIAS_ESCOLAR, PRIORIDAD_NAVIDAD };
