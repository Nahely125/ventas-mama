import { useEffect, useRef, useState } from "react";
import { generarImagenComprobante } from "../imagenComprobante.js";
import { mensajeBoleta, normalizarWhatsapp, numeroComprobante } from "../venta.js";

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
    // Mensaje que va junto a la imagen de la boleta: gracias + información y enlace del catálogo.
    const textoImagen = mensajeBoleta(venta);
    const chatDirecto = numero ? `https://wa.me/${numero}?text=${encodeURIComponent(textoImagen)}` : null;

    /* Copia la imagen de la boleta (para pegarla en el chat). Se llama dentro del mismo toque,
       sin esperar nada antes, para que el iPhone lo permita. */
    function copiarImagen() {
        if (!archivo || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false;
        navigator.clipboard.write([new ClipboardItem({ [archivo.type]: archivo })]).catch(() => {});
        return true;
    }

    /* Enviar la boleta en imagen por WhatsApp.
       En el celular (iPhone o Android) se abre al instante la ventana de Compartir con la imagen y
       el mensaje: se toca WhatsApp y se elige al cliente. Importante: navigator.share se llama
       directamente en el toque (sin esperar nada antes), si no Safari la bloquea. */
    function enviarImagen() {
        setAviso(null);

        if (!archivo) {
            setAviso({ tipo: "error", texto: "La imagen todavía se está preparando. Inténtalo en un momento." });
            return;
        }

        if (puedeCompartirArchivos) {
            // Por si WhatsApp no pone el texto junto a la imagen, el mensaje queda copiado para pegarlo.
            navigator.clipboard?.writeText?.(textoImagen).catch(() => {});
            navigator
                .share({ files: [archivo], text: textoImagen })
                .then(() => setAviso({
                    tipo: "exito",
                    texto: "✅ Listo. La boleta va con el mensaje del catálogo. Si en WhatsApp no apareció el texto, mantén presionado el cuadro de mensaje y toca «Pegar»."
                }))
                .catch((error) => {
                    if (error.name !== "AbortError") {
                        setAviso({ tipo: "error", texto: "No se pudo abrir Compartir. Prueba con «Abrir chat del cliente»." });
                    }
                });
            return;
        }

        // Computadora sin «Compartir»: se abre el chat (en el mismo toque) y se descarga la imagen para adjuntarla.
        if (chatDirecto) window.open(chatDirecto, "_blank", "noopener");
        descargar(archivo);
        setAviso({
            tipo: "exito",
            texto: chatDirecto
                ? "La imagen se descargó y se abrió el chat. Adjúntala con el clip 📎."
                : "La imagen se descargó. Adjúntala en WhatsApp con el clip 📎."
        });
    }

    async function copiar(texto, mensajeExito) {
        try {
            await navigator.clipboard.writeText(texto);
            setAviso({ tipo: "exito", texto: mensajeExito });
        } catch {
            setAviso({ tipo: "error", texto: "No se pudo copiar." });
        }
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
                    <h2 id="titulo-comprobante">Boleta de venta</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">
                        ✕
                    </button>
                </div>

                <div className="formulario envio-whatsapp">
                    <button
                        type="button"
                        className="boton-whatsapp boton-whatsapp-grande"
                        onClick={enviarImagen}
                        disabled={!archivo}
                    >
                        {archivo ? "📲 Enviar boleta por WhatsApp" : "Preparando la boleta..."}
                    </button>
                    <span className="ayuda-campo">
                        {puedeCompartirArchivos || !archivo
                            ? "Se abre la ventana de Compartir con la boleta y el mensaje del catálogo: toca WhatsApp y elige al cliente."
                            : "Se descarga la imagen para adjuntarla en WhatsApp."}
                    </span>

                    <div className="campo campo-chat-directo">
                        <label htmlFor="telefono-whatsapp">O ábrele el chat directo (número del cliente)</label>
                        <input
                            type="tel"
                            id="telefono-whatsapp"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="Ej. 987 654 321"
                            value={telefono}
                            onChange={(e) => setTelefono(e.target.value)}
                        />
                        {/* Es un enlace (no un botón con espera): el iPhone lo abre directo en WhatsApp.
                            Al tocarlo se copia la imagen de la boleta para pegarla en ese chat. */}
                        {chatDirecto ? (
                            <a
                                className="boton-secundario boton-chat-directo"
                                href={chatDirecto}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => {
                                    const copiada = copiarImagen();
                                    setAviso({
                                        tipo: "exito",
                                        texto: copiada
                                            ? "Se abrió el chat con el mensaje del catálogo y la boleta quedó copiada: envía el mensaje y luego mantén presionado el cuadro de mensaje → «Pegar» para enviar la imagen."
                                            : "Se abrió el chat con el mensaje del catálogo. Para la imagen, usa «Enviar boleta por WhatsApp»."
                                    });
                                }}
                            >
                                💬 Abrir chat de {telefono.trim()}
                            </a>
                        ) : (
                            telefono.trim() && <span className="ayuda-campo texto-aviso">Revisa el número: 9 dígitos (Perú) o con código de país.</span>
                        )}
                        <span className="ayuda-campo">Se abre el chat con el mensaje del catálogo y la imagen de la boleta queda copiada para pegarla.</span>
                    </div>
                </div>

                <div className="vista-previa-comprobante">
                    {vistaPrevia ? (
                        <img src={vistaPrevia} alt={`Boleta de venta N° ${numeroComprobante(venta)}`} />
                    ) : errorImagen ? (
                        <p className="mensaje mensaje-error">No se pudo crear la imagen de la boleta. Cierra y vuelve a abrirla.</p>
                    ) : (
                        <p className="cargando-imagen">
                            <span className="spinner" aria-hidden="true"></span> Preparando imagen...
                        </p>
                    )}
                </div>

                {aviso && (
                    <p className={`mensaje mensaje-${aviso.tipo}`} role="status">{aviso.texto}</p>
                )}

                <div className="acciones-comprobante">
                    {archivo && !puedeCompartirArchivos && (
                        <button type="button" className="boton-secundario boton-pequeno" onClick={() => descargar(archivo)}>
                            ⬇️ Descargar imagen
                        </button>
                    )}
                    <button
                        type="button"
                        className="boton-secundario boton-pequeno"
                        onClick={() => copiar(textoImagen, "Mensaje del catálogo copiado.")}
                    >
                        📋 Copiar mensaje del catálogo
                    </button>
                </div>

                <button type="button" className="boton-principal" onClick={onCerrar}>
                    Listo
                </button>
            </div>
        </dialog>
    );
}
