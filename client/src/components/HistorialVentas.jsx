import { moneda } from "../api.js";
import { describirCantidad, formatearFecha, nombreMetodoPago, precioCobrado } from "../venta.js";

function monedaOpcional(valor) {
    return valor == null ? "No disponible" : moneda(valor);
}

export default function HistorialVentas({ ventas, error, esJefe, textoVacio, onVerComprobante, onAnular }) {
    // Número de boleta = el id más bajo de las filas de la misma venta.
    const numeros = new Map();
    for (const venta of ventas ?? []) {
        numeros.set(venta.grupo, Math.min(numeros.get(venta.grupo) ?? Infinity, venta.id));
    }
    const boletaDe = (venta) => numeros.get(venta.grupo) ?? venta.id;

    const columnas = esJefe ? 11 : 8;
    // El botón de anular va solo en la primera fila de cada venta.
    const primeraDe = new Set();
    const esPrimera = (venta) => (primeraDe.has(venta.grupo) ? false : (primeraDe.add(venta.grupo), true));

    let filas;

    if (ventas === null) {
        filas = <tr><td colSpan={columnas}>Cargando historial de ventas...</td></tr>;
    } else if (ventas.length === 0) {
        filas = <tr><td colSpan={columnas}>{textoVacio}</td></tr>;
    } else {
        // data-etiqueta se usa en móvil para mostrar cada fila como tarjeta.
        filas = ventas.map((venta) => (
            <tr key={venta.id} className={venta.anuladaEn ? "fila-anulada" : ""}>
                <td data-etiqueta="Fecha" className="celda-fecha">{formatearFecha(venta.fecha)}</td>
                <td data-etiqueta="Producto" className="celda-producto">
                    {venta.codigo && <span className="codigo-producto">{venta.codigo}</span>}
                    {venta.producto}
                    <small className="numero-boleta">Boleta N° {String(boletaDe(venta)).padStart(6, "0")}</small>
                    {venta.cliente && <small className="numero-boleta">👤 {venta.cliente}</small>}
                    {venta.obsequio && <small className="etiqueta etiqueta-obsequio">🎁 Obsequio</small>}
                    {Number(venta.descuento) > 0 && (
                        <small className="etiqueta etiqueta-ajustado">
                            🏷️ {venta.codigoAjuste}: −{moneda(venta.descuento)}
                        </small>
                    )}
                    {venta.anuladaEn && (
                        <small className="etiqueta-anulada" title={venta.motivoAnulacion ?? ""}>
                            ANULADA · {venta.anuladaPor}: {venta.motivoAnulacion}
                        </small>
                    )}
                </td>
                <td data-etiqueta="Vendedor" className="celda-flexible">{venta.vendedor || "No registrado"}</td>
                <td data-etiqueta="Cantidad" className="celda-flexible">{describirCantidad(venta)}</td>
                <td data-etiqueta={venta.modalidad === "docena" ? "Precio docena" : "Precio unitario"}>
                    {moneda(precioCobrado(venta))}
                </td>
                <td data-etiqueta="Total" className="celda-total">{moneda(venta.total)}</td>
                <td data-etiqueta="Pago">{nombreMetodoPago(venta.metodoPago)}</td>
                {esJefe && (
                    <>
                        <td data-etiqueta="Costo por unidad">{monedaOpcional(venta.costoUnitario)}</td>
                        {/* Ganancia de este año y, aparte, la de la mercadería 2025. */}
                        <td data-etiqueta="Ganancia">
                            {venta.ganancia == null ? "No disponible" : moneda(Number(venta.ganancia) - Number(venta.ganancia2025 ?? 0))}
                        </td>
                        <td data-etiqueta="Ganancia 2025" className={Number(venta.ganancia2025) > 0 ? "celda-2025" : "celda-vacia-2025"}>
                            {Number(venta.ganancia2025) > 0 ? moneda(venta.ganancia2025) : "—"}
                        </td>
                    </>
                )}
                <td className="celda-accion">
                    <button
                        type="button"
                        className="boton-secundario boton-pequeno"
                        onClick={() => onVerComprobante(venta)}
                        aria-label={`Ver comprobante N° ${venta.id}`}
                        title="Ver comprobante"
                    >
                        <span aria-hidden="true">🧾</span>
                        <span className="texto-comprobante" aria-hidden="true"> Comprobante</span>
                    </button>
                    {onAnular && !venta.anuladaEn && esPrimera(venta) && (
                        <button
                            type="button"
                            className="boton-anular"
                            onClick={() => onAnular(venta)}
                            aria-label={`Anular venta N° ${String(boletaDe(venta)).padStart(6, "0")}`}
                            title="Anular venta"
                        >
                            ⊘
                        </button>
                    )}
                </td>
            </tr>
        ));
    }

    return (
        <section className="tarjeta historial-ventas">
            <h2>Detalle de ventas</h2>

            <div className="tabla-contenedor">
                <table className="tabla-ventas">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Producto</th>
                            <th>Vendedor</th>
                            <th>Cantidad</th>
                            <th>Precio</th>
                            <th>Total</th>
                            <th>Pago</th>
                            {esJefe && (
                                <>
                                    <th>Costo unit.</th>
                                    <th>Ganancia</th>
                                    <th>Gan. 2025</th>
                                </>
                            )}
                            <th><span className="solo-lector">Acciones</span></th>
                        </tr>
                    </thead>
                    <tbody>{filas}</tbody>
                </table>
            </div>

            {error && <p className="mensaje mensaje-error" role="status">{error}</p>}
        </section>
    );
}
