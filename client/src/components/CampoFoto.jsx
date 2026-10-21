import { useRef, useState } from "react";
import { reducirFoto } from "../fotos.js";

// foto: data URL nueva, null (quitada) o undefined (sin cambios).
export default function CampoFoto({ id, foto, fotoActual, onCambio }) {
    const entrada = useRef(null);
    const [procesando, setProcesando] = useState(false);
    const [error, setError] = useState("");

    const vista = foto === undefined ? fotoActual : foto;

    async function elegir(evento) {
        const archivo = evento.target.files?.[0];
        evento.target.value = "";

        if (!archivo) return;

        setError("");
        setProcesando(true);

        try {
            onCambio(await reducirFoto(archivo));
        } catch (err) {
            setError(err.message || "No se pudo leer la imagen.");
        } finally {
            setProcesando(false);
        }
    }

    return (
        <fieldset className="grupo-campos campo-foto">
            <legend>Foto del producto (opcional)</legend>

            <div className="foto-producto-editor">
                <div className="foto-previa">
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
                        {procesando ? "Procesando..." : vista ? "📷 Cambiar foto" : "📷 Tomar o elegir foto"}
                    </button>

                    {vista && (
                        <button
                            type="button"
                            className="boton-enlace"
                            onClick={() => onCambio(fotoActual ? null : undefined)}
                        >
                            Quitar foto
                        </button>
                    )}

                    <span className="ayuda-campo">En el celular puedes tomarla con la cámara.</span>
                    {error && <span className="texto-error">{error}</span>}
                </div>
            </div>
        </fieldset>
    );
}
