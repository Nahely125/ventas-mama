import { useEffect, useRef, useState } from "react";
import { moneda } from "../api.js";
import {
    describirCantidad,
    formatearFecha,
    nombreMetodoPago,
    normalizarWhatsapp,
    numeroComprobante,
    precioCobrado,
    textoComprobante
} from "../venta.js";

export default function Comprobante({ venta, onCerrar }) {
    const dialogo = useRef(null);
    const [telefono, setTelefono] = useState("");
    const [aviso, setAviso] = useState(null);

    useEffect(() => {
        dialogo.current?.showModal();
    }, []);

    function enviarWhatsapp(evento) {
        evento.preventDefault();

        const numero = normalizarWhatsapp(telefono);

        if (!numero) {
            setAviso({
                tipo: "error",
                texto: "Ingresa un número válido. Ej. 987654321 (Perú) o con código de país."
            });
            return;
        }

        setAviso(null);
        const enlace = `https://wa.me/${numero}?text=${encodeURIComponent(textoComprobante(venta))}`;
        window.open(enlace, "_blank", "noopener");
    }

    async function copiar() {
        try {
            await navigator.clipboard.writeText(textoComprobante(venta));
            setAviso({ tipo: "exito", texto: "Comprobante copiado. Ya puedes pegarlo en cualquier chat." });
        } catch {
            setAviso({ tipo: "error", texto: "No se pudo copiar el comprobante." });
        }
    }

    const porDocena = venta.modalidad === "docena";

    return (
        <dialog
            ref={dialogo}
            className="modal"
            onClose={onCerrar}
            onClick={(e) => e.target === dialogo.current && onCerrar()}
            aria-labelledby="titulo-comprobante"
        >
            <div className="modal-contenido">
                <div className="modal-encabezado">
                    <h2 id="titulo-comprobante">Comprobante de venta</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">
                        ✕
                    </button>
                </div>

                <article className="ticket">
                    <header className="ticket-encabezado">
                        <strong>Ventas Mamá</strong>
                        <span>N° {numeroComprobante(venta)}</span>
                    </header>

                    <dl className="ticket-datos">
                        <div><dt>Fecha</dt><dd>{formatearFecha(venta.fecha)}</dd></div>
                        <div><dt>Atendido por</dt><dd>{venta.vendedor}</dd></div>
                    </dl>

                    <div className="ticket-producto">
                        <strong>{venta.producto}</strong>
                        {venta.codigo && <span>Código: {venta.codigo}</span>}
                    </div>

                    <dl className="ticket-datos">
                        <div><dt>Cantidad</dt><dd>{describirCantidad(venta)}</dd></div>
                        <div>
                            <dt>Precio por {porDocena ? "docena" : "unidad"}</dt>
                            <dd>{moneda(precioCobrado(venta))}</dd>
                        </div>
                        <div><dt>Método de pago</dt><dd>{nombreMetodoPago(venta.metodoPago)}</dd></div>
                    </dl>

                    <div className="ticket-total">
                        <span>Total</span>
                        <strong>{moneda(venta.total)}</strong>
                    </div>

                    <p className="ticket-gracias">¡Gracias por su compra!</p>
                </article>

                <form className="formulario envio-whatsapp" onSubmit={enviarWhatsapp}>
                    <label htmlFor="telefono-whatsapp">Enviar por WhatsApp</label>
                    <div className="fila-whatsapp">
                        <input
                            type="tel"
                            id="telefono-whatsapp"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="Ej. 987 654 321"
                            value={telefono}
                            onChange={(e) => setTelefono(e.target.value)}
                        />
                        <button type="submit" className="boton-whatsapp">
                            Enviar
                        </button>
                    </div>
                    <span className="ayuda-campo">
                        Se abrirá WhatsApp con el comprobante listo para enviar.
                    </span>

                    {aviso && (
                        <p className={`mensaje mensaje-${aviso.tipo}`} role="status">{aviso.texto}</p>
                    )}

                    <div className="modal-acciones">
                        <button type="button" className="boton-secundario" onClick={copiar}>
                            Copiar texto
                        </button>
                        <button type="button" className="boton-principal" onClick={onCerrar}>
                            Listo
                        </button>
                    </div>
                </form>
            </div>
        </dialog>
    );
}
