import { useEffect, useRef, useState } from "react";
import { moneda } from "../api.js";
import { urlFoto } from "../fotos.js";
import { WHATSAPP_NEGOCIO } from "../datosPago.js";
import { nombreModalidad } from "../venta.js";

const CLAVE_GUARDADO = "mil-deseos-pedido";
const MAXIMO = 999;

// Carrito del catálogo: [{ id, cantidad, modalidad }] guardado en este navegador
// (si el navegador no deja guardar, funciona igual mientras la página esté abierta).
export function useCarrito() {
    const [lineas, setLineas] = useState(() => {
        try {
            const guardado = JSON.parse(localStorage.getItem(CLAVE_GUARDADO) ?? "[]");
            return Array.isArray(guardado) ? guardado : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(lineas));
        } catch {
            // Sin almacenamiento: el pedido solo dura mientras la página esté abierta.
        }
    }, [lineas]);

    const cambiar = (id, modalidad, cambios) =>
        setLineas((anteriores) =>
            anteriores.map((l) => (l.id === id && l.modalidad === modalidad ? { ...l, ...cambios } : l))
        );

    return {
        lineas,
        agregar(producto, modalidad = "unidad", cantidad = 1) {
            setLineas((anteriores) => {
                const existe = anteriores.find((l) => l.id === producto.id && l.modalidad === modalidad);
                return existe
                    ? anteriores.map((l) => (l === existe ? { ...l, cantidad: Math.min(l.cantidad + cantidad, MAXIMO) } : l))
                    : [...anteriores, { id: producto.id, modalidad, cantidad }];
            });
        },
        cantidad(id, modalidad, valor) {
            cambiar(id, modalidad, { cantidad: Math.min(Math.max(1, valor), MAXIMO) });
        },
        modalidad(id, anterior, nueva) {
            setLineas((anteriores) => {
                const destino = anteriores.find((l) => l.id === id && l.modalidad === nueva);
                const origen = anteriores.find((l) => l.id === id && l.modalidad === anterior);
                if (!origen) return anteriores;
                // Si ya estaba por esa modalidad, se juntan.
                if (destino) {
                    return anteriores
                        .filter((l) => l !== origen)
                        .map((l) => (l === destino ? { ...l, cantidad: Math.min(l.cantidad + origen.cantidad, MAXIMO) } : l));
                }
                return anteriores.map((l) => (l === origen ? { ...l, modalidad: nueva } : l));
            });
        },
        quitar(id, modalidad) {
            setLineas((anteriores) => anteriores.filter((l) => !(l.id === id && l.modalidad === modalidad)));
        },
        vaciar() {
            setLineas([]);
        }
    };
}

// Precio del catálogo por unidad, media docena (mitad de la docena) o docena.
export function precioCatalogo(producto, modalidad) {
    if (modalidad === "docena") return Number(producto.precioMinimoDocena);
    if (modalidad === "media") return Number((Number(producto.precioMinimoDocena) / 2).toFixed(2));
    return Number(producto.precioMinimo);
}

const precioLinea = precioCatalogo;

// Une cada línea con los datos actuales del producto (deja fuera los que ya no están en el catálogo).
export function detalleCarrito(lineas, productos) {
    const items = lineas
        .map((linea) => {
            const producto = productos.find((p) => p.id === linea.id);
            return producto ? { ...linea, producto, importe: precioLinea(producto, linea.modalidad) * linea.cantidad } : null;
        })
        .filter(Boolean);

    return {
        items,
        total: items.reduce((suma, item) => suma + item.importe, 0),
        piezas: items.reduce((suma, item) => suma + item.cantidad, 0)
    };
}

function enlacePedido(items, total) {
    const mensaje = [
        "Hola Mil Deseos 👋 Quiero hacer este pedido:",
        ...items.map((item) => {
            const cuanto = `${item.cantidad} ${nombreModalidad(item.modalidad, item.cantidad)}`;
            const codigo = item.producto.codigo ? ` (código ${item.producto.codigo})` : "";
            return `• ${cuanto} de ${item.producto.nombre}${codigo} — ${moneda(item.importe)}`;
        }),
        `Total aproximado: ${moneda(total)}`,
        "¿Me confirman la disponibilidad?",
        `Lo armé en el catálogo: ${window.location.origin}/catalogo`
    ].join("\n");

    return `https://wa.me/${WHATSAPP_NEGOCIO}?text=${encodeURIComponent(mensaje)}`;
}

