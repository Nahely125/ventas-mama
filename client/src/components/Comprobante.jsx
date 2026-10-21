import { useEffect, useRef, useState } from "react";
import { generarImagenComprobante } from "../imagenComprobante.js";
import { enlaceBoleta, normalizarWhatsapp, numeroComprobante, textoComprobante } from "../venta.js";

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

export default function Comprobante({ venta, onCerrar }) {
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
    function enviarAlNumero(evento) {
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
        window.open(
            `https://wa.me/${numero}?text=${encodeURIComponent(textoComprobante(venta))}`,
            "_blank",
            "noopener"
        );
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
                        💬 Enviar boleta a este número
                    </button>
                    <span className="ayuda-campo">
                        Se abre el chat de ese número con la boleta y el enlace para verla en imagen y al catálogo.
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
                    <button
                        type="button"
                        className="boton-secundario boton-pequeno"
                        onClick={() => copiar(textoComprobante(venta), "Boleta copiada como texto.")}
                    >
                        📋 Copiar texto
                    </button>
                </div>

                <button type="button" className="boton-principal" onClick={onCerrar}>
                    Listo
                </button>
            </div>
        </dialog>
    );
}
