import Resumen from "./Resumen.jsx";
import RecuperacionInversion from "./RecuperacionInversion.jsx";
import GananciaDiaria from "./GananciaDiaria.jsx";
import MasVendidos from "./MasVendidos.jsx";
import { useState } from "react";

const ALERTAS_VISIBLES = 5;

// Un grupo de alertas (agotados o por acabarse): muestra 5 y el resto con «Ver más».
function GrupoAlertas({ titulo, productos }) {
    const [todos, setTodos] = useState(false);
    const visibles = todos ? productos : productos.slice(0, ALERTAS_VISIBLES);
    const ocultos = productos.length - ALERTAS_VISIBLES;

    return (
        <div className="grupo-alertas">
            <h3>{titulo} <span>{productos.length}</span></h3>
            <ul className="lista-alertas">
                {visibles.map((producto) => (
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
            {ocultos > 0 && (
                <button
                    type="button"
                    className="boton-secundario boton-pequeno boton-ver-mas"
                    onClick={() => setTodos((actual) => !actual)}
                    aria-expanded={todos}
                >
                    {todos ? "Ver menos" : `Ver más (${ocultos})`}
                </button>
            )}
        </div>
    );
}

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
                        <button type="button" className="boton-secundario boton-pequeno" onClick={() => onIrA("reposicion")}>
                            📝 Armar lista de reposición
                        </button>
                    )}
                </div>

                {errorAlertas ? (
                    <p>{errorAlertas}</p>
                ) : alertas === null ? (
                    <p>Consultando productos con poco stock...</p>
                ) : alertas.length === 0 ? (
                    <p>¡Excelente! Todos los productos tienen 10 unidades o más.</p>
                ) : (
                    [
                        { titulo: "⛔ Agotados", productos: alertas.filter((p) => p.stock === 0) },
                        { titulo: "⚠️ Por acabarse", productos: alertas.filter((p) => p.stock > 0) }
                    ]
                        .filter((grupo) => grupo.productos.length > 0)
                        .map((grupo) => (
                            <GrupoAlertas key={grupo.titulo} titulo={grupo.titulo} productos={grupo.productos} />
                        ))
                )}
            </section>

            <MasVendidos esJefe={esJefe} onError={onError} />

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
