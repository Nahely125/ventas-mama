import { useState } from "react";
import { moneda, monedaCosto } from "../api.js";
import { RECARGO_TARJETA, cobroConTarjeta } from "../datosPago.js";
import { describirCantidad, formatearFecha, importeItem, numeroComprobante, precioCobrado, textoPago } from "../venta.js";

// Ventas (boletas) que se ven al inicio; el resto con «Ver más».
const VENTAS_VISIBLES = 5;

/* Agrupa las filas (una por producto) en boletas, en el orden en que llegan.
   Número de boleta = el id más bajo de sus filas. */
function agruparBoletas(ventas) {
    const porGrupo = new Map();

    for (const fila of ventas) {
        const clave = fila.grupo ?? fila.id;
        if (!porGrupo.has(clave)) porGrupo.set(clave, []);
        porGrupo.get(clave).push(fila);
    }

    return [...porGrupo.entries()].map(([clave, filas]) => {
        const vigentes = filas.filter((f) => !f.anuladaEn);
        const cuentan = vigentes.length > 0 ? vigentes : filas;
        const suma = (campo) => cuentan.reduce((total, f) => total + Number(f[campo] ?? 0), 0);

        return {
            clave,
            numero: Math.min(...filas.map((f) => f.id)),
            primera: filas[0],
            filas,
            anulada: vigentes.length === 0,
            total: suma("total"),
            descuento: suma("descuento"),
            ganancia: cuentan.some((f) => f.ganancia == null) ? null : suma("ganancia") - suma("ganancia2025"),
            ganancia2025: suma("ganancia2025"),
            piezas: cuentan.reduce((total, f) => total + Number(f.cantidad), 0)
        };
    });
}

