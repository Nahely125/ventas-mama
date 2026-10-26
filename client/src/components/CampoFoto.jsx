import { useRef, useState } from "react";
import { leerImagen, prepararFoto } from "../fotos.js";

/* foto: data URL nueva, null (quitada) o undefined (sin cambios).
   onCambio(foto, editada): editada = la foto ya tiene el estilo del catálogo.
   onProcesando(true/false): mientras se edita la foto (no se debe guardar todavía). */
export default function CampoFoto({ id, foto, fotoActual, onCambio, onProcesando }) {
    const entrada = useRef(null);
    // Imagen que se está editando (recién elegida o la guardada), con su giro y estilo.
    const [edicion, setEdicion] = useState(null);
    const [procesando, setProcesando] = useState(false);
    const [error, setError] = useState("");

    const vista = foto === undefined ? fotoActual : foto;
    // Si el formulario se limpió (foto sin cambios), ya no hay nada en edición.
    const editando = foto ? edicion : null;

    function cambiarProcesando(valor) {
        setProcesando(valor);
        onProcesando?.(valor);
    }

    async function aplicar(nueva) {
        setError("");
        cambiarProcesando(true);

        try {
            setEdicion(nueva);
            onCambio(await prepararFoto(nueva.imagen, nueva), nueva.estilo);
        } catch (err) {
            setError(err.message || "No se pudo editar la foto.");
        } finally {
            cambiarProcesando(false);
        }
    }

    async function abrir(origen) {
        setError("");
        cambiarProcesando(true);

        try {
            const imagen = await leerImagen(origen);
            await aplicar({ imagen, giro: 0, estilo: true });
        } catch (err) {
            setError(err.message || "No se pudo leer la imagen.");
            cambiarProcesando(false);
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
                        {procesando ? "✨ Editando la foto..." : vista ? "📷 Cambiar foto" : "📷 Tomar o elegir foto"}
                    </button>

                    {editando && (
                        <div className="foto-edicion">
                            <button
                                type="button"
                                className="boton-secundario boton-pequeno"
                                onClick={() => aplicar({ ...editando, giro: (editando.giro + 90) % 360 })}
                                disabled={procesando}
                            >
                                ↻ Girar
                            </button>
                            <label className="casilla">
                                <input
                                    type="checkbox"
                                    checked={editando.estilo}
                                    onChange={(e) => aplicar({ ...editando, estilo: e.target.checked })}
                                    disabled={procesando}
                                />
                                <span>✨ Fondo blanco</span>
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
                            ✨ Editar esta foto (fondo blanco)
                        </button>
                    )}

                    {vista && !procesando && (
                        <button type="button" className="boton-enlace" onClick={quitar}>
                            Quitar foto
                        </button>
                    )}

                    <span className="ayuda-campo">
                        {procesando
                            ? "Quitando el fondo y mejorando la luz. La primera vez tarda un poco más."
                            : editando?.estilo
                                ? "Se quitó el fondo, se mejoró la luz y quedó sobre blanco. Si no te gusta, desmarca «Fondo blanco»."
                                : "En el celular puedes tomarla con la cámara."}
                    </span>
                    {error && <span className="texto-error">{error}</span>}
                </div>
            </div>
        </fieldset>
    );
}
