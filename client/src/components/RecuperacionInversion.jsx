import { moneda } from "../api.js";

// Muestra cuánto se ha recuperado de la inversión con la ganancia neta.
export default function RecuperacionInversion({ resumen, onRegistrar }) {
    if (!resumen) {
        return null;
    }

    const inversion = Number(resumen.inversionTotal ?? 0);

    if (inversion === 0) {
        return (
            <section className="tarjeta recuperacion recuperacion-vacia">
                <h2>Recuperación de la inversión</h2>
                <p>Todavía no registraste tu inversión. Anótala para saber cuánto te falta recuperar.</p>
                {onRegistrar && (
                    <button type="button" className="boton-principal boton-pequeno" onClick={onRegistrar}>
                        Registrar inversión
                    </button>
                )}
            </section>
        );
    }

    const porcentaje = Number(resumen.porcentajeRecuperado);
    const falta = Number(resumen.faltaRecuperar);
    const recuperada = falta === 0;
    const excedente = Number(resumen.gananciaNeta) - inversion;

    return (
        <section className={`tarjeta recuperacion ${recuperada ? "recuperacion-completa" : ""}`}>
            <div className="recuperacion-encabezado">
                <h2>Recuperación de la inversión</h2>
                <strong className="recuperacion-porcentaje">{porcentaje.toFixed(1)}%</strong>
            </div>

            <div
                className="barra-recuperacion"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={porcentaje}
                aria-label="Porcentaje de la inversión recuperado"
            >
                <span style={{ width: `${porcentaje}%` }}></span>
            </div>

            <div className="recuperacion-datos">
                <div>
                    <span>Inversión total</span>
                    <strong>{moneda(inversion)}</strong>
                </div>
                <div>
                    <span>Recuperado</span>
                    <strong>{moneda(resumen.inversionRecuperada)}</strong>
                </div>
                <div className="recuperacion-falta">
                    <span>{recuperada ? "Ganancia extra" : "Falta recuperar"}</span>
                    <strong>{moneda(recuperada ? excedente : falta)}</strong>
                </div>
            </div>

            <p className="ayuda-campo">
                {recuperada
                    ? "🎉 ¡Ya recuperaste toda tu inversión! Todo lo que ganes ahora es ganancia."
                    : "Se recupera con la ganancia neta: ganancia de las ventas menos los gastos."}
            </p>
        </section>
    );
}