export default function HistorialVentas({
    ventas, error, esJefe, textoVacio, onVerComprobante, onAnular, onDevolver, hayMas = false, cargandoMas = false, onCargarMas
}) {
    const [verTodas, setVerTodas] = useState(false);
    const boletas = agruparBoletas(ventas ?? []);
    const visibles = verTodas ? boletas : boletas.slice(0, VENTAS_VISIBLES);
    const ocultas = boletas.length - visibles.length;

    return (
        <section className="tarjeta historial-ventas">
            <h2>Detalle de ventas</h2>

            {ventas === null ? (
                <p>Cargando historial de ventas...</p>
            ) : boletas.length === 0 ? (
                <p>{textoVacio}</p>
            ) : (
                <ul className="lista-boletas">
                    {visibles.map((boleta) => {
                        const { primera } = boleta;
                        const tarjeta = primera.metodoPago === "tarjeta" ? cobroConTarjeta(boleta.total) : null;

                        return (
                            <li key={boleta.clave} className={`boleta-historial ${boleta.anulada ? "anulada" : ""}`}>
                                <div className="boleta-cabecera">
                                    <div>
                                        <strong className="boleta-numero">Boleta N° {numeroComprobante({ numero: boleta.numero })}</strong>
                                        <small>{formatearFecha(primera.fecha)}</small>
                                    </div>
                                    <div className="boleta-total">
                                        <strong>{moneda(boleta.total)}</strong>
                                        <small>{boleta.piezas} {boleta.piezas === 1 ? "pieza" : "piezas"}</small>
                                    </div>
                                </div>

                                <p className="boleta-personas">
                                    <span>🧑‍💼 Atendió: <strong>{primera.vendedor || "No registrado"}</strong></span>
                                    {primera.cliente && <span>👤 {primera.cliente}</span>}
                                </p>

                                {boleta.anulada && (
                                    <p className="etiqueta-anulada" title={primera.motivoAnulacion ?? ""}>
                                        ANULADA · {primera.anuladaPor}: {primera.motivoAnulacion}
                                    </p>
                                )}

                                <ul className="boleta-productos">
                                    {boleta.filas.map((fila) => (
                                        <li key={fila.id} className={fila.anuladaEn ? "producto-anulado" : ""}>
                                            <div className="boleta-producto-datos">
                                                <span>
                                                    {fila.codigo && <span className="codigo-producto">{fila.codigo}</span>}
                                                    {fila.producto}
                                                </span>
                                                <small>
                                                    {describirCantidad(fila)}
                                                    {fila.obsequio ? " · 🎁 Obsequio" : ` × ${moneda(precioCobrado(fila))}`}
                                                    {fila.unidadesDevueltas > 0 && ` · ↩ ${fila.unidadesDevueltas} devueltas`}
                                                    {fila.anuladaEn && !boleta.anulada && " · devuelto"}
                                                </small>
                                            </div>
                                            <span className="boleta-producto-importe">
                                                {fila.obsequio ? "Gratis" : moneda(importeItem(fila))}
                                            </span>
                                            {onDevolver && !fila.anuladaEn && (
                                                <button
                                                    type="button"
                                                    className="boton-anular boton-devolver"
                                                    onClick={() => onDevolver(fila)}
                                                    aria-label={`Devolver unidades de ${fila.producto}`}
                                                    title="Devolver unidades de este producto"
                                                >
                                                    ↩
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>

                                <dl className="boleta-resumen">
                                    {boleta.descuento > 0 && (
                                        <div>
                                            <dt>🏷️ {primera.codigoAjuste || "Descuento"}</dt>
                                            <dd>− {moneda(boleta.descuento)}</dd>
                                        </div>
                                    )}
                                    <div>
                                        <dt>Pago</dt>
                                        <dd>{textoPago(primera)}</dd>
                                    </div>
                                    {tarjeta && (
                                        <div>
                                            <dt>Con recargo Izipay ({RECARGO_TARJETA}%)</dt>
                                            <dd>{moneda(tarjeta.cobrar)}</dd>
                                        </div>
                                    )}
                                    {esJefe && (
                                        <div>
                                            <dt>Ganancia</dt>
                                            <dd>
                                                {boleta.ganancia == null ? "No disponible" : moneda(boleta.ganancia)}
                                                {boleta.ganancia2025 > 0 && <small> + {moneda(boleta.ganancia2025)} del 2025</small>}
                                            </dd>
                                        </div>
                                    )}
                                    {esJefe && primera.costoUnitario != null && boleta.filas.length === 1 && (
                                        <div>
                                            <dt>Costo por unidad</dt>
                                            <dd>{monedaCosto(primera.costoUnitario)}</dd>
                                        </div>
                                    )}
                                </dl>

                                <div className="boleta-acciones">
                                    <button
                                        type="button"
                                        className="boton-secundario boton-pequeno"
                                        onClick={() => onVerComprobante(primera)}
                                    >
                                        🧾 Ver / enviar boleta
                                    </button>
                                    {onAnular && !boleta.anulada && (
                                        <button
                                            type="button"
                                            className="boton-anular"
                                            onClick={() => onAnular(primera)}
                                            aria-label={`Anular venta N° ${numeroComprobante({ numero: boleta.numero })}`}
                                            title="Anular venta"
                                        >
                                            ⊘
                                        </button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {ocultas > 0 ? (
                <button type="button" className="boton-secundario boton-ver-mas-ventas" onClick={() => setVerTodas(true)}>
                    Ver más ({ocultas} {ocultas === 1 ? "venta" : "ventas"}{hayMas ? " y más" : ""})
                </button>
            ) : verTodas && boletas.length > VENTAS_VISIBLES ? (
                <div className="acciones-ver-mas-ventas">
                    {hayMas && onCargarMas && (
                        <button type="button" className="boton-secundario" onClick={onCargarMas} disabled={cargandoMas}>
                            {cargandoMas ? "Cargando..." : "Cargar más ventas"}
                        </button>
                    )}
                    <button type="button" className="boton-enlace" onClick={() => setVerTodas(false)}>
                        Ver menos
                    </button>
                </div>
            ) : hayMas && onCargarMas ? (
                <button type="button" className="boton-secundario boton-ver-mas-ventas" onClick={() => { setVerTodas(true); onCargarMas(); }} disabled={cargandoMas}>
                    {cargandoMas ? "Cargando..." : "Ver más"}
                </button>
            ) : null}

            {error && <p className="mensaje mensaje-error" role="status">{error}</p>}
        </section>
    );
}
