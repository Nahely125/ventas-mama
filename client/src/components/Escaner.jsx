import { useEffect, useRef, useState } from "react";

// Abre la cámara y lee un código de barras o QR. Llama a onLeido(texto) al encontrarlo.
// La librería se carga solo cuando se abre el escáner, para no hacer pesada la app.
export default function Escaner({ onLeido, onCerrar }) {
    const dialogo = useRef(null);
    const video = useRef(null);
    const [error, setError] = useState("");

    useEffect(() => {
        dialogo.current?.showModal();

        let controles = null;
        let cancelado = false;

        (async () => {
            try {
                const { BrowserMultiFormatReader } = await import("@zxing/browser");
                const lector = new BrowserMultiFormatReader();

                controles = await lector.decodeFromConstraints(
                    { video: { facingMode: { ideal: "environment" } } },
                    video.current,
                    (resultado) => {
                        if (resultado && !cancelado) {
                            cancelado = true;
                            controles?.stop();
                            navigator.vibrate?.(80);
                            onLeido(resultado.getText().trim());
                        }
                    }
                );

                if (cancelado) controles.stop();
            } catch (err) {
                console.error(err);
                setError(
                    err?.name === "NotAllowedError"
                        ? "No diste permiso para usar la cámara. Actívalo en la configuración del navegador."
                        : "No se pudo abrir la cámara. Puedes escribir el código a mano."
                );
            }
        })();

        return () => {
            cancelado = true;
            controles?.stop();
        };
    }, [onLeido]);

    return (
        <dialog
            ref={dialogo}
            className="modal modal-escaner"
            onClose={onCerrar}
            aria-labelledby="titulo-escaner"
        >
            <div className="modal-contenido">
                <div className="modal-encabezado">
                    <h2 id="titulo-escaner">Escanear código</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">
                        ✕
                    </button>
                </div>

                {error ? (
                    <p className="mensaje mensaje-error">{error}</p>
                ) : (
                    <>
                        <div className="visor-escaner">
                            <video ref={video} muted playsInline />
                            <span className="marco-escaner" aria-hidden="true"></span>
                        </div>
                        <p className="ayuda-campo">Apunta la cámara al código de barras o QR del producto.</p>
                    </>
                )}

                <button type="button" className="boton-secundario" onClick={onCerrar}>
                    Cancelar
                </button>
            </div>
        </dialog>
    );
}
