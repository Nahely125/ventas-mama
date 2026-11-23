import { useEffect, useRef, useState } from "react";
import { generarImagenComprobante } from "../imagenComprobante.js";
import { useSecciones } from "../secciones.js";
import { campanaActual, mensajeBoleta, normalizarWhatsapp, numeroComprobante } from "../venta.js";

function descargar(archivo) {
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = archivo.name;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// boleta: { numero, grupo, fecha, vendedor, metodoPago, total, items[] }
export default function Comprobante({ boleta: venta, onCerrar }) {
    const dialogo = useRef(null);
    const [archivo, setArchivo] = useState(null);
    const [vistaPrevia, setVistaPrevia] = useState("");
    const [errorImagen, setErrorImagen] = useState(false);
    // Si la venta tiene cliente, su número ya aparece escrito (sin el 51 de Perú).
    const [telefono, setTelefono] = useState(() => (venta.clienteTelefono ?? "").replace(/^51(?=9\d{8}$)/, ""));
    const [aviso, setAviso] = useState(null);
    // Campaña actual (la feria visible en el catálogo): el mensaje solo habla de ella.
    const campana = campanaActual(useSecciones());

    useEffect(() => {
        dialogo.current?.showModal();
    }, []);

    // La imagen se prepara al abrir, para poder compartirla en cuanto se toque el botón.
    useEffect(() => {
        let cancelado = false;
        let url = "";

        generarImagenComprobante(venta)
            .then((imagen) => {
                if (cancelado) return;
                url = URL.createObjectURL(imagen);
                setArchivo(imagen);
                setVistaPrevia(url);
            })
            .catch((error) => {
                console.error(error);
                if (!cancelado) setErrorImagen(true);
            });

        return () => {
            cancelado = true;
            if (url) URL.revokeObjectURL(url);
        };
    }, [venta]);

    const puedeCompartirArchivos = Boolean(
        archivo && navigator.canShare && navigator.canShare({ files: [archivo] })
    );

    const numero = normalizarWhatsapp(telefono);
    // Junto a la imagen: gracias + la campaña actual y el catálogo.
    const textoImagen = mensajeBoleta(venta, { campana });
    // Al chat directo no se le puede adjuntar la imagen: va el enlace para ver la boleta.
    const chatDirecto = numero
        ? `https://wa.me/${numero}?text=${encodeURIComponent(mensajeBoleta(venta, { campana, conEnlace: true }))}`
        : null;

    /* Envía la imagen de la boleta por WhatsApp: en el celular se abre al instante la ventana de
       Compartir con la imagen y el mensaje; se toca WhatsApp y se elige al cliente.
       navigator.share se llama directo en el toque (sin esperar nada antes): si no, Safari la bloquea. */
    function enviarImagen() {
        setAviso(null);
        if (!archivo) return;

        if (puedeCompartirArchivos) {
            navigator.share({ files: [archivo], text: textoImagen }).catch((error) => {
                if (error.name !== "AbortError") {
                    setAviso({ tipo: "error", texto: "No se pudo abrir WhatsApp. Prueba enviándola al número del cliente." });
                }
            });
            return;
        }

        // Computadora sin «Compartir»: se descarga la imagen para adjuntarla.
        descargar(archivo);
        setAviso({ tipo: "exito", texto: "La imagen se descargó. Adjúntala en WhatsApp con el clip 📎." });
    }

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
                    <h2 id="titulo-comprobante">Boleta N° {numeroComprobante(venta)}</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">
                        ✕
                    </button>
                </div>

                <div className="vista-previa-comprobante">
                    {vistaPrevia ? (
                        <img src={vistaPrevia} alt={`Boleta de venta N° ${numeroComprobante(venta)}`} />
                    ) : errorImagen ? (
                        <p className="mensaje mensaje-error">No se pudo crear la imagen de la boleta. Ciérrala y vuelve a abrirla.</p>
                    ) : (
                        <p className="cargando-imagen">
                            <span className="spinner" aria-hidden="true"></span> Preparando la boleta...
                        </p>
                    )}
                </div>

                <button
                    type="button"
                    className="boton-whatsapp boton-whatsapp-grande"
                    onClick={enviarImagen}
                    disabled={!archivo}
                >
                    {archivo
                        ? puedeCompartirArchivos ? "📲 Enviar boleta por WhatsApp" : "⬇️ Descargar boleta"
                        : "Preparando la boleta..."}
                </button>

                <div className="envio-numero">
                    <label htmlFor="telefono-whatsapp">O envíala al número del cliente</label>
                    <div className="envio-numero-fila">
                        <input
                            type="tel"
                            id="telefono-whatsapp"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="987 654 321"
                            value={telefono}
                            onChange={(e) => setTelefono(e.target.value)}
                        />
                        {/* Enlace directo (sin esperas): el iPhone abre ese chat de WhatsApp al instante. */}
                        <a
                            className={`boton-secundario boton-chat-directo ${chatDirecto ? "" : "inactivo"}`}
                            href={chatDirecto ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-disabled={!chatDirecto}
                            onClick={(e) => !chatDirecto && e.preventDefault()}
                        >
                            💬 Abrir chat
                        </a>
                    </div>
                    <span className="ayuda-campo">Le llega el mensaje con el enlace para ver su boleta.</span>
                </div>

                {aviso && (
                    <p className={`mensaje mensaje-${aviso.tipo}`} role="status">{aviso.texto}</p>
                )}

                <button type="button" className="boton-enlace boton-listo-comprobante" onClick={onCerrar}>
                    Listo
                </button>
            </div>
        </dialog>
    );
}
