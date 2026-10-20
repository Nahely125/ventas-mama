import { useEffect, useRef, useState } from "react";
import { generarImagenComprobante } from "../imagenComprobante.js";
import { normalizarWhatsapp, numeroComprobante, textoComprobante } from "../venta.js";

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

    async function enviarImagen() {
        setAviso(null);

        if (!archivo) return;

        // Celulares: abre el menú "Compartir" con la imagen; ahí se elige WhatsApp y el contacto.
        if (puedeCompartirArchivos) {
            try {
                await navigator.share({
                    files: [archivo],
                    title: `Comprobante N° ${numeroComprobante(venta)}`
                });
            } catch (error) {
                if (error.name !== "AbortError") {
                    setAviso({ tipo: "error", texto: "No se pudo compartir la imagen. Prueba con «Descargar imagen»." });
                }
            }
            return;
        }

        // Computadoras: se descarga la imagen y se abre el chat para adjuntarla.
        const numero = normalizarWhatsapp(telefono);

        if (!numero) {
            setAviso({
                tipo: "error",
                texto: "Escribe el número de WhatsApp del cliente para abrir su chat."
            });
            return;
        }

        descargar(archivo);
        window.open(
            `https://wa.me/${numero}?text=${encodeURIComponent(`Hola, te envío tu comprobante de compra N° ${numeroComprobante(venta)} de Ventas Mamá.`)}`,
            "_blank",
            "noopener"
        );
        setAviso({
            tipo: "exito",
            texto: "La imagen se descargó. Adjúntala en el chat de WhatsApp que se abrió (clip 📎 → Fotos)."
        });
    }

    function enviarTexto() {
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

    async function copiarTexto() {
        try {
            await navigator.clipboard.writeText(textoComprobante(venta));
            setAviso({ tipo: "exito", texto: "Comprobante copiado como texto." });
        } catch {
            setAviso({ tipo: "error", texto: "No se pudo copiar el comprobante." });
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
                    <h2 id="titulo-comprobante">Comprobante de venta</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">
                        ✕
                    </button>
                </div>

                <div className="vista-previa-comprobante">
                    {vistaPrevia ? (
                        <img src={vistaPrevia} alt={`Comprobante de venta N° ${numeroComprobante(venta)}`} />
                    ) : errorImagen ? (
                        <p className="mensaje mensaje-error">No se pudo crear la imagen. Puedes enviarlo como texto.</p>
                    ) : (
                        <p className="cargando-imagen">
                            <span className="spinner" aria-hidden="true"></span> Preparando imagen...
                        </p>
                    )}
                </div>

                <div className="formulario envio-whatsapp">
                    {!puedeCompartirArchivos && (
                        <div className="campo">
                            <label htmlFor="telefono-whatsapp">WhatsApp del cliente</label>
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
                    )}

                    <button
                        type="button"
                        className="boton-whatsapp boton-whatsapp-grande"
                        onClick={enviarImagen}
                        disabled={!archivo}
                    >
                        📷 Enviar imagen por WhatsApp
                    </button>

                    <span className="ayuda-campo">
                        {puedeCompartirArchivos
                            ? "Se abrirá el menú Compartir: elige WhatsApp y luego el contacto del cliente."
                            : "Se descargará la imagen y se abrirá el chat del cliente para que la adjuntes."}
                    </span>

                    {aviso && (
                        <p className={`mensaje mensaje-${aviso.tipo}`} role="status">{aviso.texto}</p>
                    )}

                    <div className="acciones-comprobante">
                        <button
                            type="button"
                            className="boton-secundario boton-pequeno"
                            onClick={() => archivo && descargar(archivo)}
                            disabled={!archivo}
                        >
                            ⬇️ Descargar imagen
                        </button>
                        {!puedeCompartirArchivos && (
                            <button type="button" className="boton-secundario boton-pequeno" onClick={enviarTexto}>
                                💬 Enviar como texto
                            </button>
                        )}
                        <button type="button" className="boton-secundario boton-pequeno" onClick={copiarTexto}>
                            📋 Copiar texto
                        </button>
                    </div>

                    <button type="button" className="boton-principal" onClick={onCerrar}>
                        Listo
                    </button>
                </div>
            </div>
        </dialog>
    );
}
