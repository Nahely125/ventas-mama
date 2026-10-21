import Resumen from "./Resumen.jsx";
import RecuperacionInversion from "./RecuperacionInversion.jsx";
import GananciaDiaria from "./GananciaDiaria.jsx";

export default function PanelControl({ esJefe, resumen, alertas, errorAlertas, onIrA, onError }) {
    return (
        <div className="contenido-vista">
            <Resumen resumen={resumen} esJefe={esJefe} />

            {esJefe && <GananciaDiaria onError={onError} />}

            {esJefe && (
                <RecuperacionInversion resumen={resumen} onRegistrar={() => onIrA("inversion")} />
            )}

            <section className="tarjeta alertas">
                <h2>Alertas de inventario</h2>

                <div className="lista-alertas">
                    {errorAlertas ? (
                        <p>{errorAlertas}</p>
                    ) : alertas === null ? (
                        <p>Consultando productos con stock bajo...</p>
                    ) : alertas.length === 0 ? (
                        <p>¡Excelente! No hay productos con stock bajo.</p>
                    ) : (
                        alertas.map((producto) => (
                            <div className="alerta-producto" key={producto.id}>
                                {producto.codigo && <span className="codigo-producto">{producto.codigo}</span>}
                                <strong>{producto.nombre}</strong>: quedan {producto.stock} unidades.
                                Debes reponer {producto.unidadesParaReponer} unidades.
                            </div>
                        ))
                    )}
                </div>
            </section>

            <section className="accesos-rapidos" aria-label="Accesos rápidos">
                <button type="button" className="acceso-rapido" onClick={() => onIrA("ventas")}>
                    <span aria-hidden="true">🛒</span>
                    <strong>Registrar venta</strong>
                </button>
                <button type="button" className="acceso-rapido" onClick={() => onIrA("historial")}>
                    <span aria-hidden="true">🧾</span>
                    <strong>Ver ventas de hoy</strong>
                </button>
                <button type="button" className="acceso-rapido" onClick={() => onIrA("inventario")}>
                    <span aria-hidden="true">📦</span>
                    <strong>Ver inventario</strong>
                </button>
                {esJefe && (
                    <button type="button" className="acceso-rapido" onClick={() => onIrA("gastos")}>
                        <span aria-hidden="true">💸</span>
                        <strong>Anotar gasto</strong>
                    </button>
                )}
            </section>
        </div>
    );
}
