import { useRef, useState } from "react";
import { leerImagen, prepararFoto, prepararOriginal } from "../fotos.js";
import { ESTILOS } from "../escenas.js";

/* foto: data URL nueva, null (quitada) o undefined (sin cambios).
   onCambio(foto, { editada, original }): editada = tiene una escena del catálogo;
   original = la foto sin editar (para poder cambiar de escena después).
   fotoOriginal: dirección de la foto guardada sin editar (solo al editar un producto).
   estiloAuto: escena que corresponde a "Automático" según la feria del producto.
   onProcesando(true/false): mientras se edita la foto (no se debe guardar todavía). */
export default function CampoFoto({ id, foto, fotoActual, fotoOriginal, estiloAuto = "estudio", onCambio, onProcesando }) {
    const entrada = useRef(null);
    // Imagen que se está editando (recién elegida o la guardada), con su giro y escena.
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
            const estilo = nueva.estilo === "auto" ? estiloAuto : nueva.estilo;
            const editada = estilo !== "original";
            const resultado = await prepararFoto(nueva.imagen, { giro: nueva.giro, estilo });
            onCambio(resultado, { editada, original: editada ? prepararOriginal(nueva.imagen, nueva.giro) : null });
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
            await aplicar({ imagen, giro: 0, estilo: edicion?.estilo ?? "auto" });
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

    const nombreAuto = ESTILOS.find((e) => e.valor === estiloAuto)?.texto.replace(/^\S+\s/, "");
    const ayudaEstilo = editando && ESTILOS.find((e) => e.valor === editando.estilo)?.ayuda;

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
                        <button
                            type="button"
                            className="boton-secundario boton-pequeno"
                            onClick={() => aplicar({ ...editando, giro: (editando.giro + 90) % 360 })}
                            disabled={procesando}
                        >
                            ↻ Girar
                        </button>
                    )}

                    {foto === undefined && fotoActual && (
                        <button
                            type="button"
                            className="boton-enlace"
                            onClick={() => abrir(fotoOriginal ?? fotoActual)}
                            disabled={procesando}
                        >
                            ✨ Cambiar el estilo de esta foto
                        </button>
                    )}

                    {vista && !procesando && (
                        <button type="button" className="boton-enlace" onClick={quitar}>
                            Quitar foto
                        </button>
                    )}

                    {error && <span className="texto-error">{error}</span>}
                </div>
            </div>

            {editando && (
                <div className="estilos-foto" role="radiogroup" aria-label="Estilo de la foto">
                    {ESTILOS.map((e) => (
                        <button
                            key={e.valor}
                            type="button"
                            role="radio"
                            aria-checked={editando.estilo === e.valor}
                            className={editando.estilo === e.valor ? "activo" : ""}
                            onClick={() => aplicar({ ...editando, estilo: e.valor })}
                            disabled={procesando}
                        >
                            {e.valor === "auto" ? `${e.texto} (${nombreAuto})` : e.texto}
                        </button>
                    ))}
                </div>
            )}

            <span className="ayuda-campo">
                {procesando
                    ? "Quitando el fondo y armando la escena. La primera vez tarda un poco más."
                    : ayudaEstilo
                        ? `${ayudaEstilo} El producto es el de tu foto; solo cambia lo que lo rodea.`
                        : "En el celular puedes tomarla con la cámara. Luego eliges la escena: estudio, navidad, madera, lila o blanco."}
            </span>
        </fieldset>
    );
}
