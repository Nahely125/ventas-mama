import { useEffect, useRef, useState } from "react";
import { generarImagenComprobante } from "../imagenComprobante.js";
import { enlaceBoleta, normalizarWhatsapp, numeroComprobante } from "../venta.js";

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
    const [telefono, setTelefono] = useState("");
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

    // Abre el chat de ese número con la boleta: el mensaje lleva el enlace a la boleta
    // en imagen y al catálogo, así el cliente la ve aunque WhatsApp no adjunte archivos por enlace.
    /* Envía la boleta EN IMAGEN al número escrito.
       WhatsApp no permite adjuntar archivos desde un enlace, así que:
       1) se copia la imagen al portapapeles y se abre el chat de ese número → solo hay que pegarla;
       2) si el teléfono no deja copiar imágenes, se abre el menú Compartir con la imagen;
       3) en computadoras sin esas opciones, se descarga y se abre el chat para adjuntarla. */
    async function enviarAlNumero(evento) {
        evento.preventDefault();

        const numero = normalizarWhatsapp(telefono);

        if (!numero) {
            setAviso({
                tipo: "error",
                texto: "Ingresa un número válido. Ej. 987654321 (Perú) o con código de país."
            });
            return;
        }

        if (!archivo) {
            setAviso({ tipo: "error", texto: "La imagen todavía se está preparando. Inténtalo en un momento." });
            return;
        }

        const saludo = `Hola 👋 Te envío tu boleta N° ${numeroComprobante(venta)} de Mil Deseos 🎁`;
        const chat = `https://wa.me/${numero}?text=${encodeURIComponent(saludo)}`;

        try {
            await navigator.clipboard.write([new ClipboardItem({ [archivo.type]: archivo })]);
            window.open(chat, "_blank", "noopener");
            setAviso({
                tipo: "exito",
                texto: "✅ Imagen copiada. En el chat que se abrió, mantén presionado el cuadro de mensaje y toca «Pegar» (en computadora: Ctrl + V)."
            });
            return;
        } catch {
            // El navegador no permite copiar imágenes: se prueba con Compartir.
        }

        if (puedeCompartirArchivos) {
            try {
                await navigator.share({ files: [archivo], text: saludo });
                setAviso({ tipo: "exito", texto: `Elige WhatsApp y busca el número ${telefono.trim()}.` });
            } catch (error) {
                if (error.name !== "AbortError") {
                    setAviso({ tipo: "error", texto: "No se pudo compartir la imagen. Prueba con «Descargar imagen»." });
                }
            }
            return;
        }

        descargar(archivo);
        window.open(chat, "_blank", "noopener");
        setAviso({
            tipo: "exito",
            texto: "La imagen se descargó. Adjúntala en el chat que se abrió (clip 📎 → Fotos)."
        });
    }

    async function compartirImagen() {
        setAviso(null);

        if (!archivo) return;

        if (!puedeCompartirArchivos) {
            descargar(archivo);
            setAviso({ tipo: "exito", texto: "Imagen descargada. Puedes adjuntarla en el chat (clip 📎 → Fotos)." });
            return;
        }

        try {
            await navigator.share({ files: [archivo], title: `Boleta N° ${numeroComprobante(venta)}` });
        } catch (error) {
            if (error.name !== "AbortError") {
                setAviso({ tipo: "error", texto: "No se pudo compartir la imagen. Prueba con «Descargar imagen»." });
            }
        }
    }

    async function copiar(texto, mensajeExito) {
        try {
            await navigator.clipboard.writeText(texto);
            setAviso({ tipo: "exito", texto: mensajeExito });
        } catch {
            setAviso({ tipo: "error", texto: "No se pudo copiar." });
        }
    }

    const enlace = enlaceBoleta(venta);

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

                <form className="formulario envio-whatsapp" onSubmit={enviarAlNumero}>
                    <div className="campo">
                        <label htmlFor="telefono-whatsapp">Número de WhatsApp del cliente</label>
                        <div className="campo-con-boton">
                            <input
                                type="tel"
                                id="telefono-whatsapp"
                                inputMode="tel"
                                autoComplete="tel"
                                placeholder="Ej. 987 654 321"
                                value={telefono}
                                onChange={(e) => setTelefono(e.target.value)}
                            />
                        </div>
                    </div>

                    <button type="submit" className="boton-whatsapp boton-whatsapp-grande">
                        📷 Enviar boleta en imagen
                    </button>
                    <span className="ayuda-campo">
                        Se copia la imagen y se abre el chat de ese número: solo tienes que pegarla y enviar.
                    </span>
                </form>

                <div className="vista-previa-comprobante">
                    {vistaPrevia ? (
                        <img src={vistaPrevia} alt={`Boleta de venta N° ${numeroComprobante(venta)}`} />
                    ) : errorImagen ? (
                        <p className="mensaje mensaje-error">No se pudo crear la imagen. Puedes enviarla como texto.</p>
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
                    <button
                        type="button"
                        className="boton-secundario boton-pequeno"
                        onClick={compartirImagen}
                        disabled={!archivo}
                    >
                        {puedeCompartirArchivos ? "📷 Compartir imagen" : "⬇️ Descargar imagen"}
                    </button>
                    {enlace && (
                        <button
                            type="button"
                            className="boton-secundario boton-pequeno"
                            onClick={() => copiar(enlace, "Enlace de la boleta copiado.")}
                        >
                            🔗 Copiar enlace
                        </button>
                    )}
                </div>

                <button type="button" className="boton-principal" onClick={onCerrar}>
                    Listo
                </button>
            </div>
        </dialog>
    );
}
