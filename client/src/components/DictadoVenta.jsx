import { useEffect, useRef, useState } from "react";
import { interpretarPedido, vozDisponible } from "../voz.js";

// Ventana para agregar productos a la venta dictándolos ("tres cintas rojas y dos docenas de esferas").
export default function DictadoVenta({ productos, onAgregar, onCerrar }) {
    const dialogo = useRef(null);
    const reconocimiento = useRef(null);
    const [escuchando, setEscuchando] = useState(false);
    const [texto, setTexto] = useState("");
    const [provisional, setProvisional] = useState("");
    const [error, setError] = useState("");
    const [lineas, setLineas] = useState([]);

    const conVoz = vozDisponible();

    useEffect(() => {
        dialogo.current?.showModal();
        if (conVoz) escuchar();
        return () => reconocimiento.current?.abort();
        // Solo al abrir.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function escuchar() {
        const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Reconocimiento) return;

        const rec = new Reconocimiento();
        rec.lang = "es-PE";
        rec.interimResults = true;
        rec.continuous = true;

        rec.onresult = (evento) => {
            let final = "";
            let parcial = "";

            for (let i = evento.resultIndex; i < evento.results.length; i++) {
                const frase = evento.results[i][0].transcript;
                if (evento.results[i].isFinal) final += frase;
                else parcial += frase;
            }

            if (final) {
                setTexto((anterior) => `${anterior} ${final}`.trim());
            }
            setProvisional(parcial);
        };

        rec.onerror = (evento) => {
            setError(
                evento.error === "not-allowed"
                    ? "No diste permiso para usar el micrófono. Puedes escribir el pedido abajo."
                    : evento.error === "no-speech"
                        ? "No te escuché. Toca «Hablar» e inténtalo de nuevo."
                        : "No se pudo usar el micrófono. Puedes escribir el pedido abajo."
            );
        };

        rec.onend = () => {
            setEscuchando(false);
            setProvisional("");
        };

        setError("");
        reconocimiento.current = rec;
        rec.start();
        setEscuchando(true);
    }

    function detener() {
        reconocimiento.current?.stop();
    }

    // Cada vez que cambia el texto se vuelve a interpretar.
    useEffect(() => {
        setLineas(
            interpretarPedido(texto, productos ?? []).map((linea, indice) => ({
                ...linea,
                clave: indice,
                incluir: Boolean(linea.producto)
            }))
        );
    }, [texto, productos]);

    function cambiarLinea(clave, cambios) {
        setLineas((anteriores) => anteriores.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)));
    }

    const elegidas = lineas.filter((l) => l.incluir && l.producto && l.cantidad > 0);

    return (
        <dialog ref={dialogo} className="modal" onClose={onCerrar} aria-labelledby="titulo-dictado">
            <div className="modal-contenido formulario">
                <div className="modal-encabezado">
                    <h2 id="titulo-dictado">🎤 Dictar productos</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">
                        ✕
                    </button>
                </div>

                <p className="ayuda-campo">
                    Di la cantidad y el producto. Ej.: «<em>tres cintas rojas, dos docenas de esferas doradas y un reno de luces</em>».
                </p>

                {conVoz && (
                    <button
                        type="button"
                        className={`boton-microfono ${escuchando ? "escuchando" : ""}`}
                        onClick={escuchando ? detener : escuchar}
                        aria-pressed={escuchando}
                    >
                        <span className="icono-microfono" aria-hidden="true">🎤</span>
                        {escuchando ? "Escuchando... toca para terminar" : "Hablar"}
                    </button>
                )}

                <div className="campo">
                    <label htmlFor="texto-dictado">{conVoz ? "Lo que escuché (puedes corregirlo)" : "Escribe o dicta el pedido"}</label>
                    <textarea
                        id="texto-dictado"
                        rows={3}
                        value={provisional ? `${texto} ${provisional}`.trim() : texto}
                        onChange={(e) => setTexto(e.target.value)}
                        placeholder="Ej. 3 cintas rojas y 2 docenas de esferas"
                    />
                    {!conVoz && (
                        <span className="ayuda-campo">
                            Este navegador no tiene dictado. Usa el 🎤 del teclado del celular o escribe el pedido.
                        </span>
                    )}
                </div>

                {error && <p className="mensaje mensaje-error" role="alert">{error}</p>}

                {lineas.length > 0 && (
                    <ul className="lineas-dictado">
                        {lineas.map((linea) => (
                            <li key={linea.clave} className={linea.producto ? "" : "sin-coincidencia"}>
                                <label className="casilla">
                                    <input
                                        type="checkbox"
                                        checked={linea.incluir}
                                        disabled={!linea.producto}
                                        onChange={(e) => cambiarLinea(linea.clave, { incluir: e.target.checked })}
                                        aria-label={`Incluir ${linea.texto}`}
                                    />
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    className="cantidad-dictado"
                                    value={linea.cantidad}
                                    onChange={(e) => cambiarLinea(linea.clave, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
                                    aria-label="Cantidad"
                                />
                                <select
                                    value={linea.modalidad}
                                    onChange={(e) => cambiarLinea(linea.clave, { modalidad: e.target.value })}
                                    aria-label="Unidad, media docena o docena"
                                >
                                    <option value="unidad">u.</option>
                                    <option value="media">½ doc.</option>
                                    <option value="docena">doc.</option>
                                </select>
                                <select
                                    className="producto-dictado"
                                    value={linea.producto?.id ?? ""}
                                    onChange={(e) => {
                                        const producto = (productos ?? []).find((p) => String(p.id) === e.target.value) ?? null;
                                        cambiarLinea(linea.clave, { producto, incluir: Boolean(producto) });
                                    }}
                                    aria-label={`Producto para «${linea.texto}»`}
                                >
                                    <option value="">¿«{linea.texto}»? Elige el producto</option>
                                    {(productos ?? []).map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.nombre}{p.stock === 0 ? " (agotado)" : ""}
                                        </option>
                                    ))}
                                </select>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="modal-acciones">
                    <button type="button" className="boton-secundario" onClick={onCerrar}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="boton-principal"
                        disabled={elegidas.length === 0}
                        onClick={() => onAgregar(elegidas)}
                    >
                        Agregar {elegidas.length || ""} a la venta
                    </button>
                </div>
            </div>
        </dialog>
    );
}
