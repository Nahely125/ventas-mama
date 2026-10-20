// Petición JSON al servidor. Lanza un error con el mensaje del backend.
export async function pedir(url, opciones = {}) {
    const { cuerpo, ...resto } = opciones;

    const respuesta = await fetch(url, {
        ...resto,
        headers: cuerpo !== undefined
            ? { "Content-Type": "application/json" }
            : undefined,
        body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
    });

    let datos = null;

    try {
        datos = await respuesta.json();
    } catch {
        datos = null;
    }

    if (!respuesta.ok) {
        const error = new Error(
            datos?.error || "Ocurrió un error al comunicarse con el servidor."
        );
        error.estado = respuesta.status;
        throw error;
    }

    return datos;
}

export function moneda(valor) {
    const numero = Number(valor ?? 0);
    const texto = `S/ ${Math.abs(numero).toFixed(2)}`;
    // Evita mostrar "-0.00" por redondeo.
    return numero < 0 && texto !== "S/ 0.00" ? `-${texto}` : texto;
}
