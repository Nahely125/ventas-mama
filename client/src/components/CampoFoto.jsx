import { useRef, useState } from "react";
import { leerImagen, prepararFoto } from "../fotos.js";

// foto: data URL nueva, null (quitada) o undefined (sin cambios).
export default function CampoFoto({ id, foto, fotoActual, onCambio }) {
    const entrada = useRef(null);
    // Imagen que se está editando (recién elegida o la guardada), con su giro y estilo.
    const [edicion, setEdicion] = useState(null);
    const [procesando, setProcesando] = useState(false);
    const [error, setError] = useState("");

    const vista = foto === undefined ? fotoActual : foto;
    // Si el formulario se limpió (foto sin cambios), ya no hay nada en edición.
    const editando = foto ? edicion : null;

    function aplicar(nueva) {
        setEdicion(nueva);
        onCambio(prepararFoto(nueva.imagen, nueva));
    }

    async function abrir(origen) {
        setError("");
        setProcesando(true);

        try {
            aplicar({ imagen: await leerImagen(origen), giro: 0, estilo: true });
        } catch (err) {
            setError(err.message || "No se pudo leer la imagen.");
        } finally {
            setProcesando(false);
        }
    }

    function elegir(evento) {
        const archivo = evento.target.files?.[0];
        evento.target.value = "";

        if (archivo) abrir(archivo);
    }

    function quitar() {
        setEdicion(null);
        onCambio(fotoActual ? null : undefined);
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

                    {editando && (
                        <div className="foto-edicion">
                            <button
                                type="button"
                                className="boton-secundario boton-pequeno"
                                onClick={() => aplicar({ ...editando, giro: (editando.giro + 90) % 360 })}
                            >
                                ↻ Girar
                            </button>
                            <label className="casilla">
                                <input
                                    type="checkbox"
                                    checked={editando.estilo}
                                    onChange={(e) => aplicar({ ...editando, estilo: e.target.checked })}
                                />
                                <span>✨ Estilo catálogo</span>
                            </label>
                        </div>
                    )}

                    {foto === undefined && fotoActual && (
                        <button
                            type="button"
                            className="boton-enlace"
                            onClick={() => abrir(fotoActual)}
                            disabled={procesando}
                        >
                            ✨ Editar y estilizar esta foto
                        </button>
                    )}

                    {vista && (
                        <button type="button" className="boton-enlace" onClick={quitar}>
                            Quitar foto
                        </button>
                    )}

                    <span className="ayuda-campo">
                        {editando?.estilo
                            ? "Se mejoran la luz y el color, y se le da un marco para el catálogo."
                            : "En el celular puedes tomarla con la cámara."}
                    </span>
                    {error && <span className="texto-error">{error}</span>}
                </div>
            </div>
        </fieldset>
    );
}
