import { useEffect, useRef, useState } from "react";
import { moneda, pedir } from "../api.js";
import { formatearFecha } from "../venta.js";
import { MiniFoto } from "./BuscadorProducto.jsx";

/* Papelera del inventario: los productos «eliminados» quedan aquí ocultos y se pueden
   restaurar con un toque (vuelven con su stock, fotos, colores e historial). */
export default function Papelera({ onCambio, onError, onCerrar }) {
    const dialogo = useRef(null);
    const [productos, setProductos] = useState(null);
    const [trabajando, setTrabajando] = useState(null); // id del producto en curso
    const [mensaje, setMensaje] = useState(null);

    async function cargar() {
        try {
            setProductos(await pedir("/api/productos/papelera"));
        } catch (error) {
            onError(error, () => setMensaje({ tipo: "error", texto: error.message }));
        }
    }

    useEffect(() => {
        dialogo.current?.showModal();
        cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function restaurar(producto) {
        setTrabajando(producto.id);
        try {
            const resultado = await pedir(`/api/productos/${producto.id}/restaurar`, { method: "POST" });
            setMensaje({ tipo: "exito", texto: resultado.mensaje });
            await Promise.all([cargar(), onCambio()]);
        } catch (error) {
            onError(error, () => setMensaje({ tipo: "error", texto: error.message }));
        } finally {
            setTrabajando(null);
        }
    }

    async function borrarParaSiempre(producto) {
        if (!confirm(`¿Borrar "${producto.nombre}" para siempre? Esto no se puede deshacer.`)) return;

        setTrabajando(producto.id);
        try {
            const resultado = await pedir(`/api/productos/${producto.id}/definitivo`, { method: "DELETE" });
            setMensaje({ tipo: "exito", texto: resultado.mensaje });
            await cargar();
        } catch (error) {
            onError(error, () => setMensaje({ tipo: "error", texto: error.message }));
        } finally {
            setTrabajando(null);
        }
    }

    return (
        <dialog
            ref={dialogo}
            className="modal papelera"
            onClose={onCerrar}
            onClick={(e) => e.target === dialogo.current && onCerrar()}
            aria-labelledby="titulo-papelera"
        >
            <div className="modal-contenido">
                <div className="modal-encabezado">
                    <h2 id="titulo-papelera">🗑️ Papelera</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">✕</button>
                </div>

                <p className="ayuda-campo">
                    Los productos eliminados no se ven en el inventario, las ventas ni el catálogo.
                    Con «Restaurar» vuelven tal cual estaban.
                </p>

                {mensaje && <p className={`mensaje mensaje-${mensaje.tipo}`} role="status">{mensaje.texto}</p>}

                {productos === null ? (
                    <p>Cargando la papelera...</p>
                ) : productos.length === 0 ? (
                    <p className="papelera-vacia">La papelera está vacía.</p>
                ) : (
                    <ul className="lista-papelera">
                        {productos.map((producto) => (
                            <li key={producto.id}>
                                <MiniFoto producto={producto} />
                                <div className="papelera-datos">
                                    <strong>{producto.nombre}</strong>
                                    <small>
                                        {producto.codigo ? `${producto.codigo} · ` : ""}
                                        {moneda(producto.precio)} · {producto.stock} u.
                                    </small>
                                    <small>
                                        Eliminado {formatearFecha(producto.eliminadoEn)}
                                        {producto.eliminadoPor ? ` por ${producto.eliminadoPor}` : ""}
                                    </small>
                                </div>
                                <div className="papelera-acciones">
                                    <button
                                        type="button"
                                        className="boton-principal boton-pequeno"
                                        onClick={() => restaurar(producto)}
                                        disabled={trabajando !== null}
                                    >
                                        {trabajando === producto.id ? "..." : "↩ Restaurar"}
                                    </button>
                                    {!producto.tieneVentas && (
                                        <button
                                            type="button"
                                            className="boton-enlace boton-borrar-siempre"
                                            onClick={() => borrarParaSiempre(producto)}
                                            disabled={trabajando !== null}
                                        >
                                            Borrar para siempre
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <button type="button" className="boton-secundario" onClick={onCerrar}>
                    Cerrar
                </button>
            </div>
        </dialog>
    );
}
