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
                <div className="encabezado-seccion">
                    <h2>Alertas de inventario</h2>
                    {esJefe && alertas?.length > 0 && (
                        <button type="button" className="boton-secundario boton-pequeno" onClick={() => onIrA("compras")}>
                            🚚 Ingresar mercadería
                        </button>
                    )}
                </div>

                {errorAlertas ? (
                    <p>{errorAlertas}</p>
                ) : alertas === null ? (
                    <p>Consultando productos con stock bajo...</p>
                ) : alertas.length === 0 ? (
                    <p>¡Excelente! No hay productos con stock bajo.</p>
                ) : (
                    [
                        { titulo: "⛔ Agotados", productos: alertas.filter((p) => p.stock === 0) },
                        { titulo: "⚠️ Por acabarse", productos: alertas.filter((p) => p.stock > 0) }
                    ]
                        .filter((grupo) => grupo.productos.length > 0)
                        .map((grupo) => (
                            <div className="grupo-alertas" key={grupo.titulo}>
                                <h3>{grupo.titulo} <span>{grupo.productos.length}</span></h3>
                                <ul className="lista-alertas">
                                    {grupo.productos.map((producto) => (
                                        <li className={`alerta-producto ${producto.stock === 0 ? "agotado" : ""}`} key={producto.id}>
                                            <div>
                                                {producto.codigo && <span className="codigo-producto">{producto.codigo}</span>}
                                                <strong>{producto.nombre}</strong>
                                            </div>
                                            <span className="alerta-datos">
                                                {producto.stock === 0 ? "Sin stock" : `Quedan ${producto.stock}`}
                                                {" · "}
                                                {producto.vendidas30 > 0
                                                    ? `se vendieron ${producto.vendidas30} en 30 días`
                                                    : "sin ventas en 30 días"}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))
                )}
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
