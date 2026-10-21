import { moneda } from "../api.js";
import { describirCantidad, formatearFecha, nombreMetodoPago, precioCobrado } from "../venta.js";

function monedaOpcional(valor) {
    return valor == null ? "No disponible" : moneda(valor);
}

export default function HistorialVentas({ ventas, error, esJefe, textoVacio, onVerComprobante }) {
    // Número de boleta = el id más bajo de las filas de la misma venta.
    const numeros = new Map();
    for (const venta of ventas ?? []) {
        numeros.set(venta.grupo, Math.min(numeros.get(venta.grupo) ?? Infinity, venta.id));
    }
    const boletaDe = (venta) => numeros.get(venta.grupo) ?? venta.id;

    const columnas = esJefe ? 10 : 8;

    let filas;

    if (ventas === null) {
        filas = <tr><td colSpan={columnas}>Cargando historial de ventas...</td></tr>;
    } else if (ventas.length === 0) {
        filas = <tr><td colSpan={columnas}>{textoVacio}</td></tr>;
    } else {
        // data-etiqueta se usa en móvil para mostrar cada fila como tarjeta.
        filas = ventas.map((venta) => (
            <tr key={venta.id}>
                <td data-etiqueta="Fecha" className="celda-fecha">{formatearFecha(venta.fecha)}</td>
                <td data-etiqueta="Producto" className="celda-producto">
                    {venta.codigo && <span className="codigo-producto">{venta.codigo}</span>}
                    {venta.producto}
                    <small className="numero-boleta">Boleta N° {String(boletaDe(venta)).padStart(6, "0")}</small>
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
                        <td data-etiqueta="Ganancia">{monedaOpcional(venta.ganancia)}</td>
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
