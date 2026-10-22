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

// Costos: con 2 a 4 decimales según los tenga (S/ 1.25, S/ 0.0833, S/ 2.125).
export function monedaCosto(valor) {
    const numero = Number(valor ?? 0);
    const texto = `S/ ${Math.abs(numero).toFixed(4).replace(/0{1,2}$/, "")}`;
    return numero < 0 && Number(numero.toFixed(4)) !== 0 ? `-${texto}` : texto;
}

export function moneda(valor) {
    const numero = Number(valor ?? 0);
    const texto = `S/ ${Math.abs(numero).toFixed(2)}`;
    // Evita mostrar "-0.00" por redondeo.
    return numero < 0 && texto !== "S/ 0.00" ? `-${texto}` : texto;
}