// Ventana con el pedido: cantidades, unidad, media docena o docena, total y envío por WhatsApp.
export default function CarritoCatalogo({ carrito, productos, onCerrar }) {
    const dialogo = useRef(null);
    const { items, total } = detalleCarrito(carrito.lineas, productos);

    useEffect(() => {
        dialogo.current?.showModal();
    }, []);

    return (
        <dialog
            ref={dialogo}
            className="modal cat-carrito"
            onClose={onCerrar}
            onClick={(e) => e.target === dialogo.current && onCerrar()}
            aria-labelledby="titulo-carrito-catalogo"
        >
            <div className="cat-carrito-contenido">
                <div className="cat-carrito-encabezado">
                    <h2 id="titulo-carrito-catalogo">Mi pedido</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">
                        ✕
                    </button>
                </div>

                {items.length === 0 ? (
                    <div className="cat-carrito-vacio">
                        <p>Tu pedido está vacío.</p>
                        <p>Toca «Agregar» en los productos que quieras y luego envíanos el pedido por WhatsApp.</p>
                        <button type="button" className="cat-boton-oscuro" onClick={onCerrar}>
                            Seguir viendo
                        </button>
                    </div>
                ) : (
                    <>
                        <ul className="cat-carrito-lista">
                            {items.map((item) => {
                                const foto = urlFoto(item.producto);
                                const clave = `${item.id}-${item.modalidad}`;

                                return (
                                    <li key={clave} className="cat-carrito-item">
                                        <span className="cat-carrito-foto">
                                            {foto ? <img src={foto} alt="" /> : <span aria-hidden="true">✦</span>}
                                        </span>
                                        <div className="cat-carrito-datos">
                                            <strong>{item.producto.nombre}</strong>
                                            <span className="cat-carrito-precio">
                                                {moneda(precioLinea(item.producto, item.modalidad))}{" "}
                                                {item.modalidad === "unidad" ? "c/u" : `la ${nombreModalidad(item.modalidad)}`}
                                                {!item.producto.disponible && <em> · Agotado por ahora</em>}
                                            </span>
                                            <div className="cat-carrito-controles">
                                                <div className="cat-cantidad" role="group" aria-label={`Cantidad de ${item.producto.nombre}`}>
                                                    <button
                                                        type="button"
                                                        onClick={() => carrito.cantidad(item.id, item.modalidad, item.cantidad - 1)}
                                                        disabled={item.cantidad <= 1}
                                                        aria-label="Quitar uno"
                                                    >
                                                        −
                                                    </button>
                                                    <span aria-live="polite">{item.cantidad}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => carrito.cantidad(item.id, item.modalidad, item.cantidad + 1)}
                                                        aria-label="Agregar uno"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                <select
                                                    value={item.modalidad}
                                                    onChange={(e) => carrito.modalidad(item.id, item.modalidad, e.target.value)}
                                                    aria-label="Por unidad, media docena o docena"
                                                >
                                                    <option value="unidad">{item.cantidad === 1 ? "unidad" : "unidades"}</option>
                                                    <option value="media">{nombreModalidad("media", item.cantidad)}</option>
                                                    <option value="docena">{item.cantidad === 1 ? "docena" : "docenas"}</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="cat-carrito-fin">
                                            <strong>{moneda(item.importe)}</strong>
                                            <button
                                                type="button"
                                                className="cat-carrito-quitar"
                                                onClick={() => carrito.quitar(item.id, item.modalidad)}
                                                aria-label={`Quitar ${item.producto.nombre} del pedido`}
                                            >
                                                Quitar
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="cat-carrito-total">
                            <span>Total aproximado</span>
                            <strong>{moneda(total)}</strong>
                        </div>
                        <p className="cat-carrito-nota">Te confirmamos la disponibilidad y el total por WhatsApp.</p>

                        <a className="cat-pedir cat-pedir-grande" href={enlacePedido(items, total)} target="_blank" rel="noopener">
                            <span aria-hidden="true">💬</span> Enviar pedido por WhatsApp
                        </a>
                        <button
                            type="button"
                            className="cat-carrito-vaciar"
                            onClick={() => confirm("¿Vaciar todo el pedido?") && carrito.vaciar()}
                        >
                            Vaciar pedido
                        </button>
                    </>
                )}
            </div>
        </dialog>
    );
}
