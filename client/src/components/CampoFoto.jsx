import { useRef, useState } from "react";
import { leerImagen, prepararFoto } from "../fotos.js";

/* Foto del producto: se sube la foto original, tal cual (solo se reduce de tamaño para que
   cargue rápido; no se edita ni se le quita el fondo).
   foto: data URL nueva, null (quitada) o undefined (sin cambios).
   onCambio(foto, { editada: false, original: null }).
   onProcesando(true/false): mientras se prepara la foto (no se debe guardar todavía). */
export default function CampoFoto({ id, foto, fotoActual, onCambio, onProcesando }) {
    const entrada = useRef(null);
    const [procesando, setProcesando] = useState(false);
    const [error, setError] = useState("");

    const vista = foto === undefined ? fotoActual : foto;

    function cambiarProcesando(valor) {
        setProcesando(valor);
        onProcesando?.(valor);
    }

    async function elegir(evento) {
        const archivo = evento.target.files?.[0];
        evento.target.value = "";

        if (!archivo) return;

        setError("");
        cambiarProcesando(true);

        try {
            const imagen = await leerImagen(archivo);
            onCambio(await prepararFoto(imagen, { estilo: "original" }), { editada: false, original: null });
            imagen.close?.();
        } catch (err) {
            setError(err.message || "No se pudo leer la imagen.");
        } finally {
            cambiarProcesando(false);
        }
    }

    return (
        <fieldset className="grupo-campos campo-foto">
            <legend>Foto del producto (opcional)</legend>

            <div className="foto-producto-editor">
                <div className={`foto-previa ${procesando ? "procesando" : ""}`}>
                    {vista ? (
                        <img src={vista} alt="Foto del producto" />
                    ) : (
                        <span aria-hidden="true">🖼️</span>
                    )}
                </div>

                <div className="foto-acciones">
                    <input
                        ref={entrada}
                        type="file"
                        id={id}
                        accept="image/*"
                        onChange={elegir}
                        hidden
                    />
                    <button
                        type="button"
                        className="boton-secundario boton-pequeno"
                        onClick={() => entrada.current?.click()}
                        disabled={procesando}
                    >
                        {procesando ? "Preparando la foto..." : vista ? "📷 Cambiar foto" : "📷 Tomar o elegir foto"}
                    </button>

                    {vista && !procesando && (
                        <button type="button" className="boton-enlace" onClick={() => onCambio(fotoActual ? null : undefined)}>
                            Quitar foto
                        </button>
                    )}

                    <span className="ayuda-campo">Se sube la foto tal cual. En el celular puedes tomarla con la cámara.</span>
                    {error && <span className="texto-error">{error}</span>}
                </div>
            </div>
        </fieldset>
    );
}
