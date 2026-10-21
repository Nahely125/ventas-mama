import { moneda } from "../api.js";

/* Muestra cuánto se ha recuperado de lo invertido.
   Total invertido = inversiones registradas + gastos.
   Se recupera con la ganancia de las ventas. */
export default function RecuperacionInversion({ resumen, onRegistrar }) {
    if (!resumen) {
        return null;
    }

    const total = Number(resumen.inversionTotal ?? 0);

    if (total === 0) {
        return (
            <section className="tarjeta recuperacion recuperacion-vacia">
                <h2>Recuperación de la inversión</h2>
                <p>Todavía no registraste inversiones ni gastos. Anótalos para saber cuánto te falta recuperar.</p>
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
    const excedente = Number(resumen.gananciaTotal) - total;

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
                    <span>Total invertido</span>
                    <strong>{moneda(total)}</strong>
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

            <p className="recuperacion-desglose">
                Total invertido = inversiones <strong>{moneda(resumen.inversionesRegistradas)}</strong>
                {" + "}gastos <strong>{moneda(resumen.gastosTotales)}</strong>
            </p>

            <p className="ayuda-campo">
                {recuperada
                    ? "🎉 ¡Ya recuperaste todo lo invertido! Todo lo que ganes ahora es ganancia."
                    : "Se recupera con la ganancia de las ventas de este año (precio de venta menos costo)."}
            </p>

            {Number(resumen.ganancia2025) > 0 || Number(resumen.unidades2025) > 0 ? (
                <p className="nota-inventario-2025">
                    📦 <strong>Inventario 2025</strong> (aparte): ganancia {moneda(resumen.ganancia2025)}
                    {Number(resumen.unidades2025) > 0 && (
                        <> · quedan {resumen.unidades2025} u. por vender (aprox. {moneda(resumen.valorInventario2025)})</>
                    )}
                    . Suma a la ganancia neta, pero no a la recuperación de la inversión.
                </p>
            ) : null}
        </section>
    );
}
