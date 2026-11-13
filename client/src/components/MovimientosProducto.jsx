import { useEffect, useRef, useState } from "react";
import { pedir } from "../api.js";
import { formatearFecha } from "../venta.js";

// Cómo se muestra cada tipo de movimiento del stock.
const TIPOS = {
    registro: { icono: "🆕", texto: "Registro", grupo: "ingresos" },
    inicio: { icono: "📌", texto: "Inicio del historial", grupo: "ingresos" },
    compra: { icono: "🚚", texto: "Ingreso de mercadería", grupo: "ingresos" },
    compra_anulada: { icono: "⊘", texto: "Ingreso deshecho", grupo: "ingresos" },
    cambio: { icono: "🔁", texto: "Cambio del proveedor", grupo: "ingresos" },
    venta: { icono: "🛒", texto: "Venta", grupo: "ventas" },
    anulacion: { icono: "↩️", texto: "Venta anulada", grupo: "ventas" },
    devolucion: { icono: "↩", texto: "Devolución", grupo: "ventas" },
    ajuste: { icono: "🧮", texto: "Conteo / ajuste", grupo: "ajustes" },
    edicion: { icono: "✏️", texto: "Edición del producto", grupo: "ajustes" }
};

const FILTROS = [
    { valor: "", texto: "Todo" },
    { valor: "ventas", texto: "Ventas" },
    { valor: "ingresos", texto: "Ingresos" },
    { valor: "ajustes", texto: "Ajustes" }
];

/* Historial de movimientos del stock de un producto: cada venta, ingreso, devolución o ajuste,
   con cuánto cambió, cómo quedó el stock y quién lo hizo. */
export default function MovimientosProducto({ producto, onCerrar, onError }) {
    const dialogo = useRef(null);
    const [movimientos, setMovimientos] = useState(null);
    const [error, setError] = useState("");
    const [filtro, setFiltro] = useState("");

    useEffect(() => {
        dialogo.current?.showModal();
        pedir(`/api/productos/${producto.id}/movimientos`)
            .then(setMovimientos)
            .catch((err) => onError(err, () => setError(err.message)));
    }, [producto.id, onError]);

    const visibles = (movimientos ?? []).filter((m) => !filtro || TIPOS[m.tipo]?.grupo === filtro);

    return (
        <dialog
            ref={dialogo}
            className="modal ventana-movimientos"
            onClose={onCerrar}
            onClick={(e) => e.target === dialogo.current && onCerrar()}
            aria-labelledby="titulo-movimientos"
        >
            <div className="modal-contenido">
                <div className="modal-encabezado">
                    <h2 id="titulo-movimientos">📜 Movimientos</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">✕</button>
                </div>
                <p className="producto-movimientos">
                    <strong>{producto.nombre}</strong> · stock actual <strong>{producto.stock} u.</strong>
                </p>

                <div className="selector-modalidad selector-filtro filtro-movimientos" role="radiogroup" aria-label="Ver movimientos de">
                    {FILTROS.map((f) => (
                        <button
                            key={f.valor || "todo"}
                            type="button"
                            role="radio"
                            aria-checked={filtro === f.valor}
                            className={filtro === f.valor ? "activo" : ""}
                            onClick={() => setFiltro(f.valor)}
                        >
                            {f.texto}
                        </button>
                    ))}
                </div>

                {error ? (
                    <p className="mensaje mensaje-error">{error}</p>
                ) : movimientos === null ? (
                    <p>Cargando...</p>
                ) : visibles.length === 0 ? (
                    <p className="aviso-busqueda">No hay movimientos de este tipo.</p>
                ) : (
                    <ol className="lista-movimientos">
                        {visibles.map((m) => {
                            const tipo = TIPOS[m.tipo] ?? { icono: "•", texto: m.tipo };
                            return (
                                <li key={m.id}>
                                    <span className="movimiento-icono" aria-hidden="true">{tipo.icono}</span>
                                    <div className="movimiento-datos">
                                        <strong>{tipo.texto}</strong>
                                        {m.detalle && <span>{m.detalle}</span>}
                                        <small>
                                            {formatearFecha(m.fecha)}
                                            {m.usuario ? ` · ${m.usuario}` : ""}
                                        </small>
                                    </div>
                                    <div className="movimiento-cantidad">
                                        <strong className={m.cantidad > 0 ? "sube" : m.cantidad < 0 ? "baja" : ""}>
                                            {m.cantidad > 0 ? "+" : ""}{m.cantidad}
                                        </strong>
                                        <small>queda {m.stockResultante}</small>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </div>
        </dialog>
    );
}
