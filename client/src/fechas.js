// Fecha local de hoy en formato YYYY-MM-DD.
export function hoy() {
    const fecha = new Date();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${fecha.getFullYear()}-${mes}-${dia}`;
}

// "2026-10" → "Octubre de 2026"
export function nombreMes(clave) {
    const [anio, mes] = clave.split("-").map(Number);
    const texto = new Date(anio, mes - 1, 1).toLocaleDateString("es-PE", {
        month: "long",
        year: "numeric"
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// "2026-10-18" → "18 oct. 2026"
export function formatearDia(fecha) {
    const [anio, mes, dia] = fecha.split("-").map(Number);
    return new Date(anio, mes - 1, dia).toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

// Meses presentes en una lista de fechas (más el actual), del más reciente al más antiguo.
export function mesesDisponibles(fechas) {
    return [...new Set([hoy().slice(0, 7), ...fechas.map((f) => f.slice(0, 7))])]
        .sort()
        .reverse();
}
